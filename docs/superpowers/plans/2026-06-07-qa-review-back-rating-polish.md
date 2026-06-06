<!-- cspell:disable -->

# QA Review Back And Rating Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Browse Review Continue return to Browse from QA Back, and let QA rating buttons work from the front face with clear feedback.

**Architecture:** Reuse the existing `from=continue` back-marker path for review routes. Keep rating writes in the existing `handleRate` path, remove only the front-face disable gate, and add a short selected-rating visual state in the rating row.

**Tech Stack:** Expo Router, React Native Web, TypeScript, Vitest, Playwright/browser visual check.

---

### Task 1: Review Continue Back Marker

**Files:**
- Modify: `src/lib/continue-route.ts`
- Modify: `src/lib/continue-route.test.ts`
- Modify: `src/components/continue-card.tsx`

- [ ] **Step 1: Write failing route test**

Add `reviewContinueRouteHref('kanji-n5-pack02')` and expect `/deck/kanji-n5-pack02/quiz?review=due&from=continue`.

- [ ] **Step 2: Verify red**

Run `pnpm exec vitest run src/lib/continue-route.test.ts`.

- [ ] **Step 3: Implement and wire**

Add the helper and use it from `ReviewContinueCard`.

- [ ] **Step 4: Verify green**

Run `pnpm exec vitest run src/lib/continue-route.test.ts`.

### Task 2: Front-face QA Rating

**Files:**
- Modify: `src/app/deck/[deckId]/quiz.tsx`
- Modify: `src/components/rating-buttons.tsx`

- [ ] **Step 1: Remove front-face disable gate**

Stop passing `disabled={!isFlipped}` to `RatingButtons`; keep the existing `handleRate` write path.

- [ ] **Step 2: Add selected-rating feedback**

Track the last pressed rating briefly in QA and pass it to `RatingButtons`. Highlight the selected button with a crimson border/shadow while the card advances.

### Task 3: Verification

**Files:**
- Modify: `PRODUCT-ROADMAP.md` after QA passes.

- [ ] **Step 1: Run focused test**

Run `pnpm exec vitest run src/lib/continue-route.test.ts`.

- [ ] **Step 2: Run smoke checks**

Run `pnpm smoke:deck-route http://localhost:8097` and `pnpm smoke:shuffle-session http://localhost:8097`.

- [ ] **Step 3: Browser visual check**

Seed due review state, open Browse Review Continue, verify QA URL contains `from=continue`, Back returns Browse, front-face rating click advances/writes without needing reveal, selected feedback appears, horizontal overflow is `0`, and console errors are `0`.

<!-- cspell:enable -->
