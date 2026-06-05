import type { Deck } from '@/data/types';
import { deleteUserLibraryDeck } from './library-management';
import { isUserEditableDeck } from './user-content';

export function deleteAvailability(deck: Deck) {
  if (isUserEditableDeck(deck)) {
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
  if (!isUserEditableDeck(deck)) return false;
  const result = await deleteUserLibraryDeck(deck.id);
  return result.ok;
}
