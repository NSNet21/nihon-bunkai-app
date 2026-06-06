import { describe, expect, it } from 'vitest';

import { continueModeBadge, continueRouteHref } from './continue-route';
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

describe('continueModeBadge', () => {
  it('labels quiz-card continuation as Flashcard instead of old Quiz wording', () => {
    expect(continueModeBadge('quiz')).toBe('FLASHCARD');
  });

  it('keeps Learn continue as the term preview resume entry', () => {
    expect(continueModeBadge('learn')).toBe('LEARN');
  });
});
