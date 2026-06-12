import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_HEALTH_PATH = '/rest/v1/health_check?select=id&limit=1';

function requireValue(value, label) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    throw new Error(`Missing ${label}`);
  }
  return normalized;
}

export function buildKeepaliveRequest({ supabaseUrl, anonKey }) {
  const baseUrl = requireValue(supabaseUrl, 'SUPABASE_URL').replace(/\/+$/, '');
  const key = requireValue(anonKey, 'SUPABASE_ANON_KEY');

  return {
    url: `${baseUrl}${DEFAULT_HEALTH_PATH}`,
    options: {
      method: 'GET',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    },
  };
}

export async function runSupabaseKeepalive({
  env = process.env,
  fetchImpl = globalThis.fetch,
  log = console.log,
} = {}) {
  const supabaseUrl = env.SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = env.SUPABASE_ANON_KEY || env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!String(supabaseUrl ?? '').trim() || !String(anonKey ?? '').trim()) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('Fetch API is not available in this Node runtime');
  }

  const request = buildKeepaliveRequest({ supabaseUrl, anonKey });
  const response = await fetchImpl(request.url, request.options);
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Supabase keepalive failed with HTTP ${response.status}: ${body.slice(0, 300)}`);
  }

  log(`Supabase keepalive OK (${response.status})`);
}

export function isMainModule(moduleUrl, argvPath) {
  if (!argvPath) {
    return false;
  }
  return resolve(fileURLToPath(moduleUrl)) === resolve(argvPath);
}

if (isMainModule(import.meta.url, process.argv[1])) {
  runSupabaseKeepalive().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
