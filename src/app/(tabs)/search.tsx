import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { FiRefreshCw, FiSearch, FiX } from 'react-icons/fi';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FOCUS_SEARCH_EVENT } from '@/components/search-shortcut';
import { ScrollToTop } from '@/components/scroll-to-top';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemePalette } from '@/context/theme';
import { useSearchIndex } from '@/hooks/use-search-index';
import { Accent, BottomTabInset, Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import type { ContentType, JlptLevel } from '@/data/types';
import type { SearchResult } from '@/lib/search-index';

const TYPE_LABEL: Record<ContentType, string> = {
  vocab: 'VOCAB',
  grammar: 'GRAMMAR',
  kanji: 'KANJI',
  glossary: 'GLOSSARY',
};

const SEARCH_DEBOUNCE_MS = 120;
/* No more visible cap — user requested the full match set surface so
   they can sweep through everything. FlashList still virtualizes
   render to ~20 visible rows at a time so the DOM stays light even
   with 1k+ matches. Cap kept at 10k as a hard safety so a degenerate
   wildcard query can't lock up Fuse on the largest corpora. */
const RESULT_HARD_CAP = 10_000;
const SCROLL_TOP_THRESHOLD = 640;

/* JLPT level → sort weight. Glossary entries (level === null) sort last
   so the browse-all view + jump strip both read top-down N5→N1→G. */
const LEVEL_ORDER: Record<string, number> = { N5: 0, N4: 1, N3: 2, N2: 3, N1: 4 };
function levelWeight(level: JlptLevel | null): number {
  return level ? LEVEL_ORDER[level] ?? 5 : 5;
}
function withHexAlpha(hex: string, alpha: string): string {
  return /^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${alpha}` : hex;
}
type JumpKey = JlptLevel | 'GLOSSARY';
const JUMP_KEYS: JumpKey[] = ['N5', 'N4', 'N3', 'N2', 'N1', 'GLOSSARY'];
const JUMP_LONG_LABEL: Record<JumpKey, string> = {
  N5: 'N5 · พื้นฐาน', N4: 'N4 · ต้น', N3: 'N3 · กลาง',
  N2: 'N2 · สูง', N1: 'N1 · สูงสุด', GLOSSARY: 'GLOSSARY · ศัพท์รวม',
};
const JUMP_SHORT_LABEL: Record<JumpKey, string> = {
  N5: 'N5', N4: 'N4', N3: 'N3', N2: 'N2', N1: 'N1', GLOSSARY: 'GL',
};

/* FastScroller — editorial index marker on touch viewports. Slim
   graphite block rides on a hidden rail; both activate to crimson
   on drag (GPT-reviewed iteration: crimson on idle conflicted with
   the native scrollbar's accent colour, so the thumb now defaults
   to muted graphite and only "lights up" while the user is
   scrubbing). Aiming for the feeling of a paper index tab in a
   Japanese dictionary, not an Android utility scrollbar. */
const FAST_TRACK_WIDTH = 24;     /* tap hitbox + side breathing room */
const FAST_LINE_WIDTH = 1;       /* the hairline rail (drag-only) */
const FAST_THUMB_WIDTH = 12;     /* slim, vertical-authority block */
const FAST_THUMB_HEIGHT = 30;    /* terse height — editorial */

/* Union of items the FlashList renders. Headers carry their JLPT key
   + the row count for the section caption; rows wrap the existing
   SearchResult shape. Discriminator field `__header` distinguishes
   the two in renderItem + getItemType. */
type SectionHeaderItem = { __header: true; id: string; key: JumpKey; count: number };
type RowItem = { __header?: false; id: string; result: SearchResult };
type ListItem = SectionHeaderItem | RowItem;
type FastToastInfo = { group: string; term: string; reading: string; visible: boolean };
const EMPTY_FAST_TOAST: FastToastInfo = { group: '', term: '', reading: '', visible: false };

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ focus?: string }>();
  const c = useThemePalette();

  const { ready, totalEntries, allEntries, run, refresh } = useSearchIndex();
  const { width: viewportW, height: viewportH } = useWindowDimensions();
  const compact = viewportW > 0 && viewportW < 480;
  const compactToast = viewportW > 0 && viewportW < 768;
  const shortMobileViewport = viewportW > 0 && viewportW < 768 && viewportH > 0 && viewportH < 680;
  const edgeScrollSurface = Platform.OS === 'web' && viewportW >= 768;
  /* Touch-class breakpoint — phone portrait through tablet landscape.
     Used to gate the FastScroller + native-scrollbar-hide pair, so
     iPad / Android tablet users get the same draggable-thumb
     affordance the phone gets. Above 1024 px we assume mouse + wheel
     and keep the native scrollbar. */
  const touchSeek = viewportW > 0 && viewportW < 1024;
  const tabletSearchRail = edgeScrollSurface && touchSeek;

  /* Two fixed size tiers — compact (mobile) vs wide (desktop). Earlier
     iteration interpolated everything across 320→480 px which sounded
     responsive on paper but left meaning text at ~10 px on a 350 px
     viewport (unreadable). Discrete tiers are easier to tune and the
     visual jump at the breakpoint is invisible in practice since few
     users resize the browser across 480 px in one session. */
  const { rowSizes, chromeSizes } = useMemo(() => {
    if (compact) {
      return {
        rowSizes: { term: 16, reading: 11, meaning: 14, chip: 11, padV: 8, padH: 10, gap: 3, chipPadH: 7 },
        chromeSizes: { headerLabel: 11, headerCount: 10, totalText: 10, totalNumber: 11 },
      };
    }
    return {
      rowSizes: { term: 17, reading: 12, meaning: 13, chip: 11, padV: 12, padH: 8, gap: 4, chipPadH: 8 },
      chromeSizes: { headerLabel: 12, headerCount: 11, totalText: 11, totalNumber: 12 },
    };
  }, [compact]);

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [focused, setFocused] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [fastToast, setFastToast] = useState<FastToastInfo>(EMPTY_FAST_TOAST);
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlashListRef<ListItem>>(null);
  const focusParam = Array.isArray(params.focus) ? params.focus[0] : params.focus;

  /* FastScroller wiring — mobile (compact) only. Latest scroll
     metrics live in a ref so the high-frequency onScroll callback
     doesn't trigger React re-renders; the thumb position is a
     Reanimated SharedValue so updates stay on the UI thread and
     don't block the JS one. */
  const fastScrollMetrics = useRef({ offset: 0, contentHeight: 1, viewportHeight: 1, trackHeight: 0 });
  const fastThumbY = useSharedValue(0);
  const fastIsDragging = useSharedValue(false);
  /* Hidden-by-default scrollbar pattern: thumb fades in when the
     list scrolls, fades out ~1500 ms after the last scroll event
     (or never fades while the user is actively dragging the
     thumb). Mirrors the native iOS / Android scroll-indicator
     show/hide cadence. */
  const fastVisible = useSharedValue(0);
  const fastHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollTopSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fastToastBackground = useMemo(
    () => withHexAlpha(c.surface, Platform.OS === 'web' ? 'd9' : 'f2'),
    [c.surface],
  );
  const stickyOffsetStyle = useMemo(() => {
    if (!edgeScrollSurface || headerHeight <= 0) return null;
    return Platform.OS === 'web'
      ? ({ '--search-sticky-offset': `${headerHeight}px` } as unknown as object)
      : null;
  }, [edgeScrollSurface, headerHeight]);
  const tabletRailStyle = useMemo(() => {
    if (!tabletSearchRail) return null;
    const railWidth = Math.min(MaxContentWidth, Math.max(560, Math.round(viewportW * 0.82)));
    return { maxWidth: railWidth };
  }, [tabletSearchRail, viewportW]);

  const handleFastLabelChange = useCallback((next: FastToastInfo) => {
    setFastToast((prev) => (
      prev.group === next.group && prev.term === next.term && prev.reading === next.reading && prev.visible === next.visible ? prev : next
    ));
  }, []);

  const syncFastThumbFromScroll = useCallback(() => {
    /* JS-thread function — called from onListScroll (JS callback).
       Reads scroll metrics from the ref, writes the resulting
       position into the thumb SharedValue. No 'worklet' directive:
       Reanimated's worklet bundler doesn't capture module-level
       constants like FAST_THUMB_HEIGHT through the React Compiler
       transform, so marking this worklet caused a runtime
       ReferenceError + the React "Exceeded max renders" cascade
       from the failed gesture handler init. Writing to a
       SharedValue from JS is fine — Reanimated handles the
       JS→UI bridge automatically. */
    const { offset, contentHeight, viewportHeight, trackHeight } = fastScrollMetrics.current;
    if (fastIsDragging.value || trackHeight <= 0) return;
    const scrollable = Math.max(1, contentHeight - viewportHeight);
    const ratio = Math.max(0, Math.min(1, offset / scrollable));
    const maxThumb = Math.max(0, trackHeight - FAST_THUMB_HEIGHT);
    fastThumbY.value = ratio * maxThumb;
  }, [fastIsDragging, fastThumbY]);

  const onListScroll = useCallback((e: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    fastScrollMetrics.current.offset = contentOffset.y;
    fastScrollMetrics.current.contentHeight = contentSize.height;
    fastScrollMetrics.current.viewportHeight = layoutMeasurement.height;
    setShowScrollTop((prev) => {
      const next = contentOffset.y > SCROLL_TOP_THRESHOLD;
      return prev === next ? prev : next;
    });
    syncFastThumbFromScroll();
    /* Show thumb the moment scroll fires + schedule a fade-out after
       1500 ms of no further scroll events. While the user is
       dragging the thumb, scrollToOffset keeps re-triggering the
       scroll callback so the timer keeps resetting — the fade-out
       only happens after the drag ends and motion settles. */
    fastVisible.value = withTiming(1, { duration: 120 });
    if (fastHideTimerRef.current) clearTimeout(fastHideTimerRef.current);
    fastHideTimerRef.current = setTimeout(() => {
      if (!fastIsDragging.value) fastVisible.value = withTiming(0, { duration: 280 });
    }, 1500);
  }, [syncFastThumbFromScroll, fastVisible, fastIsDragging]);

  const scrollToTop = useCallback(() => {
    if (scrollTopSettleTimerRef.current) clearTimeout(scrollTopSettleTimerRef.current);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    setShowScrollTop(false);
    scrollTopSettleTimerRef.current = setTimeout(() => {
      if (fastScrollMetrics.current.offset > 24) {
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
        fastScrollMetrics.current.offset = 0;
        syncFastThumbFromScroll();
      }
    }, 900);
  }, [syncFastThumbFromScroll]);

  useEffect(() => () => {
    if (scrollTopSettleTimerRef.current) clearTimeout(scrollTopSettleTimerRef.current);
  }, []);

  const forwardHeaderWheelToList = useCallback((event: any) => {
    if (!edgeScrollSurface) return;
    const deltaY = Number(event?.nativeEvent?.deltaY ?? event?.deltaY ?? 0);
    if (!Number.isFinite(deltaY) || Math.abs(deltaY) < 1) return;
    const { offset, contentHeight, viewportHeight } = fastScrollMetrics.current;
    const nextRawOffset = Math.max(0, offset + deltaY);
    const maxOffset = contentHeight > viewportHeight
      ? Math.max(0, contentHeight - viewportHeight)
      : null;
    const nextOffset = maxOffset == null ? nextRawOffset : Math.min(maxOffset, nextRawOffset);
    listRef.current?.scrollToOffset({ offset: nextOffset, animated: false });
  }, [edgeScrollSurface]);

  /* Debounce: avoid running Fuse on every keystroke. */
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  const hasQuery = debounced.trim().length > 0;

  /* Pre-sort the corpus by JLPT level for the browse-all view —
     N5 → N4 → N3 → N2 → N1 → Glossary. Stable secondary sort by `no`
     keeps deck-internal order intact inside each section. */
  const sortedAllEntries = useMemo(() => {
    if (allEntries.length === 0) return allEntries;
    return [...allEntries].sort((a, b) => {
      const lvl = levelWeight(a.level) - levelWeight(b.level);
      return lvl !== 0 ? lvl : a.no - b.no;
    });
  }, [allEntries]);

  /* Active filter result-set OR fall-through to the full sorted corpus.
     When no query is active, every indexed entry is surfaced as a
     synthesized SearchResult (score 0, no matches) so the row
     renderer + FlashList stay on the same data shape — no branching
     in the list code path. */
  const results = useMemo(() => {
    if (!ready) return [];
    if (hasQuery) return run(debounced, RESULT_HARD_CAP);
    return sortedAllEntries.map((entry) => ({ entry, score: 0 }));
  }, [ready, hasQuery, debounced, run, sortedAllEntries]);
  const hasResults = results.length > 0;

  /* Interleave section headers into the data stream when browsing all.
     Each header carries the row count for its section so the caption
     reads "// N5 · 1,200 รายการ". In filter mode we skip headers —
     ranked Fuse output doesn't have contiguous level blocks to label. */
  const listData = useMemo<ListItem[]>(() => {
    if (results.length === 0) return [];
    if (hasQuery) {
      return results.map((r) => ({ id: r.entry.id, result: r }));
    }
    const items: ListItem[] = [];
    let currentKey: JumpKey | null = null;
    let lastHeaderIdx = -1;
    for (const r of results) {
      const k: JumpKey = r.entry.level ?? 'GLOSSARY';
      if (k !== currentKey) {
        currentKey = k;
        lastHeaderIdx = items.length;
        items.push({ __header: true, id: `__hdr_${k}`, key: k, count: 0 });
      }
      items.push({ id: r.entry.id, result: r });
      const hdr = items[lastHeaderIdx] as SectionHeaderItem;
      hdr.count += 1;
    }
    return items;
  }, [hasQuery, results]);

  /* Header indices in the LIST view (not the bare results array) so the
     jump-grid modal scrolls to the right offset including header rows.
     Single pass extracts the first-index map, per-section row counts
     (modal caption), AND the sorted array of header positions that
     FlashList's `stickyHeaderIndices` needs to pin headers to the
     top edge until the next one pushes them off. */
  const { listJumpIndices, sectionCounts, stickyHeaderIndices } = useMemo(() => {
    if (hasQuery) {
      return { listJumpIndices: null, sectionCounts: null, stickyHeaderIndices: undefined as number[] | undefined };
    }
    const indices = new Map<JumpKey, number>();
    const counts = new Map<JumpKey, number>();
    const sticky: number[] = [];
    for (let i = 0; i < listData.length; i++) {
      const it = listData[i];
      if ('__header' in it && it.__header) {
        indices.set(it.key, i);
        counts.set(it.key, it.count);
        sticky.push(i);
      }
    }
    return { listJumpIndices: indices, sectionCounts: counts, stickyHeaderIndices: sticky };
  }, [hasQuery, listData]);

  const [jumpGridOpen, setJumpGridOpen] = useState(false);

  const jumpTo = useCallback((key: JumpKey) => {
    const idx = listJumpIndices?.get(key);
    if (idx == null) return;
    listRef.current?.scrollToIndex({ index: idx, animated: true });
  }, [listJumpIndices]);

  const openJumpGrid = useCallback(() => setJumpGridOpen(true), []);
  const closeJumpGrid = useCallback(() => setJumpGridOpen(false), []);
  const jumpFromGrid = useCallback((key: JumpKey) => {
    jumpTo(key);
    setJumpGridOpen(false);
  }, [jumpTo]);

  /* Auto-focus on mount + on Ctrl/⌘+K from anywhere (web only). */
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    inputRef.current?.focus();
    const onFocusEvent = () => inputRef.current?.focus();
    window.addEventListener(FOCUS_SEARCH_EVENT, onFocusEvent);
    return () => window.removeEventListener(FOCUS_SEARCH_EVENT, onFocusEvent);
  }, []);

  useEffect(() => {
    if (focusParam !== '1') return;
    const id = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(id);
  }, [focusParam]);

  const openEntry = useCallback(
    (deckId: string, entryId: string) => {
      /* Search jump-through opens Quiz mode at the matched entry — the
         user came looking for that specific card, they want active study. */
      router.push(`/deck/${deckId}/quiz?entryId=${encodeURIComponent(entryId)}` as never);
    },
    [router],
  );

  /* Stable renderItem closure — FlashList recycles row instances, so a
     fresh inline arrow on every parent re-render would re-attach
     handlers per cell each frame. With useCallback the same closure
     reference is reused across renders. Dispatches on the
     `__header` discriminator: section headers vs entry rows. */
  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      /* Wrap every cell in a fixed-padding View. The padding USED to
         live on contentContainerStyle, but that only applied to the
         in-flow cell layout — sticky headers got re-parented into
         FlashList's absolute wrapper (no contentContainer padding)
         and ended up wider than their inline twin, which read as a
         horizontal jump at the sticky pin moment. Moving the inset
         here means both states paint with identical bg geometry. */
      const inner = ('__header' in item && item.__header)
        ? <SectionHeaderRow keyName={item.key} count={item.count} themeColor={c} onPress={openJumpGrid} compact={compact} chrome={chromeSizes} />
        : <ResultRow
            result={item.result}
            onPress={() => openEntry(item.result.entry.deckId, item.result.entry.id)}
            themeColor={c}
            compact={compact}
            sizes={rowSizes}
          />;
      return <View style={[styles.cellWrap, tabletRailStyle]}>{inner}</View>;
    },
    [c, openEntry, compact, rowSizes, chromeSizes, openJumpGrid, tabletRailStyle],
  );

  /* FlashList recycles cells by type — telling it that headers and rows
     are different types prevents a header DOM node being reused for an
     entry row, avoiding visual flicker + bg/style spillover on scroll. */
  const getItemType = useCallback(
    (item: ListItem) => ('__header' in item && item.__header ? 'header' : 'row'),
    [],
  );

  return (
    <ThemedView style={styles.container}>
      {/* Ghost kanji 検 (search) — sticky background decoration. Mirrors
          Shop's muted scale (smaller than Browse main page since secondary
          surface). Lives at ThemedView root so it stays fixed while the
          result list scrolls. */}
      <ThemedText style={[styles.ghostKanji, { color: c.textHint }]}>
        検
      </ThemedText>
      {edgeScrollSurface && headerHeight > 0 ? (
        <View
          pointerEvents="none"
          style={[
            styles.desktopHeaderScrim,
            tabletRailStyle,
            {
              height: headerHeight,
              backgroundColor: withHexAlpha(c.background, Platform.OS === 'web' ? 'c7' : 'ec'),
              borderBottomColor: c.border,
            },
          ]}
        />
      ) : null}
      <SafeAreaView
        style={[styles.headerSafe, tabletRailStyle]}
        edges={['top']}
        onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
        {...(edgeScrollSurface ? ({ onWheel: forwardHeaderWheelToList } as any) : {})}>
        <View
          style={[styles.headerWrap, shortMobileViewport && styles.headerWrapShortMobile]}
          {...(edgeScrollSurface ? ({ onWheel: forwardHeaderWheelToList } as any) : {})}>
          <ThemedText type="title" style={shortMobileViewport && styles.searchTitleShortMobile}>Search</ThemedText>

          <View
            style={[
              styles.inputRow,
              shortMobileViewport && styles.inputRowShortMobile,
              {
                backgroundColor: c.surface,
                borderColor: focused ? Accent.base : c.border,
              },
            ]}
          >
            {/* C: top 3px crimson bar slides in from left on focus. */}
            <View
              style={[
                styles.accentBar,
                Platform.OS === 'web'
                  ? ({
                      transform: focused ? 'scaleX(1)' : 'scaleX(0)',
                      transformOrigin: 'left center',
                      transition: 'transform 240ms cubic-bezier(0.4, 0, 0.2, 1)',
                    } as unknown as object)
                  : { transform: [{ scaleX: focused ? 1 : 0 }] },
                { pointerEvents: 'none' },
              ]}
            />
            <FiSearch size={18} color={focused ? Accent.base : c.textHint} />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="คำญี่ปุ่น · ความหมายไทย · เสียงอ่าน"
              placeholderTextColor={c.textHint}
              style={[styles.input, { color: c.text }]}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery('')} hitSlop={10} style={styles.clearBtn}>
                <FiX size={16} color={c.textHint} />
              </Pressable>
            ) : null}
          </View>

          {/* Loading hint — only while the index is still building.
              Once ready, the TotalStrip below carries the count for
              both the idle (all entries) and active-query states. */}
          {!ready && (
            <ThemedText type="small" themeColor="textHint">กำลังสร้าง index…</ThemedText>
          )}
          {/* Round-5 P1 — GPT round-4: "Keep minimal · ห้ามใส่ popular
              searches · เพิ่ม subtle hint แทน · muted mono tiny · ไม่ใช่
              onboarding/tutorial". One-line marginal annotation showing
              the kana/kanji/grammar shapes the index supports. Hidden
              once the user starts typing. */}
          {ready && !hasQuery && (
            <ThemedText style={[styles.queryHint, shortMobileViewport && styles.queryHintShortMobile, { color: c.textHint }]}>
              ลอง: 食べる · 一緒 · 〜ように
            </ThemedText>
          )}
        </View>

        {/* Total strip — left-aligned count above the result list +
            refresh icon on the right edge. Manual refresh replaced
            the auto visibilitychange listener so the user controls
            when "rebuilding index…" runs (cross-tab sync after a
            purchase elsewhere is the main use case). Lives inside
            headerSafe so it shares the maxWidth+centered alignment
            with the search bar above, keeping the count/refresh row
            vertically aligned with the cell content below. */}
        {ready && hasResults && (
          <View style={[styles.totalStrip, shortMobileViewport && styles.totalStripShortMobile, { borderBottomColor: c.border }]}>
            <ThemedText style={[styles.totalText, { color: c.textMuted, fontSize: chromeSizes.totalText }]}>
              ทั้งหมด <ThemedText style={[styles.totalNumber, { color: c.text, fontSize: chromeSizes.totalNumber }]}>{results.length.toLocaleString()}</ThemedText> รายการ
              {hasQuery && results.length !== totalEntries ? (
                <ThemedText style={[styles.totalText, { color: c.textHint, fontSize: chromeSizes.totalText }]}>
                  {' '}· จาก {totalEntries.toLocaleString()}
                </ThemedText>
              ) : null}
            </ThemedText>
            <Pressable
              onPress={refresh}
              accessibilityRole="button"
              accessibilityLabel="โหลด deck ใหม่"
              // @ts-ignore web tooltip
              title="โหลด deck ใหม่ (re-sync)"
              hitSlop={6}
              style={({ pressed, hovered }: any) => [
                styles.refreshBtn,
                hovered && { backgroundColor: c.surface2 },
                pressed && { opacity: 0.6 },
              ]}>
              <FiRefreshCw size={14} color={c.textMuted} strokeWidth={2} />
            </Pressable>
          </View>
        )}
      </SafeAreaView>

      {/* On tablet/desktop web, listWrap spans the viewport so the
          native scrollbar sits at the far right edge while cells stay
          centered via cellWrap. Phone keeps the older content-width
          list behavior because its compact layout already feels right. */}
      <View
        style={[styles.listWrap, edgeScrollSurface && styles.desktopListWrap, stickyOffsetStyle]}
        /* dataSet → data-list="search" on web. Lets global.css scope
           the sticky-header pointer-events fix to just this FlashList
           (see global.css "FlashList sticky-header wrappers"). RN's
           View typing omits dataSet (RN Web extension), so cast. */
        {...(Platform.OS === 'web' ? ({ dataSet: { list: 'search' } } as any) : {})}>
        <FlashList<ListItem>
          ref={listRef}
          data={listData}
          keyExtractor={(it) => it.id}
          getItemType={getItemType}
          /* Sticky header indices — each section header pins to the top
             edge while the user scrolls through its rows, then gets
             pushed off the top as the next header approaches (classic
             iOS contacts behaviour). Disabled in filter mode (no
             headers in listData then). */
          stickyHeaderIndices={stickyHeaderIndices}
          contentContainerStyle={[
            styles.listContent,
            edgeScrollSurface && headerHeight > 0 ? { paddingTop: headerHeight } : null,
          ]}
          renderItem={renderItem}
          onScroll={onListScroll}
          scrollEventThrottle={16}
          /* drawDistance defines how far ABOVE + BELOW the viewport
             FlashList renders out cells, in CSS px. Tighter window =
             fewer mounted rows when scanning a long corpus. flash-list
             v2 auto-measures item size on its own, so no
             estimatedItemSize override is needed. */
          drawDistance={400}
          ListEmptyComponent={
            ready && hasQuery ? (
              <View style={styles.empty}>
                <ThemedText type="default" themeColor="textSecondary">
                  ไม่เจอ — ลองพิมพ์ใหม่
                </ThemedText>
              </View>
            ) : null
          }
        />
        {touchSeek && ready && hasResults && (
          /* Renders in BOTH browse-all and search-results modes.
             The section label only appears during drag when
             listJumpIndices is populated (browse-all view) — in
             filter mode the thumb still tracks scroll and is
             draggable, just without a category label since search
             results don't carry contiguous section blocks. */
          <FastScroller
            listRef={listRef}
            listData={listData}
            listJumpIndices={listJumpIndices}
            metricsRef={fastScrollMetrics}
            thumbY={fastThumbY}
            isDragging={fastIsDragging}
            visible={fastVisible}
            themeColor={c}
            showLabel
            onLabelChange={handleFastLabelChange}
          />
        )}
      </View>
      {touchSeek && fastToast.visible && (fastToast.group || fastToast.term || fastToast.reading) ? (
        <View
          pointerEvents="none"
          style={[
            styles.fastScrollerToastLayer,
            tabletSearchRail && styles.fastScrollerToastLayerTablet,
            compactToast && styles.fastScrollerToastLayerCompact,
          ]}>
          <View style={[
            styles.fastScrollerToast,
            compactToast && styles.fastScrollerToastCompact,
            { backgroundColor: fastToastBackground, borderColor: c.borderStrong },
          ]}>
            <View style={[styles.fastScrollerToastAccent, compactToast && styles.fastScrollerToastAccentCompact]} />
            <View style={styles.fastScrollerToastCopy}>
              {fastToast.group ? (
                <ThemedText
                  style={[
                    styles.fastScrollerToastGroup,
                    compactToast && styles.fastScrollerToastGroupCompact,
                    { color: c.textMuted },
                  ]}
                  numberOfLines={1}>
                  {fastToast.group}
                </ThemedText>
              ) : null}
              {fastToast.term ? (
                <ThemedText
                  style={[
                    styles.fastScrollerToastTerm,
                    compactToast && styles.fastScrollerToastTermCompact,
                    { color: c.text },
                  ]}
                  numberOfLines={1}>
                  {fastToast.term}
                </ThemedText>
              ) : null}
              {fastToast.reading ? (
                <ThemedText
                  style={[
                    styles.fastScrollerToastReading,
                    compactToast && styles.fastScrollerToastReadingCompact,
                    { color: c.textHint },
                  ]}
                  numberOfLines={1}>
                  {fastToast.reading}
                </ThemedText>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}
      <ScrollToTop
        visible={showScrollTop}
        onPress={scrollToTop}
        rightOffset={touchSeek ? FAST_TRACK_WIDTH + Spacing.sp5 : undefined}
        bottomOffset={touchSeek ? BottomTabInset + Spacing.five : undefined}
      />
      <JumpGridModal
        visible={jumpGridOpen}
        themeColor={c}
        availableKeys={listJumpIndices ? JUMP_KEYS.filter((k) => listJumpIndices.has(k)) : []}
        counts={sectionCounts}
        onPick={jumpFromGrid}
        onClose={closeJumpGrid}
      />
    </ThemedView>
  );
}

interface SectionHeaderProps {
  keyName: JumpKey;
  count: number;
  themeColor: typeof Colors.light | typeof Colors.dark;
  onPress: () => void;
  compact: boolean;
  chrome: { headerLabel: number; headerCount: number; totalText: number; totalNumber: number };
}

/** Inline section header — sticky pin to top edge until the next
 *  header pushes it off. Background matches the page surface so the
 *  header reads as part of the list rather than a tinted divider.
 *  Tapping opens the JumpGrid modal for cross-section hops. No right
 *  inset — the header background spans the full FlashList content
 *  width to match the row edges exactly (earlier scrollbar-gutter
 *  marginRight made the header end short of the rows, which read as
 *  an indent shift on every sticky-pin transition). */
function SectionHeaderRow({ keyName, count, themeColor: c, onPress, compact, chrome }: SectionHeaderProps) {
  return (
    <Pressable
      onPress={onPress}
      /* dataSet emits data-sticky-pressable="search-header" on web —
         a stable hook for the global.css pointer-events scope. RN
         Web's Pressable doesn't get a `role="button"` attribute we
         can target, and its hashed class names rotate per build, so
         a manual data attribute is the only reliable selector that
         survives across versions. */
      {...(Platform.OS === 'web' ? ({ dataSet: { stickyPressable: 'search-header' } } as any) : {})}
      style={({ pressed, hovered }: any) => [
        styles.sectionHeader,
        { paddingVertical: compact ? 4 : 8, paddingHorizontal: compact ? 8 : 12 },
        {
          /* Solid page-background so the header reads as part of the
             list rather than a tinted divider — opaque so the sticky
             pin still occludes rows scrolling underneath. Hover
             lifts to surface2 for a subtle "tappable" hint. The
             earlier frosted-blur iteration was reverted: too pretty
             for the editorial/Wabi register the rest of the app
             holds. */
          backgroundColor: hovered ? c.surface2 : c.background,
          borderBottomColor: c.border,
          borderTopColor: c.border,
        },
        pressed && { opacity: 0.85 },
      ]}>
      <ThemedText style={[styles.sectionHeaderLabel, { color: c.textMuted, fontSize: chrome.headerLabel }]} numberOfLines={1}>
        {JUMP_LONG_LABEL[keyName]} <ThemedText style={[styles.sectionHeaderCount, { color: c.textHint, fontSize: chrome.headerCount }]}>· {count.toLocaleString()} รายการ</ThemedText>
      </ThemedText>
    </Pressable>
  );
}

interface JumpGridModalProps {
  visible: boolean;
  themeColor: typeof Colors.light | typeof Colors.dark;
  availableKeys: JumpKey[];
  counts: Map<JumpKey, number> | null;
  onPick: (key: JumpKey) => void;
  onClose: () => void;
}

/** Quick-jump compact list — opens on any section-header tap. Each row
 *  shows the section label + its entry count; tap to scroll there.
 *  Reverted from a tile grid (which felt empty with only a few
 *  sections on the free tier) to a tighter list shape that scales
 *  cleanly with however many sections the corpus exposes. */
function JumpGridModal({ visible, themeColor: c, availableKeys, counts, onPick, onClose }: JumpGridModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={[styles.modalPanel, { backgroundColor: c.background, borderColor: c.border }]}
          onPress={(e) => e.stopPropagation?.()}>
          <View style={styles.modalHeader}>
            <ThemedText type="defaultSemiBold">ข้ามไป section</ThemedText>
            <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
              <FiX size={20} color={c.text} strokeWidth={2} />
            </Pressable>
          </View>
          <View style={styles.modalList}>
            {availableKeys.map((key) => (
              <Pressable
                key={key}
                onPress={() => onPick(key)}
                style={({ pressed, hovered }: any) => [
                  styles.modalRow,
                  {
                    borderBottomColor: c.border,
                    backgroundColor: hovered ? c.surface2 : 'transparent',
                  },
                  pressed && { opacity: 0.7 },
                ]}>
                <ThemedText style={[styles.modalRowLabel, { color: c.text }]} numberOfLines={1}>
                  {JUMP_LONG_LABEL[key]}
                </ThemedText>
                <ThemedText style={[styles.modalRowCount, { color: c.textHint }]}>
                  {(counts?.get(key) ?? 0).toLocaleString()}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface RowProps {
  result: SearchResult;
  onPress: () => void;
  themeColor: typeof Colors.light | typeof Colors.dark;
  compact: boolean;
  sizes: {
    term: number;
    reading: number;
    meaning: number;
    chip: number;
    padV: number;
    padH: number;
    gap: number;
    chipPadH: number;
  };
}

function ResultRow({ result, onPress, themeColor: c, compact, sizes }: RowProps) {
  const { entry } = result;
  /* p is the expanded variants array; show the first reading (cleaned, no Kunyomi: prefix).
     Skip if it duplicates the term itself (kana entries where T == P). */
  const displayReading = entry.p[0] ?? '';
  const showP = displayReading && displayReading !== entry.t;

  /* Compact (<480px) renders as a vertical card so the row reads like
     a single self-contained entry instead of three loosely related
     blocks (term, meaning, chips) drifting on their own lines. Wide
     keeps the S1 | S2 | chips three-column layout from the annotation. */
  if (compact) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          styles.rowCompactCard,
          {
            paddingVertical: sizes.padV,
            paddingHorizontal: sizes.padH,
            gap: sizes.gap,
            backgroundColor: pressed ? c.surface2 : 'transparent',
            borderBottomColor: c.border,
          },
        ]}
      >
        <View style={styles.compactTopLine}>
          <ThemedText style={[styles.term, { color: c.text, fontSize: sizes.term }]} numberOfLines={1}>
            {entry.t}
          </ThemedText>
          <View style={styles.chips}>
            <Chip text={TYPE_LABEL[entry.type]} color={c} size={sizes.chip} padH={sizes.chipPadH} />
            {entry.level ? <Chip text={entry.level} color={c} accent size={sizes.chip} padH={sizes.chipPadH} /> : null}
          </View>
        </View>
        {showP ? (
          <ThemedText style={[styles.reading, { color: c.textHint, fontSize: sizes.reading }]} numberOfLines={1}>
            {displayReading}
          </ThemedText>
        ) : null}
        {entry.d ? (
          <ThemedText style={[styles.meaning, { color: c.textMuted, fontSize: sizes.meaning, lineHeight: Math.round(sizes.meaning * 1.35) }]} numberOfLines={2}>
            {entry.d}
          </ThemedText>
        ) : null}
      </Pressable>
    );
  }

  /* Wide: S1 (term + reading) | S2 (meaning) | chips, vertically
     centred. */
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        styles.rowWide,
        {
          backgroundColor: pressed ? c.surface2 : 'transparent',
          borderBottomColor: c.border,
        },
      ]}
    >
      <View style={[styles.sectionS1, styles.sectionS1Wide]}>
        <ThemedText style={[styles.term, { color: c.text }]} numberOfLines={1}>
          {entry.t}
        </ThemedText>
        {showP ? (
          <ThemedText style={[styles.reading, { color: c.textHint, fontSize: sizes.reading }]} numberOfLines={1}>
            {displayReading}
          </ThemedText>
        ) : null}
      </View>
      {entry.d ? (
        <View style={[styles.sectionS2, styles.sectionS2Wide, { borderLeftColor: c.border }]}>
          <ThemedText style={[styles.meaning, { color: c.textMuted, fontSize: sizes.meaning }]} numberOfLines={2}>
            {entry.d}
          </ThemedText>
        </View>
      ) : null}
      <View style={styles.chips}>
        <Chip text={TYPE_LABEL[entry.type]} color={c} size={sizes.chip} padH={sizes.chipPadH} />
        {entry.level ? <Chip text={entry.level} color={c} accent size={sizes.chip} padH={sizes.chipPadH} /> : null}
      </View>
    </Pressable>
  );
}

function Chip({ text, color: c, accent, size, padH }: { text: string; color: typeof Colors.light | typeof Colors.dark; accent?: boolean; size: number; padH: number }) {
  return (
    <View
      style={[
        styles.chip,
        {
          paddingHorizontal: padH,
          borderColor: accent ? Accent.base : c.border,
          backgroundColor: accent ? Accent.bg : c.surface2,
        },
      ]}
    >
      <ThemedText
        type="small"
        style={[styles.chipText, { fontSize: size }, accent ? { color: Accent.base } : { color: c.textMuted }]}
      >
        {text}
      </ThemedText>
    </View>
  );
}

interface FastScrollerProps {
  listRef: React.RefObject<FlashListRef<ListItem> | null>;
  listData: ListItem[];
  listJumpIndices: Map<JumpKey, number> | null;
  metricsRef: React.MutableRefObject<{ offset: number; contentHeight: number; viewportHeight: number; trackHeight: number }>;
  thumbY: SharedValue<number>;
  isDragging: SharedValue<boolean>;
  /* 0 → hidden, 1 → fully visible. Driven by the parent's
     onListScroll callback so the thumb only appears while the list
     is actually moving (mirrors native scroll-indicator behaviour). */
  visible: SharedValue<number>;
  themeColor: typeof Colors.light | typeof Colors.dark;
  showLabel: boolean;
  onLabelChange?: (next: FastToastInfo) => void;
}

/** Touch FastScroller — overlay-layer thumb pinned to the listWrap
 *  right edge. Drag = proportional scroll across the corpus (~2k
 *  entries on free tier) without the long-flick fatigue of a native
 *  scroll. Label rendering is published to the parent as a centered
 *  toast, so it never fights the native scrollbar lane on tablet. The
 *  thumb position is a Reanimated SharedValue so onScroll updates
 *  (every 16 ms) and gesture updates both stay on the UI thread. */
function FastScroller({ listRef, listData, listJumpIndices, metricsRef, thumbY, isDragging, visible, themeColor: c, showLabel, onLabelChange }: FastScrollerProps) {
  const [trackHeight, setTrackHeight] = useState(0);
  const [labelVisible, setLabelVisible] = useState(false);
  const lastPublishedLabelRef = useRef<FastToastInfo>(EMPTY_FAST_TOAST);
  /* Cached track top in window coordinates — captured on layout AND
     re-measured on every drag-begin so we stay accurate after the
     viewport scrolls/resizes between drags. The gesture handler's
     absoluteY is window-relative; pointerY-in-container = absoluteY
     minus this offset. */
  const trackRef = useRef<View>(null);
  const containerTopRef = useRef(0);

  const measureTrack = useCallback(() => {
    if (Platform.OS === 'web' && trackRef.current) {
      const node = trackRef.current as any;
      const r = node.getBoundingClientRect?.();
      if (r) containerTopRef.current = r.top;
      return;
    }
    trackRef.current?.measureInWindow?.((_x: number, y: number) => {
      containerTopRef.current = y;
    });
  }, []);

  const onTrackLayout = useCallback((e: any) => {
    const h = e.nativeEvent.layout.height;
    setTrackHeight(h);
    metricsRef.current.trackHeight = h;
    measureTrack();
  }, [metricsRef, measureTrack]);

  /* Map thumb Y → JLPT section the user is currently scrubbing
     through. Uses listData.length as the ratio basis since each cell
     has variable height in FlashList; an exact offset-to-index map
     would need a measured-heights table that isn't worth the
     complexity for a label hint. */
  const toastForY = useCallback((y: number): FastToastInfo => {
    if (listData.length === 0) return EMPTY_FAST_TOAST;
    const maxThumb = Math.max(1, trackHeight - FAST_THUMB_HEIGHT);
    const ratio = Math.max(0, Math.min(1, y / maxThumb));
    const approxIdx = Math.min(listData.length - 1, Math.floor(ratio * listData.length));
    let currentKey: JumpKey | null = null;
    let bestIdx = -1;
    if (listJumpIndices) {
      for (const [key, idx] of listJumpIndices) {
        if (idx <= approxIdx && idx > bestIdx) {
          currentKey = key;
          bestIdx = idx;
        }
      }
    }
    let currentItem: RowItem | null = null;
    for (let i = approxIdx; i >= 0; i--) {
      const candidate = listData[i];
      if (!('__header' in candidate && candidate.__header)) {
        currentItem = candidate;
        break;
      }
    }
    if (!currentItem) {
      for (let i = approxIdx + 1; i < listData.length; i++) {
        const candidate = listData[i];
        if (!('__header' in candidate && candidate.__header)) {
          currentItem = candidate;
          break;
        }
      }
    }
    const entry = currentItem?.result.entry;
    const group = entry
      ? entry.type === 'glossary'
        ? 'GLOSSARY'
        : `${entry.level ?? 'GLOSSARY'} · ${TYPE_LABEL[entry.type]}`
      : currentKey
        ? JUMP_LONG_LABEL[currentKey]
        : '';
    const reading = entry?.p[0] && entry.p[0] !== entry.t ? entry.p[0] : '';
    return {
      group,
      term: entry?.t ?? '',
      reading,
      visible: false,
    };
  }, [listJumpIndices, listData, trackHeight]);

  const publishLabel = useCallback((info: FastToastInfo, visible: boolean) => {
    const nextVisible = showLabel && visible && Boolean(info.group || info.term || info.reading);
    const next = { ...info, visible: nextVisible };
    const last = lastPublishedLabelRef.current;
    if (last.group === next.group && last.term === next.term && last.reading === next.reading && last.visible === next.visible) return;
    lastPublishedLabelRef.current = next;
    onLabelChange?.(next);
  }, [onLabelChange, showLabel]);

  /* JS-side drag tick — pointer position (window-absolute Y from the
     gesture) → container-relative pointerY → thumb top (pointer at
     thumb center) → clamp [0, trackHeight - thumbHeight] → scroll to
     matching offset. This is the canonical "drag-to-scroll" math —
     using translationY/delta from gesture-start was wrong because it
     decoupled the thumb visual from the actual pointer location
     (any sub-pixel drift between renders accumulated). */
  const onPanTo = useCallback((absoluteY: number) => {
    const pointerY = absoluteY - containerTopRef.current;
    const targetTop = pointerY - FAST_THUMB_HEIGHT / 2;
    const maxThumb = Math.max(0, trackHeight - FAST_THUMB_HEIGHT);
    const clamped = Math.max(0, Math.min(maxThumb, targetTop));
    thumbY.value = clamped;
    const ratio = maxThumb > 0 ? clamped / maxThumb : 0;
    const { contentHeight, viewportHeight } = metricsRef.current;
    const targetOffset = ratio * Math.max(0, contentHeight - viewportHeight);
    listRef.current?.scrollToOffset({ offset: targetOffset, animated: false });
    publishLabel(toastForY(clamped), true);
  }, [thumbY, trackHeight, metricsRef, listRef, toastForY, publishLabel]);

  const hideLabel = useCallback(() => {
    setLabelVisible(false);
    publishLabel(EMPTY_FAST_TOAST, false);
  }, [publishLabel]);

  const pan = useMemo(() => Gesture.Pan()
    .onBegin((e) => {
      isDragging.value = true;
      runOnJS(setLabelVisible)(true);
      runOnJS(measureTrack)();
      runOnJS(onPanTo)(e.absoluteY);
    })
    .onUpdate((e) => {
      runOnJS(onPanTo)(e.absoluteY);
    })
    .onEnd(() => {
      isDragging.value = false;
      runOnJS(hideLabel)();
    })
    .onFinalize(() => {
      isDragging.value = false;
      runOnJS(hideLabel)();
    }),
  [isDragging, onPanTo, measureTrack, hideLabel]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: thumbY.value }],
    /* Hidden by default; the parent fades `visible` to 1 on scroll
       and back to 0 after the scroll settles. While the user is
       actively dragging the thumb, force opacity to 1 so a
       mid-scrub release doesn't make the thumb blink as the
       scroll-settle timer races. */
    opacity: isDragging.value ? 1 : visible.value,
  }));
  return (
    <View ref={trackRef} style={styles.fastScrollerTrack} onLayout={onTrackLayout}>
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.fastScrollerThumb,
            /* Idle = muted graphite so the thumb reads as a passive
               index marker, not a CTA. Crimson is reserved for the
               drag-active state (mirrors how the accent is used
               elsewhere in the app — semantic emphasis only). */
            { backgroundColor: labelVisible ? Accent.base : c.textHint },
            thumbStyle,
          ]}
        />
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  /* Header column — width:'100%' so it expands to fill the available
     horizontal space, maxWidth + alignItems:center on the parent
     centers the column at MaxContentWidth. No flex:1 here so the
     header sizes to its content (Search title + input + total
     strip); flex:1 belongs on the listWrap sibling below so it
     claims the remaining vertical space. */
  headerSafe: { width: '100%', maxWidth: MaxContentWidth, zIndex: 3 },
  desktopHeaderScrim: {
    position: 'absolute',
    top: 0,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    zIndex: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    pointerEvents: 'none',
    opacity: 1,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
        } as any)
      : null),
  },
  /* Ghost kanji backdrop — sticky, anchored to ThemedView root.
     Matches Shop's muted treatment (secondary surface, not the main
     Browse page which uses crimson + larger). */
  ghostKanji: {
    position: 'absolute',
    top: 40,
    right: -20,
    fontFamily: Platform.select({ web: '"Noto Serif JP", serif', default: undefined }),
    fontSize: 200,
    lineHeight: 200,
    opacity: 0.04,
    zIndex: 0,
    pointerEvents: 'none',
  } as any,
  headerWrap: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
  headerWrapShortMobile: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  searchTitleShortMobile: {
    fontSize: 38,
    lineHeight: 42,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.three,
    height: 44,
    /* relative so the absolute accentBar anchors here. */
    position: 'relative',
    overflow: 'hidden',
    /* Smooth focus transition on web. */
    ...(Platform.OS === 'web'
      ? ({ transition: 'border-color 180ms ease' } as unknown as object)
      : null),
  },
  inputRowShortMobile: {
    height: 38,
    paddingHorizontal: Spacing.two,
    gap: Spacing.one,
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Accent.base,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
    /* Strip native focus ring on web — replaced by crimson border + glow on parent. */
    ...(Platform.OS === 'web'
      ? ({ outlineStyle: 'none', outlineWidth: 0 } as unknown as object)
      : null),
  },
  clearBtn: { padding: 4 },
  /* Tiny marginal hint shown only on initial empty state — sits below
     the status line. Mixed Thai+JP so we stay on the default app
     font (mono Latin can't render JP), but smaller letter-spacing +
     fontSize keeps the "marginal annotation" feel GPT asked for. */
  queryHint: {
    fontSize: 11,
    letterSpacing: 0.4,
  },
  queryHintShortMobile: {
    fontSize: 10,
    lineHeight: 14,
  },
  /* Touch/tablet default: keep the list bound to the centered content
     rail. Desktop overrides this below so the scroll surface becomes
     page-wide while rows remain centered through cellWrap. */
  listWrap: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  desktopListWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    maxWidth: '100%' as any,
    alignSelf: 'stretch',
    zIndex: 1,
  },
  listContent: {
    paddingBottom: BottomTabInset + Spacing.four,
  },
  /* Per-cell horizontal inset + maxWidth column re-centering. The
     cells live inside a full-viewport-wide FlashList but visually
     stay in the same MaxContentWidth column as the header, so the
     row content doesn't drift left when the scroll surface widens.
     Padding replaces the contentContainerStyle paddingHorizontal so
     sticky headers (re-parented into FlashList's absolute wrapper)
     inherit the same inset as their inline twins — no horizontal
     jump on the sticky-pin transition. */
  cellWrap: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
  },
  empty: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  /* Total strip — sits between header cluster and result list,
     left-aligned count + right-aligned refresh icon. Editorial mono
     uppercase, thin bottom rule to separate from the list. */
  totalStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  totalStripShortMobile: {
    paddingTop: Spacing.one,
    paddingBottom: Spacing.one,
  },
  refreshBtn: {
    padding: Spacing.one,
    borderRadius: Radii.sm,
  },
  totalText: {
    fontFamily: Platform.select({ web: 'JetBrains Mono, monospace', default: undefined }),
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  totalNumber: {
    fontFamily: Platform.select({ web: 'JetBrains Mono, monospace', default: undefined }),
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  /* S1 | S2 | chips row container. alignItems:center centres the chip
     cluster on the row's vertical midpoint regardless of how many
     lines S1 + S2 render. Hairline bottom border separates rows
     without claiming a full surface-fill weight. */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowWide: { gap: Spacing.three },
  /* Mobile card layout — flex column so term/reading/meaning stack as
     a single self-contained entry. row's alignItems:'center' would
     centre each child horizontally — override to stretch so children
     fill the row width. Tighter padding + gap than wide rows since
     each entry is now 3 stacked lines instead of 1. */
  rowCompactCard: {
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingVertical: 6,
    paddingHorizontal: Spacing.two,
    gap: 2,
  },
  /* Top row inside the compact card — term + chips horizontally
     opposed so the chip cluster anchors to the right edge of the
     card without claiming a second row. */
  compactTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  /* Compact text scales — knock 1-2 px off the wide sizes so the
     stacked card stays under ~70 px instead of bulging to 100 px. */
  termCompact: { fontSize: 15 },
  readingCompact: { fontSize: 11 },
  meaningCompact: { fontSize: 12, lineHeight: 16 },
  /* S1 — Japanese identity: term (large) + reading (mono small). */
  sectionS1: { gap: 2 },
  sectionS1Wide: { flex: 0, flexBasis: 140 },
  /* S2 — Thai meaning. Hairline left rule visually splits it from S1
     on wide viewports. */
  sectionS2: { flex: 1 },
  sectionS2Wide: { paddingLeft: Spacing.three, borderLeftWidth: StyleSheet.hairlineWidth },
  term: { fontSize: 17, fontWeight: '500' },
  reading: {
    fontFamily: Platform.select({ web: 'JetBrains Mono, monospace', default: undefined }),
    fontSize: 12,
  },
  meaning: { fontSize: 13, lineHeight: 18 },
  chips: { flexDirection: 'row', gap: Spacing.one, alignItems: 'center', flexShrink: 0 },
  /* Inline section header — single-line, surface2 fill so it reads
     as a divider against the transparent rows. Pressable: opens
     JumpGridModal. Tight vertical padding keeps the header from
     out-claiming the entry rows below. marginRight (the scrollbar
     gutter) is set inline in the component since the value depends
     on viewport compactness — overlay scrollbars on mobile claim
     near-zero gutter, so the desktop-sized inset would leave a big
     empty stripe on the right edge of compact layouts. */
  sectionHeader: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionHeaderLabel: {
    fontFamily: Platform.select({ web: 'JetBrains Mono, monospace', default: undefined }),
    fontSize: 12,
    letterSpacing: 1.2,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  sectionHeaderCount: { fontSize: 11, fontWeight: '400', letterSpacing: 0.6 },
  /* Jump grid modal — Start-menu-style letter grid. Overlay covers the
     viewport; panel is centred, fixed-width on desktop, near-full
     width on mobile. */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  modalPanel: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  /* Compact list inside the modal — each row is a section, with a
     hairline bottom border separating rows. Tighter than a tile grid
     and scales cleanly whether the corpus exposes 2 sections or 6. */
  modalList: { borderTopWidth: StyleSheet.hairlineWidth },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalRowLabel: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  modalRowCount: {
    fontFamily: Platform.select({ web: 'JetBrains Mono, monospace', default: undefined }),
    fontSize: 12,
    letterSpacing: 0.6,
  },
  chip: {
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  chipText: { fontSize: 10, letterSpacing: 0.8 },
  /* FastScroller — absolute floating overlay anchored a few pixels
     inside listWrap's right edge so the thumb visually aligns with
     the row content rather than hugging the container edge (felt
     visually cramped at right: 2). box-none on the track so only
     the visible thumb block captures taps; the hairline rail
     underneath is decorative and never intercepts events. zIndex
     above the row content so the block reads on top of cells
     regardless of scroll position. */
  fastScrollerTrack: {
    position: 'absolute',
    top: Spacing.two,
    bottom: Spacing.two,
    /* 8 px from the listWrap right edge — tighter than GPT's
       suggested 14-18 px lane separation, but the user prefers the
       thumb sit closer to the native scrollbar. With the thumb
       hidden at rest the visual-redundancy concern that motivated
       the larger gap is mostly resolved on its own. */
    right: 8,
    width: FAST_TRACK_WIDTH,
    zIndex: 10,
    pointerEvents: 'box-none',
  },
  /* (Hairline rail removed 2026-05-29 — user feedback: the vertical
     line competed with the row dividers and the native scrollbar,
     reading as visual redundancy. The thumb alone now carries the
     editorial-index-marker shape.) */
  /* Sharp-edged crimson block — editorial typographic block, not a
     pill. No border-radius keeps it consistent with the rest of the
     UI's sharp-only radii scale. */
  fastScrollerThumb: {
    position: 'absolute',
    top: 0,
    right: (FAST_TRACK_WIDTH - FAST_THUMB_WIDTH) / 2,
    width: FAST_THUMB_WIDTH,
    height: FAST_THUMB_HEIGHT,
    borderRadius: 0,
  },
  /* Center toast for fast-scroll section feedback. It sits away from
     the native scrollbar / FastScroller lane, uses no layout space,
     and never intercepts pointer events. */
  fastScrollerToastLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 11,
  },
  fastScrollerToastLayerTablet: {
    transform: [{ translateY: 56 }],
  },
  fastScrollerToastLayerCompact: {
    paddingTop: 48,
  },
  fastScrollerToast: {
    minWidth: 188,
    maxWidth: 320,
    minHeight: 64,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderWidth: 1,
    borderRadius: Radii.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: Spacing.three,
    pointerEvents: 'none',
    ...Platform.select({
      web: ({
        boxShadow: '0 14px 30px rgba(0,0,0,0.18)',
        backdropFilter: 'blur(18px) saturate(145%)',
        WebkitBackdropFilter: 'blur(18px) saturate(145%)',
      } as unknown as object),
      default: { elevation: 8 },
    }),
  },
  fastScrollerToastCompact: {
    minWidth: 150,
    maxWidth: 234,
    minHeight: 52,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  fastScrollerToastAccent: {
    width: 6,
    height: 38,
    backgroundColor: Accent.base,
  },
  fastScrollerToastAccentCompact: {
    width: 5,
    height: 30,
  },
  fastScrollerToastCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  fastScrollerToastGroup: {
    fontFamily: Platform.select({ web: 'JetBrains Mono, monospace', default: undefined }),
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  fastScrollerToastGroupCompact: {
    fontSize: 9,
    letterSpacing: 1,
  },
  fastScrollerToastTerm: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0,
  },
  fastScrollerToastTermCompact: {
    fontSize: 15,
  },
  fastScrollerToastReading: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  fastScrollerToastReadingCompact: {
    fontSize: 10,
  },
});
