<!-- cspell:disable -->

# Review Continue Card v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one due-review entry card to the Browse Continue cluster.

**Architecture:** Add a pure selection helper to `deck-progress.ts`, read local SRS state once in Browse, and render a compact review variant of the existing Continue card. Keep due review deck-local by routing to `/deck/:deckId/quiz?review=due`.

**Tech Stack:** Expo Router, React Native Web, TypeScript, Vitest, Playwright smoke.

---

### Task 1: Due Review Candidate Helper

**Files:**
- Modify: `src/lib/deck-progress.ts`
- Modify: `src/lib/deck-progress.test.ts`
- Modify: `src/lib/srs-store.ts`

- [ ] **Step 1: Write failing tests**

Add tests that call `buildDeckReviewCandidate(decks, cardStates, sessionLogs, NOW)` and expect:

```ts
expect(candidate?.deckId).toBe('deck-b');
expect(candidate?.dueCount).toBe(2);
```

for the most recently studied due deck, highest due count fallback, and unavailable deck filtering.

- [ ] **Step 2: Verify red**

Run:

```bash
pnpm exec vitest run src/lib/deck-progress.test.ts
```

Expected: fail because `buildDeckReviewCandidate` does not exist.

- [ ] **Step 3: Implement helper**

Add:

```ts
export type DeckReviewCandidate = {
  deckId: string;
  deckTitle: string;
  dueCount: number;
  latestSessionAt: number | null;
};
```

and `buildDeckReviewCandidate(...)`, plus `getDueCardStates(now)` in `srs-store.ts`.

- [ ] **Step 4: Verify green**

Run:

```bash
pnpm exec vitest run src/lib/deck-progress.test.ts
```

Expected: pass.

### Task 2: Browse Review Continue Card

**Files:**
- Modify: `src/components/continue-card.tsx`
- Modify: `src/app/(tabs)/index.tsx`

- [ ] **Step 1: Add review card UI**

Add `ReviewContinueCard` beside `ContinueCard`, sharing the same stripe/card rhythm but showing `// REVIEW · รอทบทวน` and `n รอทบทวน`.

- [ ] **Step 2: Wire Browse data**

Browse reads the candidate with local SRS state after decks load. Render Review card when a candidate exists.

- [ ] **Step 3: Verify focused tests**

Run:

```bash
pnpm exec vitest run src/lib/deck-progress.test.ts
```

Expected: pass.

### Task 3: Visual And Regression Check

**Files:**
- Modify: `PRODUCT-ROADMAP.md` only if implementation and QA complete.

- [ ] **Step 1: Browser visual check**

Seed a temporary Playwright browser context with one due card and verify Browse shows the Review card, clicking opens `/quiz?review=due`, mobile/desktop overflow is `0`, and console errors are `0`.

- [ ] **Step 2: Regression commands**

Run:

```bash
pnpm smoke:deck-route http://localhost:8097
pnpm smoke:shuffle-session http://localhost:8097
```

Expected: exit `0`; only known `props.pointerEvents is deprecated` warnings may remain.

- [ ] **Step 3: Commit**

Commit app changes, then update and commit root roadmap if QA is clean.

<!-- cspell:enable -->
