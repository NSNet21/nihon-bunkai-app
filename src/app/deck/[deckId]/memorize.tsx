/**
 * Memorize mode — /deck/[deckId]/memorize
 *
 * Passive review pattern (mirrors Vocat's "การเรียนรู้" / Anki's "Browse"):
 *   - Show ALL fields at once (T hero + P reading + D meaning pill + E body)
 *   - No flip, no rating, no FSRS update, no session log
 *   - Prev / Next navigation only
 *   - Editorial brutalism UI (own brand style — NOT Vocat's pastel)
 *
 * Use case: read-through exposure before committing to active recall
 * (Quiz mode). User can come here unlimited times without polluting
 * FSRS schedule or streak.
 */

import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { FiArrowLeft, FiBookOpen, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import Markdown from 'react-native-markdown-display';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SpeakButton } from '@/components/speak-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, BottomTabInset, Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { entriesForDeckAsync, useAllDecks } from '@/hooks/use-decks';
import type { Entry } from '@/data/types';

export default function MemorizeScreen() {
  const { deckId } = useLocalSearchParams<{ deckId?: string }>();
  const scheme = useColorScheme();
  const colors = (scheme === 'dark' ? Colors.dark : Colors.light) as typeof Colors.light;

  const { decks: allDecks } = useAllDecks();
  const deck = deckId ? allDecks.find((d) => d.id === deckId) : undefined;
  const [entries, setEntries] = useState<Entry[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!deckId) return;
    let cancelled = false;
    void entriesForDeckAsync(deckId).then((rows) => {
      if (cancelled) return;
      setEntries(rows);
      setIndex(0);
    });
    return () => {
      cancelled = true;
    };
  }, [deckId]);

  const current = entries[index];
  const canPrev = index > 0;
  const canNext = index < entries.length - 1;

  function goPrev() {
    if (canPrev) setIndex((i) => i - 1);
  }
  function goNext() {
    if (canNext) setIndex((i) => i + 1);
  }

  if (!deck || !current) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <Header deck={deck} index={0} total={0} colors={colors} />
          <View style={styles.centerFill}>
            <ThemedText type="title">{deck ? 'ยังไม่มีคำในชุดนี้' : 'ไม่พบ Deck'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', maxWidth: 320 }}>
              {deck ? 'Deck ว่างเปล่า — กลับไปเลือกชุดอื่น' : 'อาจถูกลบหรือ deck ID ไม่ถูกต้อง'}
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Header deck={deck} index={index} total={entries.length} colors={colors} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: BottomTabInset + 96 }]}
          showsVerticalScrollIndicator={false}>
          {/* Section label — editorial mono */}
          <View style={styles.secLabel}>
            <View style={[styles.pip, { backgroundColor: Accent.base }]} />
            <ThemedText style={[styles.mono, { color: colors.textHint, fontSize: 10 }]}>
              {`// CARD ${String(index + 1).padStart(2, '0')} / ${entries.length}`}
            </ThemedText>
            <View style={{ flex: 1 }} />
            <FiBookOpen size={12} color={colors.textHint} strokeWidth={2} />
            <ThemedText style={[styles.mono, { color: colors.textHint, fontSize: 10 }]}>MEMORIZE</ThemedText>
          </View>

          {/* Hero block — T (kanji/term) + speaker bound tight */}
          <View style={styles.heroBlock}>
            <ThemedText style={[styles.term, { color: colors.text }]}>{current.t}</ThemedText>
            {current.t ? (
              <SpeakButton text={current.t} language="ja-JP" colors={colors} size="md" />
            ) : null}
          </View>

          {/* P (reading) in brackets — secondary type */}
          {current.p ? (
            <View style={styles.bracketRow}>
              <ThemedText style={[styles.bracketText, { color: colors.textSecondary }]}>
                {current.p}
              </ThemedText>
            </View>
          ) : null}

          {/* D (meaning) as crimson pill — short, prominent */}
          {current.d ? (
            <View style={[styles.meaningPill, { borderColor: Accent.soft, backgroundColor: Accent.bg }]}>
              <ThemedText style={[styles.meaningText, { color: Accent.base }]}>{current.d}</ThemedText>
            </View>
          ) : null}

          {/* Divider — Vocat's dotted line. We use solid hairline (brutalist). */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* E (markdown body) — sections, examples, notes */}
          {current.e ? (
            <View style={styles.bodyWrap}>
              <Markdown style={markdownStyles(colors)}>{current.e}</Markdown>
            </View>
          ) : null}
        </ScrollView>

        {/* Footer controls — prev / next, ChevronLeft/Right buttons.
            Match Quiz mode's rail style for consistency. */}
        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <NavButton
            direction="left"
            onPress={goPrev}
            disabled={!canPrev}
            colors={colors}
          />
          <View style={styles.progressWrap}>
            <ThemedText style={[styles.mono, { color: colors.textHint, fontSize: 10 }]}>
              {`${index + 1} / ${entries.length}`}
            </ThemedText>
          </View>
          <NavButton
            direction="right"
            onPress={goNext}
            disabled={!canNext}
            colors={colors}
          />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

