/**
 * Quiz Config screen — /deck/[deckId]/config
 *
 * Single filter (Phase 2 S3): how many cards per Quiz session.
 *
 * Why Quiz-only (not Learn): per GPT verdict 2026-05-27 — Count is a Quiz
 * concept ("ขอทดสอบ 30 ข้อ"), not a Learn concept ("ขอเคลียร์ due").
 * Hub LEARN CTA goes direct to Memorize without passing config.
 *
 * Persistence: global key `quiz-count` ('10' | '20' | '30' | '50' | 'all').
 * User explicitly chose global > per-deck (single mental model). Default
 * = 'all' (deck stays full until user opts in to a limit).
 *
 * Wire: Hub Quiz CTA reads this key + appends `?count=N` to /quiz URL
 * (omitted when 'all'). Quiz screen slices `entries.slice(0, N)` when
 * the param is present AND no entryId resume is active (resume should
 * win over count limit).
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useThemeColors } from '@/context/theme';
import { usePersistedState } from '@/hooks/use-persisted-state';

type QuizCount = '10' | '20' | '30' | '50' | 'all';

/* Hint labels — neutral duration descriptors per GPT polish round
   2026-05-27. Original ("รวดเร็ว/มาตรฐาน/จริงจัง/มาราธอน") read like
   personality tags and made the user interpret intensity. Now they just
   describe relative length — no extra cognitive load. */
const COUNT_OPTIONS: { value: QuizCount; label: string; hint: string }[] = [
  { value: '10',  label: '10',     hint: 'สั้น' },
  { value: '20',  label: '20',     hint: 'ปกติ' },
  { value: '30',  label: '30',     hint: 'ยาว' },
  { value: '50',  label: '50',     hint: 'ยาวมาก' },
  { value: 'all', label: 'ทั้งหมด', hint: 'ทุกใบในชุดนี้' },
];

export default function QuizConfigScreen() {
  const { deckId } = useLocalSearchParams<{ deckId?: string }>();
  const { colors } = useThemeColors();
  const router = useRouter();
  const [count, setCount] = usePersistedState<QuizCount>('quiz-count', 'all');

  const handleStart = () => {
    if (!deckId) return;
    const qs = count !== 'all' ? `?count=${count}` : '';
    router.push(`/deck/${deckId}/quiz${qs}` as never);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* No in-page BACK — TopNavBar's right-aligned BACK handles return
            to Hub. Removed 2026-05-27 (user feedback: dual-BACK redundant). */}
        <View style={styles.titleRow}>
          <ThemedText type="title" style={styles.title}>ตั้งค่ารอบทบทวน</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            // QUIZ CONFIG · เลือกจำนวนการ์ดต่อรอบ
          </ThemedText>
        </View>

        <View style={styles.body}>
          <ThemedText type="smallBold" style={[styles.sectionHead, { color: colors.textHint }]}>
            // จำนวนการ์ด · CARDS PER SESSION
          </ThemedText>

          <View style={styles.optionList}>
            {COUNT_OPTIONS.map((opt) => {
              const active = opt.value === count;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setCount(opt.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`เลือก ${opt.label} ${opt.hint}`}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      borderColor: active ? Accent.base : colors.border,
                      backgroundColor: active ? Accent.bg : colors.backgroundElement,
                    },
                    pressed && !active && { opacity: 0.85 },
                  ]}>
                  <ThemedText
                    type="title"
                    style={[styles.optionLabel, { color: active ? Accent.base : colors.text }]}>
                    {opt.label}
                  </ThemedText>
                  <ThemedText type="small" themeColor={active ? 'text' : 'textSecondary'}>
                    {opt.hint}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <ThemedText type="small" themeColor="textHint" style={styles.helperText}>
            ค่าจะถูกบันทึกไว้ใช้ทุก deck · เปลี่ยนได้ทุกเมื่อ
          </ThemedText>
        </View>

        <View style={styles.ctaRow}>
          {/* CTA copy — "เริ่ม" dropped per GPT polish round 2026-05-27:
              user just finished configuring, the next action is the test
              itself, no setup step left. Shorter label = clearer intent. */}
          <Pressable
            onPress={handleStart}
            accessibilityRole="button"
            accessibilityLabel={`ทดสอบ ${count === 'all' ? 'ทั้งชุด' : `${count} ข้อ`}`}
            style={({ pressed }) => [
              styles.ctaPrimary,
              { backgroundColor: Accent.base },
              pressed && { opacity: 0.85 },
            ]}>
            <ThemedText style={styles.ctaText}>
              ทดสอบ {count === 'all' ? '· ทั้งชุด' : `· ${count} ข้อ`}
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },

  titleRow: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.one,
  },
  title: { fontSize: 32, lineHeight: 36 },
  subtitle: {
    letterSpacing: 1,
    fontWeight: '600',
  },

  body: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  sectionHead: {
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  optionList: { gap: Spacing.two },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Radii.md,
    borderWidth: 1,
    minHeight: 56,
  },
  optionLabel: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
    minWidth: 80,
  },

  helperText: {
    textAlign: 'center',
    marginTop: Spacing.two,
  },

  ctaRow: {
    padding: Spacing.four,
  },
  ctaPrimary: {
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.five,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
