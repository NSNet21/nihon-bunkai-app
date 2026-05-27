/**
 * Onboarding screen 03 · DAILY PACE
 *
 * Routes: /onboarding/pace → /            (BEGIN, sets nb.onboarded=true)
 *                         → /onboarding/level (BACK)
 *                         → /            (SKIP, sets onboarded=true)
 *
 * Persist:
 *  - nb.daily-goal: 10 | 20 | 30 | 50 (default 20)
 *  - nb.reminder-time: 'HH:MM' (default '20:00')
 *  - nb.reminder-enabled: boolean (default true)
 *
 * Reminder is UI-only at this stage (no actual notification scheduling).
 * Settings will surface the same keys for later edits.
 */

import { useRouter } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { FiChevronLeft, FiPlay } from 'react-icons/fi';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingSteps } from '@/components/onboarding/steps';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useThemePalette } from '@/context/theme';
import { usePersistedState } from '@/hooks/use-persisted-state';

type Goal = 10 | 20 | 30 | 50;

const GOALS: { value: Goal; mins: string; desc: string; recommended?: boolean }[] = [
  { value: 10, mins: '≈ 5 นาที',  desc: 'เริ่มต้นเบาๆ' },
  { value: 20, mins: '≈ 10 นาที', desc: 'จังหวะมาตรฐาน', recommended: true },
  { value: 30, mins: '≈ 15 นาที', desc: 'จริงจัง' },
  { value: 50, mins: '≈ 25 นาที', desc: 'เร่งสอบ' },
];

const REMINDER_TIMES = ['08:00', '12:00', '18:00', '20:00', '22:00'] as const;

