import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { FiChevronDown, FiChevronsDown, FiChevronsUp, FiLayers, FiLock } from 'react-icons/fi';
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
import type { LastSession } from '@/lib/last-session';

const SCROLL_TOP_THRESHOLD = 400;

type Row =
  | { kind: 'levelHeader';    title: string; key: string; level: string; isOpen: boolean; childCount: number }
  | { kind: 'categoryHeader'; title: string; key: string; level: string; category: Deck['type']; isOpen: boolean; childCount: number }
  | { kind: 'deck';           deck: Deck;    key: string; isLast: boolean };

const CATEGORY_ORDER: Deck['type'][] = ['kanji', 'grammar', 'vocab', 'glossary'];
const CATEGORY_LABEL: Record<Deck['type'], string> = {
  kanji:    'KANJI',
  grammar:  'GRAMMAR',
  vocab:    'VOCAB',
  glossary: 'GLOSSARY',
};

function buildRows(
  allDecks: Deck[],
  closedLevels: Set<string>,
  closedCategories: Set<string>,
): Row[] {
  /* level → category → decks[] */
  const byLevel = new Map<string, Map<Deck['type'], Deck[]>>();
  for (const d of allDecks) {
    const lvl = d.level ?? 'GLOSSARY';
    if (!byLevel.has(lvl)) byLevel.set(lvl, new Map());
    const cat = byLevel.get(lvl)!;
    if (!cat.has(d.type)) cat.set(d.type, []);
    cat.get(d.type)!.push(d);
  }

  const rows: Row[] = [];
  const levelOrder = ['N5', 'N4', 'N3', 'N2', 'N1', 'GLOSSARY'];
  for (const lvl of levelOrder) {
    const cats = byLevel.get(lvl);
    if (!cats) continue;
    const levelOpen = !closedLevels.has(lvl);
    const totalChildren = Array.from(cats.values()).reduce((s, arr) => s + arr.length, 0);
    rows.push({ kind: 'levelHeader', title: lvl, key: `lvl-${lvl}`, level: lvl, isOpen: levelOpen, childCount: totalChildren });
    if (!levelOpen) continue;

    for (const cat of CATEGORY_ORDER) {
      const catDecks = cats.get(cat);
      if (!catDecks?.length) continue;
      const catKey = `${lvl}/${cat}`;
      const showCategoryHeader = cats.size > 1;
      const categoryOpen = !closedCategories.has(catKey);

      if (showCategoryHeader) {
        rows.push({ kind: 'categoryHeader', title: CATEGORY_LABEL[cat], key: `cat-${catKey}`, level: lvl, category: cat, isOpen: categoryOpen, childCount: catDecks.length });
        if (!categoryOpen) continue;
      }

      catDecks.forEach((d, i) => {
        rows.push({ kind: 'deck', deck: d, key: d.id, isLast: i === catDecks.length - 1 });
      });
    }
  }

  return rows;
}

export default function BrowseScreen() {
  const router = useRouter();
  const [closedLevels, setClosedLevels] = useState<Set<string>>(new Set());
  const [closedCategories, setClosedCategories] = useState<Set<string>>(new Set());
  const [subsOnly, setSubsOnly] = useState(false);
  const listRef = useRef<FlashListRef<Row>>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [libraryActionsOpen, setLibraryActionsOpen] = useState(false);
  const colors = useThemePalette();

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

  const rows = useMemo(
    () => buildRows(decks, closedLevels, closedCategories),
    [decks, closedLevels, closedCategories],
  );
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
  const renderItem = useCallback(({ item }: { item: Row }) => {
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
        <FlashList<Row>
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
                  // TODAY · วันนี้
                </ThemedText>
              </View>
              <ThemedText type="title" style={styles.displayHeadline}>
                วันนี้
                {'\n'}
                <ThemedText type="title" style={[styles.displayHeadline, styles.displayHeadlineAccent]}>
                  ทบทวน?
                </ThemedText>
              </ThemedText>
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
              <Toolbar
                onExpandAll={expandAll}
                onCollapseAll={collapseAll}
                subsOnly={subsOnly}
                onToggleSubsOnly={() => setSubsOnly((v) => !v)}
                onOpenLibraryActions={() => setLibraryActionsOpen(true)}
              />
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
  onExpandAll,
  onCollapseAll,
  subsOnly,
  onToggleSubsOnly,
  onOpenLibraryActions,
}: {
  onExpandAll: () => void;
  onCollapseAll: () => void;
  subsOnly: boolean;
  onToggleSubsOnly: () => void;
  onOpenLibraryActions: () => void;
}) {
  const colors = useThemePalette();
  return (
    <View style={styles.toolbar}>
      <ScaleButton
        onPress={onExpandAll}
        accessibilityLabel="ขยายทั้งหมด"
        style={[styles.toolBtn, { borderColor: colors.border }]}>
        <View style={styles.toolBtnContent}>
          <FiChevronsDown size={14} color={colors.text} />
          <ThemedText type="small" themeColor="textSecondary">ขยาย</ThemedText>
        </View>
      </ScaleButton>
      <ScaleButton
        onPress={onCollapseAll}
        accessibilityLabel="ย่อทั้งหมด"
        style={[styles.toolBtn, { borderColor: colors.border }]}>
        <View style={styles.toolBtnContent}>
          <FiChevronsUp size={14} color={colors.text} />
          <ThemedText type="small" themeColor="textSecondary">ย่อ</ThemedText>
        </View>
      </ScaleButton>
      <ScaleButton
        onPress={onToggleSubsOnly}
        accessibilityLabel="สลับโหมดเฉพาะหมวด"
        style={[
          styles.toolBtn,
          {
            borderColor: subsOnly ? Accent.base : colors.border,
            backgroundColor: subsOnly ? Accent.bg : 'transparent',
          },
        ]}>
        <View style={styles.toolBtnContent}>
          <ThemedText type="small" style={{ color: subsOnly ? Accent.base : colors.textSecondary }}>
            เฉพาะหมวด
          </ThemedText>
        </View>
      </ScaleButton>
      <ScaleButton
        onPress={onOpenLibraryActions}
        accessibilityLabel="เปิด Import / Export"
        style={[styles.toolBtn, { borderColor: colors.border }]}>
        <View style={styles.toolBtnContent}>
          <ThemedText type="small" style={{ color: Accent.base }}>+</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Library</ThemedText>
        </View>
      </ScaleButton>
    </View>
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
  displayHeadline: {
    fontFamily: Platform.select({ web: 'Oswald, "Arial Narrow", Impact, sans-serif', default: undefined }),
    fontWeight: '700',
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -0.5,
    textTransform: 'uppercase',
  },
  displayHeadlineAccent: {
    color: Accent.base,
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
  /* Toolbar visual weight reduced ~15% via opacity per GPT polish round
     2026-05-27. The 3 view-mode buttons were drawing the eye as if they
     were primary actions; lowered opacity keeps them discoverable but
     drops them down the visual hierarchy below the Continue cards.

     Round-2 verdict (2026-05-27): opacity alone made it read as a
     "footer of Continue cards" rather than its own utility row. Added
     marginTop: Spacing.six (~32) so toolbar sits in its own rhythm slot
     between Continue and the deck list below. */
  toolbar: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.six,
    marginBottom: Spacing.five,
    flexWrap: 'wrap',
    opacity: 0.85,
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
    paddingVertical: 4,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.sm,
    borderWidth: 1,
  },
  toolBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.five,
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
