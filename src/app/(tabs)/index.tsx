import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View, type ViewStyle } from 'react-native';
import {
  FiAlertTriangle,
  FiArrowDown,
  FiArrowUp,
  FiChevronDown,
  FiChevronsDown,
  FiChevronsUp,
  FiEdit3,
  FiInbox,
  FiLock,
  FiMinusSquare,
  FiMoreVertical,
  FiPlusSquare,
  FiSearch,
  FiSliders,
  FiTrash2,
  FiX,
} from 'react-icons/fi';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ContinueCard, ReviewContinueCard } from '@/components/continue-card';
import { DeckManagementModal } from '@/components/deck-management-modal';
import { LibraryActionsModal } from '@/components/library-actions-modal';
import { PressableScale } from '@/components/pressable-scale';
import { ScrollToTop } from '@/components/scroll-to-top';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/auth';
import { useThemePalette } from '@/context/theme';
import { useAllDecks } from '@/hooks/use-decks';
import { useHasHydrated } from '@/hooks/use-has-hydrated';
import { usePersistedState } from '@/hooks/use-persisted-state';
import { Accent, BottomTabInset, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import type { Deck } from '@/data/types';
import {
  buildBrowseCollapseKeys,
  buildBrowseRows,
  filterBrowseDecks,
  getLibrarySearchFocusRailState,
  groupSearchHasQuery,
  type BrowseActionContext,
  type BrowseRow,
} from '@/lib/browse-group-search';
import { getDeckReviewCandidate, type DeckReviewCandidate } from '@/lib/deck-progress';
import { getBrowseLibraryRevealState, shouldShowFlashcardContinue } from '@/lib/continue-route';
import {
  getLibrarySortDirection,
  getLibrarySortDirectionForMode,
  getLibrarySortMode,
  type LibrarySortDirection,
  type LibrarySortMode,
} from '@/lib/library-sort';
import {
  deleteUserLibraryGroup,
  deleteUserLibrarySection,
  removeUserLibraryGroup,
  removeUserLibrarySection,
  renameUserLibraryGroup,
  renameUserLibrarySection,
} from '@/lib/library-management';
import type { LastSession } from '@/lib/last-session';

const SCROLL_TOP_THRESHOLD = 400;
type SortMenuAnchor = { x: number; y: number; width: number; height: number };

const librarySearchDockActiveShadow = Platform.select({
  web: { boxShadow: '0 2px 6px rgba(224, 32, 44, 0.14)' } as unknown as ViewStyle,
  default: {
    shadowColor: Accent.base,
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
}) as ViewStyle;
const librarySearchPanelShadow = Platform.select({
  web: { boxShadow: '0 10px 28px rgba(0, 0, 0, 0.22)' } as unknown as ViewStyle,
  default: {
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
  },
}) as ViewStyle;

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
  const [browseAction, setBrowseAction] = useState<BrowseActionContext | null>(null);
  const [deckActionDeck, setDeckActionDeck] = useState<Deck | null>(null);
  const [sortMenuAnchor, setSortMenuAnchor] = useState<SortMenuAnchor | null>(null);
  const [reviewCandidate, setReviewCandidate] = useState<DeckReviewCandidate | null>(null);
  const [reviewCandidateReady, setReviewCandidateReady] = useState(false);
  const colors = useThemePalette();
  const scrollTopParam = Array.isArray(params.scrollTop) ? params.scrollTop[0] : params.scrollTop;
  const hasHydrated = useHasHydrated();

  const { decks, loading: decksLoading, refresh } = useAllDecks();
  const [lastSession] = usePersistedState<LastSession | null>('last-session', null);
  const [lastSessionLearn] = usePersistedState<LastSession | null>('last-session-learn', null);
  const [storedLibrarySortMode, setStoredLibrarySortMode] = usePersistedState<LibrarySortMode>('library-sort-mode', 'default');
  const librarySortMode = getLibrarySortMode(storedLibrarySortMode);
  const [storedLibrarySortDirection, setStoredLibrarySortDirection] = usePersistedState<LibrarySortDirection>('library-sort-direction', 'asc');
  const librarySortDirection = getLibrarySortDirection(storedLibrarySortDirection);

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
  const showReviewContinue = !!reviewCandidate;
  const showFlashcardContinue = shouldShowFlashcardContinue({
    hasFlashcardSession: showContinue,
    hasReviewCandidate: showReviewContinue,
  });
  const continueClusterReady = hasHydrated && !decksLoading && reviewCandidateReady;
  const showAnyContinue = continueClusterReady && (showContinueLearn || showFlashcardContinue || showReviewContinue);
  const libraryReveal = getBrowseLibraryRevealState({
    continueReady: continueClusterReady,
    hasContinue: showAnyContinue,
  });

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      if (decksLoading) {
        return () => {
          cancelled = true;
        };
      }
      if (decks.length === 0) {
        setReviewCandidate(null);
        setReviewCandidateReady(true);
        return () => {
          cancelled = true;
        };
      }

      void getDeckReviewCandidate(decks)
        .then((candidate) => {
          if (!cancelled) {
            setReviewCandidate(candidate);
            setReviewCandidateReady(true);
          }
        })
        .catch((error) => {
          if (__DEV__) console.warn('[browse-review] read failed:', error);
          if (!cancelled) {
            setReviewCandidate(null);
            setReviewCandidateReady(true);
          }
        });

      return () => {
        cancelled = true;
      };
    }, [decks, decksLoading]),
  );

  const librarySortOptions = useMemo(
    () => ({ mode: librarySortMode, direction: librarySortDirection }),
    [librarySortDirection, librarySortMode],
  );
  const librarySortRevision = `${librarySortMode}-${librarySortDirection}`;

  const { allLevelKeys, allCategoryKeys } = useMemo(() => {
    const { levelKeys, categoryKeys } = buildBrowseCollapseKeys(decks);
    return { allLevelKeys: levelKeys, allCategoryKeys: categoryKeys };
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
    () => buildBrowseRows(filteredDecks, new Set(), new Set(), true, librarySortOptions),
    [filteredDecks, librarySortOptions],
  );
  const rows = useMemo(
    () => buildBrowseRows(decks, closedLevels, closedCategories, false, librarySortOptions),
    [decks, closedLevels, closedCategories, librarySortOptions],
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
          sortRevision={librarySortRevision}
          onToggle={toggleLevel}
          actionContext={item.actionContext}
          onOpenAction={setBrowseAction}
        />
      );
    else if (item.kind === 'categoryHeader')
      inner = (
        <CategoryHeader
          levelKey={`${item.level}/${item.category}`}
          title={item.title}
          isOpen={item.isOpen}
          childCount={item.childCount}
          sortRevision={librarySortRevision}
          onToggle={toggleCategory}
          actionContext={item.actionContext}
          onOpenAction={setBrowseAction}
        />
      );
    else inner = <DeckRow deck={item.deck} isLast={item.isLast} sortRevision={librarySortRevision} actionContext={item.actionContext} onOpenAction={setDeckActionDeck} />;

    return <View style={styles.rowWrap}>{inner}</View>;
  }, [librarySortRevision, toggleLevel, toggleCategory]);

  return (
    <ThemedView style={styles.container}>
      {/* Top crimson accent stripe — runs edge-to-edge above safe area. */}
      <View style={styles.topAccentBar} />
      {/* Ghost kanji 学 — faint editorial decoration, behind all content. */}
      <ThemedText style={styles.ghostKanji}>学</ThemedText>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <FlashList<BrowseRow>
          ref={listRef}
          data={libraryReveal.showLibrary ? rows : []}
          extraData={librarySortOptions}
          keyExtractor={(item) => `${librarySortRevision}:${item.key}`}
          getItemType={(item) => item.kind}
          maintainVisibleContentPosition={{ disabled: true }}
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
              {libraryReveal.showLibrary ? (
                <Animated.View entering={FadeInUp.duration(160).easing(Easing.bezier(0.4, 0, 0.2, 1))} style={styles.browseContentRevealWrap}>
                  {/* Continue cluster header — gives Learn/Review resume cards
                      the same section rhythm as Library, while keeping the old
                      Flashcard resume hidden when a due-review CTA is available. */}
                  {showAnyContinue && (
                    <View style={styles.continueSectionWrap}>
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
                      {/* LEARN above QUIZ — passive review usually precedes active
                          testing in the user's flow (user preference 2026-05-27). */}
                      {showContinueLearn && lastSessionLearn && (
                        <ContinueCard lastSession={lastSessionLearn} colors={colors} mode="learn" />
                      )}
                      {showFlashcardContinue && lastSession && (
                        <ContinueCard lastSession={lastSession} colors={colors} mode="quiz" />
                      )}
                      {showReviewContinue && reviewCandidate && (
                        <ReviewContinueCard candidate={reviewCandidate} colors={colors} />
                      )}
                    </View>
                  )}
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
                      sortMode={librarySortMode}
                      sortDirection={librarySortDirection}
                      onChangeSortDirection={setStoredLibrarySortDirection}
                      onOpenSortMenu={setSortMenuAnchor}
                    />
                  </View>
                </Animated.View>
              ) : null}
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
      <SortMenuOverlay
        anchor={sortMenuAnchor}
        sortMode={librarySortMode}
        onSelect={(mode) => {
          setStoredLibrarySortMode(mode);
          setStoredLibrarySortDirection(getLibrarySortDirectionForMode(mode, librarySortDirection));
          setSortMenuAnchor(null);
        }}
        onClose={() => setSortMenuAnchor(null)}
      />
      <BrowseOrganizationActionModal
        action={browseAction}
        onClose={() => setBrowseAction(null)}
        onChanged={() => {
          refresh();
          setBrowseAction(null);
        }}
      />
      <DeckManagementModal
        visible={!!deckActionDeck}
        deck={deckActionDeck ?? undefined}
        onClose={() => setDeckActionDeck(null)}
        onChanged={() => {
          refresh();
          setDeckActionDeck(null);
        }}
        onDeleted={() => {
          refresh();
          setDeckActionDeck(null);
        }}
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
  disabled,
}: {
  onPress: () => void;
  children: React.ReactNode;
  style?: any;
  accessibilityLabel?: string;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => {
          if (disabled) return;
          scale.value = withTiming(0.94, { duration: 90, easing: Easing.bezier(0.4, 0, 0.2, 1) });
        }}
        onPressOut={() => {
          if (disabled) return;
          scale.value = withTiming(1, { duration: 220, easing: Easing.bezier(0.34, 1.56, 0.64, 1) });
        }}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={disabled ? { disabled: true } : undefined}
        style={({ pressed }) => [style, pressed && !disabled && { opacity: 0.85 }]}>
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
  sortMode,
  sortDirection,
  onChangeSortDirection,
  onOpenSortMenu,
}: {
  onOpenLibrarySearch: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  subsOnly: boolean;
  onToggleSubsOnly: () => void;
  onOpenLibraryActions: () => void;
  sortMode: LibrarySortMode;
  sortDirection: LibrarySortDirection;
  onChangeSortDirection: (direction: LibrarySortDirection) => void;
  onOpenSortMenu: (anchor: SortMenuAnchor | null) => void;
}) {
  const colors = useThemePalette();
  const { width } = useWindowDimensions();
  const [searchTriggerActive, setSearchTriggerActive] = useState(false);
  const searchOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sortButtonRef = useRef<any>(null);
  const isCompact = width < 520;
  const isWideToolbar = width >= 760;
  const useTouchIcons = width < 900;
  const expandLabel = isCompact ? 'Open' : 'Expand';
  const collapseLabel = isCompact ? 'Fold' : 'Collapse';
  const scopeLabel = subsOnly ? 'Group' : 'All';
  const sortLabel = sortMode === 'default' ? 'Default' : sortMode === 'name' ? 'Name' : 'Date';
  const directionLabel = sortDirection === 'asc' ? 'Asc' : 'Desc';
  const ExpandIcon = useTouchIcons ? FiPlusSquare : FiChevronsDown;
  const CollapseIcon = useTouchIcons ? FiMinusSquare : FiChevronsUp;
  const DirectionIcon = sortDirection === 'asc' ? FiArrowUp : FiArrowDown;

  useEffect(() => () => {
    if (searchOpenTimerRef.current) clearTimeout(searchOpenTimerRef.current);
  }, []);

  const openLibrarySearchWithFeedback = useCallback(() => {
    if (searchOpenTimerRef.current) clearTimeout(searchOpenTimerRef.current);
    setSearchTriggerActive(true);
    onOpenLibrarySearch();
    searchOpenTimerRef.current = setTimeout(() => {
      setSearchTriggerActive(false);
      searchOpenTimerRef.current = null;
    }, 210);
  }, [onOpenLibrarySearch]);

  const openSortMenu = useCallback(() => {
    const node = sortButtonRef.current;
    if (node?.measureInWindow) {
      node.measureInWindow((x: number, y: number, measuredWidth: number, height: number) => {
        onOpenSortMenu({ x, y, width: measuredWidth, height });
      });
      return;
    }
    onOpenSortMenu({ x: width - 156, y: 320, width: 132, height: 36 });
  }, [onOpenSortMenu, width]);

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
        <View style={styles.toolbarActionCluster}>
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
        <View style={[styles.toolbarSortCluster, isWideToolbar && styles.toolbarSortClusterWide]}>
          <View ref={sortButtonRef} collapsable={false}>
            <ScaleButton
              onPress={openSortMenu}
              accessibilityLabel={`Sort Library: ${sortLabel}`}
              style={[styles.toolBtn, styles.sortToolBtn, { borderColor: colors.border }]}>
              <View style={styles.toolBtnContent}>
                <FiSliders size={14} color={colors.text} />
              </View>
            </ScaleButton>
          </View>
          <ScaleButton
            onPress={() => onChangeSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
            disabled={sortMode === 'default'}
            accessibilityLabel={`Sort direction: ${directionLabel}`}
            style={[
              styles.toolBtn,
              styles.sortToolBtn,
              {
                borderColor: colors.border,
                opacity: sortMode === 'default' ? 0.42 : 1,
              },
          ]}>
            <View style={styles.toolBtnContent}>
              <DirectionIcon size={14} color={colors.text} />
            </View>
          </ScaleButton>
        </View>
      </View>
    </View>
  );
}

