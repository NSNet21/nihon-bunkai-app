# Import Export Implementation Plan

<!-- cspell:disable -->

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Browse-level manual Import / Batch Import and Export / Batch Export for ready Library decks while keeping paid entitlement content protected.

**Architecture:** Keep existing signed-download import behavior intact. Add focused import/export modules under `src/lib/import-export/`, extend the IndexedDB Library records with source metadata, mount a compact Library action modal from Browse, and add short help copy in Settings. Use logic-first tests before UI wiring, then run browser interaction smoke and the existing full-corpus perf guardrail.

**Tech Stack:** Expo SDK 56, React Native Web, TypeScript, Dexie, JSZip, Papaparse, Vitest for pure logic tests, Playwright for browser flow smoke.

---

## File Structure

- Modify `companion-app/package.json`: add `test:import-export` and `smoke:import-export` scripts.
- Modify `companion-app/src/data/types.ts`: add `DeckSource` and `source` metadata to `Deck`.
- Modify `companion-app/src/data/free-tier.ts`: mark embedded free decks with `source: 'free'`.
- Modify `companion-app/src/lib/download-store.ts`: move local Library records to source-aware deck/entry records while preserving existing table names.
- Modify `companion-app/src/lib/deck-import.ts`: set signed-download records to `source: 'entitlement'`; do not change signed-download parsing rules.
- Modify `companion-app/src/hooks/use-decks.ts`: return source-aware decks and resolve entries from the same IndexedDB path.
- Create `companion-app/src/lib/import-export/filename.ts`: parse supported CSV filenames.
- Create `companion-app/src/lib/import-export/manual-csv.ts`: parse and validate manual CSV text.
- Create `companion-app/src/lib/import-export/manual-import.ts`: import CSV/multiple CSV/ZIP files into Local Library.
- Create `companion-app/src/lib/import-export/export-csv.ts`: serialize ready deck entries to `NO,T,D,P,E`.
- Create `companion-app/src/lib/import-export/export-library.ts`: export one deck as CSV or selected decks as ZIP.
- Create `companion-app/src/lib/import-export/__tests__/import-export.test.ts`: logic test suite.
- Create `companion-app/src/components/library-actions-modal.tsx`: Browse action sheet/modal and file/download actions.
- Modify `companion-app/src/app/(tabs)/index.tsx`: add Library action button, modal mount, `IMPORT` badge.
- Modify `companion-app/src/app/(tabs)/settings.tsx`: add short Import / Export help section.
- Create `companion-app/tools/import-export-flow-smoke.mjs`: Playwright user-flow smoke.

---

### Task 1: Test Harness

**Files:**
- Modify: `companion-app/package.json`
- Modify: `companion-app/pnpm-lock.yaml`

- [ ] **Step 1: Add Vitest**

Run:

```powershell
pnpm --dir companion-app add -D vitest
```

Expected: `package.json` and `pnpm-lock.yaml` update; no production dependency is added.

- [ ] **Step 2: Add test scripts**

Edit `companion-app/package.json` scripts to include:

```json
"test:import-export": "vitest run src/lib/import-export/__tests__/import-export.test.ts",
"smoke:import-export": "node tools/import-export-flow-smoke.mjs"
```

- [ ] **Step 3: Run empty test command**

Run:

```powershell
pnpm --dir companion-app test:import-export
```

Expected: FAIL because the test file does not exist yet. This confirms the command is wired.

- [ ] **Step 4: Commit harness**

Run:

```powershell
git -C companion-app add package.json pnpm-lock.yaml
git -C companion-app commit -m "test: add import export test harness"
```

---

### Task 2: Source Metadata And Library Storage

**Files:**
- Modify: `companion-app/src/data/types.ts`
- Modify: `companion-app/src/data/free-tier.ts`
- Modify: `companion-app/src/lib/download-store.ts`
- Modify: `companion-app/src/lib/deck-import.ts`
- Modify: `companion-app/src/hooks/use-decks.ts`

- [ ] **Step 1: Add deck source type**

In `src/data/types.ts`, add:

```ts
export type DeckSource = 'free' | 'entitlement' | 'manual';
```

Extend `Deck`:

```ts
export interface Deck {
  id: string;
  type: ContentType;
  level: JlptLevel | null;
  title: string;
  entryCount: number;
  isFree: boolean;
  pack: string;
  tags: string[];
  source: DeckSource;
}
```

- [ ] **Step 2: Mark free decks**

In `src/data/free-tier.ts`, ensure the exported deck map returns:

```ts
export const decks: Deck[] = raw.decks.map((d) => ({
  ...d,
  isFree: true,
  source: 'free',
}));
```

- [ ] **Step 3: Make IndexedDB records source-aware**

In `src/lib/download-store.ts`, replace `PaidDeckRecord` with:

```ts
export type LibraryDeckRecord = Deck & {
  source: 'entitlement' | 'manual';
  skuId?: string;
  importedAt: number;
};
```

Replace `PaidEntriesRecord` with:

```ts
export type LibraryEntriesRecord = {
  pack: string;
  source: 'entitlement' | 'manual';
  skuId?: string;
  rows: CsvRow[];
};
```

Keep table names `paidDecks` and `paidEntries` for migration simplicity, but update the table types and helper names by adding aliases:

```ts
export type PaidDeckRecord = LibraryDeckRecord;
export type PaidEntriesRecord = LibraryEntriesRecord;
```

Add Dexie version 3:

```ts
this.version(3).stores({
  zips: '&name, skuId, downloadedAt',
  paidDecks: '&id, source, skuId, level, type',
  paidEntries: '&pack, source, skuId',
});
```

- [ ] **Step 4: Add source-aware helpers**

Still in `download-store.ts`, add:

```ts
export async function saveLibraryDecks(decks: LibraryDeckRecord[]): Promise<void> {
  const d = getDB();
  if (!d || decks.length === 0) return;
  await d.paidDecks.bulkPut(decks);
}

export async function saveLibraryEntries(records: LibraryEntriesRecord[]): Promise<void> {
  const d = getDB();
  if (!d || records.length === 0) return;
  await d.paidEntries.bulkPut(records);
}

export async function listLibraryDecks(): Promise<LibraryDeckRecord[]> {
  const d = getDB();
  if (!d) return [];
  return d.paidDecks.toArray();
}

export async function getLibraryEntries(pack: string): Promise<CsvRow[] | undefined> {
  const d = getDB();
  if (!d) return undefined;
  const rec = await d.paidEntries.get(pack);
  return rec?.rows;
}
```

Keep the old helper names as wrappers so signed-download code keeps compiling:

```ts
export const savePaidDecks = saveLibraryDecks;
export const savePaidEntries = saveLibraryEntries;
export const listPaidDecks = listLibraryDecks;
export const getPaidEntries = getLibraryEntries;
```

- [ ] **Step 5: Mark entitlement imports**

In `src/lib/deck-import.ts`, include source on deck and entry records:

```ts
source: 'entitlement',
skuId,
importedAt,
```

and:

```ts
entries.push({ pack: meta.pack, source: 'entitlement', skuId, rows });
```

- [ ] **Step 6: Use source-aware reads**

In `src/hooks/use-decks.ts`, import `getLibraryEntries` and `listLibraryDecks`, then update reads:

```ts
const paid = await listLibraryDecks();
setPaidDecks(paid as Deck[]);
```

and:

```ts
const paid = await getLibraryEntries(deckId);
const allPaid = await listLibraryDecks();
```

- [ ] **Step 7: Run app compile smoke**

Run:

```powershell
pnpm --dir companion-app lint
```

Expected: no new import/type errors from these files. If the repo has unrelated lint debt, capture it in the task notes and run a targeted Expo dev smoke after Task 7.

- [ ] **Step 8: Commit storage metadata**

Run:

```powershell
git -C companion-app add src/data/types.ts src/data/free-tier.ts src/lib/download-store.ts src/lib/deck-import.ts src/hooks/use-decks.ts
git -C companion-app commit -m "feat: add source metadata to library decks"
```

---

### Task 3: Parser And Filename Tests

**Files:**
- Create: `companion-app/src/lib/import-export/filename.ts`
- Create: `companion-app/src/lib/import-export/manual-csv.ts`
- Create: `companion-app/src/lib/import-export/__tests__/import-export.test.ts`

