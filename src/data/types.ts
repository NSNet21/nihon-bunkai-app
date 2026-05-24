/**
 * Entry schema — MUST match the 5-column CSV that customers buy/import/export.
 * Single source of truth across PDF, CSV, App, Anki/Onevoca.
 * Reference: [[csv-export-schema]] memory · content/_csv-output/*.csv
 */

export type JlptLevel = 'N1' | 'N2' | 'N3' | 'N4' | 'N5';
export type ContentType = 'vocab' | 'grammar' | 'kanji' | 'glossary';

/** Core CSV row — exactly the 5 columns shipped to customers. */
export interface CsvRow {
  no: number;
  t: string;   // Japanese term
  d: string;   // Thai meaning (concise)
  p: string;   // Pronunciation (hiragana / romaji)
  e: string;   // Extended markdown (sections / examples / notes)
}

/** App entry = CSV row + minimal metadata for navigation / filtering. */
export interface Entry extends CsvRow {
  id: string;            // e.g. "vocab-n5-1"  (synthesized from type+level+no)
  type: ContentType;
  level: JlptLevel | null;
}

export interface Deck {
  id: string;            // e.g. "vocab-n5"
  type: ContentType;
  level: JlptLevel | null;
  title: string;         // display name e.g. "Vocab · N5"
  entryCount: number;
  isFree: boolean;       // included in Model C-refined free tier
}
