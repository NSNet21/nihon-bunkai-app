import { describe, expect, it } from 'vitest';

import type { CsvRow, Deck } from '@/data/types';
import type { EntryOverrideRecord } from './personal-overrides';
import type { CardStateRow, SessionLogRow, StreakMetaRow } from './srs-store';
import {
  LOCAL_DATA_BACKUP_APP_ID,
  LOCAL_DATA_BACKUP_VERSION,
  buildLocalDataBackupDocument,
  buildLocalDataBackupFileName,
  collectLocalDataBackupDocument,
  parseLocalDataBackupText,
  restoreLocalDataBackupDocument,
  summarizeLocalDataBackup,
} from './local-data-backup';

const deck = (overrides: Partial<Deck>): Deck => ({
  id: overrides.id ?? 'manual-one',
  type: overrides.type ?? 'vocab',
  level: overrides.level ?? null,
  title: overrides.title ?? 'Manual one',
  entryCount: overrides.entryCount ?? 1,
  isFree: overrides.isFree ?? false,
  pack: overrides.pack ?? overrides.id ?? 'manual-one',
  tags: overrides.tags ?? ['manual'],
  source: overrides.source ?? 'manual',
  ...overrides,
});

const row = (no = 1): CsvRow => ({ no, t: `語${no}`, d: `คำ ${no}`, p: 'ご', e: '### Note' });

const override = (id = 'official::1'): EntryOverrideRecord => ({
  id,
  deckId: 'official',
  pack: 'official',
  no: 1,
  fields: { t: '私的', d: 'ส่วนตัว', p: 'してき', e: '### Personal' },
  updatedAt: 100,
});

const cardState = (entryId = 'manual-one::1'): CardStateRow => ({
  entryId,
  deckId: 'manual-one',
  due: 200,
  stability: 1,
  difficulty: 1,
  elapsedDays: 0,
  scheduledDays: 1,
  reps: 1,
  lapses: 0,
  state: 2,
  lastReview: 100,
  updatedAt: 201,
});

const session = (sessionId = 'session-one'): SessionLogRow => ({
  sessionId,
  deckId: 'manual-one',
  deckTitle: 'Manual one',
  totalCards: 1,
  startedAt: 100,
  endedAt: 200,
  ratings: [3],
  againCount: 0,
  hardCount: 0,
  goodCount: 1,
  easyCount: 0,
  skippedCount: 0,
  updatedAt: 200,
});

const streak: StreakMetaRow = {
  id: 'streak',
  currentStreak: 2,
  longestStreak: 3,
  lastStudiedDate: '2026-06-07',
  totalSessions: 4,
  totalCardsStudied: 10,
  updatedAt: 300,
};