export default function PaceScreen() {
  const router = useRouter();
  const colors = useThemePalette();
  const [goal, setGoal] = usePersistedState<Goal>('daily-goal', 20);
  const [reminderTime, setReminderTime] = usePersistedState<string>('reminder-time', '20:00');
  const [reminderEnabled, setReminderEnabled] = usePersistedState<boolean>('reminder-enabled', true);
  const [, setOnboarded] = usePersistedState<boolean>('onboarded', false);

  function handleBegin() {
    setOnboarded(true);
    router.replace('/');
  }

  function handleBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/onboarding/level');
  }

  function handleSkip() {
    setOnboarded(true);
    router.replace('/');
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.topBar}>
          <View style={styles.leftCluster}>
            <Pressable
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel="ย้อนกลับ"
              style={({ pressed }) => [
                styles.backBtn,
                { borderColor: colors.border },
                pressed && { opacity: 0.7 },
              ]}>
              <FiChevronLeft size={16} color={colors.text} strokeWidth={2} />
            </Pressable>
            <ThemedText style={[styles.navTitle, { color: colors.text }]}>
              START<ThemedText style={{ color: Accent.base }}>UP</ThemedText>
            </ThemedText>
          </View>
          <Pressable
            onPress={handleSkip}
            accessibilityRole="button"
            accessibilityLabel="ข้าม onboarding"
            style={({ pressed }) => [
              styles.skipBtn,
              { borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}>
            <ThemedText style={[styles.skipLabel, { color: colors.textMuted }]}>SKIP</ThemedText>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <ThemedText
            style={[styles.ghostKanji, { color: colors.textHint }]}
            pointerEvents="none">
            日
          </ThemedText>

          <View style={styles.stepWrap}>
            <OnboardingSteps current={3} />
          </View>

          <View style={styles.heroBlock}>
            <View style={styles.kickerRow}>
              <View style={[styles.pip, { backgroundColor: Accent.base }]} />
              <ThemedText style={[styles.kicker, { color: colors.textMuted }]}>
                // DAILY PACE · จังหวะรายวัน
              </ThemedText>
            </View>
            <ThemedText style={[styles.headline, { color: colors.text }]}>
              วันละ{'\n'}
              <ThemedText style={[styles.headline, { color: Accent.base }]}>เท่าไหร่?</ThemedText>
            </ThemedText>
            <ThemedText style={[styles.heroSub, { color: colors.textMuted }]}>
              เลือกเป้าหมายที่ทำได้สม่ำเสมอ · ไม่ต้องเยอะ · streak สำคัญกว่าจำนวน
            </ThemedText>
          </View>

          {/* Goal grid */}
          <View style={styles.grid}>
            {GOALS.map((g) => {
              const active = g.value === goal;
              return (
                <Pressable
                  key={g.value}
                  onPress={() => setGoal(g.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`เลือกเป้า ${g.value} ใบต่อวัน`}
                  style={({ pressed }) => [
                    styles.tile,
                    {
                      borderColor: active ? Accent.base : colors.border,
                      backgroundColor: active ? Accent.bg : colors.surface,
                    },
                    pressed && { opacity: 0.85 },
                  ]}>
                  {g.recommended && (
                    <View style={[styles.recBadge, { backgroundColor: Accent.base }]}>
                      <ThemedText style={styles.recBadgeText}>RECOMMENDED</ThemedText>
                    </View>
                  )}
                  <ThemedText style={[styles.tileNum, { color: active ? Accent.base : colors.text }]}>
                    {g.value}
                  </ThemedText>
                  <ThemedText style={[styles.tileUnit, { color: colors.textHint }]}>CARDS / DAY</ThemedText>
                  <ThemedText style={[styles.tileDesc, { color: colors.textMuted }]}>
                    {g.mins} · {g.desc}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {/* Reminder */}
          <View style={styles.section}>
            <View style={styles.kickerRow}>
              <View style={[styles.pip, { backgroundColor: Accent.base }]} />
              <ThemedText style={[styles.kicker, { color: colors.textMuted }]}>
                REMINDER · เตือนทุกวัน
              </ThemedText>
            </View>
            <View style={[styles.reminderCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <View style={{ flex: 1, gap: 4 }}>
                <ThemedText style={[styles.reminderLabel, { color: colors.textHint }]}>REMIND ME AT</ThemedText>
                <ThemedText style={[styles.reminderClock, { color: Accent.base }]}>{reminderTime}</ThemedText>
                <ThemedText style={[styles.reminderDesc, { color: colors.textMuted }]}>
                  {reminderEnabled ? 'เตือนทุกวัน · ปิดได้ใน Settings' : 'ปิดอยู่ · แตะเพื่อเปิด'}
                </ThemedText>
              </View>
              <Pressable
                onPress={() => setReminderEnabled(!reminderEnabled)}
                accessibilityRole="switch"
                accessibilityState={{ checked: reminderEnabled }}
                accessibilityLabel="เปิด/ปิดการแจ้งเตือน"
                style={[
                  styles.toggleTrack,
                  {
                    backgroundColor: reminderEnabled ? Accent.base : colors.border,
                  },
                ]}>
                <View
                  style={[
                    styles.toggleThumb,
                    {
                      backgroundColor: '#fff',
                      transform: [{ translateX: reminderEnabled ? 22 : 2 }],
                    },
                  ]}
                />
              </Pressable>
            </View>

            {/* Time pills */}
            <View style={styles.timeRow}>
              {REMINDER_TIMES.map((t) => {
                const active = t === reminderTime;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setReminderTime(t)}
                    disabled={!reminderEnabled}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`เลือกเวลา ${t}`}
                    style={({ pressed }) => [
                      styles.timePill,
                      {
                        borderColor: active ? Accent.base : colors.border,
                        backgroundColor: active ? Accent.bg : 'transparent',
                      },
                      !reminderEnabled && { opacity: 0.4 },
                      pressed && reminderEnabled && { opacity: 0.85 },
                    ]}>
                    <ThemedText
                      style={[
                        styles.timeLabel,
                        { color: active ? Accent.base : colors.textMuted },
                      ]}>
                      {t}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={handleBegin}
            accessibilityRole="button"
            accessibilityLabel="เริ่มเรียน"
            style={({ pressed }) => [
              styles.ctaPrimary,
              { backgroundColor: Accent.base },
              pressed && { opacity: 0.88 },
            ]}>
            <FiPlay size={14} color="#fff" strokeWidth={2.2} />
            <ThemedText style={styles.ctaLabel}>เริ่มเรียน · BEGIN</ThemedText>
          </Pressable>
          <ThemedText style={[styles.footerHint, { color: colors.textHint }]}>
            เปลี่ยนค่าได้ใน SETTINGS ภายหลัง
          </ThemedText>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  leftCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  backBtn: {
    width: 28,
    height: 28,
    borderRadius: Radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontFamily: Platform.select({ web: '"Oswald", sans-serif', default: undefined }),
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  skipBtn: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Radii.sm,
    borderWidth: 1,
  },
  skipLabel: {
    fontFamily: Platform.select({ web: '"Oswald", sans-serif', default: undefined }),
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },

  ghostKanji: {
    position: 'absolute',
    top: '25%',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: Platform.select({ web: '"Noto Serif JP", serif', default: undefined }),
    fontSize: 260,
    lineHeight: 260,
    opacity: 0.04,
    zIndex: 0,
  },

  stepWrap: { zIndex: 1 },

  heroBlock: { gap: Spacing.two, zIndex: 1 },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  pip: { width: 6, height: 6, borderRadius: 1 },
  kicker: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  headline: {
    fontFamily: Platform.select({ web: '"Oswald", sans-serif', default: undefined }),
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  heroSub: { fontSize: 12, lineHeight: 18 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    zIndex: 1,
  },
  tile: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 140,
    padding: Spacing.three,
    borderRadius: Radii.sm,
    borderWidth: 1,
    gap: 2,
    position: 'relative',
  },
  recBadge: {
    position: 'absolute',
    top: -8,
    right: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: Radii.sm,
  },
  recBadgeText: {
    color: '#fff',
    fontFamily: Platform.select({ web: '"Oswald", sans-serif', default: undefined }),
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  tileNum: {
    fontFamily: Platform.select({ web: '"Oswald", sans-serif', default: undefined }),
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  tileUnit: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  tileDesc: { fontSize: 11, lineHeight: 16, marginTop: 4 },

  section: { gap: Spacing.two, zIndex: 1 },
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radii.sm,
    borderWidth: 1,
  },
  reminderLabel: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  reminderClock: {
    fontFamily: Platform.select({ web: '"Oswald", sans-serif', default: undefined }),
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  reminderDesc: { fontSize: 11, lineHeight: 16 },

  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ transitionProperty: 'background-color', transitionDuration: '160ms' } as object) : null),
  } as any,
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    ...(Platform.OS === 'web' ? ({ transitionProperty: 'transform', transitionDuration: '160ms' } as object) : null),
  } as any,

  timeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  timePill: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.two,
    borderRadius: Radii.sm,
    borderWidth: 1,
  },
  timeLabel: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 12,
    letterSpacing: 0.5,
  },

  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    gap: Spacing.two,
  },
  ctaPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.five,
    borderRadius: Radii.md,
  },
  ctaLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  footerHint: {
    textAlign: 'center',
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
