# Deck Review Entry v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deck-local `ทบทวน deck นี้` entry that opens Quiz Card with only due cards for the current deck.

**Architecture:** Extend the existing Deck Progress helper with a due-entry-number bridge from SRS row IDs to deck entries. Deck Preview shows a compact review action only when `dueCount > 0`, and the existing Quiz Card route handles `?review=due` by filtering its session snapshot at route load.

**Tech Stack:** Expo SDK 56, React Native Web, Expo Router, Dexie local SRS stores, TypeScript, Vitest, Playwright smoke scripts.

---

### Task 1: Due Entry Helper

**Files:**
- Modify: `src/lib/deck-progress.ts`
- Modify: `src/lib/deck-progress.test.ts`

- [ ] **Step 1: Write failing tests for due entry number parsing**

Append these tests to `src/lib/deck-progress.test.ts`:

```ts
import { buildDeckProgressSummary, dueEntryNosFromCardStates } from './deck-progress';
```

Add inside `describe('deck progress summary', () => { ... })`:

```ts
  it('extracts due entry numbers for the requested deck only', () => {
    expect(dueEntryNosFromCardStates('deck-a', [
      card('deck-a::1', 'deck-a', NOW - 1),
      card('deck-a::2', 'deck-a', NOW + 1),
      card('deck-b::3', 'deck-b', NOW - 1),
    ], NOW)).toEqual([1]);
  });

  it('ignores malformed due row ids', () => {
    expect(dueEntryNosFromCardStates('deck-a', [
      card('deck-a::not-a-number', 'deck-a', NOW - 1),
      card('wrong-shape', 'deck-a', NOW - 1),
      card('deck-a::4', 'deck-a', NOW - 1),
    ], NOW)).toEqual([4]);
  });
```

- [ ] **Step 2: Run focused test to confirm it fails**

Run from `companion-app/`:

```bash
pnpm exec vitest run src/lib/deck-progress.test.ts
```

Expected: fail because `dueEntryNosFromCardStates` is not exported yet.

- [ ] **Step 3: Implement due helper functions**

Update `src/lib/deck-progress.ts`:

```ts
export function dueEntryNosFromCardStates(deckId: string, cardStates: CardStateRow[], now = Date.now()): number[] {
  return cardStates
    .filter((row) => row.deckId === deckId && row.due <= now)
    .map((row) => entryNoFromSrsEntryId(deckId, row.entryId))
    .filter((no): no is number => typeof no === 'number')
    .sort((a, b) => a - b);
}

export async function getDueEntryNosForDeck(deckId: string, now = Date.now()): Promise<number[]> {
  const cardStates = await getCardStatesForDeck(deckId);
  return dueEntryNosFromCardStates(deckId, cardStates, now);
}

function entryNoFromSrsEntryId(deckId: string, entryId: string): number | null {
  const prefix = `${deckId}::`;
  if (!entryId.startsWith(prefix)) return null;
  const rawNo = entryId.slice(prefix.length);
  const no = Number(rawNo);
  return Number.isInteger(no) && no > 0 ? no : null;
}
```

Also update `buildDeckProgressSummary` to reuse the helper:

```ts
dueCount: dueEntryNosFromCardStates(deckId, deckCards, now).length,
```

- [ ] **Step 4: Run focused tests**

Run from `companion-app/`:

```bash
pnpm exec vitest run src/lib/deck-progress.test.ts
```

Expected: pass.

### Task 2: Deck Preview Review Action

**Files:**
- Modify: `src/app/deck/[deckId]/index.tsx`

- [ ] **Step 1: Add router access and review handler**

In `DeckTermListScreen`, keep the existing router destructure:

```ts
const { push, replace } = useRouter();
```

Add this function near `goModes()`:

```ts
function goDueReview() {
  if (!deckId) return;
  push(`/deck/${deckId}/quiz?review=due` as never);
}
```

- [ ] **Step 2: Pass the handler into the progress block**

Replace the current progress block call:

```tsx
<DeckProgressBlock progress={progress} ready={progressReady} colors={colors} />
```

with:

```tsx
<DeckProgressBlock progress={progress} ready={progressReady} colors={colors} onReview={goDueReview} />
```

- [ ] **Step 3: Add the action to `DeckProgressBlock`**

Update the component signature:

```tsx
function DeckProgressBlock({
  progress,
  ready,
  colors,
  onReview,
}: {
  progress: DeckProgressSummary | null;
  ready: boolean;
  colors: typeof Colors.light;
  onReview: () => void;
}) {
```

Inside the header, after the due badge, render a compact action when due:

```tsx
{progress?.dueCount ? (
  <Pressable
    onPress={onReview}
    accessibilityRole="button"
    accessibilityLabel="ทบทวน deck นี้"
    style={({ pressed, hovered }: any) => [
      styles.reviewBtn,
      { borderColor: Accent.soft, backgroundColor: Accent.base },
      (pressed || hovered) && { backgroundColor: Accent.strong, borderColor: Accent.strong },
      pressed && { opacity: 0.82 },
    ]}>
    <ThemedText style={styles.reviewBtnText}>ทบทวน deck นี้</ThemedText>
  </Pressable>
) : null}
```

- [ ] **Step 4: Add review action styles**

Add to the style sheet:

```ts
reviewBtn: {
  minHeight: 30,
  borderWidth: 1,
  borderRadius: Radii.sm,
  paddingHorizontal: Spacing.two,
  alignItems: 'center',
  justifyContent: 'center',
},
reviewBtnText: {
  color: '#fff',
  fontSize: 12,
  fontWeight: '700',
},
```

If the header feels crowded on mobile, keep the same behavior but change `progressHeader` to:

```ts
progressHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: Spacing.two,
},
```

- [ ] **Step 5: Run focused route smoke**

Run from `companion-app/`:

```bash
pnpm smoke:deck-route http://localhost:8097
```

Expected: pass with no console errors.

### Task 3: Quiz Card Due-Review Route

**Files:**
- Modify: `src/app/deck/[deckId]/quiz.tsx`

- [ ] **Step 1: Import the due helper**

Add this import:

```ts
import { getDueEntryNosForDeck } from '@/lib/deck-progress';
```

- [ ] **Step 2: Read the review route param**

Update the search params type:

```ts
const { deckId, entryId, count: countParam, from, review } = useLocalSearchParams<{
  deckId?: string;
  entryId?: string;
  count?: string;
  from?: string | string[];
  review?: string;
}>();
```

Add:

```ts
const isDueReview = review === 'due' && !entryId;
```

- [ ] **Step 3: Disable count config for due review**

Update the `sessionCount` calculation:

```ts
const sessionCount = (() => {
  if (entryId || isDueReview) return undefined;
  const n = countParam ? parseInt(countParam, 10) : NaN;
  return Number.isFinite(n) && [10, 20, 30, 50].includes(n) ? n : undefined;
})();
```

- [ ] **Step 4: Filter route entries at load time**

Replace the current `entriesForDeckAsync(deckId).then((rows) => { ... })` body with an async chain:

```ts
void (async () => {
  const rows = await entriesForDeckAsync(deckId);
  if (cancelled) return;

  if (isDueReview) {
    const dueNos = await getDueEntryNosForDeck(deckId);
    if (cancelled) return;
    const dueNoSet = new Set(dueNos);
    const dueRows = rows.filter((row) => dueNoSet.has(row.no));
    if (dueRows.length === 0) {
      setEntries([]);
      setEntriesLoading(false);
      showToast('ยังไม่มีการ์ดที่ต้องทบทวนใน deck นี้', { kind: 'info' });
      router.replace(`/deck/${deckId}` as never);
      return;
    }
    baseSessionEntriesRef.current = dueRows;
    setEntries(dueRows);
    setEntriesLoading(false);
    return;
  }

  const baseRows = entryId
    ? rows
    : sessionCount
        ? rows.slice(0, sessionCount)
        : buildStudySessionEntries(
            rows,
            { ...safeFlashcardConfig, order: 'normal' },
            `${deckId}:flashcard:base`,
          );
  const nextRows = entryId
    ? rows
    : sessionCount
        ? baseRows
        : buildStudySessionEntries(rows, safeFlashcardConfig, `${deckId}:flashcard`);
  baseSessionEntriesRef.current = baseRows;
  setEntries(nextRows);
  setEntriesLoading(false);
  if (entryId) {
    const jumpTo = rows.findIndex((r) => r.id === entryId);
    if (jumpTo >= 0) {
      setIndex(jumpTo);
    } else if (rows.length > 0) {
      showToast('ตัวการ์ดเดิมหาไม่เจอ เริ่มจากต้น', { kind: 'info' });
    }
  }
})().catch((error) => {
  if (__DEV__) console.warn('[quiz-review] load failed:', error);
  if (!cancelled) {
    setEntries([]);
    setEntriesLoading(false);
    if (isDueReview && deckId) {
      showToast('ยังไม่มีการ์ดที่ต้องทบทวนใน deck นี้', { kind: 'info' });
      router.replace(`/deck/${deckId}` as never);
    }
  }
});
```

