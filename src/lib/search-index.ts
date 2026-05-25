/**
 * Fuse.js search index — JP + Thai fuzzy across all entries.
 *
 * Scope (v1): t / d / p only. e (markdown) deferred to v3.
 *
 * v2 (2026-05-25): reading bridge — strips decorations from P column
 * ("Kunyomi: た.べる、く.う" → ["たべる", "くう"]) and expands each
 * reading into hiragana / katakana / romaji variants. So a learner who
 * types `たべる`, `タベル`, or `taberu` all hit the same kanji entry.
 * The original P string stays untouched in the displayed card — this is
 * a parallel index just for lookups.
 *
 * Index is rebuilt whenever the entry list changes (paid pack imported,
 * entitlement granted, etc.). Caller is responsible for calling buildIndex
 * with fresh data; this module stays stateless.
 */

import Fuse, { type FuseResultMatch, type IFuseOptions } from 'fuse.js';
import { isHiragana, isKatakana, toHiragana, toKatakana, toRomaji } from 'wanakana';

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
  /** Expanded readings — array of clean strings (hiragana/katakana/romaji variants). Fuse searches array natively. */
  p: string[];
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
    { name: 'p', weight: 0.6 },   // Pronunciation/reading variants array
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

/* ─── Reading normalization ─────────────────────────────────────────── */

/**
 * Strip decorations from a raw P column value and split into clean reading
 * tokens. Handles:
 *   - "Kunyomi: た.べる、く.う" → ["たべる", "くう"]
 *   - "Onyomi: ショク" → ["ショク"]
 *   - multiple lines (newline-separated)
 *   - dots "た.べる" (morpheme break in textbooks) → stripped
 *   - 、, comma, slash → split tokens
 *   - brackets, parens → stripped
 */
function normalizeReadings(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .flatMap((line) =>
      line
        .replace(/^(Kunyomi|Onyomi|くんよみ|おんよみ|訓読み|音読み)\s*[:：]\s*/i, '')
        .split(/[、,/／・]/),
    )
    .map((tok) => tok.replace(/[.．\s()（）\[\]【】「」『』]/g, '').trim())
    .filter((tok) => tok.length > 0);
}

/**
 * Expand each clean reading into searchable variants so the index bridges
 * hiragana ↔ katakana ↔ romaji. The original token always wins (added first).
 */
function expandReadings(raw: string): string[] {
  const tokens = normalizeReadings(raw);
  const out = new Set<string>();
  for (const tok of tokens) {
    out.add(tok);
    try {
      if (isHiragana(tok)) {
        out.add(toKatakana(tok));
        out.add(toRomaji(tok));
      } else if (isKatakana(tok)) {
        out.add(toHiragana(tok));
        out.add(toRomaji(tok));
      } else {
        // mixed / kanji / latin / Thai — best-effort romaji only
        const r = toRomaji(tok);
        if (r && r !== tok) out.add(r);
      }
    } catch {
      /* wanakana shouldn't throw on these inputs, but guard anyway */
    }
  }
  return [...out];
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
    p: expandReadings(entry.p),
    no: entry.no,
  };
}
