# Deck Progress v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a small deck-level progress summary to Deck Preview using local SRS/session data only.

**Architecture:** Keep the data boundary in `src/lib/deck-progress.ts`: a pure summarizer for tests and one async reader for Dexie-backed local SRS stores. Deck Preview renders a compact Thai-first progress block after the deck hero and before the term list, without adding review-queue behavior or changing study-mode writes.

**Tech Stack:** Expo SDK 56, React Native Web, TypeScript, Dexie local stores, Vitest, Playwright smoke scripts.

---

### Task 1: Deck Progress Helper

**Files:**
- Create: `src/lib/deck-progress.ts`
- Test: `src/lib/deck-progress.test.ts`
- Modify: `src/lib/srs-store.ts`

- [ ] **Step 1: Write the failing helper tests**

Create `src/lib/deck-progress.test.ts` with tests for empty, touched, due, per-deck session filtering, latest session, score ratio, and streak handling:

```ts
import { describe, expect, it } from 'vitest';

import type { CardStateRow, SessionLogRow, StreakMetaRow } from './srs-store';
import { buildDeckProgressSummary } from './deck-progress';

const NOW = 1_800_000;

function card(entryId: string, deckId: string, due: number): CardStateRow {
  return {
    entryId,
    deckId,
    due,
    stability: 1,
    difficulty: 1,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 1,
    lapses: 0,
    state: 2,
    lastReview: NOW - 1_000,
    updatedAt: NOW - 500,
  };
}

function session(sessionId: string, deckId: string, startedAt: number, goodCount: number, againCount = 0): SessionLogRow {
  return {
    sessionId,
    deckId,
    deckTitle: deckId,
    totalCards: 5,
    startedAt,
    endedAt: startedAt + 60_000,
    ratings: [],
    againCount,
    hardCount: 0,
    goodCount,
    easyCount: 0,
    skippedCount: Math.max(0, 5 - goodCount - againCount),
    updatedAt: startedAt + 60_000,
  };
}

function streak(currentStreak: number): StreakMetaRow {
  return {
    id: 'streak',
    currentStreak,
    longestStreak: currentStreak,
    lastStudiedDate: '2026-06-06',
    totalSessions: currentStreak,
    totalCardsStudied: currentStreak * 5,
    updatedAt: NOW,
  };
}

describe('deck progress summary', () => {
  it('returns quiet empty values for a deck without local progress', () => {
    expect(buildDeckProgressSummary('deck-a', { cardStates: [], sessionLogs: [], streakMeta: streak(0), now: NOW })).toEqual({
      deckId: 'deck-a',
      touchedCount: 0,
      dueCount: 0,
      sessionCount: 0,
      latestSessionAt: null,
      latestSessionScore: null,
      streakCount: null,
    });
  });

  it('counts touched and due cards for the requested deck only', () => {
    const summary = buildDeckProgressSummary('deck-a', {
      cardStates: [
        card('deck-a::1', 'deck-a', NOW - 1),
        card('deck-a::2', 'deck-a', NOW + 1),
        card('deck-b::1', 'deck-b', NOW - 1),
      ],
      sessionLogs: [],
      streakMeta: streak(0),
      now: NOW,
    });

    expect(summary.touchedCount).toBe(2);
    expect(summary.dueCount).toBe(1);
  });

  it('counts sessions and uses the newest startedAt for latest session', () => {
    const summary = buildDeckProgressSummary('deck-a', {
      cardStates: [],
      sessionLogs: [
        session('old', 'deck-a', NOW - 30_000, 2),
        session('other', 'deck-b', NOW - 10_000, 5),
        session('new', 'deck-a', NOW - 5_000, 4, 1),
      ],
      streakMeta: streak(3),
      now: NOW,
    });

    expect(summary.sessionCount).toBe(2);
    expect(summary.latestSessionAt).toBe(NOW - 5_000);
    expect(summary.latestSessionScore).toBe(0.8);
    expect(summary.streakCount).toBe(3);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run from `companion-app/`:

```bash
pnpm exec vitest run src/lib/deck-progress.test.ts
```

Expected: fail because `src/lib/deck-progress.ts` and `buildDeckProgressSummary` do not exist.

- [ ] **Step 3: Add the per-deck session reader**

In `src/lib/srs-store.ts`, add this function near the existing session log readers:

```ts
/** Get completed session logs for one deck, newest first. */
export async function getSessionLogsForDeck(deckId: string): Promise<SessionLogRow[]> {
  const d = getDB();
  if (!d) return [];
  return d.sessionLogs.where('deckId').equals(deckId).reverse().sortBy('startedAt');
}
```

If Dexie `reverse().sortBy()` is not supported by the installed version, use this equivalent:

```ts
const rows = await d.sessionLogs.where('deckId').equals(deckId).toArray();
return rows.sort((a, b) => b.startedAt - a.startedAt);
```

- [ ] **Step 4: Implement the helper**

Create `src/lib/deck-progress.ts`:

```ts
import {
  getCardStatesForDeck,
  getSessionLogsForDeck,
  getStreakMeta,
  type CardStateRow,
  type SessionLogRow,
  type StreakMetaRow,
} from './srs-store';

