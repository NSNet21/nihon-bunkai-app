import { describe, expect, it } from 'vitest';
import { Rating } from 'ts-fsrs';

import { buildRatingCounts, ratingFromCorrectness } from './study-session-results';

describe('study session result helpers', () => {
  it('maps a correct answer to Good', () => {
    expect(ratingFromCorrectness(true)).toBe(Rating.Good);
  });

  it('maps a wrong answer to Again', () => {
    expect(ratingFromCorrectness(false)).toBe(Rating.Again);
  });

  it('builds rating counts for strict correctness modes', () => {
    expect(buildRatingCounts([Rating.Good, Rating.Again, Rating.Good], 5)).toEqual({
      againCount: 1,
      hardCount: 0,
      goodCount: 2,
      easyCount: 0,
      skippedCount: 2,
    });
  });

  it('does not allow skipped count to go below zero', () => {
    expect(buildRatingCounts([Rating.Good, Rating.Good], 1).skippedCount).toBe(0);
  });
});
