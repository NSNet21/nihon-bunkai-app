import { describe, expect, it } from 'vitest';

import type { Deck } from '@/data/types';
import {
  getLibrarySortDirection,
  getLibrarySortDirectionForMode,
  getLibrarySortMode,
  sortLibraryDecks,
  type LibrarySortDirection,
  type LibrarySortMode,
} from './library-sort';

const deck = (overrides: Partial<Deck>): Deck => ({
  id: overrides.id ?? 'deck-a',
  pack: overrides.pack ?? overrides.id ?? 'deck-a',
  title: overrides.title ?? 'Deck A',
  type: overrides.type ?? 'vocab',
  level: overrides.level ?? 'N5',
  entryCount: overrides.entryCount ?? 20,
  isFree: overrides.isFree ?? true,
  source: overrides.source ?? 'free',
  tags: overrides.tags ?? [],
  ...overrides,
});

describe('library sort helpers', () => {
  it('keeps default order unchanged', () => {
    const decks = [
      deck({ id: 'b', title: 'Beta', entryCount: 10 }),
      deck({ id: 'a', title: 'Alpha', entryCount: 30 }),
    ];

    expect(sortLibraryDecks(decks, 'default', 'desc').map((item) => item.id)).toEqual(['b', 'a']);
    expect(sortLibraryDecks(decks, 'default', 'desc')).not.toBe(decks);
  });

  it('sorts by title ascending using a stable id fallback', () => {
    const decks = [
      deck({ id: 'b', title: 'Beta' }),
      deck({ id: 'a', title: 'Alpha' }),
      deck({ id: 'c', title: 'Alpha' }),
    ];

    expect(sortLibraryDecks(decks, 'name', 'asc').map((item) => item.id)).toEqual(['a', 'c', 'b']);
  });

  it('sorts by title descending using a stable id fallback', () => {
    const decks = [
      deck({ id: 'b', title: 'Beta' }),
      deck({ id: 'a', title: 'Alpha' }),
      deck({ id: 'c', title: 'Alpha' }),
    ];

    expect(sortLibraryDecks(decks, 'name', 'desc').map((item) => item.id)).toEqual(['b', 'c', 'a']);
  });

  it('sorts by entry count descending with title fallback', () => {
    const decks = [
      deck({ id: 'small', title: 'Small', entryCount: 10 }),
      deck({ id: 'large-b', title: 'Beta', entryCount: 30 }),
      deck({ id: 'large-a', title: 'Alpha', entryCount: 30 }),
    ];

    expect(sortLibraryDecks(decks, 'terms', 'desc').map((item) => item.id)).toEqual(['large-a', 'large-b', 'small']);
  });

  it('sorts by entry count ascending with title fallback', () => {
    const decks = [
      deck({ id: 'large-b', title: 'Beta', entryCount: 30 }),
      deck({ id: 'small', title: 'Small', entryCount: 10 }),
      deck({ id: 'large-a', title: 'Alpha', entryCount: 30 }),
    ];

    expect(sortLibraryDecks(decks, 'terms', 'asc').map((item) => item.id)).toEqual(['small', 'large-a', 'large-b']);
  });

  it('normalizes invalid persisted values to default', () => {
    expect(getLibrarySortMode('name')).toBe('name');
    expect(getLibrarySortMode('terms')).toBe('terms');
    expect(getLibrarySortMode('wat' as LibrarySortMode)).toBe('default');
    expect(getLibrarySortMode(null)).toBe('default');
    expect(getLibrarySortDirection('desc')).toBe('desc');
    expect(getLibrarySortDirection('wat' as LibrarySortDirection)).toBe('asc');
    expect(getLibrarySortDirection(null)).toBe('asc');
  });

  it('forces default mode back to ascending direction', () => {
    expect(getLibrarySortDirectionForMode('default', 'desc')).toBe('asc');
    expect(getLibrarySortDirectionForMode('name', 'desc')).toBe('desc');
    expect(getLibrarySortDirectionForMode('terms', 'asc')).toBe('asc');
  });
});
