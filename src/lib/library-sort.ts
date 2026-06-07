import type { Deck } from '@/data/types';

export const LIBRARY_SORT_MODES = ['default', 'name', 'terms'] as const;
export const LIBRARY_SORT_DIRECTIONS = ['asc', 'desc'] as const;

export type LibrarySortMode = (typeof LIBRARY_SORT_MODES)[number];
export type LibrarySortDirection = (typeof LIBRARY_SORT_DIRECTIONS)[number];

export function getLibrarySortMode(value: unknown): LibrarySortMode {
  return LIBRARY_SORT_MODES.includes(value as LibrarySortMode)
    ? (value as LibrarySortMode)
    : 'default';
}

export function getLibrarySortDirection(value: unknown): LibrarySortDirection {
  return LIBRARY_SORT_DIRECTIONS.includes(value as LibrarySortDirection)
    ? (value as LibrarySortDirection)
    : 'asc';
}

export function sortLibraryDecks(decks: Deck[], mode: LibrarySortMode, direction: LibrarySortDirection = 'asc'): Deck[] {
  const next = [...decks];
  if (mode === 'default') return next;

  return next.sort((a, b) => {
    if (mode === 'terms') {
      const entryDiff = direction === 'asc'
        ? a.entryCount - b.entryCount
        : b.entryCount - a.entryCount;
      if (entryDiff !== 0) return entryDiff;
      return compareDeckIdentity(a, b);
    }

    const identityDiff = compareDeckIdentity(a, b);
    return direction === 'asc' ? identityDiff : -identityDiff;
  });
}

function compareDeckIdentity(a: Deck, b: Deck) {
  const titleDiff = a.title.localeCompare(b.title, ['th', 'ja', 'en'], { numeric: true, sensitivity: 'base' });
  if (titleDiff !== 0) return titleDiff;
  return a.id.localeCompare(b.id, 'en', { numeric: true, sensitivity: 'base' });
}
