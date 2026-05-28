/**
 * Unified decks hook — merges embedded free decks + IndexedDB-imported paid decks.
 *
 * Re-fetches paid decks when:
 *   - hook first mounts
 *   - 'nb:decks-imported' window event fires (after download)
 *   - window regains focus (cross-tab + cross-session safety net)
 */

import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { decks as freeDecks, entriesForDeckAsync as freeEntriesForDeckAsync } from '@/data/free-tier';
import type { CsvRow, Deck, Entry } from '@/data/types';
import { DECKS_IMPORTED_EVENT } from '@/lib/deck-import';
import { getPaidEntries, listPaidDecks } from '@/lib/download-store';

export function useAllDecks(): { decks: Deck[]; loading: boolean; refresh: () => void } {
  const [paidDecks, setPaidDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  /* Bump on user-initiated refresh — separate from the mount effect so
     we can re-trigger the load without remounting the consumer tree.
     Cleaner than threading a setState through an event-driven side
     channel. */
  const [refreshTick, setRefreshTick] = useState(0);
  const refresh = useCallback(() => setRefreshTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const paid = await listPaidDecks();
      if (cancelled) return;
      setPaidDecks(paid as Deck[]);
      setLoading(false);
    }

    void load();

    /* Auto-refresh removed 2026-05-28 (per user feedback). The previous
       `visibilitychange` listener re-synced paid decks every time the
       user switched away from and back to the tab, which fired more
       often than expected and triggered visible "rebuilding index…"
       flickers on the Search page. The post-purchase
       DECKS_IMPORTED_EVENT path is preserved — that's the actual moment
       when a new pack lands and the merge view must update — and the
       Search page now exposes a manual refresh button for the rare
       cross-tab "I just downloaded something elsewhere" case. */
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const onImported = () => void load();
      window.addEventListener(DECKS_IMPORTED_EVENT, onImported);
      return () => {
        cancelled = true;
        window.removeEventListener(DECKS_IMPORTED_EVENT, onImported);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  return { decks: [...freeDecks, ...paidDecks], loading, refresh };
}

/** Read entries for a deck — checks free embedded first, then IndexedDB.
 *  Free path is now async (per-level lazy bundle import) so we await it. */
export async function entriesForDeckAsync(deckId: string): Promise<Entry[]> {
  const fromFree = await freeEntriesForDeckAsync(deckId);
  if (fromFree.length > 0) return fromFree;

  const paid = await getPaidEntries(deckId);
  if (!paid) return [];

  // Need the deck metadata to build full Entry objects
  const allPaid = await listPaidDecks();
  const deck = allPaid.find((d) => d.id === deckId);
  if (!deck) return [];

  return paid.map((r: CsvRow) => ({
    id: `${deck.pack}-${r.no}`,
    type: deck.type,
    level: deck.level,
    pack: deck.pack,
    tags: deck.tags,
    no: r.no,
    t: r.t,
    d: r.d,
    p: r.p,
    e: r.e,
  }));
}