function SortMenuOverlay({
  anchor,
  sortMode,
  onSelect,
  onClose,
}: {
  anchor: SortMenuAnchor | null;
  sortMode: LibrarySortMode;
  onSelect: (mode: LibrarySortMode) => void;
  onClose: () => void;
}) {
  const colors = useThemePalette();
  const { width } = useWindowDimensions();
  const menuWidth = 148;
  const menuLeft = anchor ? Math.max(Spacing.two, Math.min(anchor.x, width - menuWidth - Spacing.two)) : Spacing.two;
  const menuTop = anchor ? anchor.y + anchor.height + 6 : 280;

  return (
    <Modal visible={!!anchor} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.sortOverlayRoot}>
        <Pressable style={styles.sortOverlayBackdrop} accessibilityLabel="ปิด Sort menu" onPress={onClose} />
        <View
          style={[
            styles.sortFloatingMenu,
            {
              left: menuLeft,
              top: menuTop,
              width: menuWidth,
              backgroundColor: colors.surface,
              borderColor: colors.borderStrong,
            },
          ]}>
          {(['default', 'name', 'date'] as LibrarySortMode[]).map((mode) => (
            <Pressable
              key={mode}
              accessibilityRole="button"
              accessibilityLabel={`Sort Library by ${mode === 'default' ? 'Default' : mode === 'name' ? 'Name' : 'Date'}`}
              onPress={() => onSelect(mode)}
              style={({ pressed }) => [styles.sortMenuItem, pressed && styles.headerPressed]}>
              <ThemedText type="smallBold" style={{ color: mode === sortMode ? colors.text : colors.textSecondary }}>
                {mode === 'default' ? 'Default' : mode === 'name' ? 'Name' : 'Date'}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
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
  const [inputFocused, setInputFocused] = useState(false);
  const active = groupSearchHasQuery(query);
  const focusRailState = getLibrarySearchFocusRailState(inputFocused);
  const focusRailDataProps =
    Platform.OS === 'web' ? ({ dataSet: { librarySearchRail: focusRailState } } as any) : {};

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
          <View style={[styles.librarySearchTopRail, { backgroundColor: colors.bg, pointerEvents: 'none' }]} />
          <View
            {...focusRailDataProps}
            style={[
              styles.librarySearchAccentBar,
              { pointerEvents: 'none' },
              Platform.OS === 'web'
                ? ({
                    transform: focusRailState === 'focused' ? 'scaleX(1)' : 'scaleX(0)',
                    transformOrigin: 'left center',
                    transition: 'transform 240ms cubic-bezier(0.4, 0, 0.2, 1)',
                  } as unknown as object)
                : { transform: [{ scaleX: focusRailState === 'focused' ? 1 : 0 }] },
              focusRailState === 'focused' && styles.librarySearchFocusRailActive,
            ]}
          />
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
              style={({ pressed }) => [styles.librarySearchClose, pressed && styles.groupSearchPressActive]}>
              <FiX size={18} color={colors.textSecondary} strokeWidth={2.2} />
            </Pressable>
          </View>
          <View
            style={[
              styles.librarySearchInputShell,
              {
                backgroundColor: colors.surface,
                borderColor: inputFocused ? colors.borderStrong : colors.border,
              },
            ]}>
            <FiSearch size={17} color={active || inputFocused ? colors.textSecondary : colors.textMuted} />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={onChangeQuery}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
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
                style={({ pressed }) => [
                  styles.groupSearchClear,
                  pressed && { backgroundColor: colors.backgroundSelected, transform: [{ scale: 0.92 }] },
                ]}>
                {({ pressed }) => (
                  <FiX size={15} color={pressed ? colors.text : colors.textMuted} strokeWidth={2.2} />
                )}
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
  actionContext,
  onOpenAction,
}: {
  level: string;
  title: string;
  isOpen: boolean;
  childCount: number;
  sortRevision: string;
  onToggle: (level: string) => void;
  actionContext?: BrowseActionContext;
  onOpenAction: (action: BrowseActionContext) => void;
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
      <View style={styles.headerUtilityCluster}>
        {actionContext ? (
          <BrowseActionTrigger
            action={actionContext}
            label={actionContext.disabled ? `Official Source แก้ไม่ได้: group ${title}` : `เปิด actions สำหรับ group ${title}`}
            onOpenAction={onOpenAction}
          />
        ) : null}
        <View style={styles.chevronWrap}>
          <AnimatedChevron isOpen={isOpen} size={18} color={colors.textSecondary} />
        </View>
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
  actionContext,
  onOpenAction,
}: {
  levelKey: string;
  title: string;
  isOpen: boolean;
  childCount: number;
  sortRevision: string;
  onToggle: (key: string) => void;
  actionContext?: BrowseActionContext;
  onOpenAction: (action: BrowseActionContext) => void;
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
      <View style={styles.headerUtilityCluster}>
        {actionContext ? (
          <BrowseActionTrigger
            action={actionContext}
            label={actionContext.disabled ? `Official Source แก้ไม่ได้: section ${title}` : `เปิด actions สำหรับ section ${title}`}
            onOpenAction={onOpenAction}
          />
        ) : null}
        <View style={styles.chevronWrap}>
          <AnimatedChevron isOpen={isOpen} size={14} color={colors.textHint} />
        </View>
      </View>
    </Pressable>
  );
});

const DeckRow = memo(function DeckRow({
  deck,
  isLast,
  actionContext,
  onOpenAction,
}: {
  deck: Deck;
  isLast: boolean;
  sortRevision: string;
  actionContext?: BrowseActionContext;
  onOpenAction: (deck: Deck) => void;
}) {
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
            {actionContext ? (
              <BrowseActionTrigger
                action={actionContext}
                label={`เปิด Deck Actions สำหรับ ${deck.title}`}
                onOpenAction={() => onOpenAction(deck)}
              />
            ) : null}
          </View>
        </View>
      </ThemedView>
    </PressableScale>
  );
});

