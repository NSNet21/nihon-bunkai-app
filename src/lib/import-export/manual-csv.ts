import Papa from 'papaparse';

import type { CsvRow } from '@/data/types';

type RawRow = Record<string, unknown>;

const REQUIRED = ['T', 'D', 'P', 'E'] as const;

function value(row: RawRow, key: string): string {
  return String(row[key] ?? row[key.toLowerCase()] ?? '').trim();
}

export function parseManualCsv(text: string): CsvRow[] {
  const parsed = Papa.parse<RawRow>(text, {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length > 0) {
    throw new Error(`CSV parse error: ${parsed.errors[0].message}`);
  }
  if (parsed.data.length === 0) throw new Error('CSV is empty');

  const fields = new Set((parsed.meta.fields ?? []).map((f) => f.trim().toUpperCase()));
  const missing = REQUIRED.filter((field) => !fields.has(field));
  if (missing.length > 0) throw new Error(`CSV missing required headers: ${missing.join(', ')}`);

  const hasNoHeader = fields.has('NO');
  const noValues = parsed.data.map((row) => value(row, 'NO'));
  const hasAnyNo = hasNoHeader && noValues.some((v) => v !== '');
  const hasAnyBlankNo = hasNoHeader && noValues.some((v) => v === '');
  if (hasAnyNo && hasAnyBlankNo) throw new Error('NO must be fully blank or fully sequential');

  const rows: CsvRow[] = parsed.data.map((row, index) => {
    const noRaw = value(row, 'NO');
    const no = hasAnyNo ? parseNo(noRaw) : index + 1;
    return {
      no,
      t: value(row, 'T'),
      d: value(row, 'D'),
      p: value(row, 'P'),
      e: value(row, 'E'),
    };
  });

  if (hasAnyNo) assertSequential(rows.map((row) => row.no));
  return rows;
}

function parseNo(raw: string): number {
  if (!/^\d+$/.test(raw)) throw new Error(`NO must be an integer: ${raw}`);
  return Number(raw);
}

function assertSequential(values: number[]): void {
  if (values.length < 2) return;
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] !== values[i - 1] + 1) {
      throw new Error('NO must be strictly sequential with step +1');
    }
  }
}
