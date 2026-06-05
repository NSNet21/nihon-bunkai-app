import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';

import { decks as freeDecks } from '../../../data/free-tier';
import { parseLibraryCsvFilename } from '../filename';
import { parseManualCsv } from '../manual-csv';
import { parseManualImportFiles } from '../manual-import';
import { serializeDeckCsv, serializeGuardedDeckCsv } from '../export-csv';
import { selectExportableDecks } from '../export-library';
import { buildExportHierarchy, getExportSelectionSummary } from '../export-hierarchy';
import { IMPORT_HOW_TO_STEPS, IMPORT_SCHEMA_HEADERS } from '../import-how-to';
import {
  DEFAULT_IMPORT_GROUP,
  DEFAULT_IMPORT_SECTION,
  buildImportDestinationOptions,
  normalizeImportDestination,
} from '../import-destination';

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

  it('ignores Nihon Bunkai guard comments when importing CSV', () => {
    const guarded = [
      '# @nihon-bunkai:export v1',
      '# deckId=vocab-n5-pack01 source=official',
      'NO,T,D,P,E',
      '1,猫,แมว,ねこ,note',
    ].join('\n');
    expect(parseManualCsv(guarded)).toEqual([
      { no: 1, t: '猫', d: 'แมว', p: 'ねこ', e: 'note' },
    ]);
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

describe('import destination options', () => {
  it('derives user/import groups and sections from deck organization metadata', () => {
    const options = buildImportDestinationOptions([
      {
        id: 'manual-a',
        title: 'Manual A',
        source: 'manual',
        tags: ['manual', 'group:Manual imports', 'section:Week 1'],
      },
      {
        id: 'manual-b',
        title: 'Manual B',
        source: 'manual',
        userGroup: 'Manual imports',
        userSection: 'Inbox',
        tags: ['manual'],
      },
      {
        id: 'custom-a',
        title: 'Custom A',
        source: 'custom',
        userGroup: 'Kanji practice',
        userSection: 'N5',
        tags: ['manual'],
      },
      {
        id: 'official-a',
        title: 'Official A',
        source: 'free',
        level: 'N5',
        type: 'kanji',
        tags: ['kanji', 'n5'],
      },
    ] as any);

    expect(options.filter((group) => !group.disabled).map((group) => group.label)).toEqual(['Kanji practice', 'Manual imports']);
    expect(options.find((group) => group.label === 'Manual imports')?.sections.map((section) => section.label))
      .toEqual(['Inbox', 'Week 1']);
  });

  it('does not create a dummy manual destination when the library has no user groups', () => {
    const options = buildImportDestinationOptions([]);
    expect(options).toEqual([]);
  });

  it('shows official groups and sections as disabled import destinations', () => {
    const options = buildImportDestinationOptions([
      {
        id: 'kanji-n5-pack01',
        title: 'Kanji N5 - Pack 01',
        source: 'free',
        level: 'N5',
        type: 'kanji',
        tags: ['kanji', 'n5'],
      },
      {
        id: 'grammar-n5-pack01',
        title: 'Grammar N5 - Pack 01',
        source: 'entitlement',
        level: 'N5',
        type: 'grammar',
        tags: ['grammar', 'n5'],
      },
    ] as any);

    expect(options).toEqual([
      {
        key: 'official:n5',
        label: 'N5',
        source: 'official',
        disabled: true,
        sections: [
          { key: 'official:n5:grammar', label: 'Grammar', source: 'official', disabled: true },
          { key: 'official:n5:kanji', label: 'Kanji', source: 'official', disabled: true },
        ],
      },
    ]);
  });

  it('normalizes blank section to Inbox while trimming the group', () => {
    expect(normalizeImportDestination({ group: '  Weak N2 set  ', section: '   ' })).toEqual({
      group: 'Weak N2 set',
      section: DEFAULT_IMPORT_SECTION,
    });
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

  it('imports a self-made CSV file without official filename metadata', async () => {
    const file = new File(['T,D,P,E\n猫,แมว,ねこ,note'], 'my-card-set.csv', { type: 'text/csv' });
    const result = await parseManualImportFiles([file], new Set());
    expect(result.failed).toHaveLength(0);
    expect(result.ready).toHaveLength(1);
    expect(result.ready[0].deck.id).toBe('manual-my-card-set');
    expect(result.ready[0].deck.title).toBe('my card set');
    expect(result.ready[0].deck.source).toBe('manual');
    expect(result.ready[0].deck.level).toBeNull();
    expect(result.ready[0].deck.tags).toContain('group:Manual imports');
  });

  it('applies an import destination group and section to manual CSV decks', async () => {
    const file = new File(['T,D,P,E\n猫,แมว,ねこ,note'], 'my-card-set.csv', { type: 'text/csv' });
    const result = await parseManualImportFiles([file], new Set(), {
      group: 'Weak N2 set',
      section: 'Week 1',
    });
    expect(result.failed).toHaveLength(0);
    expect(result.ready[0].deck.userGroup).toBe('Weak N2 set');
    expect(result.ready[0].deck.userSection).toBe('Week 1');
    expect(result.ready[0].deck.tags).toContain('group:Weak N2 set');
    expect(result.ready[0].deck.tags).toContain('section:Week 1');
    expect(result.ready[0].deck.tags).not.toContain('group:Manual imports');
  });

  it('keeps manual imports grouped by default when destination fields are blank', async () => {
    const file = new File(['T,D,P,E\n犬,หมา,いぬ,note'], 'blank-destination.csv', { type: 'text/csv' });
    const result = await parseManualImportFiles([file], new Set(), {
      group: '   ',
      section: '',
    });
    expect(result.failed).toHaveLength(0);
    expect(result.ready[0].deck.userGroup).toBeUndefined();
    expect(result.ready[0].deck.userSection).toBeUndefined();
    expect(result.ready[0].deck.tags).toContain('group:Manual imports');
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

describe('export csv', () => {
  it('writes NO,T,D,P,E in order', () => {
    const csv = serializeDeckCsv([
      { no: 7, t: '猫', d: 'แมว', p: 'ねこ', e: 'note' },
    ]);
    expect(csv.split(/\r?\n/)[0]).toBe('NO,T,D,P,E');
    expect(csv).toContain('7,猫,แมว,ねこ,note');
  });

  it('can add a Nihon Bunkai export guard while preserving app re-import schema', () => {
    const csv = serializeGuardedDeckCsv(
      [{ no: 7, t: '猫', d: 'แมว', p: 'ねこ', e: 'note' }],
      { deckId: 'vocab-n5-pack01', source: 'official' },
    );
    const lines = csv.split(/\r?\n/);
    expect(lines[0]).toBe('# @nihon-bunkai:export v1');
    expect(lines[1]).toContain('deckId=vocab-n5-pack01');
    expect(lines[1]).toContain('source=official');
    expect(lines[2]).toBe('NO,T,D,P,E');
    expect(parseManualCsv(csv)).toEqual([
      { no: 7, t: '猫', d: 'แมว', p: 'ねこ', e: 'note' },
    ]);
  });

  it('selects only ready Library decks', () => {
    const decks = [
      { id: 'free', isFree: true, source: 'free' },
      { id: 'paid', isFree: false, source: 'entitlement' },
      { id: 'manual', isFree: false, source: 'manual' },
      { id: 'locked', isFree: false },
    ] as any[];
    expect(selectExportableDecks(decks).map((deck) => deck.id)).toEqual(['free', 'paid', 'manual']);
  });
});

describe('export hierarchy', () => {
  it('groups official decks by JLPT level and content type', () => {
    const groups = buildExportHierarchy([
      {
        id: 'vocab-n5-pack99',
        type: 'vocab',
        level: 'N5',
        title: 'Vocab N5 · Pack 99',
        entryCount: 1,
        isFree: false,
        pack: 'vocab-n5-pack99',
        tags: ['vocab', 'n5', 'vocab-n5-pack99'],
        source: 'manual',
      },
    ]);
    expect(groups[0].label).toBe('N5');
    expect(groups[0].sections[0].label).toBe('Vocab');
    expect(groups[0].sections[0].decks[0].id).toBe('vocab-n5-pack99');
  });

  it('supports user custom group names without colliding with official levels', () => {
    const groups = buildExportHierarchy([
      {
        id: 'custom-n1-pack01',
        type: 'vocab',
        level: 'N1',
        title: 'My custom N1 · Pack 01',
        entryCount: 2,
        isFree: false,
        pack: 'custom-n1-pack01',
        tags: ['group:my-card-set', 'custom-n1-pack01'],
        source: 'manual',
      },
      {
        id: 'custom-n5-pack01',
        type: 'vocab',
        level: 'N5',
        title: 'My custom N5 · Pack 01',
        entryCount: 2,
        isFree: false,
        pack: 'custom-n5-pack01',
        tags: ['my-card-set', 'custom-n5-pack01'],
        source: 'manual',
      },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('my-card-set');
    expect(groups[0].sections.map((section) => section.label)).toEqual(['N5', 'N1']);
  });

  it('summarizes none, partial, and all selection states for hierarchy rows', () => {
    const decks = [
      { id: 'deck-1' },
      { id: 'deck-2' },
      { id: 'deck-3' },
    ] as any[];

    expect(getExportSelectionSummary(decks, new Set())).toEqual({
      total: 3,
      selected: 0,
      state: 'none',
      meta: '3 decks',
    });
    expect(getExportSelectionSummary(decks, new Set(['deck-1']))).toEqual({
      total: 3,
      selected: 1,
      state: 'partial',
      meta: 'เลือกแล้ว 1/3',
    });
    expect(getExportSelectionSummary(decks, new Set(['deck-1', 'deck-2', 'deck-3']))).toEqual({
      total: 3,
      selected: 3,
      state: 'all',
      meta: 'เลือกแล้วทั้งหมด',
    });
  });
});

describe('import how-to copy model', () => {
  it('teaches direct CSV preparation without making Google Drive an app integration', () => {
    expect(IMPORT_SCHEMA_HEADERS).toEqual(['NO', 'T', 'D', 'P', 'E']);
    expect(IMPORT_HOW_TO_STEPS.map((step) => step.key)).toEqual(['prepare', 'export', 'import']);
    expect(IMPORT_HOW_TO_STEPS.map((step) => step.title)).toEqual([
      'เตรียมตาราง',
      'บันทึกเป็น CSV',
      'นำเข้า Library',
    ]);
    expect(IMPORT_HOW_TO_STEPS.some((step) => /Google Drive/i.test(step.body))).toBe(false);
    expect(IMPORT_HOW_TO_STEPS[2].body).toMatch(/Library/);
    expect(IMPORT_HOW_TO_STEPS[2].body).toMatch(/CSV\/ZIP/);
  });
});
