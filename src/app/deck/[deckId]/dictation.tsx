import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { FiChevronLeft, FiHome, FiRefreshCw, FiSettings } from 'react-icons/fi';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, Colors, MaxContentWidth, Radii, Spacing, RateColors } from '@/constants/theme';
import { useThemeColors } from '@/context/theme';
import type { Entry } from '@/data/types';
import { freeDeckParams } from '@/data/static-params';
import { entriesForDeckAsync, useAllDecks } from '@/hooks/use-decks';
import { usePersistedState } from '@/hooks/use-persisted-state';
import { checkDictationAnswer } from '@/lib/dictation';
import { studyFallbackHref } from '@/lib/navigation-back';
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

export default function DictationScreen() {
  const { deckId } = useLocalSearchParams<{ deckId?: string }>();
  const router = useRouter();
  const { scheme, colors } = useThemeColors();
  const { width: viewportW } = useWindowDimensions();
  const rateColors = RateColors[scheme];
  const backFallbackHref = studyFallbackHref(deckId);
  const showMobileHome = viewportW < 768;

  const { decks: allDecks } = useAllDecks();
  const deck = deckId ? allDecks.find((d) => d.id === deckId) : undefined;
  const [entries, setEntries] = useState<Entry[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  const [config] = usePersistedState<StudyModeConfig>(
    studyModeConfigKey('dictation'),
    DEFAULT_STUDY_MODE_CONFIGS.dictation,
  );
  const safeConfig = useMemo(() => sanitizeStudyModeConfig(config, 'dictation'), [config]);
  const fields = useMemo(() => deriveStudyFields(safeConfig), [safeConfig]);

  useEffect(() => {
    setIndex(0);
    setAnswer('');
    setSubmitted(false);
    setIsCorrect(false);
    setCorrectCount(0);

    let cancelled = false;
    if (!deckId) {
      setEntries([]);
      return;
    }

    void entriesForDeckAsync(deckId).then((rows) => {
      if (cancelled) return;
      setEntries(buildStudySessionEntries(rows, safeConfig, `${deckId}:dictation`));
    });

    return () => {
      cancelled = true;
    };
  }, [deckId, safeConfig]);

  const current = entries[index];
  const expectedAnswer = current ? valueForField(current, fields.answerField).trim() : '';
  const isComplete = entries.length > 0 && index >= entries.length;

  function handleSubmit() {
    if (!current || submitted || !answer.trim()) return;
    const correct = checkDictationAnswer(answer, expectedAnswer);
    setSubmitted(true);
    setIsCorrect(correct);
    if (correct) setCorrectCount((count) => count + 1);
  }

  function handleNext() {
    setAnswer('');
    setSubmitted(false);
    setIsCorrect(false);
    setIndex((value) => value + 1);
  }

  function handleRestart() {
    setIndex(0);
    setAnswer('');
    setSubmitted(false);
    setIsCorrect(false);
    setCorrectCount(0);
  }

  if (!deckId || (!deck && entries.length === 0)) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <EmptyState
            colors={colors}
            title={!deckId ? 'ไม่พบ Deck' : 'กำลังเตรียมรอบเรียน'}
            body={!deckId ? 'ลิงก์นี้ไม่มี deck ID' : 'กำลังโหลดคำใน deck นี้'}
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
              mode="dictation"
              showMobileHome={showMobileHome}
              colors={colors}
            />
            <View style={[styles.completeCard, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
              <View style={[styles.cardStripe, { backgroundColor: Accent.base }]} />
              <ThemedText style={[styles.mono, { color: colors.textHint }]}>
                // DICTATION · COMPLETE
              </ThemedText>
              <ThemedText type="title" style={[styles.completeTitle, { color: colors.text }]}>
                จบรอบเขียนตอบ
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

  if (!current) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <EmptyState
            colors={colors}
            title="ไม่มีคำให้เรียน"
            body="deck นี้ยังไม่มี entry ที่ใช้เริ่มรอบเขียนตอบได้"
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
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled">
          <Header
            backHref={backFallbackHref}
            deckId={deckId}
            mode="dictation"
            showMobileHome={showMobileHome}
            colors={colors}
          />

          <View style={styles.titleBlock}>
            <View style={styles.sectionLabel}>
              <View style={[styles.pip, { backgroundColor: Accent.base }]} />
              <ThemedText style={[styles.mono, { color: colors.textHint }]}>
                // DICTATION · {index + 1} / {entries.length}
              </ThemedText>
            </View>
            <ThemedText type="title" style={[styles.title, { color: colors.text }]}>
              เขียนคำตอบ
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

          <View style={styles.answerBlock}>
            <ThemedText style={[styles.fieldLabel, { color: colors.textHint }]}>
              ANSWER · {labelForField(fields.answerField)}
            </ThemedText>
            <TextInput
              value={answer}
              onChangeText={setAnswer}
              editable={!submitted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              placeholder="พิมพ์คำตอบ"
              placeholderTextColor={colors.textHint}
              style={[
                styles.answerInput,
                {
                  borderColor: submitted ? (isCorrect ? Accent.base : rateColors.againFg) : colors.border,
                  backgroundColor: colors.backgroundElement,
                  color: colors.text,
                },
              ]}
            />
          </View>

          {submitted ? (
            <View
              style={[
                styles.revealCard,
                {
                  borderColor: isCorrect ? Accent.soft : rateColors.againFg,
                  backgroundColor: isCorrect ? Accent.bg : rateColors.againBg,
                },
              ]}>
              <ThemedText style={[styles.feedbackText, { color: isCorrect ? Accent.base : rateColors.againFg }]}>
                {isCorrect ? 'ถูกต้อง' : 'ยังไม่ตรง'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                คำตอบที่ตรงคือ
              </ThemedText>
              <ThemedText style={[styles.expectedText, { color: colors.text }]}>{expectedAnswer}</ThemedText>
            </View>
          ) : null}

          <Pressable
            onPress={submitted ? handleNext : handleSubmit}
            disabled={!submitted && !answer.trim()}
            accessibilityRole="button"
            accessibilityLabel={submitted ? 'ข้อถัดไป' : 'ส่งคำตอบ'}
            style={({ pressed, hovered }: any) => [
              styles.primaryBtn,
              { backgroundColor: Accent.base, borderColor: Accent.base },
              !submitted && !answer.trim() && { opacity: 0.45 },
              (pressed || hovered) && { backgroundColor: Accent.strong, borderColor: Accent.strong },
              pressed && { opacity: 0.85 },
            ]}>
            <ThemedText style={styles.primaryText}>
              {submitted ? (index >= entries.length - 1 ? 'ดูผลลัพธ์' : 'ข้อต่อไป') : 'ส่งคำตอบ'}
            </ThemedText>
          </Pressable>
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
  mode: 'dictation';
  showMobileHome: boolean;
  colors: typeof Colors.light;
}) {
  const settingsHref = deckId ? `/deck/${deckId}/config?mode=${mode}&next=${mode}` : undefined;

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
        mode="dictation"
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
  answerBlock: { gap: Spacing.two },
  answerInput: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
  },
  revealCard: {
    borderWidth: 1,
    borderRadius: Radii.sm,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  feedbackText: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  expectedText: { fontSize: 22, lineHeight: 30, fontWeight: '800' },
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
