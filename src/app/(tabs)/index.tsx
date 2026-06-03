import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import {
  FiChevronDown,
  FiChevronsDown,
  FiChevronsUp,
  FiLayers,
  FiLock,
  FiMinusSquare,
  FiPlusSquare,
  FiSearch,
  FiX,
} from 'react-icons/fi';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ContinueCard } from '@/components/continue-card';
import { LibraryActionsModal } from '@/components/library-actions-modal';
import { PressableScale } from '@/components/pressable-scale';
import { ScrollToTop } from '@/components/scroll-to-top';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/auth';
import { useThemePalette } from '@/context/theme';
import { useAllDecks } from '@/hooks/use-decks';
import { usePersistedState } from '@/hooks/use-persisted-state';
import { Accent, BottomTabInset, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import type { Deck } from '@/data/types';
import {
  buildBrowseRows,
  filterBrowseDecks,
  groupSearchHasQuery,
  type BrowseRow,
} from '@/lib/browse-group-search';
import type { LastSession } from '@/lib/last-session';

const SCROLL_TOP_THRESHOLD = 400;

export default function BrowseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ scrollTop?: string }>();
  const [closedLevels, setClosedLevels] = useState<Set<string>>(new Set());
  const [closedCategories, setClosedCategories] = useState<Set<string>>(new Set());
  const [subsOnly, setSubsOnly] = useState(false);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [librarySearchOpen, setLibrarySearchOpen] = useState(false);
  const listRef = useRef<FlashListRef<BrowseRow>>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [libraryActionsOpen, setLibraryActionsOpen] = useState(false);
  const colors = useThemePalette();
  const scrollTopParam = Array.isArray(params.scrollTop) ? params.scrollTop[0] : params.scrollTop;

  const { decks, refresh } = useAllDecks();
  const [lastSession] = usePersistedState<LastSession | null>('last-session', null);
  const [lastSessionLearn] = usePersistedState<LastSession | null>('last-session-learn', null);

  /* Only surface Continue CTA when the resume target is still valid:
     - deck must exist in current allDecks (user might have lost entitlement)
     - session must not be on the final card (handled by Study clearing on rate)
     - guard against stale shape from older app versions */
  const continueDeck =
    lastSession && decks.find((d) => d.id === lastSession.deckId);
  const showContinue =
    !!lastSession &&
    !!continueDeck &&
    typeof lastSession.index === 'number' &&
    typeof lastSession.total === 'number' &&
    lastSession.index < lastSession.total - 1;
  /* Learn-mode Continue — independent of Quiz. Survives even after
     Quiz session completes (Learn is passive, no "completion"). Shown
     when entries are not yet exhausted in the same deck/total. */
  const continueDeckLearn =
    lastSessionLearn && decks.find((d) => d.id === lastSessionLearn.deckId);
  const showContinueLearn =
    !!lastSessionLearn &&
    !!continueDeckLearn &&
    typeof lastSessionLearn.index === 'number' &&
    typeof lastSessionLearn.total === 'number' &&
    lastSessionLearn.index < lastSessionLearn.total - 1;

  /* Recompute group keys when decks change (free + paid merged). */
  const { allLevelKeys, allCategoryKeys } = useMemo(() => {
    const lvls = new Set<string>();
    const cats = new Set<string>();
    for (const d of decks) {
      const lvl = d.level ?? 'GLOSSARY';
      lvls.add(lvl);
      if (d.type !== 'glossary') cats.add(`${lvl}/${d.type}`);
    }
    return { allLevelKeys: Array.from(lvls), allCategoryKeys: Array.from(cats) };
  }, [decks]);

  /* Stable callbacks so memoized list rows (DeckRow / LevelHeader /
     CategoryHeader) can skip re-renders when only unrelated state
     changes. setClosedLevels uses the functional updater form so the
     closure doesn't need to track current state. */
  const toggleLevel = useCallback((level: string) => {
    setClosedLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  }, []);

  const toggleCategory = useCallback((key: string) => {
    setClosedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  function expandAll() {
    if (!subsOnly) setClosedLevels(new Set());
    setClosedCategories(new Set());
  }

  function collapseAll() {
    if (!subsOnly) setClosedLevels(new Set(allLevelKeys));
    setClosedCategories(new Set(allCategoryKeys));
  }

  const toggleToolbarScope = useCallback(() => {
    setSubsOnly((prev) => {
      const next = !prev;
      if (next) setClosedLevels(new Set());
      return next;
    });
  }, []);

  const hasGroupSearch = groupSearchHasQuery(groupSearchQuery);
  const filteredDecks = useMemo(
    () => filterBrowseDecks(decks, groupSearchQuery),
    [decks, groupSearchQuery],
  );
  const librarySearchRows = useMemo(
    () => buildBrowseRows(filteredDecks, new Set(), new Set(), true),
    [filteredDecks],
  );
  const rows = useMemo(
    () => buildBrowseRows(decks, closedLevels, closedCategories),
    [decks, closedLevels, closedCategories],
  );
  const groupSearchEmpty = hasGroupSearch && filteredDecks.length === 0;

  useEffect(() => {
    if (!scrollTopParam) return;
    const id = setTimeout(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
      setShowScrollTop(false);
    }, 0);
    return () => clearTimeout(id);
  }, [scrollTopParam]);

  const libraryStats = useMemo(() => {
    let totalEntries = 0;
    let paidPackCount = 0;
    for (const deck of decks) {
      totalEntries += deck.entryCount;
      if (!deck.isFree) paidPackCount += 1;
    }
    return {
      totalEntries,
      packCount: decks.length,
      paidPackCount,
    };
  }, [decks]);
  const librarySubtitle = libraryStats.paidPackCount > 0
    ? `${libraryStats.totalEntries} entries · ${libraryStats.packCount} packs · พร้อมเรียน`
    : `${libraryStats.totalEntries} entries · ${libraryStats.packCount} packs ฟรี · ดูเพิ่มที่ Shop`;

  /* renderItem stable across renders — depends only on the two stable
     toggle callbacks. Together with React.memo'd row components, this
     lets FlashList skip re-rendering rows when only unrelated state
     (e.g. showScrollTop) changes in the parent. */
  const renderItem = useCallback(({ item }: { item: BrowseRow }) => {
    let inner;
    if (item.kind === 'levelHeader')
      inner = (
        <LevelHeader
          level={item.level}
          title={item.title}
          isOpen={item.isOpen}
          childCount={item.childCount}
          onToggle={toggleLevel}
        />
      );
    else if (item.kind === 'categoryHeader')
      inner = (
        <CategoryHeader
          levelKey={`${item.level}/${item.category}`}
          title={item.title}
          isOpen={item.isOpen}
          childCount={item.childCount}
          onToggle={toggleCategory}
        />
      );
    else inner = <DeckRow deck={item.deck} isLast={item.isLast} />;

    return <View style={styles.rowWrap}>{inner}</View>;
  }, [toggleLevel, toggleCategory]);

  return (
    <ThemedView style={styles.container}>
      {/* Top crimson accent stripe — runs edge-to-edge above safe area. */}
      <View style={styles.topAccentBar} />
      {/* Ghost kanji 学 — faint editorial decoration, behind all content. */}
      <ThemedText style={styles.ghostKanji}>学</ThemedText>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <FlashList<BrowseRow>
          ref={listRef}
          data={rows}
          keyExtractor={(item) => item.key}
          getItemType={(item) => item.kind}
          onScroll={(e) => {
            const y = e.nativeEvent.contentOffset.y;
            setShowScrollTop((prev) => {
              const next = y > SCROLL_TOP_THRESHOLD;
              return prev === next ? prev : next;
            });
          }}
          scrollEventThrottle={100}
          ListHeaderComponent={
            <View style={styles.headerWrap}>
              {/* Hero — editorial display headline with mono sub label */}
              <View style={styles.subLabelRow}>
                <View style={styles.pip} />
                <ThemedText type="small" themeColor="textHint" style={styles.subLabel}>
                  // BROWSE · คลังคำศัพท์
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary" style={styles.heroSubtitle}>
                {librarySubtitle}
              </ThemedText>
              {/* Multi-deck Study entry — utility row treatment per GPT
                  round-3 verdict ("pill ควรเป็น tool/action ไม่ใช่
                  content card"). Thin border on top only + tighter
                  padding + stronger arrow distinguishes it from the
                  Continue cards below. */}
              <PressableScale
                onPress={() => router.push('/group-picker')}
                accessibilityRole="button"
                accessibilityLabel="รวมหลาย pack เป็น session เดียว"
                style={[
                  styles.groupPickerEntry,
                  { borderTopColor: colors.border, borderBottomColor: colors.border },
                ]}>
                <FiLayers size={13} color={Accent.base} strokeWidth={2} />
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.groupPickerLabel, { color: Accent.base }]}>
                    GROUP STUDY
                  </ThemedText>
                  <ThemedText style={[styles.groupPickerSub, { color: colors.textMuted }]}>
                    รวมหลาย pack เป็น session เดียว
                  </ThemedText>
                </View>
                <ThemedText style={[styles.groupPickerArrow, { color: Accent.base }]}>→</ThemedText>
              </PressableScale>
              {/* Parent kicker for the Continue cards — without it, the
                  two QUIZ/LEARN CONTINUE labels read as orphans. GPT
                  polish round 2026-05-27. Renders only when at least one
                  Continue card is showing, so the kicker never appears
                  empty. */}
              {(showContinue || showContinueLearn) && (
                <View style={styles.continueGroupHead}>
                  <View style={[styles.continuePip, { backgroundColor: Accent.base }]} />
                  <ThemedText style={[styles.continueKicker, { color: colors.textHint }]}>
                    // CONTINUE · เรียนต่อ
                  </ThemedText>
                </View>
              )}
              {/* LEARN above QUIZ — passive review usually precedes active
                  testing in the user's flow (user preference 2026-05-27). */}
              {showContinueLearn && lastSessionLearn && (
                <ContinueCard lastSession={lastSessionLearn} colors={colors} mode="learn" />
              )}
              {showContinue && lastSession && (
                <ContinueCard lastSession={lastSession} colors={colors} mode="quiz" />
              )}
              <View style={[styles.librarySectionDivider, { backgroundColor: colors.border }]} />
              <View style={styles.libraryBlockHead}>
                <View style={styles.libraryGroupHead}>
                  <View style={[styles.libraryPip, { backgroundColor: Accent.base }]} />
                  <View style={styles.libraryTitleStack}>
                    <ThemedText type="defaultSemiBold" style={styles.libraryTitle}>
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
            </View>
          }
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      </SafeAreaView>
      <LibraryActionsModal
        visible={libraryActionsOpen}
        decks={decks}
        onClose={() => setLibraryActionsOpen(false)}
        onImported={refresh}
      />
      <LibrarySearchModal
        visible={librarySearchOpen}
        query={groupSearchQuery}
        rows={librarySearchRows}
        resultCount={filteredDecks.length}
        empty={groupSearchEmpty}
        onChangeQuery={setGroupSearchQuery}
        onClose={() => setLibrarySearchOpen(false)}
      />
      <ScrollToTop
        visible={showScrollTop}
        onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
      />
    </ThemedView>
  );
}

