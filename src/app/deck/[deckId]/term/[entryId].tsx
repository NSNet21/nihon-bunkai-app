import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { FiChevronLeft, FiChevronRight, FiEdit3, FiHome, FiLayers, FiMoreVertical, FiSliders, FiTrash2, FiX } from 'react-icons/fi';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Flashcard, VisibilityPopup, type ColumnVisibility, type FrontHero } from '@/components/flashcard';
import { QuickDeckSwitcher } from '@/components/quick-deck-switcher';
import { StudyMobileBackButton } from '@/components/study-mobile-back-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useThemeColors } from '@/context/theme';
import type { Deck, Entry } from '@/data/types';
import { entriesForDeckAsync, useAllDecks } from '@/hooks/use-decks';
import { useHasHydrated } from '@/hooks/use-has-hydrated';
import { usePersistedState } from '@/hooks/use-persisted-state';
import {
  CARD_VISIBILITY_STORAGE_KEY,
  DEFAULT_CARD_VISIBILITY,
  DEFAULT_FRONT_HERO,
  FRONT_HERO_STORAGE_KEY,
  applyCardVisibilityToggle,
  visibleBackCount,
  visibleFrontCount,
} from '@/lib/card-display-config';
import { deleteAvailability, deleteUserDeck } from '@/lib/deck-actions';
import { resolveFirstEntryJump } from '@/lib/deck-jump';
import { studyFallbackHref } from '@/lib/navigation-back';

