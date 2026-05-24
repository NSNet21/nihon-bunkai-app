/**
 * IndexedDB cache for downloaded paid content.
 *
 * Two tables:
 *   - zips     : raw zip blobs (download cache, used for save-to-device)
 *   - decks    : parsed Deck metadata (drives Browse merge)
 *   - entries  : parsed CsvRow entries, indexed by deck pack id
 *
 * Web-only — Dexie skips IndexedDB calls on native (web-first MVP).
 */

import Dexie, { type Table } from 'dexie';

import type { CsvRow, Deck } from '@/data/types';

export type DownloadedZip = {
  /** Filename in storage (also primary key). */
  name: string;
  /** SKU that granted this download (for re-download UI). */
  skuId: string;
  /** Raw zip bytes (Blob preferred for browser). */
  blob: Blob;
  /** Size in bytes (for display). */
  sizeBytes: number;
  /** When downloaded (epoch ms). */
  downloadedAt: number;
};

export type PaidDeckRecord = Deck & {
  /** SKU that granted this deck. */
  skuId: string;
  importedAt: number;
};

export type PaidEntriesRecord = {
  /** Pack id (matches PaidDeckRecord.pack). */
  pack: string;
  skuId: string;
  rows: CsvRow[];
};

class DownloadDB extends Dexie {
  zips!: Table<DownloadedZip, string>;
  paidDecks!: Table<PaidDeckRecord, string>;
  paidEntries!: Table<PaidEntriesRecord, string>;

  constructor() {
    super('nihon-bunkai-downloads');
    this.version(1).stores({
      zips: '&name, skuId, downloadedAt',
    });
    this.version(2).stores({
      zips: '&name, skuId, downloadedAt',
      paidDecks: '&id, skuId, level, type',
      paidEntries: '&pack, skuId',
    });
  }
}

let db: DownloadDB | null = null;
function getDB(): DownloadDB | null {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return null;
  }
  if (!db) db = new DownloadDB();
  return db;
}

export async function saveZip(zip: DownloadedZip): Promise<void> {
  const d = getDB();
  if (!d) return;
  await d.zips.put(zip);
}

export async function getZip(name: string): Promise<DownloadedZip | undefined> {
  const d = getDB();
  if (!d) return undefined;
  return d.zips.get(name);
}

export async function listZipsForSku(skuId: string): Promise<DownloadedZip[]> {
  const d = getDB();
  if (!d) return [];
  return d.zips.where('skuId').equals(skuId).toArray();
}

export async function hasAllZipsForSku(
  skuId: string,
  expectedZipNames: readonly string[],
): Promise<boolean> {
  const d = getDB();
  if (!d) return false;
  const present = await d.zips
    .where('name')
    .anyOf([...expectedZipNames])
    .count();
  return present === expectedZipNames.length;
}

export async function deleteZipsForSku(skuId: string): Promise<void> {
  const d = getDB();
  if (!d) return;
  await d.zips.where('skuId').equals(skuId).delete();
}

export async function totalCachedSize(): Promise<number> {
  const d = getDB();
  if (!d) return 0;
  const all = await d.zips.toArray();
  return all.reduce((s, z) => s + z.sizeBytes, 0);
}

// ─── Paid deck helpers ───────────────────────────────────────────────────

export async function savePaidDecks(decks: PaidDeckRecord[]): Promise<void> {
  const d = getDB();
  if (!d || decks.length === 0) return;
  await d.paidDecks.bulkPut(decks);
}

export async function savePaidEntries(records: PaidEntriesRecord[]): Promise<void> {
  const d = getDB();
  if (!d || records.length === 0) return;
  await d.paidEntries.bulkPut(records);
}

export async function listPaidDecks(): Promise<PaidDeckRecord[]> {
  const d = getDB();
  if (!d) return [];
  return d.paidDecks.toArray();
}

export async function getPaidEntries(pack: string): Promise<CsvRow[] | undefined> {
  const d = getDB();
  if (!d) return undefined;
  const rec = await d.paidEntries.get(pack);
  return rec?.rows;
}

export async function deletePaidContentForSku(skuId: string): Promise<void> {
  const d = getDB();
  if (!d) return;
  await Promise.all([
    d.paidDecks.where('skuId').equals(skuId).delete(),
    d.paidEntries.where('skuId').equals(skuId).delete(),
  ]);
}

/**
 * Trigger browser "Save As" for a cached zip. Web-only.
 * No-op on native / if blob is missing.
 */
export async function saveZipToDevice(zipName: string): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const zip = await getZip(zipName);
  if (!zip) return false;
  const url = URL.createObjectURL(zip.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke so the browser can read the URL before GC
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

