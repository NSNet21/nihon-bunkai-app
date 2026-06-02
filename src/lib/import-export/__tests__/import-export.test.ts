import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';

import { decks as freeDecks } from '../../../data/free-tier';
import { parseLibraryCsvFilename } from '../filename';
import { parseManualCsv } from '../manual-csv';
import { parseManualImportFiles } from '../manual-import';

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

describe('parseManualImportFiles', () => {
  it('imports valid CSV files and reports invalid files', async () => {
    const good = new File(['T,D,P,E\n猫,แมว,ねこ,note'], 'vocab-n5-pack99.csv', { type: 'text/csv' });
    const bad = new File(['A,B\n1,2'], 'bad.csv', { type: 'text/csv' });
    const result = await parseManualImportFiles([good, bad], new Set());
    expect(result.ready).toHaveLength(1);
    expect(result.ready[0].deck.id).toBe('vocab-n5-pack99');
    expect(result.ready[0].deck.source).toBe('manual');
    expect(result.ready[0].entries.source).toBe('manual');
    expect(result.failed[0].fileName).toBe('bad.csv');
  });

  it('parses CSV files inside ZIP', async () => {
    const zip = new JSZip();
    zip.file('vocab/vocab-n5-pack98.csv', 'T,D,P,E\n犬,หมา,いぬ,note');
    const blob = await zip.generateAsync({ type: 'blob' });
    const file = new File([blob], 'manual.zip', { type: 'application/zip' });
    const result = await parseManualImportFiles([file], new Set());
    expect(result.ready[0].deck.id).toBe('vocab-n5-pack98');
  });

  it('skips embedded free deck ids', async () => {
    const file = new File(['T,D,P,E\n猫,แมว,ねこ,note'], 'vocab-n5-pack01.csv', { type: 'text/csv' });
    const result = await parseManualImportFiles([file], new Set(['vocab-n5-pack01']));
    expect(result.ready).toHaveLength(0);
    expect(result.skipped[0].reason).toMatch(/free/i);
  });
});
