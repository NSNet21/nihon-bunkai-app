import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { FiSearch, FiX } from 'react-icons/fi';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FOCUS_SEARCH_EVENT } from '@/components/search-shortcut';
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

/* JLPT level → sort weight. Glossary entries (level === null) sort last
   so the browse-all view + jump strip both read top-down N5→N1→G. */
const LEVEL_ORDER: Record<string, number> = { N5: 0, N4: 1, N3: 2, N2: 3, N1: 4 };
function levelWeight(level: JlptLevel | null): number {
  return level ? LEVEL_ORDER[level] ?? 5 : 5;
}
type JumpKey = JlptLevel | 'GLOSSARY';
const JUMP_KEYS: JumpKey[] = ['N5', 'N4', 'N3', 'N2', 'N1', 'GLOSSARY'];
const JUMP_LONG_LABEL: Record<JumpKey, string> = {
  N5: 'N5 · พื้นฐาน', N4: 'N4 · ต้น', N3: 'N3 · กลาง',
  N2: 'N2 · สูง', N1: 'N1 · สูงสุด', GLOSSARY: 'GLOSSARY · ศัพท์รวม',
};

/* Union of items the FlashList renders. Headers carry their JLPT key
   + the row count for the section caption; rows wrap the existing
   SearchResult shape. Discriminator field `__header` distinguishes
   the two in renderItem + getItemType. */
type SectionHeaderItem = { __header: true; id: string; key: JumpKey; count: number };
type RowItem = { __header?: false; id: string; result: SearchResult };
type ListItem = SectionHeaderItem | RowItem;

export default function SearchScreen() {
  const router = useRouter();
  const c = useThemePalette();

  const { ready, totalEntries, allEntries, run } = useSearchIndex();
  const { width: viewportW } = useWindowDimensions();
  const compact = viewportW > 0 && viewportW < 480;

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlashListRef<ListItem>>(null);

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
      if ('__header' in item && item.__header) {
        return <SectionHeaderRow keyName={item.key} count={item.count} themeColor={c} onPress={openJumpGrid} />;
      }
      const r = item.result;
      return (
        <ResultRow
          result={r}
          onPress={() => openEntry(r.entry.deckId, r.entry.id)}
          themeColor={c}
          compact={compact}
        />
      );
    },
    [c, openEntry, compact, openJumpGrid],
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
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.headerWrap}>
          <ThemedText type="title">Search</ThemedText>

          <View
            style={[
              styles.inputRow,
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
            <ThemedText style={[styles.queryHint, { color: c.textHint }]}>
              ลอง: 食べる · 一緒 · 〜ように
            </ThemedText>
          )}
        </View>

        {/* Total strip — left-aligned count above the result list.
            "ทั้งหมด N รายการ" reflects the full corpus when no query
            is active, or the matched subset when filtering. Always
            visible once the index is ready so the count is always one
            glance away. */}
        {ready && hasResults && (
          <View style={[styles.totalStrip, { borderBottomColor: c.border }]}>
            <ThemedText style={[styles.totalText, { color: c.textMuted }]}>
              ทั้งหมด <ThemedText style={[styles.totalNumber, { color: c.text }]}>{results.length.toLocaleString()}</ThemedText> รายการ
              {hasQuery && results.length !== totalEntries ? (
                <ThemedText style={[styles.totalText, { color: c.textHint }]}>
                  {' '}· จาก {totalEntries.toLocaleString()}
                </ThemedText>
              ) : null}
            </ThemedText>
          </View>
        )}

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
          contentContainerStyle={styles.listContent}
          renderItem={renderItem}
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
        <JumpGridModal
          visible={jumpGridOpen}
          themeColor={c}
          availableKeys={listJumpIndices ? JUMP_KEYS.filter((k) => listJumpIndices.has(k)) : []}
          counts={sectionCounts}
          onPick={jumpFromGrid}
          onClose={closeJumpGrid}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

interface SectionHeaderProps {
  keyName: JumpKey;
  count: number;
  themeColor: typeof Colors.light | typeof Colors.dark;
  onPress: () => void;
}

/** Inline section header — scroll-along (not sticky). Background sits
 *  one surface step above the row baseline so the eye registers it
 *  as a divider, not another entry. Tapping it opens the JumpGrid
 *  modal so the user can hop to any other section without scrubbing. */
