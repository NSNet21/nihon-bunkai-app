import { describe, expect, it } from 'vitest';

import {
  buildCardPositionMeta,
  buildReshuffledStudySessionEntries,
  buildSourcePositionMeta,
  buildStudySessionEntries,
  canShuffleFlashcardSession,
} from './study-session';
import type { Entry } from '@/data/types';

const entries = Array.from({ length: 6 }, (_, i) => ({
  id: `deck-${i + 1}`,
  type: 'vocab' as const,
  level: 'N5' as const,
  pack: 'vocab-n5-pack01',
  tags: ['vocab', 'n5'],
  no: i + 1,
  t: `term-${i + 1}`,
  d: `meaning-${i + 1}`,
  p: `reading-${i + 1}`,
  e: '',
})) satisfies Entry[];

describe('buildStudySessionEntries', () => {
  it('keeps deck order for normal order and all count', () => {
    expect(
      buildStudySessionEntries(entries, { count: 'all', order: 'normal' }, 'deck-a').map((entry) => entry.no),
    ).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('limits by count after ordering', () => {
    expect(
      buildStudySessionEntries(entries, { count: 3, order: 'normal' }, 'deck-a').map((entry) => entry.no),
    ).toEqual([1, 2, 3]);
  });

  it('shuffles deterministically with the same seed', () => {
    const first = buildStudySessionEntries(entries, { count: 'all', order: 'shuffle' }, 'deck-a').map((entry) => entry.no);
    const second = buildStudySessionEntries(entries, { count: 'all', order: 'shuffle' }, 'deck-a').map((entry) => entry.no);

    expect(first).toEqual(second);
    expect(first).not.toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('can reshuffle a fresh session by changing the seed', () => {
    const first = buildStudySessionEntries(entries, { count: 'all', order: 'shuffle' }, 'deck-a:reshuffle:1').map((entry) => entry.no);
    const second = buildStudySessionEntries(entries, { count: 'all', order: 'shuffle' }, 'deck-a:reshuffle:2').map((entry) => entry.no);

    expect(first).not.toEqual(second);
    expect(first.sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(second.sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('builds a manual reshuffle without mutating the base config order', () => {
    const baseConfig = { count: 3, order: 'normal' as const };
    const result = buildReshuffledStudySessionEntries(entries, baseConfig, 'deck-a', 1).map((entry) => entry.no);

    expect(baseConfig.order).toBe('normal');
    expect(result).toHaveLength(3);
    expect(result).not.toEqual([1, 2, 3]);
  });
});

describe('canShuffleFlashcardSession', () => {
  it('allows reshuffle before rating even when the session opened at a continue entry', () => {
    expect(canShuffleFlashcardSession({ entriesLength: 20, resultsLength: 0 })).toBe(true);
  });

  it('blocks reshuffle after rating starts so session results are not reset mid-run', () => {
    expect(canShuffleFlashcardSession({ entriesLength: 20, resultsLength: 1 })).toBe(false);
  });

  it('blocks reshuffle when there is only one card', () => {
    expect(canShuffleFlashcardSession({ entriesLength: 1, resultsLength: 0 })).toBe(false);
  });
});

describe('study session meta labels', () => {
  it('labels learn cards by source entry number instead of repeating the session position', () => {
    expect(buildCardPositionMeta(1, 20, 'Kanji N5 · Pack 03', 24)).toBe('NO. 24 // KANJI N5 · PACK 03');
  });

  it('keeps source identity visible after shuffle without a card counter', () => {
    expect(buildCardPositionMeta(0, 20, 'Memorize', 31)).toBe('NO. 31 // MEMORIZE');
  });

  it('labels term detail by source entry number without a session counter', () => {
    expect(buildSourcePositionMeta(entries[4], 'Kanji N5 · Pack 03')).toBe('TERM NO. 05 // KANJI N5 · PACK 03');
  });
});
