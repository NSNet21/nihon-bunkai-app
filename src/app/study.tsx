import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { entriesForDeck, sampleDecks } from '@/data/sample';

export default function StudyScreen() {
  const { deckId } = useLocalSearchParams<{ deckId?: string }>();
  const deck = deckId ? sampleDecks.find((d) => d.id === deckId) : undefined;
  const entries = deckId ? entriesForDeck(deckId) : [];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.content}>
          {!deck ? (
            <ThemedText type="default" themeColor="textSecondary">
              เลือก deck จาก Browse ก่อน
            </ThemedText>
          ) : entries.length === 0 ? (
            <View style={styles.center}>
              <ThemedText type="title">{deck.title}</ThemedText>
              <ThemedText type="default" themeColor="textSecondary">
                Deck นี้ยังไม่มี entry (paid tier — จะปลดล็อกหลังซื้อ)
              </ThemedText>
            </View>
          ) : (
            <View style={styles.center}>
              <ThemedText type="title">{deck.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {entries.length} entries — Flashcard mode coming next
              </ThemedText>
              {/* TODO: Flashcard + FSRS rating component */}
              <ThemedView type="backgroundElement" style={styles.placeholderCard}>
                <ThemedText type="title" style={styles.term}>
                  {entries[0].t}
                </ThemedText>
                <ThemedText type="default" themeColor="textSecondary">
                  {entries[0].p}
                </ThemedText>
              </ThemedView>
            </View>
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
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
  },
  center: { gap: Spacing.three, alignItems: 'center', justifyContent: 'center', flex: 1 },
  placeholderCard: {
    padding: Spacing.six,
    borderRadius: 4,
    gap: Spacing.two,
    alignItems: 'center',
    marginTop: Spacing.five,
    minWidth: 240,
  },
  term: { fontSize: 48 },
});
