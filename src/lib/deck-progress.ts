import {
  getCardStatesForDeck,
  getSessionLogsForDeck,
  getStreakMeta,
  type CardStateRow,
  type SessionLogRow,
  type StreakMetaRow,
} from './srs-store';

export type DeckProgressSummary = {
  deckId: string;
  touchedCount: number;
  dueCount: number;
  sessionCount: number;
  latestSessionAt: number | null;
  latestSessionScore: number | null;
  streakCount: number | null;
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
    dueCount: deckCards.filter((row) => row.due <= now).length,
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

function getSessionScore(session: SessionLogRow): number | null {
  const answered = session.againCount + session.hardCount + session.goodCount + session.easyCount;
  if (answered <= 0) return null;
  return (session.hardCount + session.goodCount + session.easyCount) / answered;
}
