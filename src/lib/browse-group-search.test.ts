import { describe, expect, it } from 'vitest';

import {
  buildBrowseCollapseKeys,
  buildBrowseRows,
  filterBrowseDecks,
  getLibrarySearchFocusRailState,
  groupSearchHasQuery,
  normalizeGroupSearchQuery,
} from './browse-group-search';
import type { Deck } from '@/data/types';

const decks: Deck[] = [
  {
    id: 'vocab-n5-pack01',
    type: 'vocab',
    level: 'N5',
    title: 'Vocab N5 · Pack 01',
    entryCount: 20,
    isFree: true,
    pack: 'vocab-n5-pack01',
    tags: ['vocab', 'n5', 'starter'],
    source: 'free',
  },
  {
    id: 'grammar-n4-pack02',
    type: 'grammar',
    level: 'N4',
    title: 'Grammar N4 · Pack 02',
    entryCount: 30,
    isFree: false,
    pack: 'grammar-n4-pack02',
    tags: ['grammar', 'n4', 'paid'],
    source: 'entitlement',
  },
  {
    id: 'custom-shadowing',
    type: 'vocab',
    level: null,
    title: 'Shadowing Notes',
    entryCount: 12,
    isFree: false,
    pack: 'custom-shadowing',
    tags: ['custom', 'section:speaking'],
    source: 'manual',
  },
];

describe('normalizeGroupSearchQuery', () => {
  it('normalizes spacing and case for group search', () => {
    expect(normalizeGroupSearchQuery('  N5   vocab  ')).toBe('n5 vocab');
  });
});

describe('groupSearchHasQuery', () => {
  it('only treats non-empty normalized text as an active query', () => {
    expect(groupSearchHasQuery('   ')).toBe(false);
    expect(groupSearchHasQuery(' n5 ')).toBe(true);
  });
});

describe('getLibrarySearchFocusRailState', () => {
  it('activates the modal top rail only while the search input is focused', () => {
    expect(getLibrarySearchFocusRailState(false)).toBe('idle');
    expect(getLibrarySearchFocusRailState(true)).toBe('focused');
  });
});

describe('filterBrowseDecks', () => {
  it('returns every deck for an empty query', () => {
    expect(filterBrowseDecks(decks, '').map((deck) => deck.id)).toEqual([
      'vocab-n5-pack01',
      'grammar-n4-pack02',
      'custom-shadowing',
    ]);
  });

  it('matches deck titles', () => {
    expect(filterBrowseDecks(decks, 'shadow').map((deck) => deck.id)).toEqual(['custom-shadowing']);
  });

  it('matches level and content type metadata', () => {
    expect(filterBrowseDecks(decks, 'n4 grammar').map((deck) => deck.id)).toEqual(['grammar-n4-pack02']);
  });

  it('matches tags and source labels', () => {
    expect(filterBrowseDecks(decks, 'manual speaking').map((deck) => deck.id)).toEqual(['custom-shadowing']);
  });

  it('returns no decks when all query tokens miss', () => {
    expect(filterBrowseDecks(decks, 'n1 kanji').map((deck) => deck.id)).toEqual([]);
  });
});

