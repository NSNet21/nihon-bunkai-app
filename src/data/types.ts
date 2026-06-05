/**
 * Entry schema — MUST match the 5-column CSV that customers buy/import/export.
 * Single source of truth across PDF, CSV, and the Nihon Bunkai Companion App.
 * Reference: [[csv-export-schema]] memory · content/_csv-output/*.csv
 */

export type JlptLevel = 'N1' | 'N2' | 'N3' | 'N4' | 'N5';
export type ContentType = 'vocab' | 'grammar' | 'kanji' | 'glossary';
export type DeckSource = 'free' | 'entitlement' | 'manual' | 'custom';

/** Core CSV row — exactly the 5 columns shipped to customers. */
export interface CsvRow {
  no: number;
  t: string;   // Japanese term
  d: string;   // Thai meaning (concise)
  p: string;   // Pronunciation (hiragana / romaji)
  e: string;   // Extended markdown (sections / examples / notes)
}

/** App entry = CSV row + deck/pack metadata + tags. */
export interface Entry extends CsvRow {
  id: string;             // e.g. "vocab-n5-pack01-3"
  type: ContentType;
  level: JlptLevel | null;
  pack: string;           // e.g. "vocab-n5-pack01"
  tags: string[];         // ['vocab', 'n5', 'vocab-n5-pack01'] — for filter/search
}

export interface Deck {
  id: string;             // = pack id
  type: ContentType;
  level: JlptLevel | null;
  title: string;          // e.g. "Vocab N5 · Pack 01"
  entryCount: number;
  isFree: boolean;
  pack: string;
  tags: string[];
  source: DeckSource;
  userGroup?: string;
  userSection?: string;
  isUserContent?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

/** Shape of the build-generated free-tier.json. */
export interface FreeTierData {
  decks: Omit<Deck, 'isFree' | 'source'>[];
  entries: Record<string, CsvRow[]>;
}
