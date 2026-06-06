<!-- cspell:disable -->

# MC / Dictation FSRS v1 Design

Date: 2026-06-06  
Status: approved design direction, not yet implemented  
Decision: Option 1 strict mapping

## Goal

Multiple Choice and Dictation should become real Learn modes that write progress into the same local-first FSRS/session system as Quiz Card.

Today they only track screen-local correctness (`correctCount`). After this slice, completing MC or Dictation should produce card states, session logs, streak updates, and sync queue entries without changing the visible flow much.

## Locked V1 Rule

Use a strict correctness-to-FSRS mapping:

- Correct answer -> `Rating.Good`
- Wrong answer -> `Rating.Again`

Do not add partial credit, post-answer rating buttons, or mode-specific rating nuance in v1.

## Current Code Shape

Quiz Card (`src/app/deck/[deckId]/quiz.tsx`) already does the full runtime-state path:

- lazily creates `sessionIdRef` and `sessionStartedAtRef` on first rating
- per card: `makeEntryId()` -> `getCardState()` -> `scheduleCard()` -> `putCardState()`
- if signed in: `schedulePush(user.id)`
- on completion: `putSessionLog()`
- on completion: update `getStreakMeta()` / `putStreakMeta()`
- after completion writes: schedule one more push

Multiple Choice (`src/app/deck/[deckId]/multiple-choice.tsx`) currently:

- builds session entries with `buildStudySessionEntries()`
- grades first attempt with `gradeMultipleChoiceAttempt()`
- increments `correctCount`
- does not persist FSRS/session/streak

Dictation (`src/app/deck/[deckId]/dictation.tsx`) currently:

- builds session entries with `buildStudySessionEntries()`
- checks submit with `checkDictationAnswer()`
- increments `correctCount`
- does not persist FSRS/session/streak

## Proposed Implementation

Create a shared helper, likely `src/lib/study-session-results.ts`, so Quiz Card, MC, and Dictation do not duplicate session bookkeeping forever.

Suggested helpers:

- `ratingFromCorrectness(correct: boolean): Rating`
- `buildRatingCounts(ratings: Rating[], totalCards: number)`
- `applyStudyModeRating({ deckId, entryNo, rating, userId? })`
- `recordCompletedStudySession({ sessionId, deck, entries, results, startedAt, userId? })`

The exact function names can change during implementation, but the boundary should stay:

- per-card FSRS write is one helper
- completion session/streak write is one helper
- UI routes keep only mode-specific correctness logic

## Multiple Choice Flow

On the first selected choice:

1. Grade with existing `gradeMultipleChoiceAttempt(choice, question.correct)`.
2. Convert correctness to rating:
   - correct -> `Rating.Good`
   - wrong -> `Rating.Again`
3. Lazily create session id/start time if this is the first answered card.
4. Persist FSRS card state for the current entry.
5. Append the rating to `results`.
6. Keep existing feedback UI and `correctCount`.

On completion:

1. Record a session log with `ratings: results`.
2. Use existing aggregate fields:
   - `goodCount` for correct answers
   - `againCount` for wrong answers
   - `hardCount = 0`
   - `easyCount = 0`
   - `skippedCount = entries.length - results.length`
3. Update streak meta.
4. Schedule sync push when signed in.

On restart:

- reset `sessionIdRef`
- reset `sessionStartedAtRef`
- reset `results`
- reset `correctCount`, `attempt`, and `index`

## Dictation Flow

On first submit:

1. Check with existing `checkDictationAnswer(answer, expectedAnswer)`.
2. Convert correctness to rating:
   - correct -> `Rating.Good`
   - wrong -> `Rating.Again`
3. Lazily create session id/start time if this is the first submitted card.
4. Persist FSRS card state for the current entry.
5. Append the rating to `results`.
6. Keep existing feedback UI and `correctCount`.

On completion and restart:

- same as Multiple Choice.

## Non-goals

Do not include in v1:

- user-chosen `ลืม / ยาก / เข้าใจ / ง่าย` after MC/Dictation answers
- Dictation correct -> `Rating.Easy`
- typo tolerance beyond the existing dictation answer checker
- dashboard/stat UI changes
- interval preview chips in MC/Dictation
- SRS review queue UI
- changing Quiz Card behavior

## Risks

- Duplicate session/streak logic can drift if copied into three route files. Prefer extracting helpers.
- MC/Dictation can call answer handlers multiple times if not guarded. Persist only on the first attempt/submit per card.
- Restart must reset session identity, or a restarted session can write a mixed session log.
- Completion effect must run once per completed session, not on every re-render.
- Sync push should stay coalesced and should not spam for every route re-render.

## Test Plan

Unit tests:

- `ratingFromCorrectness(true)` returns `Rating.Good`.
- `ratingFromCorrectness(false)` returns `Rating.Again`.
- rating count helper maps correct/wrong results to `goodCount` and `againCount`.
- skipped count is based on total cards minus ratings length.

Route/browser smoke:

- Multiple Choice first answer writes a card state and completes without console errors.
- Multiple Choice wrong answer maps to `Again`.
- Dictation correct submit maps to `Good`.
- Dictation wrong submit maps to `Again`.
- Completing MC/Dictation writes one session log and updates streak.
- Restart begins a fresh session identity.

Regression:

- `pnpm vitest run`
- existing MC and Dictation smoke if present; otherwise add targeted Playwright smoke for the two modes.
- `pnpm smoke:term-card http://localhost:8097/deck/kanji-n5-pack02/term/kanji-n5-pack02-23`
- `pnpm smoke:shuffle-session http://localhost:8097`

## Implementation Order

1. Add pure helper tests for correctness-to-rating and rating counts.
2. Add helper implementation.
3. Refactor Quiz Card only if needed to prove helper shape; otherwise leave it unchanged in v1 to reduce blast radius.
4. Wire Multiple Choice per-answer FSRS write and completion session/streak.
5. Wire Dictation per-submit FSRS write and completion session/streak.
6. Add route smoke coverage for MC and Dictation completion.
7. Run focused regression.

<!-- cspell:enable -->
