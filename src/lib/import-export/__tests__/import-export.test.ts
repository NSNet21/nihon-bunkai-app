import { describe, expect, it } from 'vitest';

import { decks as freeDecks } from '../../../data/free-tier';

describe('library source metadata', () => {
  it('marks embedded free decks with source free', () => {
    expect(freeDecks.length).toBeGreaterThan(0);
    expect(freeDecks.every((deck) => deck.source === 'free')).toBe(true);
  });
});
