/**
 * Quiz Config screen — /deck/[deckId]/config
 *
 * Single filter (Phase 2 S3): how many cards per Quiz session.
 *
 * UI 2026-05-27 round-3: custom Pan-gesture slider locked to 5 discrete
 * tick stops (10 / 20 / 30 / 50 / ทั้งหมด). Original 5-row picker took
 * ~5 vertical screens and read as an option list instead of a continuous
 * "how long should this session be" feeling. Slider = one motion captures
 * the intent + matches the "dial-in" metaphor.
 *
 * Why custom (not @react-native-community/slider): lib install on pnpm +
 * SDK 56 hit a Metro resolution failure ("Unable to resolve ./utils/
 * styles") inside the dist build. Custom Pan + Reanimated gives the same
 * UX, full editorial-brutalism styling control, and zero native module
 * dependency — works identical on iOS/Android/Web.
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
import { useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useThemeColors } from '@/context/theme';
import { usePersistedState } from '@/hooks/use-persisted-state';

type QuizCount = '10' | '20' | '30' | '50' | 'all';

/* Tick stops in slider index order (0 → 4). Hint shown next to active
   label only. GPT polish round-1 picked neutral words over personality
   tags ("รวดเร็ว/มาตรฐาน/จริงจัง/มาราธอน" made the user interpret
   intensity). */
const TICKS: { value: QuizCount; label: string; hint: string }[] = [
  { value: '10',  label: '10',     hint: 'สั้น' },
  { value: '20',  label: '20',     hint: 'ปกติ' },
  { value: '30',  label: '30',     hint: 'ยาว' },
  { value: '50',  label: '50',     hint: 'ยาวมาก' },
  { value: 'all', label: 'ทั้งหมด', hint: 'ทุกใบในชุดนี้' },
];

const MAX_INDEX = TICKS.length - 1; // 4
const THUMB_SIZE = 28;
const TRACK_HEIGHT = 6;

