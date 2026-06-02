/**
 * Deck import pipeline.
 *
 *   downloaded zip blob → unzip → parse CSV → Deck + Entry records → IndexedDB
 *
 * Filename convention (matches build script output):
 *   {category}/{category}-n{level}-pack{NN}.csv
 *   e.g. "kanji/kanji-n4-pack01.csv"
 *
 * Glossary zip is flat: glossary/glossary-pack01.csv (no level prefix).
 *
 * Emits a window event 'nb:decks-imported' on success so useDecks() can refresh.
 */

import JSZip from 'jszip';
import Papa from 'papaparse';

import type { CsvRow, ContentType, Deck, JlptLevel } from '@/data/types';
import {
  getZip,
  savePaidDecks,
  savePaidEntries,
  type PaidDeckRecord,
  type PaidEntriesRecord,
} from './download-store';

const PACK_REGEX = /^([a-z]+)\/(\w+)-(n[1-5]|glossary)-(?:pack|vol)(\d+)\.csv$/i;

const TYPE_LABELS: Record<ContentType, string> = {
  vocab: 'Vocab',
  grammar: 'Grammar',
  kanji: 'Kanji',
  glossary: 'Glossary',
};

export const DECKS_IMPORTED_EVENT = 'nb:decks-imported';

export type ImportResult = {
  skuId: string;
  decksImported: number;
  entriesImported: number;
};

/** Import every zip belonging to a SKU into IndexedDB deck/entry tables. */
export async function importZipsForSku(
  skuId: string,
  zipNames: readonly string[],
): Promise<ImportResult> {
  let decksImported = 0;
  let entriesImported = 0;

  for (const zipName of zipNames) {
    const cached = await getZip(zipName);
    if (!cached) continue;

    const { decks, entries } = await parseZip(cached.blob, skuId);
    if (decks.length === 0) continue;

    await savePaidDecks(decks);
    await savePaidEntries(entries);

    decksImported += decks.length;
    entriesImported += entries.reduce((s, e) => s + e.rows.length, 0);
  }

  if (typeof window !== 'undefined' && decksImported > 0) {
    window.dispatchEvent(new CustomEvent(DECKS_IMPORTED_EVENT, { detail: { skuId } }));
  }

  return { skuId, decksImported, entriesImported };
}

async function parseZip(
  blob: Blob,
  skuId: string,
): Promise<{ decks: PaidDeckRecord[]; entries: PaidEntriesRecord[] }> {
  const zip = await JSZip.loadAsync(blob);
  const decks: PaidDeckRecord[] = [];
  const entries: PaidEntriesRecord[] = [];
  const importedAt = Date.now();

  const files = Object.values(zip.files).filter((f) => !f.dir && f.name.endsWith('.csv'));

  for (const file of files) {
    const meta = parseFilename(file.name);
    if (!meta) continue;

    const csvText = await file.async('string');
    const rows = parseCsv(csvText);
    if (rows.length === 0) continue;

    const deck: PaidDeckRecord = {
      id: meta.pack,
      type: meta.type,
      level: meta.level,
      title: meta.title,
      entryCount: rows.length,
      isFree: false,
      source: 'entitlement',
      pack: meta.pack,
      tags: meta.tags,
      skuId,
      importedAt,
    };
    decks.push(deck);
    entries.push({ pack: meta.pack, source: 'entitlement', skuId, rows });
  }

  return { decks, entries };
}

type PackMeta = {
  pack: string;
  type: ContentType;
  level: JlptLevel | null;
  title: string;
  tags: string[];
};

function parseFilename(name: string): PackMeta | null {
  // Strip leading "./" if present
  const clean = name.replace(/^\.\//, '');
  const m = clean.match(PACK_REGEX);
  if (!m) return null;

  const [, , category, levelToken, packNum] = m;
  const type = category.toLowerCase() as ContentType;
  if (!isContentType(type)) return null;

  const levelUpper = levelToken.toUpperCase();
  const level = levelUpper === 'GLOSSARY' ? null : (levelUpper as JlptLevel);

  const packPadded = packNum.padStart(2, '0');
  // pack id matches existing free-tier convention: "kanji-n5-pack01"
  const pack = level === null
    ? `${type}-pack${packPadded}`
    : `${type}-${levelUpper.toLowerCase()}-pack${packPadded}`;

  const titleSegment = level === null ? 'GLOSSARY' : levelUpper;
  const title = `${TYPE_LABELS[type]} ${titleSegment} · Pack ${packPadded}`;

  const tags = [type, level ? level.toLowerCase() : 'glossary', pack];

  return { pack, type, level, title, tags };
}

function isContentType(v: string): v is ContentType {
  return v === 'vocab' || v === 'grammar' || v === 'kanji' || v === 'glossary';
}

function parseCsv(text: string): CsvRow[] {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  const rows: CsvRow[] = [];
  for (const r of parsed.data) {
    if (!r || typeof r !== 'object') continue;
    const noRaw = r.NO ?? r.no ?? '';
    const no = parseInt(String(noRaw), 10);
    if (Number.isNaN(no)) continue;

    rows.push({
      no,
      t: String(r.T ?? r.t ?? '').trim(),
      d: String(r.D ?? r.d ?? '').trim(),
      p: String(r.P ?? r.p ?? '').trim(),
      e: String(r.E ?? r.e ?? '').trim(),
    });
  }
  return rows;
}
