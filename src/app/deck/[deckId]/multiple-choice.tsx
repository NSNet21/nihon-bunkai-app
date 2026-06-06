import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { FiCheck, FiChevronLeft, FiHome, FiRefreshCw, FiSettings, FiX } from 'react-icons/fi';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { RouteLoadingIndicator } from '@/components/route-loading-indicator';
import { Accent, Colors, MaxContentWidth, Radii, Spacing, RateColors } from '@/constants/theme';
import { useThemeColors } from '@/context/theme';
import { useAuth } from '@/context/auth';
import type { Entry } from '@/data/types';
import { freeDeckParams } from '@/data/static-params';
import { entriesForDeckAsync } from '@/hooks/use-decks';
import { useDeckRouteDeck } from '@/hooks/use-deck-route-deck';
import { usePersistedState } from '@/hooks/use-persisted-state';
import {
  buildMultipleChoiceQuestion,
  getMultipleChoiceChoiceState,
  gradeMultipleChoiceAttempt,
  type MultipleChoiceAttempt,
} from '@/lib/multiple-choice';
import { studyFallbackHref } from '@/lib/navigation-back';
import {
  applyStudyModeRating,
  ratingFromCorrectness,
  recordCompletedStudySession,
} from '@/lib/study-session-results';
import {
  DEFAULT_STUDY_MODE_CONFIGS,
  deriveStudyFields,
  sanitizeStudyModeConfig,
  studyModeConfigKey,
  type StudyField,
  type StudyModeConfig,
} from '@/lib/study-mode-config';
import { buildStudySessionEntries } from '@/lib/study-session';

export function generateStaticParams() {
  return freeDeckParams();
}

const PRIMARY_ACTION_TEST_ID = 'multiple-choice-primary-action';
const SCROLL_TEST_ID = 'multiple-choice-scroll';

