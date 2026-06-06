<!-- cspell:disable -->

# Continue Review Cluster Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the Browse Continue cluster now that Review Continue exists, and add a themed focus state to Deck Preview search.

**Architecture:** Keep this as a small UI slice. Add a tested pure helper for deciding when the old Flashcard Continue card should appear, then wire Browse rendering and Deck Preview focus styling without changing SRS or route behavior.

**Tech Stack:** Expo Router, React Native Web, TypeScript, Vitest, Playwright/browser visual check.

---

### Task 1: Continue Cluster Visibility Rule

**Files:**
- Modify: `src/lib/continue-route.ts`
- Modify: `src/lib/continue-route.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests for `shouldShowFlashcardContinue`:

```ts
expect(shouldShowFlashcardContinue({ hasFlashcardSession: true, hasReviewCandidate: false })).toBe(true);
expect(shouldShowFlashcardContinue({ hasFlashcardSession: true, hasReviewCandidate: true })).toBe(false);
```

- [ ] **Step 2: Run focused test and verify red**

Run `pnpm exec vitest run src/lib/continue-route.test.ts`; expected failure because helper is missing.

- [ ] **Step 3: Implement helper**

Add `shouldShowFlashcardContinue({ hasFlashcardSession, hasReviewCandidate })` to return `hasFlashcardSession && !hasReviewCandidate`.

- [ ] **Step 4: Run focused test and verify green**

Run `pnpm exec vitest run src/lib/continue-route.test.ts`; expected pass.

### Task 2: Browse Continue Header And Card Wiring

**Files:**
- Modify: `src/app/(tabs)/index.tsx`

- [ ] **Step 1: Use visibility helper**

Import `shouldShowFlashcardContinue`, calculate a display boolean, and render Flashcard Continue only when Review Continue is absent.

- [ ] **Step 2: Upgrade section header**

Replace the small orphan kicker with a restrained Browse section header: `เรียนต่อ` plus `// CONTINUE · session / review`.

### Task 3: Deck Preview Search Focus

**Files:**
- Modify: `src/app/deck/[deckId]/index.tsx`

- [ ] **Step 1: Add focus state**

Add `searchFocused` state and set it from `TextInput` `onFocus` / `onBlur`.

- [ ] **Step 2: Apply outer focus decoration**

When focused, set the outer `searchBox` border to crimson with a subtle themed background/outline treatment.

### Task 4: Verification

**Files:**
- Modify: `PRODUCT-ROADMAP.md` only after QA passes.

- [ ] **Step 1: Run focused tests**

Run `pnpm exec vitest run src/lib/continue-route.test.ts`.

- [ ] **Step 2: Run smoke check**

Run `pnpm smoke:deck-route http://localhost:8097`.

- [ ] **Step 3: Browser visual check**

Check Browse with Review card visible and Deck Preview search focused on desktop/mobile. Expected: no duplicate Flashcard card while Review is visible, Continue header is readable, DP search focus decoration appears, horizontal overflow is `0`, console errors are `0`.

<!-- cspell:enable -->
