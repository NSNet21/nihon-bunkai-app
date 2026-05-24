/**
 * get-signed-download-url
 *
 * Issues short-lived signed URLs for a paid SKU's zip files.
 *
 * Auth model:
 *   1. Caller's JWT is verified via supabase.auth.getUser() (RLS-aware client)
 *   2. Entitlement check uses service_role client (bypasses RLS for read)
 *   3. Storage signed URL created with service_role (bucket is private)
 *
 * Returns: { sku_id, files: [{ name, signedUrl, expiresAt }] }
 *
 * On 403 (no entitlement) the response is intentionally minimal — no info
 * about whether the SKU exists, who owns it, or why access was denied.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { BUCKET, isValidSku, SKU_TO_ZIPS } from "../_shared/sku-map.ts";

const SIGNED_URL_TTL_SECONDS = 5 * 60; // 5 min — matches Phase 1.3 spec

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "unauthorized" }, 401);

  let body: { sku_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const skuId = body.sku_id?.trim();
  if (!skuId || !isValidSku(skuId)) {
    return jsonResponse({ error: "invalid_sku" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return jsonResponse({ error: "server_misconfigured" }, 500);
  }

  // 1. Auth-bound client to verify caller
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return jsonResponse({ error: "unauthorized" }, 401);

  // 2. Service client for entitlement check + signed URL
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: ents, error: entErr } = await admin
    .from("entitlements")
    .select("id")
    .eq("user_id", user.id)
    .eq("sku_id", skuId)
    .limit(1);

  if (entErr) return jsonResponse({ error: "entitlement_check_failed" }, 500);
  if (!ents || ents.length === 0) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  // 3. Sign URLs for each zip in this SKU
  const zips = SKU_TO_ZIPS[skuId];
  const files: { name: string; signedUrl: string; expiresAt: number }[] = [];
  const expiresAt = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS;

  for (const zipName of zips) {
    const { data: signed, error: signErr } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(zipName, SIGNED_URL_TTL_SECONDS);

    if (signErr || !signed?.signedUrl) {
      return jsonResponse(
        { error: "sign_failed", file: zipName, detail: signErr?.message },
        500,
      );
    }
    files.push({ name: zipName, signedUrl: signed.signedUrl, expiresAt });
  }

  return jsonResponse({
    sku_id: skuId,
    files,
    ttl_seconds: SIGNED_URL_TTL_SECONDS,
  });
});