export default function TermCardDisplayScreen() {
  const { deckId, entryId } = useLocalSearchParams<{ deckId?: string; entryId?: string }>();
  const router = useRouter();
  const { colors } = useThemeColors();
  const { width, height } = useWindowDimensions();
  const hasHydrated = useHasHydrated();
  const backFallbackHref = studyFallbackHref(deckId);
  const showHeaderBack = !hasHydrated || width >= 768;
  const isMobileLayout = hasHydrated && width < 768;
  const isTabletLayout = hasHydrated && width >= 768 && width < 1024;

  const { decks: allDecks } = useAllDecks();
  const deck = deckId ? allDecks.find((d) => d.id === deckId) : undefined;
  const [entries, setEntries] = useState<Entry[]>([]);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switcherMessage, setSwitcherMessage] = useState<string | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [visibility, setVisibility] = usePersistedState<ColumnVisibility>(
    CARD_VISIBILITY_STORAGE_KEY,
    DEFAULT_CARD_VISIBILITY,
  );
  const [frontHero, setFrontHero] = usePersistedState<FrontHero>(FRONT_HERO_STORAGE_KEY, DEFAULT_FRONT_HERO);
  const visibleFrontColumns = visibleFrontCount(visibility);
  const visibleBackColumns = visibleBackCount(visibility);
  const toggleColumn = (key: keyof ColumnVisibility) => {
    const next = applyCardVisibilityToggle(visibility, key, frontHero);
    setVisibility(next.visibility);
    setFrontHero(next.frontHero);
  };

  useEffect(() => {
    if (!deckId) return;
    let cancelled = false;
    void entriesForDeckAsync(deckId).then((rows) => {
      if (!cancelled) setEntries(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [deckId]);

  const index = useMemo(() => entries.findIndex((entry) => entry.id === entryId), [entries, entryId]);
  const current = index >= 0 ? entries[index] : undefined;
  const prev = index > 0 ? entries[index - 1] : undefined;
  const next = index >= 0 && index < entries.length - 1 ? entries[index + 1] : undefined;
  const deleteState = deck ? deleteAvailability(deck) : { enabled: false, reason: 'ยังไม่ได้เลือก deck' };
  const cardSlotHeight = isMobileLayout
    ? Math.max(340, Math.min(520, height - 258))
    : isTabletLayout
      ? Math.max(460, Math.min(700, height - 250))
      : Math.max(320, Math.min(620, height - (showHeaderBack ? 320 : 308)));

  function goEntry(entry: Entry) {
    if (!deckId) return;
    setIsFlipped(false);
    router.replace(`/deck/${deckId}/term/${entry.id}` as never);
  }

  async function handleSelectDeck(nextDeck: Deck) {
    if (nextDeck.id === deckId) return;
    setSwitcherMessage(null);
    const nextEntries = await entriesForDeckAsync(nextDeck.id);
    const jump = resolveFirstEntryJump(nextDeck.id, nextEntries);
    if (!jump.ok) {
      setSwitcherMessage(jump.reason);
      return;
    }
    setSwitcherOpen(false);
    setIsFlipped(false);
    router.replace(jump.href as never);
  }

  async function handleDeleteDeck() {
    if (!deck || !deleteState.enabled) return;
    const deleted = await deleteUserDeck(deck);
    if (deleted) router.replace('/');
  }

  if (!deck || !current) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <Header backFallbackHref={backFallbackHref} colors={colors} />
          <View style={styles.centerFill}>
            <ThemedText type="title" style={styles.emptyTitle}>
              {!deck ? 'ไม่พบ Deck' : 'ไม่พบคำนี้'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyBody}>
              อาจถูกลบหรือ entry ID ไม่ถูกต้อง · ลองกลับไปหน้า deck แล้วเลือกใหม่
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <MobileHomeButton colors={colors} />
        <StudyMobileBackButton fallbackHref={backFallbackHref} side="right" />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            isMobileLayout && styles.scrollContentMobile,
            isTabletLayout && styles.scrollContentTablet,
          ]}
          showsVerticalScrollIndicator>
          {showHeaderBack ? <Header backFallbackHref={backFallbackHref} colors={colors} /> : null}
          {!showHeaderBack ? <View style={styles.mobileBackSpacer} /> : null}

          <View style={styles.termToolbar}>
            <View style={styles.metaLeft}>
              <View style={[styles.pip, { backgroundColor: Accent.base }]} />
              <ThemedText style={[styles.mono, { color: colors.textHint }]}>
                {`// TERM ${String(index + 1).padStart(2, '0')} / ${entries.length}`}
              </ThemedText>
            </View>
            <View style={styles.toolbarActions}>
              <Pressable
                onPress={() => setConfigOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="ตั้งค่าการแสดงผลการ์ด"
                style={({ pressed, hovered }: any) => [
                  styles.iconBtn,
                  { borderColor: colors.border, backgroundColor: colors.backgroundElement },
                  (pressed || hovered) && { borderColor: Accent.soft },
                  pressed && { opacity: 0.75 },
              ]}>
                <FiSliders size={16} color={colors.text} strokeWidth={2} />
              </Pressable>
              <Pressable
                onPress={() => {
                  setSwitcherMessage(null);
                  setSwitcherOpen(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="สลับ deck"
                style={({ pressed, hovered }: any) => [
                  styles.iconBtn,
                  { borderColor: colors.border, backgroundColor: colors.backgroundElement },
                  (pressed || hovered) && { borderColor: Accent.soft },
                  pressed && { opacity: 0.75 },
                ]}>
                <FiLayers size={16} color={colors.text} strokeWidth={2} />
              </Pressable>
              <Pressable
                onPress={() => setActionsOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="เปิดเมนูคำนี้"
                style={({ pressed, hovered }: any) => [
                  styles.iconBtn,
                  { borderColor: colors.border, backgroundColor: colors.backgroundElement },
                  (pressed || hovered) && { borderColor: Accent.soft },
                  pressed && { opacity: 0.75 },
                ]}>
                <FiMoreVertical size={16} color={colors.text} strokeWidth={2} />
              </Pressable>
            </View>
          </View>

          <View style={[styles.cardSlot, { height: cardSlotHeight }]}>
            <Flashcard
              entry={current}
              isFlipped={isFlipped}
              onFlip={() => setIsFlipped((flipped) => !flipped)}
              visibility={visibility}
              frontHero={frontHero}
              index={index}
              total={entries.length}
              deckTitle={deck.title}
              onSwipeNext={next ? () => goEntry(next) : undefined}
              onSwipePrev={prev ? () => goEntry(prev) : undefined}
              canSwipeNext={Boolean(next)}
              canSwipePrev={Boolean(prev)}
            />
          </View>

          <View style={[styles.stickyNav, isTabletLayout && styles.stickyNavTablet, { borderTopColor: colors.border }]}>
            <NavButton direction="prev" entry={prev} colors={colors} onPress={() => prev && goEntry(prev)} />
            <ThemedText style={[styles.navCounter, { color: colors.textSecondary }]}>
              {`${index + 1} / ${entries.length}`}
            </ThemedText>
            <NavButton direction="next" entry={next} colors={colors} onPress={() => next && goEntry(next)} />
          </View>
        </ScrollView>

        <ActionsModal
          visible={actionsOpen}
          onClose={() => setActionsOpen(false)}
          colors={colors}
          deleteState={deleteState}
          onDelete={handleDeleteDeck}
        />
        <QuickDeckSwitcher
          visible={switcherOpen}
          decks={allDecks}
          currentDeckId={deckId}
          message={switcherMessage}
          colors={colors}
          onClose={() => setSwitcherOpen(false)}
          onSelectDeck={handleSelectDeck}
        />
        <VisibilityPopup
          visible={configOpen}
          onClose={() => setConfigOpen(false)}
          visibility={visibility}
          onToggle={toggleColumn}
          colors={colors}
          visibleFrontCount={visibleFrontColumns}
          visibleBackCount={visibleBackColumns}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function Header({ backFallbackHref, colors }: { backFallbackHref: string; colors: typeof Colors.light }) {
  return (
    <View style={styles.headerBar}>
      <Link href={backFallbackHref as never} asChild>
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
  );
}

function MobileHomeButton({ colors }: { colors: typeof Colors.light }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const hasHydrated = useHasHydrated();
  const isMobile = hasHydrated && width < 768;

  if (!isMobile) return null;

  return (
    <Pressable
      onPress={() => router.push('/' as never)}
      accessibilityRole="link"
      accessibilityLabel="กลับ Browse"
      style={({ pressed, hovered }: any) => [
        styles.mobileHomeBtn,
        {
          backgroundColor: colors.background,
          borderColor: pressed || hovered ? Accent.base : colors.border,
        },
        pressed && { opacity: 0.78 },
      ]}>
      {({ pressed, hovered }: any) => {
        const active = pressed || hovered;
        const fg = active ? Accent.base : colors.textSecondary;
        return (
          <>
            <View style={[styles.mobileHomeStripe, { opacity: active ? 1 : 0.58 }]} />
            <View style={styles.mobileHomeInner}>
              <FiHome size={14} color={fg} strokeWidth={2} />
              <ThemedText style={[styles.mobileHomeLabel, { color: active ? Accent.base : colors.text }]}>
                BROWSE
              </ThemedText>
            </View>
          </>
        );
      }}
    </Pressable>
  );
}

function NavButton({
  direction,
  entry,
  colors,
  onPress,
}: {
  direction: 'prev' | 'next';
  entry?: Entry;
  colors: typeof Colors.light;
  onPress: () => void;
}) {
  const isPrev = direction === 'prev';
  const Icon = isPrev ? FiChevronLeft : FiChevronRight;
  return (
    <Pressable
      onPress={onPress}
      disabled={!entry}
      accessibilityRole="button"
      accessibilityLabel={isPrev ? 'คำก่อนหน้า' : 'คำถัดไป'}
      style={({ pressed, hovered }: any) => [
        styles.navBtn,
        { borderColor: colors.border, backgroundColor: colors.backgroundElement, opacity: entry ? 1 : 0.35 },
        (pressed || hovered) && entry && { borderColor: Accent.soft, backgroundColor: colors.backgroundSelected },
        pressed && entry && { opacity: 0.78 },
      ]}>
      {isPrev ? <Icon size={16} color={colors.textSecondary} strokeWidth={2} /> : null}
      <View style={styles.navTextBlock}>
        <ThemedText style={[styles.mono, { color: colors.textHint }]}>
          {isPrev ? 'PREV' : 'NEXT'}
        </ThemedText>
        <ThemedText type="small" numberOfLines={1} style={{ color: colors.text }}>
          {entry?.t ?? '—'}
        </ThemedText>
      </View>
      {!isPrev ? <Icon size={16} color={colors.textSecondary} strokeWidth={2} /> : null}
    </Pressable>
  );
}

function ActionsModal({
  visible,
  onClose,
  colors,
  deleteState,
  onDelete,
}: {
  visible: boolean;
  onClose: () => void;
  colors: typeof Colors.light;
  deleteState: { enabled: boolean; reason: string };
  onDelete: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          onPress={(event: any) => event.stopPropagation?.()}
          style={[styles.modalCard, { borderColor: colors.border, backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <ThemedText style={[styles.mono, { color: colors.textHint }]}>
              // TERM ACTIONS
            </ThemedText>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="ปิดเมนู"
              style={[styles.iconBtn, { borderColor: colors.border }]}>
              <FiX size={16} color={colors.text} strokeWidth={2} />
            </Pressable>
          </View>

          <View style={styles.actionStack}>
            <View style={[styles.actionRow, { borderColor: colors.border, opacity: 0.48 }]}>
              <FiEdit3 size={18} color={colors.textHint} strokeWidth={2} />
              <View style={styles.actionText}>
                <ThemedText type="defaultSemiBold" themeColor="textSecondary">
                  แก้ไขคำนี้
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  จะเปิดพร้อม Personal Edit
                </ThemedText>
              </View>
            </View>

            <Pressable
              onPress={deleteState.enabled ? onDelete : undefined}
              disabled={!deleteState.enabled}
              accessibilityRole="button"
              accessibilityLabel="ลบ deck"
              style={({ pressed }) => [
                styles.actionRow,
                { borderColor: deleteState.enabled ? Accent.soft : colors.border },
                !deleteState.enabled && { opacity: 0.52 },
                pressed && deleteState.enabled && { opacity: 0.75 },
              ]}>
              <FiTrash2 size={18} color={deleteState.enabled ? Accent.base : colors.textHint} strokeWidth={2} />
              <View style={styles.actionText}>
                <ThemedText
                  type="defaultSemiBold"
                  style={{ color: deleteState.enabled ? Accent.base : colors.textSecondary }}>
                  ลบ deck
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {deleteState.reason}
                </ThemedText>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  scrollContentMobile: {
    paddingBottom: Spacing.two,
  },
  scrollContentTablet: {
    paddingBottom: Spacing.two,
    gap: Spacing.three,
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
  mobileBackSpacer: {
    height: 58,
  },
  mobileHomeBtn: {
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.two,
    zIndex: 50,
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderColor: Accent.soft,
    borderRadius: Radii.sm,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? ({ userSelect: 'none' } as any) : null),
  },
  mobileHomeStripe: {
    width: 3,
    alignSelf: 'stretch',
    backgroundColor: Accent.base,
  },
  mobileHomeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  mobileHomeLabel: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptyBody: {
    textAlign: 'center',
    maxWidth: 340,
  },
  termToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minWidth: 0,
    flex: 1,
  },
  pip: { width: 5, height: 5 },
  mono: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  cardSlot: {
    minHeight: 320,
  },
  stickyNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
  },
  stickyNavTablet: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  navCounter: {
    minWidth: 56,
    textAlign: 'center',
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 11,
    fontWeight: '700',
  },
  navBtn: {
    flex: 1,
    minHeight: 58,
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  navTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.four,
    gap: Spacing.four,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  actionStack: {
    gap: Spacing.two,
  },
  actionRow: {
    minHeight: 68,
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  actionText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
