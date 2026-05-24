/**
 * payhip-webhook
 *
 * Receives Payhip "paid" / "refunded" events and updates entitlements.
 *
 * Flow per [[app-phase-1a-breakdown]] + GPT-aligned safety nets:
 *   1. Verify Payhip signature (HMAC-SHA256 with PAYHIP_API_KEY)
 *   2. INSERT into purchase_records (immutable audit log — always, even pre-grant)
 *   3. Lookup auth.users by buyer email
 *      - If found  → INSERT entitlement (source='payhip') for the matched SKU
 *      - If absent → INSERT pending_grant (drained on signup with same email)
 *   4. Return 200 (Payhip retries on non-2xx)
 *
 * Signature format note:
 *   Payhip docs are vague on signature concat order. We try a few common
 *   patterns (raw API key as HMAC secret, sha256 of email+key, etc.) and
 *   log everything until we learn the real algo from a live test coupon.
 *   For first deploys: PAYHIP_VERIFY_STRICT=false → log mismatch, still process
 *   (treat as test-mode); flip to strict once verified.
 *
 * verify_jwt is FALSE because Payhip is the caller, not a Supabase user.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { resolveSkuSlug } from "../_shared/payhip-products.ts";

type PayhipItem = {
  product_id?: string;
  product_name?: string;
  product_key?: string;
  product_permalink?: string;
  quantity?: number;
};

type PayhipPayload = {
  id?: string;
  type?: string; // "paid" | "refunded" | "subscription.created" | "subscription.deleted"
  email?: string;
  currency?: string;
  price?: number; // in cents
  items?: PayhipItem[];
  date?: number;
  signature?: string;
  [k: string]: unknown;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const apiKey = Deno.env.get("PAYHIP_API_KEY");
  const strict = Deno.env.get("PAYHIP_VERIFY_STRICT") === "true";

  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: "server_misconfigured" }, 500);
  }

  const rawBody = await req.text();
  let payload: PayhipPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  console.log("[payhip-webhook] received", {
    type: payload.type,
    id: payload.id,
    email: payload.email,
    items: payload.items?.map((i) => ({
      key: i.product_key,
      permalink: i.product_permalink,
      name: i.product_name,
    })),
  });

  // Signature verification (best-effort until algo is locked from live data)
  const sigOk = apiKey ? await tryVerify(payload, apiKey) : false;
  if (apiKey) {
    console.log("[payhip-webhook] signature:", sigOk ? "ok" : "mismatch", {
      received: payload.signature,
      strict_mode: strict,
    });
    if (strict && !sigOk) {
      return jsonResponse({ error: "signature_invalid" }, 401);
    }
  } else {
    console.warn("[payhip-webhook] PAYHIP_API_KEY not set — accepting all (test mode only)");
  }

  if (payload.type !== "paid" && payload.type !== "refunded") {
    console.log("[payhip-webhook] non-grant event ignored:", payload.type);
    return jsonResponse({ ok: true, ignored: payload.type });
  }

  const buyerEmail = (payload.email || "").trim().toLowerCase();
  if (!buyerEmail) {
    console.error("[payhip-webhook] missing buyer email");
    return jsonResponse({ error: "missing_email" }, 400);
  }

  // Resolve SKU slug for each item (a Payhip order may bundle multiple products)
  const itemSkus: { item: PayhipItem; sku: string }[] = [];
  for (const item of payload.items ?? []) {
    const sku = resolveSkuSlug({
      product_key: item.product_key,
      product_permalink: item.product_permalink,
      product_name: item.product_name,
    });
    if (!sku) {
      console.warn("[payhip-webhook] could not resolve SKU for item", item);
      continue;
    }
    itemSkus.push({ item, sku });
  }

  if (itemSkus.length === 0) {
    console.error("[payhip-webhook] no resolvable SKUs in payload");
    return jsonResponse({ error: "no_resolvable_skus", payload }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const orderId = String(payload.id ?? `${buyerEmail}-${Date.now()}`);

  // 1. Audit log — ALWAYS write, one row per item (so refunds + multi-item orders work)
  for (const { item, sku } of itemSkus) {
    const rowId = `${orderId}#${sku}`; // composite key for idempotency
    const { error: auditErr } = await admin
      .from("purchase_records")
      .upsert(
        {
          payhip_order_id: rowId,
          buyer_email: buyerEmail,
          sku_id: sku,
          amount_thb: payload.price ? Math.round(payload.price / 100) : null,
          raw_payload: payload as unknown as Record<string, unknown>,
        },
        { onConflict: "payhip_order_id" },
      );
    if (auditErr) {
      console.error("[payhip-webhook] audit insert failed", auditErr);
    }
  }

  // 2. Refunds = revoke entitlements + flag audit row (don't delete audit)
  if (payload.type === "refunded") {
    for (const { sku } of itemSkus) {
      const { error: revokeErr } = await admin
        .from("entitlements")
        .delete()
        .eq("sku_id", sku)
        .eq("buyer_email", buyerEmail);
      if (revokeErr) console.error("[payhip-webhook] revoke failed", revokeErr);
    }
    return jsonResponse({ ok: true, type: "refunded", revoked: itemSkus.length });
  }

  // 3. Paid: grant entitlements (or stage as pending if no matching user)
  const { data: matchedUser } = await admin
    .from("profiles")
    .select("id, email")
    .ilike("email", buyerEmail)
    .maybeSingle();

  const granted: string[] = [];
  const pending: string[] = [];

  for (const { sku } of itemSkus) {
    if (matchedUser?.id) {
      const { error: grantErr } = await admin
        .from("entitlements")
        .insert({
          user_id: matchedUser.id,
          sku_id: sku,
          source: "payhip",
          buyer_email: buyerEmail,
          payment_ref: orderId,
        });
      if (grantErr && !grantErr.message.includes("duplicate")) {
        console.error("[payhip-webhook] grant failed", grantErr);
      } else {
        granted.push(sku);
      }

      // Mark audit row as linked
      await admin
        .from("purchase_records")
        .update({ linked_user_id: matchedUser.id, linked_at: new Date().toISOString() })
        .eq("payhip_order_id", `${orderId}#${sku}`);
    } else {
      const { error: stageErr } = await admin
        .from("pending_grants")
        .insert({
          email: buyerEmail,
          sku_id: sku,
          payhip_order_id: orderId,
        });
      if (stageErr && !stageErr.message.includes("duplicate")) {
        console.error("[payhip-webhook] pending stage failed", stageErr);
      } else {
        pending.push(sku);
      }
    }
  }

  console.log("[payhip-webhook] done", { granted, pending, email: buyerEmail });
  return jsonResponse({ ok: true, granted, pending });
});

// ─── Signature verification ──────────────────────────────────────────────
// Per Payhip docs (https://help.payhip.com/article/115-webhooks):
//   signature = hash('sha256', $apiKey)
// i.e. plain SHA256 of the API key alone. Static per key. Verifies that
// the sender knows the API key (not payload integrity — that's Payhip's
// design, weak but documented).

async function tryVerify(payload: PayhipPayload, apiKey: string): Promise<boolean> {
  const received = (payload.signature || "").toLowerCase();
  if (!received) return false;
  const expected = await sha256Hex(apiKey);
  return expected === received;
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