- [ ] **Step 5: Update effect dependencies**

Update the dependency list for that loader effect:

```ts
}, [deckId, entryId, isDueReview, router, safeFlashcardConfig, sessionCount, showToast]);
```

- [ ] **Step 6: Run focused smokes**

Run from `companion-app/`:

```bash
pnpm smoke:deck-route http://localhost:8097
pnpm smoke:shuffle-session http://localhost:8097
```

Expected: both pass. Existing shuffle behavior remains unchanged for normal Quiz Card sessions.

### Task 4: Browser Due-Review Smoke, Roadmap, Commit

**Files:**
- Modify: `PRODUCT-ROADMAP.md`

- [ ] **Step 1: Run full regression commands**

Run from `companion-app/`:

```bash
pnpm vitest run
pnpm smoke:deck-route http://localhost:8097
pnpm smoke:shuffle-session http://localhost:8097
pnpm smoke:study-mode-fsrs http://localhost:8097
```

Expected: all commands exit `0`.

- [ ] **Step 2: Run a due-review browser check**

Use Playwright to seed `nihon-bunkai-srs.cardStates` for `/deck/vocab-n5-pack01`:

```js
const now = Date.now();
tx.objectStore('cardStates').put({
  entryId: 'vocab-n5-pack01::1',
  deckId: 'vocab-n5-pack01',
  due: now - 1_000,
  stability: 1,
  difficulty: 1,
  elapsedDays: 0,
  scheduledDays: 0,
  reps: 1,
  lapses: 0,
  state: 2,
  lastReview: now - 2_000,
  updatedAt: now,
});
```

Then verify:

```text
/deck/vocab-n5-pack01 shows ทบทวน deck นี้
clicking it opens /deck/vocab-n5-pack01/quiz?review=due
Quiz header shows 1 / 1
no horizontal overflow
console error count is 0
```

- [ ] **Step 3: Update roadmap**

Add under `P2.7 Study Mode Expansion`:

```md
Status 2026-06-07: Deck Review Entry v1 is implemented. Deck Preview now exposes `ทบทวน deck นี้` when the deck has local due cards, and the existing Quiz Card route supports `?review=due` to review only the due subset for that deck. This remains deck-local and does not add a global Review Queue, Overall Progress dashboard, or new SRS scheduling behavior.
```

- [ ] **Step 4: Review diff**

Run:

```bash
git -C companion-app diff -- src/lib/deck-progress.ts src/lib/deck-progress.test.ts src/app/deck/[deckId]/index.tsx src/app/deck/[deckId]/quiz.tsx docs/superpowers/plans/2026-06-07-deck-review-entry-v1.md
git diff -- PRODUCT-ROADMAP.md
```

Expected: only due helper/tests, DP review action, Quiz Card due route, plan, and roadmap changed.

- [ ] **Step 5: Commit and push**

Commit app repo:

```bash
git -C companion-app add src/lib/deck-progress.ts src/lib/deck-progress.test.ts src/app/deck/[deckId]/index.tsx src/app/deck/[deckId]/quiz.tsx docs/superpowers/plans/2026-06-07-deck-review-entry-v1.md
git -C companion-app commit -m "Add deck due review entry"
git -C companion-app push
```

Commit root repo:

```bash
git add PRODUCT-ROADMAP.md
git commit -m "Document deck review entry v1"
git push
```

Final status should be clean in both root and `companion-app`.

## Self-Review

- Spec coverage: covers DP due action, `?review=due`, local due filtering, no global queue, no scheduling changes, fallback when no due cards, tests, and roadmap.
- Placeholder scan: no vague placeholders or incomplete steps remain.
- Type consistency: `dueEntryNosFromCardStates`, `getDueEntryNosForDeck`, `isDueReview`, and `review?: string` are defined before use.

