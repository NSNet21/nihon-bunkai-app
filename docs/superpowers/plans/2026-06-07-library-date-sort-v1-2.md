<!-- cspell:disable -->

# Library Date Sort v1.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real Local Library timestamps and replace Browse `Terms` sort with `Date` sorting for groups/sections/decks.

**Architecture:** Keep timestamp normalization in `download-store.ts`, the storage boundary where library deck records are written. Keep sort policy split between `library-sort.ts` for deck-level helpers and `browse-group-search.ts` for hierarchy row ordering.

**Tech Stack:** Expo React Native Web, TypeScript, Dexie, Vitest.

---

### Task 1: Timestamp Preservation At Storage Boundary

**Files:**
- Modify: `src/lib/download-store.ts`
- Test: add focused tests by expanding existing import/export or new storage helper tests if needed

- [x] Write tests that saving a new deck sets `createdAt`/`updatedAt`, and saving an existing deck preserves `createdAt` while bumping `updatedAt`.
- [x] Implement `withLibraryDeckTimestamps(existing, incoming, now)` as an exported pure helper.
- [x] Make `saveLibraryDecks()` merge existing records before `bulkPut`.
- [x] Make `putLibraryDeck()` normalize timestamps for single-record writes.

### Task 2: Date Sort Mode Helpers

**Files:**
- Modify: `src/lib/library-sort.ts`
- Modify: `src/lib/library-sort.test.ts`

- [x] Replace `terms` mode with `date`, while treating persisted legacy `terms` as `date`.
- [x] Add `getLibraryDeckTimestamp(deck)` helper using `updatedAt ?? createdAt ?? importedAt ?? 0`.
- [x] Update tests for date ascending/descending and default direction reset.

### Task 3: Browse Hierarchy Sort

**Files:**
- Modify: `src/lib/browse-group-search.ts`
- Modify: `src/lib/browse-group-search.test.ts`
- Modify: `src/app/(tabs)/index.tsx`

- [x] Add an optional sort options argument to `buildBrowseRows`.
- [x] Sort user groups and sections by name/date while preserving official JLPT group order.
- [x] Sort deck rows by date only when mode is `date`; preserve deck order for `default` and `name`.
- [x] Pass current sort mode/direction from Browse into both Library rows and Library Search rows.

### Task 4: UI Copy And Verification

**Files:**
- Modify: `src/app/(tabs)/index.tsx`

- [x] Change menu label from `Terms` to `Date`.
- [x] Run targeted unit tests during implementation.
- [x] Run `pnpm vitest run`.
- [x] Run `pnpm smoke:deck-route http://localhost:8097` and `pnpm smoke:perf http://localhost:8097` if local server is available.
- [x] Run mobile/desktop Browse visual checks for sort menu, date sort behavior, horizontal overflow `0`, and console errors `0`.

<!-- cspell:enable -->