export default function MultipleChoiceScreen() {
  const { deckId } = useLocalSearchParams<{ deckId?: string }>();
  const router = useRouter();
  const { scheme, colors } = useThemeColors();
  const { width: viewportW } = useWindowDimensions();
  const rateColors = RateColors[scheme];
  const backFallbackHref = studyFallbackHref(deckId);
  const showMobileHome = viewportW < 768;
  const { user } = useAuth();

  const { deck, routeState: deckRouteState } = useDeckRouteDeck(deckId);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(Boolean(deckId));
  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState<MultipleChoiceAttempt | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [results, setResults] = useState<ReturnType<typeof ratingFromCorrectness>[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);
  const sessionLoggedRef = useRef(false);
  const answerLockedRef = useRef(false);
  const scrollRef = useRef<ScrollView | null>(null);

  const [config] = usePersistedState<StudyModeConfig>(
    studyModeConfigKey('multiple-choice'),
    DEFAULT_STUDY_MODE_CONFIGS['multiple-choice'],
  );
  const safeConfig = useMemo(() => sanitizeStudyModeConfig(config, 'multiple-choice'), [config]);
  const fields = useMemo(() => deriveStudyFields(safeConfig), [safeConfig]);

  useEffect(() => {
    setIndex(0);
    setAttempt(null);
    setCorrectCount(0);
    setResults([]);
    sessionIdRef.current = null;
    sessionStartedAtRef.current = null;
    sessionLoggedRef.current = false;
    answerLockedRef.current = false;

    let cancelled = false;
    if (!deckId) {
      setEntries([]);
      setEntriesLoading(false);
      return;
    }

    setEntriesLoading(true);
    void entriesForDeckAsync(deckId).then((rows) => {
      if (cancelled) return;
      setEntries(buildStudySessionEntries(rows, safeConfig, `${deckId}:multiple-choice`));
      setEntriesLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [deckId, safeConfig]);

  const current = entries[index];
  const isComplete = entries.length > 0 && index >= entries.length;
  const question = useMemo(() => {
    if (!current) return null;
    return buildMultipleChoiceQuestion(current, entries, safeConfig.goal);
  }, [current, entries, safeConfig.goal]);

  useEffect(() => {
    if (attempt) scrollPrimaryActionIntoView();
  }, [attempt]);

  async function handleChoice(choice: string) {
    if (!question || !current || !deck || attempt || answerLockedRef.current) return;
    answerLockedRef.current = true;
    const result = gradeMultipleChoiceAttempt(choice, question.correct);
    const rating = ratingFromCorrectness(result.isCorrect);
    if (sessionIdRef.current === null) {
      sessionIdRef.current = crypto.randomUUID();
      sessionStartedAtRef.current = Date.now();
    }
    await applyStudyModeRating({
      deckId: deck.id,
      entryNo: current.no,
      rating,
      userId: user?.id,
    });
    setAttempt(result);
    setResults((prev) => [...prev, rating]);
    if (result.isCorrect) {
      setCorrectCount((count) => count + 1);
    }
  }

  function scrollPrimaryActionIntoView() {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        document
          .querySelector(`[data-testid="${PRIMARY_ACTION_TEST_ID}"]`)
          ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 0);
  }

  function handleNext() {
    answerLockedRef.current = false;
    setAttempt(null);
    setIndex((value) => value + 1);
    scrollSessionToTop();
  }

  function handleRestart() {
    sessionIdRef.current = null;
    sessionStartedAtRef.current = null;
    sessionLoggedRef.current = false;
    answerLockedRef.current = false;
    setIndex(0);
    setAttempt(null);
    setCorrectCount(0);
    setResults([]);
    scrollSessionToTop();
  }

  function scrollSessionToTop() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const lane = document.querySelector(`[data-testid="${SCROLL_TEST_ID}"]`);
        if (lane instanceof HTMLElement) lane.scrollTop = 0;
      }
    });
  }

  useEffect(() => {
    if (
      !isComplete ||
      !deck ||
      sessionIdRef.current === null ||
      sessionStartedAtRef.current === null ||
      sessionLoggedRef.current
    ) {
      return;
    }
    sessionLoggedRef.current = true;
    void recordCompletedStudySession({
      sessionId: sessionIdRef.current,
      deck,
      totalCards: entries.length,
      ratings: results,
      startedAt: sessionStartedAtRef.current,
      userId: user?.id,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete]);

  if (!deckId || deckRouteState !== 'ready' || entriesLoading) {
    const isLoading = deckRouteState === 'loading' || entriesLoading;
    if (isLoading) {
      return (
        <ThemedView style={styles.container}>
          <SafeAreaView style={styles.safeArea} edges={['top']}>
            <RouteLoadingIndicator />
          </SafeAreaView>
        </ThemedView>
      );
    }
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <EmptyState
            colors={colors}
            title={!deckId ? 'ไม่พบ Deck' : 'ไม่พบ Deck'}
            body={!deckId ? 'ลิงก์นี้ไม่มี deck ID' : 'อาจถูกลบหรือ deck ID ไม่ถูกต้อง'}
            backHref={backFallbackHref}
          />
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (isComplete) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Header
              backHref={backFallbackHref}
              deckId={deckId}
              mode="multiple-choice"
              showMobileHome={showMobileHome}
              colors={colors}
            />
            <View style={[styles.completeCard, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
              <View style={[styles.cardStripe, { backgroundColor: Accent.base }]} />
              <ThemedText style={[styles.mono, { color: colors.textHint }]}>
                // MULTIPLE CHOICE · COMPLETE
              </ThemedText>
              <ThemedText type="title" style={[styles.completeTitle, { color: colors.text }]}>
                จบรอบปรนัย
              </ThemedText>
              <ThemedText themeColor="textSecondary">
                ถูก {correctCount} / {entries.length} ข้อ
              </ThemedText>
              <View style={styles.completeActions}>
                <Pressable
                  onPress={handleRestart}
                  accessibilityRole="button"
                  accessibilityLabel="เริ่มรอบนี้ใหม่"
                  style={({ pressed, hovered }: any) => [
                    styles.secondaryBtn,
                    { borderColor: colors.border, backgroundColor: colors.background },
                    (pressed || hovered) && { borderColor: Accent.soft },
                    pressed && { opacity: 0.75 },
                  ]}>
                  <FiRefreshCw size={16} color={colors.text} strokeWidth={2} />
                  <ThemedText type="small" style={{ color: colors.text }}>
                    เริ่มใหม่
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => router.replace(backFallbackHref as never)}
                  accessibilityRole="button"
                  accessibilityLabel="กลับหน้า deck"
                  style={({ pressed, hovered }: any) => [
                    styles.primaryBtn,
                    { backgroundColor: Accent.base, borderColor: Accent.base },
                    (pressed || hovered) && { backgroundColor: Accent.strong, borderColor: Accent.strong },
                    pressed && { opacity: 0.85 },
                  ]}>
                  <ThemedText style={styles.primaryText}>กลับหน้า deck</ThemedText>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!current || !question) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <EmptyState
            colors={colors}
            title="ไม่มีคำให้เรียน"
            body="deck นี้ยังไม่มี entry ที่ใช้เริ่มรอบปรนัยได้"
            backHref={backFallbackHref}
          />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          ref={scrollRef}
          testID={SCROLL_TEST_ID}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator>
          <Header
            backHref={backFallbackHref}
            deckId={deckId}
            mode="multiple-choice"
            showMobileHome={showMobileHome}
            colors={colors}
          />

          <View style={styles.titleBlock}>
            <View style={styles.sectionLabel}>
              <View style={[styles.pip, { backgroundColor: Accent.base }]} />
              <ThemedText style={[styles.mono, { color: colors.textHint }]}>
                // MULTIPLE CHOICE · {index + 1} / {entries.length}
              </ThemedText>
            </View>
            <ThemedText type="title" style={[styles.title, { color: colors.text }]}>
              เลือกคำตอบ
            </ThemedText>
            {deck ? (
              <ThemedText type="small" themeColor="textSecondary">
                {deck.title}
              </ThemedText>
            ) : null}
          </View>

          <View style={[styles.promptCard, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
            <View style={[styles.cardStripe, { backgroundColor: Accent.base }]} />
            <ThemedText style={[styles.mono, { color: colors.textHint }]}>
              // PROMPT · {safeConfig.goal.toUpperCase()}
            </ThemedText>
            {fields.prompt.length > 0 ? (
              <View style={styles.promptFields}>
                {fields.prompt.map((field) => (
                  <PromptField key={field} field={field} entry={current} colors={colors} />
                ))}
              </View>
            ) : (
              <ThemedText type="small" themeColor="textSecondary" style={styles.noHintText}>
                ไม่มีคำใบ้ในรอบนี้
              </ThemedText>
            )}
          </View>

          <View style={styles.choiceStack}>
            {question.choices.map((choice) => {
              const choiceState = getMultipleChoiceChoiceState(choice, attempt);
              const isSelected = attempt?.selected === choice;
              const isSubmitted = attempt !== null;
              const isCorrectChoice = choiceState === 'correct';
              const isWrongChoice = choiceState === 'wrong';
              const accessibilityLabel =
                choiceState === 'correct'
                  ? `ตัวเลือก ${choice} คำตอบที่ถูก`
                  : choiceState === 'wrong'
                    ? `ตัวเลือก ${choice} คำตอบที่เลือก ไม่ถูก`
                    : `ตัวเลือก ${choice}`;
              return (
                <Pressable
                  key={choice}
                  onPress={() => handleChoice(choice)}
                  disabled={isSubmitted}
                  accessibilityRole="button"
                  accessibilityLabel={accessibilityLabel}
                  accessibilityState={{ selected: isSelected, disabled: isSubmitted }}
                  style={({ pressed, hovered }: any) => [
                    styles.choiceBtn,
                    { borderColor: colors.border, backgroundColor: colors.backgroundElement },
                    (pressed || hovered) && !isSubmitted && { borderColor: Accent.soft },
                    isCorrectChoice && { borderColor: Accent.base, backgroundColor: Accent.bg },
                    isWrongChoice && { borderColor: rateColors.againFg, backgroundColor: rateColors.againBg },
                    pressed && !isSubmitted && { opacity: 0.8 },
                  ]}>
                  <View style={styles.choiceContent}>
                    <View style={styles.choiceIconSlot}>
                      {isCorrectChoice ? (
                        <FiCheck size={18} color={Accent.base} strokeWidth={2.5} />
                      ) : isWrongChoice ? (
                        <FiX size={18} color={rateColors.againFg} strokeWidth={2.5} />
                      ) : null}
                    </View>
                    <ThemedText style={[styles.choiceText, { color: colors.text }]}>{choice}</ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {attempt ? (
            <View style={styles.feedbackBlock}>
              <Pressable
                onPress={handleNext}
                testID={PRIMARY_ACTION_TEST_ID}
                accessibilityRole="button"
                accessibilityLabel="ข้อถัดไป"
                style={({ pressed, hovered }: any) => [
                  styles.primaryBtn,
                  { backgroundColor: Accent.base, borderColor: Accent.base },
                  (pressed || hovered) && { backgroundColor: Accent.strong, borderColor: Accent.strong },
                  pressed && { opacity: 0.85 },
                ]}>
                <ThemedText style={styles.primaryText}>
                  {index >= entries.length - 1 ? 'ดูผลลัพธ์' : 'ข้อต่อไป'}
                </ThemedText>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Header({
  backHref,
  deckId,
  mode,
  showMobileHome,
  colors,
}: {
  backHref: string;
  deckId?: string;
  mode: 'multiple-choice';
  showMobileHome: boolean;
  colors: typeof Colors.light;
}) {
  const settingsHref = deckId
    ? `/deck/${deckId}/config?mode=${mode}&next=${mode}&returnTo=${encodeURIComponent(`/deck/${deckId}/${mode}`)}`
    : undefined;

  return (
    <View style={styles.headerBar}>
      <Link href={backHref as never} asChild>
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
      <View style={styles.headerActions}>
        {showMobileHome ? (
          <Link href="/" asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="กลับ Browse"
              style={({ pressed, hovered }: any) => [
                styles.iconBtn,
                { borderColor: (pressed || hovered) ? Accent.soft : colors.border, backgroundColor: colors.background },
                pressed && { opacity: 0.72 },
              ]}>
              {({ pressed, hovered }: any) => {
                const active = pressed || hovered;
                return <FiHome size={16} color={active ? Accent.base : colors.text} strokeWidth={2} />;
              }}
            </Pressable>
          </Link>
        ) : null}
        {settingsHref ? (
          <Link href={settingsHref as never} asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="ตั้งค่ารอบเรียน"
              style={({ pressed, hovered }: any) => [
                styles.iconBtn,
                { borderColor: (pressed || hovered) ? Accent.soft : colors.border, backgroundColor: colors.background },
                pressed && { opacity: 0.72 },
              ]}>
              {({ pressed, hovered }: any) => {
                const active = pressed || hovered;
                return <FiSettings size={16} color={active ? Accent.base : colors.text} strokeWidth={2} />;
              }}
            </Pressable>
          </Link>
        ) : null}
      </View>
    </View>
  );
}

function EmptyState({
  title,
  body,
  backHref,
  colors,
}: {
  title: string;
  body: string;
  backHref: string;
  colors: typeof Colors.light;
}) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Header
        backHref={backHref}
        mode="multiple-choice"
        showMobileHome={false}
        colors={colors}
      />
      <View style={styles.centerFill}>
        <ThemedText type="title" style={{ color: colors.text }}>
          {title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.emptyBody}>
          {body}
        </ThemedText>
      </View>
    </ScrollView>
  );
}

function PromptField({ field, entry, colors }: { field: StudyField; entry: Entry; colors: typeof Colors.light }) {
  const value = valueForField(entry, field);
  if (!value) return null;
  return (
    <View style={[styles.promptField, { borderColor: colors.border, backgroundColor: colors.background }]}>
      <ThemedText style={[styles.fieldLabel, { color: colors.textHint }]}>{labelForField(field)}</ThemedText>
      <ThemedText style={[field === 't' ? styles.termValue : styles.fieldValue, { color: colors.text }]}>
        {value}
      </ThemedText>
    </View>
  );
}

function valueForField(entry: Entry, field: StudyField) {
  if (field === 't') return entry.t;
  if (field === 'd') return entry.d;
  if (field === 'p') return entry.p;
  return entry.e;
}

function labelForField(field: StudyField) {
  if (field === 't') return 'TERM';
  if (field === 'd') return 'MEANING';
  if (field === 'p') return 'READING';
  return 'NOTE';
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, width: '100%' },
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  headerBar: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingRight: Spacing.three,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: { gap: Spacing.two },
  sectionLabel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  pip: { width: 7, height: 7 },
  mono: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  title: { fontSize: 30, lineHeight: 36 },
  promptCard: {
    borderWidth: 1,
    borderRadius: Radii.sm,
    padding: Spacing.four,
    gap: Spacing.three,
    overflow: 'hidden',
  },
  completeCard: {
    borderWidth: 1,
    borderRadius: Radii.sm,
    padding: Spacing.five,
    gap: Spacing.three,
    overflow: 'hidden',
  },
  cardStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  promptFields: { gap: Spacing.two },
  promptField: {
    borderWidth: 1,
    borderRadius: Radii.sm,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  fieldLabel: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 10,
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  fieldValue: { fontSize: 18, lineHeight: 26 },
  termValue: {
    fontFamily: Platform.select({ web: '"Noto Serif JP", serif', default: undefined }),
    fontSize: 34,
    lineHeight: 44,
    fontWeight: '700',
  },
  noHintText: { textAlign: 'center', paddingVertical: Spacing.four },
  choiceStack: { gap: Spacing.two },
  choiceBtn: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    justifyContent: 'center',
  },
  choiceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  choiceIconSlot: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceText: { fontSize: 17, lineHeight: 24, fontWeight: '700' },
  feedbackBlock: { gap: Spacing.three, alignItems: 'stretch' },
  primaryBtn: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  secondaryBtn: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  completeTitle: { fontSize: 32, lineHeight: 38 },
  completeActions: { gap: Spacing.two, marginTop: Spacing.two },
  centerFill: {
    flex: 1,
    minHeight: 360,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
  },
  emptyBody: { textAlign: 'center', maxWidth: 360 },
});
