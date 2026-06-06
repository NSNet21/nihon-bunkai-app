/**
 * IndexedDB store for user runtime state (FSRS + sessions + streak).
 *
 * Architecture: Local-first + Supabase mirror (see [[app-stack-decisions]]).
 * - Dexie = primary, instant writes, offline-capable
 * - Supabase = background mirror, sync layer in sync-store.ts (Phase C.4)
 *
 * Scope (meta-only, NEVER content):
 *   - card_states  : FSRS scheduling per entry (rep_count, ease, due, ...)
 *   - session_logs : per-session record (deckId, ratings[], counts, snapshot)
 *   - streak_meta  : per-user singleton (current/longest streak, totals)
 *
 * entry_id format: `{deck_id}::{no}` — stable across CSV re-imports as long
 * as row order doesn't change. See [[app-stack-decisions]] sync architecture.
 *
 * Local DB has NO user_id (one user per device install). Sync layer adds
 * user_id when pushing to Supabase.
 */

import Dexie, { type Table } from 'dexie';

/* ─── Types — local row shape ────────────────────────────────────────── */

/** FSRS scheduling state for one entry. Mirror of ts-fsrs Card. */
export type CardStateRow = {
  entryId: string;          // PK · '{deck_id}::{no}'
  deckId: string;           // denormalized for filter queries
  // ts-fsrs Card fields
  due: number;              // epoch ms — when next due
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: number;            // 0=New 1=Learning 2=Review 3=Relearning
  lastReview: number | null; // epoch ms or null
  // Sync metadata
  updatedAt: number;        // epoch ms — for last-write-wins
};

/** Per-session record. Immutable audit-style (set once when session ends). */
export type SessionLogRow = {
  sessionId: string;        // PK · UUID
  deckId: string;
  deckTitle: string;        // SNAPSHOT — survives deck rename/delete
  totalCards: number;       // SNAPSHOT — entries.length at session time
  startedAt: number;        // epoch ms
  endedAt: number;          // epoch ms
  ratings: number[];        // [3,4,1,2,...] in card order
  // Pre-aggregated counts (cheap to compute, saves dashboard re-scan)
  againCount: number;
  hardCount: number;
  goodCount: number;
  easyCount: number;
  skippedCount: number;
  updatedAt: number;
};

/** Per-user lifetime aggregates. Singleton — always id='streak'. */
export type StreakMetaRow = {
  id: 'streak';             // PK (constant)
  currentStreak: number;
  longestStreak: number;
  lastStudiedDate: string | null;  // 'YYYY-MM-DD' (user's local date)
  totalSessions: number;
  totalCardsStudied: number;
  updatedAt: number;
};

/** Singleton sync state. Used by srs-sync.ts to track pull cursor +
 *  last successful push. Stored here (not localStorage) because:
 *  - localStorage quota + multi-tab semantics are quirky
 *  - same Dexie tx as data writes guarantees consistency */
export type SyncMetaRow = {
  id: 'singleton';
  lastPulledAt: number;     // epoch ms — used as cursor for delta pull
  lastPushedAt: number;     // epoch ms — informational, last successful push
  /* Server-side userId at last sync — guards against signing in as a
     different user with leftover local data. */
  lastSyncUserId: string | null;
};

/** Pending push queue. Persisted so a tab crash / rapid close before
 *  flush doesn't lose writes. Row IDs are deterministic so re-rating
 *  the same card before flush overwrites the stale pending entry
 *  (queue can't grow unbounded from a single hot card).
 *
 *  Payload stores ONLY a pointer (kind + refId). Push handler re-reads
 *  the current row from the main table at push time → guarantees we
 *  always push the LATEST state, never a stale snapshot. */
export type PendingSyncRow = {
  id: string;               // 'card:{entryId}' | 'session:{sessionId}' | 'streak:singleton'
  kind: 'cardState' | 'sessionLog' | 'streakMeta';
  refId: string;            // entryId / sessionId / 'singleton'
  queuedAt: number;         // FIFO drain order + diagnostic
};

