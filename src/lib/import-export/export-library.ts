import JSZip from 'jszip';

import type { Deck } from '../../data/types';

import { serializeDeckCsv } from './export-csv';

export function selectExportableDecks(decks: readonly Deck[]): Deck[] {
  return decks.filter(
    (deck) => deck.source === 'free' || deck.source === 'entitlement' || deck.source === 'manual',
  );
}

export async function buildDeckCsv(deck: Deck): Promise<{ fileName: string; csv: string }> {
  const { entriesForDeckAsync } = await import('../../hooks/use-decks');
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
