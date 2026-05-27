/**
 * Deck Detail screen — /deck/[deckId]
 *
 * Intermediate step between Browse and Study. Shows the user *what they
 * own* before diving in: deck identity (Hero), 3-stat snapshot (TOTAL /
 * DUE / MASTERED), last-studied + streak rows, sample card preview,
 * mastery breakdown across FSRS states, and two CTAs.
 *
 * Design source: design/handoff-app/Nihon Bunkai - Screens v3.html, screen 02.
 *
 * Data sources (all local):
 *   - useAllDecks()              — deck metadata (free + paid)
 *   - entriesForDeckAsync(id)    — entry list
 *   - getCardStatesForDeck(id)   — FSRS state per entry (Dexie)
 *   - getRecentSessions(N)       — last-studied row
 *   - getStreakMeta()            — streak row
 *
 * MASTERED definition (GPT verdict):
 *   state === Review (2) AND stability >= 21  (~3 weeks future interval)
 *   Using state alone = inflated "mastered" right after first promotion.
 *   stability threshold reflects "actually retained, not just promoted".
 */

import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { FiBarChart2, FiBookOpen, FiChevronLeft, FiChevronRight, FiClock, FiEdit3, FiFlag, FiGrid, FiLayers, FiLock, FiShuffle, FiSliders } from 'react-icons/fi';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MiniCard } from '@/components/mini-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, BottomTabInset, Colors, MaxContentWidth, RateColors, Radii, Spacing } from '@/constants/theme';
import { useThemeColors } from '@/context/theme';
import { entriesForDeckAsync, useAllDecks } from '@/hooks/use-decks';
import { usePersistedState } from '@/hooks/use-persisted-state';
import type { Entry } from '@/data/types';
import {
  type CardStateRow,
  getCardStatesForDeck,
  getRecentSessions,
  getStreakMeta,
} from '@/lib/srs-store';

/** FSRS state numeric values used by ts-fsrs. */
const FSRS_STATE = { New: 0, Learning: 1, Review: 2, Relearning: 3 } as const;

/** Stability cutoff (days) above which a Review card counts as MASTERED.
 *  21 days ≈ 3 weeks future interval — strong retention signal. */
const MASTERED_STABILITY = 21;

/* ─── Component ─────────────────────────────────────────────────────── */

