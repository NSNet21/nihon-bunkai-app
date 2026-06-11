/**
 * Onboarding screen 02 · LEVEL PICKER
 *
 * Routes: /onboarding/level → /onboarding/pace  (CONTINUE)
 *                          → /onboarding/welcome (BACK)
 *                          → /                  (SKIP, sets onboarded=true)
 *
 * Persist: writes nb.preferred-level on every tile tap.
 * Default: 'N5'. This is only a Browse starting preference, not an
 * ownership or purchase decision.
 */

import { useRouter } from 'expo-router';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { FiArrowRight, FiChevronLeft, FiInfo } from 'react-icons/fi';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingSteps } from '@/components/onboarding/steps';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useThemePalette } from '@/context/theme';
import { usePersistedState } from '@/hooks/use-persisted-state';

type Level = 'N5' | 'N4' | 'N3' | 'N2' | 'N1' | 'GLOSSARY';

const LEVELS: {
  value: Level;
  kanji: string;
  label: string;
  sub: string;
  th: string;
}[] = [
  { value: 'N5', kanji: '五', label: 'N5', sub: 'เริ่มพื้นฐาน', th: 'เหมาะถ้าอยากเริ่มจาก N5 Starter' },
  { value: 'N4', kanji: '四', label: 'N4', sub: 'ต่อจากพื้นฐาน', th: 'เหมาะถ้าเคยผ่าน N5 มาแล้ว' },
  { value: 'N3', kanji: '三', label: 'N3', sub: 'อ่าน/ฟังมากขึ้น', th: 'เหมาะถ้าอยากไล่คำและไวยากรณ์กลางทาง' },
  { value: 'N2', kanji: '二', label: 'N2', sub: 'เตรียมสอบจริงจัง', th: 'เลือกไว้เป็นจุดอ้างอิงได้ แม้ยังไม่ปลดล็อกทุก deck' },
  { value: 'N1', kanji: '一', label: 'N1', sub: 'ขั้นสูง', th: 'เลือกไว้เป็นจุดอ้างอิงได้ แม้ยังไม่ปลดล็อกทุก deck' },
  { value: 'GLOSSARY', kanji: '辞', label: '辞', sub: 'ศัพท์ไวยากรณ์', th: 'เหมาะถ้าอยากเปิดดูคำอธิบายประกอบทุกระดับ' },
];

