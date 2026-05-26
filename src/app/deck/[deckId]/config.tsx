/**
 * Quiz Config screen — /deck/[deckId]/config
 *
 * PLACEHOLDER — full implementation lands in Phase 2 / S2 (Quiz Config
 * session). For now this is just a navigation target so the gear icon
 * on Deck Detail doesn't 404. Avoids dead-end on currently-shipped UI.
 */

import { Link, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { FiChevronLeft } from 'react-icons/fi';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function QuizConfigScreen() {
  const { deckId } = useLocalSearchParams<{ deckId?: string }>();
  const scheme = useColorScheme();
  const colors = (scheme === 'dark' ? Colors.dark : Colors.light) as typeof Colors.light;
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.headerBar}>
          <Link href={`/deck/${deckId ?? ''}` as never} asChild>
            <Pressable accessibilityRole="link" accessibilityLabel="กลับ Deck Detail" style={styles.backBtn}>
              <FiChevronLeft size={18} color={colors.text} strokeWidth={2} />
              <ThemedText type="small" themeColor="textSecondary">BACK</ThemedText>
            </Pressable>
          </Link>
        </View>
        <View style={styles.center}>
          <ThemedText type="title">ตั้งค่ารอบทบทวน</ThemedText>
          <ThemedText style={[styles.mono, { color: colors.textHint }]}>// COMING SOON</ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={{ textAlign: 'center', maxWidth: 360, marginTop: Spacing.three }}>
            หน้านี้จะเปิดให้ตั้งค่า · level filter · JP↔TH mode · cards per session
            ในรอบ polish ถัดไป
          </ThemedText>
          <Link href={`/deck/${deckId ?? ''}/quiz` as never} asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="เริ่มเรียนด้วยค่าเริ่มต้น"
              style={({ pressed }) => [
                styles.ctaPrimary,
                { backgroundColor: Accent.base },
                pressed && { opacity: 0.85 },
              ]}>
              <ThemedText style={styles.ctaText}>เริ่มเรียนด้วยค่าเริ่มต้น</ThemedText>
            </Pressable>
          </Link>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  mono: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginTop: Spacing.one,
  },
  ctaPrimary: {
    marginTop: Spacing.five,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
  },
  ctaText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.5,
  },
});
