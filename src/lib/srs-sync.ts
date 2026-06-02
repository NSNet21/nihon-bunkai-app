/**
 * Supabase push/pull sync layer for FSRS meta (Phase C.4).
 *
 * Architecture rules (locked across [[app-stack-decisions]] +
 * [[db-migrations]] + GPT round 1 + 2 verdicts):
 * - Local Dexie = primary; Supabase = mirror
 * - Sync scope = META ONLY (cardStates, sessionLogs, streakMeta).
 *   NEVER push content (CSV decks live in download-store.ts).
 * - Last-write-wins per row via `updated_at`. NO version vectors.
 * - SERVER timestamps for `updated_at` — push strips client value;
 *   trigger/default fills server time → clock-skew immune.
 * - Persistent pending_sync queue → tab crash before flush ≠ data loss.
 * - Atomic Dexie tx in CRUD primitives (srs-store.ts) → no partial
 *   "row written, pending lost" state.
 * - navigator.locks → only ONE tab pushes at a time per origin.
 * - Pull on: sign-in + visibilitychange→visible (no polling, GPT
 *   verdict round 1).
 * - Hidden flush = best-effort (1.5s cap). Real safety = persisted queue.
 *
 * Public API:
 *   startSync(userId)  — wire listeners + initial pull
 *   stopSync()         — remove listeners (sign-out)
 *   pushNow(userId)    — manual flush (used by hidden-visibility flush)
 *   pullNow(userId)    — manual pull (used by toggle re-enable)
 */

import { supabase } from './supabase';
import {
  bulkDeletePendingSync,
  bulkPutCardStates,
  bulkPutSessionLogs,
  bulkPutStreakMeta,
  getCardStatesByEntryIds,
  getPendingSync,
  getSessionLogsByIds,
  getStreakMeta,
  getSyncMeta,
  putSyncMeta,
  type CardStateRow,
  type SessionLogRow,
  type StreakMetaRow,
} from './srs-store';

/* ─── Internal state ─────────────────────────────────────────────────── */

let isPulling = false;
let lastPullStartedAt = 0;
let currentUserId: string | null = null;
let abortController: AbortController | null = null;
/** Master switch — flipped true by startSync, false by stopSync.
 *  schedulePush + pull triggers respect this so toggling Auto Sync OFF
 *  in Settings genuinely disables network activity. Writes still queue
 *  in pending_sync (local), they just don't flush until re-enabled. */
let syncEnabled = false;
/** Min ms between pulls — prevents focus-storm when user alt-tabs rapidly.
 *  GPT verdict round 1: 30-60s. Picked 30s for snappier multi-device feel. */
const PULL_THROTTLE_MS = 30_000;
/** Hidden-flush time budget — best-effort push when tab hides.
 *  Don't block tab close for too long; if it doesn't finish, queue
 *  persists and next session catches up. */
const HIDDEN_FLUSH_TIMEOUT_MS = 1500;
/** Push debounce — coalesce rapid local writes into one batch. */
const PUSH_DEBOUNCE_MS = 5000;
let pushDebounceTimer: ReturnType<typeof setTimeout> | null = null;

/* DOM listener refs — captured at startSync so stopSync can remove
   exactly what was added. */
let onVisibilityChange: (() => void) | null = null;
let onFocus: (() => void) | null = null;

/* ─── PUSH ───────────────────────────────────────────────────────────── */

/** Schedule a debounced push. Called by sync hooks after local writes.
 *  No-op when syncEnabled is false (Auto Sync toggle OFF) — writes still
 *  queue in pending_sync but stay there until user re-enables sync. */
export function schedulePush(userId: string): void {
  if (!userId || !syncEnabled) return;
  currentUserId = userId;
  if (pushDebounceTimer) clearTimeout(pushDebounceTimer);
  pushDebounceTimer = setTimeout(() => {
    pushDebounceTimer = null;
    void pushNow(userId);
  }, PUSH_DEBOUNCE_MS);
}

/** Cancel any pending debounce + push immediately. Used by hidden-flush. */
export async function pushNow(userId: string): Promise<{ ok: boolean; pushed: number }> {
  if (!userId) return { ok: false, pushed: 0 };
  if (pushDebounceTimer) {
    clearTimeout(pushDebounceTimer);
    pushDebounceTimer = null;
  }
  /* navigator.locks ensures only ONE tab per origin runs the push body
     at a time. Other tabs queue up waiting on the same lock name and
     drain serially → no duplicate inserts, no race on lastPushedAt.
     Falls back to plain execution if API unavailable (Safari/old). */
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request('srs-sync-push', async () => doPush(userId));
  }
  return doPush(userId);
}

