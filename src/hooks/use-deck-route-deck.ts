import { useEffect, useMemo, useState } from 'react';

import type { Deck } from '@/data/types';
import { getLibraryDeck } from '@/lib/download-store';
import { resolveDeckRouteState } from '@/lib/deck-route-state';
import { useAllDecks } from './use-decks';

export function useDeckRouteDeck(deckId?: string): {
  deck?: Deck;
  decks: Deck[];
  loading: boolean;
  routeState: ReturnType<typeof resolveDeckRouteState>;
  refresh: () => void;
} {
  const { decks, loading: decksLoading, refresh } = useAllDecks();
  const mergedDeck = deckId ? decks.find((item) => item.id === deckId) : undefined;
  const [localDeck, setLocalDeck] = useState<Deck | undefined>();
  const [localLookupPending, setLocalLookupPending] = useState(Boolean(deckId));

  useEffect(() => {
    setLocalDeck(undefined);
    if (!deckId || mergedDeck) {
      setLocalLookupPending(false);
      return;
    }

    let cancelled = false;
    setLocalLookupPending(true);
    void getLibraryDeck(deckId).then((record) => {
      if (cancelled) return;
      setLocalDeck(record as Deck | undefined);
      setLocalLookupPending(false);
    }).catch(() => {
      if (cancelled) return;
      setLocalLookupPending(false);
    });

    return () => {
      cancelled = true;
    };
  }, [deckId, mergedDeck]);

  const deck = mergedDeck ?? localDeck;
  const routeDecks = useMemo(() => {
    if (!deck || decks.some((item) => item.id === deck.id)) return decks;
    return [...decks, deck];
  }, [deck, decks]);
  const routeState = resolveDeckRouteState({
    deckId,
    deck: mergedDeck,
    localDeck,
    loading: decksLoading,
    localLookupPending,
  });

  return {
    deck,
    decks: routeDecks,
    loading: decksLoading || localLookupPending,
    routeState,
    refresh,
  };
}
