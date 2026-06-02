import { describe, expect, it } from 'vitest';

import { decks as freeDecks } from '../../../data/free-tier';
import { parseLibraryCsvFilename } from '../filename';
import { parseManualCsv } from '../manual-csv';

describe('library source metadata', () => {
  it('marks embedded free decks with source free', () => {
    expect(freeDecks.length).toBeGreaterThan(0);
    expect(freeDecks.every((deck) => deck.source === 'free')).toBe(true);
  });
});

describe('parseManualCsv', () => {
  it('accepts T,D,P,E without NO and auto-numbers rows', () => {
    const rows = parseManualCsv('T,D,P,E\n猫,แมว,ねこ,### note\n犬,หมา,いぬ,### note');
    expect(rows).toEqual([
      { no: 1, t: '猫', d: 'แมว', p: 'ねこ', e: '### note' },
      { no: 2, t: '犬', d: 'หมา', p: 'いぬ', e: '### note' },
    ]);
  });

  it('accepts sequential NO starting after 1', () => {
    const rows = parseManualCsv('NO,T,D,P,E\n7,猫,แมว,ねこ,a\n8,犬,หมา,いぬ,b');
    expect(rows.map((r) => r.no)).toEqual([7, 8]);
  });

  it('rejects mixed blank and numbered NO values', () => {
    expect(() => parseManualCsv('NO,T,D,P,E\n,猫,แมว,ねこ,a\n2,犬,หมา,いぬ,b')).toThrow(/NO/);
  });

  it.each([
    ['duplicate', 'NO,T,D,P,E\n1,猫,แมว,ねこ,a\n1,犬,หมา,いぬ,b'],
    ['gap', 'NO,T,D,P,E\n1,猫,แมว,ねこ,a\n3,犬,หมา,いぬ,b'],
    ['descending', 'NO,T,D,P,E\n3,猫,แมว,ねこ,a\n2,犬,หมา,いぬ,b'],
    ['decimal', 'NO,T,D,P,E\n1.5,猫,แมว,ねこ,a\n2.5,犬,หมา,いぬ,b'],
    ['text', 'NO,T,D,P,E\none,猫,แมว,ねこ,a\ntwo,犬,หมา,いぬ,b'],
  ])('rejects invalid NO sequence: %s', (_name, csv) => {
    expect(() => parseManualCsv(csv)).toThrow(/NO/);
  });

  it('rejects missing required headers', () => {
    expect(() => parseManualCsv('NO,T,D,P\n1,猫,แมว,ねこ')).toThrow(/missing/i);
  });
});

describe('parseLibraryCsvFilename', () => {
  it('parses supported official filename patterns', () => {
    expect(parseLibraryCsvFilename('vocab-n5-pack18.csv')?.pack).toBe('vocab-n5-pack18');
    expect(parseLibraryCsvFilename('grammar-n4-pack01.csv')?.type).toBe('grammar');
    expect(parseLibraryCsvFilename('kanji/kanji-n3-pack01.csv')?.level).toBe('N3');
    expect(parseLibraryCsvFilename('glossary-pack01.csv')?.level).toBeNull();
  });

  it('rejects unknown filenames', () => {
    expect(parseLibraryCsvFilename('random.csv')).toBeNull();
  });
});
