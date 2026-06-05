/**
 * Study Config screen — /deck/[deckId]/config
 *
 * Global per-mode session config for Flashcard, Multiple Choice, and
 * Dictation. Legacy direct quiz links with `?count=N` remain handled in
 * quiz.tsx; this route writes the new mode config keys only.
 */

import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { FiChevronLeft } from 'react-icons/fi';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useThemePalette } from '@/context/theme';
import { freeDeckParams } from '@/data/static-params';
import { usePersistedState } from '@/hooks/use-persisted-state';
import {
  DEFAULT_STUDY_MODE_CONFIGS,
  sanitizeStudyModeConfig,
  studyModeConfigKey,
  type StudyCount,
  type StudyGoal,
  type StudyMode,
  type StudyModeConfig,
  type StudyOrder,
} from '@/lib/study-mode-config';

export function generateStaticParams() {
  return freeDeckParams();
}

const COUNT_OPTIONS: { value: StudyCount; label: string }[] = [
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 30, label: '30' },
  { value: 50, label: '50' },
  { value: 'all', label: 'ทั้งหมด' },
];

const ORDER_OPTIONS: { value: StudyOrder; label: string }[] = [
  { value: 'normal', label: 'ตามลำดับ' },
  { value: 'shuffle', label: 'สุ่ม' },
];

const GOAL_OPTIONS: { value: StudyGoal; label: string }[] = [
  { value: 'term', label: 'ฝึกจำคำศัพท์' },
  { value: 'meaning', label: 'ฝึกจำความหมาย' },
  { value: 'reading', label: 'ฝึกจำคำอ่าน' },
];

const HINT_OPTIONS = [
  { key: 'term', label: 'เห็นคำศัพท์' },
  { key: 'meaning', label: 'เห็นความหมาย' },
  { key: 'reading', label: 'เห็นคำอ่าน' },
] as const;

const MODE_LABELS: Record<StudyMode, string> = {
  flashcard: 'แฟลชการ์ด',
  'multiple-choice': 'ปรนัย',
  dictation: 'เขียนตอบ',
};