/* ─── DB class ──────────────────────────────────────────────────────── */

class SrsDB extends Dexie {
  cardStates!: Table<CardStateRow, string>;       // PK type = string (entryId)
  sessionLogs!: Table<SessionLogRow, string>;     // PK = sessionId
  streakMeta!: Table<StreakMetaRow, 'streak'>;    // PK = constant 'streak'
  syncMeta!: Table<SyncMetaRow, 'singleton'>;     // PK = constant 'singleton'
  pendingSync!: Table<PendingSyncRow, string>;    // PK = deterministic kind:id

  constructor() {
    super('nihon-bunkai-srs');
    /* Schema syntax:
       '&pkField, indexField1, indexField2'  — & = unique PK
       'compoundIdx' as '[a+b]'              — composite index

       Indexes chosen to support common queries:
       - cardStates by deckId (filter cards for a deck)
       - cardStates by due (find what's due — Phase 3 SRS review)
       - cardStates by updatedAt (sync delta — push since last sync)
       - sessionLogs by deckId (per-deck history)
       - sessionLogs by startedAt (recent sessions)
       - sessionLogs by updatedAt (sync delta) */
    this.version(1).stores({
      cardStates:  '&entryId, deckId, due, updatedAt',
      sessionLogs: '&sessionId, deckId, startedAt, updatedAt',
      streakMeta:  '&id',
    });
    /* v2 adds sync infrastructure — pure ADD (no data migration needed). */
    this.version(2).stores({
      cardStates:  '&entryId, deckId, due, updatedAt',
      sessionLogs: '&sessionId, deckId, startedAt, updatedAt',
      streakMeta:  '&id',
      syncMeta:    '&id',
      pendingSync: '&id, queuedAt',
    });
  }
}

/* ─── DB factory — SSR-safe, lazy ─────────────────────────────────────── */

let db: SrsDB | null = null;

function getDB(): SrsDB | null {
  /* SSG output runs on Node; no window/indexedDB. Return null → callers
     treat as "DB unavailable" and bail safely. Same pattern as
     download-store.ts. */
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return null;
  }
  if (!db) db = new SrsDB();
  return db;
}

/* ─── card_states CRUD ────────────────────────────────────────────────── */

/** Get FSRS state for one entry. Returns undefined if never reviewed. */
export async function getCardState(entryId: string): Promise<CardStateRow | undefined> {
  const d = getDB();
  if (!d) return undefined;
  return d.cardStates.get(entryId);
}

/** Get all FSRS states for a deck. Empty array if none yet. */
export async function getCardStatesForDeck(deckId: string): Promise<CardStateRow[]> {
  const d = getDB();
  if (!d) return [];
  return d.cardStates.where('deckId').equals(deckId).toArray();
}

/** Upsert a single card state. Updates `updatedAt` automatically.
 *  Atomic tx: writes the row + enqueues a pending_sync entry in ONE
 *  transaction. Deterministic queue id (`card:{entryId}`) → re-rating
 *  the same card before flush overwrites the stale pending entry. */
export async function putCardState(row: Omit<CardStateRow, 'updatedAt'>): Promise<void> {
  const d = getDB();
  if (!d) return;
  const now = Date.now();
  await d.transaction('rw', d.cardStates, d.pendingSync, async () => {
    await d.cardStates.put({ ...row, updatedAt: now });
    await d.pendingSync.put({
      id: `card:${row.entryId}`,
      kind: 'cardState',
      refId: row.entryId,
      queuedAt: now,
    });
  });
}

/** Bulk upsert — used by sync PULL (merging cloud rows). Does NOT
 *  enqueue pending_sync (pulled rows came FROM server, no need to
 *  push back). Skipping the queue also avoids an infinite pull→push
 *  loop. */
export async function bulkPutCardStates(rows: CardStateRow[]): Promise<void> {
  const d = getDB();
  if (!d || rows.length === 0) return;
  await d.cardStates.bulkPut(rows);
}

