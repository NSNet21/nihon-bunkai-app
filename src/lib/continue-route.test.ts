import { describe, expect, it } from 'vitest';

import {
  continueModeBadge,
  continueRouteHref,
  getBrowseLibraryRevealState,
  reviewContinueRouteHref,
  shouldShowFlashcardContinue,
} from './continue-route';
import type { LastSession } from './last-session';

const session: LastSession = {
  deckId: 'kanji-n5-pack02',
  deckTitle: 'Kanji N5 · Pack 02',
  entryId: 'kanji-n5-pack02-21',
  index: 2,
  total: 20,
  updatedAt: 1,
};

describe('continueRouteHref', () => {
  it('routes Learn continue to Term Preview instead of legacy Memorize', () => {
    expect(continueRouteHref(session, 'learn')).toBe('/deck/kanji-n5-pack02/term/kanji-n5-pack02-21?from=continue');
  });

  it('routes Flashcard continue to the existing quiz card session', () => {
    expect(continueRouteHref(session, 'quiz')).toBe('/deck/kanji-n5-pack02/quiz?entryId=kanji-n5-pack02-21&from=continue');
  });
});

describe('reviewContinueRouteHref', () => {
  it('marks due review entry from Browse as a Continue-origin route', () => {
    expect(reviewContinueRouteHref('kanji-n5-pack02')).toBe(
      '/deck/kanji-n5-pack02/quiz?review=due&from=continue',
    );
  });
});

describe('continueModeBadge', () => {
  it('labels quiz-card continuation as Flashcard instead of old Quiz wording', () => {
    expect(continueModeBadge('quiz')).toBe('FLASHCARD');
  });

  it('keeps Learn continue as the term preview resume entry', () => {
    expect(continueModeBadge('learn')).toBe('LEARN');
  });
});

describe('shouldShowFlashcardContinue', () => {
  it('shows Flashcard Continue when no due Review card is competing for the same cluster', () => {
    expect(
      shouldShowFlashcardContinue({
        hasFlashcardSession: true,
        hasReviewCandidate: false,
      }),
    ).toBe(true);
  });

  it('hides Flashcard Continue when Review Continue is available', () => {
    expect(
      shouldShowFlashcardContinue({
        hasFlashcardSession: true,
        hasReviewCandidate: true,
      }),
    ).toBe(false);
  });

  it('stays hidden when there is no Flashcard session', () => {
    expect(
      shouldShowFlashcardContinue({
        hasFlashcardSession: false,
        hasReviewCandidate: true,
      }),
    ).toBe(false);
  });
});

describe('getBrowseLibraryRevealState', () => {
  it('keeps library pending until Continue readiness has resolved', () => {
    expect(getBrowseLibraryRevealState({ continueReady: false, hasContinue: false })).toEqual({
      showLibrary: false,
      prioritizeContinue: false,
      pendingLibrary: false,
      motion: 'none',
    });
  });

  it('reveals library immediately when Continue is ready and absent', () => {
    expect(getBrowseLibraryRevealState({ continueReady: true, hasContinue: false })).toEqual({
      showLibrary: true,
      prioritizeContinue: false,
      pendingLibrary: false,
      motion: 'direct',
    });
  });

  it('reveals library in the same frame when Continue exists', () => {
    expect(getBrowseLibraryRevealState({ continueReady: true, hasContinue: true, continueSettled: false })).toEqual({
      showLibrary: true,
      prioritizeContinue: false,
      pendingLibrary: false,
      motion: 'direct',
    });
  });

  it('does not delay library after Continue has settled because the sections reveal together', () => {
    expect(getBrowseLibraryRevealState({ continueReady: true, hasContinue: true, continueSettled: true })).toEqual({
      showLibrary: true,
      prioritizeContinue: false,
      pendingLibrary: false,
      motion: 'direct',
    });
  });
});
