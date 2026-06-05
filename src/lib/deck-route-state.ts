import type { Deck } from '@/data/types';

export type DeckRouteState = 'missing-param' | 'loading' | 'not-found' | 'ready';

export function resolveDeckRouteState({
  deckId,
  deck,
  localDeck,
  loading,
  localLookupPending = false,
}: {
  deckId?: string;
  deck?: Deck;
  localDeck?: Deck;
  loading: boolean;
  localLookupPending?: boolean;
}): DeckRouteState {
  if (!deckId) return 'missing-param';
  if (deck || localDeck) return 'ready';
  if (loading || localLookupPending) return 'loading';
  return 'not-found';
}