export default function QuizConfigScreen() {
  const { deckId } = useLocalSearchParams<{ deckId?: string }>();
  const { colors } = useThemeColors();
  const router = useRouter();
  const [count, setCount] = usePersistedState<QuizCount>('quiz-count', 'all');
  const [trackWidth, setTrackWidth] = useState(0);

  const currentIdx = Math.max(0, TICKS.findIndex((t) => t.value === count));
  const current = TICKS[currentIdx];

  /* Thumb position shared value drives both the visual position AND the
     fill width. Initialized from persisted index — re-syncs whenever the
     index or track width changes (handled by useAnimatedStyle reading
     the latest values on each frame). */
  const dragX = useSharedValue(0);
  const dragging = useSharedValue(false);

  const stopFromX = (x: number): number => {
    'worklet';
    if (trackWidth <= 0) return currentIdx;
    const step = trackWidth / MAX_INDEX;
    const idx = Math.round(x / step);
    return Math.max(0, Math.min(MAX_INDEX, idx));
  };

  const commitIndex = (idx: number) => {
    const next = TICKS[idx];
    if (next.value !== count) setCount(next.value);
  };

  const pan = Gesture.Pan()
    .onBegin((e) => {
      dragging.value = true;
      dragX.value = Math.max(0, Math.min(trackWidth, e.x));
    })
    .onChange((e) => {
      dragX.value = Math.max(0, Math.min(trackWidth, e.x));
    })
    .onEnd((e) => {
      const idx = stopFromX(Math.max(0, Math.min(trackWidth, e.x)));
      dragging.value = false;
      /* Snap thumb to the committed stop visually */
      const step = trackWidth / MAX_INDEX;
      dragX.value = withSpring(idx * step, { damping: 18, stiffness: 220 });
      scheduleOnRN(commitIndex, idx);
    });

  const thumbStyle = useAnimatedStyle(() => {
    const step = trackWidth > 0 ? trackWidth / MAX_INDEX : 0;
    /* When NOT dragging, snap to the React-state index so external
       changes (tap on tick label) also move the thumb. */
    const x = dragging.value ? dragX.value : currentIdx * step;
    return {
      transform: [
        { translateX: x - THUMB_SIZE / 2 },
        { scale: dragging.value ? withTiming(1.15, { duration: 80 }) : withTiming(1, { duration: 80 }) },
      ],
    };
  });

  const fillStyle = useAnimatedStyle(() => {
    const step = trackWidth > 0 ? trackWidth / MAX_INDEX : 0;
    const x = dragging.value ? dragX.value : currentIdx * step;
    return { width: x };
  });

  const onTrackLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

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

          {/* Active readout — large editorial display anchors the slider thumb */}
          <View style={styles.activeRow}>
            <ThemedText style={[styles.activeLabel, { color: Accent.base }]}>
              {current.label}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.activeHint}>
              {current.hint}
            </ThemedText>
          </View>

          <View style={styles.sliderWrap}>
            <GestureDetector gesture={pan}>
              <View style={styles.trackArea} onLayout={onTrackLayout}>
                {/* Track: full-width inactive rail */}
                <View style={[styles.track, { backgroundColor: colors.border }]} />
                {/* Fill: animated active portion */}
                <Animated.View
                  style={[styles.fill, { backgroundColor: Accent.base }, fillStyle]}
                />
                {/* Tick squares — small editorial markers at each stop. */}
                {TICKS.map((_, i) => {
                  const active = i === currentIdx;
                  const left = trackWidth > 0 ? (i / MAX_INDEX) * trackWidth : 0;
                  return (
                    <View
                      key={i}
                      pointerEvents="none"
                      style={[
                        styles.tickMark,
                        {
                          left: left - 3,
                          backgroundColor: active ? Accent.base : colors.borderStrong,
                        },
                      ]}
                    />
                  );
                })}
                {/* Draggable thumb — sits above ticks */}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.thumb,
                    {
                      backgroundColor: Accent.base,
                      borderColor: colors.background,
                    },
                    thumbStyle,
                  ]}
                />
              </View>
            </GestureDetector>

            {/* Tick label row — tap to jump (slider thumb still draggable). */}
            <View style={styles.tickRow}>
              {TICKS.map((tick, i) => {
                const active = i === currentIdx;
                return (
                  <Pressable
                    key={tick.value}
                    onPress={() => setCount(tick.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`เลือก ${tick.label}`}
                    style={({ pressed }) => [
                      styles.tickLabelBtn,
                      pressed && !active && { opacity: 0.6 },
                    ]}>
                    <ThemedText
                      type={active ? 'defaultSemiBold' : 'small'}
                      style={[
                        styles.tickLabel,
                        { color: active ? Accent.base : colors.textSecondary },
                      ]}>
                      {tick.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <ThemedText type="small" themeColor="textHint" style={styles.helperText}>
            ค่าจะถูกบันทึกไว้ใช้ทุก deck · เปลี่ยนได้ทุกเมื่อ
          </ThemedText>
        </View>

        <View style={styles.ctaRow}>
          {/* CTA copy — "เริ่ม" dropped per GPT polish round 2026-05-27. */}
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
    gap: Spacing.four,
  },
  sectionHead: {
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  /* Active readout — large numeric anchor for the slider thumb. */
  activeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  activeLabel: {
    fontFamily: Platform.select({ web: '"Oswald", sans-serif', default: undefined }),
    fontSize: 56,
    lineHeight: 60,
    fontWeight: '700',
    letterSpacing: -1,
  },
  activeHint: {
    letterSpacing: 0.5,
  },

  /* Slider rail + tick labels. */
  sliderWrap: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  trackArea: {
    height: THUMB_SIZE + 12,
    justifyContent: 'center',
    /* Web-only: range-style cursor over the track for affordance. */
    ...(Platform.OS === 'web' ? ({ cursor: 'grab' } as any) : null),
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    width: '100%',
  },
  fill: {
    position: 'absolute',
    left: 0,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
  },
  tickMark: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 1,
    top: '50%',
    marginTop: -3,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    top: '50%',
    marginTop: -THUMB_SIZE / 2,
    borderWidth: 3,
  },
  tickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
  tickLabelBtn: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
  },
  tickLabel: {
    fontSize: 13,
    textAlign: 'center',
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
