import { createClient } from '@supabase/supabase-js';

/* Fallback hardcoded keys — these are publishable / anon keys, safe to expose.
   Env vars are still preferred (allow override for staging/prod) but won't crash if HMR loses them. */
const FALLBACK_URL = 'https://itdekgvdgatfrlfhhdhs.supabase.co';
const FALLBACK_KEY = 'sb_publishable_IqXCZw1o6PF4TOrI6eEXRA_46PM2K4N';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || FALLBACK_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_KEY;

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
  },
});

export type Pack = {
  pack_id: string;
  sku_id: string | null;
  level: string;
  category: 'kanji' | 'grammar' | 'vocab' | 'glossary';
  vol: number | null;
  title: string;
  entry_count: number;
  is_free: boolean;
  price_thb: number | null;
};

export type Entitlement = {
  id: string;
  user_id: string;
  pack_id: string;
  source: 'free' | 'payhip' | 'gift' | 'first_edition';
  granted_at: string;
  payment_ref: string | null;
};
