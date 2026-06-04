import { describe, expect, it } from 'vitest';

import { filterDeckEntries, normalizeDeckTermQuery } from './deck-term-search';
import type { Entry } from '@/data/types';

const entries: Entry[] = [
  {
    id: 'kanji-n5-pack01-1',
    type: 'kanji',
    level: 'N5',
    pack: 'kanji-n5-pack01',
    tags: ['kanji', 'n5'],
    no: 1,
    t: '一',
    d: 'หนึ่ง',
    p: 'いち',
    e: '### Basic Reading\n**Kunyomi:** ひと\n---\nExample: 一人',
  },
  {
    id: 'grammar-n5-pack01-2',
    type: 'grammar',
    level: 'N5',
    pack: 'grammar-n5-pack01',
    tags: ['grammar', 'n5'],
    no: 2,
    t: 'だ',
    d: 'เป็น, คือ',
    p: '',
    e: 'ใช้ท้ายประโยคแบบธรรมดา',
  },
];

describe('normalizeDeckTermQuery', () => {
  it('trims, lowercases, and collapses spaces', () => {
    expect(normalizeDeckTermQuery('  N5   KANJI  ')).toBe('n5 kanji');
  });
});

describe('filterDeckEntries', () => {
  it('returns every entry for an empty query', () => {
    expect(filterDeckEntries(entries, '').map((entry) => entry.id)).toEqual([
      'kanji-n5-pack01-1',
      'grammar-n5-pack01-2',
    ]);
  });

  it('matches term, meaning, pronunciation, explanation, and tags', () => {
    expect(filterDeckEntries(entries, '一').map((entry) => entry.id)).toEqual(['kanji-n5-pack01-1']);
    expect(filterDeckEntries(entries, 'หนึ่ง').map((entry) => entry.id)).toEqual(['kanji-n5-pack01-1']);
    expect(filterDeckEntries(entries, 'ichi').map((entry) => entry.id)).toEqual([]);
    expect(filterDeckEntries(entries, 'いち').map((entry) => entry.id)).toEqual(['kanji-n5-pack01-1']);
    expect(filterDeckEntries(entries, 'ธรรมดา').map((entry) => entry.id)).toEqual(['grammar-n5-pack01-2']);
    expect(filterDeckEntries(entries, 'grammar n5').map((entry) => entry.id)).toEqual(['grammar-n5-pack01-2']);
  });

  it('requires every query token to match the same entry', () => {
    expect(filterDeckEntries(entries, 'n5 หนึ่ง').map((entry) => entry.id)).toEqual(['kanji-n5-pack01-1']);
    expect(filterDeckEntries(entries, 'grammar หนึ่ง').map((entry) => entry.id)).toEqual([]);
  });
});
