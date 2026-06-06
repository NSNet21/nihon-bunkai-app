<!-- cspell:disable -->

# Browse / Deck Preview Loading Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Browse and Deck Preview avoid staged async flicker by using a Browse Continue-priority reveal gate and quiet reserved pending blocks for Deck Preview progress/terms.

**Architecture:** Keep page shells immediate, but derive small readiness decisions before revealing dependent sections. Browse gets a pure helper for Library reveal behavior; Deck Preview keeps route loading intact and replaces in-content spinners/text with stable editorial pending blocks.

**Tech Stack:** Expo Router, React Native Web, TypeScript/TSX, React hooks, Reanimated for section-level motion, Vitest, existing Playwright smoke scripts.

---

## File Structure

- Modify: `src/lib/continue-route.ts`
  - Add a pure Browse loading/reveal helper beside existing Continue helpers.
- Modify: `src/lib/continue-route.test.ts`
  - Add unit coverage for the helper.
- Modify: `src/app/(tabs)/index.tsx`
  - Use the helper to gate Library reveal.
  - Add section-level light motion for Continue and Library.
  - Add a quiet pending block while Continue is prioritized.
- Modify: `src/app/deck/[deckId]/index.tsx`
  - Replace DP in-content spinner/progress text with reserved pending blocks.
  - Add subtle section-level content replacement motion.
- Verify only; no planned source edits: `src/components/route-loading-indicator.tsx`
  - Keep route-level loading spinner for whole-route loading.

## Task 1: Browse Reveal Helper

**Files:**
- Modify: `src/lib/continue-route.ts`
- Modify: `src/lib/continue-route.test.ts`

- [ ] **Step 1: Write helper tests**

Append this block to `src/lib/continue-route.test.ts`:

```ts
import { getBrowseLibraryRevealState } from './continue-route';

describe('getBrowseLibraryRevealState', () => {
  it('keeps library pending until Continue readiness has resolved', () => {
    expect(getBrowseLibraryRevealState({ continueReady: false, hasContinue: false })).toEqual({
      showLibrary: false,
      prioritizeContinue: false,
      pendingLibrary: false,
      motion: 'none',
    });
  });

  it('reveals library immediately when Continue is ready and absent', () => {
    expect(getBrowseLibraryRevealState({ continueReady: true, hasContinue: false })).toEqual({
      showLibrary: true,
      prioritizeContinue: false,
      pendingLibrary: false,
      motion: 'direct',
    });
  });

  it('holds library in a quiet pending state when Continue exists but has not settled first', () => {
    expect(getBrowseLibraryRevealState({ continueReady: true, hasContinue: true, continueSettled: false })).toEqual({
      showLibrary: false,
      prioritizeContinue: true,
      pendingLibrary: true,
      motion: 'after-continue',
    });
  });

  it('reveals library after a real Continue section has settled', () => {
    expect(getBrowseLibraryRevealState({ continueReady: true, hasContinue: true, continueSettled: true })).toEqual({
      showLibrary: true,
      prioritizeContinue: true,
      pendingLibrary: false,
      motion: 'after-continue',
    });
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run:

```bash
pnpm exec vitest run src/lib/continue-route.test.ts
```

Expected: fail because `getBrowseLibraryRevealState` is not exported yet.

- [ ] **Step 3: Add the helper implementation**

Append this to `src/lib/continue-route.ts`:

```ts
export type BrowseLibraryRevealState = {
  showLibrary: boolean;
  prioritizeContinue: boolean;
  pendingLibrary: boolean;
  motion: 'none' | 'direct' | 'after-continue';
};

