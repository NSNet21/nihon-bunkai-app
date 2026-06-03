import { describe, expect, it } from 'vitest';

import { buildBrowseRows, filterBrowseDecks, normalizeGroupSearchQuery } from './browse-group-search';
import type { Deck } from '@/data/types';

const decks: Deck[] = [
  {
    id: 'vocab-n5-pack01',
    type: 'vocab',
    level: 'N5',
    title: 'Vocab N5 · Pack 01',
    entryCount: 20,
    isFree: true,
    pack: 'vocab-n5-pack01',
    tags: ['vocab', 'n5', 'starter'],
    source: 'free',
  },
  {
    id: 'grammar-n4-pack02',
    type: 'grammar',
    level: 'N4',
    title: 'Grammar N4 · Pack 02',
    entryCount: 30,
    isFree: false,
    pack: 'grammar-n4-pack02',
    tags: ['grammar', 'n4', 'paid'],
    source: 'entitlement',
  },
  {
    id: 'custom-shadowing',
    type: 'vocab',
    level: null,
    title: 'Shadowing Notes',
    entryCount: 12,
    isFree: false,
    pack: 'custom-shadowing',
    tags: ['custom', 'section:speaking'],
    source: 'manual',
  },
];

describe('normalizeGroupSearchQuery', () => {
  it('normalizes spacing and case for group search', () => {
    expect(normalizeGroupSearchQuery('  N5   vocab  ')).toBe('n5 vocab');
  });
});

describe('filterBrowseDecks', () => {
  it('returns every deck for an empty query', () => {
    expect(filterBrowseDecks(decks, '').map((deck) => deck.id)).toEqual([
      'vocab-n5-pack01',
      'grammar-n4-pack02',
      'custom-shadowing',
    ]);
  });

  it('matches deck titles', () => {
    expect(filterBrowseDecks(decks, 'shadow').map((deck) => deck.id)).toEqual(['custom-shadowing']);
  });

  it('matches level and content type metadata', () => {
    expect(filterBrowseDecks(decks, 'n4 grammar').map((deck) => deck.id)).toEqual(['grammar-n4-pack02']);
  });

  it('matches tags and source labels', () => {
    expect(filterBrowseDecks(decks, 'manual speaking').map((deck) => deck.id)).toEqual(['custom-shadowing']);
  });

  it('returns no decks when all query tokens miss', () => {
    expect(filterBrowseDecks(decks, 'n1 kanji').map((deck) => deck.id)).toEqual([]);
  });
});

describe('buildBrowseRows', () => {
  it('respects closed levels when no group search is active', () => {
    const rows = buildBrowseRows(decks, new Set(['N5']), new Set(), false);

    expect(rows.map((row) => row.key)).not.toContain('vocab-n5-pack01');
  });

  it('auto-expands matching groups when group search is active', () => {
    const filtered = filterBrowseDecks(decks, 'n5 vocab');
    const rows = buildBrowseRows(filtered, new Set(['N5']), new Set(['N5/vocab']), true);

    expect(rows.map((row) => row.key)).toContain('vocab-n5-pack01');
  });
});