describe('local data backup document', () => {
  it('keeps only user content decks and matching entries, while preserving overrides and progress', () => {
    const document = buildLocalDataBackupDocument({
      createdAt: '2026-06-07T10:00:00.000Z',
      libraryDecks: [
        deck({ id: 'manual-one', source: 'manual', pack: 'manual-one' }),
        deck({ id: 'custom-one', source: 'custom', pack: 'custom-one' }),
        deck({ id: 'official-paid', source: 'entitlement', pack: 'official-paid' }),
      ],
      libraryEntries: [
        { pack: 'manual-one', source: 'manual', rows: [row(1)] },
        { pack: 'custom-one', source: 'custom', rows: [row(2)] },
        { pack: 'official-paid', source: 'entitlement', rows: [row(3)] },
      ],
      entryOverrides: [override()],
      cardStates: [cardState()],
      sessionLogs: [session()],
      streakMeta: streak,
    });

    expect(document.app).toBe(LOCAL_DATA_BACKUP_APP_ID);
    expect(document.version).toBe(LOCAL_DATA_BACKUP_VERSION);
    expect(document.library.decks.map((item) => item.id)).toEqual(['manual-one', 'custom-one']);
    expect(document.library.entries.map((item) => item.pack)).toEqual(['manual-one', 'custom-one']);
    expect(document.personalEdits.entryOverrides).toHaveLength(1);
    expect(document.progress.cardStates).toHaveLength(1);
    expect(document.progress.sessionLogs).toHaveLength(1);
    expect(document.progress.streakMeta?.currentStreak).toBe(2);
  });

  it('parses and summarizes a valid backup file', () => {
    const document = buildLocalDataBackupDocument({
      createdAt: '2026-06-07T10:00:00.000Z',
      libraryDecks: [deck({ source: 'manual' })],
      libraryEntries: [{ pack: 'manual-one', source: 'manual', rows: [row(1), row(2)] }],
      entryOverrides: [override()],
      cardStates: [cardState()],
      sessionLogs: [session()],
      streakMeta: streak,
    });

    const parsed = parseLocalDataBackupText(JSON.stringify(document));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(summarizeLocalDataBackup(parsed.document)).toEqual({
      decks: 1,
      entries: 2,
      personalEdits: 1,
      cardStates: 1,
      sessions: 1,
      hasStreak: true,
    });
  });

  it('builds a filesystem-friendly backup filename from createdAt', () => {
    expect(buildLocalDataBackupFileName('2026-06-07T10:00:00.000Z')).toBe('nihon-bunkai-local-backup-2026-06-07.json');
  });

  it('rejects unknown or malformed backup files before restore can touch storage', () => {
    expect(parseLocalDataBackupText('not json')).toEqual({
      ok: false,
      reason: 'ไฟล์ backup ไม่ใช่ JSON ที่อ่านได้',
    });
    expect(parseLocalDataBackupText(JSON.stringify({ app: 'other', version: 1 }))).toEqual({
      ok: false,
      reason: 'ไฟล์นี้ไม่ใช่ Nihon Bunkai local backup',
    });
    expect(parseLocalDataBackupText(JSON.stringify({ app: LOCAL_DATA_BACKUP_APP_ID, version: 99 }))).toEqual({
      ok: false,
      reason: 'เวอร์ชัน backup นี้ยังไม่รองรับ',
    });
  });

  it('collects a backup document from storage adapters using only user content entries', async () => {
    const document = await collectLocalDataBackupDocument({
      listLibraryDecks: async () => [
        deck({ id: 'manual-one', pack: 'manual-one', source: 'manual' }) as any,
        deck({ id: 'official-paid', pack: 'official-paid', source: 'entitlement' }) as any,
      ],
      getLibraryEntriesRecord: async (pack) => (
        pack === 'manual-one'
          ? { pack, source: 'manual', rows: [row(1)] }
          : { pack, source: 'entitlement', rows: [row(2)] }
      ),
      listEntryOverrides: async () => [override()],
      getAllCardStates: async () => [cardState()],
      getAllSessionLogs: async () => [session()],
      getStreakMeta: async () => streak,
    });

    expect(document.library.decks.map((item) => item.id)).toEqual(['manual-one']);
    expect(document.library.entries.map((item) => item.pack)).toEqual(['manual-one']);
    expect(document.personalEdits.entryOverrides).toHaveLength(1);
    expect(document.progress.cardStates).toHaveLength(1);
  });

  it('restores a backup by upserting each local-data group and returns a summary', async () => {
    const document = buildLocalDataBackupDocument({
      libraryDecks: [deck({ source: 'manual' })],
      libraryEntries: [{ pack: 'manual-one', source: 'manual', rows: [row(1)] }],
      entryOverrides: [override()],
      cardStates: [cardState()],
      sessionLogs: [session()],
      streakMeta: streak,
    });
    const calls: string[] = [];

    const summary = await restoreLocalDataBackupDocument(document, {
      saveLibraryDecks: async (rows) => { calls.push(`decks:${rows.length}`); },
      saveLibraryEntries: async (rows) => { calls.push(`entries:${rows.length}`); },
      bulkPutEntryOverrides: async (rows) => { calls.push(`overrides:${rows.length}`); },
      bulkPutCardStates: async (rows) => { calls.push(`cards:${rows.length}`); },
      bulkPutSessionLogs: async (rows) => { calls.push(`sessions:${rows.length}`); },
      bulkPutStreakMeta: async (rows) => { calls.push(`streak:${rows.length}`); },
    });

    expect(summary).toEqual({
      decks: 1,
      entries: 1,
      personalEdits: 1,
      cardStates: 1,
      sessions: 1,
      hasStreak: true,
    });
    expect(calls).toEqual(['decks:1', 'entries:1', 'overrides:1', 'cards:1', 'sessions:1', 'streak:1']);
  });
});
