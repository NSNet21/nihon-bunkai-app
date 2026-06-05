/**
 * Deck Term List screen — /deck/[deckId]
 *
 * Default deck surface after Browse. Shows the entries inside one deck,
 * supports scoped in-deck search, and sends study starts to the mode picker.
 */

import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { FiBookOpen, FiChevronLeft, FiChevronRight, FiMoreVertical, FiPlus, FiSearch } from 'react-icons/fi';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DeckManagementModal } from '@/components/deck-management-modal';
import { TermEditingModal } from '@/components/term-editing-modal';
import { freeDeckParams } from '@/data/static-params';
import type { Entry } from '@/data/types';
import { Accent, BottomTabInset, Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useThemeColors } from '@/context/theme';
import { entriesForDeckAsync, useAllDecks } from '@/hooks/use-decks';
import { filterDeckEntries } from '@/lib/deck-term-search';
import { isUserEditableDeck } from '@/lib/user-content';

/* Pre-render this route for every free deck so direct URL access
   (cold load, bookmark, share-link) gets the correct static HTML
   instead of CF Pages' SPA index.html fallback. */
export function generateStaticParams() {
  return freeDeckParams();
}

export default function DeckTermListScreen() {
  const { deckId } = useLocalSearchParams<{ deckId?: string }>();
  const { push, replace } = useRouter();
  const { colors } = useThemeColors();
  const { width: viewportW } = useWindowDimensions();
  const isCompact = viewportW < 600;

  const { decks: allDecks, refresh } = useAllDecks();
  const deck = deckId ? allDecks.find((d) => d.id === deckId) : undefined;

  const [entries, setEntries] = useState<Entry[]>([]);
  const [query, setQuery] = useState('');
  const [deckActionsOpen, setDeckActionsOpen] = useState(false);
  const [addTermOpen, setAddTermOpen] = useState(false);
  const filteredEntries = useMemo(() => filterDeckEntries(entries, query), [entries, query]);

  useEffect(() => {
    if (!deckId) return;
    let cancelled = false;
    void entriesForDeckAsync(deckId).then((rows) => {
      if (!cancelled) setEntries(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [deckId]);

  function goTerm(entry: Entry) {
    if (!deckId) return;
    push(`/deck/${deckId}/term/${entry.id}` as never);
  }

  function goModes() {
    if (!deckId) return;
    push(`/deck/${deckId}/modes` as never);
  }

  function handleTermCreated(entry: Entry) {
    setEntries((rows) => [...rows, entry]);
    setAddTermOpen(false);
    refresh();
    push(`/deck/${entry.pack}/term/${entry.id}` as never);
  }

  if (!deck) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.headerBar}>
            <BackLink colors={colors} />
          </View>
          <View style={styles.centerFill}>
            <ThemedText type="title" style={[styles.notFoundTitle, { color: colors.text }]}>
              ไม่พบ Deck นี้
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.notFoundBody}>
              อาจถูกลบหรือ deck ID ไม่ถูกต้อง · ลองกลับไปหน้า Browse แล้วเลือกใหม่
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const titleParts = deck.title.split('·').map((s) => s.trim());
  const titleMain = titleParts[0] ?? deck.title;
  const titleSub = titleParts.slice(1).join(' · ');
  const canAddTerm = isUserEditableDeck(deck);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: BottomTabInset + Spacing.sp20 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator>
          <View style={styles.headerBar}>
            <BackLink colors={colors} />
          </View>

          <View style={[styles.hero, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
            <View style={[styles.heroStripe, { backgroundColor: Accent.base }]} />
            <Pressable
              onPress={() => setDeckActionsOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="เปิด Deck Actions"
              style={({ pressed, hovered }: any) => [
                styles.heroActionBtn,
                { borderColor: colors.border, backgroundColor: colors.background },
                (pressed || hovered) && { borderColor: Accent.soft },
                pressed && { opacity: 0.75 },
              ]}>
              {({ pressed, hovered }: any) => (
                <FiMoreVertical size={16} color={pressed || hovered ? Accent.base : colors.text} strokeWidth={2} />
              )}
            </Pressable>
            <ThemedText style={[styles.ghostKanji, { color: colors.text }]}>語</ThemedText>
            <View style={styles.metaRow}>
              <View style={[styles.pip, { backgroundColor: Accent.base }]} />
              <ThemedText style={[styles.mono, { color: colors.textHint }]}>
                {`// JLPT ${deck.level ?? 'GLOSSARY'} · ${deck.type.toUpperCase()}`}
              </ThemedText>
            </View>
            <ThemedText style={[styles.heroTitle, isCompact && styles.heroTitleCompact, { color: colors.text }]}>
              {titleMain}
            </ThemedText>
            {titleSub ? (
              <ThemedText style={[styles.heroSub, { color: Accent.base }]}>{titleSub}</ThemedText>
            ) : null}
            <View style={styles.pillRow}>
              <View style={[styles.pill, { borderColor: Accent.soft, backgroundColor: Accent.bg }]}>
                <ThemedText style={[styles.pillText, { color: Accent.base }]}>
                  {`${deck.entryCount} TERMS`}
                </ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.sectionHead}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.pip, { backgroundColor: Accent.base }]} />
              <ThemedText style={[styles.mono, { color: colors.textHint }]}>
                // TERMS · คำใน deck
              </ThemedText>
            </View>
            {canAddTerm ? (
              <Pressable
                onPress={() => setAddTermOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="เพิ่มคำใหม่"
                style={({ pressed, hovered }: any) => [
                  styles.addTermBtn,
                  { borderColor: Accent.soft, backgroundColor: Accent.bg },
                  (pressed || hovered) && { borderColor: Accent.base },
                  pressed && { opacity: 0.78 },
                ]}>
                <FiPlus size={15} color={Accent.base} strokeWidth={2} />
                <ThemedText style={[styles.addTermText, { color: Accent.base }]}>ADD TERM</ThemedText>
              </Pressable>
            ) : null}
          </View>

          <View style={[styles.searchBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <FiSearch size={17} color={query ? Accent.base : colors.textHint} strokeWidth={2} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="ค้นหาใน deck นี้"
              placeholderTextColor={colors.textHint}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.searchInput, { color: colors.text }]}
            />
          </View>

          <View style={styles.resultLine}>
            <ThemedText type="small" themeColor="textSecondary">
              {`ทั้งหมด ${filteredEntries.length} / ${entries.length} คำ`}
            </ThemedText>
          </View>

          {filteredEntries.length > 0 ? (
            <View style={[styles.termList, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
              {filteredEntries.map((entry, index) => (
                <TermRow
                  key={entry.id}
                  entry={entry}
                  index={index}
                  total={filteredEntries.length}
                  colors={colors}
                  onPress={() => goTerm(entry)}
                />
              ))}
            </View>
          ) : (
            <View style={[styles.emptyState, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
              <ThemedText type="defaultSemiBold">ไม่พบคำที่ตรงกับการค้นหา</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyBody}>
                ลองค้นหาด้วยคำศัพท์ คำอ่าน ความหมาย หรือเลขลำดับใน deck นี้
              </ThemedText>
            </View>
          )}
        </ScrollView>

        <View style={[styles.ctaWrap, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <Pressable
            onPress={goModes}
            accessibilityRole="button"
            accessibilityLabel="เริ่มเรียน"
            style={({ pressed, hovered }: any) => [
              styles.startBtn,
              { backgroundColor: Accent.base, borderColor: Accent.base },
              (pressed || hovered) && { backgroundColor: Accent.strong, borderColor: Accent.strong },
              pressed && { opacity: 0.88 },
            ]}>
            <FiBookOpen size={17} color="#fff" strokeWidth={2} />
            <ThemedText style={styles.startText}>เริ่มเรียน</ThemedText>
          </Pressable>
        </View>
        <DeckManagementModal
          visible={deckActionsOpen}
          deck={deck}
          onClose={() => setDeckActionsOpen(false)}
          onChanged={() => {
            refresh();
            setDeckActionsOpen(false);
          }}
          onDeleted={() => {
            refresh();
            setDeckActionsOpen(false);
            replace('/' as never);
          }}
        />
        <TermEditingModal
          visible={addTermOpen}
          mode="create"
          deck={deck}
          onClose={() => setAddTermOpen(false)}
          onCreated={handleTermCreated}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function BackLink({ colors }: { colors: typeof Colors.light }) {
  return (
    <Link href="/" asChild>
      <Pressable accessibilityRole="link" accessibilityLabel="กลับ Browse" style={styles.backBtn}>
        {({ pressed, hovered }: any) => {
          const active = pressed || hovered;
          return (
            <>
              <FiChevronLeft size={18} color={active ? Accent.base : colors.text} strokeWidth={2} />
              <ThemedText type="small" style={{ color: active ? Accent.base : colors.textSecondary }}>
                BACK
              </ThemedText>
            </>
          );
        }}
      </Pressable>
    </Link>
  );
}

function TermRow({
  entry,
  index,
  total,
  colors,
  onPress,
}: {
  entry: Entry;
  index: number;
  total: number;
  colors: typeof Colors.light;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`เปิดคำ ${entry.t}`}
      style={({ pressed, hovered }: any) => [
        styles.termRow,
        index < total - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
        (pressed || hovered) && { backgroundColor: colors.backgroundSelected },
        pressed && { opacity: 0.82 },
      ]}>
      <View style={[styles.termNo, { borderColor: Accent.soft, backgroundColor: Accent.bg }]}>
        <ThemedText style={[styles.termNoText, { color: Accent.base }]}>
          {String(entry.no).padStart(2, '0')}
        </ThemedText>
      </View>
      <View style={styles.termMain}>
        <View style={styles.termTopLine}>
          <ThemedText style={[styles.termText, { color: colors.text }]} numberOfLines={1}>
            {entry.t}
          </ThemedText>
          {entry.p ? (
            <ThemedText style={[styles.termReading, { color: colors.textSecondary }]} numberOfLines={1}>
              {entry.p}
            </ThemedText>
          ) : null}
        </View>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
          {entry.d}
        </ThemedText>
      </View>
      <FiChevronRight size={16} color={colors.textHint} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, width: '100%' },
  scroll: { flex: 1 },
  scrollContent: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  notFoundTitle: {
    textAlign: 'center',
  },
  notFoundBody: {
    textAlign: 'center',
    maxWidth: 320,
  },
  hero: {
    position: 'relative',
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
    overflow: 'hidden',
    gap: Spacing.two,
  },
  heroStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  heroActionBtn: {
    position: 'absolute',
    top: Spacing.three,
    right: Spacing.three,
    zIndex: 2,
    width: 34,
    height: 34,
    borderWidth: 1,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostKanji: {
    position: 'absolute',
    fontFamily: Platform.select({ web: '"Noto Serif JP", "Hiragino Mincho ProN", serif', default: undefined }),
    fontSize: 190,
    fontWeight: '300',
    opacity: 0.04,
    right: -18,
    top: -44,
    lineHeight: 190,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  pip: { width: 5, height: 5 },
  mono: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  heroTitle: {
    fontFamily: Platform.select({ web: '"Noto Serif JP", "Hiragino Mincho ProN", serif', default: undefined }),
    fontSize: 42,
    fontWeight: '300',
    lineHeight: 46,
    marginTop: Spacing.two,
  },
  heroTitleCompact: {
    fontSize: 34,
    lineHeight: 39,
  },
  heroSub: {
    fontFamily: Platform.select({ web: '"Oswald", sans-serif', default: undefined }),
    fontSize: 22,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  pill: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderWidth: 1,
    borderRadius: 0,
  },
  pillText: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minWidth: 0,
    flex: 1,
  },
  addTermBtn: {
    minHeight: 32,
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  addTermText: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  searchBox: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: Radii.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: 42,
    fontSize: 15,
    fontWeight: '500',
    fontFamily: Platform.select({ web: '"Sarabun", sans-serif', default: undefined }),
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null),
  },
  resultLine: {
    marginTop: -Spacing.two,
  },
  termList: {
    borderWidth: 1,
    borderRadius: Radii.sm,
    overflow: 'hidden',
  },
  termRow: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  termNo: {
    width: 34,
    height: 34,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  termNoText: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 10,
    fontWeight: '600',
  },
  termMain: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  termTopLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
    minWidth: 0,
  },
  termText: {
    flexShrink: 1,
    minWidth: 0,
    fontFamily: Platform.select({ web: '"Noto Serif JP", "Hiragino Mincho ProN", serif', default: undefined }),
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '500',
  },
  termReading: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Platform.select({ web: '"Noto Serif JP", "Hiragino Mincho ProN", serif', default: undefined }),
  },
  emptyState: {
    borderWidth: 1,
    borderRadius: Radii.sm,
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.two,
  },
  emptyBody: {
    textAlign: 'center',
    maxWidth: 360,
  },
  ctaWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
  },
  startBtn: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Radii.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  startText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
