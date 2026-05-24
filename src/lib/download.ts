/**
 * Download orchestrator.
 *
 * Calls get-signed-download-url edge function → fetches each zip →
 * persists to IndexedDB. Emits progress per file + overall.
 */

import { supabase } from './supabase';
import { saveZip, type DownloadedZip } from './download-store';
import { importZipsForSku } from './deck-import';

type SignedFile = { name: string; signedUrl: string; expiresAt: number };
type SignedResponse = {
  sku_id: string;
  files: SignedFile[];
  ttl_seconds: number;
};

export type ProgressEvent =
  | { kind: 'started'; total: number }
  | { kind: 'file-progress'; file: string; loaded: number; total: number; index: number; count: number }
  | { kind: 'file-done'; file: string; index: number; count: number }
  | { kind: 'all-done' }
  | { kind: 'error'; message: string };

export async function downloadSku(
  skuId: string,
  onProgress?: (e: ProgressEvent) => void,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // 1. Request signed URLs from edge function (auth = current session)
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { ok: false, error: 'not_authenticated' };

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://itdekgvdgatfrlfhhdhs.supabase.co';
  const endpoint = `${supabaseUrl}/functions/v1/get-signed-download-url`;

  let resp: Response;
  try {
    resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ sku_id: skuId }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'network_failed';
    onProgress?.({ kind: 'error', message: msg });
    return { ok: false, error: msg };
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    const msg = `edge_${resp.status}: ${body}`;
    onProgress?.({ kind: 'error', message: msg });
    return { ok: false, error: msg };
  }

  const payload: SignedResponse = await resp.json();
  const total = payload.files.length;
  onProgress?.({ kind: 'started', total });

  // 2. Fetch each zip + persist
  for (let i = 0; i < payload.files.length; i++) {
    const f = payload.files[i];
    try {
      const blob = await fetchWithProgress(f.signedUrl, (loaded, totalBytes) => {
        onProgress?.({
          kind: 'file-progress',
          file: f.name,
          loaded,
          total: totalBytes,
          index: i,
          count: total,
        });
      });

      const zip: DownloadedZip = {
        name: f.name,
        skuId,
        blob,
        sizeBytes: blob.size,
        downloadedAt: Date.now(),
      };
      await saveZip(zip);
      onProgress?.({ kind: 'file-done', file: f.name, index: i, count: total });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'fetch_failed';
      onProgress?.({ kind: 'error', message: msg });
      return { ok: false, error: msg };
    }
  }

  // After all zips saved → parse + import to deck-store so Browse picks them up
  try {
    const zipNames = payload.files.map((f) => f.name);
    await importZipsForSku(skuId, zipNames);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'import_failed';
    onProgress?.({ kind: 'error', message: msg });
    return { ok: false, error: msg };
  }

  onProgress?.({ kind: 'all-done' });
  return { ok: true };
}

/** Fetch with byte-level progress via Response.body reader. */
async function fetchWithProgress(
  url: string,
  onChunk: (loaded: number, total: number) => void,
): Promise<Blob> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`http_${resp.status}`);

  const contentLength = Number(resp.headers.get('Content-Length') || '0');
  if (!resp.body || contentLength === 0) {
    // No streaming available — fall back to direct blob (no progress)
    return resp.blob();
  }

  const reader = resp.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.length;
      onChunk(loaded, contentLength);
    }
  }

  return new Blob(chunks as BlobPart[], { type: 'application/zip' });
}
