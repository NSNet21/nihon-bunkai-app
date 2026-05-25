/**
 * Snapshot of the user's most-recent study position — persisted via
 * usePersistedState('last-session') and read by the Browse Continue CTA.
 *
 * Stores `entryId` (stable across content updates) so resume jumps to the
 * exact card even if the deck has been reordered or has new vols. The
 * Study screen's existing `?entryId=` route param does the actual seek.
 */
export type LastSession = {
  deckId: string;
  deckTitle: string;
  entryId: string;
  index: number;
  total: number;
  updatedAt: number;
};
