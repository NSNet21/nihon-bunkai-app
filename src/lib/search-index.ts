/**
 * Fuse.js search index — JP + Thai fuzzy across all entries.
 *
 * Scope (v1): t / d / p only. e (markdown) deferred to v2.
 *
 * Index is rebuilt whenever the entry list changes (paid pack imported,
 * entitlement granted, etc.). Caller is responsible for calling buildIndex
 * with fresh data; this module stays stateless.
 */

import Fuse, { type FuseResultMatch, type IFuseOptions } from 'fuse.js';

import type { ContentType, Entry, JlptLevel } from '@/data/types';

/** Lightweight projection used inside the index (no markdown E field). */
export interface SearchableEntry {
  id: string;
  deckId: string;
  deckTitle: string;
  type: ContentType;
  level: JlptLevel | null;
  t: string;
  d: string;
  p: string;
  no: number;
}

export interface SearchResult {
  entry: SearchableEntry;
  score: number;
  matches?: readonly FuseResultMatch[];
}

const FUSE_OPTIONS: IFuseOptions<SearchableEntry> = {
  keys: [
    { name: 't', weight: 1.0 },   // Japanese term — strongest signal
    { name: 'd', weight: 0.8 },   // Thai meaning
    { name: 'p', weight: 0.6 },   // Pronunciation/reading
  ],
  threshold: 0.25,                // 0 = exact, 1 = anything. 0.25 = light typo tolerance (Thai exact-ish)
  ignoreLocation: true,            // Match anywhere in field, not just start
  minMatchCharLength: 1,           // Single-char queries (kanji search)
  includeScore: true,
  includeMatches: true,
  shouldSort: true,
};

export function buildIndex(entries: SearchableEntry[]): Fuse<SearchableEntry> {
  return new Fuse(entries, FUSE_OPTIONS);
}

export function search(
  fuse: Fuse<SearchableEntry>,
  query: string,
  limit = 50,
): SearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  return fuse.search(trimmed, { limit }).map((r) => ({
    entry: r.item,
    score: r.score ?? 1,
    matches: r.matches,
  }));
}

/** Flatten Entry[] from all decks into the searchable projection. */
export function toSearchable(entry: Entry, deckId: string, deckTitle: string): SearchableEntry {
  return {
    id: entry.id,
    deckId,
    deckTitle,
    type: entry.type,
    level: entry.level,
    t: entry.t,
    d: entry.d,
    p: entry.p,
    no: entry.no,
  };
}
