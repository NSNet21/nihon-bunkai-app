import { FlashList } from '@shopify/flash-list';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { FiChevronDown, FiChevronRight } from 'react-icons/fi';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
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
  const free = allDecks.filter((d) => d.isFree);
  const locked = allDecks.filter((d) => !d.isFree);

  /* level → category → decks[] */
  const byLevel = new Map<string, Map<Deck['type'], Deck[]>>();
  for (const d of free) {
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

  if (locked.length) {
    const lockedOpen = !closedLevels.has('LOCKED');
    rows.push({ kind: 'levelHeader', title: 'LOCKED · ปลดล็อกหลังซื้อ', key: 'lvl-locked', level: 'LOCKED', isOpen: lockedOpen, childCount: locked.length });
    if (lockedOpen) {
      locked.forEach((d, i) => {
        rows.push({ kind: 'deck', deck: d, key: d.id, isLast: i === locked.length - 1 });
      });
    }
  }

  return rows;
}

export default function BrowseScreen() {
  const [closedLevels, setClosedLevels] = useState<Set<string>>(new Set());
  const [closedCategories, setClosedCategories] = useState<Set<string>>(new Set());

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
        <View style={styles.headerWrap}>
          <ThemedText type="title">Browse</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {totalFreeEntries} entries · {freePackCount} packs ฟรี · ทักหลังเพื่อปลดล็อกเพิ่ม
          </ThemedText>
        </View>
        <FlashList<Row>
          data={rows}
          keyExtractor={(item) => item.key}
          getItemType={(item) => item.kind}
          renderItem={({ item }) => {
            if (item.kind === 'levelHeader')
              return <LevelHeader title={item.title} isOpen={item.isOpen} childCount={item.childCount} onPress={() => toggleLevel(item.level)} />;
            if (item.kind === 'categoryHeader')
              return <CategoryHeader title={item.title} isOpen={item.isOpen} childCount={item.childCount} onPress={() => toggleCategory(`${item.level}/${item.category}`)} />;
            return <DeckRow deck={item.deck} isLast={item.isLast} />;
          }}
          contentContainerStyle={styles.listContent}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function LevelHeader({ title, isOpen, childCount, onPress }: { title: string; isOpen: boolean; childCount: number; onPress: () => void }) {
  const scheme = useColorScheme();
  const colors = (scheme === 'dark' ? Colors.dark : Colors.light) as typeof Colors.light;
  const Chevron = isOpen ? FiChevronDown : FiChevronRight;
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
        <Chevron size={18} color={colors.textSecondary} strokeWidth={2} />
      </View>
    </Pressable>
  );
}

function CategoryHeader({ title, isOpen, childCount, onPress }: { title: string; isOpen: boolean; childCount: number; onPress: () => void }) {
  const scheme = useColorScheme();
  const colors = (scheme === 'dark' ? Colors.dark : Colors.light) as typeof Colors.light;
  const Chevron = isOpen ? FiChevronDown : FiChevronRight;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.categoryHeader, pressed && styles.headerPressed]}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.categoryTitle}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textHint" style={styles.countBadge}>
        {childCount}
      </ThemedText>
      <View style={styles.chevronWrap}>
        <Chevron size={14} color={colors.textHint} strokeWidth={2} />
      </View>
    </Pressable>
  );
}

function DeckRow({ deck, isLast }: { deck: Deck; isLast: boolean }) {
  const scheme = useColorScheme();
  const colors = (scheme === 'dark' ? Colors.dark : Colors.light) as typeof Colors.light;
  const subtitle = deck.isFree ? `${deck.entryCount} cards` : 'paid · landing page';
  return (
    <Link href={{ pathname: '/study', params: { deckId: deck.id } }} asChild>
      <Pressable style={({ pressed }) => [styles.deckCard, pressed && styles.pressed]}>
        <ThemedView
          type="backgroundElement"
          style={[
            styles.deckCardInner,
            !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
          ]}>
          <View style={styles.deckHeader}>
            <ThemedText type="defaultSemiBold" style={styles.deckTitle}>
              {deck.title}
            </ThemedText>
            {!deck.isFree && (
              <View style={[styles.badge, { backgroundColor: Accent.bg }]}>
                <ThemedText type="small" style={{ color: Accent.base }}>
                  LOCKED
                </ThemedText>
              </View>
            )}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        </ThemedView>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  headerWrap: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six + Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.one,
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
