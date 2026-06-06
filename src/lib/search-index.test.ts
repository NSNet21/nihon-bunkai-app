import { describe, expect, it } from 'vitest';

import type { Deck, Entry } from '@/data/types';
import { loadSearchEngine } from './search-index';

describe('search index section metadata', () => {
  it('marks manual decks with user group and section metadata for Search jumpers', async () => {
    const engine = await loadSearchEngine();
    const deck: Deck = {
      id: 'vocab-n5-pack96',
      pack: 'vocab-n5-pack96',
      type: 'vocab',
      level: 'N5',
      title: 'Vocab N5 · Pack 96 - test',
      entryCount: 1,
      isFree: false,
      tags: ['manual', 'group:god of war', 'section:test'],
      source: 'manual',
      userGroup: 'god of war',
      userSection: 'test',
    };
    const entry: Entry = {
      id: 'vocab-n5-pack96-1',
      pack: deck.pack,
      type: 'vocab',
      level: 'N5',
      tags: ['manual'],
      no: 1,
      t: '視覚',
      d: 'การมองเห็น',
      p: 'しかく',
      e: '### Test',
    };

    expect(engine.toSearchable(entry, deck)).toMatchObject({
      searchSectionKey: 'user:god-of-war:test',
      searchSectionLabel: 'god of war · test',
      searchSectionShortLabel: 'god of war',
      searchSectionOrder: 1000,
    });
  });
});