/* ─── Subcomponents ─────────────────────────────────────────────────── */

function Header({
  deck,
  index,
  total,
  colors,
}: {
  deck: { id: string; title: string } | undefined;
  index: number;
  total: number;
  colors: typeof Colors.light;
}) {
  return (
    <View style={styles.headerBar}>
      <Link href={`/deck/${deck?.id ?? ''}` as never} asChild>
        <Pressable accessibilityRole="link" accessibilityLabel="กลับ Practice Hub" style={styles.backBtn}>
          <FiArrowLeft size={18} color={colors.text} strokeWidth={2} />
          <ThemedText type="small" themeColor="textSecondary">BACK</ThemedText>
        </Pressable>
      </Link>
      <View style={{ flex: 1 }} />
      {total > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          {index + 1} / {total}
        </ThemedText>
      )}
    </View>
  );
}

function NavButton({
  direction,
  onPress,
  disabled,
  colors,
}: {
  direction: 'left' | 'right';
  onPress: () => void;
  disabled: boolean;
  colors: typeof Colors.light;
}) {
  const Icon = direction === 'left' ? FiChevronLeft : FiChevronRight;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={direction === 'left' ? 'การ์ดก่อนหน้า' : 'การ์ดถัดไป'}
      style={({ pressed }) => [
        styles.navBtn,
        { borderColor: colors.border },
        pressed && !disabled && { opacity: 0.6 },
        disabled && { opacity: 0.25 },
      ]}>
      <Icon size={22} color={colors.text} strokeWidth={2} />
    </Pressable>
  );
}

/* ─── Markdown styles ───────────────────────────────────────────────── */

function markdownStyles(colors: typeof Colors.light) {
  return {
    body:        { color: colors.text, fontSize: 14, lineHeight: 22 },
    heading3:    { color: colors.text, fontSize: 16, fontWeight: '600' as const, marginTop: Spacing.three, marginBottom: Spacing.one },
    strong:      { color: colors.text, fontWeight: '700' as const },
    em:          { color: colors.text, fontStyle: 'italic' as const },
    bullet_list: { marginVertical: Spacing.one },
    list_item:   { color: colors.text, marginVertical: 2 },
    blockquote:  {
      backgroundColor: colors.backgroundSelected,
      borderLeftColor: colors.textSecondary,
      borderLeftWidth: 3,
      paddingLeft: Spacing.three,
      paddingVertical: Spacing.one,
      marginVertical: Spacing.two,
    },
    hr: { backgroundColor: colors.textSecondary, height: 1, marginVertical: Spacing.three, opacity: 0.3 },
  };
}

/* ─── Styles ────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
    paddingTop: Spacing.two,
  },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  secLabel: {
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
  heroBlock: {
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.four,
  },
  term: {
    fontFamily: Platform.select({ web: '"Noto Serif JP", "Hiragino Mincho ProN", serif', default: undefined }),
    fontSize: 72,
    fontWeight: '300',
    lineHeight: 78,
    letterSpacing: -1,
    textAlign: 'center',
  },
  bracketRow: {
    alignItems: 'center',
  },
  bracketText: {
    fontSize: 16,
    letterSpacing: 0.3,
    /* Visual frame — square brackets baked in. Skip if `p` already
       wraps in brackets (Vocat-style data convention). */
  },
  meaningPill: {
    alignSelf: 'center',
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 0,            // sharp — editorial
  },
  meaningText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.two,
  },
  bodyWrap: { paddingHorizontal: Spacing.one },
  /* ─── Footer ─── */
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderTopWidth: 1,
  },
  navBtn: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