export default function StudyConfigScreen() {
  const { deckId, mode: modeParam, next, returnTo } = useLocalSearchParams<{
    deckId?: string;
    mode?: string;
    next?: string;
    returnTo?: string;
  }>();
  const router = useRouter();
  const colors = useThemePalette();

  const mode: StudyMode =
    modeParam === 'multiple-choice' || modeParam === 'dictation' || modeParam === 'flashcard'
      ? modeParam
      : 'flashcard';

  const [config, setConfig] = usePersistedState<StudyModeConfig>(
    studyModeConfigKey(mode),
    DEFAULT_STUDY_MODE_CONFIGS[mode],
  );
  const safeConfig = sanitizeStudyModeConfig(config, mode);
  const returnHref =
    deckId && typeof returnTo === 'string' && returnTo.startsWith(`/deck/${deckId}/`)
      ? returnTo
      : deckId
        ? `/deck/${deckId}/modes`
        : '/';
  const backLabel = returnHref.endsWith('/modes') ? 'กลับไปเลือกวิธีเรียน' : 'กลับหน้ารอบเรียน';

  function updateConfig(nextConfig: StudyModeConfig) {
    setConfig(sanitizeStudyModeConfig(nextConfig, mode));
  }

  function setCount(count: StudyCount) {
    updateConfig({ ...safeConfig, count });
  }

  function setOrder(order: StudyOrder) {
    updateConfig({ ...safeConfig, order });
  }

  function setGoal(goal: StudyGoal) {
    updateConfig({ ...safeConfig, goal });
  }

  function toggleHint(key: keyof StudyModeConfig['hints']) {
    updateConfig({
      ...safeConfig,
      hints: {
        ...safeConfig.hints,
        [key]: !safeConfig.hints[key],
      },
    });
  }

  function handleStart() {
    if (!deckId) return;
    const route = next === 'multiple-choice' || next === 'dictation' || next === 'quiz' ? next : 'quiz';
    setConfig({ ...safeConfig, configured: true });
    router.replace(`/deck/${deckId}/${route}` as never);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator>
          <View style={styles.headerBar}>
            <Link href={returnHref as never} asChild>
              <Pressable accessibilityRole="link" accessibilityLabel={backLabel} style={styles.backBtn}>
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
          </View>

          <View style={styles.titleBlock}>
            <View style={styles.sectionLabel}>
              <View style={[styles.pip, { backgroundColor: Accent.base }]} />
              <ThemedText style={[styles.mono, { color: colors.textHint }]}>
                // QUIZ CONFIG · {mode.toUpperCase()}
              </ThemedText>
            </View>
            <ThemedText type="title" style={[styles.title, { color: colors.text }]}>
              ตั้งค่ารอบเรียน
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {MODE_LABELS[mode]} · ค่านี้ใช้กับทุก deck
            </ThemedText>
          </View>

          <ConfigSection title="// COUNT · จำนวนคำ">
            <View style={styles.segmentWrap}>
              {COUNT_OPTIONS.map((option) => (
                <SegmentButton
                  key={String(option.value)}
                  label={option.label}
                  active={safeConfig.count === option.value}
                  colors={colors}
                  onPress={() => setCount(option.value)}
                />
              ))}
            </View>
          </ConfigSection>

          <ConfigSection title="// ORDER · ลำดับรอบนี้">
            <View style={styles.segmentWrap}>
              {ORDER_OPTIONS.map((option) => (
                <SegmentButton
                  key={option.value}
                  label={option.label}
                  active={safeConfig.order === option.value}
                  colors={colors}
                  onPress={() => setOrder(option.value)}
                />
              ))}
            </View>
          </ConfigSection>

          <ConfigSection title="// GOAL · สิ่งที่ต้องจำ">
            <View style={styles.goalStack}>
              {GOAL_OPTIONS.map((option) => (
                <GoalButton
                  key={option.value}
                  label={option.label}
                  active={safeConfig.goal === option.value}
                  colors={colors}
                  onPress={() => setGoal(option.value)}
                />
              ))}
            </View>
          </ConfigSection>

          <ConfigSection title="// HINTS · สิ่งที่ให้ดูเป็นคำใบ้">
            <View style={styles.hintStack}>
              {HINT_OPTIONS.map((option) => (
                <ToggleRow
                  key={option.key}
                  label={option.label}
                  active={safeConfig.hints[option.key]}
                  colors={colors}
                  onPress={() => toggleHint(option.key)}
                />
              ))}
            </View>
          </ConfigSection>
        </ScrollView>

        <View style={[styles.ctaWrap, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <Pressable
            onPress={handleStart}
            accessibilityRole="button"
            accessibilityLabel="บันทึกและเริ่มเรียน"
            style={({ pressed, hovered }: any) => [
              styles.ctaPrimary,
              { backgroundColor: Accent.base, borderColor: Accent.base },
              (pressed || hovered) && { backgroundColor: Accent.strong, borderColor: Accent.strong },
              pressed && { opacity: 0.85 },
            ]}>
            <ThemedText style={styles.ctaText}>บันทึกและเริ่มเรียน</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function ConfigSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.configSection}>
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      {children}
    </View>
  );
}

function SegmentButton({
  label,
  active,
  colors,
  onPress,
}: {
  label: string;
  active: boolean;
  colors: typeof Colors.light;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.segmentBtn,
        {
          borderColor: active ? Accent.soft : colors.border,
          backgroundColor: active ? Accent.bg : colors.background,
        },
        pressed && { opacity: 0.75 },
      ]}>
      <ThemedText
        type="small"
        style={{ color: active ? Accent.base : colors.text, fontWeight: active ? '700' : '500' }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function GoalButton({
  label,
  active,
  colors,
  onPress,
}: {
  label: string;
  active: boolean;
  colors: typeof Colors.light;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.goalBtn,
        {
          borderColor: active ? Accent.soft : colors.border,
          backgroundColor: active ? Accent.bg : colors.background,
        },
        pressed && { opacity: 0.75 },
      ]}>
      <View style={[styles.radio, { borderColor: active ? Accent.base : colors.borderStrong }]}>
        {active ? <View style={[styles.radioDot, { backgroundColor: Accent.base }]} /> : null}
      </View>
      <ThemedText type="defaultSemiBold" style={{ color: active ? Accent.base : colors.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function ToggleRow({
  label,
  active,
  colors,
  onPress,
}: {
  label: string;
  active: boolean;
  colors: typeof Colors.light;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.toggleRow,
        { borderColor: colors.border, backgroundColor: colors.background },
        pressed && { opacity: 0.75 },
      ]}>
      <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>
        {label}
      </ThemedText>
      <View
        style={[
          styles.switchTrack,
          {
            borderColor: active ? Accent.soft : colors.borderStrong,
            backgroundColor: active ? Accent.bg : colors.backgroundSelected,
          },
        ]}>
        <View
          style={[
            styles.switchThumb,
            {
              backgroundColor: active ? Accent.base : colors.textHint,
              transform: [{ translateX: active ? 18 : 0 }],
            },
          ]}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, width: '100%' },
  scroll: {
    flex: 1,
    alignSelf: 'stretch',
    ...(Platform.OS === 'web' ? ({ scrollbarGutter: 'stable' } as object) : null),
  } as any,
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.five,
  },
  headerBar: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.three,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  titleBlock: {
    gap: Spacing.two,
  },
  sectionLabel: {
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
  title: {
    fontSize: 38,
    lineHeight: 43,
  },
  configSection: {
    gap: Spacing.three,
  },
  sectionTitle: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    color: Accent.base,
    fontSize: 10,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  segmentWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  segmentBtn: {
    minHeight: 40,
    minWidth: 72,
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalStack: {
    gap: Spacing.two,
  },
  goalBtn: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  radio: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  hintStack: {
    gap: Spacing.two,
  },
  toggleRow: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  switchTrack: {
    width: 42,
    height: 24,
    borderWidth: 1,
    borderRadius: 999,
    padding: 2,
  },
  switchThumb: {
    width: 18,
    height: 18,
    borderRadius: 999,
  },
  ctaWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
  },
  ctaPrimary: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
});
