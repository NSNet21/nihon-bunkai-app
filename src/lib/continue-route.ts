import type { LastSession } from './last-session';

export type ContinueMode = 'quiz' | 'learn';

export function continueRouteHref(lastSession: LastSession, mode: ContinueMode) {
  const entryId = encodeURIComponent(lastSession.entryId);
  if (mode === 'learn') {
    return `/deck/${lastSession.deckId}/term/${entryId}?from=continue`;
  }
  return `/deck/${lastSession.deckId}/quiz?entryId=${entryId}&from=continue`;
}

export function continueModeBadge(mode: ContinueMode) {
  return mode === 'learn' ? 'LEARN' : 'FLASHCARD';
}
