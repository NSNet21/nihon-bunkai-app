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
 * v3 (2026-05-28): lazy bundle — `fuse.js` (~30 KB) + `wanakana` (~50 KB)
 * are only loaded once `loadSearchEngine()` is called (Search screen mount
 * or Ctrl/⌘+K). Module-level type-only imports keep TS happy without
 * pulling either lib into the initial bundle. Engine API is cached on a
 * module-level promise so repeat callers share one load.
 */

import type Fuse from 'fuse.js';
import type { FuseResultMatch, IFuseOptions } from 'fuse.js';

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

/** Engine API returned by `loadSearchEngine()` — all funcs close over the
 *  loaded Fuse ctor + wanakana helpers, so callers never import them. */
export interface SearchEngine {
  buildIndex(entries: SearchableEntry[]): Fuse<SearchableEntry>;
  search(fuse: Fuse<SearchableEntry>, query: string, limit?: number): SearchResult[];
  toSearchable(entry: Entry, deckId: string, deckTitle: string): SearchableEntry;
}

const FUSE_OPTIONS: IFuseOptions<SearchableEntry> = {
  keys: [
    { name: 't', weight: 1.0 },   // Japanese term — strongest signal
    { name: 'd', weight: 0.8 },   // Thai meaning
    { name: 'p', weight: 0.6 },   // Pronunciation/reading variants array
  ],
  threshold: 0.2,                  // 0 = exact, 1 = anything. 0.2 = tighter — fewer fuzzy false-positives
  ignoreLocation: true,            // Match anywhere in field, not just start
  minMatchCharLength: 2,           // 2+ contig chars must match — kills 1-char fuzzy noise. Pure 1-char kanji queries still match exactly via the T-field equality path.
  includeScore: true,
  includeMatches: true,
  shouldSort: true,
};

let enginePromise: Promise<SearchEngine> | null = null;

/** Dynamic-import Fuse + wanakana on first call, cache the engine for the
 *  rest of the session. Both libs are pure JS — no side effects to worry
 *  about beyond the initial parse cost. */
export function loadSearchEngine(): Promise<SearchEngine> {
  if (enginePromise) return enginePromise;
  enginePromise = (async () => {
    const [fuseMod, wanakanaMod] = await Promise.all([
      import('fuse.js'),
      import('wanakana'),
    ]);
    const FuseCtor = fuseMod.default;
    const { isHiragana, isKatakana, toHiragana, toKana, toKatakana } = wanakanaMod;

    function normalizeQuery(q: string): string {
      if (q.length < 2) return q;
      if (!/^[a-zA-Z]+$/.test(q)) return q;
      const kana = toKana(q.toLowerCase());
      /* Reject queries that collapse to a single kana char (e.g. `ki` → `き`) —
         they'd otherwise fuzzy-match anything containing that one syllable. */
      return kana.length >= 2 ? kana : '';
    }

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

    function expandReadings(raw: string): string[] {
      const tokens = normalizeReadings(raw);
      const out = new Set<string>();
      for (const tok of tokens) {
        out.add(tok);
        try {
          if (isHiragana(tok)) out.add(toKatakana(tok));
          else if (isKatakana(tok)) out.add(toHiragana(tok));
        } catch {
          /* wanakana shouldn't throw on these inputs, but guard anyway */
        }
      }
      return [...out];
    }

    return {
      buildIndex(entries) {
        return new FuseCtor(entries, FUSE_OPTIONS);
      },
      search(fuse, query, limit = 50) {
        const trimmed = normalizeQuery(query.trim());
        if (!trimmed) return [];
        return fuse.search(trimmed, { limit }).map((r) => ({
          entry: r.item,
          score: r.score ?? 1,
          matches: r.matches,
        }));
      },
      toSearchable(entry, deckId, deckTitle) {
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
      },
    };
  })();
  return enginePromise;
}
