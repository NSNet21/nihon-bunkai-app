import { describe, expect, it } from 'vitest';

import {
  LIBRARY_SORT_SETTLE_DURATION_MS,
  LIBRARY_SORT_SETTLE_OFFSET_X,
  getLibrarySortSettleMotion,
} from './library-sort-motion';

describe('library sort settle motion', () => {
  it('plays only after a real sort revision change while the library is visible', () => {
    expect(
      getLibrarySortSettleMotion({
        previousRevision: 'default-asc',
        nextRevision: 'date-desc',
        libraryVisible: true,
        reducedMotion: false,
      }),
    ).toEqual({
      enabled: true,
      offsetX: LIBRARY_SORT_SETTLE_OFFSET_X,
      durationMs: LIBRARY_SORT_SETTLE_DURATION_MS,
    });
  });

  it('does not play on initial render, hidden library, same revision, or reduced motion', () => {
    const disabled = { enabled: false, offsetX: 0, durationMs: 0 };

    expect(
      getLibrarySortSettleMotion({
        previousRevision: null,
        nextRevision: 'date-desc',
        libraryVisible: true,
        reducedMotion: false,
      }),
    ).toEqual(disabled);
    expect(
      getLibrarySortSettleMotion({
        previousRevision: 'default-asc',
        nextRevision: 'date-desc',
        libraryVisible: false,
        reducedMotion: false,
      }),
    ).toEqual(disabled);
    expect(
      getLibrarySortSettleMotion({
        previousRevision: 'date-desc',
        nextRevision: 'date-desc',
        libraryVisible: true,
        reducedMotion: false,
      }),
    ).toEqual(disabled);
    expect(
      getLibrarySortSettleMotion({
        previousRevision: 'default-asc',
        nextRevision: 'date-desc',
        libraryVisible: true,
        reducedMotion: true,
      }),
    ).toEqual(disabled);
  });
});
