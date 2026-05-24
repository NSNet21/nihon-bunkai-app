import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';

type AuthStatus = 'loading' | 'signed-in' | 'signed-out';

type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  entitlements: Set<string>;
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
  const [entitlements, setEntitlements] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setStatus(data.session ? 'signed-in' : 'signed-out');
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setStatus(next ? 'signed-in' : 'signed-out');
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setEntitlements(new Set());
      return;
    }
    void loadEntitlements(session.user.id);
  }, [session?.user]);

  async function loadEntitlements(userId: string) {
    const { data, error } = await supabase
      .from('entitlements')
      .select('pack_id')
      .eq('user_id', userId);
    if (error) {
      console.warn('[auth] loadEntitlements failed', error.message);
      return;
    }
    setEntitlements(new Set((data ?? []).map((r) => r.pack_id)));
  }

  const value: AuthContextValue = useMemo(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      entitlements,
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
    [status, session, entitlements],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
