import type { Deck } from '@/data/types';
import { DECKS_IMPORTED_EVENT } from './deck-import';
import {
  deleteLibraryDeckAndEntries,
  getLibraryDeck,
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
const EMPTY_TITLE_REASON = 'ชื่อ deck ว่างไม่ได้';

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
