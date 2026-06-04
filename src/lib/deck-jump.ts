import type { Entry } from '@/data/types';

export type DeckJumpRowState = {
  isCurrent: boolean;
  disabled: boolean;
  meta: string;
};

export type DeckJumpResult =
  | { ok: true; href: string; entryId: string }
  | { ok: false; reason: string };

export function getDeckJumpRowState(deckId: string, currentDeckId?: string | null): DeckJumpRowState {
  const isCurrent = Boolean(currentDeckId) && deckId === currentDeckId;
  return {
    isCurrent,
    disabled: isCurrent,
    meta: isCurrent ? 'กำลังดูอยู่' : 'เปิด term แรก',
  };
}

export function resolveFirstEntryJump(deckId: string, entries: readonly Entry[]): DeckJumpResult {
  const firstEntry = entries[0];
  if (!firstEntry) {
    return { ok: false, reason: 'ยังไม่มีคำใน deck นี้' };
  }
  return {
    ok: true,
    href: `/deck/${deckId}/term/${firstEntry.id}`,
    entryId: firstEntry.id,
  };
}
