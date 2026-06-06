<!-- cspell:disable -->

# Deck Progress v1 Design

Date: 2026-06-06  
Status: approved design direction, not yet implemented  
Decision: deck-level progress first

## Goal

Show a small, useful progress summary for the current deck so learners can tell whether they have studied it before, how much local SRS state exists, and whether anything is due for review.

This is intentionally not an Overall Progress dashboard. V1 should make the existing Deck Preview feel more alive after Quiz Card, Multiple Choice, or Dictation sessions write progress data.

## Scope

Build Deck-level Progress v1 on Deck Preview / Deck Term List.

Show:

- latest session for this deck
- total completed sessions for this deck
- touched cards for this deck, based on local `cardStates`
- due cards for this deck, based on local `cardStates.due <= now`
- optional global streak copy if `streakMeta` has meaningful data

Do not include:

- all-deck dashboard
- per-level dashboard
- charts or graph-heavy UI
- review queue UX
- new SRS scheduling rules
- changing Quiz Card, Multiple Choice, or Dictation writes
- Supabase/user-content sync changes

## User-Facing Placement

Place a compact editorial progress block on Deck Preview, near the deck hero and before the term list. The learner should see it before choosing a Learn mode, but it should not push the term list too far down.

Recommended copy posture:

- Thai-first.
- Use Progress language, not ownership language.
- Avoid calling FSRS a mode.
- Empty state should be quiet: this deck simply has no local learning history yet.

Example labels:

- `ความคืบหน้า`
- `เรียนล่าสุด`
- `รอบเรียน`
- `แตะแล้ว`
- `รอทบทวน`

## Data Source

Use local SRS stores only:

- `cardStates` for per-card state, due time, and touched count.
- `sessionLogs` for deck session history and latest session.
- `streakMeta` for optional global streak context.

Official source entries, user content, and personal edits are not mutated by this feature.

## Proposed Helper

Add a focused helper, likely `src/lib/deck-progress.ts`.

Suggested shape:

```ts
type DeckProgressSummary = {
  deckId: string;
  touchedCount: number;
  dueCount: number;
  sessionCount: number;
  latestSessionAt: number | null;
  latestSessionScore: number | null;
  streakCount: number | null;
};

async function getDeckProgressSummary(deckId: string, now = Date.now()): Promise<DeckProgressSummary>;
```

The exact names can change during implementation, but the boundary should stay:

- one helper reads local stores
- one helper returns a small UI-ready summary
- route UI does not query Dexie tables directly

## Calculation Rules

Touched count:

- Count `cardStates` rows for the deck.
- This means "cards that have any local SRS state", not "all cards in the deck".

Due count:

- Count `cardStates` rows for the deck where `due <= now`.
- Include learning/relearning/review states if they have due timestamps.

Session count:

- Count completed `sessionLogs` rows with matching `deckId`.

Latest session:

- Use the highest `startedAt` session for that deck.
- Show a compact relative or date label in UI.

Latest session score:

- Derived from session log counts when available.
- Prefer a simple positive ratio for display only; do not feed it back into FSRS.

Streak:

- Streak is global learner activity context.
- Show only if available and non-zero.
- Do not let global streak dominate deck-level progress.

## UI States

### Empty

No sessions and no card states:

- Show a quiet one-line state like `ยังไม่มีประวัติรอบเรียนใน deck นี้`.
- Keep the block small.

### Partial

Some card states or sessions exist:

- Show touched, due, sessions, and latest session if present.
- Missing values should not render as noisy placeholders.

### Active Review

`dueCount > 0`:

- Let `รอทบทวน` be the strongest signal inside the block.
- Do not create a Review button in v1 unless the existing route already supports a safe review entry point.

## Error Handling

If Dexie/local storage read fails:

- Do not block Deck Preview.
- Log a concise warning in development if the existing app pattern does so.
- Render the progress block as unavailable or omit it.

## Testing

Unit tests:

- empty deck progress returns zeros/nulls
- touched count counts local card states for the deck only
- due count counts only due rows for the deck
- session count filters by deck
- latest session uses newest `startedAt`
- score display value is derived from session counts without mutating SRS data

Browser smoke:

- Deck Preview loads with no console errors
- Progress empty state does not create horizontal overflow
- After a study-mode smoke writes progress, Deck Preview shows non-empty progress for that deck

Regression:

- `pnpm vitest run`
- `pnpm smoke:deck-route http://localhost:8097`
- `pnpm smoke:study-mode-fsrs http://localhost:8097`

## Watch-outs

- Do not make Overall Progress a hidden requirement of this slice.
- Do not call FSRS a user-facing mode.
- Do not mix ownership/import state with learner progress.
- Preserve Browse/Search performance assumptions.
- Keep this route-level feature small enough that future Review Queue UI can build on it without rewriting it.

<!-- cspell:enable -->