/** Get rows updated AFTER `sinceMs` — for sync push (delta upload). */
export async function getCardStatesUpdatedSince(sinceMs: number): Promise<CardStateRow[]> {
  const d = getDB();
  if (!d) return [];
  return d.cardStates.where('updatedAt').above(sinceMs).toArray();
}

/** Bulk lookup by entryId — used by sync push to read CURRENT state
 *  for each pending queue pointer at flush time. */
export async function getCardStatesByEntryIds(entryIds: string[]): Promise<CardStateRow[]> {
  const d = getDB();
  if (!d || entryIds.length === 0) return [];
  const rows = await d.cardStates.bulkGet(entryIds);
  return rows.filter((r): r is CardStateRow => Boolean(r));
}

/* ─── session_logs CRUD ───────────────────────────────────────────────── */

/** Record a completed session. Immutable — never updated after insert.
 *  Atomic tx writes the log + enqueues pending_sync. Queue id uses
 *  sessionId (UUID) → unique per session → no overwrite on retry. */
export async function putSessionLog(row: Omit<SessionLogRow, 'updatedAt'>): Promise<void> {
  const d = getDB();
  if (!d) return;
  const now = Date.now();
  await d.transaction('rw', d.sessionLogs, d.pendingSync, async () => {
    await d.sessionLogs.put({ ...row, updatedAt: now });
    await d.pendingSync.put({
      id: `session:${row.sessionId}`,
      kind: 'sessionLog',
      refId: row.sessionId,
      queuedAt: now,
    });
  });
}

/** Bulk insert — sync PULL merging cloud session_logs. Skips queue
 *  (pulled rows don't push back). */
export async function bulkPutSessionLogs(rows: SessionLogRow[]): Promise<void> {
  const d = getDB();
  if (!d || rows.length === 0) return;
  await d.sessionLogs.bulkPut(rows);
}

/** Recent N sessions (newest first). Used by dashboard / history. */
export async function getRecentSessions(limit = 20): Promise<SessionLogRow[]> {
  const d = getDB();
  if (!d) return [];
  return d.sessionLogs.orderBy('startedAt').reverse().limit(limit).toArray();
}

/** Get completed session logs for one deck, newest first. */
export async function getSessionLogsForDeck(deckId: string): Promise<SessionLogRow[]> {
  const d = getDB();
  if (!d) return [];
  const rows = await d.sessionLogs.where('deckId').equals(deckId).toArray();
  return rows.sort((a, b) => b.startedAt - a.startedAt);
}

/** Sync delta — sessions updated after `sinceMs`. */
export async function getSessionLogsUpdatedSince(sinceMs: number): Promise<SessionLogRow[]> {
  const d = getDB();
  if (!d) return [];
  return d.sessionLogs.where('updatedAt').above(sinceMs).toArray();
}

/** Bulk lookup by sessionId — used by sync push. */
export async function getSessionLogsByIds(sessionIds: string[]): Promise<SessionLogRow[]> {
  const d = getDB();
  if (!d || sessionIds.length === 0) return [];
  const rows = await d.sessionLogs.bulkGet(sessionIds);
  return rows.filter((r): r is SessionLogRow => Boolean(r));
}

/* ─── streak_meta CRUD (singleton) ────────────────────────────────────── */

const STREAK_PK = 'streak' as const;

/** Get current streak meta. Returns default singleton if never written. */
export async function getStreakMeta(): Promise<StreakMetaRow> {
  const d = getDB();
  const fallback: StreakMetaRow = {
    id: STREAK_PK,
    currentStreak: 0,
    longestStreak: 0,
    lastStudiedDate: null,
    totalSessions: 0,
    totalCardsStudied: 0,
    updatedAt: 0,
  };
  if (!d) return fallback;
  const row = await d.streakMeta.get(STREAK_PK);
  return row ?? fallback;
}