async function doPush(userId: string): Promise<{ ok: boolean; pushed: number }> {
  const queue = await getPendingSync();
  if (queue.length === 0) return { ok: true, pushed: 0 };

  /* Group by kind so we can batch-upsert per table. Within each kind,
     refIds are unique (deterministic queue IDs guarantee at most one
     pending per refId). */
  const cardRefs = new Set<string>();
  const sessionRefs = new Set<string>();
  let needsStreak = false;
  for (const p of queue) {
    if (p.kind === 'cardState') cardRefs.add(p.refId);
    else if (p.kind === 'sessionLog') sessionRefs.add(p.refId);
    else if (p.kind === 'streakMeta') needsStreak = true;
  }

  /* Re-read CURRENT rows from main tables via srs-store helpers (shares
     the same Dexie singleton — no extra connections). Critical: do NOT
     use any cached payload from queue (rows are pointers only). This
     guarantees we push the freshest state even if many writes happened
     between enqueue and flush. */
  const cardRows: CardStateRow[] = cardRefs.size > 0
    ? await getCardStatesByEntryIds(Array.from(cardRefs))
    : [];
  const sessionRows: SessionLogRow[] = sessionRefs.size > 0
    ? await getSessionLogsByIds(Array.from(sessionRefs))
    : [];
  let streakRow: StreakMetaRow | undefined;
  if (needsStreak) {
    const meta = await getStreakMeta();
    /* getStreakMeta returns a default row when never written; only
       push if it has actual data (updatedAt > 0). */
    if (meta.updatedAt > 0) streakRow = meta;
  }

  const succeededQueueIds: string[] = [];

  /* Push cardStates — strip client updatedAt (server fills via DEFAULT).
     entryId = local PK becomes entry_id in Supabase + needs user_id +
     ON CONFLICT (user_id, entry_id) upsert. */
  if (cardRows.length > 0) {
    const payload = cardRows.map((r) => ({
      user_id: userId,
      entry_id: r.entryId,
      deck_id: r.deckId,
      due: new Date(r.due).toISOString(),
      stability: r.stability,
      difficulty: r.difficulty,
      elapsed_days: r.elapsedDays,
      scheduled_days: r.scheduledDays,
      reps: r.reps,
      lapses: r.lapses,
      state: r.state,
      last_review: r.lastReview ? new Date(r.lastReview).toISOString() : null,
      /* INTENTIONALLY OMIT updated_at — server fills via DEFAULT now()
         on INSERT, trigger touch_updated_at on UPDATE. Clock-skew immune. */
    }));
    const { data, error } = await supabase
      .from('card_states')
      .upsert(payload, { onConflict: 'user_id,entry_id' })
      .select('entry_id, updated_at');
    if (error) {
      console.warn('[sync] push cardStates failed:', error.message);
    } else {
      /* Write server's authoritative updated_at back to local — keeps
         LWW comparisons consistent regardless of client clock. */
      if (data) {
        const updateBack = data.map((r) => {
          const local = cardRows.find((c) => c.entryId === r.entry_id);
          if (!local) return null;
          return { ...local, updatedAt: new Date(r.updated_at).getTime() };
        }).filter(Boolean) as CardStateRow[];
        await bulkPutCardStates(updateBack);
      }
      for (const r of cardRows) succeededQueueIds.push(`card:${r.entryId}`);
    }
  }

  /* Push sessionLogs — immutable, no conflict update needed but use
     upsert(ignoreDuplicates:true) so retry of a successful push doesn't
     error on duplicate sessionId PK. */
  if (sessionRows.length > 0) {
    const payload = sessionRows.map((r) => ({
      user_id: userId,
      session_id: r.sessionId,
      deck_id: r.deckId,
      deck_title: r.deckTitle,
      total_cards: r.totalCards,
      started_at: new Date(r.startedAt).toISOString(),
      ended_at: new Date(r.endedAt).toISOString(),
      ratings: r.ratings,
      again_count: r.againCount,
      hard_count: r.hardCount,
      good_count: r.goodCount,
      easy_count: r.easyCount,
      skipped_count: r.skippedCount,
    }));
    const { data, error } = await supabase
      .from('session_logs')
      .upsert(payload, { onConflict: 'session_id', ignoreDuplicates: false })
      .select('session_id, updated_at');
    if (error) {
      console.warn('[sync] push sessionLogs failed:', error.message);
    } else {
      if (data) {
        const updateBack = data.map((r) => {
          const local = sessionRows.find((s) => s.sessionId === r.session_id);
          if (!local) return null;
          return { ...local, updatedAt: new Date(r.updated_at).getTime() };
        }).filter(Boolean) as SessionLogRow[];
        await bulkPutSessionLogs(updateBack);
      }
      for (const r of sessionRows) succeededQueueIds.push(`session:${r.sessionId}`);
    }
  }

  /* Push streak — singleton per user, upsert on user_id. */
  if (streakRow) {
    const payload = {
      user_id: userId,
      current_streak: streakRow.currentStreak,
      longest_streak: streakRow.longestStreak,
      last_studied_date: streakRow.lastStudiedDate,
      total_sessions: streakRow.totalSessions,
      total_cards_studied: streakRow.totalCardsStudied,
    };
    const { data, error } = await supabase
      .from('streak_meta')
      .upsert(payload, { onConflict: 'user_id' })
      .select('updated_at')
      .single();
    if (error) {
      console.warn('[sync] push streakMeta failed:', error.message);
    } else {
      if (data) {
        await bulkPutStreakMeta([{
          ...streakRow,
          updatedAt: new Date(data.updated_at).getTime(),
        }]);
      }
      succeededQueueIds.push('streak:singleton');
    }
  }

  /* Remove successful entries from queue. Failed entries stay → next
     push retries them. Caller (schedulePush) doesn't auto-retry on
     failure here; the next user write or next pull will trigger another
     push attempt. (Exponential backoff TODO: add if production reveals
     persistent failures — minimal MVP keeps it simple per GPT verdict.) */
  if (succeededQueueIds.length > 0) {
    await bulkDeletePendingSync(succeededQueueIds);
    await putSyncMeta({ lastPushedAt: Date.now(), lastSyncUserId: userId });
  }

  const allOk = succeededQueueIds.length === queue.length;
  return { ok: allOk, pushed: succeededQueueIds.length };
}

