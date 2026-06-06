import { type Grade, Rating } from 'ts-fsrs';

import type { Deck } from '@/data/types';

import { scheduleCard } from './srs-scheduler';
import {
  getCardState,
  getStreakMeta,
  makeEntryId,
  putCardState,
  putSessionLog,
  putStreakMeta,
  todayLocalDate,
} from './srs-store';
import { schedulePush } from './srs-sync';

export type RatingCounts = {
  againCount: number;
  hardCount: number;
  goodCount: number;
  easyCount: number;
  skippedCount: number;
};

export function ratingFromCorrectness(correct: boolean): Rating {
  return correct ? Rating.Good : Rating.Again;
}

export function buildRatingCounts(ratings: Rating[], totalCards: number): RatingCounts {
  return {
    againCount: ratings.filter((r) => r === Rating.Again).length,
    hardCount: ratings.filter((r) => r === Rating.Hard).length,
    goodCount: ratings.filter((r) => r === Rating.Good).length,
    easyCount: ratings.filter((r) => r === Rating.Easy).length,
    skippedCount: Math.max(0, totalCards - ratings.length),
  };
}

export async function applyStudyModeRating({
  deckId,
  entryNo,
  rating,
  userId,
}: {
  deckId: string;
  entryNo: number;
  rating: Rating;
  userId?: string;
}): Promise<void> {
  const entryId = makeEntryId(deckId, entryNo);
  const existing = await getCardState(entryId);
  const next = scheduleCard(existing, rating as Grade, entryId, deckId);
  await putCardState(next);
  if (userId) schedulePush(userId);
}

export async function recordCompletedStudySession({
  sessionId,
  deck,
  totalCards,
  ratings,
  startedAt,
  userId,
}: {
  sessionId: string;
  deck: Deck;
  totalCards: number;
  ratings: Rating[];
  startedAt: number;
  userId?: string;
}): Promise<void> {
  const endedAt = Date.now();
  const counts = buildRatingCounts(ratings, totalCards);

  await putSessionLog({
    sessionId,
    deckId: deck.id,
    deckTitle: deck.title,
    totalCards,
    startedAt,
    endedAt,
    ratings,
    ...counts,
  });

  const today = todayLocalDate();
  const meta = await getStreakMeta();
  let nextCurrent = meta.currentStreak;
  if (meta.lastStudiedDate !== today) {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yesterday = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
    nextCurrent = meta.lastStudiedDate === yesterday ? meta.currentStreak + 1 : 1;
  }

  await putStreakMeta({
    currentStreak: nextCurrent,
    longestStreak: Math.max(meta.longestStreak, nextCurrent),
    lastStudiedDate: today,
    totalSessions: meta.totalSessions + 1,
    totalCardsStudied: meta.totalCardsStudied + ratings.length,
  });

  if (userId) schedulePush(userId);
}