- [ ] **Step 1: Write failing parser tests**

Create `src/lib/import-export/__tests__/import-export.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseLibraryCsvFilename } from '../filename';
import { parseManualCsv } from '../manual-csv';

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
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
pnpm --dir companion-app test:import-export
```

Expected: FAIL because `filename.ts` and `manual-csv.ts` do not exist.

- [ ] **Step 3: Implement filename parser**

Create `src/lib/import-export/filename.ts`:

```ts
import type { ContentType, JlptLevel } from '@/data/types';

const CSV_NAME_RE = /^(?:.*\/)?(vocab|grammar|kanji)-(n[1-5])-(?:pack|vol)(\d+)\.csv$/i;
const GLOSSARY_RE = /^(?:.*\/)?glossary-(?:pack|vol)(\d+)\.csv$/i;

export type LibraryCsvMeta = {
  pack: string;
  type: ContentType;
  level: JlptLevel | null;
  title: string;
  tags: string[];
};

const TYPE_LABELS: Record<ContentType, string> = {
  vocab: 'Vocab',
  grammar: 'Grammar',
  kanji: 'Kanji',
  glossary: 'Glossary',
};

export function parseLibraryCsvFilename(name: string): LibraryCsvMeta | null {
  const clean = name.replace(/\\/g, '/').replace(/^\.\//, '');
  const glossary = clean.match(GLOSSARY_RE);
  if (glossary) {
    const packNum = glossary[1].padStart(2, '0');
    const pack = `glossary-pack${packNum}`;
    return {
      pack,
      type: 'glossary',
      level: null,
      title: `${TYPE_LABELS.glossary} GLOSSARY · Pack ${packNum}`,
      tags: ['glossary', pack],
    };
  }

  const m = clean.match(CSV_NAME_RE);
  if (!m) return null;
  const type = m[1].toLowerCase() as ContentType;
  const level = m[2].toUpperCase() as JlptLevel;
  const packNum = m[3].padStart(2, '0');
  const pack = `${type}-${level.toLowerCase()}-pack${packNum}`;
  return {
    pack,
    type,
    level,
    title: `${TYPE_LABELS[type]} ${level} · Pack ${packNum}`,
    tags: [type, level.toLowerCase(), pack],
  };
}
```

- [ ] **Step 4: Implement CSV parser**

Create `src/lib/import-export/manual-csv.ts`:

```ts
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

  if (hasAnyNo) assertSequential(rows.map((r) => r.no));
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
```

- [ ] **Step 5: Run tests to verify GREEN**

Run:

```powershell
pnpm --dir companion-app test:import-export
```

Expected: PASS.

- [ ] **Step 6: Commit parser**

Run:

```powershell
git -C companion-app add src/lib/import-export
git -C companion-app commit -m "feat: add manual csv import parser"
```

---

### Task 4: Manual Import Service

**Files:**
- Modify: `companion-app/src/lib/import-export/__tests__/import-export.test.ts`
- Create: `companion-app/src/lib/import-export/manual-import.ts`
- Modify: `companion-app/src/lib/download-store.ts`

- [ ] **Step 1: Write failing import report tests**

Append to `import-export.test.ts`:

```ts
import JSZip from 'jszip';
import { parseManualImportFiles } from '../manual-import';

describe('parseManualImportFiles', () => {
  it('imports valid CSV files and reports invalid files', async () => {
    const good = new File(['T,D,P,E\n猫,แมว,ねこ,note'], 'vocab-n5-pack99.csv', { type: 'text/csv' });
    const bad = new File(['A,B\n1,2'], 'bad.csv', { type: 'text/csv' });
    const result = await parseManualImportFiles([good, bad], new Set());
    expect(result.ready).toHaveLength(1);
    expect(result.ready[0].deck.id).toBe('vocab-n5-pack99');
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
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
pnpm --dir companion-app test:import-export
```

Expected: FAIL because `manual-import.ts` does not exist.

- [ ] **Step 3: Implement parse-only import service**

Create `src/lib/import-export/manual-import.ts`:

