<!-- cspell:disable -->

# Library Sort / Reset v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add fast Library sort and reset controls on Browse without changing the Browse hierarchy or deck storage model.

**Architecture:** Add a focused sort helper in `src/lib/library-sort.ts`, test it independently, then wire the selected mode into `src/app/(tabs)/index.tsx` before `buildBrowseRows`. The UI stays inside the existing Library toolbar rhythm and only sorts deck metadata inside existing group/category placement.

**Tech Stack:** Expo Router, React Native Web, TypeScript, Vitest, FlashList.

---

### Task 1: Add Library Sort Tests

**Files:**
- Create: `src/lib/library-sort.test.ts`

- [ ] **Step 1: Write failing helper tests**

Create `src/lib/library-sort.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { Deck } from '@/data/types';
import { getLibrarySortMode, sortLibraryDecks, type LibrarySortMode } from './library-sort';

const deck = (overrides: Partial<Deck>): Deck => ({
  id: overrides.id ?? 'deck-a',
  pack: overrides.pack ?? overrides.id ?? 'deck-a',
  title: overrides.title ?? 'Deck A',
  type: overrides.type ?? 'vocab',
  level: overrides.level ?? 'N5',
  entryCount: overrides.entryCount ?? 20,
  isFree: overrides.isFree ?? true,
  source: overrides.source ?? 'free',
  tags: overrides.tags ?? [],
  ...overrides,
});

describe('library sort helpers', () => {
  it('keeps default order unchanged', () => {
    const decks = [
      deck({ id: 'b', title: 'Beta', entryCount: 10 }),
      deck({ id: 'a', title: 'Alpha', entryCount: 30 }),
    ];

    expect(sortLibraryDecks(decks, 'default').map((item) => item.id)).toEqual(['b', 'a']);
    expect(sortLibraryDecks(decks, 'default')).not.toBe(decks);
  });

  it('sorts by title using a stable id fallback', () => {
    const decks = [
      deck({ id: 'b', title: 'Beta' }),
      deck({ id: 'a', title: 'Alpha' }),
      deck({ id: 'c', title: 'Alpha' }),
    ];

    expect(sortLibraryDecks(decks, 'name').map((item) => item.id)).toEqual(['a', 'c', 'b']);
  });

  it('sorts by entry count high to low with title fallback', () => {
    const decks = [
      deck({ id: 'small', title: 'Small', entryCount: 10 }),
      deck({ id: 'large-b', title: 'Beta', entryCount: 30 }),
      deck({ id: 'large-a', title: 'Alpha', entryCount: 30 }),
    ];

    expect(sortLibraryDecks(decks, 'terms').map((item) => item.id)).toEqual(['large-a', 'large-b', 'small']);
  });

  it('normalizes invalid persisted values to default', () => {
    expect(getLibrarySortMode('name')).toBe('name');
    expect(getLibrarySortMode('terms')).toBe('terms');
    expect(getLibrarySortMode('wat' as LibrarySortMode)).toBe('default');
    expect(getLibrarySortMode(null)).toBe('default');
  });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```bash
pnpm vitest run src/lib/library-sort.test.ts
```

Expected: FAIL because `src/lib/library-sort.ts` does not exist yet.

---

### Task 2: Implement Library Sort Helper

**Files:**
- Create: `src/lib/library-sort.ts`
- Test: `src/lib/library-sort.test.ts`

- [ ] **Step 1: Add the helper**

Create `src/lib/library-sort.ts`:

```ts
import type { Deck } from '@/data/types';

export const LIBRARY_SORT_MODES = ['default', 'name', 'terms'] as const;

export type LibrarySortMode = (typeof LIBRARY_SORT_MODES)[number];

export function getLibrarySortMode(value: unknown): LibrarySortMode {
  return LIBRARY_SORT_MODES.includes(value as LibrarySortMode)
    ? (value as LibrarySortMode)
    : 'default';
}

