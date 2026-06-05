import { describe, expect, it } from 'vitest';

import {
  applyDeckOrganization,
  getDeckOrganization,
  isOfficialDeck,
  isUserEditableDeck,
} from './user-content';
import type { Deck } from '@/data/types';

const baseDeck: Deck = {
  id: 'manual-self-imported-file',
  type: 'vocab',
  level: null,
  title: 'self imported file',
  entryCount: 2,
  isFree: false,
  pack: 'manual-self-imported-file',
  tags: ['manual', 'group:Manual imports', 'section:N1'],
  source: 'manual',
};

describe('user content deck classification', () => {
  it('treats manual and custom decks as user-editable', () => {
    expect(isUserEditableDeck(baseDeck)).toBe(true);
    expect(isUserEditableDeck({ ...baseDeck, source: 'custom' })).toBe(true);
  });

  it('treats free and entitlement decks as official', () => {
    expect(isOfficialDeck({ ...baseDeck, source: 'free', isFree: true })).toBe(true);
    expect(isOfficialDeck({ ...baseDeck, source: 'entitlement' })).toBe(true);
    expect(isUserEditableDeck({ ...baseDeck, source: 'entitlement' })).toBe(false);
  });
});

describe('deck organization metadata', () => {
  it('prefers explicit user metadata over tag fallback', () => {
    const deck = {
      ...baseDeck,
      userGroup: 'My JLPT Set',
      userSection: 'N2 weak points',
    };
    expect(getDeckOrganization(deck)).toEqual({
      group: 'My JLPT Set',
      section: 'N2 weak points',
    });
  });

  it('falls back to group and section tags for existing manual imports', () => {
    expect(getDeckOrganization(baseDeck)).toEqual({
      group: 'Manual imports',
      section: 'N1',
    });
  });

  it('updates explicit metadata and compatible tags without touching pack identity', () => {
    const updated = applyDeckOrganization(baseDeck, {
      group: 'Kanji practice',
      section: 'Week 1',
    });
    expect(updated.pack).toBe(baseDeck.pack);
    expect(updated.userGroup).toBe('Kanji practice');
    expect(updated.userSection).toBe('Week 1');
    expect(updated.tags).toContain('group:Kanji practice');
    expect(updated.tags).toContain('section:Week 1');
    expect(updated.tags).not.toContain('group:Manual imports');
    expect(updated.tags).not.toContain('section:N1');
  });
});
