import { describe, expect, it } from 'vitest';

import { buildSearchSectionList } from './search-sections';
import type { SearchableEntry } from './search-index';

function entry(overrides: Partial<SearchableEntry>): SearchableEntry {
  return {
    id: 'entry',
    deckId: 'deck',
    deckTitle: 'Deck',
    type: 'vocab',
    level: 'N5',
    t: '語',
    d: 'คำ',
    p: ['ご'],
    no: 1,
    ...overrides,
  };
}

describe('buildSearchSectionList', () => {
  it('includes user import group/section sections after official sections', () => {
    const result = buildSearchSectionList([
      { entry: entry({ id: 'official', deckId: 'vocab-n5-pack01', level: 'N5' }), score: 0 },
      {
        entry: entry({
          id: 'manual',
          deckId: 'vocab-n5-pack96',
          deckTitle: 'Vocab N5 · Pack 96 - test',
          level: 'N5',
          searchSectionKey: 'user:god-of-war:test',
          searchSectionLabel: 'god of war · test',
          searchSectionShortLabel: 'god of war',
          searchSectionOrder: 1000,
        }),
        score: 0,
      },
    ]);

    expect(result.availableKeys).toEqual(['N5', 'user:god-of-war:test']);
    expect(result.counts.get('N5')).toBe(1);
    expect(result.counts.get('user:god-of-war:test')).toBe(1);
    expect(result.labels.get('user:god-of-war:test')?.long).toBe('god of war · test');
  });
});
