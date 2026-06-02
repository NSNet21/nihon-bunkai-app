import Papa from 'papaparse';

import type { CsvRow } from '../../data/types';

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