/** Upsert streak meta. updatedAt auto-bumped. Atomic with pending
 *  enqueue. Queue id is fixed `streak:singleton` → repeated bumps
 *  overwrite the same pending row. */
export async function putStreakMeta(row: Omit<StreakMetaRow, 'id' | 'updatedAt'>): Promise<void> {
  const d = getDB();
  if (!d) return;
  const now = Date.now();
  await d.transaction('rw', d.streakMeta, d.pendingSync, async () => {
    await d.streakMeta.put({ ...row, id: STREAK_PK, updatedAt: now });
    await d.pendingSync.put({
      id: 'streak:singleton',
      kind: 'streakMeta',
      refId: 'singleton',
      queuedAt: now,
    });
  });
}

/** Bulk insert streak meta from pull. Singleton — only 1 row ever.
 *  Skips queue. */
export async function bulkPutStreakMeta(rows: StreakMetaRow[]): Promise<void> {
  const d = getDB();
  if (!d || rows.length === 0) return;
  await d.streakMeta.bulkPut(rows);
}

/* ─── sync_meta CRUD (singleton) ──────────────────────────────────────── */

const SYNC_META_PK = 'singleton' as const;

/** Read sync state. Returns defaults if never written. */
export async function getSyncMeta(): Promise<SyncMetaRow> {
  const d = getDB();
  const fallback: SyncMetaRow = {
    id: SYNC_META_PK,
    lastPulledAt: 0,
    lastPushedAt: 0,
    lastSyncUserId: null,
  };
  if (!d) return fallback;
  const row = await d.syncMeta.get(SYNC_META_PK);
  return row ?? fallback;
}

/** Update sync state. Pass a partial — merges into current. */
export async function putSyncMeta(patch: Partial<Omit<SyncMetaRow, 'id'>>): Promise<void> {
  const d = getDB();
  if (!d) return;
  const cur = await getSyncMeta();
  await d.syncMeta.put({ ...cur, ...patch, id: SYNC_META_PK });
}

/* ─── pending_sync CRUD (queue) ───────────────────────────────────────── */

/** Drain the pending queue in FIFO order. Caller (srs-sync.ts) reads
 *  the current row from the main table for each pending entry — never
 *  trusts payload from queue (rows store pointers, not snapshots). */
export async function getPendingSync(): Promise<PendingSyncRow[]> {
  const d = getDB();
  if (!d) return [];
  return d.pendingSync.orderBy('queuedAt').toArray();
}

/** Remove a pending entry after successful push. Deterministic id =
 *  cheap delete. */
export async function deletePendingSync(id: string): Promise<void> {
  const d = getDB();
  if (!d) return;
  await d.pendingSync.delete(id);
}

/** Bulk remove after successful batch push. */
export async function bulkDeletePendingSync(ids: string[]): Promise<void> {
  const d = getDB();
  if (!d || ids.length === 0) return;
  await d.pendingSync.bulkDelete(ids);
}

/* ─── Helpers ─────────────────────────────────────────────────────────── */

/** Build the canonical entry_id used everywhere. Stable as long as CSV
 *  row order doesn't change between re-imports. */
export function makeEntryId(deckId: string, no: number): string {
  return `${deckId}::${no}`;
}

/** Today's date in user's local timezone, formatted 'YYYY-MM-DD'.
 *  Used by streak logic (date compare, not datetime). */
export function todayLocalDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Wipe everything — used on sign-out (don't leave other-user data behind
 *  if another user signs in on the same browser). Includes sync metadata
 *  + pending queue so a fresh sign-in pulls cleanly from scratch.
 *  Safe to call even when DB doesn't exist (SSR). */
export async function clearAllSrsData(): Promise<void> {
  const d = getDB();
  if (!d) return;
  await Promise.all([
    d.cardStates.clear(),
    d.sessionLogs.clear(),
    d.streakMeta.clear(),
    d.syncMeta.clear(),
    d.pendingSync.clear(),
  ]);
}
