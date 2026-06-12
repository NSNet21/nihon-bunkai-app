import { describe, expect, it, vi } from 'vitest';

import {
  buildKeepaliveRequest,
  isMainModule,
  runSupabaseKeepalive,
} from './supabase-keepalive.mjs';

describe('supabase keepalive', () => {
  it('builds a minimal health_check REST request with anon headers', () => {
    const request = buildKeepaliveRequest({
      supabaseUrl: 'https://itdekgvdgatfrlfhhdhs.supabase.co/',
      anonKey: 'anon-public-key',
    });

    expect(request.url).toBe(
      'https://itdekgvdgatfrlfhhdhs.supabase.co/rest/v1/health_check?select=id&limit=1',
    );
    expect(request.options).toMatchObject({
      method: 'GET',
      headers: {
        apikey: 'anon-public-key',
        Authorization: 'Bearer anon-public-key',
      },
    });
  });

  it('fails before fetching when required environment values are missing', async () => {
    await expect(
      runSupabaseKeepalive({
        env: { SUPABASE_URL: '', SUPABASE_ANON_KEY: '' },
        fetchImpl: vi.fn(),
        log: vi.fn(),
      }),
    ).rejects.toThrow('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  });

  it('reports a successful keepalive without logging the anon key', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '[{"id":1}]',
    });
    const log = vi.fn();

    await runSupabaseKeepalive({
      env: {
        SUPABASE_URL: 'https://itdekgvdgatfrlfhhdhs.supabase.co',
        SUPABASE_ANON_KEY: 'anon-public-key',
      },
      fetchImpl,
      log,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(log.mock.calls.flat().join('\n')).toContain('Supabase keepalive OK');
    expect(log.mock.calls.flat().join('\n')).not.toContain('anon-public-key');
  });

  it('detects CLI execution even when the path contains spaces', () => {
    expect(
      isMainModule(
        'file:///E:/Vscode%20PJ/AI%20AGENT%20Work%20Space/Nihon%20Bunaki%20Pj/companion-app/tools/supabase-keepalive.mjs',
        'E:\\Vscode PJ\\AI AGENT Work Space\\Nihon Bunaki Pj\\companion-app\\tools\\supabase-keepalive.mjs',
      ),
    ).toBe(true);
  });
});