export default function LevelScreen() {
  const router = useRouter();
  const colors = useThemePalette();
  const insets = useSafeAreaInsets();
  const [level, setLevel] = usePersistedState<Level>('preferred-level', 'N5');
  const [, setOnboarded] = usePersistedState<boolean>('onboarded', false);

  function handleContinue() {
    router.push('/onboarding/pace');
  }

  function handleBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/onboarding/welcome');
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
            <PressableScale
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel="ย้อนกลับ"
              style={[styles.backBtn, { borderColor: colors.border }]}>
              <FiChevronLeft size={16} color={colors.text} strokeWidth={2} />
            </PressableScale>
            <ThemedText style={[styles.navTitle, { color: colors.text }]}>
              日本<ThemedText style={{ color: Accent.base }}>分解</ThemedText>
            </ThemedText>
          </View>
          <PressableScale
            onPress={handleSkip}
            accessibilityRole="button"
            accessibilityLabel="ข้าม onboarding"
            style={[styles.skipBtn, { borderColor: colors.border }]}>
            <ThemedText style={[styles.skipLabel, { color: colors.textMuted }]}>SKIP</ThemedText>
          </PressableScale>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <ThemedText style={[styles.ghostKanji, { color: colors.textHint }]}>
            級
          </ThemedText>

          <View style={styles.stepWrap}>
            <OnboardingSteps current={2} />
          </View>

          <View style={styles.heroBlock}>
            <View style={styles.kickerRow}>
              <View style={[styles.pip, { backgroundColor: Accent.base }]} />
              <ThemedText style={[styles.kicker, { color: colors.textMuted }]}>
                // START POINT · จุดเริ่มในคลัง
              </ThemedText>
            </View>
            <ThemedText style={[styles.headline, { color: colors.text }]}>
              เลือก{'\n'}
              <ThemedText style={[styles.headline, { color: Accent.base }]}>จุดเริ่มต้น.</ThemedText>
            </ThemedText>
            <ThemedText style={[styles.heroSub, { color: colors.textMuted }]}>
              ใช้เพื่อจัดทางเข้า Browse เท่านั้น เปลี่ยนทีหลังได้ ไม่ผูกกับการซื้อหรือสิทธิ์ปลดล็อก
            </ThemedText>
          </View>

          {/* Level grid. N2/N1 locked tiles are non-tappable per GPT round-3
              verdict — semantic conflict if visually "locked" but persists
              preference. Inline help row below the grid surfaces the
              purchase requirement without a heavy modal. */}
          <View style={styles.grid}>
            {LEVELS.map((lv) => {
              const active = lv.value === level;
              return (
                <PressableScale
                  key={lv.value}
                  onPress={() => setLevel(lv.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`เลือกจุดเริ่มต้น ${lv.label}`}
                  style={[
                    styles.tile,
                    {
                      borderColor: active ? Accent.base : colors.border,
                      /* Round-5 P0 — GPT verdict "SELECTED chip ดูดตา
                         แรงมาก · less crimson fill · more outline feel".
                         Dropped the Accent.bg tint on active tile; the
                         crimson border + crimson kanji/label still signal
                         selection without the stacked fill weight. */
                      backgroundColor: colors.surface,
                    },
                  ]}>
                  {active && (
                    <ThemedText style={[styles.stateLabel, { color: Accent.base }]}>
                      SELECTED
                    </ThemedText>
                  )}
                  <ThemedText style={[styles.tileKanji, { color: active ? Accent.base : colors.text }]}>
                    {lv.kanji}
                  </ThemedText>
                  <ThemedText style={[styles.tileLabel, { color: active ? Accent.base : colors.text }]}>
                    {lv.label}
                  </ThemedText>
                  <ThemedText style={[styles.tileSub, { color: colors.textHint }]}>{lv.sub}</ThemedText>
                  <View style={styles.tileFooter}>
                    <ThemedText style={[styles.tileTh, { color: colors.textMuted }]}>{lv.th}</ThemedText>
                  </View>
                </PressableScale>
              );
            })}
          </View>

          {/* Tip */}
          <View style={[styles.tipBox, { borderLeftColor: Accent.base, backgroundColor: colors.surface2 }]}>
            <FiInfo size={12} color={Accent.base} strokeWidth={2} />
            <ThemedText style={[styles.tipText, { color: colors.textMuted }]}>
              <ThemedText style={[styles.tipLabel, { color: colors.text }]}>คำแนะนำ</ThemedText>
              {' · ถ้าไม่แน่ใจ ให้เริ่ม N5 ก่อน เพราะ Browse ยังเปิดไปดูระดับอื่นได้ตลอด'}
            </ThemedText>
          </View>
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, Spacing.four),
            },
          ]}>
          <PressableScale
            onPress={handleContinue}
            accessibilityRole="button"
            accessibilityLabel="ถัดไป"
            style={[styles.ctaPrimary, { backgroundColor: Accent.base }]}>
            <ThemedText style={styles.ctaLabel}>ถัดไป</ThemedText>
            <FiArrowRight size={16} color="#fff" strokeWidth={2.2} />
          </PressableScale>
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
    fontSize: 240,
    lineHeight: 240,
    opacity: 0.04,
    zIndex: 0,
    pointerEvents: 'none',
  } as any,

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

  /* 2-col grid via flex wrap. RN doesn't have CSS grid; gap + flex-basis
     approximates it cleanly. */
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
    gap: 4,
  },
  tileKanji: {
    fontFamily: Platform.select({ web: '"Noto Serif JP", serif', default: undefined }),
    fontSize: 32,
    lineHeight: 36,
  },
  tileLabel: {
    fontFamily: Platform.select({ web: '"Oswald", sans-serif', default: undefined }),
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tileSub: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tileFooter: { marginTop: 2 },
  tileTh: { fontSize: 11, lineHeight: 16 },
  /* Mono micro-state label per GPT round-3 verdict P1 — same treatment
     across SELECTED · RECOMMENDED · FREE · OWNED · LOCKED. */
  stateLabel: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 9,
    letterSpacing: 1.2,
    fontWeight: '600',
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderLeftWidth: 2,
    zIndex: 1,
  },
  tipText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 18,
  },
  tipLabel: {
    fontFamily: Platform.select({ web: '"Oswald", sans-serif', default: undefined }),
    fontWeight: '700',
    letterSpacing: 0.6,
  },

  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    /* paddingBottom set inline (safe-area-aware) per round-3 verdict. */
    borderTopWidth: StyleSheet.hairlineWidth,
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
});
