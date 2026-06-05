import type { Deck } from '@/data/types';
import { DECKS_IMPORTED_EVENT } from './deck-import';
import {
  deleteLibraryDeckAndEntries,
  getLibraryEntriesRecord,
  getLibraryDeck,
  putLibraryEntriesRecord,
  putLibraryDeck,
  type LibraryDeckRecord,
} from './download-store';
import { applyDeckOrganization, isUserEditableDeck, type DeckOrganization } from './user-content';

export type LibraryMutationResult = {
  ok: boolean;
  reason?: string;
};

const OFFICIAL_REJECT_REASON = 'Official Source ลบหรือแก้ metadata ไม่ได้';
const MISSING_DECK_REASON = 'ไม่พบ deck ใน Local Library';
const MISSING_ENTRY_REASON = 'ไม่พบคำนี้ใน Local Library';
const EMPTY_TITLE_REASON = 'ชื่อ deck ว่างไม่ได้';

export type EditableEntryFields = {
  t: string;
  d: string;
  p: string;
  e: string;
};

export async function renameUserLibraryDeck(deckId: string, title: string): Promise<LibraryMutationResult> {
  const deck = await getMutableLibraryDeck(deckId);
  if ('ok' in deck) return deck;
  const cleanTitle = title.trim();
  if (!cleanTitle) return { ok: false, reason: EMPTY_TITLE_REASON };
  await putLibraryDeck({
    ...deck,
    title: cleanTitle,
    isUserContent: true,
    updatedAt: Date.now(),
  });
  notifyLibraryChanged({ source: 'user-content', action: 'rename', deckId });
  return { ok: true };
}

export async function moveUserLibraryDeck(
  deckId: string,
  organization: DeckOrganization,
): Promise<LibraryMutationResult> {
  const deck = await getMutableLibraryDeck(deckId);
  if ('ok' in deck) return deck;
  await putLibraryDeck(applyDeckOrganization(deck, organization));
  notifyLibraryChanged({ source: 'user-content', action: 'move', deckId });
  return { ok: true };
}

export async function deleteUserLibraryDeck(deckId: string): Promise<LibraryMutationResult> {
  const deck = await getMutableLibraryDeck(deckId);
  if ('ok' in deck) return deck;
  const deleted = await deleteLibraryDeckAndEntries(deck.id);
  if (!deleted) return { ok: false, reason: MISSING_DECK_REASON };
  notifyLibraryChanged({ source: 'user-content', action: 'delete', deckId });
  return { ok: true };
}

export async function updateUserLibraryEntry(
  deckId: string,
  no: number,
  fields: EditableEntryFields,
): Promise<LibraryMutationResult> {
  const deck = await getMutableLibraryDeck(deckId);
  if ('ok' in deck) return deck;
  const entryRecord = await getLibraryEntriesRecord(deck.pack);
  if (!entryRecord) return { ok: false, reason: MISSING_ENTRY_REASON };
  const rowIndex = entryRecord.rows.findIndex((row) => row.no === no);
  if (rowIndex < 0) return { ok: false, reason: MISSING_ENTRY_REASON };
  const rows = entryRecord.rows.map((row, index) => (
    index === rowIndex ? { ...row, ...fields, no: row.no } : row
  ));
  await putLibraryEntriesRecord({ ...entryRecord, rows });
  await putLibraryDeck({ ...deck, entryCount: rows.length, isUserContent: true, updatedAt: Date.now() });
  notifyLibraryChanged({ source: 'user-content', action: 'term-update', deckId, no: String(no) });
  return { ok: true };
}

export async function deleteUserLibraryEntry(deckId: string, no: number): Promise<LibraryMutationResult> {
  const deck = await getMutableLibraryDeck(deckId);
  if ('ok' in deck) return deck;
  const entryRecord = await getLibraryEntriesRecord(deck.pack);
  if (!entryRecord) return { ok: false, reason: MISSING_ENTRY_REASON };
  const rows = entryRecord.rows.filter((row) => row.no !== no);
  if (rows.length === entryRecord.rows.length) return { ok: false, reason: MISSING_ENTRY_REASON };
  await putLibraryEntriesRecord({ ...entryRecord, rows });
  await putLibraryDeck({ ...deck, entryCount: rows.length, isUserContent: true, updatedAt: Date.now() });
  notifyLibraryChanged({ source: 'user-content', action: 'term-delete', deckId, no: String(no) });
  return { ok: true };
}

async function getMutableLibraryDeck(deckId: string): Promise<LibraryDeckRecord | LibraryMutationResult> {
  const deck = await getLibraryDeck(deckId);
  if (!deck) return { ok: false, reason: MISSING_DECK_REASON };
  if (!isUserEditableDeck(deck as Deck)) return { ok: false, reason: OFFICIAL_REJECT_REASON };
  return deck;
}

function notifyLibraryChanged(detail: Record<string, string>) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(DECKS_IMPORTED_EVENT, { detail }));
}
