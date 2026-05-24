import { FlashList } from '@shopify/flash-list';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, BottomTabInset, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { decks } from '@/data/free-tier';
import type { Deck } from '@/data/types';

type Row =
  | { kind: 'levelHeader';    title: string; key: string }
  | { kind: 'categoryHeader'; title: string; key: string }
  | { kind: 'deck';           deck: Deck;    key: string };

const CATEGORY_ORDER: Deck['type'][] = ['kanji', 'grammar', 'vocab', 'glossary'];
const CATEGORY_LABEL: Record<Deck['type'], string> = {
  kanji:    'KANJI',
  grammar:  'GRAMMAR',
  vocab:    'VOCAB',
  glossary: 'GLOSSARY',
};

/* Group: JLPT level (big) → Category (sub) → Packs (decks).
   Glossary has no level → goes under its own big-group. */
function buildRows(allDecks: Deck[]): Row[] {
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
  /* Render levels in order N5 → N4 → ... → GLOSSARY (standalone) */
  const levelOrder = ['N5', 'N4', 'N3', 'N2', 'N1', 'GLOSSARY'];
  for (const lvl of levelOrder) {
    const cats = byLevel.get(lvl);
    if (!cats) continue;
    rows.push({ kind: 'levelHeader', title: lvl, key: `lvl-${lvl}` });
    for (const cat of CATEGORY_ORDER) {
      const decks = cats.get(cat);
      if (!decks?.length) continue;
      /* Skip category sub-header if the level only has one category (Glossary case) */
      if (cats.size > 1) {
        rows.push({ kind: 'categoryHeader', title: CATEGORY_LABEL[cat], key: `cat-${lvl}-${cat}` });
      }
      for (const d of decks) rows.push({ kind: 'deck', deck: d, key: d.id });
    }
  }

  if (locked.length) {
    rows.push({ kind: 'levelHeader', title: 'LOCKED · ปลดล็อกหลังซื้อ', key: 'lvl-locked' });
    for (const d of locked) rows.push({ kind: 'deck', deck: d, key: d.id });
  }

  return rows;
}

export default function BrowseScreen() {
  const rows = buildRows(decks);
  const totalFreeEntries = decks
    .filter((d) => d.isFree)
    .reduce((s, d) => s + d.entryCount, 0);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.headerWrap}>
          <ThemedText type="title">Browse</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {totalFreeEntries} entries · {decks.filter((d) => d.isFree).length} packs ฟรี · ทักหลังเพื่อปลดล็อกเพิ่ม
          </ThemedText>
        </View>
        <FlashList<Row>
          data={rows}
          keyExtractor={(item) => item.key}
          getItemType={(item) => item.kind}
          renderItem={({ item }) => {
            if (item.kind === 'levelHeader')    return <LevelHeader title={item.title} />;
            if (item.kind === 'categoryHeader') return <CategoryHeader title={item.title} />;
            return <DeckRow deck={item.deck} />;
          }}
          contentContainerStyle={styles.listContent}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function LevelHeader({ title }: { title: string }) {
  return (
    <View style={styles.levelHeader}>
      <View style={styles.levelRule} />
      <ThemedText type="defaultSemiBold" style={[styles.levelTitle, { color: Accent.base }]}>
        {title}
      </ThemedText>
    </View>
  );
}

function CategoryHeader({ title }: { title: string }) {
  return (
    <View style={styles.categoryHeader}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.categoryTitle}>
        {title}
      </ThemedText>
    </View>
  );
}

function DeckRow({ deck }: { deck: Deck }) {
  const subtitle = deck.isFree ? `${deck.entryCount} cards` : 'paid · landing page';
  return (
    <Link href={{ pathname: '/study', params: { deckId: deck.id } }} asChild>
      <Pressable style={({ pressed }) => [styles.deckCard, pressed && styles.pressed]}>
        <ThemedView type="backgroundElement" style={styles.deckCardInner}>
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
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
    paddingLeft: Spacing.three,
  },
  categoryTitle: { letterSpacing: 1.2 },
  deckCard: { borderRadius: Radii.md, marginBottom: Spacing.two },
  deckCardInner: { padding: Spacing.three, borderRadius: Radii.md, gap: 2 },
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
