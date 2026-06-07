<!-- cspell:disable -->

# Library Sort Controls v1.1 Design

Date: 2026-06-07
Surface: Companion App / Browse Library
Status: approved for implementation

## Intent

Polish the Browse Library sort controls added in v1 without opening Grid view or a broader Browse redesign.

This pass should make the sort controls feel intentional, closer to the user's reference layout, and more responsive on mobile.

## Goals

- Move sort controls into a right-side toolbar cluster on tablet/desktop.
- Keep mobile compact with icon-only sort/direction/reset controls.
- Add ascending/descending direction for non-default sort modes.
- Keep active sort controls visually quiet, without crimson active backgrounds.
- Make the sort menu float over the Library content instead of pushing rows down.
- Add a light deck/list reveal animation when sort changes.

## Non-goals

- No Grid view in this pass.
- No changes to Browse hierarchy, Library Search, import/export, deck management, or study routes.
- No manual persisted deck reorder.
- No new Review/progress sort.
- No card flip / flashcard animation changes.

## Controls

Sort state has two parts:

- `mode`: `default`, `name`, or `terms`
- `direction`: `asc` or `desc`

Behavior:

- `default` ignores direction and uses the existing official/user hierarchy order.
- `name + asc`: title A-Z / numeric pack order.
- `name + desc`: reverse title order.
- `terms + desc`: high entry count first.
- `terms + asc`: low entry count first.
- Reset returns to `default + asc`.

## Responsive Layout

Desktop/tablet:

- Existing Library actions stay on the left: scope, expand, collapse, Library actions.
- Sort controls sit on the right: sort menu trigger, direction toggle, reset.
- The toolbar may wrap on medium widths, but the sort cluster should remain visually grouped.

Mobile:

- Sort cluster uses icon-only buttons to reduce crowding.
- Buttons must keep accessibility labels for screen readers and web inspection.
- Controls can wrap, but the page must keep horizontal overflow at `0`.

## Floating Menu

The sort menu should float above Library rows instead of reserving vertical space.

Implementation must avoid the v1 bug where an absolute menu was visible but not clickable because Browse rows intercepted pointer events. Use a top-level overlay layer near the Browse screen root, with click-outside-to-close behavior, rather than a plain absolute child under the toolbar.

The menu should clamp horizontally so it does not leave the viewport on mobile.

## Animation

When sort mode or direction changes:

- Animate the Library row area lightly.
- Use a short slide/fade, roughly 120-180ms.
- Prefer `translateX` from the right by a small distance, around 10-14px.
- Keep the effect quiet and avoid stagger-heavy motion.
- Do not animate Continue cards or route-level content.

## Verification

- Unit tests for sort direction behavior.
- Full Vitest run.
- Local Browse visual checks at mobile, tablet, and desktop viewports:
  - sort cluster responsive placement,
  - icon-only mobile controls,
  - floating menu clickability,
  - asc/desc behavior,
  - reset behavior,
  - animation does not create layout shift or horizontal overflow,
  - deck navigation still opens Deck Preview,
  - console errors remain `0`.

## Deferred

Grid view is deferred until after the current 7-day tool usage window pressure passes and after higher-priority app features, such as Local User Data Backup / Restore MVP, have room.

<!-- cspell:enable -->