export default function DeckDetailScreen() {
  const { deckId } = useLocalSearchParams<{ deckId?: string }>();
  const router = useRouter();
  const { scheme, colors } = useThemeColors();
  const rate = scheme === 'dark' ? RateColors.dark : RateColors.light;
  const { width: viewportW } = useWindowDimensions();
  const isCompact = viewportW < 600;

  const { decks: allDecks } = useAllDecks();
  const deck = deckId ? allDecks.find((d) => d.id === deckId) : undefined;

  const [entries, setEntries] = useState<Entry[]>([]);
  const [cardStates, setCardStates] = useState<CardStateRow[]>([]);
  const [lastSessionMeta, setLastSessionMeta] = useState<{ endedAt: number; cards: number } | null>(null);
  const [streak, setStreak] = useState<{ current: number; lastStudied: string | null }>({
    current: 0,
    lastStudied: null,
  });

  /* Load deck data on mount / deckId change. */
  useEffect(() => {
    if (!deckId) return;
    let cancelled = false;
    (async () => {
      const [es, cs, sessions, sm] = await Promise.all([
        entriesForDeckAsync(deckId),
        getCardStatesForDeck(deckId),
        getRecentSessions(10),
        getStreakMeta(),
      ]);
      if (cancelled) return;
      setEntries(es);
      setCardStates(cs);
      /* Find most recent session for THIS deck (sessions are global, filter). */
      const last = sessions.find((s) => s.deckId === deckId);
      setLastSessionMeta(
        last
          ? { endedAt: last.endedAt, cards: last.againCount + last.hardCount + last.goodCount + last.easyCount }
          : null,
      );
      setStreak({ current: sm.currentStreak, lastStudied: sm.lastStudiedDate });
    })();
    return () => {
      cancelled = true;
    };
  }, [deckId]);

  /* Compute stats from cardStates. Memoized — recomputes only when
     cardStates changes (or entry count, which gates TOTAL). */
  const stats = useMemo(() => {
    const total = entries.length;
    const now = Date.now();
    let due = 0;
    let mastered = 0;
    const breakdown = { again: 0, hard: 0, good: 0, easy: 0 };

    /* DUE = cardStates with due timestamp <= now (FSRS scheduler says
       it's time to review). Cards never rated (no cardState row) DON'T
       count as due — they're "new" cards, separate bucket. */
    for (const cs of cardStates) {
      if (cs.due <= now) due += 1;
      if (cs.state === FSRS_STATE.Review && cs.stability >= MASTERED_STABILITY) {
        mastered += 1;
      }
      /* Last-rating-derived breakdown — proxy for "how is this card
         doing". Maps FSRS scheduling state to the 4 rating buckets:
         Relearning → ลืม (rated Again recently)
         Learning   → ยาก (still rising)
         Review (stab<MASTERED) → เข้าใจ (settling)
         Review (stab>=MASTERED) → ง่าย (locked in)
         New cards (no row) not represented in bars — separate "new" count. */
      if (cs.state === FSRS_STATE.Relearning) breakdown.again += 1;
      else if (cs.state === FSRS_STATE.Learning) breakdown.hard += 1;
      else if (cs.state === FSRS_STATE.Review) {
        if (cs.stability >= MASTERED_STABILITY) breakdown.easy += 1;
        else breakdown.good += 1;
      }
    }
    /* "New" = entries that have never been rated. */
    const newCount = Math.max(0, total - cardStates.length);
    return { total, due, mastered, newCount, breakdown };
  }, [cardStates, entries.length]);

  /* Quiz count — persisted globally via /config. 'all' = no slicing.
     Hub Quiz CTA appends `?count=N` (omitted when 'all'). Per GPT
     verdict 2026-05-27: Count is a Quiz-only concept; Learn never
     respects it. See [[theme-perf-cascade]] sibling memory for the
     full flow rationale (TODO: spin out quiz-config memory). */
  const [quizCount] = usePersistedState<'10' | '20' | '30' | '50' | 'all'>('quiz-count', 'all');
  const countSuffix = quizCount !== 'all' ? ` · ${quizCount} ข้อ` : '';

  /* CTA labels — adapt to whether there are due cards (otherwise the
     "DUE" pitch is misleading for first-time deck-open). The persisted
     count appends as a secondary signal so the user sees what they're
     about to start.

     Copy 2026-05-27 (GPT polish): "เริ่มเรียน" replaced with "ทดสอบ"
     because this CTA sits in the TEST section — "เรียน" collides with
     the LEARN section above. Vocabulary now consistent with /config
     CTA ("ทดสอบ · N ข้อ"). */
  const startLabel = stats.due > 0
    ? `เริ่ม · ${stats.due} due${countSuffix}`
    : `ทดสอบ${countSuffix}`;

  function goQuiz(extra?: Record<string, string>) {
    if (!deckId) return;
    const params: Record<string, string> = { ...(extra ?? {}) };
    if (quizCount !== 'all' && !params.count) params.count = quizCount;
    const qs = new URLSearchParams(params).toString();
    router.push(`/deck/${deckId}/quiz${qs ? `?${qs}` : ''}` as never);
  }
  function goMemorize() {
    if (!deckId) return;
    router.push(`/deck/${deckId}/memorize` as never);
  }

  if (!deck) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.headerBar}>
            <Link href="/" asChild>
              <Pressable accessibilityRole="link" accessibilityLabel="กลับ Browse" style={styles.backBtn}>
                {({ pressed, hovered }) => {
                  const active = pressed || hovered;
                  return (
                    <>
                      <FiChevronLeft size={18} color={active ? Accent.base : colors.text} strokeWidth={2} />
                      <ThemedText type="small" style={{ color: active ? Accent.base : colors.textSecondary }}>BACK</ThemedText>
                    </>
                  );
                }}
              </Pressable>
            </Link>
          </View>
          <View style={styles.centerFill}>
            <ThemedText type="title">ไม่พบ Deck นี้</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', maxWidth: 320 }}>
              อาจถูกลบหรือ deck ID ไม่ถูกต้อง · ลองกลับไปหน้า Browse แล้วเลือกใหม่
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  /* Hero ghost kanji = fixed 字 (literally "character / letter").
     Universal — works for kanji / grammar / vocab / glossary / user-
     added decks alike. Decoration only (low opacity), no type-derived
     conditional logic. */

  /* Display fields — JP heading + Thai sub. Title format e.g.
     "Kanji N5 · Pack 01" → extract pieces. Falls back gracefully if
     custom decks ever use a different format. */
  const titleParts = deck.title.split('·').map((s) => s.trim());
  const titleMain = titleParts[0] ?? deck.title;
  const titleSub = titleParts.slice(1).join(' · ');

  /* Sample card = first entry. Drives MiniCard preview. */
  const sampleEntry = entries[0];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: BottomTabInset + Spacing.six }]}
          showsVerticalScrollIndicator>
          {/* Header (BACK + filter) moved INTO ScrollView so the scrollbar
              extends the full viewport height (user request 2026-05-27).
              It scrolls with content — TopNavBar already handles fixed
              navigation; this in-page header is a one-time anchor. */}
          <View style={styles.headerBar}>
            <Link href="/" asChild>
              <Pressable accessibilityRole="link" accessibilityLabel="กลับ Browse" style={styles.backBtn}>
                {({ pressed, hovered }) => {
                  const active = pressed || hovered;
                  return (
                    <>
                      <FiChevronLeft size={18} color={active ? Accent.base : colors.text} strokeWidth={2} />
                      <ThemedText type="small" style={{ color: active ? Accent.base : colors.textSecondary }}>BACK</ThemedText>
                    </>
                  );
                }}
              </Pressable>
            </Link>
            <Pressable
              onPress={() => router.push(`/deck/${deck.id}/config` as never)}
              accessibilityRole="button"
              accessibilityLabel="ตั้งค่ารอบทบทวน"
              style={({ pressed }) => [
                styles.configBtn,
                { borderColor: colors.border, backgroundColor: colors.background },
                pressed && { opacity: 0.7 },
              ]}>
              <FiSliders size={16} color={colors.text} strokeWidth={2} />
            </Pressable>
          </View>
          {/* ── Hero ── */}
          <View style={[styles.hero, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
            <View style={[styles.heroStripe, { backgroundColor: Accent.base }]} />
            <ThemedText style={[styles.ghostKanji, { color: colors.text }]}>字</ThemedText>
            <View style={styles.metaRow}>
              <View style={[styles.pip, { backgroundColor: Accent.base }]} />
              <ThemedText style={[styles.mono, { color: colors.textHint }]}>
                {`// JLPT ${deck.level ?? 'GLOSSARY'} · ${deck.type.toUpperCase()}`}
              </ThemedText>
            </View>
            <ThemedText style={[styles.heroJp, { color: colors.text }]}>{titleMain}</ThemedText>
            {titleSub ? (
              <ThemedText style={[styles.heroSub, { color: colors.text }]}>
                <ThemedText style={[styles.heroSub, { color: Accent.base }]}>{titleSub}</ThemedText>
                .
              </ThemedText>
            ) : null}
            <View style={styles.pillRow}>
              <View style={[styles.pill, styles.pillHl, { borderColor: Accent.soft, backgroundColor: Accent.bg }]}>
                <ThemedText style={[styles.pillText, { color: Accent.base }]}>
                  {`${deck.entryCount} CARDS`}
                </ThemedText>
              </View>
              {/* Removed type-specific "音+訓 / 仮名+漢字 / 例+解説" pill
                  — user-added decks (Phase 3+) won't have reliable content-shape
                  signals to drive it. Single "{N} CARDS" pill is universal. */}
            </View>
          </View>

          {/* ── Section: Memorize (passive) ── */}
          <View style={styles.section}>
            <View style={styles.secLabel}>
              <View style={[styles.pip, { backgroundColor: Accent.base }]} />
              <ThemedText style={[styles.mono, { color: colors.textHint, fontSize: 10 }]}>
                การเรียนรู้ · LEARN
              </ThemedText>
            </View>
            <Pressable
              onPress={goMemorize}
              accessibilityRole="button"
              accessibilityLabel="เปิดดูคำศัพท์เฉยๆ"
              style={({ pressed }) => [
                styles.memorizeCard,
                { borderColor: colors.border, backgroundColor: colors.backgroundElement },
                pressed && { opacity: 0.85 },
              ]}>
              <View style={[styles.topStripe, { backgroundColor: Accent.base }]} />
              <View style={styles.memorizeBody}>
                <FiBookOpen size={32} color={Accent.base} strokeWidth={1.5} />
                <View style={{ alignItems: 'center', gap: 4 }}>
                  <ThemedText style={[styles.memorizeTitle, { color: colors.text }]}>
                    เปิดดู
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
                    ดูคำศัพท์ทั้งหมดเรียงตามลำดับ · ไม่มีการทดสอบ
                  </ThemedText>
                </View>
              </View>
            </Pressable>
          </View>

          {/* ── Section: Test (active) ── */}
          <View style={styles.section}>
            <View style={styles.secLabel}>
              <View style={[styles.pip, { backgroundColor: Accent.base }]} />
              <ThemedText style={[styles.mono, { color: colors.textHint, fontSize: 10 }]}>
                แบบทดสอบ · TEST
              </ThemedText>
            </View>
            <View style={[styles.testList, { borderColor: colors.border }]}>
              <TestRow
                icon={<FiLayers size={20} color={Accent.base} strokeWidth={2} />}
                title="แฟลชการ์ด"
                hint={startLabel}
                colors={colors}
                onPress={() => goQuiz()}
                accent
              />
              <View style={[styles.testRowDivider, { backgroundColor: colors.border }]} />
              <TestRow
                icon={<FiShuffle size={20} color={colors.textSecondary} strokeWidth={2} />}
                title="ทบทวนแบบสุ่ม"
                hint="MIXED · order shuffled"
                colors={colors}
                onPress={() => goQuiz({ shuffle: '1' })}
              />
              {/* Group break — locked modes pushed under a "COMING SOON"
                  mini-header so users read "2 modes ship + 2 in pipeline"
                  instead of "4 modes, 2 of which are inert". GPT polish
                  2026-05-27. Hint copy on each locked row keeps "เร็วๆ นี้"
                  for redundant clarity even with the header above. */}
              <View style={[styles.testRowDivider, { backgroundColor: colors.border }]} />
              <View style={[styles.testLockedGroupHead, { opacity: 0.65 }]}>
                <ThemedText style={[styles.mono, { color: colors.textHint, fontSize: 9 }]}>
                  // COMING SOON · เร็วๆ นี้
                </ThemedText>
              </View>
              <TestRow
                icon={<FiGrid size={20} color={colors.textHint} strokeWidth={2} />}
                title="ปรนัย"
                hint="MULTIPLE CHOICE"
                colors={colors}
                locked
              />
              <View style={[styles.testRowDivider, { backgroundColor: colors.border }]} />
              <TestRow
                icon={<FiEdit3 size={20} color={colors.textHint} strokeWidth={2} />}
                title="เขียนตามคำบอก"
                hint="DICTATION"
                colors={colors}
                locked
              />
            </View>
          </View>

          {/* Divider between TEST and ANALYTICS sections — marks the
              "actions above, metrics below" boundary. */}
          <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />

          {/* ════════════════════════════════════════════════════════════════
              ANALYTICS · below the action sections.
              Stats grid + last-studied/streak + sample card + mastery
              breakdown. Moved down per user direction so action CTAs
              (Memorize / Test) sit above the fold.
              ════════════════════════════════════════════════════════════════ */}

          {/* ── 3-stat grid: TOTAL / DUE / MASTERED ── */}
          <View style={[styles.statGrid, isCompact && { gap: Spacing.two }]}>
            <StatTile
              label="TOTAL · ทั้งหมด"
              num={stats.total}
              meta="CARDS"
              colors={colors}
            />
            <StatTile
              label="DUE · วันนี้"
              num={stats.due}
              meta={stats.due > 0 ? `≈ ${Math.max(1, Math.round(stats.due * 0.5))} MIN` : '— —'}
              colors={colors}
              highlighted
            />
            <StatTile
              label="MASTERED"
              num={stats.mastered}
              meta={stats.total > 0 ? `${Math.round((stats.mastered / stats.total) * 100)}%` : '—'}
              colors={colors}
            />
          </View>

          {/* ── Last studied + streak rows ── */}
          {(lastSessionMeta || streak.current > 0) && (
            <View style={[styles.listCard, { borderColor: colors.border }]}>
              {lastSessionMeta && (
                <View style={[styles.listRow, { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                  <View style={[styles.rowIcn, { borderColor: colors.border }]}>
                    <FiClock size={14} color={colors.textSecondary} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <ThemedText style={[styles.mono, { color: colors.textHint, fontSize: 10 }]}>
                      LAST STUDIED · ทบทวนล่าสุด
                    </ThemedText>
                    <ThemedText type="default">{formatRelative(lastSessionMeta.endedAt)} · {lastSessionMeta.cards} cards</ThemedText>
                  </View>
                </View>
              )}
              {streak.current > 0 && (
                <View style={styles.listRow}>
                  <View style={[styles.rowIcn, { borderColor: colors.border }]}>
                    <FiFlag size={14} color={Accent.base} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <ThemedText style={[styles.mono, { color: colors.textHint, fontSize: 10 }]}>
                      STREAK · ต่อเนื่อง
                    </ThemedText>
                    <ThemedText type="default">{streak.current} วัน · ทำต่อเพื่อรักษา</ThemedText>
                  </View>
                  <ThemedText style={[styles.streakNum, { color: Accent.base }]}>
                    {String(streak.current).padStart(2, '0')}
                  </ThemedText>
                </View>
              )}
            </View>
          )}

          {/* ── Sample card preview ── */}
          {sampleEntry && (
            <View style={{ gap: Spacing.two }}>
              <View style={styles.secLabel}>
                <View style={[styles.pip, { backgroundColor: Accent.base }]} />
                <ThemedText style={[styles.mono, { color: colors.textHint, fontSize: 10 }]}>
                  SAMPLE CARD · ตัวอย่างบัตร
                </ThemedText>
                <View style={{ flex: 1 }} />
                <ThemedText style={[styles.mono, { color: colors.textHint, fontSize: 10 }]}>
                  {`// 01 / ${entries.length}`}
                </ThemedText>
              </View>
              <MiniCard entry={sampleEntry} colors={colors} />
            </View>
          )}

          {/* ── Mastery breakdown ── */}
          {stats.total > 0 && (
            <View style={[styles.breakdown, { borderColor: colors.border }]}>
              <View style={styles.breakdownHeader}>
                <FiBarChart2 size={12} color={colors.text} strokeWidth={2} />
                <ThemedText style={[styles.mono, { color: colors.text, fontSize: 10 }]}>
                  MASTERY · ความเข้าใจ
                </ThemedText>
                <View style={{ flex: 1 }} />
                <ThemedText style={[styles.mono, { color: colors.textHint, fontSize: 10 }]}>
                  {`${stats.total} TOTAL${stats.newCount > 0 ? ` · ${stats.newCount} NEW` : ''}`}
                </ThemedText>
              </View>
              <BreakdownBar label="ลืม" count={stats.breakdown.again} total={stats.total} fg={rate.againFg} bgColor={colors.backgroundSelected} textColor={colors.text} />
              <BreakdownBar label="ยาก" count={stats.breakdown.hard} total={stats.total} fg={rate.hardFg} bgColor={colors.backgroundSelected} textColor={colors.text} />
              <BreakdownBar label="เข้าใจ" count={stats.breakdown.good} total={stats.total} fg={rate.goodFg} bgColor={colors.backgroundSelected} textColor={colors.text} />
              <BreakdownBar label="ง่าย" count={stats.breakdown.easy} total={stats.total} fg={Accent.base} bgColor={colors.backgroundSelected} textColor={colors.text} />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/* ─── Subcomponents ─────────────────────────────────────────────────── */

function StatTile({
  label,
  num,
  meta,
  colors,
  highlighted,
}: {
  label: string;
  num: number;
  meta: string;
  colors: typeof Colors.light;
  highlighted?: boolean;
}) {
  return (
    <View style={[styles.statTile, { borderColor: colors.border }]}>
      {highlighted && <View style={[styles.statStripe, { backgroundColor: Accent.base }]} />}
      <ThemedText style={[styles.statLbl, { color: colors.textHint }]}>{label}</ThemedText>
      <ThemedText style={[styles.statNum, { color: highlighted ? Accent.base : colors.text }]}>
        {num}
      </ThemedText>
      <ThemedText style={[styles.statMeta, { color: colors.textHint }]}>{meta}</ThemedText>
    </View>
  );
}

function TestRow({
  icon,
  title,
  hint,
  colors,
  onPress,
  accent,
  locked,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  colors: typeof Colors.light;
  onPress?: () => void;
  accent?: boolean;
  locked?: boolean;
}) {
  const Content = (
    <View style={styles.testRowInner}>
      <View style={[styles.testRowIcn, { borderColor: locked ? colors.border : (accent ? Accent.soft : colors.border), backgroundColor: locked ? 'transparent' : (accent ? Accent.bg : 'transparent') }]}>
        {icon}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText
          type="defaultSemiBold"
          style={locked ? { color: colors.textHint } : undefined}>
          {title}
        </ThemedText>
        <ThemedText type="small" themeColor={accent ? 'text' : 'textSecondary'} style={accent ? { color: Accent.base, fontWeight: '600' } : undefined}>
          {hint}
        </ThemedText>
      </View>
      {locked ? (
        <FiLock size={14} color={colors.textHint} strokeWidth={2} />
      ) : (
        <FiChevronRight size={16} color={colors.textSecondary} strokeWidth={2} />
      )}
    </View>
  );
  if (locked) {
    return <View style={[styles.testRow, { opacity: 0.65 }]}>{Content}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title} · ${hint}`}
      style={({ pressed }) => [styles.testRow, pressed && { opacity: 0.85 }]}>
      {Content}
    </Pressable>
  );
}

function BreakdownBar({
  label,
  count,
  total,
  fg,
  bgColor,
  textColor,
}: {
  label: string;
  count: number;
  total: number;
  fg: string;
  bgColor: string;
  textColor: string;
}) {
  /* min 4% visual so non-zero rows always show a sliver. Zero rows
     get 0% — empty visual rhythm matches design. */
  const pct = total > 0 ? Math.max(count > 0 ? 4 : 0, (count / total) * 100) : 0;
  return (
    <View style={styles.bdRow}>
      <ThemedText style={[styles.bdLabel, { color: fg }]}>{label}</ThemedText>
      <View style={[styles.bdBar, { backgroundColor: bgColor }]}>
        <View style={[styles.bdFill, { width: `${pct}%`, backgroundColor: fg }]} />
      </View>
      <ThemedText style={[styles.bdCount, { color: textColor }]}>{count}</ThemedText>
    </View>
  );
}

/* ─── Helpers ───────────────────────────────────────────────────────── */

function formatRelative(epochMs: number): string {
  const diff = Date.now() - epochMs;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'เมื่อกี้';
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} วันที่แล้ว`;
  return new Date(epochMs).toLocaleDateString('th-TH');
}

/* ─── Styles ────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  /* Container + safeArea = full-width so the ScrollView's scrollbar
     hugs the viewport's right edge (was clipped inside MaxContentWidth
     before — scrollbar floated mid-page). Content gets its maxWidth
     via per-element wrappers (headerBar + scrollContent). */
  container: { flex: 1 },
  safeArea: { flex: 1, width: '100%' },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  configBtn: {
    width: 32,
    height: 32,
    borderRadius: Radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
    /* Content stays within MaxContentWidth + centered; the ScrollView
       itself is full-width so the scrollbar hugs the viewport's right
       edge. */
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  /* ─── Hero ─── Vertical padding trimmed ~25% per GPT polish round
     2026-05-27: original Spacing.five (top) + Spacing.four (bottom) made
     sayata walk too far between header bar and stat grid below. Horizontal
     padding kept full; only V breathing room reduced. */
  hero: {
    position: 'relative',
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
    overflow: 'hidden',
    gap: Spacing.two,
  },
  heroStripe: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 3,
  },
  ghostKanji: {
    position: 'absolute',
    fontFamily: Platform.select({ web: '"Noto Serif JP", "Hiragino Mincho ProN", serif', default: undefined }),
    fontSize: 200,
    fontWeight: '300',
    opacity: 0.04,
    right: -20,
    top: -40,
    lineHeight: 200,
  },
  metaRow: {
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
  heroJp: {
    fontFamily: Platform.select({ web: '"Noto Serif JP", "Hiragino Mincho ProN", serif', default: undefined }),
    fontSize: 42,
    fontWeight: '300',
    letterSpacing: -1,
    lineHeight: 46,
    marginTop: Spacing.two,
  },
  heroSub: {
    fontFamily: Platform.select({ web: '"Oswald", sans-serif', default: undefined }),
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  pillRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.three,
    flexWrap: 'wrap',
  },
  pill: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderWidth: 1,
    borderRadius: 0,
  },
  pillHl: {},
  pillText: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  /* ─── Stat grid ─── */
  statGrid: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  statTile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radii.sm,
    padding: Spacing.three,
    gap: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  statStripe: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 2,
  },
  statLbl: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  statNum: {
    fontFamily: Platform.select({ web: '"Oswald", sans-serif', default: undefined }),
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 32,
  },
  statMeta: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  /* ─── List card ─── */
  listCard: {
    borderWidth: 1,
    borderRadius: Radii.sm,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rowIcn: {
    width: 28,
    height: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakNum: {
    fontFamily: Platform.select({ web: '"Oswald", sans-serif', default: undefined }),
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 0.5,
  },
  /* ─── Sample section label ─── */
  secLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  /* ─── Breakdown ─── */
  breakdown: {
    borderWidth: 1,
    borderRadius: Radii.sm,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  breakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  bdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  bdLabel: {
    width: 56,
    fontSize: 13,
    fontWeight: '600',
  },
  bdBar: {
    flex: 1,
    height: 8,
    borderRadius: 0,
    overflow: 'hidden',
  },
  bdFill: { height: '100%' },
  bdCount: {
    width: 28,
    textAlign: 'right',
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 12,
    fontWeight: '600',
  },
  /* ─── Practice sections (Memorize + Test) ─── */
  section: { gap: Spacing.two },
  /* Hairline between major sections (LEARN / TEST / ANALYTICS).
     Subtle editorial separator — color injected per-theme inline. */
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.two,
  },
  topStripe: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 3,
  },
  memorizeCard: {
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.four,
    position: 'relative',
    overflow: 'hidden',
  },
  memorizeBody: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  memorizeTitle: {
    fontFamily: Platform.select({ web: '"Oswald", sans-serif', default: undefined }),
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  testList: {
    borderWidth: 1,
    borderRadius: Radii.sm,
  },
  testRow: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  testRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  testRowIcn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testRowDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: Spacing.three,
  },
  /* Mini-header inside the TEST list separating shipped vs. coming-soon
     modes. Keeps the list visually grouped without breaking it into a
     full second card. GPT polish round 2026-05-27. */
  testLockedGroupHead: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
  },
});