export type DeckProgressSummary = {
  deckId: string;
  touchedCount: number;
  dueCount: number;
  sessionCount: number;
  latestSessionAt: number | null;
  latestSessionScore: number | null;
  streakCount: number | null;
};

type DeckProgressInput = {
  cardStates: CardStateRow[];
  sessionLogs: SessionLogRow[];
  streakMeta: StreakMetaRow;
  now?: number;
};

export function buildDeckProgressSummary(deckId: string, input: DeckProgressInput): DeckProgressSummary {
  const now = input.now ?? Date.now();
  const deckCards = input.cardStates.filter((row) => row.deckId === deckId);
  const deckSessions = input.sessionLogs
    .filter((row) => row.deckId === deckId)
    .sort((a, b) => b.startedAt - a.startedAt);
  const latestSession = deckSessions[0] ?? null;

  return {
    deckId,
    touchedCount: deckCards.length,
    dueCount: deckCards.filter((row) => row.due <= now).length,
    sessionCount: deckSessions.length,
    latestSessionAt: latestSession?.startedAt ?? null,
    latestSessionScore: latestSession ? getSessionScore(latestSession) : null,
    streakCount: input.streakMeta.currentStreak > 0 ? input.streakMeta.currentStreak : null,
  };
}

export async function getDeckProgressSummary(deckId: string, now = Date.now()): Promise<DeckProgressSummary> {
  const [cardStates, sessionLogs, streakMeta] = await Promise.all([
    getCardStatesForDeck(deckId),
    getSessionLogsForDeck(deckId),
    getStreakMeta(),
  ]);

  return buildDeckProgressSummary(deckId, { cardStates, sessionLogs, streakMeta, now });
}