/** Mobile-convention press scale: 1 → 0.94 on press, springs back on release. */
function ScaleButton({
  onPress,
  children,
  style,
  accessibilityLabel,
}: {
  onPress: () => void;
  children: React.ReactNode;
  style?: any;
  accessibilityLabel?: string;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withTiming(0.94, { duration: 90, easing: Easing.bezier(0.4, 0, 0.2, 1) });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: 220, easing: Easing.bezier(0.34, 1.56, 0.64, 1) });
        }}
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [style, pressed && { opacity: 0.85 }]}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

function Toolbar({
  onOpenLibrarySearch,
  onExpandAll,
  onCollapseAll,
  subsOnly,
  onToggleSubsOnly,
  onOpenLibraryActions,
}: {
  onOpenLibrarySearch: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  subsOnly: boolean;
  onToggleSubsOnly: () => void;
  onOpenLibraryActions: () => void;
}) {
  const colors = useThemePalette();
  const { width } = useWindowDimensions();
  const [searchTriggerActive, setSearchTriggerActive] = useState(false);
  const searchOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCompact = width < 520;
  const useTouchIcons = width < 900;
  const expandLabel = isCompact ? 'Open' : 'Expand';
  const collapseLabel = isCompact ? 'Fold' : 'Collapse';
  const scopeLabel = subsOnly ? 'Group' : 'All';
  const ExpandIcon = useTouchIcons ? FiPlusSquare : FiChevronsDown;
  const CollapseIcon = useTouchIcons ? FiMinusSquare : FiChevronsUp;

  useEffect(() => () => {
    if (searchOpenTimerRef.current) clearTimeout(searchOpenTimerRef.current);
  }, []);

  const openLibrarySearchWithFeedback = useCallback(() => {
    if (searchOpenTimerRef.current) clearTimeout(searchOpenTimerRef.current);
    setSearchTriggerActive(true);
    searchOpenTimerRef.current = setTimeout(() => {
      onOpenLibrarySearch();
      setSearchTriggerActive(false);
      searchOpenTimerRef.current = null;
    }, 210);
  }, [onOpenLibrarySearch]);

  return (
    <View style={styles.toolbarStack}>
      <Pressable
        onPress={openLibrarySearchWithFeedback}
        accessibilityRole="button"
        accessibilityLabel="เปิด Library Search"
        style={({ pressed }) => [
          styles.librarySearchDock,
          {
            borderColor: pressed || searchTriggerActive ? Accent.base : colors.border,
            backgroundColor: colors.surface,
          },
          searchTriggerActive && styles.librarySearchDockActive,
          pressed && styles.headerPressed,
        ]}>
        <FiSearch size={15} color={searchTriggerActive ? Accent.base : colors.textMuted} />
        <ThemedText type="small" style={[styles.librarySearchDockText, { color: colors.textSecondary }]}>
          ค้นในคลังคำ · level / group / deck
        </ThemedText>
      </Pressable>
      <View style={styles.toolbar}>
        <ScaleButton
          onPress={onToggleSubsOnly}
          accessibilityLabel={subsOnly ? 'Switch toolbar scope to all groups' : 'Switch toolbar scope to group only'}
          style={[
            styles.scopeBtn,
            {
              borderColor: subsOnly ? Accent.base : colors.border,
              backgroundColor: subsOnly ? Accent.bg : 'transparent',
            },
          ]}>
          <View style={styles.toolBtnContent}>
            <ThemedText type="small" style={{ color: subsOnly ? Accent.base : colors.textSecondary }}>
              {scopeLabel}
            </ThemedText>
          </View>
        </ScaleButton>
        <ScaleButton
          onPress={onExpandAll}
          accessibilityLabel={subsOnly ? 'Expand groups' : 'Expand all'}
          style={[styles.toolBtn, { borderColor: colors.border }]}>
          <View style={styles.toolBtnContent}>
            <ExpandIcon size={14} color={colors.text} />
            <ThemedText type="small" themeColor="textSecondary">{expandLabel}</ThemedText>
          </View>
        </ScaleButton>
        <ScaleButton
          onPress={onCollapseAll}
          accessibilityLabel={subsOnly ? 'Collapse groups' : 'Collapse all'}
          style={[styles.toolBtn, { borderColor: colors.border }]}>
          <View style={styles.toolBtnContent}>
            <CollapseIcon size={14} color={colors.text} />
            <ThemedText type="small" themeColor="textSecondary">{collapseLabel}</ThemedText>
          </View>
        </ScaleButton>
        <ScaleButton
          onPress={onOpenLibraryActions}
          accessibilityLabel="เปิด Import / Export"
          style={[styles.toolBtn, { borderColor: colors.border }]}>
          <View style={styles.toolBtnContent}>
            <ThemedText type="small" style={{ color: Accent.base }}>+</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{isCompact ? 'Lib' : 'Library'}</ThemedText>
          </View>
        </ScaleButton>
      </View>
    </View>
  );
}