function BrowseActionTrigger({
  action,
  label,
  onOpenAction,
}: {
  action: BrowseActionContext;
  label: string;
  onOpenAction: (action: BrowseActionContext) => void;
}) {
  const colors = useThemePalette();
  const disabled = action.disabled || action.source !== 'user';
  return (
    <Pressable
      onPress={(event: any) => {
        event?.stopPropagation?.();
        if (disabled) return;
        onOpenAction(action);
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={disabled ? { disabled: true } : undefined}
      style={({ pressed, hovered }: any) => [
        styles.browseActionTrigger,
        {
          borderColor: pressed || hovered ? Accent.soft : 'transparent',
          backgroundColor: pressed || hovered ? colors.background : 'transparent',
          opacity: disabled ? 0.35 : 1,
        },
        pressed && !disabled && { opacity: 0.75 },
      ]}>
      {({ pressed, hovered }: any) => (
        <FiMoreVertical
          size={15}
          color={disabled ? colors.textHint : pressed || hovered ? Accent.base : colors.textSecondary}
          strokeWidth={2}
        />
      )}
    </Pressable>
  );
}

function BrowseOrganizationActionModal({
  action,
  onClose,
  onChanged,
}: {
  action: BrowseActionContext | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const colors = useThemePalette();
  const [mode, setMode] = useState<'menu' | 'rename' | 'remove' | 'delete'>('menu');
  const [value, setValue] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!action) return;
    setMode('menu');
    setValue(action.title);
    setConfirmText('');
    setStatus('');
    setBusy(false);
  }, [action]);

  if (!action || action.target === 'deck') return null;

  const targetLabel = action.target === 'group' ? 'group' : 'section';
  const confirmReady = confirmText.trim() === action.title;
  const renameReady = value.trim().length > 0 && value.trim() !== action.title;

  async function runRename() {
    if (!action || busy || !renameReady) return;
    setBusy(true);
    setStatus('');
    try {
      const result = action.target === 'group'
        ? await renameUserLibraryGroup(action.group ?? action.title, value)
        : await renameUserLibrarySection(action.group ?? '', action.section ?? action.title, value);
      if (!result.ok) {
        setStatus(result.reason ?? 'Rename ไม่สำเร็จ');
        return;
      }
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function runRemove() {
    if (!action || busy) return;
    setBusy(true);
    setStatus('');
    try {
      const result = action.target === 'group'
        ? await removeUserLibraryGroup(action.group ?? action.title)
        : await removeUserLibrarySection(action.group ?? '', action.section ?? action.title);
      if (!result.ok) {
        setStatus(result.reason ?? 'Remove ไม่สำเร็จ');
        return;
      }
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function runDelete() {
    if (!action || busy || !confirmReady) return;
    setBusy(true);
    setStatus('');
    try {
      const result = action.target === 'group'
        ? await deleteUserLibraryGroup(action.group ?? action.title)
        : await deleteUserLibrarySection(action.group ?? '', action.section ?? action.title);
      if (!result.ok) {
        setStatus(result.reason ?? 'Delete ไม่สำเร็จ');
        return;
      }
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={!!action} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.browseActionBackdrop} onPress={onClose}>
        <Pressable
          onPress={(event: any) => event.stopPropagation?.()}
          style={[styles.browseActionPanel, { borderColor: colors.border, borderTopColor: Accent.base, backgroundColor: colors.background }]}>
          <View style={styles.browseActionHead}>
            <View style={styles.browseActionTitleStack}>
              <View style={styles.titleRow}>
                <View style={[styles.pip, { backgroundColor: Accent.base }]} />
                <ThemedText style={[styles.libraryKicker, { color: colors.textHint }]}>
                  // {targetLabel.toUpperCase()} ACTIONS
                </ThemedText>
              </View>
              <ThemedText type="defaultSemiBold" numberOfLines={1}>
                {action.title}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {action.childCount ?? 0} decks · User Content
              </ThemedText>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="ปิด Browse actions"
              style={({ pressed }) => [styles.browseActionClose, { borderColor: colors.border }, pressed && { opacity: 0.75 }]}>
              <FiX size={16} color={colors.text} strokeWidth={2} />
            </Pressable>
          </View>

          {mode === 'menu' ? (
            <View style={styles.browseActionList}>
              <BrowseActionRow
                icon={<FiEdit3 size={16} color={Accent.base} strokeWidth={2} />}
                title={`Rename ${targetLabel}`}
                body="เปลี่ยนชื่อเฉพาะ user/imported content"
                onPress={() => setMode('rename')}
              />
              <BrowseActionRow
                icon={<FiInbox size={16} color={Accent.base} strokeWidth={2} />}
                title={`Remove ${targetLabel} only`}
                body={action.target === 'group'
                  ? 'คง deck ไว้ แล้วย้ายไป Manual imports / Inbox'
                  : 'คง deck ไว้ แล้วย้ายไป Inbox ใน group เดิม'}
                onPress={() => setMode('remove')}
              />
              <BrowseActionRow
                danger
                icon={<FiTrash2 size={16} color={Accent.base} strokeWidth={2} />}
                title={`Delete ${targetLabel} and decks`}
                body="ลบ child deck/data ของ user content ใน node นี้"
                onPress={() => setMode('delete')}
              />
            </View>
          ) : null}

          {mode === 'rename' ? (
            <View style={styles.browseActionForm}>
              <ThemedText type="small" themeColor="textSecondary">ชื่อใหม่</ThemedText>
              <TextInput
                value={value}
                onChangeText={setValue}
                placeholder={`Rename ${targetLabel}`}
                placeholderTextColor={colors.textHint}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.browseActionInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
              />
              <View style={styles.browseActionFooter}>
                <SecondaryActionButton label="Back" onPress={() => setMode('menu')} />
                <PrimaryActionButton label="Save" disabled={!renameReady || busy} onPress={() => void runRename()} />
              </View>
            </View>
          ) : null}

          {mode === 'remove' ? (
            <View style={styles.browseActionForm}>
              <ThemedText type="defaultSemiBold">Remove only</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.browseActionCopy}>
                {action.target === 'group'
                  ? 'Group นี้จะหายจาก Browse แต่ deck ข้างในยังอยู่ และจะถูกย้ายไป Manual imports / Inbox'
                  : 'Section นี้จะหายจาก Browse แต่ deck ข้างในยังอยู่ และจะถูกย้ายไป Inbox ใน group เดิม'}
              </ThemedText>
              <View style={styles.browseActionFooter}>
                <SecondaryActionButton label="Back" onPress={() => setMode('menu')} />
                <PrimaryActionButton label="Remove only" disabled={busy} onPress={() => void runRemove()} />
              </View>
            </View>
          ) : null}

          {mode === 'delete' ? (
            <View style={styles.browseActionForm}>
              <View style={[styles.browseDangerBox, { borderColor: Accent.soft, backgroundColor: Accent.bg }]}>
                <FiAlertTriangle size={18} color={Accent.base} strokeWidth={2} />
                <ThemedText type="small" style={[styles.browseActionCopy, { color: Accent.base }]}>
                  Destructive: จะลบ deck/data ของ user content ใน {targetLabel} นี้จริง
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                พิมพ์ `{action.title}` เพื่อยืนยัน
              </ThemedText>
              <TextInput
                value={confirmText}
                onChangeText={setConfirmText}
                placeholder={action.title}
                placeholderTextColor={colors.textHint}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.browseActionInput, { borderColor: confirmReady ? Accent.soft : colors.border, color: colors.text, backgroundColor: colors.background }]}
              />
              <View style={styles.browseActionFooter}>
                <SecondaryActionButton label="Back" onPress={() => setMode('menu')} />
                <PrimaryActionButton label="Delete" disabled={!confirmReady || busy} danger onPress={() => void runDelete()} />
              </View>
            </View>
          ) : null}

          {status ? (
            <View style={[styles.browseActionStatus, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
              <ThemedText type="small" themeColor="textSecondary">{status}</ThemedText>
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function BrowseActionRow({
  icon,
  title,
  body,
  danger,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const colors = useThemePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.browseActionRow,
        { borderColor: danger ? Accent.soft : colors.border, backgroundColor: danger ? Accent.bg : colors.backgroundElement },
        pressed && { opacity: 0.78 },
      ]}>
      {icon}
      <View style={styles.browseActionRowText}>
        <ThemedText type="defaultSemiBold" style={danger ? { color: Accent.base } : undefined}>{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{body}</ThemedText>
      </View>
    </Pressable>
  );
}

function SecondaryActionButton({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useThemePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.browseSecondaryButton, { borderColor: colors.border }, pressed && { opacity: 0.75 }]}>
      <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
    </Pressable>
  );
}

function PrimaryActionButton({
  label,
  disabled,
  danger,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.browsePrimaryButton,
        { backgroundColor: danger ? Accent.base : Accent.base, opacity: disabled ? 0.45 : 1 },
        pressed && !disabled && { opacity: 0.78 },
      ]}>
      <ThemedText type="smallBold" style={styles.browsePrimaryButtonText}>{label}</ThemedText>
    </Pressable>
  );
}

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
  librarySectionDivider: {
    height: 2,
    position: 'relative',
    marginTop: Spacing.four,
    marginBottom: Spacing.three,
  },
  libraryBlockHead: {
    marginHorizontal: -Spacing.four,
  },
  browseContentRevealWrap: {
    gap: Spacing.three,
  },
  continueSectionWrap: {
    gap: Spacing.three,
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
    ...librarySearchDockActiveShadow,
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
    position: 'relative',
    width: '100%',
    maxWidth: 620,
    maxHeight: '82%',
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.four,
    gap: Spacing.two,
    overflow: 'hidden',
    ...librarySearchPanelShadow,
  },
  librarySearchTopRail: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  librarySearchAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Accent.base,
  },
  librarySearchFocusRailActive: Platform.select({
    web: {},
    default: {
      transform: [{ scaleX: 1 }],
    },
  }) as any,
  librarySearchHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  librarySearchClose: {
    marginLeft: 'auto',
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupSearchPressActive: {
    opacity: 0.72,
    transform: [{ scale: 0.92 }],
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
  librarySearchInputShellActive: {
    ...librarySearchDockActiveShadow,
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
  toolbar: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toolbarActionCluster: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
    alignItems: 'center',
    flexShrink: 1,
  },
  toolbarSortCluster: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
    alignItems: 'center',
    flexShrink: 0,
  },
  toolbarSortClusterWide: {
    marginLeft: 'auto',
  },
  /* Continue group head — section title matching Library rhythm. */
  continueGroupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    /* Section transition into Continue cluster — slightly larger than
       headerWrap.gap (8) so the kicker reads as section divider. */
    marginTop: Spacing.three,
  },
  continuePip: { width: 18, height: 2 },
  continueTitleStack: {
    gap: 3,
  },
  continueTitle: {
    fontSize: 22,
    letterSpacing: 1.3,
  },
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
  sortToolBtn: {
    minWidth: 38,
  },
  sortOverlayRoot: {
    flex: 1,
  },
  sortOverlayBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'transparent',
  },
  sortFloatingMenu: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: Radii.sm,
    overflow: 'hidden',
    ...librarySearchPanelShadow,
  },
  sortMenuItem: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127, 127, 127, 0.22)',
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
  headerUtilityCluster: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  chevronWrap: {
    width: 26,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  browseActionTrigger: {
    width: 32,
    height: 32,
    borderRadius: Radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  browseActionBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  browseActionPanel: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '88%',
    borderWidth: 1,
    borderTopWidth: 3,
    borderRadius: Radii.md,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  browseActionHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  browseActionTitleStack: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  browseActionClose: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  browseActionList: {
    gap: Spacing.two,
  },
  browseActionRow: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: Radii.sm,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  browseActionRowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  browseActionForm: {
    gap: Spacing.three,
  },
  browseActionInput: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.three,
    paddingVertical: Platform.OS === 'web' ? 9 : 6,
    fontSize: 15,
  },
  browseActionCopy: {
    lineHeight: 20,
  },
  browseActionFooter: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  browseSecondaryButton: {
    minHeight: 42,
    minWidth: 92,
    borderWidth: 1,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  browsePrimaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  browsePrimaryButtonText: {
    color: '#fff',
  },
  browseDangerBox: {
    borderWidth: 1,
    borderRadius: Radii.sm,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  browseActionStatus: {
    borderWidth: 1,
    borderRadius: Radii.sm,
    padding: Spacing.two,
  },
  pressed: { opacity: 0.7 },
});
