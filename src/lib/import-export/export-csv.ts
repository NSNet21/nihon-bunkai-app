import Papa from 'papaparse';

import type { CsvRow } from '../../data/types';

type GuardedExportMeta = {
  deckId: string;
  source: 'official' | 'manual' | 'custom';
};

export function serializeDeckCsv(rows: readonly CsvRow[]): string {
  return Papa.unparse(
    rows.map((row) => ({
      NO: row.no,
      T: row.t,
      D: row.d,
      P: row.p,
      E: row.e,
    })),
    { columns: ['NO', 'T', 'D', 'P', 'E'] },
  );
}

export function serializeGuardedDeckCsv(rows: readonly CsvRow[], meta: GuardedExportMeta): string {
  return [
    '# @nihon-bunkai:export v1',
    `# deckId=${sanitizeMeta(meta.deckId)} source=${sanitizeMeta(meta.source)}`,
    serializeDeckCsv(rows),
  ].join('\n');
}

function sanitizeMeta(value: string): string {
  return value.replace(/[\r\n]/g, '').trim();
}