export function getBrowseLibraryRevealState({
  continueReady,
  hasContinue,
  continueSettled = false,
}: {
  continueReady: boolean;
  hasContinue: boolean;
  continueSettled?: boolean;
}): BrowseLibraryRevealState {
  if (!continueReady) {
    return {
      showLibrary: false,
      prioritizeContinue: false,
      pendingLibrary: false,
      motion: 'none',
    };
  }

  if (!hasContinue) {
    return {
      showLibrary: true,
      prioritizeContinue: false,
      pendingLibrary: false,
      motion: 'direct',
    };
  }

  return {
    showLibrary: continueSettled,
    prioritizeContinue: true,
    pendingLibrary: !continueSettled,
    motion: 'after-continue',
  };
}
```

- [ ] **Step 4: Run tests and confirm they pass**

Run:

```bash
pnpm exec vitest run src/lib/continue-route.test.ts
```

Expected: all `continue-route` tests pass.

- [ ] **Step 5: Commit helper**

Run:

```bash
git add src/lib/continue-route.ts src/lib/continue-route.test.ts
git commit -m "Add browse library reveal helper"
```

## Task 2: Browse Priority Reveal

**Files:**
- Modify: `src/app/(tabs)/index.tsx`

- [ ] **Step 1: Import helper and animation primitives**

In `src/app/(tabs)/index.tsx`, update imports:

```ts
import Animated, {
  Easing,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
```

Update the Continue helper import:

```ts
import { getBrowseLibraryRevealState, shouldShowFlashcardContinue } from '@/lib/continue-route';
```

- [ ] **Step 2: Add Continue-settled state and derived reveal state**

Inside `BrowseScreen`, after `const showAnyContinue = ...`, add:

```ts
  const [continueSettled, setContinueSettled] = useState(false);
  const libraryReveal = getBrowseLibraryRevealState({
    continueReady: continueClusterReady,
    hasContinue: showAnyContinue,
    continueSettled,
  });
```

Add this effect below the existing review-candidate focus effect:

```ts
  useEffect(() => {
    if (!continueClusterReady) {
      setContinueSettled(false);
      return;
    }

    if (!showAnyContinue) {
      setContinueSettled(false);
      return;
    }

    setContinueSettled(false);
    const id = setTimeout(() => setContinueSettled(true), 170);
    return () => clearTimeout(id);
  }, [continueClusterReady, showAnyContinue]);
```

- [ ] **Step 3: Wrap Continue section in a light section animation**

Replace the existing Continue heading/cards block with:

```tsx
              {showAnyContinue && (
                <Animated.View entering={FadeInUp.duration(170).easing(Easing.bezier(0.4, 0, 0.2, 1))}>
                  <View style={styles.continueGroupHead}>
                    <View style={[styles.continuePip, { backgroundColor: Accent.base }]} />
                    <View style={styles.continueTitleStack}>
                      <ThemedText type="defaultSemiBold" style={[styles.continueTitle, { color: Accent.base }]}>
                        เรียนต่อ
                      </ThemedText>
                      <ThemedText style={[styles.continueKicker, { color: colors.textHint }]}>
                        // CONTINUE · session / review
                      </ThemedText>
                    </View>
                  </View>
                  {showContinueLearn && lastSessionLearn && (
                    <ContinueCard lastSession={lastSessionLearn} colors={colors} mode="learn" />
                  )}
                  {showFlashcardContinue && lastSession && (
                    <ContinueCard lastSession={lastSession} colors={colors} mode="quiz" />
                  )}
                  {showReviewContinue && reviewCandidate && (
                    <ReviewContinueCard candidate={reviewCandidate} colors={colors} />
                  )}
                </Animated.View>
              )}
```

Remove the old separate `continueClusterReady && ...` card conditions because `showAnyContinue` already includes readiness.

- [ ] **Step 4: Gate Library section and add quiet pending block**

Replace the current Library divider/header block with:

```tsx
              {libraryReveal.pendingLibrary ? (
                <BrowseLibraryPending colors={colors} />
              ) : libraryReveal.showLibrary ? (
                <Animated.View
                  entering={FadeInUp.duration(libraryReveal.motion === 'after-continue' ? 210 : 120).easing(Easing.bezier(0.4, 0, 0.2, 1))}
                  style={styles.libraryRevealWrap}>
                  <View style={[styles.librarySectionDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.libraryBlockHead}>
                    <View style={styles.libraryGroupHead}>
                      <View style={[styles.libraryPip, { backgroundColor: Accent.base }]} />
                      <View style={styles.libraryTitleStack}>
                        <ThemedText type="defaultSemiBold" style={[styles.libraryTitle, { color: Accent.base }]}>
                          คลังคำศัพท์
                        </ThemedText>
                        <ThemedText style={[styles.libraryKicker, { color: colors.textHint }]}>
                          // LIBRARY · level / group / deck
                        </ThemedText>
                      </View>
                    </View>
                    <Toolbar
                      onOpenLibrarySearch={() => setLibrarySearchOpen(true)}
                      onExpandAll={expandAll}
                      onCollapseAll={collapseAll}
                      subsOnly={subsOnly}
                      onToggleSubsOnly={toggleToolbarScope}
                      onOpenLibraryActions={() => setLibraryActionsOpen(true)}
                    />
                  </View>
                </Animated.View>
              ) : null}
```

Update the `FlashList` data prop:

```tsx
          data={libraryReveal.showLibrary ? rows : []}
```

- [ ] **Step 5: Add pending component**

Add this component near `Toolbar`:

```tsx
function BrowseLibraryPending({ colors }: { colors: ReturnType<typeof useThemePalette> }) {
  return (
    <View style={styles.libraryPendingWrap} accessibilityLabel="กำลังจัดคลังคำศัพท์">
      <View style={[styles.librarySectionDivider, { backgroundColor: colors.border }]} />
      <View style={[styles.libraryPendingBlock, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
        <View style={[styles.libraryPendingRule, { backgroundColor: Accent.base }]} />
        <View style={styles.libraryPendingText}>
          <ThemedText type="smallBold" style={{ color: Accent.base }}>
            กำลังจัดคลังคำศัพท์
          </ThemedText>
          <ThemedText type="small" style={{ color: colors.textHint }}>
            // LIBRARY · level / group / deck
          </ThemedText>
        </View>
      </View>
    </View>
  );
}
```

- [ ] **Step 6: Add styles**

Add to the StyleSheet:

```ts
  libraryRevealWrap: {
    gap: Spacing.three,
  },
  libraryPendingWrap: {
    gap: Spacing.three,
  },
  libraryPendingBlock: {
    minHeight: 74,
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    overflow: 'hidden',
  },
  libraryPendingRule: {
    width: 3,
    alignSelf: 'stretch',
  },
  libraryPendingText: {
    gap: 2,
  },
```

- [ ] **Step 7: Run targeted tests**

Run:

```bash
pnpm exec vitest run src/lib/continue-route.test.ts src/lib/deck-progress.test.ts
```

Expected: tests pass.

- [ ] **Step 8: Commit Browse changes**

Run:

```bash
git add "src/app/(tabs)/index.tsx"
git commit -m "Polish browse loading reveal order"
```

## Task 3: Deck Preview Reserved Pending Blocks

**Files:**
- Modify: `src/app/deck/[deckId]/index.tsx`

- [ ] **Step 1: Import animation primitives**

At the top of `src/app/deck/[deckId]/index.tsx`, add:

```ts
import Animated, { Easing, FadeInUp } from 'react-native-reanimated';
```

- [ ] **Step 2: Replace progress loading text with reserved pending content**

Inside `DeckProgressBlock`, replace the `!ready` branch with:

```tsx
      {!ready ? (
        <DeckPreviewPendingLine colors={colors} label="กำลังอ่านความคืบหน้า" />
      ) : hasProgress && progress ? (
```

- [ ] **Step 3: Wrap ready progress grid in section-level motion**

Wrap the progress grid branch with:

```tsx
        <Animated.View entering={FadeInUp.duration(170).easing(Easing.bezier(0.4, 0, 0.2, 1))} style={styles.progressGrid}>
          <ProgressMetric
            icon={<FiActivity size={14} color={Accent.base} strokeWidth={2} />}
            label="แตะแล้ว"
            value={`${progress.touchedCount}`}
            colors={colors}
          />
          <ProgressMetric
            icon={<FiBookOpen size={14} color={Accent.base} strokeWidth={2} />}
            label="รอบเรียน"
            value={`${progress.sessionCount}`}
            colors={colors}
          />
          {latestLabel ? (
            <ProgressMetric
              icon={<FiCalendar size={14} color={Accent.base} strokeWidth={2} />}
              label="เรียนล่าสุด"
              value={latestLabel}
              colors={colors}
            />
          ) : null}
          {progress.latestSessionScore !== null ? (
            <ProgressMetric
              icon={<FiActivity size={14} color={Accent.base} strokeWidth={2} />}
              label="รอบล่าสุด"
              value={`${Math.round(progress.latestSessionScore * 100)}%`}
              colors={colors}
            />
          ) : null}
          {progress.streakCount ? (
            <ProgressMetric
              icon={<FiClock size={14} color={Accent.base} strokeWidth={2} />}
              label="ต่อเนื่อง"
              value={`${progress.streakCount} วัน`}
              colors={colors}
            />
          ) : null}
        </Animated.View>
```

- [ ] **Step 4: Replace in-content entries spinner with a reserved terms block**

Replace:

```tsx
          {entriesLoading ? (
            <RouteLoadingIndicator style={styles.entriesLoading} />
          ) : filteredEntries.length > 0 ? (
```

with:

```tsx
          {entriesLoading ? (
            <DeckTermsPending colors={colors} />
          ) : filteredEntries.length > 0 ? (
            <Animated.View entering={FadeInUp.duration(180).easing(Easing.bezier(0.4, 0, 0.2, 1))}>
```

Then close the `Animated.View` immediately after the final `</View>` for `styles.termList`.

- [ ] **Step 5: Add pending components**

Add these components above `ProgressMetric`:

```tsx
function DeckPreviewPendingLine({ colors, label }: { colors: typeof Colors.light; label: string }) {
  return (
    <View style={styles.pendingLine}>
      <View style={[styles.pendingRail, { backgroundColor: Accent.base }]} />
      <View style={styles.pendingTextStack}>
        <ThemedText type="smallBold" style={{ color: colors.textSecondary }}>{label}</ThemedText>
        <ThemedText type="small" style={{ color: colors.textHint }}>// รอข้อมูลในเครื่อง</ThemedText>
      </View>
    </View>
  );
}

function DeckTermsPending({ colors }: { colors: typeof Colors.light }) {
  return (
    <View style={[styles.termsPendingBlock, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
      <DeckPreviewPendingLine colors={colors} label="กำลังจัดคำใน deck นี้" />
      <View style={[styles.termsPendingRow, { borderColor: colors.border, backgroundColor: colors.background }]} />
      <View style={[styles.termsPendingRow, { borderColor: colors.border, backgroundColor: colors.background }]} />
    </View>
  );
}
```

- [ ] **Step 6: Add DP pending styles**

Add to the StyleSheet:

```ts
  pendingLine: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  pendingRail: {
    width: 3,
    alignSelf: 'stretch',
  },
  pendingTextStack: {
    gap: 2,
  },
  termsPendingBlock: {
    minHeight: 168,
    borderWidth: 1,
    borderRadius: Radii.sm,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  termsPendingRow: {
    height: 44,
    borderWidth: 1,
    borderRadius: Radii.sm,
    opacity: 0.58,
  },
```

Remove `entriesLoading` style if no longer used.

- [ ] **Step 7: Run route smoke**

Run:

```bash
pnpm smoke:deck-route http://localhost:8097
```

Expected: pass with no console errors. Known accepted warnings may remain unchanged.

- [ ] **Step 8: Commit DP changes**

Run:

```bash
git add "src/app/deck/[deckId]/index.tsx"
git commit -m "Polish deck preview loading states"
```

## Task 4: Verification And Visual QA

**Files:**
- No source edits expected unless verification finds defects.

- [ ] **Step 1: Run focused unit tests**

Run:

```bash
pnpm exec vitest run src/lib/continue-route.test.ts src/lib/deck-progress.test.ts
```

Expected: pass.

- [ ] **Step 2: Run deck route smoke**

Run:

```bash
pnpm smoke:deck-route http://localhost:8097
```

Expected: pass with errors `0`.

- [ ] **Step 3: Run perf smoke**

Run:

```bash
pnpm smoke:perf http://localhost:8097
```

Expected: pass. The known Search dev warning `Animated: useNativeDriver is not supported...` may remain.

- [ ] **Step 4: Run mobile and desktop visual checks**

Use Playwright or the existing browser tooling to inspect:

```text
http://localhost:8097/
http://localhost:8097/deck/vocab-n5-pack01
```

Viewports:

```text
390x844
1365x768
```

Confirm:

```text
Browse with Continue: Continue appears before Library.
Browse without Continue: Library is not artificially held.
Deck Preview: hero appears normally, progress/terms use quiet pending blocks, no large content spinner after hero.
Horizontal overflow: 0.
Console errors: 0.
```

- [ ] **Step 5: Fix verification defects if found**

If visual QA finds a defect, keep the fix scoped to the changed files and re-run the specific failed check. Do not open a broader redesign.

- [ ] **Step 6: Final status**

Run:

```bash
git status --short --branch
```

Expected: clean working tree, ahead of origin by the new commits.

<!-- cspell:enable -->
