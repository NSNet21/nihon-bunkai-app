import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { FiChevronDown, FiChevronsDown, FiChevronsUp, FiLock } from 'react-icons/fi';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Accent, BottomTabInset, Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { decks } from '@/data/free-tier';
import type { Deck } from '@/data/types';

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
  const [closedLevels, setClosedLevels] = useState<Set<string>>(new Set());
  const [closedCategories, setClosedCategories] = useState<Set<string>>(new Set());
  const [subsOnly, setSubsOnly] = useState(false);

  /* Pre-compute all group keys once (decks list is static). */
  const { allLevelKeys, allCategoryKeys } = useMemo(() => {
    const lvls = new Set<string>();
    const cats = new Set<string>();
    for (const d of decks) {
      const lvl = d.level ?? 'GLOSSARY';
      if (!d.isFree) {
        lvls.add('LOCKED');
        continue;
      }
      lvls.add(lvl);
      if (d.type !== 'glossary') cats.add(`${lvl}/${d.type}`);
    }
    return { allLevelKeys: Array.from(lvls), allCategoryKeys: Array.from(cats) };
  }, []);

  function toggleLevel(level: string) {
    setClosedLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  }

  function toggleCategory(key: string) {
    setClosedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

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
    [closedLevels, closedCategories],
  );
  const totalFreeEntries = decks
    .filter((d) => d.isFree)
    .reduce((s, d) => s + d.entryCount, 0);
  const freePackCount = decks.filter((d) => d.isFree).length;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <FlashList<Row>
          data={rows}
          keyExtractor={(item) => item.key}
          getItemType={(item) => item.kind}
          ListHeaderComponent={
            <View style={styles.headerWrap}>
              <ThemedText type="title">Browse</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {totalFreeEntries} entries · {freePackCount} packs ฟรี · ดูเพิ่มที่ Shop
              </ThemedText>
              <Toolbar
                onExpandAll={expandAll}
                onCollapseAll={collapseAll}
                subsOnly={subsOnly}
                onToggleSubsOnly={() => setSubsOnly((v) => !v)}
              />
            </View>
          }
          renderItem={({ item }) => {
            let inner;
            if (item.kind === 'levelHeader')
              inner = <LevelHeader title={item.title} isOpen={item.isOpen} childCount={item.childCount} onPress={() => toggleLevel(item.level)} />;
            else if (item.kind === 'categoryHeader')
              inner = <CategoryHeader title={item.title} isOpen={item.isOpen} childCount={item.childCount} onPress={() => toggleCategory(`${item.level}/${item.category}`)} />;
            else inner = <DeckRow deck={item.deck} isLast={item.isLast} />;

            const row = (
              <View style={styles.rowWrap}>
                {item.kind === 'levelHeader' ? inner : (
                  <Animated.View
                    entering={FadeIn.duration(180).easing(Easing.bezier(0.4, 0, 0.2, 1))}
                    exiting={FadeOut.duration(120)}>
                    {inner}
                  </Animated.View>
                )}
              </View>
            );
            return row;
          }}
          contentContainerStyle={styles.listContent}
        />
      </SafeAreaView>
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
          scale.value = withTiming(1, { duration: 220, easing: Easing.back(1.4) });
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
}: {
  onExpandAll: () => void;
  onCollapseAll: () => void;
  subsOnly: boolean;
  onToggleSubsOnly: () => void;
}) {
  const scheme = useColorScheme();
  const colors = (scheme === 'dark' ? Colors.dark : Colors.light) as typeof Colors.light;
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

function LevelHeader({ title, isOpen, childCount, onPress }: { title: string; isOpen: boolean; childCount: number; onPress: () => void }) {
  const scheme = useColorScheme();
  const colors = (scheme === 'dark' ? Colors.dark : Colors.light) as typeof Colors.light;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.levelHeader, pressed && styles.headerPressed]}>
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
}

function CategoryHeader({ title, isOpen, childCount, onPress }: { title: string; isOpen: boolean; childCount: number; onPress: () => void }) {
  const scheme = useColorScheme();
  const colors = (scheme === 'dark' ? Colors.dark : Colors.light) as typeof Colors.light;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.categoryHeader, pressed && styles.headerPressed]}>
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
}

function DeckRow({ deck, isLast }: { deck: Deck; isLast: boolean }) {
  const scheme = useColorScheme();
  const colors = (scheme === 'dark' ? Colors.dark : Colors.light) as typeof Colors.light;
  const router = useRouter();
  const { status, entitlements } = useAuth();

  const owned = deck.isFree || entitlements.has(deck.id);
  const showLock = !deck.isFree && !owned;

  const subtitle = deck.isFree
    ? `${deck.entryCount} cards`
    : owned
      ? 'ปลดล็อกแล้ว · พร้อมเรียน'
      : status === 'signed-in'
        ? 'ซื้อใน landing page'
        : 'เข้าสู่ระบบเพื่อปลดล็อก';

  function onPress() {
    if (!owned) {
      router.push('/login');
      return;
    }
    router.push({ pathname: '/study', params: { deckId: deck.id } });
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.deckCard, pressed && styles.pressed]}>
      <ThemedView
        type="backgroundElement"
        style={[
          styles.deckCardInner,
          !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        ]}>
        <View style={styles.deckHeader}>
          <ThemedText type="defaultSemiBold" style={[styles.deckTitle, showLock && { color: colors.textSecondary }]}>
            {deck.title}
          </ThemedText>
          {showLock && (
            <View style={[styles.badge, { backgroundColor: Accent.bg, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
              <FiLock size={10} color={Accent.base} />
              <ThemedText type="small" style={{ color: Accent.base }}>
                LOCKED
              </ThemedText>
            </View>
          )}
          {!deck.isFree && owned && (
            <View style={[styles.badge, { backgroundColor: Accent.bg }]}>
              <ThemedText type="small" style={{ color: Accent.base }}>
                OWNED
              </ThemedText>
            </View>
          )}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {subtitle}
        </ThemedText>
      </ThemedView>
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
    paddingTop: Spacing.six + Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
  toolbar: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
    flexWrap: 'wrap',
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
  deckCardInner: { padding: Spacing.three, gap: 2 },
  deckHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  deckTitle: { flex: 1 },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  pressed: { opacity: 0.7 },
});
