import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { FiArrowLeft, FiChevronLeft, FiChevronRight, FiSliders } from 'react-icons/fi';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type Grade, Rating } from 'ts-fsrs';

import {
  getCardState,
  getStreakMeta,
  makeEntryId,
  putCardState,
  putSessionLog,
  putStreakMeta,
  todayLocalDate,
} from '@/lib/srs-store';
import { scheduleCard } from '@/lib/srs-scheduler';
import { schedulePush } from '@/lib/srs-sync';
import { useAuth } from '@/context/auth';

import { Flashcard, VisibilityPopup, type ColumnVisibility, type FrontHero } from '@/components/flashcard';
import { RatingButtons } from '@/components/rating-buttons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useToast } from '@/components/toast';
import { Accent, BottomTabInset, Colors, MaxContentWidth, Radii, RateColors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePersistedState } from '@/hooks/use-persisted-state';
import { useAllDecks, entriesForDeckAsync } from '@/hooks/use-decks';
import type { Entry } from '@/data/types';
import type { LastSession } from '@/lib/last-session';

export default function StudyScreen() {
  const { deckId, entryId } = useLocalSearchParams<{ deckId?: string; entryId?: string }>();
  const { decks: allDecks } = useAllDecks();
  const deck = deckId ? allDecks.find((d) => d.id === deckId) : undefined;
  const [entries, setEntries] = useState<Entry[]>([]);
  const { showToast } = useToast();
  /* Sync layer (Phase C.4) — schedulePush coalesces local writes into a
     debounced batch upload to Supabase. Guest mode (no user) skips push
     entirely; local writes stay in pending_sync queue and drain on
     next sign-in. */
  const { user } = useAuth();
  /* Side rails — on narrow viewports they flip from inline (eating
     row-space) to absolute OVER the card edges, freeing the full row
     width for the card itself.

     Rail size only needs MILD viewport scaling since overlay mode
     already solves the "rails squeeze the card" problem. Floor raised
     from 0.65 → 0.82 (was over-shrinking icons on mobile down to
     36×36, awkward as a hit target). Now mobile = 52×46, desktop =
     64×56 — both feel right for their context. */
  const { width: viewportW } = useWindowDimensions();
  const railT = Math.max(0, Math.min(1, (viewportW - 360) / (1024 - 360)));
  const railScale = 0.82 + railT * 0.18;          // 0.82 → 1.0
  const railWidth = Math.round(64 * railScale);   // 52 → 64
  const railIcon = Math.round(56 * railScale);    // 46 → 56
  const overlayRails = viewportW < 600;
  /* On mobile, stretch the gradient OVERLAY wider than the Pressable's
     tap column so the fade range is generous. Tap area stays railWidth.
     GPT verdict 2026-05-26: 0.35×W (~136px on 390px viewport, 272 across
     both rails) was eating too much of card middle — only 118px left
     for tap-reveal. Pulled to 0.22×W cap 100 → mobile rails take ~86px
     each, ~218 across, leaves 170+px clean center for tap reveal. */
  const railFillWidth = overlayRails
    ? Math.min(Math.round(viewportW * 0.22), 100)
    : railWidth;

  useEffect(() => {
    // Reset session state on deck switch — fresh front-card start every time.
    setIndex(0);
    setIsFlipped(false);
    setResults([]);
    sessionIdRef.current = null;
    sessionStartedAtRef.current = null;

    let cancelled = false;
    if (!deckId) {
      setEntries([]);
      return;
    }
    void entriesForDeckAsync(deckId).then((rows) => {
      if (cancelled) return;
      setEntries(rows);
      // Jump to entryId if provided (from Search tap-through OR Continue card
      // restoring a prior session). If the entry no longer exists in this
      // deck (deleted, deck reordered, deep link expired), tell the user
      // instead of silently dumping them at index 0.
      if (entryId) {
        const jumpTo = rows.findIndex((r) => r.id === entryId);
        if (jumpTo >= 0) {
          setIndex(jumpTo);
        } else if (rows.length > 0) {
          showToast('ตัวการ์ดเดิมหาไม่เจอ เริ่มจากต้น', { kind: 'info' });
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [deckId, entryId, showToast]);

  const [index, setIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [results, setResults] = useState<Rating[]>([]);
  /* Session identity — created lazily on FIRST rating (so just opening a
     deck and walking away doesn't pollute the session log). Refs (not
     state) because we read them synchronously inside handlers + effects
     and never need to trigger re-render on assignment. Reset on deck
     switch + handleRestart. */
  const sessionIdRef = useRef<string | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);
  /* Column visibility — persisted globally (Settings ↔ per-card popup share
     the same source). Pf / Pb are independent: user might want P shown on
     back (as confirmation) while hidden on front (force recall). */
  const [visibility, setVisibility] = usePersistedState<ColumnVisibility>(
    'visibility',
    { t: true, pf: true, pb: true, d: true, e: true },
  );
  const [frontHero, setFrontHero] = usePersistedState<FrontHero>('front-hero', 't');
  const [, setLastSession] = usePersistedState<LastSession | null>('last-session', null);
  /* Card columns config — popup lifted out of the Flashcard 2026-05-26.
     Trigger now lives in the header (FiSliders button) so it's clear of
     the overlay-rail hit zone on mobile. Auto-swap hero when hiding the
     active hero column happens here too. */
  const [configOpen, setConfigOpen] = useState(false);
  const visibleFrontCount = (visibility.t ? 1 : 0) + (visibility.pf ? 1 : 0);
  const visibleBackCount = (visibility.d ? 1 : 0) + (visibility.pb ? 1 : 0) + (visibility.e ? 1 : 0);
  const toggleColumn = (key: keyof ColumnVisibility) => {
    const next = { ...visibility, [key]: !visibility[key] };
    /* Front face must keep at least one of T or Pf */
    if (!next.t && !next.pf) return;
    /* Back face must keep at least one of D, Pb, or E */
    if (!next.d && !next.pb && !next.e) return;
    /* Auto-swap hero if the column it points at just got hidden */
    if (key === 't' && !next.t && frontHero === 't' && next.pf) setFrontHero('p');
    if (key === 'pf' && !next.pf && frontHero === 'p' && next.t) setFrontHero('t');
    /* Auto-restore hero when the hidden column comes back. T is the
       natural hero (kanji/term) — its hiding always forces auto-swap to
       P (front face needs one column). Re-enabling T should reverse the
       swap so user returns to the T-as-hero default; without this, P
       stays stuck as hero + TTS reads P instead of the term. */
    if (key === 't' && next.t && frontHero === 'p' && !visibility.t) setFrontHero('t');
    setVisibility(next);
  };

  const scheme = useColorScheme();
  const colors = (scheme === 'dark' ? Colors.dark : Colors.light) as typeof Colors.light;

  const current = entries[index];
  const isComplete = entries.length > 0 && index >= entries.length;
  const canPrev = index > 0;
  const canNext = index < entries.length - 1;

  /* Persist study position so Browse can offer "Continue · {deck} · {idx}/{total}".
     Bail when there's no real entry (loading / empty / past-end / no deck). */
  useEffect(() => {
    if (!deck || !current || isComplete) return;
    setLastSession({
      deckId: deck.id,
      deckTitle: deck.title,
      entryId: current.id,
      index,
      total: entries.length,
      updatedAt: Date.now(),
    });
  }, [deck, current, index, entries.length, isComplete, setLastSession]);

  async function handleRate(rating: Rating) {
    /* Lazy-init session identity on FIRST rating. */
    if (sessionIdRef.current === null) {
      sessionIdRef.current = crypto.randomUUID();
      sessionStartedAtRef.current = Date.now();
    }

    /* Persist FSRS scheduling for this entry. Local Dexie write is
       atomic with pending_sync enqueue (see putCardState). If user is
       signed in + auto-sync on, schedulePush coalesces writes into a
       debounced batch upload. Guest user: write stays in queue + drains
       on next sign-in. Rating is always Grade subset (UI only emits
       Again/Hard/Good/Easy via RatingButtons — never Manual). */
    if (current && deck) {
      const entryId = makeEntryId(deck.id, current.no);
      const existing = await getCardState(entryId);
      const next = scheduleCard(existing, rating as Grade, entryId, deck.id);
      await putCardState(next);
      if (user) schedulePush(user.id);
    }

    setResults((prev) => [...prev, rating]);
    setIsFlipped(false);
    /* Finishing the deck retires the Continue CTA — Browse only shows it
       for sessions that still have cards left to study. */
    if (index >= entries.length - 1) setLastSession(null);
    setIndex((i) => i + 1);
  }

  function handlePrev() {
    if (!canPrev) return;
    setIsFlipped(false);
    setIndex((i) => i - 1);
  }

  function handleNext() {
    if (!canNext) return;
    setIsFlipped(false);
    setIndex((i) => i + 1);
  }

  function handleRestart() {
    /* New session identity on restart — same deck, fresh logging. */
    sessionIdRef.current = null;
    sessionStartedAtRef.current = null;
    setIndex(0);
    setIsFlipped(false);
    setResults([]);
  }

  /* When session completes, write a session_log + bump the streak.
     Runs once per completion (isComplete flips false → true). All writes
     are local Dexie; sync happens later (Phase C.4). */
  useEffect(() => {
    if (!isComplete || !deck || sessionIdRef.current === null || sessionStartedAtRef.current === null) {
      return;
    }
    const sessionId = sessionIdRef.current;
    const startedAt = sessionStartedAtRef.current;
    const endedAt = Date.now();
    const againCount = results.filter((r) => r === Rating.Again).length;
    const hardCount  = results.filter((r) => r === Rating.Hard).length;
    const goodCount  = results.filter((r) => r === Rating.Good).length;
    const easyCount  = results.filter((r) => r === Rating.Easy).length;
    const skippedCount = Math.max(0, entries.length - results.length);

    void (async () => {
      await putSessionLog({
        sessionId,
        deckId: deck.id,
        deckTitle: deck.title,
        totalCards: entries.length,
        startedAt,
        endedAt,
        ratings: results,
        againCount,
        hardCount,
        goodCount,
        easyCount,
        skippedCount,
      });

      /* Streak update — count today's session, advance/reset streak by
         whether last_studied_date == yesterday (continue) or further
         back (reset to 1). Cards-studied total adds ratings.length. */
      const today = todayLocalDate();
      const meta = await getStreakMeta();
      let nextCurrent = meta.currentStreak;
      if (meta.lastStudiedDate !== today) {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        const yesterday = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
        nextCurrent = meta.lastStudiedDate === yesterday ? meta.currentStreak + 1 : 1;
      }
      await putStreakMeta({
        currentStreak: nextCurrent,
        longestStreak: Math.max(meta.longestStreak, nextCurrent),
        lastStudiedDate: today,
        totalSessions: meta.totalSessions + 1,
        totalCardsStudied: meta.totalCardsStudied + results.length,
      });
      /* All session-complete writes done (session_log + streak_meta +
         all cards from handleRate) → schedule one batch push. Guest mode
         skips. */
      if (user) schedulePush(user.id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.content}>
          {!deck ? (
            <EmptyState
              title="ยังไม่ได้เลือก Deck"
              body="เลือก deck จากแท็บ Browse เพื่อเริ่มเรียน"
            />
          ) : entries.length === 0 ? (
            <EmptyState
              title={deck.title}
              body="Deck นี้ยังไม่มี entry — paid tier จะปลดล็อกหลังซื้อจาก nihon-bunkai-landing.pages.dev"
            />
          ) : isComplete ? (
            <SessionComplete
              deckTitle={deck.title}
              results={results}
              totalCards={entries.length}
              onRestart={handleRestart}
            />
          ) : (
            <>
              {/* Standalone BACK row — sits at the very top so the
                  affordance is reachable without parsing the title row.
                  Matches Memorize header pattern. */}
              <View style={styles.backRow}>
                <Link href="/" asChild>
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel="กลับ Browse"
                    style={styles.headerBackBtn}>
                    {({ pressed, hovered }) => {
                      const active = pressed || hovered;
                      return (
                        <>
                          <FiArrowLeft
                            size={18}
                            color={active ? Accent.base : colors.text}
                            strokeWidth={2}
                          />
                          <ThemedText
                            type="small"
                            style={{ color: active ? Accent.base : colors.textSecondary }}>
                            BACK
                          </ThemedText>
                        </>
                      );
                    }}
                  </Pressable>
                </Link>
              </View>

              {/* Title row — deck name + progress + config gear. */}
              <View style={styles.header}>
                <ThemedText type="defaultSemiBold" numberOfLines={1} style={{ flex: 1 }}>
                  {deck.title}
                </ThemedText>
                <View style={styles.headerRight}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {index + 1} / {entries.length}
                  </ThemedText>
                  <Pressable
                    onPress={() => setConfigOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel="ตั้งค่าการแสดงผลคอลัมน์"
                    style={({ pressed }) => [
                      styles.headerConfigBtn,
                      { borderColor: colors.border, backgroundColor: colors.background },
                      pressed && { opacity: 0.7 },
                    ]}>
                    <FiSliders size={16} color={colors.text} strokeWidth={2} />
                  </Pressable>
                </View>
              </View>
              <View style={styles.cardRow}>
                {!overlayRails && (
                  <SideRail
                    direction="left"
                    onPress={handlePrev}
                    disabled={!canPrev}
                    colors={colors}
                    width={railWidth}
                    iconSize={railIcon}
                  />
                )}
                <View style={styles.cardSlot}>
                  <Flashcard
                    entry={current}
                    isFlipped={isFlipped}
                    onFlip={() => setIsFlipped((f) => !f)}
                    visibility={visibility}
                    frontHero={frontHero}
                    index={index}
                    total={entries.length}
                    deckTitle={deck.title}
                    onSwipeNext={handleNext}
                    onSwipePrev={handlePrev}
                    canSwipeNext={canNext}
                    canSwipePrev={canPrev}
                  />
                  {/* Overlay rails on narrow viewports — both faces.
                      Idle opacity = 0 (fully transparent) so the icon
                      never visually fights with content. Press-down
                      reveals instantly; press-up fades back to fully
                      hidden. Tap area works regardless of opacity. */}
                  {overlayRails && (
                    <OverlayRailButton
                      direction="left"
                      side="left"
                      onPress={handlePrev}
                      disabled={!canPrev}
                      colors={colors}
                      width={railWidth}
                      iconSize={railIcon}
                      fillWidth={railFillWidth}
                      isDark={scheme === 'dark'}
                    />
                  )}
                  {overlayRails && (
                    <OverlayRailButton
                      direction="right"
                      side="right"
                      onPress={handleNext}
                      disabled={!canNext}
                      colors={colors}
                      width={railWidth}
                      iconSize={railIcon}
                      fillWidth={railFillWidth}
                      isDark={scheme === 'dark'}
                    />
                  )}
                </View>
                {!overlayRails && (
                  <SideRail
                    direction="right"
                    onPress={handleNext}
                    disabled={!canNext}
                    colors={colors}
                    width={railWidth}
                    iconSize={railIcon}
                  />
                )}
              </View>
              <RatingButtons onRate={handleRate} disabled={!isFlipped} />
              <BrandStrip colors={colors} />
              <VisibilityPopup
                visible={configOpen}
                onClose={() => setConfigOpen(false)}
                visibility={visibility}
                onToggle={toggleColumn}
                colors={colors}
                visibleFrontCount={visibleFrontCount}
                visibleBackCount={visibleBackCount}
              />
            </>
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

/** Editorial footer mark — anchors the study session in the brand. */
function BrandStrip({ colors }: { colors: typeof Colors.light }) {
  return (
    <View style={brandStyles.row} pointerEvents="none">
      <ThemedText style={[brandStyles.text, { color: colors.textHint }]}>
        NIHON BUNKAI · 鍛練精進
      </ThemedText>
    </View>
  );
}

function SideRail({
  direction,
  onPress,
  disabled,
  colors,
  width = 64,
  iconSize = 56,
}: {
  direction: 'left' | 'right';
  onPress: () => void;
  disabled: boolean;
  colors: typeof Colors.light;
  /** Continuous viewport-driven width — shrinks on mobile so the rails
   *  don't eat 40% of the card's horizontal space. Defaults preserve
   *  legacy desktop behavior. */
  width?: number;
  iconSize?: number;
}) {
  const Icon = direction === 'left' ? FiChevronLeft : FiChevronRight;
  const accessibilityLabel = direction === 'left' ? 'Previous card' : 'Next card';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        railStyles.button,
        { width },
        pressed && !disabled && railStyles.pressed,
        disabled && railStyles.disabled,
      ]}>
      <Icon size={iconSize} color={colors.textSecondary} strokeWidth={1.5} />
    </Pressable>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.center}>
      <ThemedText type="title">{title}</ThemedText>
      <ThemedText type="default" themeColor="textSecondary" style={styles.emptyBody}>
        {body}
      </ThemedText>
    </View>
  );
}

function SessionComplete({
  deckTitle,
  results,
  totalCards,
  onRestart,
}: {
  deckTitle: string;
  results: Rating[];
  /** Deck size. results.length may be < totalCards if user skipped some. */
  totalCards: number;
  onRestart: () => void;
}) {
  const scheme = useColorScheme();
  const colors = (scheme === 'dark' ? Colors.dark : Colors.light) as typeof Colors.light;
  const rate = scheme === 'dark' ? RateColors.dark : RateColors.light;

  const total = totalCards;
  const counts = {
    again: results.filter((r) => r === Rating.Again).length,
    hard:  results.filter((r) => r === Rating.Hard).length,
    good:  results.filter((r) => r === Rating.Good).length,
    easy:  results.filter((r) => r === Rating.Easy).length,
  };
  const gotIt = counts.good + counts.easy;
  /* Skipped = total - rated. Counts as "needs attention" (user hasn't
     committed a rating yet — still in the "un-mastered" bucket). */
  const skipped = Math.max(0, total - results.length);
  const needsReview = counts.again + counts.hard + skipped;
  /* Score % uses TOTAL as denominator (not results.length) — skipped
     cards drag the score down, which is honest signal that motivates
     the user to actually rate vs skip-through. */
  const scorePct = total > 0 ? Math.round((gotIt / total) * 100) : 0;
  /* Row bar widths — percentage of total, min 4% visual so an empty
     row still shows a sliver (helps the visual rhythm). */
  const pct = (n: number) => (total > 0 ? Math.max(n > 0 ? 4 : 0, (n / total) * 100) : 0);

  return (
    <ScrollView
      style={completeStyles.scroll}
      contentContainerStyle={completeStyles.content}
      showsVerticalScrollIndicator={false}>
      {/* Editorial header — crimson stripe + display title */}
      <View>
        <View style={[completeStyles.topStripe, { backgroundColor: Accent.base }]} />
        <View style={completeStyles.headerInner}>
          <ThemedText
            type="small"
            style={[completeStyles.monoLabel, { color: colors.textHint }]}>
            // SESSION COMPLETE
          </ThemedText>
          <ThemedText type="title" style={completeStyles.title}>
            เรียนจบแล้ว
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={completeStyles.deckLabel}>
            {deckTitle}
          </ThemedText>
        </View>
      </View>

      {/* Stat grid — 3 tiles. Middle tile (Score) is highlighted with crimson stripe. */}
      <View style={completeStyles.statGrid}>
        <View style={[completeStyles.tile, { borderColor: colors.border }]}>
          <ThemedText style={[completeStyles.tileLabel, { color: colors.textHint }]}>
            TOTAL · ทั้งหมด
          </ThemedText>
          <ThemedText style={[completeStyles.tileNum, { color: colors.text }]}>
            {total}
          </ThemedText>
          <ThemedText style={[completeStyles.tileMeta, { color: colors.textHint }]}>
            CARDS
          </ThemedText>
        </View>
        <View style={[completeStyles.tile, completeStyles.tileHl, { borderColor: colors.border }]}>
          <View style={[completeStyles.tileStripe, { backgroundColor: Accent.base }]} />
          <ThemedText style={[completeStyles.tileLabel, { color: colors.textHint }]}>
            SCORE · คะแนน
          </ThemedText>
          <ThemedText style={[completeStyles.tileNum, { color: Accent.base }]}>
            {scorePct}%
          </ThemedText>
          <ThemedText style={[completeStyles.tileMeta, { color: colors.textHint }]}>
            เข้าใจ + ง่าย
          </ThemedText>
        </View>
        <View style={[completeStyles.tile, { borderColor: colors.border }]}>
          <ThemedText style={[completeStyles.tileLabel, { color: colors.textHint }]}>
            REVIEW · ต้องทบทวน
          </ThemedText>
          <ThemedText style={[completeStyles.tileNum, { color: colors.text }]}>
            {needsReview}
          </ThemedText>
          <ThemedText style={[completeStyles.tileMeta, { color: colors.textHint }]}>
            CARDS
          </ThemedText>
        </View>
      </View>

      {/* Mastery breakdown — horizontal bars per rating */}
      <View style={[completeStyles.breakdown, { borderColor: colors.border }]}>
        <View style={completeStyles.breakdownHeader}>
          <ThemedText style={[completeStyles.monoLabel, { color: colors.textHint }]}>
            // BREAKDOWN · สรุปผล
          </ThemedText>
        </View>
        {[
          { key: 'again',   label: 'ลืม',    count: counts.again, fg: rate.againFg },
          { key: 'hard',    label: 'ยาก',    count: counts.hard,  fg: rate.hardFg },
          { key: 'good',    label: 'เข้าใจ', count: counts.good,  fg: rate.goodFg },
          { key: 'easy',    label: 'ง่าย',   count: counts.easy,  fg: Accent.base },
          /* Skipped row — shown only when > 0 to keep the chart clean
             on full-completion sessions. textHint color = visually
             "muted", reflects "you haven't decided yet". */
          ...(skipped > 0 ? [{ key: 'skipped', label: 'ข้าม',   count: skipped,      fg: colors.textHint }] : []),
        ].map((row) => (
          <View key={row.key} style={completeStyles.row}>
            <ThemedText style={[completeStyles.rowLabel, { color: row.fg }]}>
              {row.label}
            </ThemedText>
            <View style={[completeStyles.rowBar, { backgroundColor: colors.backgroundSelected }]}>
              <View style={[completeStyles.rowFill, { width: `${pct(row.count)}%`, backgroundColor: row.fg }]} />
            </View>
            <ThemedText style={[completeStyles.rowCount, { color: colors.text }]}>
              {row.count}
            </ThemedText>
          </View>
        ))}
      </View>

      {/* CTAs */}
      <View style={completeStyles.ctaStack}>
        <Pressable
          onPress={onRestart}
          accessibilityRole="button"
          accessibilityLabel="เรียนรอบใหม่ deck เดิม"
          style={({ pressed }) => [
            completeStyles.ctaPrimary,
            { backgroundColor: Accent.base },
            pressed && { opacity: 0.85 },
          ]}>
          <ThemedText style={completeStyles.ctaPrimaryText}>เรียนรอบใหม่</ThemedText>
        </Pressable>
        <Link href="/" asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="กลับไป Browse"
            style={({ pressed }) => [
              completeStyles.ctaSecondary,
              { borderColor: colors.border },
              pressed && { opacity: 0.85 },
            ]}>
            <ThemedText type="defaultSemiBold" themeColor="textSecondary">
              กลับไป Browse
            </ThemedText>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}

const completeStyles = StyleSheet.create({
  scroll: { flex: 1, alignSelf: 'stretch' },
  content: { gap: Spacing.five, paddingVertical: Spacing.four },
  topStripe: { height: 3 },
  headerInner: { paddingTop: Spacing.four, gap: Spacing.two },
  monoLabel: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  title: {
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  deckLabel: { fontSize: 14 },
  /* Stat grid — 3 columns equal width. Middle tile is highlighted. */
  statGrid: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  tile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radii.sm,
    padding: Spacing.three,
    gap: Spacing.one,
    position: 'relative',
    overflow: 'hidden',
  },
  tileHl: {},
  tileStripe: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 2,
  },
  tileLabel: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  tileNum: {
    fontFamily: Platform.select({ web: '"Oswald", sans-serif', default: undefined }),
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 34,
  },
  tileMeta: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 9,
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  /* Mastery breakdown */
  breakdown: {
    borderWidth: 1,
    borderRadius: Radii.sm,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  breakdownHeader: { marginBottom: Spacing.one },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rowLabel: {
    width: 56,
    fontSize: 13,
    fontWeight: '600',
  },
  rowBar: {
    flex: 1,
    height: 8,
    borderRadius: 0,
    overflow: 'hidden',
  },
  rowFill: {
    height: '100%',
  },
  rowCount: {
    width: 28,
    textAlign: 'right',
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 12,
    fontWeight: '600',
  },
  /* CTAs */
  ctaStack: { gap: Spacing.two, marginTop: Spacing.two },
  ctaPrimary: {
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.five,
    borderRadius: Radii.sm,
    alignItems: 'center',
  },
  ctaPrimaryText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  ctaSecondary: {
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.five,
    borderRadius: Radii.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  content: {
    flex: 1,
    padding: Spacing.four,
    paddingTop: Spacing.six + Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
  },
  /* Standalone BACK row at the very top, above the title row. */
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
  },
  headerBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  headerConfigBtn: {
    width: 32,
    height: 32,
    borderRadius: Radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  cardSlot: { flex: 1, alignSelf: 'stretch' },
  center: { flex: 1, gap: Spacing.three, alignItems: 'center', justifyContent: 'center' },
  emptyBody: { textAlign: 'center', maxWidth: 360 },
  completeActions: { gap: Spacing.two, marginTop: Spacing.four, alignItems: 'center' },
  restartBtn: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Accent.base,
  },
  linkBtn: {
    paddingVertical: Spacing.two,
  },
  pressed: { opacity: 0.7 },
});

const railStyles = StyleSheet.create({
  /* width supplied inline per-render so it can scale with viewport. */
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    backgroundColor: 'transparent',
  },
  pressed: { opacity: 0.5 },
  disabled: { opacity: 0.2 },
});

/* Overlay rail button — used on narrow viewports (<600px). Pressable
   spans the FULL card height so the user can stab anywhere on the
   left/right edge column without aiming at the small icon. Icon itself
   is hidden by default (opacity 0) and fades in on tap → holds briefly
   → fades out, so the chrome stays out of the way until the user asks
   for it. Tap area still works while invisible since Pressable hit-
   testing ignores opacity. zIndex 15 sits below cardOverlay (FootDots
   z=20 inside flashcard.tsx) so progress dots stay clean. */
const overlayRailStyles = StyleSheet.create({
  btn: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    zIndex: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  /* bgFill — wide gradient layer that extends INWARD past the Pressable
     bounds (mobile only) so the gradient fade range is generous, not
     compressed into the 52px tap column. Anchored to `[side]: 0` +
     explicit `width` via inline style; children = none. */
  bgFill: {
    position: 'absolute',
    top: 0, bottom: 0,
  },
  /* iconBox — sits inside the Pressable's actual bounds + centers the
     icon at the edge. Stacked on top of bgFill via render order. Both
     layers share the same opacity (Animated.View aStyle). */
  iconBox: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/** Hide-until-tapped chevron on the card edge. IDLE opacity 0 (fully
 *  transparent) — GPT had suggested 0.06 hint, but user feedback in
 *  testing showed even that faint trace fought with text on the back
 *  face. Cleaner to commit to "0 idle / press = visible / release fade
 *  to 0". Tap area still works since Pressable hit-testing ignores
 *  opacity. Discoverability is a trade-off taken on real-world feedback. */
const IDLE_OPACITY = 0;

function OverlayRailButton({
  direction,
  side,
  onPress,
  disabled,
  colors,
  width,
  iconSize,
  fillWidth,
  isDark,
}: {
  direction: 'left' | 'right';
  side: 'left' | 'right';
  onPress: () => void;
  disabled: boolean;
  colors: typeof Colors.light;
  width: number;
  iconSize: number;
  /** How wide the visible gradient layer is. Can exceed `width` (the
   *  Pressable's tap column) to give the fade more horizontal room. */
  fillWidth: number;
  /** Light theme needs DARK tint (white-on-cream is barely visible);
   *  dark theme needs WHITE tint. Caller passes the resolved scheme. */
  isDark: boolean;
}) {
  const opacity = useSharedValue(IDLE_OPACITY);
  const Icon = direction === 'left' ? FiChevronLeft : FiChevronRight;
  const ariaLabel = direction === 'left' ? 'Previous card' : 'Next card';

  /* Per-side + per-theme gradient:
       - Light: warm-charcoal tint (rgba(20,18,16,0.22)) — shows up as
         soft shadow on cream bg. Higher alpha than dark theme since
         dark-on-cream contrast is gentler than white-on-charcoal.
       - Dark: white tint (rgba(255,255,255,0.42)) — original.
     Gradient starts solid at the edge (`to right` for left, `to left`
     for right), fades to transparent toward card center.
     Native fallback: flat solid tint (no backgroundImage support). */
  const rgb = isDark ? '255, 255, 255' : '20, 18, 16';
  const peakAlpha = isDark ? 0.42 : 0.22;
  const direction_css = direction === 'left' ? 'to right' : 'to left';
  const overlayBg = Platform.select({
    web: {
      backgroundImage: `linear-gradient(${direction_css}, rgba(${rgb}, ${peakAlpha}) 0%, rgba(${rgb}, 0) 100%)`,
    } as object,
    default: { backgroundColor: `rgba(${rgb}, ${isDark ? 0.18 : 0.10})` },
  });

  function handlePressIn() {
    if (disabled) return;
    /* Cancel any in-flight fade-out, snap to fully visible. duration 0 =
       instant per Reanimated semantics — feels like a hard cut, matching
       finger-down. */
    opacity.value = withTiming(1, { duration: 0 });
  }

  function handlePressOut() {
    /* Gentle dismiss back to IDLE opacity (not full 0) — affordance
       remains barely perceptible. 90ms hold + 520ms fade. */
    opacity.value = withDelay(
      90,
      withTiming(IDLE_OPACITY, { duration: 520, easing: Easing.bezier(0.4, 0, 1, 1) }),
    );
  }

  function handlePress() {
    if (disabled) return;
    onPress();
  }

  const aStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={ariaLabel}
      style={[overlayRailStyles.btn, { [side]: 0, width }]}>
      {/* bgFill = wide gradient layer (can exceed Pressable bounds);
          iconBox = icon centered inside Pressable's actual bounds. */}
      <Animated.View
        style={[overlayRailStyles.bgFill, overlayBg, aStyle, { [side]: 0, width: fillWidth }]}
        pointerEvents="none"
      />
      <Animated.View style={[overlayRailStyles.iconBox, aStyle]} pointerEvents="none">
        <Icon size={iconSize} color={colors.textSecondary} strokeWidth={1.5} />
      </Animated.View>
    </Pressable>
  );
}

const brandStyles = StyleSheet.create({
  row: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.three,
  },
  text: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
});
