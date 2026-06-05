import JSZip from 'jszip';

import type { CsvRow } from '../../data/types';
import { DECKS_IMPORTED_EVENT } from '../deck-import';
import {
  saveLibraryDecks,
  saveLibraryEntries,
  type LibraryDeckRecord,
  type LibraryEntriesRecord,
} from '../download-store';

import { buildManualCsvFallbackMeta, parseLibraryCsvFilename } from './filename';
import { parseManualCsv } from './manual-csv';
import { applyDeckOrganization, type DeckOrganization } from '../user-content';

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
  organization?: DeckOrganization,
): Promise<ManualImportParseResult> {
  const ready: ParsedManualDeck[] = [];
  const failed: ManualImportIssue[] = [];
  const skipped: ManualImportIssue[] = [];
  const importedAt = Date.now();

  for (const file of files) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.zip')) {
      await parseZipFile(file, embeddedFreeDeckIds, importedAt, ready, failed, skipped, organization);
    } else if (lower.endsWith('.csv')) {
      await parseCsvFile(file.name, await file.text(), embeddedFreeDeckIds, importedAt, ready, failed, skipped, organization);
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
  organization?: DeckOrganization,
): Promise<void> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const csvFiles = Object.values(zip.files).filter(
    (entry) => !entry.dir && entry.name.toLowerCase().endsWith('.csv'),
  );
  if (csvFiles.length === 0) {
    failed.push({ fileName: file.name, reason: 'ZIP has no CSV files' });
    return;
  }
  for (const entry of csvFiles) {
    await parseCsvFile(entry.name, await entry.async('string'), embeddedFreeDeckIds, importedAt, ready, failed, skipped, organization);
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
  organization?: DeckOrganization,
): Promise<void> {
  try {
    const meta = parseLibraryCsvFilename(fileName) ?? buildManualCsvFallbackMeta(fileName);
    if (embeddedFreeDeckIds.has(meta.pack)) {
      skipped.push({ fileName, reason: 'Already included in free Library' });
      return;
    }

    const rows: CsvRow[] = parseManualCsv(text);
    const deck: LibraryDeckRecord = applyImportOrganization({
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
    }, organization);
    ready.push({ deck, entries: { pack: meta.pack, source: 'manual', rows } });
  } catch (error) {
    failed.push({ fileName, reason: error instanceof Error ? error.message : 'Import failed' });
  }
}

function applyImportOrganization(deck: LibraryDeckRecord, organization?: DeckOrganization): LibraryDeckRecord {
  const hasOrganization = Boolean(organization?.group?.trim() || organization?.section?.trim());
  return hasOrganization ? applyDeckOrganization(deck, organization ?? {}) : deck;
}

export async function saveManualImport(parsed: ManualImportParseResult): Promise<void> {
  if (parsed.ready.length === 0) return;
  await saveLibraryDecks(parsed.ready.map((item) => item.deck));
  await saveLibraryEntries(parsed.ready.map((item) => item.entries));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DECKS_IMPORTED_EVENT, { detail: { source: 'manual' } }));
  }
}
