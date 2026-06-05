import { describe, expect, it } from 'vitest';

import { resolveDeckRouteState } from './deck-route-state';
import type { Deck } from '@/data/types';

const manualDeck: Deck = {
  id: 'manual-self-imported-file',
  type: 'vocab',
  level: 'N5',
  title: 'self imported file',
  entryCount: 2,
  isFree: false,
  pack: 'manual-self-imported-file',
  tags: ['manual'],
  source: 'manual',
};

describe('resolveDeckRouteState', () => {
  it('keeps manual deck routes in loading state while local library decks are still hydrating', () => {
    expect(resolveDeckRouteState({ deckId: manualDeck.id, deck: undefined, loading: true })).toBe('loading');
  });

  it('keeps manual deck routes in loading state while direct local lookup is still pending', () => {
    expect(resolveDeckRouteState({
      deckId: manualDeck.id,
      deck: undefined,
      loading: false,
      localLookupPending: true,
    })).toBe('loading');
  });

  it('resolves ready when direct local lookup finds the deck', () => {
    expect(resolveDeckRouteState({
      deckId: manualDeck.id,
      deck: undefined,
      localDeck: manualDeck,
      loading: false,
      localLookupPending: false,
    })).toBe('ready');
  });

  it('only treats a missing deck as not found after local library loading has finished', () => {
    expect(resolveDeckRouteState({ deckId: manualDeck.id, deck: undefined, loading: false })).toBe('not-found');
  });

  it('resolves ready when the deck is present', () => {
    expect(resolveDeckRouteState({ deckId: manualDeck.id, deck: manualDeck, loading: false })).toBe('ready');
  });

  it('distinguishes a missing route param from a missing deck', () => {
    expect(resolveDeckRouteState({ deckId: undefined, deck: undefined, loading: false })).toBe('missing-param');
  });
});
