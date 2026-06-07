export const LIBRARY_SORT_SETTLE_OFFSET_X = 4;
export const LIBRARY_SORT_SETTLE_DURATION_MS = 100;

type LibrarySortSettleMotionInput = {
  previousRevision: string | null;
  nextRevision: string;
  libraryVisible: boolean;
  reducedMotion: boolean;
};

type LibrarySortSettleMotion = {
  enabled: boolean;
  offsetX: number;
  durationMs: number;
};

const DISABLED_MOTION: LibrarySortSettleMotion = {
  enabled: false,
  offsetX: 0,
  durationMs: 0,
};

export function getLibrarySortSettleMotion({
  previousRevision,
  nextRevision,
  libraryVisible,
  reducedMotion,
}: LibrarySortSettleMotionInput): LibrarySortSettleMotion {
  if (!previousRevision || !libraryVisible || reducedMotion || previousRevision === nextRevision) {
    return DISABLED_MOTION;
  }
  return {
    enabled: true,
    offsetX: LIBRARY_SORT_SETTLE_OFFSET_X,
    durationMs: LIBRARY_SORT_SETTLE_DURATION_MS,
  };
}
