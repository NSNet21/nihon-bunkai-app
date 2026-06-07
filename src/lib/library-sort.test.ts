import { describe, expect, it } from 'vitest';

import type { Deck } from '@/data/types';
import {
  getLibrarySortDirection,
  getLibrarySortDirectionForMode,
  getLibrarySortMode,
  getLibraryDeckTimestamp,
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

  it('sorts by deck timestamp descending with title fallback', () => {
    const decks = [
      deck({ id: 'old', title: 'Old', createdAt: 1000, updatedAt: 1000 }),
      deck({ id: 'new-b', title: 'Beta', createdAt: 3000, updatedAt: 3000 }),
      deck({ id: 'new-a', title: 'Alpha', createdAt: 3000, updatedAt: 3000 }),
    ];

    expect(sortLibraryDecks(decks, 'date', 'desc').map((item) => item.id)).toEqual(['new-a', 'new-b', 'old']);
  });

  it('sorts by deck timestamp ascending with title fallback', () => {
    const decks = [
      deck({ id: 'new-b', title: 'Beta', createdAt: 3000, updatedAt: 3000 }),
      deck({ id: 'old', title: 'Old', createdAt: 1000, updatedAt: 1000 }),
      deck({ id: 'new-a', title: 'Alpha', createdAt: 3000, updatedAt: 3000 }),
    ];

    expect(sortLibraryDecks(decks, 'date', 'asc').map((item) => item.id)).toEqual(['old', 'new-a', 'new-b']);
  });

  it('reads updatedAt before createdAt for date sort fallback', () => {
    expect(getLibraryDeckTimestamp(deck({ createdAt: 1000, updatedAt: 2500 }))).toBe(2500);
    expect(getLibraryDeckTimestamp(deck({ createdAt: 1000 }))).toBe(1000);
  });

  it('normalizes invalid persisted values to default', () => {
    expect(getLibrarySortMode('name')).toBe('name');
    expect(getLibrarySortMode('date')).toBe('date');
    expect(getLibrarySortMode('terms')).toBe('date');
    expect(getLibrarySortMode('wat' as LibrarySortMode)).toBe('default');
    expect(getLibrarySortMode(null)).toBe('default');
    expect(getLibrarySortDirection('desc')).toBe('desc');
    expect(getLibrarySortDirection('wat' as LibrarySortDirection)).toBe('asc');
    expect(getLibrarySortDirection(null)).toBe('asc');
  });

  it('forces default mode back to ascending direction', () => {
    expect(getLibrarySortDirectionForMode('default', 'desc')).toBe('asc');
    expect(getLibrarySortDirectionForMode('name', 'desc')).toBe('desc');
    expect(getLibrarySortDirectionForMode('date', 'asc')).toBe('asc');
  });
});