export function sortLibraryDecks(decks: Deck[], mode: LibrarySortMode): Deck[] {
  const next = [...decks];
  if (mode === 'default') return next;

  return next.sort((a, b) => {
    if (mode === 'terms') {
      const entryDiff = b.entryCount - a.entryCount;
      if (entryDiff !== 0) return entryDiff;
    }

    return compareDeckIdentity(a, b);
  });
}

function compareDeckIdentity(a: Deck, b: Deck) {
  const titleDiff = a.title.localeCompare(b.title, ['th', 'ja', 'en'], { numeric: true, sensitivity: 'base' });
  if (titleDiff !== 0) return titleDiff;
  return a.id.localeCompare(b.id, 'en', { numeric: true, sensitivity: 'base' });
}
```

- [ ] **Step 2: Run the focused test and confirm it passes**

Run:

```bash
pnpm vitest run src/lib/library-sort.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit helper and tests**

Run:

```bash
git add src/lib/library-sort.ts src/lib/library-sort.test.ts
git commit -m "Add library sort helper"
```

---

### Task 3: Wire Sort / Reset Into Browse Toolbar

**Files:**
- Modify: `src/app/(tabs)/index.tsx`
- Test: `src/lib/library-sort.test.ts`

- [ ] **Step 1: Import icons and helper**

In `src/app/(tabs)/index.tsx`, extend icon imports:

```ts
  FiRefreshCcw,
  FiSliders,
```

Import helper:

```ts
import { getLibrarySortMode, sortLibraryDecks, type LibrarySortMode } from '@/lib/library-sort';
```

- [ ] **Step 2: Add persisted sort state and sorted decks**

Inside `BrowseScreen`, after existing persisted session state:

```ts
  const [storedLibrarySortMode, setStoredLibrarySortMode] = usePersistedState<LibrarySortMode>('library-sort-mode', 'default');
  const librarySortMode = getLibrarySortMode(storedLibrarySortMode);
```

Replace direct `decks` inputs used for Browse rows/search with a memoized sorted list:

```ts
  const sortedDecks = useMemo(
    () => sortLibraryDecks(decks, librarySortMode),
    [decks, librarySortMode],
  );
```

Use `sortedDecks` for:

```ts
buildBrowseCollapseKeys(sortedDecks)
filterBrowseDecks(sortedDecks, groupSearchQuery)
buildBrowseRows(sortedDecks, closedLevels, closedCategories)
```

Keep `decks` for ownership/session validation and Library stats unless the code path explicitly needs sorted display order.

- [ ] **Step 3: Add toolbar props**

Pass sort props into `Toolbar`:

```tsx
                      sortMode={librarySortMode}
                      onChangeSortMode={setStoredLibrarySortMode}
                      onResetSortMode={() => setStoredLibrarySortMode('default')}
```

Update the `Toolbar` parameter type:

```ts
  sortMode: LibrarySortMode;
  onChangeSortMode: (mode: LibrarySortMode) => void;
  onResetSortMode: () => void;
```

- [ ] **Step 4: Add compact sort/reset controls**

Inside `Toolbar`, add local open state:

```ts
  const [sortOpen, setSortOpen] = useState(false);
  const sortLabel = sortMode === 'default' ? 'Default' : sortMode === 'name' ? 'Name' : 'Terms';
  const resetDisabled = sortMode === 'default';
```

Add this after the existing `Library` action button in `styles.toolbar`:

```tsx
        <View style={styles.sortControlWrap}>
          <ScaleButton
            onPress={() => setSortOpen((prev) => !prev)}
            accessibilityLabel="เปลี่ยนลำดับ Library"
            style={[
              styles.toolBtn,
              {
                borderColor: sortOpen || sortMode !== 'default' ? Accent.base : colors.border,
                backgroundColor: sortMode !== 'default' ? Accent.bg : 'transparent',
              },
            ]}>
            <View style={styles.toolBtnContent}>
              <FiSliders size={14} color={sortMode !== 'default' ? Accent.base : colors.text} />
              <ThemedText type="small" style={{ color: sortMode !== 'default' ? Accent.base : colors.textSecondary }}>
                {isCompact ? sortLabel : `Sort ${sortLabel}`}
              </ThemedText>
            </View>
          </ScaleButton>
          {sortOpen ? (
            <View style={[styles.sortMenu, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}>
              {(['default', 'name', 'terms'] as LibrarySortMode[]).map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => {
                    onChangeSortMode(mode);
                    setSortOpen(false);
                  }}
                  style={({ pressed }) => [styles.sortMenuItem, pressed && styles.headerPressed]}>
                  <ThemedText type="smallBold" style={{ color: mode === sortMode ? Accent.base : colors.textSecondary }}>
                    {mode === 'default' ? 'Default' : mode === 'name' ? 'Name' : 'Terms'}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
        <ScaleButton
          onPress={onResetSortMode}
          disabled={resetDisabled}
          accessibilityLabel="Reset Library sort"
          style={[
            styles.toolBtn,
            {
              borderColor: colors.border,
              opacity: resetDisabled ? 0.42 : 1,
            },
          ]}>
          <View style={styles.toolBtnContent}>
            <FiRefreshCcw size={14} color={colors.text} />
            <ThemedText type="small" themeColor="textSecondary">{isCompact ? 'Reset' : 'Reset'}</ThemedText>
          </View>
        </ScaleButton>
```

- [ ] **Step 5: Add menu styles**

In `StyleSheet.create`, near toolbar styles:

```ts
  sortControlWrap: {
    position: 'relative',
    zIndex: 5,
  },
  sortMenu: {
    position: 'absolute',
    top: 50,
    left: 0,
    minWidth: 132,
    borderWidth: 1,
    zIndex: 10,
  },
  sortMenuItem: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127, 127, 127, 0.22)',
  },
```

- [ ] **Step 6: Run tests**

Run:

```bash
pnpm vitest run src/lib/library-sort.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Browse wiring**

Run:

```bash
git add "src/app/(tabs)/index.tsx"
git commit -m "Add browse library sort controls"
```

---

### Task 4: Verify Responsive Browse Behavior

**Files:**
- Modify if needed: `src/app/(tabs)/index.tsx`

- [ ] **Step 1: Run core local checks**

Run:

```bash
pnpm vitest run
```

Expected: PASS.

Run:

```bash
pnpm smoke:deck-route http://localhost:8097
```

Expected: PASS. If local server is down, start it with `pnpm exec expo start --web --port 8097`.

- [ ] **Step 2: Browser visual check**

Check Browse on:

```text
390x844
768x1024
1365x768
```

Verify:

- Sort and Reset wrap without horizontal overflow.
- Sort menu is visible and not clipped.
- `Name` and `Terms` visibly reorder deck rows.
- `Reset` returns the control to `Default`.
- Opening a deck still reaches Deck Preview.
- Console errors are `0`.

- [ ] **Step 3: Fix concrete defects only**

If visual testing finds overflow/clipping, adjust only toolbar sizing/menu positioning in `src/app/(tabs)/index.tsx`.

- [ ] **Step 4: Commit verification fixes if any**

Run only if Step 3 changed code:

```bash
git add "src/app/(tabs)/index.tsx"
git commit -m "Polish library sort responsive behavior"
```

---

## Self-Review

- Spec coverage: sort, reset, no grid, no data-model change, no broad redesign, persisted sort, responsive checks are covered.
- Red-flag scan: no `TODO` / `TBD` / unspecified implementation steps.
- Type consistency: `LibrarySortMode`, `sortLibraryDecks`, and `getLibrarySortMode` are defined before Browse wiring uses them.

<!-- cspell:enable -->