```ts
import JSZip from 'jszip';
import type { CsvRow } from '@/data/types';
import { DECKS_IMPORTED_EVENT } from '@/lib/deck-import';
import { saveLibraryDecks, saveLibraryEntries, type LibraryDeckRecord, type LibraryEntriesRecord } from '@/lib/download-store';
import { parseLibraryCsvFilename } from './filename';
import { parseManualCsv } from './manual-csv';

export type ParsedManualDeck = {
  deck: LibraryDeckRecord;
  entries: LibraryEntriesRecord;
};

export type ManualImportIssue = {
  fileName: string;
  reason: string;
};

export type ManualImportParseResult = {
  ready: ParsedManualDeck[];
  failed: ManualImportIssue[];
  skipped: ManualImportIssue[];
};

export async function parseManualImportFiles(
  files: readonly File[],
  embeddedFreeDeckIds: ReadonlySet<string>,
): Promise<ManualImportParseResult> {
  const ready: ParsedManualDeck[] = [];
  const failed: ManualImportIssue[] = [];
  const skipped: ManualImportIssue[] = [];
  const importedAt = Date.now();

  for (const file of files) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.zip')) {
      await parseZipFile(file, embeddedFreeDeckIds, importedAt, ready, failed, skipped);
    } else if (lower.endsWith('.csv')) {
      await parseCsvFile(file.name, await file.text(), embeddedFreeDeckIds, importedAt, ready, failed, skipped);
    } else {
      failed.push({ fileName: file.name, reason: 'Unsupported file type' });
    }
  }

  return { ready, failed, skipped };
}

async function parseZipFile(
  file: File,
  embeddedFreeDeckIds: ReadonlySet<string>,
  importedAt: number,
  ready: ParsedManualDeck[],
  failed: ManualImportIssue[],
  skipped: ManualImportIssue[],
): Promise<void> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const csvFiles = Object.values(zip.files).filter((entry) => !entry.dir && entry.name.toLowerCase().endsWith('.csv'));
  if (csvFiles.length === 0) {
    failed.push({ fileName: file.name, reason: 'ZIP has no CSV files' });
    return;
  }
  for (const entry of csvFiles) {
    await parseCsvFile(entry.name, await entry.async('string'), embeddedFreeDeckIds, importedAt, ready, failed, skipped);
  }
}

async function parseCsvFile(
  fileName: string,
  text: string,
  embeddedFreeDeckIds: ReadonlySet<string>,
  importedAt: number,
  ready: ParsedManualDeck[],
  failed: ManualImportIssue[],
  skipped: ManualImportIssue[],
): Promise<void> {
  try {
    const meta = parseLibraryCsvFilename(fileName);
    if (!meta) throw new Error('Unknown filename pattern');
    if (embeddedFreeDeckIds.has(meta.pack)) {
      skipped.push({ fileName, reason: 'Already included in free Library' });
      return;
    }
    const rows: CsvRow[] = parseManualCsv(text);
    const deck: LibraryDeckRecord = {
      id: meta.pack,
      type: meta.type,
      level: meta.level,
      title: meta.title,
      entryCount: rows.length,
      isFree: false,
      source: 'manual',
      pack: meta.pack,
      tags: meta.tags,
      importedAt,
    };
    ready.push({ deck, entries: { pack: meta.pack, source: 'manual', rows } });
  } catch (error) {
    failed.push({ fileName, reason: error instanceof Error ? error.message : 'Import failed' });
  }
}

export async function saveManualImport(parsed: ManualImportParseResult): Promise<void> {
  if (parsed.ready.length === 0) return;
  await saveLibraryDecks(parsed.ready.map((item) => item.deck));
  await saveLibraryEntries(parsed.ready.map((item) => item.entries));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DECKS_IMPORTED_EVENT, { detail: { source: 'manual' } }));
  }
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```powershell
pnpm --dir companion-app test:import-export
```

Expected: PASS.

- [ ] **Step 5: Commit import service**

Run:

```powershell
git -C companion-app add src/lib/import-export/manual-import.ts src/lib/import-export/__tests__/import-export.test.ts src/lib/download-store.ts
git -C companion-app commit -m "feat: add manual import service"
```

---

### Task 5: Export Serializer And Export Service

**Files:**
- Modify: `companion-app/src/lib/import-export/__tests__/import-export.test.ts`
- Create: `companion-app/src/lib/import-export/export-csv.ts`
- Create: `companion-app/src/lib/import-export/export-library.ts`

- [ ] **Step 1: Write failing export tests**

Append to `import-export.test.ts`:

```ts
import { serializeDeckCsv } from '../export-csv';
import { selectExportableDecks } from '../export-library';

