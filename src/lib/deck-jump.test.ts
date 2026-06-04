import { describe, expect, it } from 'vitest';

import type { Entry } from '@/data/types';
import { getDeckJumpRowState, resolveFirstEntryJump } from './deck-jump';

const entry = (id: string, no: number): Entry => ({
  id,
  no,
  t: id,
  d: 'meaning',
  p: 'reading',
  e: 'note',
  type: 'kanji',
  level: 'N5',
  pack: 'kanji-n5-pack01',
  tags: ['kanji', 'n5'],
});

describe('getDeckJumpRowState', () => {
  it('marks the current deck and disables navigation for it', () => {
    expect(getDeckJumpRowState('deck-a', 'deck-a')).toEqual({
      isCurrent: true,
      disabled: true,
      meta: 'กำลังดูอยู่',
    });
  });

  it('allows non-current decks to be selected', () => {
    expect(getDeckJumpRowState('deck-b', 'deck-a')).toEqual({
      isCurrent: false,
      disabled: false,
      meta: 'เปิด term แรก',
    });
  });
});

describe('resolveFirstEntryJump', () => {
  it('returns the first term route for a deck with entries', () => {
    expect(resolveFirstEntryJump('deck-b', [entry('deck-b-7', 7), entry('deck-b-8', 8)])).toEqual({
      ok: true,
      href: '/deck/deck-b/term/deck-b-7',
      entryId: 'deck-b-7',
    });
  });

  it('returns an empty state when the selected deck has no entries', () => {
    expect(resolveFirstEntryJump('empty-deck', [])).toEqual({
      ok: false,
      reason: 'ยังไม่มีคำใน deck นี้',
    });
  });
});
