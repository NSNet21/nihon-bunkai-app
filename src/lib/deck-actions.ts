import type { Deck } from '@/data/types';
import { DECKS_IMPORTED_EVENT } from './deck-import';
import { deleteManualLibraryDeck } from './download-store';

export function deleteAvailability(deck: Deck) {
  if (deck.source === 'manual') {
    return {
      enabled: true,
      reason: 'ลบ deck ที่ import เองออกจาก Local Library',
    };
  }
  return {
    enabled: false,
    reason: 'Official Source ลบไม่ได้',
  };
}

export async function deleteUserDeck(deck: Deck) {
  if (deck.source !== 'manual') return false;
  const deleted = await deleteManualLibraryDeck(deck.id);
  if (deleted && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(DECKS_IMPORTED_EVENT));
  }
  return deleted;
}
