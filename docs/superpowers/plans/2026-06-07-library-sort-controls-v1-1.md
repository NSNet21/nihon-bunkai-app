<!-- cspell:disable -->

# Library Sort Controls v1.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish Browse Library sort controls with asc/desc, responsive right-side placement, floating menu, and a light sort-change animation.

**Architecture:** Extend the existing `library-sort` helper with a direction argument and keep sorting metadata-only. In Browse, split the toolbar into action and sort clusters, render the sort menu as a screen-level overlay so it floats above FlashList rows, and animate only the Library rows container on sort changes.

**Tech Stack:** Expo Router, React Native Web, TypeScript, Vitest, FlashList, Reanimated.

---

### Task 1: Extend Sort Helper With Direction

**Files:**
- Modify: `src/lib/library-sort.test.ts`
- Modify: `src/lib/library-sort.ts`

- [ ] Add failing tests for `asc` / `desc` direction on `name` and `terms`.
- [ ] Run `pnpm vitest run src/lib/library-sort.test.ts` and confirm failure.
- [ ] Add `LibrarySortDirection = 'asc' | 'desc'`.
- [ ] Update `sortLibraryDecks(decks, mode, direction)` so `default` ignores direction, `name` respects direction, and `terms` respects direction with title fallback.
- [ ] Run focused tests and commit.

### Task 2: Add Browse Sort State And Animation Trigger

**Files:**
- Modify: `src/app/(tabs)/index.tsx`

- [ ] Add persisted `library-sort-direction`, default `asc`.
- [ ] Pass mode and direction into `sortLibraryDecks`.
- [ ] Add a small Reanimated shared value that runs a 120-180ms translate/fade when sort mode or direction changes.
- [ ] Apply the animated style to row wrappers only, not the Continue/header area.
- [ ] Run focused tests and commit.

### Task 3: Rebuild Toolbar Layout And Floating Menu

**Files:**
- Modify: `src/app/(tabs)/index.tsx`

- [ ] Split toolbar into left action cluster and right sort cluster.
- [ ] Mobile sort cluster uses icon-only buttons.
- [ ] Tablet/desktop sort cluster uses icon + text.
- [ ] Remove crimson active backgrounds from sort controls.
- [ ] Render sort menu as an absolute overlay near the screen root, using measured button position and click-outside close.
- [ ] Clamp menu position on narrow screens.
- [ ] Add direction toggle and reset behavior.
- [ ] Run focused tests and commit.

### Task 4: Verify Responsive Behavior

**Files:**
- Modify if needed: `src/app/(tabs)/index.tsx`
- Modify if needed: `PRODUCT-ROADMAP.md`

- [ ] Run `pnpm vitest run`.
- [ ] Run `pnpm smoke:deck-route http://localhost:8097`.
- [ ] Run local Playwright checks at `390x844`, `768x1024`, and `1365x768`.
- [ ] Verify sort menu clickability, asc/desc, reset, no horizontal overflow, deck navigation, console errors `0`.
- [ ] Update roadmap with v1.1 status and Grid deferred.
- [ ] Push app and root repos, then verify remote hashes.

## Self-Review

- Spec coverage: placement, mobile icon-only controls, asc/desc, quiet active styling, floating menu, animation, Grid deferral, and verification are covered.
- Red-flag scan: no undefined future work is required to ship this v1.1.
- Type consistency: direction is introduced in the helper before Browse wiring uses it.

<!-- cspell:enable -->
