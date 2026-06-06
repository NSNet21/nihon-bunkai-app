import { describe, expect, it } from 'vitest';

import type { CardStateRow, SessionLogRow, StreakMetaRow } from './srs-store';
import { buildDeckProgressSummary, dueEntryNosFromCardStates } from './deck-progress';

const NOW = 1_800_000;

function card(entryId: string, deckId: string, due: number): CardStateRow {
  return {
    entryId,
    deckId,
    due,
    stability: 1,
    difficulty: 1,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 1,
    lapses: 0,
    state: 2,
    lastReview: NOW - 1_000,
    updatedAt: NOW - 500,
  };
}

function session(sessionId: string, deckId: string, startedAt: number, goodCount: number, againCount = 0): SessionLogRow {
  return {
    sessionId,
    deckId,
    deckTitle: deckId,
    totalCards: 5,
    startedAt,
    endedAt: startedAt + 60_000,
    ratings: [],
    againCount,
    hardCount: 0,
    goodCount,
    easyCount: 0,
    skippedCount: Math.max(0, 5 - goodCount - againCount),
    updatedAt: startedAt + 60_000,
  };
}

function streak(currentStreak: number): StreakMetaRow {
  return {
    id: 'streak',
    currentStreak,
    longestStreak: currentStreak,
    lastStudiedDate: '2026-06-06',
    totalSessions: currentStreak,
    totalCardsStudied: currentStreak * 5,
    updatedAt: NOW,
  };
}

describe('deck progress summary', () => {
  it('returns quiet empty values for a deck without local progress', () => {
    expect(buildDeckProgressSummary('deck-a', { cardStates: [], sessionLogs: [], streakMeta: streak(0), now: NOW })).toEqual({
      deckId: 'deck-a',
      touchedCount: 0,
      dueCount: 0,
      sessionCount: 0,
      latestSessionAt: null,
      latestSessionScore: null,
      streakCount: null,
    });
  });

  it('counts touched and due cards for the requested deck only', () => {
    const summary = buildDeckProgressSummary('deck-a', {
      cardStates: [
        card('deck-a::1', 'deck-a', NOW - 1),
        card('deck-a::2', 'deck-a', NOW + 1),
        card('deck-b::1', 'deck-b', NOW - 1),
      ],
      sessionLogs: [],
      streakMeta: streak(0),
      now: NOW,
    });

    expect(summary.touchedCount).toBe(2);
    expect(summary.dueCount).toBe(1);
  });

  it('counts sessions and uses the newest startedAt for latest session', () => {
    const summary = buildDeckProgressSummary('deck-a', {
      cardStates: [],
      sessionLogs: [
        session('old', 'deck-a', NOW - 30_000, 2),
        session('other', 'deck-b', NOW - 10_000, 5),
        session('new', 'deck-a', NOW - 5_000, 4, 1),
      ],
      streakMeta: streak(3),
      now: NOW,
    });

    expect(summary.sessionCount).toBe(2);
    expect(summary.latestSessionAt).toBe(NOW - 5_000);
    expect(summary.latestSessionScore).toBe(0.8);
    expect(summary.streakCount).toBe(3);
  });

  it('extracts due entry numbers for the requested deck only', () => {
    expect(dueEntryNosFromCardStates('deck-a', [
      card('deck-a::1', 'deck-a', NOW - 1),
      card('deck-a::2', 'deck-a', NOW + 1),
      card('deck-b::3', 'deck-b', NOW - 1),
    ], NOW)).toEqual([1]);
  });

  it('ignores malformed due row ids', () => {
    expect(dueEntryNosFromCardStates('deck-a', [
      card('deck-a::not-a-number', 'deck-a', NOW - 1),
      card('wrong-shape', 'deck-a', NOW - 1),
      card('deck-a::4', 'deck-a', NOW - 1),
    ], NOW)).toEqual([4]);
  });
});
