import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { FiChevronLeft, FiEdit3, FiLayers, FiPenTool, FiSettings } from 'react-icons/fi';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { RouteLoadingIndicator } from '@/components/route-loading-indicator';
import { Accent, Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useThemePalette } from '@/context/theme';
import { freeDeckParams } from '@/data/static-params';
import { useDeckRouteDeck } from '@/hooks/use-deck-route-deck';
import { usePersistedState } from '@/hooks/use-persisted-state';
import {
  DEFAULT_STUDY_MODE_CONFIGS,
  sanitizeStudyModeConfig,
  studyModeConfigKey,
  type StudyMode,
  type StudyModeConfig,
} from '@/lib/study-mode-config';

export function generateStaticParams() {
  return freeDeckParams();
}

const MODES = [
  {
    mode: 'flashcard',
    title: 'แฟลชการ์ด',
    body: 'ทบทวนทีละใบ พร้อมให้คะแนนความจำ',
    href: 'quiz',
    icon: FiLayers,
  },
  {
    mode: 'multiple-choice',
    title: 'ปรนัย',
    body: 'เลือกคำตอบที่ถูกจากตัวเลือก',
    href: 'multiple-choice',
    icon: FiEdit3,
  },
  {
    mode: 'dictation',
    title: 'เขียนตอบ',
    body: 'พิมพ์คำตอบให้ตรงกับสิ่งที่ต้องจำ',
    href: 'dictation',
    icon: FiPenTool,
  },
] as const;

