/**
 * Onboarding screen 01 · WELCOME
 *
 * Routes: /onboarding/welcome → /onboarding/level (CONTINUE)
 *                            → /          (SKIP, sets nb.onboarded=true)
 *                            → /login     (SIGN IN link)
 *
 * Persist: only SKIP writes here. CONTINUE just navigates forward.
 */

import { useRouter } from 'expo-router';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { FiArrowRight } from 'react-icons/fi';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingSteps } from '@/components/onboarding/steps';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useThemePalette } from '@/context/theme';
import { usePersistedState } from '@/hooks/use-persisted-state';

const BULLETS = [
  {
    num: '01',
    title: 'BROWSE FIRST',
    jp: 'まず一覧を見る',
    th: 'เปิดคลังคำศัพท์ก่อน แล้วค่อยเลือก deck ที่อยากเรียน',
  },
  {
    num: '02',
    title: 'TERM PREVIEW',
    jp: '語を確認する',
    th: 'ดูคำ ความหมาย คำอ่าน และรายละเอียดก่อนเริ่มโหมดเรียน',
  },
  {
    num: '03',
    title: 'LEARN WHEN READY',
    jp: '準備してから学ぶ',
    th: 'พร้อมแล้วค่อยเข้า Quiz Card, Multiple Choice หรือ Dictation',
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const colors = useThemePalette();
  const insets = useSafeAreaInsets();
  const [, setOnboarded] = usePersistedState<boolean>('onboarded', false);

  function handleContinue() {
    router.push('/onboarding/level');
  }

  function handleSkip() {
    setOnboarded(true);
    router.replace('/');
  }

  function handleSignIn() {
    setOnboarded(true);
    router.replace('/login');
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.topBar}>
          <View style={styles.brandLeft}>
            <View style={[styles.brandBadge, { borderColor: colors.borderStrong }]}>
              <ThemedText style={styles.brandBadgeLabel}>NB</ThemedText>
            </View>
            <View>
              <ThemedText style={[styles.brandJp, { color: colors.text }]}>日本分解</ThemedText>
              <ThemedText style={[styles.brandRomaji, { color: colors.textMuted }]}>NIHON BUNKAI</ThemedText>
            </View>
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
          {/* Ghost kanji — huge faded backdrop */}
          <ThemedText style={[styles.ghostKanji, { color: colors.textHint }]}>
            始
          </ThemedText>

          <View style={styles.stepWrap}>
            <OnboardingSteps current={1} />
          </View>

          {/* Hero */}
          <View style={styles.heroBlock}>
            <View style={styles.kickerRow}>
              <View style={[styles.pip, { backgroundColor: Accent.base }]} />
              <ThemedText style={[styles.kicker, { color: colors.textMuted }]}>
                // ORIENTATION · เริ่มใช้งาน
              </ThemedText>
            </View>
            <ThemedText style={[styles.headline, { color: colors.text }]}>
              เปิดคลัง{'\n'}
              <ThemedText style={[styles.headline, { color: Accent.base }]}>แล้วเริ่มเรียน.</ThemedText>
            </ThemedText>
            <ThemedText style={[styles.heroSub, { color: colors.textMuted }]}>
              Nihon Bunkai เริ่มจาก Browse: เลือก deck, เปิดดูคำ, แล้วค่อยเข้าโหมดเรียนที่เหมาะกับจังหวะของคุณ
            </ThemedText>
          </View>

          {/* Bullets */}
          <View style={styles.bullets}>
            {BULLETS.map((b) => (
              <View key={b.num} style={[styles.bullet, { borderColor: colors.border }]}>
                <ThemedText style={[styles.bulletNum, { color: Accent.base }]}>{b.num}</ThemedText>
                <View style={styles.bulletBody}>
                  <ThemedText style={[styles.bulletTitle, { color: colors.text }]}>{b.title}</ThemedText>
                  {/* JP subtitle opacity reduced per GPT round-3 — was
                      competing with TH description hierarchy. */}
                  <ThemedText style={[styles.bulletJp, { color: colors.textHint }]}>{b.jp}</ThemedText>
                  <ThemedText style={[styles.bulletTh, { color: colors.textMuted }]}>{b.th}</ThemedText>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Footer CTA */}
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
            accessibilityLabel="เริ่มต้น"
            style={[styles.ctaPrimary, { backgroundColor: Accent.base }]}>
            <ThemedText style={styles.ctaLabel}>เลือกจุดเริ่มต้น</ThemedText>
            <FiArrowRight size={16} color="#fff" strokeWidth={2.2} />
          </PressableScale>
          <PressableScale
            onPress={handleSignIn}
            accessibilityRole="link"
            accessibilityLabel="เข้าสู่ระบบ"
            style={styles.signInLink}>
            <ThemedText style={[styles.signInLabel, { color: colors.textHint }]}>
              มีบัญชีอยู่แล้ว?{' '}
              <ThemedText
                style={[
                  styles.signInAccent,
                  {
                    color: colors.textMuted,
                    textDecorationLine: 'underline',
                    textDecorationColor: colors.textHint,
                  } as any,
                ]}>
                เข้าสู่ระบบ
              </ThemedText>
            </ThemedText>
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
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  brandBadge: {
    width: 28,
    height: 28,
    borderRadius: Radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandBadgeLabel: {
    fontFamily: Platform.select({ web: '"Oswald", sans-serif', default: undefined }),
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  brandJp: {
    fontFamily: Platform.select({ web: '"Noto Serif JP", serif', default: undefined }),
    fontSize: 13,
    lineHeight: 16,
  },
  brandRomaji: {
    fontFamily: Platform.select({ web: '"Oswald", sans-serif', default: undefined }),
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1.3,
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
    top: '20%',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: Platform.select({ web: '"Noto Serif JP", serif', default: undefined }),
    fontSize: 280,
    lineHeight: 280,
    opacity: 0.04,
    zIndex: 0,
    pointerEvents: 'none',
  } as any,

  stepWrap: { zIndex: 1 },

  heroBlock: { gap: Spacing.three, zIndex: 1 },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  pip: {
    width: 6,
    height: 6,
    borderRadius: 1,
  },
  kicker: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  headline: {
    fontFamily: Platform.select({ web: '"Oswald", sans-serif', default: undefined }),
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '700',
    letterSpacing: -1,
  },
  heroSub: {
    fontSize: 13,
    lineHeight: 22,
    maxWidth: 460,
  },

  bullets: { gap: Spacing.two, zIndex: 1 },
  bullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radii.sm,
    borderWidth: 1,
  },
  bulletNum: {
    fontFamily: Platform.select({ web: '"Oswald", sans-serif', default: undefined }),
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0,
    minWidth: 28,
  },
  bulletBody: { flex: 1, gap: 2 },
  bulletTitle: {
    fontFamily: Platform.select({ web: '"Oswald", sans-serif', default: undefined }),
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  bulletJp: {
    fontFamily: Platform.select({ web: '"Noto Serif JP", serif', default: undefined }),
    fontSize: 12,
  },
  bulletTh: {
    fontSize: 12,
    lineHeight: 18,
  },

  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    /* paddingBottom set inline (safe-area-aware) per round-3 verdict. */
    gap: Spacing.two,
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
  signInLink: {
    alignItems: 'center',
    paddingVertical: Spacing.one,
    marginTop: Spacing.two,
  },
  signInLabel: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'lowercase',
    opacity: 0.85,
  },
  signInAccent: {
    fontWeight: '600',
  },
});
