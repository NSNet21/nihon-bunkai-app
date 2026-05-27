/**
 * Onboarding screen 02 · LEVEL PICKER
 *
 * Routes: /onboarding/level → /onboarding/pace  (CONTINUE)
 *                          → /onboarding/welcome (BACK)
 *                          → /                  (SKIP, sets onboarded=true)
 *
 * Persist: writes nb.preferred-level on every tile tap.
 * Default: 'N5'. Locked-soft tiles (N2/N1) still selectable but
 * show a chip — Phase 2 may gate them behind purchase.
 */

import { useRouter } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { FiArrowRight, FiChevronLeft, FiInfo, FiLock } from 'react-icons/fi';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingSteps } from '@/components/onboarding/steps';
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
  locked?: boolean;
}[] = [
  { value: 'N5', kanji: '五', label: 'N5', sub: 'JLPT · BEGINNER',  th: 'รู้ฮิรากานะ + คาตาคานะ' },
  { value: 'N4', kanji: '四', label: 'N4', sub: 'JLPT · ELEMENTARY', th: 'ผ่าน N5 · 300+ คันจิ' },
  { value: 'N3', kanji: '三', label: 'N3', sub: 'JLPT · INTERMEDIATE', th: '650+ คันจิ · บทสนทนา' },
  { value: 'N2', kanji: '二', label: 'N2', sub: 'JLPT · UPPER-INT', th: 'ปลดล็อกทีหลังก็ได้', locked: true },
  { value: 'N1', kanji: '一', label: 'N1', sub: 'JLPT · ADVANCED',  th: 'ปลดล็อกทีหลังก็ได้', locked: true },
  { value: 'GLOSSARY', kanji: '辞', label: '辞', sub: 'GLOSSARY · 1,569', th: 'พจนานุกรม · ทุกระดับ' },
];

export default function LevelScreen() {
  const router = useRouter();
  const colors = useThemePalette();
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
            級
          </ThemedText>

          <View style={styles.stepWrap}>
            <OnboardingSteps current={2} />
          </View>

          <View style={styles.heroBlock}>
            <View style={styles.kickerRow}>
              <View style={[styles.pip, { backgroundColor: Accent.base }]} />
              <ThemedText style={[styles.kicker, { color: colors.textMuted }]}>
                // PICK YOUR LEVEL · เลือกระดับ
              </ThemedText>
            </View>
            <ThemedText style={[styles.headline, { color: colors.text }]}>
              เริ่มจาก{'\n'}
              <ThemedText style={[styles.headline, { color: Accent.base }]}>ตรงไหน?</ThemedText>
            </ThemedText>
            <ThemedText style={[styles.heroSub, { color: colors.textMuted }]}>
              ไม่แน่ใจ? เริ่ม N5 ได้เสมอ · เปลี่ยนทีหลังได้
            </ThemedText>
          </View>

          {/* Level grid */}
          <View style={styles.grid}>
            {LEVELS.map((lv) => {
              const active = lv.value === level;
              return (
                <Pressable
                  key={lv.value}
                  onPress={() => setLevel(lv.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`เลือกระดับ ${lv.label}`}
                  style={({ pressed }) => [
                    styles.tile,
                    {
                      borderColor: active ? Accent.base : colors.border,
                      backgroundColor: active ? Accent.bg : colors.surface,
                    },
                    lv.locked && !active && { opacity: 0.65 },
                    pressed && { opacity: 0.85 },
                  ]}>
                  <ThemedText style={[styles.tileKanji, { color: active ? Accent.base : colors.text }]}>
                    {lv.kanji}
                  </ThemedText>
                  <ThemedText style={[styles.tileLabel, { color: active ? Accent.base : colors.text }]}>
                    {lv.label}
                  </ThemedText>
                  <ThemedText style={[styles.tileSub, { color: colors.textHint }]}>{lv.sub}</ThemedText>
                  <View style={styles.tileFooter}>
                    {lv.locked ? (
                      <View style={[styles.lockChip, { borderColor: colors.border }]}>
                        <FiLock size={9} color={colors.textHint} strokeWidth={2} />
                        <ThemedText style={[styles.lockLabel, { color: colors.textHint }]}>
                          ปลดล็อกทีหลัง
                        </ThemedText>
                      </View>
                    ) : (
                      <ThemedText style={[styles.tileTh, { color: colors.textMuted }]}>{lv.th}</ThemedText>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Tip */}
          <View style={[styles.tipBox, { borderLeftColor: Accent.base, backgroundColor: colors.surface2 }]}>
            <FiInfo size={12} color={Accent.base} strokeWidth={2} />
            <ThemedText style={[styles.tipText, { color: colors.textMuted }]}>
              <ThemedText style={[styles.tipLabel, { color: colors.text }]}>TIP · เคล็ดลับ</ThemedText>
              {' · เลือกระดับที่ต่ำกว่า 1 step เพื่อสะสม streak ในช่วงแรก'}
            </ThemedText>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={handleContinue}
            accessibilityRole="button"
            accessibilityLabel="ถัดไป"
            style={({ pressed }) => [
              styles.ctaPrimary,
              { backgroundColor: Accent.base },
              pressed && { opacity: 0.88 },
            ]}>
            <ThemedText style={styles.ctaLabel}>ถัดไป · CONTINUE</ThemedText>
            <FiArrowRight size={16} color="#fff" strokeWidth={2.2} />
          </Pressable>
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
  lockChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderRadius: Radii.sm,
  },
  lockLabel: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 9,
    letterSpacing: 0.6,
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
    paddingBottom: Spacing.four,
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
