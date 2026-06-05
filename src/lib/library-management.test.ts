import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Deck } from '@/data/types';

const decks = new Map<string, Deck>();
const entryPacks = new Set<string>();

vi.mock('./download-store', () => ({
  deleteLibraryDeckAndEntries: vi.fn(async (deckId: string) => {
    const deck = decks.get(deckId);
    if (!deck) return false;
    decks.delete(deckId);
    entryPacks.delete(deck.pack);
    return true;
  }),
  getLibraryDeck: vi.fn(async (deckId: string) => decks.get(deckId)),
  putLibraryDeck: vi.fn(async (deck: Deck) => {
    decks.set(deck.id, deck);
  }),
}));

import {
  deleteUserLibraryDeck,
  moveUserLibraryDeck,
  renameUserLibraryDeck,
} from './library-management';

const manualDeck: Deck = {
  id: 'manual-self-imported-file',
  type: 'vocab',
  level: null,
  title: 'self imported file',
  entryCount: 2,
  isFree: false,
  pack: 'manual-self-imported-file',
  tags: ['manual', 'group:Manual imports'],
  source: 'manual',
};

beforeEach(() => {
  decks.clear();
  entryPacks.clear();
  decks.set(manualDeck.id, manualDeck);
  entryPacks.add(manualDeck.pack);
  vi.stubGlobal('window', new EventTarget());
});

describe('library management operations', () => {
  it('renames manual decks without changing pack identity', async () => {
    const result = await renameUserLibraryDeck(manualDeck.id, 'My renamed deck');
    expect(result).toEqual({ ok: true });
    expect(decks.get(manualDeck.id)?.title).toBe('My renamed deck');
    expect(decks.get(manualDeck.id)?.pack).toBe(manualDeck.pack);
  });

  it('moves manual decks into explicit user group and section metadata', async () => {
    const result = await moveUserLibraryDeck(manualDeck.id, {
      group: 'Kanji practice',
      section: 'Week 1',
    });
    expect(result).toEqual({ ok: true });
    expect(decks.get(manualDeck.id)?.userGroup).toBe('Kanji practice');
    expect(decks.get(manualDeck.id)?.userSection).toBe('Week 1');
    expect(decks.get(manualDeck.id)?.tags).toContain('group:Kanji practice');
    expect(decks.get(manualDeck.id)?.tags).toContain('section:Week 1');
  });

  it('rejects official deck mutation', async () => {
    decks.set('official', { ...manualDeck, id: 'official', pack: 'official', source: 'entitlement' });
    await expect(renameUserLibraryDeck('official', 'Nope')).resolves.toEqual({
      ok: false,
      reason: 'Official Source ลบหรือแก้ metadata ไม่ได้',
    });
    expect(decks.get('official')?.title).toBe('self imported file');
  });

  it('deletes user decks and matching entry rows', async () => {
    const result = await deleteUserLibraryDeck(manualDeck.id);
    expect(result).toEqual({ ok: true });
    expect(decks.has(manualDeck.id)).toBe(false);
    expect(entryPacks.has(manualDeck.pack)).toBe(false);
  });
});