/* ─── PULL ───────────────────────────────────────────────────────────── */

/** Fetch remote rows updated after our cursor + merge with LWW.
 *  Throttled + lock-protected so focus-storm doesn't spam Supabase. */
export async function pullNow(userId: string): Promise<{ ok: boolean; pulled: number }> {
  if (!userId) return { ok: false, pulled: 0 };
  /* Throttle — skip if last pull was <30s ago. AbortController also
     cancels any in-flight request when a new pull starts, but the
     throttle prevents the cycle of cancel→start→cancel→start. */
  const elapsed = Date.now() - lastPullStartedAt;
  if (isPulling || elapsed < PULL_THROTTLE_MS) {
    return { ok: false, pulled: 0 };
  }
  isPulling = true;
  lastPullStartedAt = Date.now();
  /* Cancel any in-flight request from previous trigger. Supabase JS
     supports AbortSignal on queries via .abortSignal() — passing the
     signal aborts the fetch when .abort() is called. */
  if (abortController) abortController.abort();
  abortController = new AbortController();
  const signal = abortController.signal;

  try {
    const meta = await getSyncMeta();
    /* If signing in as a different user, ignore cursor + pull fresh.
       Defensive — clearAllSrsData on sign-out should prevent this
       state, but defense in depth. */
    const sinceMs = meta.lastSyncUserId === userId ? meta.lastPulledAt : 0;
    const sinceIso = new Date(sinceMs).toISOString();

    /* Parallel fetch all 3 tables since cursor. */
    const [cardsRes, sessionsRes, streakRes] = await Promise.all([
      supabase
        .from('card_states')
        .select('*')
        .eq('user_id', userId)
        .gt('updated_at', sinceIso)
        .abortSignal(signal),
      supabase
        .from('session_logs')
        .select('*')
        .eq('user_id', userId)
        .gt('updated_at', sinceIso)
        .abortSignal(signal),
      supabase
        .from('streak_meta')
        .select('*')
        .eq('user_id', userId)
        .gt('updated_at', sinceIso)
        .abortSignal(signal)
        .maybeSingle(),
    ]);

    const pullErrors = [
      ['cardStates', cardsRes.error],
      ['sessionLogs', sessionsRes.error],
      ['streakMeta', streakRes.error],
    ] as const;
    const errors = pullErrors.filter(([, error]) => !!error);
    if (errors.length > 0) {
      if (errors.every(([, error]) => isAbortError(error))) {
        return { ok: false, pulled: 0 };
      }
      for (const [label, error] of errors) {
        const pullError = error;
        if (pullError && !isAbortError(pullError)) {
          console.warn(`[sync] pull ${label} failed:`, pullError.message);
        }
      }
      return { ok: false, pulled: 0 };
    }

    let pulled = 0;

    /* Merge cardStates — LWW per row. Server's updated_at always wins
       because server fills it; the local Dexie row's updatedAt was
       overwritten by previous push-response anyway. */
    if (cardsRes.data && cardsRes.data.length > 0) {
      const rows: CardStateRow[] = cardsRes.data.map((r: any) => ({
        entryId: r.entry_id,
        deckId: r.deck_id,
        due: new Date(r.due).getTime(),
        stability: r.stability,
        difficulty: r.difficulty,
        elapsedDays: r.elapsed_days,
        scheduledDays: r.scheduled_days,
        reps: r.reps,
        lapses: r.lapses,
        state: r.state,
        lastReview: r.last_review ? new Date(r.last_review).getTime() : null,
        updatedAt: new Date(r.updated_at).getTime(),
      }));
      await bulkPutCardStates(rows);
      pulled += rows.length;
    }

    if (sessionsRes.data && sessionsRes.data.length > 0) {
      const rows: SessionLogRow[] = sessionsRes.data.map((r: any) => ({
        sessionId: r.session_id,
        deckId: r.deck_id,
        deckTitle: r.deck_title,
        totalCards: r.total_cards,
        startedAt: new Date(r.started_at).getTime(),
        endedAt: new Date(r.ended_at).getTime(),
        ratings: r.ratings,
        againCount: r.again_count,
        hardCount: r.hard_count,
        goodCount: r.good_count,
        easyCount: r.easy_count,
        skippedCount: r.skipped_count,
        updatedAt: new Date(r.updated_at).getTime(),
      }));
      await bulkPutSessionLogs(rows);
      pulled += rows.length;
    }

    if (streakRes.data) {
      const r: any = streakRes.data;
      await bulkPutStreakMeta([{
        id: 'streak',
        currentStreak: r.current_streak,
        longestStreak: r.longest_streak,
        lastStudiedDate: r.last_studied_date,
        totalSessions: r.total_sessions,
        totalCardsStudied: r.total_cards_studied,
        updatedAt: new Date(r.updated_at).getTime(),
      }]);
      pulled += 1;
    }

    await putSyncMeta({ lastPulledAt: Date.now(), lastSyncUserId: userId });
    return { ok: true, pulled };
  } catch (err: any) {
    /* AbortError is expected when a newer pull cancels us — not really
       a failure, just superseded. */
    if (err?.name === 'AbortError') return { ok: false, pulled: 0 };
    console.warn('[sync] pullNow error:', err?.message ?? String(err));
    return { ok: false, pulled: 0 };
  } finally {
    isPulling = false;
  }
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as { name?: string; message?: string };
  return maybe.name === 'AbortError' || maybe.message?.includes('AbortError') === true;
}

