import JSZip from 'jszip';

import type { Deck } from '../../data/types';

import { serializeGuardedDeckCsv } from './export-csv';

export function selectExportableDecks(decks: readonly Deck[]): Deck[] {
  return decks.filter(
    (deck) => deck.source === 'free' || deck.source === 'entitlement' || deck.source === 'manual',
  );
}

export async function buildDeckCsv(deck: Deck): Promise<{ fileName: string; csv: string }> {
  const { entriesForDeckSourceAsync } = await import('../../hooks/use-decks');
  const rows = await entriesForDeckSourceAsync(deck.id);
  const source = deck.source === 'manual' || deck.source === 'custom' ? deck.source : 'official';
  return { fileName: `${deck.id}.csv`, csv: serializeGuardedDeckCsv(rows, { deckId: deck.id, source }) };
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