describe('buildBrowseRows', () => {
  it('respects closed levels when no group search is active', () => {
    const rows = buildBrowseRows(decks, new Set(['N5']), new Set(), false);

    expect(rows.map((row) => row.key)).not.toContain('vocab-n5-pack01');
  });

  it('auto-expands matching groups when group search is active', () => {
    const filtered = filterBrowseDecks(decks, 'n5 vocab');
    const rows = buildBrowseRows(filtered, new Set(['N5']), new Set(['N5/vocab']), true);

    expect(rows.map((row) => row.key)).toContain('vocab-n5-pack01');
  });

  it('builds collapse keys from the same hierarchy used by browse rows', () => {
    const { levelKeys, categoryKeys } = buildBrowseCollapseKeys([
      decks[0],
      {
        id: 'vocab-n5-pack96',
        type: 'vocab',
        level: 'N5',
        title: 'Vocab N5 · Pack 96',
        entryCount: 3,
        isFree: false,
        pack: 'vocab-n5-pack96',
        tags: ['vocab', 'n5', 'group:god of war', 'section:test'],
        userGroup: 'god of war',
        userSection: 'test',
        source: 'manual',
      },
      {
        id: 'glossary-pack01',
        type: 'glossary',
        level: null,
        title: 'Glossary · Pack 01',
        entryCount: 50,
        isFree: true,
        pack: 'glossary-pack01',
        tags: ['glossary'],
        source: 'free',
      },
    ]);

    expect(levelKeys).toContain('N5');
    expect(levelKeys).toContain('GLOSSARY');
    expect(levelKeys).toContain('god of war');
    expect(categoryKeys).toContain('N5/vocab');
    expect(categoryKeys).toContain('GLOSSARY/glossary');
    expect(categoryKeys).toContain('god of war/test');
  });

  it('keeps an official glossary section header for consistent hierarchy controls', () => {
    const rows = buildBrowseRows([
      {
        id: 'glossary-pack01',
        type: 'glossary',
        level: null,
        title: 'Glossary · Pack 01',
        entryCount: 50,
        isFree: true,
        pack: 'glossary-pack01',
        tags: ['glossary'],
        source: 'free',
      },
    ], new Set(), new Set(), false);

    expect(rows.map((row) => row.key)).toEqual([
      'lvl-GLOSSARY',
      'cat-GLOSSARY/glossary',
      'glossary-pack01',
    ]);
  });

  it('places manual official-shaped imports in their user group and section', () => {
    const rows = buildBrowseRows([
      {
        id: 'vocab-n5-pack96',
        type: 'vocab',
        level: 'N5',
        title: 'Vocab N5 · Pack 96',
        entryCount: 3,
        isFree: false,
        pack: 'vocab-n5-pack96',
        tags: ['vocab', 'n5', 'group:god of war', 'section:test'],
        userGroup: 'god of war',
        userSection: 'test',
        source: 'manual',
      },
    ], new Set(), new Set(), false);

    expect(rows.map((row) => row.key)).toEqual([
      'lvl-god of war',
      'cat-god of war/test',
      'vocab-n5-pack96',
    ]);
  });

  it('adds editable action context only for user group, section, and deck rows', () => {
    const rows = buildBrowseRows([
      decks[0],
      {
        id: 'vocab-n5-pack96',
        type: 'vocab',
        level: 'N5',
        title: 'Vocab N5 · Pack 96',
        entryCount: 3,
        isFree: false,
        pack: 'vocab-n5-pack96',
        tags: ['vocab', 'n5', 'group:Manual Smoke Group', 'section:Regression'],
        userGroup: 'Manual Smoke Group',
        userSection: 'Regression',
        source: 'manual',
      },
    ], new Set(), new Set(), false);

    const officialGroup = rows.find((row) => row.kind === 'levelHeader' && row.title === 'N5');
    const userGroup = rows.find((row) => row.kind === 'levelHeader' && row.title === 'Manual Smoke Group');
    const userSection = rows.find((row) => row.kind === 'categoryHeader' && row.title === 'Regression');
    const userDeck = rows.find((row) => row.kind === 'deck' && row.deck.id === 'vocab-n5-pack96');

    expect(officialGroup?.actionContext).toEqual({
      source: 'official',
      target: 'group',
      title: 'N5',
      childCount: 1,
      disabled: true,
      reason: 'Official Source แก้ไม่ได้',
    });
    expect(userGroup?.actionContext).toEqual({
      source: 'user',
      target: 'group',
      group: 'Manual Smoke Group',
      title: 'Manual Smoke Group',
      childCount: 1,
    });
    expect(userSection?.actionContext).toEqual({
      source: 'user',
      target: 'section',
      group: 'Manual Smoke Group',
      section: 'Regression',
      title: 'Regression',
      childCount: 1,
    });
    expect(userDeck?.actionContext).toEqual({
      source: 'user',
      target: 'deck',
      group: 'Manual Smoke Group',
      section: 'Regression',
      deckId: 'vocab-n5-pack96',
      title: 'Vocab N5 · Pack 96',
      childCount: 3,
    });
  });

  it('sorts user groups and sections by name while keeping deck order stable', () => {
    const rows = buildBrowseRows([
      {
        id: 'z-second',
        type: 'vocab',
        level: null,
        title: 'Z second',
        entryCount: 1,
        isFree: false,
        pack: 'z-second',
        tags: ['manual', 'group:Z Group', 'section:B Section'],
        userGroup: 'Z Group',
        userSection: 'B Section',
        source: 'manual',
      },
      {
        id: 'z-first',
        type: 'vocab',
        level: null,
        title: 'Z first',
        entryCount: 1,
        isFree: false,
        pack: 'z-first',
        tags: ['manual', 'group:Z Group', 'section:B Section'],
        userGroup: 'Z Group',
        userSection: 'B Section',
        source: 'manual',
      },
      {
        id: 'a-section',
        type: 'vocab',
        level: null,
        title: 'A section deck',
        entryCount: 1,
        isFree: false,
        pack: 'a-section',
        tags: ['manual', 'group:A Group', 'section:A Section'],
        userGroup: 'A Group',
        userSection: 'A Section',
        source: 'manual',
      },
    ], new Set(), new Set(), false, { mode: 'name', direction: 'asc' });

    expect(rows.map((row) => row.key)).toEqual([
      'lvl-A Group',
      'cat-A Group/A Section',
      'a-section',
      'lvl-Z Group',
      'cat-Z Group/B Section',
      'z-second',
      'z-first',
    ]);
  });

  it('sorts sections and deck rows by date using the newest child timestamp', () => {
    const rows = buildBrowseRows([
      {
        id: 'old-inbox',
        type: 'vocab',
        level: null,
        title: 'Old inbox',
        entryCount: 1,
        isFree: false,
        pack: 'old-inbox',
        tags: ['manual', 'group:Manual imports', 'section:Inbox'],
        userGroup: 'Manual imports',
        userSection: 'Inbox',
        source: 'manual',
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        id: 'new-week',
        type: 'vocab',
        level: null,
        title: 'New week',
        entryCount: 1,
        isFree: false,
        pack: 'new-week',
        tags: ['manual', 'group:Manual imports', 'section:Week 1'],
        userGroup: 'Manual imports',
        userSection: 'Week 1',
        source: 'manual',
        createdAt: 3000,
        updatedAt: 3000,
      },
      {
        id: 'old-week',
        type: 'vocab',
        level: null,
        title: 'Old week',
        entryCount: 1,
        isFree: false,
        pack: 'old-week',
        tags: ['manual', 'group:Manual imports', 'section:Week 1'],
        userGroup: 'Manual imports',
        userSection: 'Week 1',
        source: 'manual',
        createdAt: 2000,
        updatedAt: 2000,
      },
    ], new Set(), new Set(), false, { mode: 'date', direction: 'desc' });

    expect(rows.map((row) => row.key)).toEqual([
      'lvl-Manual imports',
      'cat-Manual imports/Week 1',
      'new-week',
      'old-week',
      'cat-Manual imports/Inbox',
      'old-inbox',
    ]);
  });
});
