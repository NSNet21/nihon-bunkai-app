import { describe, expect, it } from 'vitest';

import type { Entry } from '@/data/types';

import {
  applyEntryOverrides,
  entryOverrideKey,
  type EntryOverrideRecord,
} from './personal-overrides';

const entry: Entry = {
  id: 'kanji-n5-pack01-7',
  type: 'kanji',
  level: 'N5',
  pack: 'kanji-n5-pack01',
  tags: ['kanji', 'n5'],
  no: 7,
  t: '山',
  d: 'ภูเขา',
  p: 'やま',
  e: '### Original',
};

describe('personal entry overrides', () => {
  it('builds a stable deck and row key', () => {
    expect(entryOverrideKey('kanji-n5-pack01', 7)).toBe('kanji-n5-pack01::7');
  });

  it('applies matching override fields without changing source identity', () => {
    const overrides: EntryOverrideRecord[] = [{
      id: 'kanji-n5-pack01::7',
      deckId: 'kanji-n5-pack01',
      pack: 'kanji-n5-pack01',
      no: 7,
      fields: {
        t: '山（メモ）',
        d: 'ภูเขา / personal note',
        p: 'やま',
        e: '### Personal',
      },
      updatedAt: 1,
    }];

    const [overridden] = applyEntryOverrides('kanji-n5-pack01', [entry], overrides);

    expect(overridden).toEqual({
      ...entry,
      t: '山（メモ）',
      d: 'ภูเขา / personal note',
      p: 'やま',
      e: '### Personal',
      hasPersonalOverride: true,
    });
    expect(overridden.id).toBe(entry.id);
    expect(overridden.no).toBe(entry.no);
    expect(overridden.pack).toBe(entry.pack);
  });

  it('ignores overrides from another deck or row number', () => {
    const overrides: EntryOverrideRecord[] = [
      {
        id: 'kanji-n5-pack02::7',
        deckId: 'kanji-n5-pack02',
        pack: 'kanji-n5-pack02',
        no: 7,
        fields: { t: '別', d: 'อื่น', p: '', e: '' },
        updatedAt: 1,
      },
      {
        id: 'kanji-n5-pack01::8',
        deckId: 'kanji-n5-pack01',
        pack: 'kanji-n5-pack01',
        no: 8,
        fields: { t: '八', d: 'แปด', p: '', e: '' },
        updatedAt: 1,
      },
    ];

    expect(applyEntryOverrides('kanji-n5-pack01', [entry], overrides)).toEqual([entry]);
  });
});