function LibrarySearchModal({
  visible,
  query,
  rows,
  resultCount,
  empty,
  onChangeQuery,
  onClose,
}: {
  visible: boolean;
  query: string;
  rows: BrowseRow[];
  resultCount: number;
  empty: boolean;
  onChangeQuery: (query: string) => void;
  onClose: () => void;
}) {
  const colors = useThemePalette();
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const active = groupSearchHasQuery(query);

  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(id);
  }, [visible]);

  const openDeck = useCallback((deckId: string) => {
    onClose();
    router.push(`/deck/${deckId}` as never);
  }, [onClose, router]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.librarySearchOverlay}>
        <Pressable accessibilityLabel="ปิด Library Search" style={styles.librarySearchBackdrop} onPress={onClose} />
        <View style={[styles.librarySearchPanel, { backgroundColor: colors.bg, borderColor: colors.borderStrong }]}>
          <View style={styles.librarySearchHead}>
            <View style={[styles.libraryPip, { backgroundColor: Accent.base }]} />
            <ThemedText style={[styles.libraryKicker, { color: colors.textHint }]}>
              // LIBRARY SEARCH · ค้นในคลังคำ
            </ThemedText>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="ปิด Library Search"
              hitSlop={8}
              style={styles.librarySearchClose}>
              {({ pressed }) => <FiX size={17} color={pressed ? Accent.base : colors.textSecondary} />}
            </Pressable>
          </View>
          <View style={[styles.librarySearchInputShell, { backgroundColor: colors.surface, borderColor: active ? Accent.base : colors.border }]}>
            <FiSearch size={17} color={active ? Accent.base : colors.textMuted} />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={onChangeQuery}
              placeholder="N5 / kanji / pack 02 / vocab"
              placeholderTextColor={colors.textMuted}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              accessibilityLabel="Library Search"
              style={[styles.librarySearchInput, { color: colors.text }]}
            />
            {active && (
              <Pressable
                onPress={() => onChangeQuery('')}
                accessibilityRole="button"
                accessibilityLabel="ล้าง Library Search"
                hitSlop={8}
                style={({ pressed }) => [styles.groupSearchClear, pressed && styles.groupSearchClearActive]}>
                {({ pressed }) => <FiX size={15} color={pressed ? colors.bg : Accent.base} />}
              </Pressable>
            )}
          </View>

          {!active ? null : empty ? (
            <View style={styles.librarySearchQuietState}>
              <ThemedText type="defaultSemiBold" style={{ color: Accent.base }}>ไม่พบผลลัพธ์</ThemedText>
              <ThemedText type="small" style={{ color: colors.textMuted }}>
                ลองค้นด้วย level, group, deck title หรือ pack number
              </ThemedText>
            </View>
          ) : (
            <>
              <View style={styles.librarySearchResultHead}>
                <ThemedText type="smallBold" style={{ color: Accent.base }}>ผลลัพธ์ใน Library</ThemedText>
                <ThemedText type="small" style={{ color: colors.textMuted }}>{resultCount} decks</ThemedText>
              </View>
              <ScrollView style={styles.librarySearchResults} contentContainerStyle={styles.librarySearchResultsInner} keyboardShouldPersistTaps="handled">
                {rows.map((row) => (
                  <LibrarySearchResultRow key={row.key} row={row} colors={colors} onOpenDeck={openDeck} />
                ))}
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function LibrarySearchResultRow({
  row,
  colors,
  onOpenDeck,
}: {
  row: BrowseRow;
  colors: ReturnType<typeof useThemePalette>;
  onOpenDeck: (deckId: string) => void;
}) {
  if (row.kind === 'levelHeader') {
    return (
      <View style={styles.librarySearchLevelRow}>
        <View style={styles.levelRule} />
        <ThemedText type="defaultSemiBold" style={[styles.levelTitle, { color: Accent.base }]}>
          {row.title}
        </ThemedText>
        <ThemedText type="small" style={{ color: colors.textMuted }}>{row.childCount}</ThemedText>
      </View>
    );
  }

  if (row.kind === 'categoryHeader') {
    return (
      <View style={styles.librarySearchCategoryRow}>
        <ThemedText type="smallBold" style={[styles.categoryTitle, { color: colors.textSecondary }]}>
          {row.title}
        </ThemedText>
        <ThemedText type="small" style={{ color: colors.textHint }}>{row.childCount}</ThemedText>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => onOpenDeck(row.deck.id)}
      accessibilityRole="link"
      accessibilityLabel={`เปิด ${row.deck.title}`}
      style={({ pressed }) => [
        styles.librarySearchDeckRow,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && { borderColor: Accent.base, backgroundColor: colors.surface2 },
      ]}>
      <View style={styles.deckStripe} />
      <ThemedText type="defaultSemiBold" style={styles.librarySearchDeckTitle}>
        {row.deck.title}
      </ThemedText>
      <ThemedText type="small" style={[styles.librarySearchDeckCount, { color: colors.textMuted }]}>
        {row.deck.entryCount}
      </ThemedText>
    </Pressable>
  );
}

/** Chevron rotates 0deg → -90deg when group collapses (mobile-convention) */
function AnimatedChevron({ isOpen, size, color }: { isOpen: boolean; size: number; color: string }) {
  const rotation = useSharedValue(isOpen ? 0 : -90);
  useEffect(() => {
    rotation.value = withTiming(isOpen ? 0 : -90, {
      duration: 220,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
  }, [isOpen, rotation]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  return (
    <Animated.View style={style}>
      <FiChevronDown size={size} color={color} strokeWidth={2} />
    </Animated.View>
  );
}

/* React.memo so rows skip re-render when parent state changes for
   unrelated reasons (showScrollTop tick, etc.). onToggle is a stable
   callback from the parent (useCallback []); level/levelKey ride
   along so the row can bind locally without un-stable closures. */
const LevelHeader = memo(function LevelHeader({
  level,
  title,
  isOpen,
  childCount,
  onToggle,
}: {
  level: string;
  title: string;
  isOpen: boolean;
  childCount: number;
  onToggle: (level: string) => void;
}) {
  const colors = useThemePalette();
  const handlePress = useCallback(() => onToggle(level), [level, onToggle]);
  return (
    <Pressable onPress={handlePress} style={({ pressed }) => [styles.levelHeader, pressed && styles.headerPressed]}>
      <View style={styles.levelRule} />
      <ThemedText type="defaultSemiBold" style={[styles.levelTitle, { color: Accent.base }]}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.countBadge}>
        {childCount}
      </ThemedText>
      <View style={styles.chevronWrap}>
        <AnimatedChevron isOpen={isOpen} size={18} color={colors.textSecondary} />
      </View>
    </Pressable>
  );
});

const CategoryHeader = memo(function CategoryHeader({
  levelKey,
  title,
  isOpen,
  childCount,
  onToggle,
}: {
  levelKey: string;
  title: string;
  isOpen: boolean;
  childCount: number;
  onToggle: (key: string) => void;
}) {
  const colors = useThemePalette();
  const handlePress = useCallback(() => onToggle(levelKey), [levelKey, onToggle]);
  return (
    <Pressable onPress={handlePress} style={({ pressed }) => [styles.categoryHeader, pressed && styles.headerPressed]}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.categoryTitle}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textHint" style={styles.countBadge}>
        {childCount}
      </ThemedText>
      <View style={styles.chevronWrap}>
        <AnimatedChevron isOpen={isOpen} size={14} color={colors.textHint} />
      </View>
    </Pressable>
  );
});

const DeckRow = memo(function DeckRow({ deck, isLast }: { deck: Deck; isLast: boolean }) {
  const colors = useThemePalette();
  const router = useRouter();

  // Presence in list = ownership (free embedded OR paid imported via IndexedDB).
  const owned = true;
  const showLock = false;

  function onPress() {
    if (!owned) {
      router.push('/login');
      return;
    }
    /* Go through Deck Detail — gives users a stat snapshot + sample
       peek + entry to Quiz Config before committing to study. The
       direct /study route still works (Continue card uses it).
       NOTE: Expo Router's typed name is `/deck/[deckId]/index` but
       at runtime the URL omits `/index`. Cast bypasses the
       generated-types mismatch; runtime behavior is what we want. */
    router.push(`/deck/${deck.id}` as never);
  }

  return (
    <PressableScale onPress={onPress} style={styles.deckCard} scaleTo={0.99} opacityTo={0.92}>
      <ThemedView
        type="backgroundElement"
        style={[
          styles.deckCardInner,
          !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        ]}>
        {/* Left accent stripe — 3px crimson rail */}
        <View style={styles.deckStripe} />
        <View style={styles.deckBody}>
          <View style={styles.deckHeader}>
            <ThemedText
              type="defaultSemiBold"
              style={[styles.deckTitle, showLock && { color: colors.textSecondary }]}
            >
              {deck.title}
            </ThemedText>
            <ThemedText type="small" style={[styles.deckCount, { color: colors.textSecondary }]}>
              {deck.entryCount}
            </ThemedText>
            {showLock && (
              <View style={[styles.badge, { backgroundColor: Accent.bg, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                <FiLock size={10} color={Accent.base} />
                <ThemedText type="small" style={{ color: Accent.base }}>
                  LOCKED
                </ThemedText>
              </View>
            )}
            {deck.source === 'entitlement' && owned && (
              <View style={[styles.badge, { backgroundColor: Accent.bg }]}>
                <ThemedText type="small" style={{ color: Accent.base }}>
                  OWNED
                </ThemedText>
              </View>
            )}
            {deck.source === 'manual' && owned && (
              <View style={[styles.badge, { backgroundColor: Accent.bg }]}>
                <ThemedText type="small" style={{ color: Accent.base }}>
                  IMPORT
                </ThemedText>
              </View>
            )}
          </View>
        </View>
      </ThemedView>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, width: '100%' },
  rowWrap: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  headerWrap: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six + Spacing.three,
    paddingBottom: Spacing.three,
    /* Round-5 P0 compress: tighter intra-section rhythm (was Spacing.three)
       so the hero stack reads as one block. Section transitions get
       explicit marginTop on the boundary children below. */
    gap: Spacing.two,
  },
  topAccentBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 3,
    backgroundColor: Accent.base,
    zIndex: 2,
    pointerEvents: 'none',
  },
  ghostKanji: {
    position: 'absolute',
    top: 40,
    right: -20,
    fontSize: 240,
    lineHeight: 240,
    fontFamily: Platform.select({ web: '"Noto Serif JP", "Hiragino Mincho ProN", serif', default: undefined }),
    fontWeight: '300',
    color: Accent.base,
    opacity: 0.06,
    zIndex: 0,
    pointerEvents: 'none',
  },
  subLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: 2,
  },
  pip: {
    width: 14,
    height: 1.5,
    backgroundColor: Accent.base,
  },
  subLabel: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontSize: 10,
  },
  heroSubtitle: {
    /* No extra marginTop — headerWrap.gap (8) handles it. Keeping the
       4px boost made subtitle drift away from the headline. */
  },
  /* Multi-deck Study utility row — sits between hero sub and the Continue
     cluster. Top + bottom hairline borders (no left/right) keep it
     reading as a divider-style action row rather than a content card,
     per GPT round-3 verdict. */
  groupPickerEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    /* Round-5 P0 thinner utility strip — GPT round-4 still flagged this
       as "heavy enough to compete with Continue cards". Drop padding to
       6 + remove sub marginTop = single visual band, reads as command
       hint instead of card. */
    paddingVertical: 6,
    paddingHorizontal: Spacing.one,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    /* Section transition from hero block. Larger than headerWrap.gap (8)
       so this row stands apart from the headline+subtitle group. */
    marginTop: Spacing.three,
  },
  groupPickerLabel: {
    fontFamily: Platform.select({ web: '"Oswald", sans-serif', default: undefined }),
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  groupPickerSub: {
    fontSize: 11,
  },
  groupPickerArrow: {
    fontSize: 20,
    fontWeight: '700',
  },
  librarySectionDivider: {
    height: 2,
    position: 'relative',
    marginTop: Spacing.four,
    marginBottom: Spacing.three,
  },
  libraryBlockHead: {
    marginHorizontal: -Spacing.four,
  },
  libraryGroupHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  libraryPip: { width: 20, height: 2, marginTop: 12 },
  libraryTitleStack: {
    gap: 1,
  },
  libraryTitle: {
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: 0,
  },
  libraryKicker: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  /* Browse list tools. Keep these visually attached to the Library
     section below; large margins make the controls read as part of the
     Continue area instead of the deck/group list. */
  toolbarStack: {
    gap: Spacing.two,
    marginTop: Spacing.one,
    marginBottom: Spacing.two,
  },
  librarySearchDock: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  librarySearchDockActive: {
    shadowColor: Accent.base,
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  librarySearchDockText: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
  },
  librarySearchOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  librarySearchBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10, 8, 6, 0.62)',
    backdropFilter: Platform.select({ web: 'blur(3px)', default: undefined }) as never,
  },
  librarySearchPanel: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '82%',
    borderWidth: 1,
    borderTopWidth: 3,
    borderTopColor: Accent.base,
    borderRadius: Radii.md,
    padding: Spacing.four,
    gap: Spacing.two,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
  },
  librarySearchHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  librarySearchClose: {
    marginLeft: 'auto',
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  librarySearchInputShell: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  librarySearchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: Platform.select({ web: 'Sarabun, Inter, sans-serif', default: undefined }),
    outlineStyle: 'none' as never,
  },
  librarySearchQuietState: {
    paddingTop: Spacing.three,
    gap: Spacing.one,
  },
  librarySearchResultHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
  },
  librarySearchResults: {
    maxHeight: 360,
    marginRight: -Spacing.one,
    paddingRight: Spacing.one,
  },
  librarySearchResultsInner: {
    paddingBottom: Spacing.two,
    paddingRight: Spacing.two,
  },
  librarySearchLevelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
  },
  librarySearchCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
    paddingLeft: Spacing.three,
  },
  librarySearchDeckRow: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Radii.sm,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: Spacing.one,
  },
  librarySearchDeckTitle: {
    flex: 1,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  librarySearchDeckCount: {
    minWidth: 42,
    paddingRight: Spacing.three,
    textAlign: 'right',
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 12,
  },
  groupSearchClear: {
    width: 28,
    height: 28,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupSearchClearActive: {
    backgroundColor: Accent.base,
  },
  toolbar: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  /* Continue group head — kicker that gives parent meaning to the 2
     QUIZ/LEARN Continue cards. Mirrors the Hub TEST section pip+mono
     pattern for consistency. */
  continueGroupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    /* Section transition into Continue cluster — slightly larger than
       headerWrap.gap (8) so the kicker reads as section divider. */
    marginTop: Spacing.three,
  },
  continuePip: { width: 5, height: 5 },
  continueKicker: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  toolBtn: {
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.sm,
    borderWidth: 1,
  },
  toolBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  scopeBtn: {
    minHeight: 36,
    minWidth: 82,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.sm,
    borderWidth: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  levelTitle: { fontSize: 18, letterSpacing: 1.5 },
  levelRule: { width: 28, height: 2, backgroundColor: Accent.base },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
    paddingLeft: Spacing.three,
  },
  categoryTitle: { letterSpacing: 1.2 },
  countBadge: { marginLeft: Spacing.one },
  chevronWrap: { marginLeft: 'auto' },
  headerPressed: { opacity: 0.6 },
  deckCard: { borderRadius: 0 },
  deckCardInner: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 0,
    paddingRight: Spacing.three,
    overflow: 'hidden',
  },
  deckStripe: {
    width: 3,
    alignSelf: 'stretch',
    backgroundColor: Accent.base,
  },
  deckBody: {
    flex: 1,
    paddingVertical: Spacing.three,
    paddingLeft: Spacing.three,
    gap: 2,
  },
  deckHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  deckTitle: { flex: 1 },
  deckCount: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    letterSpacing: 0.5,
    fontSize: 12,
  },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  pressed: { opacity: 0.7 },
});