function getSessionScore(session: SessionLogRow): number | null {
  const answered = session.againCount + session.hardCount + session.goodCount + session.easyCount;
  if (answered <= 0) return null;
  return (session.hardCount + session.goodCount + session.easyCount) / answered;
}
```

- [ ] **Step 5: Run focused helper tests**

Run from `companion-app/`:

```bash
pnpm exec vitest run src/lib/deck-progress.test.ts
```

Expected: pass.

### Task 2: Deck Preview Progress UI

**Files:**
- Modify: `src/app/deck/[deckId]/index.tsx`

- [ ] **Step 1: Import the helper and icons**

Update imports in `src/app/deck/[deckId]/index.tsx`:

```ts
import { FiActivity, FiBookOpen, FiCalendar, FiChevronLeft, FiChevronRight, FiClock, FiMoreVertical, FiPlus, FiSearch } from 'react-icons/fi';
import { getDeckProgressSummary, type DeckProgressSummary } from '@/lib/deck-progress';
```

- [ ] **Step 2: Add progress state and loader effect**

Inside `DeckTermListScreen`, add state near the existing entry state:

```ts
const [progress, setProgress] = useState<DeckProgressSummary | null>(null);
const [progressReady, setProgressReady] = useState(false);
```

Add an effect after the entries loader effect:

```ts
useEffect(() => {
  if (!deckId) return;
  let cancelled = false;
  setProgress(null);
  setProgressReady(false);
  void getDeckProgressSummary(deckId)
    .then((summary) => {
      if (!cancelled) setProgress(summary);
    })
    .catch((error) => {
      if (__DEV__) console.warn('[deck-progress] read failed:', error);
      if (!cancelled) setProgress(null);
    })
    .finally(() => {
      if (!cancelled) setProgressReady(true);
    });
  return () => {
    cancelled = true;
  };
}, [deckId]);
```

- [ ] **Step 3: Render the compact progress block after hero**

Add this JSX immediately after the hero block and before `sectionHead`:

```tsx
<DeckProgressBlock progress={progress} ready={progressReady} colors={colors} />
```

Add the component below `TermRow`:

```tsx
function DeckProgressBlock({
  progress,
  ready,
  colors,
}: {
  progress: DeckProgressSummary | null;
  ready: boolean;
  colors: typeof Colors.light;
}) {
  const hasProgress = Boolean(progress && (progress.touchedCount > 0 || progress.sessionCount > 0));
  const latestLabel = progress?.latestSessionAt ? formatProgressDate(progress.latestSessionAt) : null;

  return (
    <View style={[styles.progressBlock, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
      <View style={styles.progressHeader}>
        <View style={styles.sectionTitleRow}>
          <View style={[styles.pip, { backgroundColor: Accent.base }]} />
          <ThemedText style={[styles.mono, { color: colors.textHint }]}>// PROGRESS · ความคืบหน้า</ThemedText>
        </View>
        {progress?.dueCount ? (
          <View style={[styles.dueBadge, { borderColor: Accent.soft, backgroundColor: Accent.bg }]}>
            <FiClock size={13} color={Accent.base} strokeWidth={2} />
            <ThemedText style={[styles.dueBadgeText, { color: Accent.base }]}>{`${progress.dueCount} รอทบทวน`}</ThemedText>
          </View>
        ) : null}
      </View>

      {!ready ? (
        <ThemedText type="small" themeColor="textSecondary">กำลังอ่านความคืบหน้า...</ThemedText>
      ) : hasProgress && progress ? (
        <View style={styles.progressGrid}>
          <ProgressMetric icon={<FiActivity size={14} color={Accent.base} strokeWidth={2} />} label="แตะแล้ว" value={`${progress.touchedCount}`} colors={colors} />
          <ProgressMetric icon={<FiBookOpen size={14} color={Accent.base} strokeWidth={2} />} label="รอบเรียน" value={`${progress.sessionCount}`} colors={colors} />
          {latestLabel ? <ProgressMetric icon={<FiCalendar size={14} color={Accent.base} strokeWidth={2} />} label="เรียนล่าสุด" value={latestLabel} colors={colors} /> : null}
          {progress.latestSessionScore !== null ? <ProgressMetric icon={<FiActivity size={14} color={Accent.base} strokeWidth={2} />} label="รอบล่าสุด" value={`${Math.round(progress.latestSessionScore * 100)}%`} colors={colors} /> : null}
          {progress.streakCount ? <ProgressMetric icon={<FiClock size={14} color={Accent.base} strokeWidth={2} />} label="ต่อเนื่อง" value={`${progress.streakCount} วัน`} colors={colors} /> : null}
        </View>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">ยังไม่มีประวัติรอบเรียนใน deck นี้</ThemedText>
      )}
    </View>
  );
}

function ProgressMetric({
  icon,
  label,
  value,
  colors,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  colors: typeof Colors.light;
}) {
  return (
    <View style={[styles.progressMetric, { borderColor: colors.border, backgroundColor: colors.background }]}>
      {icon}
      <View style={styles.progressMetricText}>
        <ThemedText style={[styles.progressMetricValue, { color: colors.text }]} numberOfLines={1}>{value}</ThemedText>
        <ThemedText style={[styles.progressMetricLabel, { color: colors.textHint }]} numberOfLines={1}>{label}</ThemedText>
      </View>
    </View>
  );
}

function formatProgressDate(ms: number): string {
  const date = new Date(ms);
  return date.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' });
}
```

- [ ] **Step 4: Add styles**

Add styles near the other DP styles:

```ts
progressBlock: {
  borderWidth: 1,
  borderRadius: Radii.sm,
  padding: Spacing.three,
  gap: Spacing.two,
},
progressHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: Spacing.two,
},
dueBadge: {
  minHeight: 28,
  borderWidth: 1,
  borderRadius: Radii.sm,
  paddingHorizontal: Spacing.two,
  flexDirection: 'row',
  alignItems: 'center',
  gap: Spacing.one,
},
dueBadgeText: {
  fontSize: 12,
  fontWeight: '700',
},
progressGrid: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: Spacing.two,
},
progressMetric: {
  minHeight: 48,
  minWidth: 112,
  flexGrow: 1,
  flexBasis: 112,
  borderWidth: 1,
  borderRadius: Radii.sm,
  paddingHorizontal: Spacing.two,
  paddingVertical: Spacing.two,
  flexDirection: 'row',
  alignItems: 'center',
  gap: Spacing.two,
},
progressMetricText: {
  minWidth: 0,
  flex: 1,
},
progressMetricValue: {
  fontWeight: '700',
},
progressMetricLabel: {
  fontSize: 11,
},
```

- [ ] **Step 5: Run a focused route check**

Run from `companion-app/` with dev server on `8097`:

```bash
pnpm smoke:deck-route http://localhost:8097
```

Expected: pass with no console errors. Known warnings may still include Flashcard `props.pointerEvents` only on routes that render Flashcard.

### Task 3: Verification, Roadmap, Commit

**Files:**
- Modify: `PRODUCT-ROADMAP.md`
- Modify: `companion-app/docs/superpowers/specs/2026-06-06-deck-progress-v1-design.md` only if the implementation intentionally changes the spec boundary.

- [ ] **Step 1: Run regression tests**

Run from `companion-app/`:

```bash
pnpm vitest run
pnpm smoke:deck-route http://localhost:8097
pnpm smoke:study-mode-fsrs http://localhost:8097
```

Expected: Vitest passes; smoke scripts exit `0`; no new console errors.

- [ ] **Step 2: Run a focused visual sanity check**

Use Playwright or a browser worker to inspect:

```text
http://localhost:8097/deck/vocab-n5-pack03
```

Check:
- progress block appears after hero and before `// TERMS`
- empty state is small and does not create horizontal overflow
- after `smoke:study-mode-fsrs`, a studied deck can show non-empty progress if the smoke writes that deck's local progress
- sticky `เริ่มเรียน` footer remains visible and clickable

