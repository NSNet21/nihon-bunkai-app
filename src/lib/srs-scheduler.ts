/**
 * FSRS scheduler wrapper — converts between ts-fsrs Card and our
 * persisted CardStateRow, schedules next review per user rating.
 *
 * FSRS = Free Spaced Repetition Scheduler — modern algorithm that
 * supersedes SM-2 (Anki classic). Adapts ease/interval per user.
 *
 * Usage:
 *   const row = await getCardState(entryId);   // undefined if new card
 *   const next = scheduleCard(row, Rating.Good, entryId, deckId);
 *   await putCardState(next);
 *   // → next.due is the timestamp this card should appear again
 */

import {
  type Card,
  createEmptyCard,
  type FSRS,
  fsrs,
  generatorParameters,
  type Grade,
} from 'ts-fsrs';

import type { CardStateRow } from './srs-store';

/* Singleton scheduler — fsrs() is mildly expensive (parameter blending),
   no reason to recreate per-call. enable_fuzz adds ±5% jitter to intervals
   so users don't see clumps of "due at exactly 9:00 every day". */
const params = generatorParameters({ enable_fuzz: true });
const scheduler: FSRS = fsrs(params);

/* ─── Convert helpers — Card ↔ CardStateRow ─────────────────────────── */

function cardToRow(card: Card, entryId: string, deckId: string): Omit<CardStateRow, 'updatedAt'> {
  return {
    entryId,
    deckId,
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as number,
    lastReview: card.last_review ? card.last_review.getTime() : null,
  };
}

function rowToCard(row: CardStateRow): Card {
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsedDays,
    scheduled_days: row.scheduledDays,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    last_review: row.lastReview ? new Date(row.lastReview) : undefined,
  } as Card;
}

/* ─── Public API ─────────────────────────────────────────────────────── */

/**
 * Schedule a card after the user rates it. Returns the new state to persist.
 * If `existing` is undefined (first time seeing this card), starts fresh.
 *
 * Pure function — does NOT touch the DB. Caller is responsible for
 * `putCardState(...)` after.
 */
export function scheduleCard(
  existing: CardStateRow | undefined,
  /* Grade = Rating except Rating.Manual. User-driven ratings are always
     Again/Hard/Good/Easy via the 4-button UI — Manual is for programmatic
     state edits we don't expose. */
  rating: Grade,
  entryId: string,
  deckId: string,
  now: Date = new Date(),
): Omit<CardStateRow, 'updatedAt'> {
  const card = existing ? rowToCard(existing) : createEmptyCard(now);
  const result = scheduler.next(card, now, rating);
  return cardToRow(result.card, entryId, deckId);
}
