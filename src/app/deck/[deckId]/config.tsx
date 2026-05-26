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
import { FiArrowLeft } from 'react-icons/fi';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useThemeColors } from '@/context/theme';
import { usePersistedState } from '@/hooks/use-persisted-state';

type QuizCount = '10' | '20' | '30' | '50' | 'all';

const COUNT_OPTIONS: { value: QuizCount; label: string; hint: string }[] = [
  { value: '10',  label: '10',     hint: 'รวดเร็ว' },
  { value: '20',  label: '20',     hint: 'มาตรฐาน' },
  { value: '30',  label: '30',     hint: 'จริงจัง' },
  { value: '50',  label: '50',     hint: 'มาราธอน' },
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

  const handleBack = () => {
    if (!deckId) {
      router.back();
      return;
    }
    router.push(`/deck/${deckId}` as never);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* BACK row matches Quiz/Memorize convention — standalone above title */}
        <View style={styles.backRow}>
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="กลับ Practice Hub"
            style={({ pressed, hovered }) => [
              styles.backBtn,
              (pressed || hovered) && { opacity: 1 },
            ]}>
            {({ pressed, hovered }) => {
              const tint = pressed || hovered ? Accent.base : colors.textSecondary;
              return (
                <>
                  <FiArrowLeft size={16} color={tint} strokeWidth={2} />
                  <ThemedText type="small" style={[styles.backLabel, { color: tint }]}>BACK</ThemedText>
                </>
              );
            }}
          </Pressable>
        </View>

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
          <Pressable
            onPress={handleStart}
            accessibilityRole="button"
            accessibilityLabel={`เริ่มทดสอบ ${count === 'all' ? 'ทั้งชุด' : `${count} ข้อ`}`}
            style={({ pressed }) => [
              styles.ctaPrimary,
              { backgroundColor: Accent.base },
              pressed && { opacity: 0.85 },
            ]}>
            <ThemedText style={styles.ctaText}>
              เริ่มทดสอบ {count === 'all' ? '· ทั้งชุด' : `· ${count} ข้อ`}
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

  backRow: {
    flexDirection: 'row',
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
  backLabel: {
    letterSpacing: 1.2,
    fontWeight: '600',
  },

  titleRow: {
    paddingHorizontal: Spacing.four,
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