function SectionHeaderRow({ keyName, count, themeColor: c, onPress }: SectionHeaderProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed, hovered }: any) => [
        styles.sectionHeader,
        {
          backgroundColor: hovered ? c.surface3 : c.surface2,
          borderBottomColor: c.border,
          borderTopColor: c.border,
        },
        pressed && { opacity: 0.85 },
      ]}>
      <ThemedText style={[styles.sectionHeaderLabel, { color: c.textMuted }]} numberOfLines={1}>
        // {JUMP_LONG_LABEL[keyName]} <ThemedText style={[styles.sectionHeaderCount, { color: c.textHint }]}>· {count.toLocaleString()} รายการ</ThemedText>
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
}

function ResultRow({ result, onPress, themeColor: c, compact }: RowProps) {
  const { entry } = result;
  /* p is the expanded variants array; show the first reading (cleaned, no Kunyomi: prefix).
     Skip if it duplicates the term itself (kana entries where T == P). */
  const displayReading = entry.p[0] ?? '';
  const showP = displayReading && displayReading !== entry.t;

  /* S1 | S2 | chips layout (per user annotation).
       S1 = term + reading (the identity)
       S2 = Thai meaning (the lookup answer)
       chips = type + level, vertically centred at row midpoint
     Row uses alignItems:center so chips anchor to the row's vertical
     centre regardless of how many lines S1 / S2 render. On compact
     viewports (<480 px) S2 wraps under S1 so the meaning gets full
     row width — desktop keeps the side-by-side columns. */
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        compact ? styles.rowCompact : styles.rowWide,
        {
          backgroundColor: pressed ? c.surface2 : 'transparent',
          borderBottomColor: c.border,
        },
      ]}
    >
      <View style={[styles.sectionS1, compact ? styles.sectionS1Compact : styles.sectionS1Wide]}>
        <ThemedText style={[styles.term, { color: c.text }]} numberOfLines={1}>
          {entry.t}
        </ThemedText>
        {showP ? (
          <ThemedText style={[styles.reading, { color: c.textHint }]} numberOfLines={1}>
            {displayReading}
          </ThemedText>
        ) : null}
      </View>
      {entry.d ? (
        <View style={[styles.sectionS2, compact ? styles.sectionS2Compact : styles.sectionS2Wide, { borderLeftColor: c.border }]}>
          <ThemedText style={[styles.meaning, { color: c.textMuted }]} numberOfLines={compact ? 2 : 2}>
            {entry.d}
          </ThemedText>
        </View>
      ) : null}
      <View style={styles.chips}>
        <Chip text={TYPE_LABEL[entry.type]} color={c} />
        {entry.level ? <Chip text={entry.level} color={c} accent /> : null}
      </View>
    </Pressable>
  );
}

function Chip({ text, color: c, accent }: { text: string; color: typeof Colors.light | typeof Colors.dark; accent?: boolean }) {
  return (
    <View
      style={[
        styles.chip,
        {
          borderColor: accent ? Accent.base : c.border,
          backgroundColor: accent ? Accent.bg : c.surface2,
        },
      ]}
    >
      <ThemedText
        type="small"
        style={[styles.chipText, accent ? { color: Accent.base } : { color: c.textMuted }]}
      >
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
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
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  empty: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  /* Total strip — sits between header cluster and result list, left-
     aligned per user spec ("ทั้งหมด N รายการ" aligned left). Editorial
     mono uppercase, thin bottom rule to separate from the list. */
  totalStrip: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  rowCompact: { gap: Spacing.two, flexWrap: 'wrap' },
  /* S1 — Japanese identity: term (large) + reading (mono small). */
  sectionS1: { gap: 2 },
  sectionS1Wide: { flex: 0, flexBasis: 140 },
  sectionS1Compact: { flexBasis: '40%', minWidth: 110 },
  /* S2 — Thai meaning. Hairline left rule visually splits it from S1
     on wide viewports. On compact viewports the rule moves to the
     top (we use only borderLeft so on compact we skip applying it). */
  sectionS2: { flex: 1 },
  sectionS2Wide: { paddingLeft: Spacing.three, borderLeftWidth: StyleSheet.hairlineWidth },
  sectionS2Compact: { paddingLeft: 0, flexBasis: '100%' },
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
     out-claiming the entry rows below. */
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
});