export default function StudyModePickerScreen() {
  const { deckId } = useLocalSearchParams<{ deckId?: string }>();
  const router = useRouter();
  const colors = useThemePalette();
  const { deck, routeState: deckRouteState } = useDeckRouteDeck(deckId);

  const [flashcardConfig] = usePersistedState<StudyModeConfig>(
    studyModeConfigKey('flashcard'),
    DEFAULT_STUDY_MODE_CONFIGS.flashcard,
  );
  const [multipleChoiceConfig] = usePersistedState<StudyModeConfig>(
    studyModeConfigKey('multiple-choice'),
    DEFAULT_STUDY_MODE_CONFIGS['multiple-choice'],
  );
  const [dictationConfig] = usePersistedState<StudyModeConfig>(
    studyModeConfigKey('dictation'),
    DEFAULT_STUDY_MODE_CONFIGS.dictation,
  );

  const configByMode = {
    flashcard: sanitizeStudyModeConfig(flashcardConfig, 'flashcard'),
    'multiple-choice': sanitizeStudyModeConfig(multipleChoiceConfig, 'multiple-choice'),
    dictation: sanitizeStudyModeConfig(dictationConfig, 'dictation'),
  } satisfies Record<StudyMode, StudyModeConfig>;

  function startMode(mode: StudyMode, href: string) {
    if (!deckId) return;
    const config = configByMode[mode];
    if (config.configured) {
      router.push(`/deck/${deckId}/${href}` as never);
      return;
    }
    router.push(`/deck/${deckId}/config?mode=${mode}&next=${href}` as never);
  }

  function configureMode(mode: StudyMode, href: string) {
    if (!deckId) return;
    router.push(`/deck/${deckId}/config?mode=${mode}&next=${href}` as never);
  }

  if (!deck) {
    const isLoading = deckRouteState === 'loading';
    if (isLoading) {
      return (
        <ThemedView style={styles.container}>
          <SafeAreaView style={styles.safeArea} edges={['top']}>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator>
              <View style={styles.headerBar}>
                <Link href={deckId ? (`/deck/${deckId}` as never) : '/'} asChild>
                  <Pressable accessibilityRole="link" accessibilityLabel="กลับหน้า deck" style={styles.backBtn}>
                    <FiChevronLeft size={18} color={colors.text} strokeWidth={2} />
                    <ThemedText type="small" themeColor="textSecondary">BACK</ThemedText>
                  </Pressable>
                </Link>
              </View>
              <RouteLoadingIndicator />
            </ScrollView>
          </SafeAreaView>
        </ThemedView>
      );
    }
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator>
            <View style={styles.headerBar}>
              <Link href={deckId ? (`/deck/${deckId}` as never) : '/'} asChild>
                <Pressable accessibilityRole="link" accessibilityLabel="กลับหน้า deck" style={styles.backBtn}>
                  <FiChevronLeft size={18} color={colors.text} strokeWidth={2} />
                  <ThemedText type="small" themeColor="textSecondary">BACK</ThemedText>
                </Pressable>
              </Link>
            </View>
            <View style={styles.titleBlock}>
              <ThemedText type="title" style={[styles.title, { color: colors.text }]}>
                ไม่พบ Deck
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                อาจถูกลบหรือ deck ID ไม่ถูกต้อง
              </ThemedText>
            </View>
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator>
          <View style={styles.headerBar}>
            <Link href={deckId ? (`/deck/${deckId}` as never) : '/'} asChild>
              <Pressable accessibilityRole="link" accessibilityLabel="กลับหน้า deck" style={styles.backBtn}>
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
                // STUDY MODE · รูปแบบรอบนี้
              </ThemedText>
            </View>
            <ThemedText type="title" style={[styles.title, { color: colors.text }]}>
              เลือกวิธีเรียน
            </ThemedText>
            {deck ? (
              <ThemedText type="small" themeColor="textSecondary">
                {deck.title}
              </ThemedText>
            ) : null}
          </View>

          <View style={styles.modeStack}>
            {MODES.map((item) => (
              <ModeCard
                key={item.mode}
                mode={item.mode}
                title={item.title}
                body={item.body}
                href={item.href}
                Icon={item.icon}
                configured={configByMode[item.mode].configured}
                colors={colors}
                onStart={() => startMode(item.mode, item.href)}
                onConfig={() => configureMode(item.mode, item.href)}
              />
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function ModeCard({
  title,
  body,
  mode,
  href,
  Icon,
  configured,
  colors,
  onStart,
  onConfig,
}: {
  title: string;
  body: string;
  mode: StudyMode;
  href: string;
  Icon: typeof FiLayers;
  configured: boolean;
  colors: typeof Colors.light;
  onStart: () => void;
  onConfig: () => void;
}) {
  return (
    <View style={[styles.modeCard, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
      <View style={[styles.cardStripe, { backgroundColor: configured ? Accent.base : colors.borderStrong }]} />
      <View style={styles.modeTop}>
        <View style={[styles.modeIcon, { borderColor: configured ? Accent.soft : colors.border }]}>
          <Icon size={22} color={configured ? Accent.base : colors.textSecondary} strokeWidth={2} />
        </View>
        <View style={styles.modeText}>
          <View style={styles.modeTitleRow}>
            <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>
              {title}
            </ThemedText>
            <ThemedText style={[styles.modeCode, { color: colors.textHint }]}>
              {mode.toUpperCase()}
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {body}
          </ThemedText>
        </View>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          onPress={onStart}
          accessibilityRole="button"
          accessibilityLabel={`เริ่ม ${title}`}
          style={({ pressed, hovered }: any) => [
            styles.startBtn,
            { backgroundColor: Accent.base, borderColor: Accent.base },
            (pressed || hovered) && { backgroundColor: Accent.strong, borderColor: Accent.strong },
            pressed && { opacity: 0.82 },
          ]}>
          <ThemedText style={styles.startText}>เริ่ม</ThemedText>
        </Pressable>
        <Pressable
          onPress={onConfig}
          accessibilityRole="button"
          accessibilityLabel={`ตั้งค่า ${title}`}
          style={({ pressed, hovered }: any) => [
            styles.configBtn,
            { borderColor: colors.border, backgroundColor: colors.background },
            (pressed || hovered) && { borderColor: Accent.soft },
            pressed && { opacity: 0.75 },
          ]}>
          <FiSettings size={16} color={colors.text} strokeWidth={2} />
          <ThemedText type="small" style={{ color: colors.text }}>
            ตั้งค่า
          </ThemedText>
        </Pressable>
      </View>

      <ThemedText style={[styles.configState, { color: configured ? Accent.base : colors.textHint }]}>
        {configured ? `READY · /${href}` : 'CONFIG FIRST'}
      </ThemedText>
    </View>
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
  modeStack: {
    gap: Spacing.three,
  },
  modeCard: {
    position: 'relative',
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.four,
    gap: Spacing.four,
    overflow: 'hidden',
  },
  cardStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  modeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  modeIcon: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  modeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  modeCode: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  startBtn: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  configBtn: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  configState: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 9,
    letterSpacing: 1.2,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
