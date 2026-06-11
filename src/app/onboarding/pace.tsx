/**
 * Onboarding screen 03 · READY TO BROWSE
 *
 * Routes: /onboarding/pace → /            (BEGIN, sets nb.onboarded=true)
 *                         → /onboarding/level (BACK)
 *                         → /            (SKIP, sets onboarded=true)
 *
 * Persist:
 *  - Reads nb.preferred-level to echo the user's Browse start point.
 *  - Writes nb.onboarded=true only when the user enters or skips.
 */

import { useRouter } from 'expo-router';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { FiBookOpen, FiChevronLeft, FiEye, FiLayers, FiPlay } from 'react-icons/fi';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingSteps } from '@/components/onboarding/steps';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useThemePalette } from '@/context/theme';
import { usePersistedState } from '@/hooks/use-persisted-state';

type Level = 'N5' | 'N4' | 'N3' | 'N2' | 'N1' | 'GLOSSARY';

const FLOW = [
  {
    icon: FiBookOpen,
    title: 'Browse',
    th: 'เริ่มจากคลังคำศัพท์ เลือก level / group / deck ที่อยากดู',
  },
  {
    icon: FiEye,
    title: 'Term Preview',
    th: 'เปิดดูคำเดี่ยวก่อนเรียน เพื่อเช็ก T / D / P / E ให้เข้าใจ',
  },
  {
    icon: FiLayers,
    title: 'Learn',
    th: 'พร้อมแล้วค่อยเลือก Quiz Card, Multiple Choice หรือ Dictation',
  },
];

function formatLevel(level: Level) {
  return level === 'GLOSSARY' ? 'Glossary' : level;
}

export default function PaceScreen() {
  const router = useRouter();
  const colors = useThemePalette();
  const insets = useSafeAreaInsets();
  const [level] = usePersistedState<Level>('preferred-level', 'N5');
  const [, setOnboarded] = usePersistedState<boolean>('onboarded', false);

  function enterBrowse() {
    setOnboarded(true);
    router.replace('/');
  }

  function handleBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/onboarding/level');
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
            onPress={enterBrowse}
            accessibilityRole="button"
            accessibilityLabel="ข้าม onboarding"
            style={[styles.skipBtn, { borderColor: colors.border }]}>
            <ThemedText style={[styles.skipLabel, { color: colors.textMuted }]}>ข้าม</ThemedText>
          </PressableScale>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <ThemedText style={[styles.ghostKanji, { color: colors.textHint }]}>
            開
          </ThemedText>

          <View style={styles.stepWrap}>
            <OnboardingSteps current={3} />
          </View>

          <View style={styles.heroBlock}>
            <View style={styles.kickerRow}>
              <View style={[styles.pip, { backgroundColor: Accent.base }]} />
              <ThemedText style={[styles.kicker, { color: colors.textMuted }]}>
                // READY · เข้า Browse
              </ThemedText>
            </View>
            <ThemedText style={[styles.headline, { color: colors.text }]}>
              พร้อมเปิดคลัง{'\n'}
              <ThemedText style={[styles.headline, { color: Accent.base }]}>คำศัพท์.</ThemedText>
            </ThemedText>
            <ThemedText style={[styles.heroSub, { color: colors.textMuted }]}>
              จะเริ่มจาก {formatLevel(level)} ก่อนก็ได้ หรือเปิด Browse แล้วไล่ดูทุก deck ที่พร้อมเรียน
            </ThemedText>
          </View>

          <View style={styles.flowList}>
            {FLOW.map((item, index) => {
              const Icon = item.icon;
              return (
                <View key={item.title} style={[styles.flowRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                  <View style={styles.flowIndex}>
                    <ThemedText style={[styles.flowIndexText, { color: Accent.base }]}>
                      {String(index + 1).padStart(2, '0')}
                    </ThemedText>
                  </View>
                  <Icon size={17} color={Accent.base} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <ThemedText style={[styles.flowTitle, { color: colors.text }]}>{item.title}</ThemedText>
                    <ThemedText style={[styles.flowText, { color: colors.textMuted }]}>{item.th}</ThemedText>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={[styles.noteBox, { borderLeftColor: Accent.base, backgroundColor: colors.surface2 }]}>
            <ThemedText style={[styles.noteText, { color: colors.textMuted }]}>
              <ThemedText style={[styles.noteLabel, { color: colors.text }]}>ไม่ต้องตั้งค่าเยอะตอนนี้</ThemedText>
              {' · เข้า app ก่อน แล้วค่อยปรับการ์ด ธีม และ backup ใน Settings เมื่อจำเป็น'}
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
            onPress={enterBrowse}
            accessibilityRole="button"
            accessibilityLabel="เข้าคลังคำศัพท์"
            style={[styles.ctaPrimary, { backgroundColor: Accent.base }]}>
            <FiPlay size={14} color="#fff" strokeWidth={2.2} />
            <ThemedText style={styles.ctaLabel}>เข้าคลังคำศัพท์</ThemedText>
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
    fontFamily: Platform.select({ web: '"Noto Serif JP", serif', default: undefined }),
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  skipBtn: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Radii.sm,
    borderWidth: 1,
  },
  skipLabel: {
    fontSize: 11,
    fontWeight: '600',
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
    top: '24%',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: Platform.select({ web: '"Noto Serif JP", serif', default: undefined }),
    fontSize: 260,
    lineHeight: 260,
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

  flowList: { gap: Spacing.two, zIndex: 1 },
  flowRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radii.sm,
    padding: Spacing.three,
  },
  flowIndex: { minWidth: 26 },
  flowIndexText: {
    fontFamily: Platform.select({ web: '"Oswald", sans-serif', default: undefined }),
    fontSize: 18,
    fontWeight: '700',
  },
  flowTitle: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  flowText: { fontSize: 12, lineHeight: 18 },
  noteBox: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderLeftWidth: 2,
    zIndex: 1,
  },
  noteText: {
    fontSize: 11,
    lineHeight: 18,
  },
  noteLabel: {
    fontWeight: '700',
  },

  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
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
    letterSpacing: 0.4,
  },
});
