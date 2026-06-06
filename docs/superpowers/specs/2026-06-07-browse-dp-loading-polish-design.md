<!-- cspell:disable -->

# Browse / Deck Preview Loading Polish Design

Date: 2026-06-07
Status: Approved design draft for review
Surface: Companion App

## Goal

Make Browse and Deck Preview feel like they render intentionally instead of assembling in visible async stages. The fix is scoped to loading/readiness behavior, reserved space, and very light section motion. This is not a broad UI redesign.

## Current Problem

Browse and Deck Preview read from several timing sources:

- embedded/free decks and IndexedDB library decks
- localStorage Continue sessions
- IndexedDB SRS progress and review candidates
- lazy deck entries

These sources can resolve in different frames. Even when the data is correct, the UI can feel like it flickers because Continue, progress, and list sections appear or swap at slightly different times.

## Browse Design

Browse keeps the page shell immediate:

- background, accent stripe, ghost kanji, safe area, and `// BROWSE` header render immediately
- Continue readiness remains gated by hydration, deck loading, and SRS review-candidate readiness
- once Continue readiness resolves, Browse uses a priority rule:
  - if Continue exists, show the Continue section first
  - after Continue is available, reveal the Library section as the next intentional step
  - if Continue does not exist, reveal the Library section immediately

The Library section includes the `คลังคำศัพท์` heading, toolbar, and deck/group rows. While a real Continue section is taking priority, Library may hold a quiet reserved pending area instead of jumping in at the same time.

No shimmer should be used. No row-by-row stagger should be added because that would reinforce the staged-render feeling.

## Deck Preview Design

Deck Preview keeps route-level behavior intact:

- if the deck route is still resolving or not found, keep the existing route-state handling
- once the deck is known, render Back and the deck hero normally
- Progress and Terms use reserved pending blocks while their async reads complete

Progress pending state should occupy the same visual block as the final progress card. Terms pending state should occupy the same lane as the final result/list area. The large centered spinner inside the content flow should be removed for this route unless the whole route itself is still loading.

## Motion

Motion is section-level and quiet:

- Continue: optional opacity + small upward movement, about 4-6 px, around 140-180 ms
- Library after Continue: opacity + small upward movement, about 6-8 px, around 160-220 ms
- Library when no Continue exists: immediate or shorter transition, with no artificial waiting
- DP pending replacement: content swaps inside the same reserved area with subtle opacity/translate only

Do not animate individual deck rows or term rows for this pass.

## Implementation Notes

Expected code areas:

- `src/app/(tabs)/index.tsx`
- `src/app/deck/[deckId]/index.tsx`
- optionally a small local helper/component for editorial pending blocks if it keeps duplication low

Browse should derive a small readiness state rather than scattering boolean checks through JSX. The important behavior is:

- `continueClusterReady = hasHydrated && !decksLoading && reviewCandidateReady`
- `hasContinue = showContinueLearn || showFlashcardContinue || showReviewContinue`
- Library can reveal when `continueClusterReady && !hasContinue`, or after the Continue-priority reveal path has run

Deck Preview should avoid rendering an empty progress text or a large spinner that changes the page rhythm. Use stable blocks with the existing border/background language.

## Testing / Verification

Run targeted checks after implementation:

- unit tests around any extracted readiness helper
- existing Continue/progress tests if touched
- `pnpm smoke:deck-route http://localhost:8097`
- `pnpm smoke:perf http://localhost:8097`
- mobile and desktop browser visual checks for Browse and Deck Preview

Visual checks should confirm:

- Browse with Continue shows Continue before Library
- Browse without Continue does not hold Library unnecessarily
- DP does not show a large in-content spinner after the hero is already visible
- no horizontal overflow
- no console errors
- known dev warnings remain acceptable if unchanged

## Non-goals

- no broad Browse redesign
- no global Review Queue
- no new deck-row due badges
- no changes to FSRS scheduling
- no changes to import/export, deck organization, or official/user content rules
- no full bilingual copy work

<!-- cspell:enable -->
