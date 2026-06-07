import type { CsvRow, Deck } from '@/data/types';
import type { LibraryDeckRecord, LibraryEntriesRecord } from './download-store';
import type { EntryOverrideRecord } from './personal-overrides';
import type { CardStateRow, SessionLogRow, StreakMetaRow } from './srs-store';

export const LOCAL_DATA_BACKUP_APP_ID = 'nihon-bunkai';
export const LOCAL_DATA_BACKUP_VERSION = 1;

export type LocalDataBackupDocument = {
  app: typeof LOCAL_DATA_BACKUP_APP_ID;
  version: typeof LOCAL_DATA_BACKUP_VERSION;
  createdAt: string;
  library: {
    decks: LibraryDeckRecord[];
    entries: LibraryEntriesRecord[];
  };
  personalEdits: {
    entryOverrides: EntryOverrideRecord[];
  };
  progress: {
    cardStates: CardStateRow[];
    sessionLogs: SessionLogRow[];
    streakMeta: StreakMetaRow | null;
  };
};

export type LocalDataBackupSummary = {
  decks: number;
  entries: number;
  personalEdits: number;
  cardStates: number;
  sessions: number;
  hasStreak: boolean;
};

export type LocalDataBackupInput = {
  createdAt?: string;
  libraryDecks: readonly LibraryDeckRecord[];
  libraryEntries: readonly LibraryEntriesRecord[];
  entryOverrides: readonly EntryOverrideRecord[];
  cardStates: readonly CardStateRow[];
  sessionLogs: readonly SessionLogRow[];
  streakMeta: StreakMetaRow | null;
};

export type LocalDataBackupCollectAdapter = {
  listLibraryDecks: () => Promise<LibraryDeckRecord[]>;
  getLibraryEntriesRecord: (pack: string) => Promise<LibraryEntriesRecord | undefined>;
  listEntryOverrides: () => Promise<EntryOverrideRecord[]>;
  getAllCardStates: () => Promise<CardStateRow[]>;
  getAllSessionLogs: () => Promise<SessionLogRow[]>;
  getStreakMeta: () => Promise<StreakMetaRow>;
};

export type LocalDataBackupRestoreAdapter = {
  saveLibraryDecks: (rows: LibraryDeckRecord[]) => Promise<void>;
  saveLibraryEntries: (rows: LibraryEntriesRecord[]) => Promise<void>;
  bulkPutEntryOverrides: (rows: EntryOverrideRecord[]) => Promise<void>;
  bulkPutCardStates: (rows: CardStateRow[]) => Promise<void>;
  bulkPutSessionLogs: (rows: SessionLogRow[]) => Promise<void>;
  bulkPutStreakMeta: (rows: StreakMetaRow[]) => Promise<void>;
};

export type LocalDataBackupParseResult =
  | { ok: true; document: LocalDataBackupDocument }
  | { ok: false; reason: string };

export function buildLocalDataBackupDocument({
  createdAt = new Date().toISOString(),
  libraryDecks,
  libraryEntries,
  entryOverrides,
  cardStates,
  sessionLogs,
  streakMeta,
}: LocalDataBackupInput): LocalDataBackupDocument {
  const userDecks = libraryDecks.filter(isUserContentDeck);
  const userPacks = new Set(userDecks.map((deck) => deck.pack));
  return {
    app: LOCAL_DATA_BACKUP_APP_ID,
    version: LOCAL_DATA_BACKUP_VERSION,
    createdAt,
    library: {
      decks: userDecks.map((deck) => ({ ...deck, tags: [...deck.tags] })),
      entries: libraryEntries
        .filter((record) => userPacks.has(record.pack) && (record.source === 'manual' || record.source === 'custom'))
        .map(cloneEntriesRecord),
    },
    personalEdits: {
      entryOverrides: entryOverrides.map((record) => ({ ...record, fields: { ...record.fields } })),
    },
    progress: {
      cardStates: cardStates.map((row) => ({ ...row })),
      sessionLogs: sessionLogs.map((row) => ({ ...row, ratings: [...row.ratings] })),
      streakMeta: streakMeta ? { ...streakMeta } : null,
    },
  };
}

export function parseLocalDataBackupText(text: string): LocalDataBackupParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'ไฟล์ backup ไม่ใช่ JSON ที่อ่านได้' };
  }
  if (!isRecord(raw) || raw.app !== LOCAL_DATA_BACKUP_APP_ID) {
    return { ok: false, reason: 'ไฟล์นี้ไม่ใช่ Nihon Bunkai local backup' };
  }
  if (raw.version !== LOCAL_DATA_BACKUP_VERSION) {
    return { ok: false, reason: 'เวอร์ชัน backup นี้ยังไม่รองรับ' };
  }
  if (!isBackupDocument(raw)) {
    return { ok: false, reason: 'โครงสร้าง backup ไม่ถูกต้อง' };
  }
  return { ok: true, document: raw };
}

export function summarizeLocalDataBackup(document: LocalDataBackupDocument): LocalDataBackupSummary {
  return {
    decks: document.library.decks.length,
    entries: document.library.entries.reduce((sum, record) => sum + record.rows.length, 0),
    personalEdits: document.personalEdits.entryOverrides.length,
    cardStates: document.progress.cardStates.length,
    sessions: document.progress.sessionLogs.length,
    hasStreak: !!document.progress.streakMeta,
  };
}

