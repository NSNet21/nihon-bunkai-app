import {
  getAllSessionLogs,
  getCardStatesForDeck,
  getDueCardStates,
  getSessionLogsForDeck,
  getStreakMeta,
  type CardStateRow,
  type SessionLogRow,
  type StreakMetaRow,
} from './srs-store';
import type { Deck } from '@/data/types';

export type DeckProgressSummary = {
  deckId: string;
  touchedCount: number;
  dueCount: number;
  sessionCount: number;
  latestSessionAt: number | null;
  latestSessionScore: number | null;
  streakCount: number | null;
};

export type DeckReviewCandidate = {
  deckId: string;
  deckTitle: string;
  dueCount: number;
  latestSessionAt: number | null;
};

type DeckProgressInput = {
  cardStates: CardStateRow[];
  sessionLogs: SessionLogRow[];
  streakMeta: StreakMetaRow;
  now?: number;
};

export function buildDeckProgressSummary(deckId: string, input: DeckProgressInput): DeckProgressSummary {
  const now = input.now ?? Date.now();
  const deckCards = input.cardStates.filter((row) => row.deckId === deckId);
  const deckSessions = input.sessionLogs
    .filter((row) => row.deckId === deckId)
    .sort((a, b) => b.startedAt - a.startedAt);
  const latestSession = deckSessions[0] ?? null;

  return {
    deckId,
    touchedCount: deckCards.length,
    dueCount: dueEntryNosFromCardStates(deckId, deckCards, now).length,
    sessionCount: deckSessions.length,
    latestSessionAt: latestSession?.startedAt ?? null,
    latestSessionScore: latestSession ? getSessionScore(latestSession) : null,
    streakCount: input.streakMeta.currentStreak > 0 ? input.streakMeta.currentStreak : null,
  };
}

export async function getDeckProgressSummary(deckId: string, now = Date.now()): Promise<DeckProgressSummary> {
  const [cardStates, sessionLogs, streakMeta] = await Promise.all([
    getCardStatesForDeck(deckId),
    getSessionLogsForDeck(deckId),
    getStreakMeta(),
  ]);

  return buildDeckProgressSummary(deckId, { cardStates, sessionLogs, streakMeta, now });
}

export function dueEntryNosFromCardStates(deckId: string, cardStates: CardStateRow[], now = Date.now()): number[] {
  return cardStates
    .filter((row) => row.deckId === deckId && row.due <= now)
    .map((row) => entryNoFromSrsEntryId(deckId, row.entryId))
    .filter((no): no is number => typeof no === 'number')
    .sort((a, b) => a - b);
}

export async function getDueEntryNosForDeck(deckId: string, now = Date.now()): Promise<number[]> {
  const cardStates = await getCardStatesForDeck(deckId);
  return dueEntryNosFromCardStates(deckId, cardStates, now);
}

export async function getDeckReviewCandidate(decks: Deck[], now = Date.now()): Promise<DeckReviewCandidate | null> {
  const [dueCards, sessionLogs] = await Promise.all([
    getDueCardStates(now),
    getAllSessionLogs(),
  ]);
  return buildDeckReviewCandidate(decks, dueCards, sessionLogs, now);
}

export function buildDeckReviewCandidate(
  decks: Deck[],
  cardStates: CardStateRow[],
  sessionLogs: SessionLogRow[],
  now = Date.now(),
): DeckReviewCandidate | null {
  const deckOrder = new Map(decks.map((deck, index) => [deck.id, index]));
  const latestSessionByDeck = new Map<string, number>();

  for (const session of sessionLogs) {
    const current = latestSessionByDeck.get(session.deckId);
    if (current === undefined || session.startedAt > current) {
      latestSessionByDeck.set(session.deckId, session.startedAt);
    }
  }

  const candidates = decks
    .map((deck) => {
      const dueCount = dueEntryNosFromCardStates(deck.id, cardStates, now).length;
      if (dueCount <= 0) return null;
      return {
        deckId: deck.id,
        deckTitle: deck.title,
        dueCount,
        latestSessionAt: latestSessionByDeck.get(deck.id) ?? null,
      };
    })
    .filter((candidate): candidate is DeckReviewCandidate => Boolean(candidate));

  candidates.sort((a, b) => {
    const aHasSession = a.latestSessionAt !== null;
    const bHasSession = b.latestSessionAt !== null;
    if (aHasSession !== bHasSession) return aHasSession ? -1 : 1;
    if (a.latestSessionAt !== null && b.latestSessionAt !== null && a.latestSessionAt !== b.latestSessionAt) {
      return b.latestSessionAt - a.latestSessionAt;
    }
    if (a.dueCount !== b.dueCount) return b.dueCount - a.dueCount;
    return (deckOrder.get(a.deckId) ?? Number.MAX_SAFE_INTEGER) - (deckOrder.get(b.deckId) ?? Number.MAX_SAFE_INTEGER);
  });

  return candidates[0] ?? null;
}

function getSessionScore(session: SessionLogRow): number | null {
  const answered = session.againCount + session.hardCount + session.goodCount + session.easyCount;
  if (answered <= 0) return null;
  return (session.hardCount + session.goodCount + session.easyCount) / answered;
}

function entryNoFromSrsEntryId(deckId: string, entryId: string): number | null {
  const prefix = `${deckId}::`;
  if (!entryId.startsWith(prefix)) return null;
  const rawNo = entryId.slice(prefix.length);
  const no = Number(rawNo);
  return Number.isInteger(no) && no > 0 ? no : null;
}
