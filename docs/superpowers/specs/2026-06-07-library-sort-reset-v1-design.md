<!-- cspell:disable -->

# Library Sort / Reset v1 Design

Date: 2026-06-07
Surface: Companion App / Browse Library
Status: user approved direction; ready for implementation plan after review

## Intent

Add a small Library utility pass before the larger backup/restore work.

The user originally asked about `List / Grid`, sort logic, and reset. For v1, the approved fast scope is option 3: add sorting and reset controls only. Grid view is deferred so this pass stays quick, low-risk, and does not turn into a Browse redesign.

## Goals

- Let learners reorder visible Library decks by useful logic.
- Add a reset action that returns Library ordering controls to the default.
- Keep Browse hierarchy, collapse behavior, Library Search, Continue reveal, and deck navigation intact.
- Preserve full-corpus performance assumptions by sorting deck metadata, not term rows.
- Keep the visual treatment restrained and editorial.

## Non-goals

- No grid view in v1.
- No broad Browse redesign.
- No change to storage/data model for decks or entries.
- No persisted manual reorder.
- No changes to Term Preview, Deck Preview, Quiz Card, Multiple Choice, Dictation, or card flip behavior.
- No automatic backup/restore work in this pass.

## User Experience

Add compact controls near the existing Library toolbar:

- `Sort` control with a small option menu.
- `Reset` control.

Initial sort options:

- `Default`: current official/user hierarchy order.
- `Name`: deck title A-Z.
- `Terms`: deck entry count, high to low.

If a review/progress sort can be wired cheaply without async flicker, add:

- `Review`: decks with due/recent progress first.

If review/progress data would require a new async staged load or noticeably more complexity, defer `Review` and ship the first three options.

`Reset` returns the sort mode to `Default`. It does not reset Library Search query, level/category collapse state, or scroll position in v1.

## Behavior

- Sorting applies to deck rows inside their existing group/category placement.
- Level headers and category headers keep the current hierarchy order.
- Collapse/expand state remains unchanged when sorting.
- Library Search keeps its existing result behavior unless implementation can reuse the same deck sort helper safely.
- The selected sort mode may be persisted locally with existing persisted-state patterns so the preference survives refresh.
- If persisted state is missing or invalid, fall back to `Default`.

## Responsive / Visual Rules

- Controls must wrap cleanly on mobile without horizontal overflow.
- On narrow screens, labels may shorten, but buttons must remain understandable.
- Use existing toolbar/button rhythm and crimson accent sparingly.
- Avoid shimmer, gradients, decorative cards, or a new visual system.
- Text must not clip inside controls on mobile/tablet/desktop.

## Implementation Shape

- Add a small typed helper for Library sort modes and deck comparison.
- Add focused tests for sort helper behavior.
- In Browse, sort the deck list before `buildBrowseRows`.
- Keep row rendering and `FlashList` virtualization intact.
- Keep callbacks stable where possible to avoid unnecessary list re-renders.

## Verification

Minimum checks:

- Unit tests for sort helper.
- Browse route smoke or targeted browser check on local preview.
- Mobile and desktop visual checks for:
  - toolbar wrapping,
  - sort menu/reset visibility,
  - no horizontal overflow,
  - deck navigation still opens Deck Preview,
  - console errors remain zero.

If the visual check spans several viewports, use a short-lived browser/sub-agent as an inspection worker. Main Codex keeps product decisions and code edits.

## Deferred Follow-up

Grid view can be reopened after this v1 lands. Recommended future scope:

- `List / Grid` view switch.
- Responsive deck cards only, keeping level/category headers.
- Tablet/desktop visual QA before shipping.

<!-- cspell:enable -->
