import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { FiChevronLeft } from 'react-icons/fi';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CustomTermCreateFlow } from '@/components/custom-term-create-flow';
import { MobileBottomNav } from '@/components/top-nav-bar';
import { RouteLoadingIndicator } from '@/components/route-loading-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, Spacing } from '@/constants/theme';
import { useThemePalette } from '@/context/theme';
import { useAllDecks } from '@/hooks/use-decks';

export default function NewTermScreen() {
  const router = useRouter();
  const colors = useThemePalette();
  const { decks, loading, refresh } = useAllDecks();

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/' as never);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="กลับ Browse"
            style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}>
            <FiChevronLeft size={18} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <ThemedText type="defaultSemiBold">เพิ่มคำใหม่</ThemedText>
            <ThemedText type="small" style={{ color: Accent.base }}>// CUSTOM TERM · local library</ThemedText>
          </View>
        </View>
        {loading ? (
          <RouteLoadingIndicator />
        ) : (
          <CustomTermCreateFlow
            decks={decks}
            variant="page"
            onCreated={refresh}
            onOpenCreated={({ deckId, entryId }) => router.push(`/deck/${deckId}/term/${entryId}` as never)}
          />
        )}
      </SafeAreaView>
      <MobileBottomNav />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    minHeight: 62,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  backButton: {
    padding: Spacing.two,
  },
});
