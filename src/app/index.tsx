import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, BottomTabInset, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { decks as sampleDecks } from '@/data/free-tier';

export default function BrowseScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <ThemedText type="title">Browse Decks</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              เลือก deck เพื่อเริ่มเรียน
            </ThemedText>
          </View>

          <View style={styles.deckGrid}>
            {sampleDecks.map((deck) => (
              <Link
                key={deck.id}
                href={{ pathname: '/study', params: { deckId: deck.id } }}
                asChild>
                <Pressable
                  style={({ pressed }) => [styles.deckCard, pressed && styles.pressed]}>
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
                      {deck.entryCount} entries
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              </Link>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  scrollContent: {
    padding: Spacing.four,
    paddingTop: Spacing.six + Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
  },
  header: { gap: Spacing.one },
  deckGrid: { gap: Spacing.three },
  deckCard: { borderRadius: Radii.md },
  deckCardInner: {
    padding: Spacing.four,
    borderRadius: Radii.md,
    gap: Spacing.two,
  },
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