/* ─── Lifecycle ──────────────────────────────────────────────────────── */

/** Wire up sync for a signed-in user. Called from auth context when
 *  status flips to 'signed-in'. Safe to call multiple times — replays
 *  initial pull + re-binds listeners (old ones torn down first). */
export function startSync(userId: string): void {
  if (!userId) return;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  stopSync(); // tear down any previous wiring
  syncEnabled = true;
  currentUserId = userId;

  /* Initial pull — catch up local with anything written from other
     devices since last session. */
  void pullNow(userId);

  /* Tab becomes visible → user came back, pull fresh state.
     Tab becomes hidden → flush pending queue (best-effort). */
  onVisibilityChange = () => {
    if (!currentUserId) return;
    if (document.visibilityState === 'visible') {
      void pullNow(currentUserId);
    } else if (document.visibilityState === 'hidden') {
      /* Best-effort flush — don't block tab close. If the push doesn't
         finish in the timeout window, the queue persists in Dexie and
         next session picks it up. */
      void Promise.race([
        pushNow(currentUserId),
        new Promise((resolve) => setTimeout(resolve, HIDDEN_FLUSH_TIMEOUT_MS)),
      ]);
    }
  };
  /* Some browsers fire focus before visibilitychange — bind both to
     catch alt-tab + window-blur cases. Throttle protects against dup
     fires. */
  onFocus = () => {
    if (currentUserId) void pullNow(currentUserId);
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('focus', onFocus);
}

/** Tear down sync listeners. Called on sign-out + before re-binding. */
export function stopSync(): void {
  syncEnabled = false;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (onVisibilityChange) {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    onVisibilityChange = null;
  }
  if (onFocus) {
    window.removeEventListener('focus', onFocus);
    onFocus = null;
  }
  if (pushDebounceTimer) {
    clearTimeout(pushDebounceTimer);
    pushDebounceTimer = null;
  }
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  currentUserId = null;
}

/** Current signed-in user — exposed for the hook that schedules pushes
 *  after each local write (see useSyncedCardWrite below if implemented). */
export function getCurrentSyncUserId(): string | null {
  return currentUserId;
}
