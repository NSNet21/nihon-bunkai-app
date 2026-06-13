import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useToast } from '@/components/toast';
import {
  requestPasswordResetEmail,
  resendSignUpConfirmationEmail,
  signInWithConfirmedPassword,
  signInWithExistingUserMagicLink,
  signUpWithEmailConfirmation,
  updateRecoveredPassword,
} from '@/lib/auth-email-actions';
import { clearAllSrsData } from '@/lib/srs-store';
import { startSync, stopSync } from '@/lib/srs-sync';
import { supabase } from '@/lib/supabase';
import { usePersistedState } from '@/hooks/use-persisted-state';

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
  resendSignUpConfirmation: (email: string) => Promise<{ error: string | null }>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<{ error: string | null }>;
  refreshEntitlements: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [entitledPacks, setEntitledPacks] = useState<Set<string>>(new Set());
  const [entitledSkus, setEntitledSkus] = useState<Set<string>>(new Set());
  const { showToast } = useToast();
  /* Suppress repeat error toasts — if entitlement load fails on first focus,
     each subsequent focus would re-toast. Only surface once per session. */
  const entitlementErrorToastedRef = useRef(false);

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

  /* Auto-sync toggle — default ON (sync meta to cloud is the killer
     feature; opt-out for users who explicitly want local-only). Stored
     per-device. Affects whether startSync wires listeners + pulls. */
  const [autoSyncEnabled] = usePersistedState<boolean>('auto-sync', true);

  useEffect(() => {
    if (!session?.user) {
      setEntitledPacks(new Set());
      setEntitledSkus(new Set());
      stopSync();
      return;
    }
    const userId = session.user.id;
    void loadEntitlements(userId);
    /* Wire FSRS/session/streak sync. startSync runs initial pull +
       binds focus + visibility listeners. Skipped when user opted out
       via Settings. */
    if (autoSyncEnabled) {
      startSync(userId);
    } else {
      stopSync();
    }

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
  }, [session?.user, autoSyncEnabled]);

  async function loadEntitlements(userId: string) {
    const { data, error } = await supabase
      .from('entitlements')
      .select('pack_id, sku_id')
      .eq('user_id', userId);
    if (error) {
      console.warn('[auth] loadEntitlements failed', error.message);
      /* Silent failure here = paying customer doesn't see their Download
         buttons + has no idea why. Surface ONCE per session — focus-refresh
         retries silently, so user doesn't get spammed if they refocus. */
      if (!entitlementErrorToastedRef.current) {
        entitlementErrorToastedRef.current = true;
        showToast('โหลดสิทธิ์ไม่สำเร็จ ลองรีเฟรชหน้านี้', { kind: 'error', durationMs: 5000 });
      }
      return;
    }
    /* Successful load — clear the error guard so a later transient failure
       can re-toast (network blip, then permanent failure later). */
    entitlementErrorToastedRef.current = false;
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
        const currentUrl = typeof window !== 'undefined' ? window.location.href : undefined;
        return signInWithExistingUserMagicLink(supabase, email, currentUrl);
      },
      async signInWithPassword(email, password) {
        return signInWithConfirmedPassword(supabase, email, password);
      },
      async signUpWithPassword(email, password) {
        const currentUrl = typeof window !== 'undefined' ? window.location.href : undefined;
        return signUpWithEmailConfirmation(supabase, email, password, currentUrl);
      },
      async resendSignUpConfirmation(email) {
        const currentUrl = typeof window !== 'undefined' ? window.location.href : undefined;
        return resendSignUpConfirmationEmail(supabase, email, currentUrl);
      },
      async requestPasswordReset(email) {
        const currentUrl = typeof window !== 'undefined' ? window.location.href : undefined;
        return requestPasswordResetEmail(supabase, email, currentUrl);
      },
      async updatePassword(password) {
        return updateRecoveredPassword(supabase, password);
      },
      async signOut() {
        /* Stop sync BEFORE clearing local data — prevents listeners
           from firing on a stale userId during teardown. Clear local
           SRS data so the next user signing in on the same browser
           doesn't see leftover schedule/streak. */
        stopSync();
        await clearAllSrsData();
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