- [ ] **Step 3: Update roadmap**

In `PRODUCT-ROADMAP.md`, update the relevant Phase 2 progress/stat section with:

```md
Status 2026-06-06: Deck Progress v1 implemented on Deck Preview as a compact local-only progress summary. It reads local `cardStates`, `sessionLogs`, and `streakMeta`, shows touched cards, due cards, session count, latest session, and quiet empty state, without adding Overall Progress, Review Queue, or new SRS scheduling behavior.
```

- [ ] **Step 4: Review git diff**

Run:

```bash
git -C companion-app diff -- src/lib/deck-progress.ts src/lib/deck-progress.test.ts src/lib/srs-store.ts src/app/deck/[deckId]/index.tsx docs/superpowers/plans/2026-06-06-deck-progress-v1.md
git diff -- PRODUCT-ROADMAP.md
```

Expected: only Deck Progress helper/tests/UI, roadmap, and plan changes.

- [ ] **Step 5: Commit and push**

Commit app repo:

```bash
git -C companion-app add src/lib/deck-progress.ts src/lib/deck-progress.test.ts src/lib/srs-store.ts src/app/deck/[deckId]/index.tsx docs/superpowers/plans/2026-06-06-deck-progress-v1.md
git -C companion-app commit -m "Add deck progress summary"
git -C companion-app push
```

Commit root repo if `PRODUCT-ROADMAP.md` changed:

```bash
git add PRODUCT-ROADMAP.md
git commit -m "Document deck progress v1"
git push
```

Final status should be clean except for known local-only hook state files if they are still untracked and unrelated.

## Self-Review

- Spec coverage: the plan covers local `cardStates`, `sessionLogs`, and `streakMeta`, deck-only placement, empty/partial/due states, no Review Queue, and no study-write changes.
- Placeholder scan: no `TODO`, `TBD`, or open-ended "handle later" steps are used.
- Type consistency: `DeckProgressSummary`, `buildDeckProgressSummary`, and `getDeckProgressSummary` are defined before route usage; `getSessionLogsForDeck` is added to `srs-store.ts` before the async helper imports it.

