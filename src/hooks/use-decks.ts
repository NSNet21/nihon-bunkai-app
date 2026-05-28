/**
 * Unified decks hook — merges embedded free decks + IndexedDB-imported paid decks.
 *
 * Re-fetches paid decks when:
 *   - hook first mounts
 *   - 'nb:decks-imported' window event fires (after download)
 *   - window regains focus (cross-tab + cross-session safety net)
 */

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { decks as freeDecks, entriesForDeckAsync as freeEntriesForDeckAsync } from '@/data/free-tier';
import type { CsvRow, Deck, Entry } from '@/data/types';
import { DECKS_IMPORTED_EVENT } from '@/lib/deck-import';
import { getPaidEntries, listPaidDecks } from '@/lib/download-store';

export function useAllDecks(): { decks: Deck[]; loading: boolean } {
  const [paidDecks, setPaidDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      setLoading(true);
      const paid = await listPaidDecks();
      if (cancelled) return;
      setPaidDecks(paid as Deck[]);
      setLoading(false);
    }

    void refresh();

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const onImported = () => void refresh();
      /* Switched from window 'focus' to document 'visibilitychange'
         2026-05-28. `window.addEventListener('focus', …)` was firing
         on element focus too (search input auto-focus, click into
         text fields, etc.) which cascaded:
           input.focus() → refresh() → setLoading(true) → useSearchIndex
           re-runs effect → re-renders SearchScreen → auto-focus runs
           again → loop, ~1 Hz.
         `visibilitychange` only fires when the document goes from
         visible↔hidden (tab switch, window minimise), which is the
         actual semantic we want — "user came back to the tab, maybe
         their decks changed in another tab; re-sync". */
      const onVisibilityChange = () => {
        if (document.visibilityState === 'visible') void refresh();
      };
      window.addEventListener(DECKS_IMPORTED_EVENT, onImported);
      document.addEventListener('visibilitychange', onVisibilityChange);
      return () => {
        cancelled = true;
        window.removeEventListener(DECKS_IMPORTED_EVENT, onImported);
        document.removeEventListener('visibilitychange', onVisibilityChange);
      };
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return { decks: [...freeDecks, ...paidDecks], loading };
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
