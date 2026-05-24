import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Rating } from 'ts-fsrs';

import { Flashcard, type ColumnVisibility } from '@/components/flashcard';
import { RatingButtons } from '@/components/rating-buttons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, BottomTabInset, Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAllDecks, entriesForDeckAsync } from '@/hooks/use-decks';
import type { Entry } from '@/data/types';

export default function StudyScreen() {
  const { deckId } = useLocalSearchParams<{ deckId?: string }>();
  const { decks: allDecks } = useAllDecks();
  const deck = deckId ? allDecks.find((d) => d.id === deckId) : undefined;
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!deckId) {
      setEntries([]);
      return;
    }
    void entriesForDeckAsync(deckId).then((rows) => {
      if (!cancelled) setEntries(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [deckId]);

  const [index, setIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [results, setResults] = useState<Rating[]>([]);
  /* Column visibility — session-level (resets on deck switch / refresh) */
  const [visibility, setVisibility] = useState<ColumnVisibility>({ d: true, p: true, e: true });

  const scheme = useColorScheme();
  const colors = (scheme === 'dark' ? Colors.dark : Colors.light) as typeof Colors.light;

  const current = entries[index];
  const isComplete = entries.length > 0 && index >= entries.length;
  const canPrev = index > 0;
  const canNext = index < entries.length - 1;

  function handleRate(rating: Rating) {
    setResults((prev) => [...prev, rating]);
    setIsFlipped(false);
    setIndex((i) => i + 1);
  }

  function handlePrev() {
    if (!canPrev) return;
    setIsFlipped(false);
    setIndex((i) => i - 1);
  }

  function handleNext() {
    if (!canNext) return;
    setIsFlipped(false);
    setIndex((i) => i + 1);
  }

  function handleRestart() {
    setIndex(0);
    setIsFlipped(false);
    setResults([]);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.content}>
          {!deck ? (
            <EmptyState
              title="ยังไม่ได้เลือก Deck"
              body="เลือก deck จากแท็บ Browse เพื่อเริ่มเรียน"
            />
          ) : entries.length === 0 ? (
            <EmptyState
              title={deck.title}
              body="Deck นี้ยังไม่มี entry — paid tier จะปลดล็อกหลังซื้อจาก nihon-bunkai-landing.pages.dev"
            />
          ) : isComplete ? (
            <SessionComplete deckTitle={deck.title} results={results} onRestart={handleRestart} />
          ) : (
            <>
              <View style={styles.header}>
                <ThemedText type="defaultSemiBold">{deck.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {index + 1} / {entries.length}
                </ThemedText>
              </View>
              <View style={styles.cardRow}>
                <SideRail
                  direction="left"
                  onPress={handlePrev}
                  disabled={!canPrev}
                  colors={colors}
                />
                <View style={styles.cardSlot}>
                  <Flashcard
                    entry={current}
                    isFlipped={isFlipped}
                    onFlip={() => setIsFlipped((f) => !f)}
                    visibility={visibility}
                    onVisibilityChange={setVisibility}
                  />
                </View>
                <SideRail
                  direction="right"
                  onPress={handleNext}
                  disabled={!canNext}
                  colors={colors}
                />
              </View>
              <RatingButtons onRate={handleRate} disabled={!isFlipped} />
            </>
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function SideRail({
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
  const accessibilityLabel = direction === 'left' ? 'Previous card' : 'Next card';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        railStyles.button,
        pressed && !disabled && railStyles.pressed,
        disabled && railStyles.disabled,
      ]}>
      <Icon size={56} color={colors.textSecondary} strokeWidth={1.5} />
    </Pressable>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.center}>
      <ThemedText type="title">{title}</ThemedText>
      <ThemedText type="default" themeColor="textSecondary" style={styles.emptyBody}>
        {body}
      </ThemedText>
    </View>
  );
}

function SessionComplete({
  deckTitle,
  results,
  onRestart,
}: {
  deckTitle: string;
  results: Rating[];
  onRestart: () => void;
}) {
  return (
    <View style={styles.center}>
      <ThemedText type="title">เรียนจบแล้ว 🎌</ThemedText>
      <ThemedText type="default" themeColor="textSecondary">
        {deckTitle} · {results.length} cards
      </ThemedText>
      <View style={styles.completeActions}>
        <Pressable onPress={onRestart} style={({ pressed }) => [styles.restartBtn, pressed && styles.pressed]}>
          <ThemedText type="defaultSemiBold" style={{ color: Accent.base }}>
            เรียนรอบใหม่
          </ThemedText>
        </Pressable>
        <Link href="/" asChild>
          <Pressable style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}>
            <ThemedText type="default" themeColor="textSecondary">
              กลับไป Browse
            </ThemedText>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  content: {
    flex: 1,
    padding: Spacing.four,
    paddingTop: Spacing.six + Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  cardSlot: { flex: 1, alignSelf: 'stretch' },
  center: { flex: 1, gap: Spacing.three, alignItems: 'center', justifyContent: 'center' },
  emptyBody: { textAlign: 'center', maxWidth: 360 },
  completeActions: { gap: Spacing.two, marginTop: Spacing.four, alignItems: 'center' },
  restartBtn: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Accent.base,
  },
  linkBtn: {
    paddingVertical: Spacing.two,
  },
  pressed: { opacity: 0.7 },
});

const railStyles = StyleSheet.create({
  button: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    backgroundColor: 'transparent',
  },
  pressed: { opacity: 0.5 },
  disabled: { opacity: 0.2 },
});
