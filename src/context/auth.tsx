import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

type AuthStatus = 'loading' | 'signed-in' | 'signed-out';

type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  /** Free-pack ownership (pack_id) — embedded free decks granted on signup. */
  entitledPacks: Set<string>;
  /** Paid-SKU ownership (sku_id) — Payhip purchases, drives Shop Download buttons. */
  entitledSkus: Set<string>;
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithPassword: (email: string, password: string) => Promise<{ error: string | null; needsEmailConfirm: boolean }>;
  signOut: () => Promise<{ error: string | null }>;
  refreshEntitlements: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [entitledPacks, setEntitledPacks] = useState<Set<string>>(new Set());
  const [entitledSkus, setEntitledSkus] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setStatus(data.session ? 'signed-in' : 'signed-out');
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (__DEV__) {
        console.log('[auth] event:', event, '· user:', next?.user?.email ?? 'none');
      }
      setSession(next);
      setStatus(next ? 'signed-in' : 'signed-out');
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setEntitledPacks(new Set());
      setEntitledSkus(new Set());
      return;
    }
    const userId = session.user.id;
    void loadEntitlements(userId);

    /* Layer 1: Realtime subscription — instant unlock when webhook grants new SKU */
    const channel = supabase
      .channel(`entitlements:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'entitlements',
          filter: `user_id=eq.${userId}`,
        },
        () => void loadEntitlements(userId),
      )
      .subscribe();

    /* Layer 2: On-focus refetch — safety net when Realtime missed an event */
    const onFocus = () => void loadEntitlements(userId);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('focus', onFocus);
    }

    return () => {
      void supabase.removeChannel(channel);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('focus', onFocus);
      }
    };
  }, [session?.user]);

  async function loadEntitlements(userId: string) {
    const { data, error } = await supabase
      .from('entitlements')
      .select('pack_id, sku_id')
      .eq('user_id', userId);
    if (error) {
      console.warn('[auth] loadEntitlements failed', error.message);
      return;
    }
    const packs = new Set<string>();
    const skus = new Set<string>();
    for (const row of data ?? []) {
      if (row.pack_id) packs.add(row.pack_id);
      if (row.sku_id) skus.add(row.sku_id);
    }
    setEntitledPacks(packs);
    setEntitledSkus(skus);
  }

  const value: AuthContextValue = useMemo(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      entitledPacks,
      entitledSkus,
      async signInWithMagicLink(email) {
        const redirectTo =
          typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined;
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
        });
        return { error: error?.message ?? null };
      },
      async signInWithPassword(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error?.message ?? null };
      },
      async signUpWithPassword(email, password) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) return { error: error.message, needsEmailConfirm: false };
        const needsEmailConfirm = !data.session && !!data.user;
        return { error: null, needsEmailConfirm };
      },
      async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) console.warn('[auth] signOut error:', error.message);
        return { error: error?.message ?? null };
      },
      async refreshEntitlements() {
        if (session?.user) await loadEntitlements(session.user.id);
      },
    }),
    [status, session, entitledPacks, entitledSkus],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
