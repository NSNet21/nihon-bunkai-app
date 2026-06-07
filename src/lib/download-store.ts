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
import type { EntryOverrideRecord } from './personal-overrides';

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

export type LibraryDeckRecord = Deck & {
  source: 'entitlement' | 'manual' | 'custom';
  /** SKU that granted this deck, only for entitlement-backed content. */
  skuId?: string;
  importedAt: number;
};

export type LibraryEntriesRecord = {
  /** Pack id (matches PaidDeckRecord.pack). */
  pack: string;
  source: 'entitlement' | 'manual' | 'custom';
  skuId?: string;
  rows: CsvRow[];
};

export type PaidDeckRecord = LibraryDeckRecord;
export type PaidEntriesRecord = LibraryEntriesRecord;

class DownloadDB extends Dexie {
  zips!: Table<DownloadedZip, string>;
  paidDecks!: Table<LibraryDeckRecord, string>;
  paidEntries!: Table<LibraryEntriesRecord, string>;
  entryOverrides!: Table<EntryOverrideRecord, string>;

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
    this.version(3).stores({
      zips: '&name, skuId, downloadedAt',
      paidDecks: '&id, source, skuId, level, type',
      paidEntries: '&pack, source, skuId',
    });
    this.version(4).stores({
      zips: '&name, skuId, downloadedAt',
      paidDecks: '&id, source, skuId, level, type',
      paidEntries: '&pack, source, skuId',
      entryOverrides: '&id, deckId, pack, updatedAt',
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

export async function saveLibraryDecks(decks: LibraryDeckRecord[]): Promise<void> {
  const d = getDB();
  if (!d || decks.length === 0) return;
  const existingRows = await d.paidDecks.where('id').anyOf(decks.map((deck) => deck.id)).toArray();
  const existingById = new Map(existingRows.map((deck) => [deck.id, deck]));
  await d.paidDecks.bulkPut(decks.map((deck) => withLibraryDeckTimestamps(existingById.get(deck.id), deck)));
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

export async function getLibraryDeck(deckId: string): Promise<LibraryDeckRecord | undefined> {
  const d = getDB();
  if (!d) return undefined;
  return d.paidDecks.get(deckId);
}

export async function putLibraryDeck(deck: LibraryDeckRecord): Promise<void> {
  const d = getDB();
  if (!d) return;
  const existing = await d.paidDecks.get(deck.id);
  await d.paidDecks.put(withLibraryDeckTimestamps(existing, deck));
}

export async function getLibraryEntries(pack: string): Promise<CsvRow[] | undefined> {
  const d = getDB();
  if (!d) return undefined;
  const rec = await d.paidEntries.get(pack);
  return rec?.rows;
}

export async function getLibraryEntriesRecord(pack: string): Promise<LibraryEntriesRecord | undefined> {
  const d = getDB();
  if (!d) return undefined;
  return d.paidEntries.get(pack);
}

export async function putLibraryEntriesRecord(record: LibraryEntriesRecord): Promise<void> {
  const d = getDB();
  if (!d) return;
  await d.paidEntries.put(record);
}

export async function putEntryOverride(record: EntryOverrideRecord): Promise<void> {
  const d = getDB();
  if (!d) return;
  await d.entryOverrides.put(record);
}

export async function listEntryOverridesForDeck(deckId: string): Promise<EntryOverrideRecord[]> {
  const d = getDB();
  if (!d) return [];
  return d.entryOverrides.where('deckId').equals(deckId).toArray();
}

export async function deleteEntryOverride(deckId: string, no: number): Promise<boolean> {
  const d = getDB();
  if (!d) return false;
  const id = `${deckId}::${no}`;
  const existing = await d.entryOverrides.get(id);
  if (!existing) return false;
  await d.entryOverrides.delete(id);
  return true;
}

export async function deleteLibraryDeckAndEntries(deckId: string): Promise<boolean> {
  const d = getDB();
  if (!d) return false;
  const deck = await d.paidDecks.get(deckId);
  if (!deck) return false;
  await Promise.all([
    d.paidDecks.delete(deckId),
    d.paidEntries.delete(deck.pack),
  ]);
  return true;
}

export async function deleteManualLibraryDeck(deckId: string): Promise<boolean> {
  const d = getDB();
  if (!d) return false;
  const deck = await d.paidDecks.get(deckId);
  if (!deck || deck.source !== 'manual') return false;
  await Promise.all([
    d.paidDecks.delete(deckId),
    d.paidEntries.delete(deck.pack),
  ]);
  return true;
}

export const savePaidDecks = saveLibraryDecks;
export const savePaidEntries = saveLibraryEntries;
export const listPaidDecks = listLibraryDecks;
export const getPaidEntries = getLibraryEntries;

export function withLibraryDeckTimestamps(
  existing: LibraryDeckRecord | undefined,
  incoming: LibraryDeckRecord,
  now = Date.now(),
): LibraryDeckRecord {
  const firstSeen = existing?.createdAt
    ?? incoming.createdAt
    ?? existing?.importedAt
    ?? incoming.importedAt
    ?? now;
  const latestSeen = incoming.updatedAt
    ?? incoming.importedAt
    ?? now;

  return {
    ...incoming,
    createdAt: firstSeen,
    updatedAt: latestSeen,
  };
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
