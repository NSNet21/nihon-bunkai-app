/**
 * Group Study — merge entries from multiple deckIds into one flat array
 * for transient "study multiple decks back-to-back" sessions.
 *
 * v1 scope (2026-05-27): Learn mode only. Quiz mode requires per-deck
 * session log + FSRS bookkeeping which doesn't translate cleanly to a
 * transient group session — deferred until user signal demands it.
 *
 * Pattern: comma-separated `ids` query param appended to existing
 * Memorize route so we don't fork the screen. See
 * `/deck/[deckId]/memorize?ids=foo,bar,baz`.
 */

import { entriesForDeckAsync } from '@/hooks/use-decks';
import type { Entry } from '@/data/types';

export const GROUP_SELECTION_KEY = 'nb.group-selection';

/** Read selection from localStorage. Returns [] if not set or corrupt. */
export function readGroupSelection(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(GROUP_SELECTION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Write selection — used by the Group Picker screen. */
export function writeGroupSelection(deckIds: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GROUP_SELECTION_KEY, JSON.stringify(deckIds));
  } catch {
    /* quota / private-mode — silently ignore */
  }
}

/** Parse `ids` query param from a URL: 'foo,bar,baz' → ['foo','bar','baz']. */
export function parseGroupIds(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

/** Load + concat entries from N decks. Entries keep their pack/level/tags
 *  so the card can still show level/pack badges from any deck in the mix. */
export async function loadGroupEntriesAsync(deckIds: string[]): Promise<Entry[]> {
  if (deckIds.length === 0) return [];
  const groups = await Promise.all(deckIds.map(entriesForDeckAsync));
  return groups.flat();
}