describe('export csv', () => {
  it('writes NO,T,D,P,E in order', () => {
    const csv = serializeDeckCsv([
      { no: 7, t: '猫', d: 'แมว', p: 'ねこ', e: 'note' },
    ]);
    expect(csv.split(/\r?\n/)[0]).toBe('NO,T,D,P,E');
    expect(csv).toContain('7,猫,แมว,ねこ,note');
  });

  it('selects only ready Library decks', () => {
    const decks = [
      { id: 'free', isFree: true, source: 'free' },
      { id: 'paid', isFree: false, source: 'entitlement' },
      { id: 'manual', isFree: false, source: 'manual' },
      { id: 'locked', isFree: false },
    ] as any[];
    expect(selectExportableDecks(decks).map((d) => d.id)).toEqual(['free', 'paid', 'manual']);
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
pnpm --dir companion-app test:import-export
```

Expected: FAIL because export modules do not exist.

- [ ] **Step 3: Implement CSV serializer**

Create `src/lib/import-export/export-csv.ts`:

```ts
import Papa from 'papaparse';
import type { CsvRow } from '@/data/types';

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
```

- [ ] **Step 4: Implement export helpers**

Create `src/lib/import-export/export-library.ts`:

```ts
import JSZip from 'jszip';
import type { Deck } from '@/data/types';
import { entriesForDeckAsync } from '@/hooks/use-decks';
import { serializeDeckCsv } from './export-csv';

export function selectExportableDecks(decks: readonly Deck[]): Deck[] {
  return decks.filter((deck) => deck.source === 'free' || deck.source === 'entitlement' || deck.source === 'manual');
}

export async function buildDeckCsv(deck: Deck): Promise<{ fileName: string; csv: string }> {
  const rows = await entriesForDeckAsync(deck.id);
  return { fileName: `${deck.id}.csv`, csv: serializeDeckCsv(rows) };
}

export async function buildDeckZip(decks: readonly Deck[]): Promise<Blob> {
  const zip = new JSZip();
  for (const deck of decks) {
    const { fileName, csv } = await buildDeckCsv(deck);
    zip.file(fileName, csv);
  }
  return zip.generateAsync({ type: 'blob' });
}

export function downloadBlob(blob: Blob, fileName: string): void {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```

- [ ] **Step 5: Run tests to verify GREEN**

Run:

```powershell
pnpm --dir companion-app test:import-export
```

Expected: PASS.

- [ ] **Step 6: Commit export service**

Run:

```powershell
git -C companion-app add src/lib/import-export/export-csv.ts src/lib/import-export/export-library.ts src/lib/import-export/__tests__/import-export.test.ts
git -C companion-app commit -m "feat: add library export helpers"
```

---

### Task 6: Browse Library Action Modal

**Files:**
- Create: `companion-app/src/components/library-actions-modal.tsx`
- Modify: `companion-app/src/app/(tabs)/index.tsx`

- [ ] **Step 1: Create modal component**

Create `src/components/library-actions-modal.tsx` with this interface:

```ts
type LibraryActionsModalProps = {
  visible: boolean;
  decks: Deck[];
  onClose: () => void;
  onImported: () => void;
};
```

The component should:

- use `parseManualImportFiles()` and `saveManualImport()` for import actions;
- build `embeddedFreeDeckIds` from `decks.filter((d) => d.source === 'free')`;
- ask `window.confirm()` before saving if parsed manual import contains ids already present in non-free Local Library;
- use `selectExportableDecks()` for export options;
- use `buildDeckCsv()` + `downloadBlob()` for one-deck export;
- use `buildDeckZip()` + `downloadBlob()` for batch export;
- show concise Thai status copy for imported, skipped, and failed counts.

Use these command labels:

```ts
const ACTIONS = {
  importOne: 'Import one file',
  importBatch: 'Batch import',
  exportOne: 'Export one deck',
  exportBatch: 'Batch export',
} as const;
```

- [ ] **Step 2: Add web file picker helper**

Inside the modal component, use a web-only helper:

```ts
async function pickFiles(accept: string, multiple: boolean): Promise<File[]> {
  if (typeof document === 'undefined') return [];
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.click();
  });
}
```

- [ ] **Step 3: Wire modal from Browse**

In `src/app/(tabs)/index.tsx`, add state:

```ts
const [libraryActionsOpen, setLibraryActionsOpen] = useState(false);
const { decks, refresh } = useAllDecks();
```

Add a compact action button near `Toolbar`:

```tsx
<ScaleButton
  onPress={() => setLibraryActionsOpen(true)}
  accessibilityLabel="เปิด Import / Export"
  style={[styles.toolBtn, { borderColor: colors.border }]}>
  <View style={styles.toolBtnContent}>
    <ThemedText type="small" style={{ color: Accent.base }}>+</ThemedText>
    <ThemedText type="small" themeColor="textSecondary">Library</ThemedText>
  </View>
</ScaleButton>
```

Mount:

```tsx
<LibraryActionsModal
  visible={libraryActionsOpen}
  decks={decks}
  onClose={() => setLibraryActionsOpen(false)}
  onImported={refresh}
/>
```

- [ ] **Step 4: Fix Browse badges**

In `DeckRow`, replace the `OWNED` badge condition:

```tsx
{deck.source === 'entitlement' && (
  <View style={[styles.badge, { backgroundColor: Accent.bg }]}>
    <ThemedText type="small" style={{ color: Accent.base }}>OWNED</ThemedText>
  </View>
)}
{deck.source === 'manual' && (
  <View style={[styles.badge, { backgroundColor: Accent.bg }]}>
    <ThemedText type="small" style={{ color: Accent.base }}>IMPORT</ThemedText>
  </View>
)}
```

- [ ] **Step 5: Run import/export logic tests**

Run:

```powershell
pnpm --dir companion-app test:import-export
```

Expected: PASS.

- [ ] **Step 6: Commit Browse UI**

Run:

```powershell
git -C companion-app add src/components/library-actions-modal.tsx src/app/(tabs)/index.tsx
git -C companion-app commit -m "feat: add browse library import export actions"
```

---

### Task 7: Settings Help Copy

**Files:**
- Modify: `companion-app/src/app/(tabs)/settings.tsx`

- [ ] **Step 1: Add help section**

In `SettingsScreen`, add a section after `การ์ด` or before `ความเป็นส่วนตัว`:

```tsx
<View style={styles.section}>
  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
    วิธีใช้ Import / Export
  </ThemedText>
  <ImportExportHelp />
</View>
```

Add component:

```tsx
function ImportExportHelp() {
  return (
    <ThemedView type="backgroundElement" style={styles.aboutCard}>
      <ThemedText type="defaultSemiBold">Library backup</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Import ใช้กับ CSV/ZIP รูปแบบ NO,T,D,P,E หรือ T,D,P,E แล้วเพิ่มเข้าเครื่องนี้
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Export ทำได้เฉพาะ deck ที่พร้อมเรียนใน Library แล้ว ไม่ดึง content ที่ยังล็อกอยู่
      </ThemedText>
      <ThemedText type="small" themeColor="textHint">
        Content ที่ import เองยังไม่ sync ข้ามเครื่อง ควร export เก็บไว้ก่อนล้างข้อมูล browser
      </ThemedText>
    </ThemedView>
  );
}
```

- [ ] **Step 2: Run quick syntax check**

Run:

```powershell
pnpm --dir companion-app test:import-export
```

Expected: PASS. This does not compile the Settings UI, so also run a browser smoke in Task 8.

- [ ] **Step 3: Commit help copy**

Run:

```powershell
git -C companion-app add src/app/(tabs)/settings.tsx
git -C companion-app commit -m "docs: add import export help copy"
```

---

### Task 8: Browser Flow Smoke

**Files:**
- Create: `companion-app/tools/import-export-flow-smoke.mjs`

- [ ] **Step 1: Create smoke script**

Create `tools/import-export-flow-smoke.mjs` that:

- accepts target URL from `APP_URL` or defaults to `http://localhost:8097`;
- opens Browse;
- clicks the Library action button;
- verifies modal/action labels exist;
- uploads one temp CSV via the file picker;
- verifies imported deck appears in Browse;
- navigates to Search and searches a unique imported term;
- opens imported deck hub, Memorize, and Quiz;
- triggers one CSV export and one ZIP export, checking download filenames.

Use a temp CSV named `vocab-n5-pack99.csv` with:

```csv
T,D,P,E
輸入テスト,ทดสอบนำเข้า,ゆにゅうてすと,### Import smoke
```

- [ ] **Step 2: Run local dev server**

Run:

```powershell
pnpm --dir companion-app dev -- --port 8097
```

Expected: Expo web serves the app at `http://localhost:8097`. If another server uses the port, choose the next free port and set `APP_URL`.

- [ ] **Step 3: Run smoke**

Run in a second terminal:

```powershell
$env:APP_URL='http://localhost:8097'; pnpm --dir companion-app smoke:import-export
```

Expected: PASS with no console errors and downloads observed for `.csv` and `.zip`.

- [ ] **Step 4: Commit smoke script**

Run:

```powershell
git -C companion-app add tools/import-export-flow-smoke.mjs package.json
git -C companion-app commit -m "test: add import export browser smoke"
```

---

### Task 9: Perf Guardrail And Final Verification

**Files:**
- Possibly modify: `companion-app/docs/superpowers/specs/2026-06-02-import-export-design.md` only if implementation intentionally differs.
- Possibly modify: `PRODUCT-ROADMAP.md` only to mark Import / Batch Import done after verification.

- [ ] **Step 1: Run logic tests**

Run:

```powershell
pnpm --dir companion-app test:import-export
```

Expected: PASS.

- [ ] **Step 2: Run Settings restore smoke**

Run:

```powershell
node companion-app/tools/settings-restore-smoke.mjs
```

Expected: signed-in Settings smoke passes; Import / Export help copy appears if the script is extended to check it.

- [ ] **Step 3: Run full-corpus guardrail**

Run:

```powershell
$env:APP_URL='https://app.nihon-bunkai.com'; node companion-app/tools/app-perf-testing-only/full-corpus-browser-smoke.mjs
```

Expected: Browse/Search/Deck Hub/Memorize/Quiz still pass with full-corpus seeded IndexedDB. If testing local pre-deploy, set `APP_URL` to the local dev server instead.

- [ ] **Step 4: Review production data boundary**

Run:

```powershell
rg -n "content/_csv-output|app-perf-testing-only|full-corpus-browser-smoke" companion-app/src companion-app/package.json
```

Expected: no runtime `src/` imports of parent `content/_csv-output` or perf-only full-corpus tooling.

- [ ] **Step 5: Update roadmap**

In `PRODUCT-ROADMAP.md`, mark P1.2 Import / Batch Import as completed only after browser smoke passes. Do not mark P2.1 Export complete unless one-deck and batch export browser smoke pass too.

- [ ] **Step 6: Final commit**

Run:

```powershell
git -C companion-app status --short
git -C companion-app log --oneline -5
```

Expected: only intentional files changed before the final commit. Commit with:

```powershell
git -C companion-app add .
git -C companion-app commit -m "feat: add library import export flow"
```

If all changes were already committed task-by-task, skip the final commit and report the commit hashes.

---

## Self-Review

- Spec coverage: parser, optional `NO`, strict sequence validation, ZIP/multi-file import, source boundary, Browse placement, Settings help, export CSV/ZIP, locked-content exclusion, and perf guardrail are covered.
- Placeholder scan: no `TBD` or ambiguous “handle later” steps remain.
- Risk: adding Vitest is a dev-only dependency; if dependency install is rejected, replace Task 1 with a Node-only smoke harness after confirming a TypeScript runner strategy.
- Risk: export one deck needs a deck selector. MVP may initially export the first selected/first exportable deck from the modal; if the UI needs a proper picker, keep it inside `library-actions-modal.tsx` without redesigning Browse.

<!-- cspell:enable -->
