import { describe, expect, it } from 'vitest';

import { buildReshuffledStudySessionEntries, buildStudySessionEntries } from './study-session';
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
