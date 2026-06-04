import { describe, expect, it } from 'vitest';

import { deleteAvailability } from './deck-actions';
import type { Deck } from '@/data/types';

const baseDeck: Deck = {
  id: 'vocab-n5-pack01',
  type: 'vocab',
  level: 'N5',
  title: 'Vocab N5 · Pack 01',
  entryCount: 20,
  isFree: true,
  pack: 'vocab-n5-pack01',
  tags: ['vocab', 'n5'],
  source: 'free',
};

describe('deleteAvailability', () => {
  it('disables delete for embedded official decks', () => {
    expect(deleteAvailability(baseDeck)).toEqual({
      enabled: false,
      reason: 'Official Source ลบไม่ได้',
    });
  });

  it('disables delete for entitlement official decks', () => {
    expect(deleteAvailability({ ...baseDeck, isFree: false, source: 'entitlement' })).toEqual({
      enabled: false,
      reason: 'Official Source ลบไม่ได้',
    });
  });

  it('enables delete for manual user decks', () => {
    expect(deleteAvailability({ ...baseDeck, id: 'my-deck', isFree: false, source: 'manual' })).toEqual({
      enabled: true,
      reason: 'ลบ deck ที่ import เองออกจาก Local Library',
    });
  });
});
