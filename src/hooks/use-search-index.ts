/**
 * Search hook — owns the global search index across free + paid decks.
 *
 * Rebuilds when:
 *   - free deck list is ready (mount)
 *   - paid decks change (DECKS_IMPORTED_EVENT / focus — bubbled through useAllDecks)
 *
 * Index + engine are held on refs + a "ready" flag so consumers don't
 * re-render while loading. Fuse + wanakana are dynamically imported
 * inside `loadSearchEngine()` — first Search visit pays the cost, the
 * rest of the session reuses the cached engine.
 */

import type Fuse from 'fuse.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { entriesForDeckAsync, useAllDecks } from '@/hooks/use-decks';
import {
  loadSearchEngine,
  type SearchEngine,
  type SearchResult,
  type SearchableEntry,
} from '@/lib/search-index';

interface UseSearchIndex {
  ready: boolean;
  totalEntries: number;
  /** Full flat list of all indexed entries (browse-all view). Re-used
   *  by Search when the query box is empty so users see the entire
   *  corpus as a long list with FlashList virtualization. */
  allEntries: SearchableEntry[];
  run: (query: string, limit?: number) => SearchResult[];
}

export function useSearchIndex(): UseSearchIndex {
  const { decks, loading: decksLoading } = useAllDecks();
  const engineRef = useRef<SearchEngine | null>(null);
  const fuseRef = useRef<Fuse<SearchableEntry> | null>(null);
  const [ready, setReady] = useState(false);
  const [totalEntries, setTotalEntries] = useState(0);
  const [allEntries, setAllEntries] = useState<SearchableEntry[]>([]);

  /* Stable join of deck IDs — rebuild trigger. */
  const deckKey = useMemo(() => decks.map((d) => d.id).sort().join('|'), [decks]);

  useEffect(() => {
    if (decksLoading) return;
    let cancelled = false;

    async function build() {
      setReady(false);
      const engine = await loadSearchEngine();
      if (cancelled) return;
      const flat: SearchableEntry[] = [];
      for (const deck of decks) {
        const entries = await entriesForDeckAsync(deck.id);
        if (cancelled) return;
        for (const e of entries) {
          flat.push(engine.toSearchable(e, deck.id, deck.title));
        }
      }
      engineRef.current = engine;
      fuseRef.current = engine.buildIndex(flat);
      setAllEntries(flat);
      setTotalEntries(flat.length);
      setReady(true);
    }

    void build();
    return () => { cancelled = true; };
  }, [deckKey, decksLoading]);

  const run = useCallback((query: string, limit = 50): SearchResult[] => {
    if (!fuseRef.current || !engineRef.current) return [];
    return engineRef.current.search(fuseRef.current, query, limit);
  }, []);

  return { ready, totalEntries, allEntries, run };
}