export function buildLocalDataBackupFileName(createdAt: string): string {
  const date = createdAt.slice(0, 10).match(/^\d{4}-\d{2}-\d{2}$/) ? createdAt.slice(0, 10) : 'backup';
  return `nihon-bunkai-local-backup-${date}.json`;
}

export async function collectLocalDataBackupDocument(
  adapter: LocalDataBackupCollectAdapter,
): Promise<LocalDataBackupDocument> {
  const libraryDecks = await adapter.listLibraryDecks();
  const userDecks = libraryDecks.filter(isUserContentDeck);
  const libraryEntries = (await Promise.all(
    userDecks.map((deck) => adapter.getLibraryEntriesRecord(deck.pack)),
  )).filter((record): record is LibraryEntriesRecord => Boolean(record));
  const [entryOverrides, cardStates, sessionLogs, streakMeta] = await Promise.all([
    adapter.listEntryOverrides(),
    adapter.getAllCardStates(),
    adapter.getAllSessionLogs(),
    adapter.getStreakMeta(),
  ]);

  return buildLocalDataBackupDocument({
    libraryDecks: userDecks,
    libraryEntries,
    entryOverrides,
    cardStates,
    sessionLogs,
    streakMeta,
  });
}

export async function restoreLocalDataBackupDocument(
  document: LocalDataBackupDocument,
  adapter: LocalDataBackupRestoreAdapter,
): Promise<LocalDataBackupSummary> {
  await adapter.saveLibraryDecks(document.library.decks);
  await adapter.saveLibraryEntries(document.library.entries);
  await adapter.bulkPutEntryOverrides(document.personalEdits.entryOverrides);
  await adapter.bulkPutCardStates(document.progress.cardStates);
  await adapter.bulkPutSessionLogs(document.progress.sessionLogs);
  await adapter.bulkPutStreakMeta(document.progress.streakMeta ? [document.progress.streakMeta] : []);
  return summarizeLocalDataBackup(document);
}

function isUserContentDeck(deck: LibraryDeckRecord): boolean {
  return deck.source === 'manual' || deck.source === 'custom';
}

function cloneEntriesRecord(record: LibraryEntriesRecord): LibraryEntriesRecord {
  return {
    ...record,
    rows: record.rows.map((row) => ({ ...row })),
  };
}

function isBackupDocument(value: unknown): value is LocalDataBackupDocument {
  if (!isRecord(value)) return false;
  if (typeof value.createdAt !== 'string') return false;
  const library = value.library;
  const personalEdits = value.personalEdits;
  const progress = value.progress;
  if (!isRecord(library) || !Array.isArray(library.decks) || !Array.isArray(library.entries)) return false;
  if (!isRecord(personalEdits) || !Array.isArray(personalEdits.entryOverrides)) return false;
  if (!isRecord(progress) || !Array.isArray(progress.cardStates) || !Array.isArray(progress.sessionLogs)) return false;
  if (progress.streakMeta !== null && progress.streakMeta !== undefined && !isRecord(progress.streakMeta)) return false;
  return library.decks.every(isDeckLike)
    && library.entries.every(isEntriesRecordLike)
    && personalEdits.entryOverrides.every(isEntryOverrideLike)
    && progress.cardStates.every(isCardStateLike)
    && progress.sessionLogs.every(isSessionLogLike);
}

function isDeckLike(value: unknown): value is LibraryDeckRecord {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.type === 'string'
    && typeof value.title === 'string'
    && typeof value.entryCount === 'number'
    && typeof value.isFree === 'boolean'
    && typeof value.pack === 'string'
    && Array.isArray(value.tags)
    && typeof value.source === 'string';
}

function isEntriesRecordLike(value: unknown): value is LibraryEntriesRecord {
  if (!isRecord(value)) return false;
  return typeof value.pack === 'string'
    && typeof value.source === 'string'
    && Array.isArray(value.rows)
    && value.rows.every(isCsvRowLike);
}

function isCsvRowLike(value: unknown): value is CsvRow {
  if (!isRecord(value)) return false;
  return typeof value.no === 'number'
    && typeof value.t === 'string'
    && typeof value.d === 'string'
    && typeof value.p === 'string'
    && typeof value.e === 'string';
}

function isEntryOverrideLike(value: unknown): value is EntryOverrideRecord {
  if (!isRecord(value) || !isRecord(value.fields)) return false;
  return typeof value.id === 'string'
    && typeof value.deckId === 'string'
    && typeof value.pack === 'string'
    && typeof value.no === 'number'
    && typeof value.updatedAt === 'number'
    && typeof value.fields.t === 'string'
    && typeof value.fields.d === 'string'
    && typeof value.fields.p === 'string'
    && typeof value.fields.e === 'string';
}

function isCardStateLike(value: unknown): value is CardStateRow {
  if (!isRecord(value)) return false;
  return typeof value.entryId === 'string'
    && typeof value.deckId === 'string'
    && typeof value.due === 'number'
    && typeof value.updatedAt === 'number';
}

function isSessionLogLike(value: unknown): value is SessionLogRow {
  if (!isRecord(value)) return false;
  return typeof value.sessionId === 'string'
    && typeof value.deckId === 'string'
    && typeof value.deckTitle === 'string'
    && typeof value.totalCards === 'number'
    && typeof value.startedAt === 'number'
    && typeof value.endedAt === 'number'
    && Array.isArray(value.ratings)
    && typeof value.updatedAt === 'number';
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null;
}
