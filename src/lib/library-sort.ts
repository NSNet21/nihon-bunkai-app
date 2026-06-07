import type { Deck } from '@/data/types';

export const LIBRARY_SORT_MODES = ['default', 'name', 'terms'] as const;

export type LibrarySortMode = (typeof LIBRARY_SORT_MODES)[number];

export function getLibrarySortMode(value: unknown): LibrarySortMode {
  return LIBRARY_SORT_MODES.includes(value as LibrarySortMode)
    ? (value as LibrarySortMode)
    : 'default';
}

export function sortLibraryDecks(decks: Deck[], mode: LibrarySortMode): Deck[] {
  const next = [...decks];
  if (mode === 'default') return next;

  return next.sort((a, b) => {
    if (mode === 'terms') {
      const entryDiff = b.entryCount - a.entryCount;
      if (entryDiff !== 0) return entryDiff;
    }

    return compareDeckIdentity(a, b);
  });
}

function compareDeckIdentity(a: Deck, b: Deck) {
  const titleDiff = a.title.localeCompare(b.title, ['th', 'ja', 'en'], { numeric: true, sensitivity: 'base' });
  if (titleDiff !== 0) return titleDiff;
  return a.id.localeCompare(b.id, 'en', { numeric: true, sensitivity: 'base' });
}
