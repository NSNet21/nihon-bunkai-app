import type { LastSession } from './last-session';

export type ContinueMode = 'quiz' | 'learn';

export function continueRouteHref(lastSession: LastSession, mode: ContinueMode) {
  const entryId = encodeURIComponent(lastSession.entryId);
  if (mode === 'learn') {
    return `/deck/${lastSession.deckId}/term/${entryId}?from=continue`;
  }
  return `/deck/${lastSession.deckId}/quiz?entryId=${entryId}&from=continue`;
}

export function reviewContinueRouteHref(deckId: string) {
  return `/deck/${deckId}/quiz?review=due&from=continue`;
}

export function continueModeBadge(mode: ContinueMode) {
  return mode === 'learn' ? 'LEARN' : 'FLASHCARD';
}

export function shouldShowFlashcardContinue({
  hasFlashcardSession,
  hasReviewCandidate,
}: {
  hasFlashcardSession: boolean;
  hasReviewCandidate: boolean;
}) {
  return hasFlashcardSession && !hasReviewCandidate;
}

export type BrowseLibraryRevealState = {
  showLibrary: boolean;
  prioritizeContinue: boolean;
  pendingLibrary: boolean;
  motion: 'none' | 'direct' | 'after-continue';
};

export function getBrowseLibraryRevealState({
  continueReady,
  hasContinue: _hasContinue,
  continueSettled: _continueSettled = false,
}: {
  continueReady: boolean;
  hasContinue: boolean;
  continueSettled?: boolean;
}): BrowseLibraryRevealState {
  if (!continueReady) {
    return {
      showLibrary: false,
      prioritizeContinue: false,
      pendingLibrary: false,
      motion: 'none',
    };
  }

  return {
    showLibrary: true,
    prioritizeContinue: false,
    pendingLibrary: false,
    motion: 'direct',
  };
}
