/**
 * Group Picker — /group-picker
 *
 * Transient multi-deck selection for "study several decks back-to-back"
 * in one Learn session. v1 scope (2026-05-27): Learn mode only — Quiz
 * mode is per-deck (session log + FSRS) and doesn't fit a transient
 * group. Picker survives session via `nb.group-selection` localStorage.
 *
 * Flow: tap decks → STUDY → /deck/__group__/memorize?ids=foo,bar,baz
 * Memorize reads `ids` query + merges entries via loadGroupEntriesAsync.
 *
 * Per design/handoff-app Screen 08 layout (but transient, not
 * persistent user-created groups — those depend on
 * [[app-crud-import-export-pending]] which is post-MVP).
 */

import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { FiCheck, FiChevronLeft, FiLayers, FiPlay } from 'react-icons/fi';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useThemePalette } from '@/context/theme';
import { useAllDecks } from '@/hooks/use-decks';
import { usePersistedState } from '@/hooks/use-persisted-state';
import { writeGroupSelection } from '@/lib/group-entries';
import type { Deck, JlptLevel } from '@/data/types';

type LevelKey = JlptLevel | 'GLOSSARY';

const LEVEL_ORDER: LevelKey[] = ['N5', 'N4', 'N3', 'N2', 'N1', 'GLOSSARY'];

const LEVEL_KANJI: Record<LevelKey, string> = {
  N5: '五',
  N4: '四',
  N3: '三',
  N2: '二',
  N1: '一',
  GLOSSARY: '辞',
};

function deckLevelKey(deck: Deck): LevelKey {
  if (deck.type === 'glossary') return 'GLOSSARY';
  return (deck.level ?? 'N5') as LevelKey;
}

export default function GroupPickerScreen() {
  const router = useRouter();
  const colors = useThemePalette();
  const insets = useSafeAreaInsets();
  const { decks } = useAllDecks();
  /* Selection lives as an array (JSON.stringify-friendly) but we expose a
     Set for O(1) toggles in the row click handler. */
  const [selectionList, setSelectionList] = usePersistedState<string[]>('group-selection', []);
  const selection = useMemo(() => new Set(selectionList), [selectionList]);

  /* Group decks by level for the sectioned list. Empty levels hidden. */
  const grouped = useMemo(() => {
    const map = new Map<LevelKey, Deck[]>();
    for (const deck of decks) {
      const key = deckLevelKey(deck);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(deck);
    }
    return LEVEL_ORDER
      .map((key) => ({ key, decks: map.get(key) ?? [] }))
      .filter((g) => g.decks.length > 0);
  }, [decks]);

  const totalCards = useMemo(() => {
    let total = 0;
    for (const deck of decks) {
      if (selection.has(deck.id)) total += deck.entryCount;
    }
    return total;
  }, [decks, selection]);

  const selectedCount = selection.size;

  function toggleDeck(id: string) {
    const next = new Set(selection);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectionList([...next]);
  }

  function clearAll() {
    setSelectionList([]);
  }

  function handleStudy() {
    if (selectedCount === 0) return;
    const ids = [...selection].join(',');
    /* Persist to the canonical key in addition to usePersistedState's own
       write — keeps lib/group-entries.ts read consistent with picker. */
    writeGroupSelection([...selection]);
    /* Path segment "__group__" is a sentinel — Memorize detects ids query
       and skips the single-deck data load (see memorize.tsx isGroupMode). */
    router.push(`/deck/__group__/memorize?ids=${encodeURIComponent(ids)}` as never);
  }

  function handleBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
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
              SELECT <ThemedText style={{ color: Accent.base }}>GROUP</ThemedText>
            </ThemedText>
          </View>
          {selectedCount > 0 && (
            <PressableScale
              onPress={clearAll}
              accessibilityRole="button"
              accessibilityLabel="ล้าง selection"
              style={[styles.clearBtn, { borderColor: colors.border }]}>
              <ThemedText style={[styles.clearLabel, { color: colors.textMuted }]}>CLEAR</ThemedText>
            </PressableScale>
          )}
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <ThemedText
            style={[styles.ghostKanji, { color: colors.textHint }]}
            pointerEvents="none">
            組
          </ThemedText>

          {/* Hero */}
          <View style={styles.heroBlock}>
            <View style={styles.kickerRow}>
              <View style={[styles.pip, { backgroundColor: Accent.base }]} />
              <ThemedText style={[styles.kicker, { color: colors.textMuted }]}>
                // GROUP STUDY · เรียนหลายชุดติดกัน
              </ThemedText>
            </View>
            <ThemedText style={[styles.headline, { color: colors.text }]}>
              เลือก{'\n'}
              <ThemedText style={[styles.headline, { color: Accent.base }]}>กลุ่ม.</ThemedText>
            </ThemedText>
            <ThemedText style={[styles.heroSub, { color: colors.textMuted }]}>
              รวมหลายชุดเป็น session เดียว{'\n'}
              ไม่ต้องเข้าออกทีละ pack
            </ThemedText>
          </View>

          {/* Grouped deck list */}
          {grouped.map((group) => {
            const groupSelected = group.decks.filter((d) => selection.has(d.id)).length;
            return (
              <View key={group.key} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <ThemedText style={[styles.sectionKanji, { color: colors.text }]}>
                    {LEVEL_KANJI[group.key]}
                  </ThemedText>
                  <ThemedText style={[styles.sectionLabel, { color: Accent.base }]}>
                    {group.key === 'GLOSSARY' ? 'GLOSSARY · 辞典' : group.key}
                  </ThemedText>
                  <View style={{ flex: 1 }} />
                  <ThemedText style={[styles.sectionMeta, { color: colors.textHint }]}>
                    {groupSelected}/{group.decks.length} decks
                  </ThemedText>
                </View>
                <View style={styles.deckList}>
                  {group.decks.map((deck) => {
                    const checked = selection.has(deck.id);
                    return (
                      <PressableScale
                        key={deck.id}
                        onPress={() => toggleDeck(deck.id)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked }}
                        accessibilityLabel={`เลือก ${deck.title}`}
                        style={[
                          styles.deckRow,
                          {
                            borderColor: checked ? Accent.base : colors.border,
                            backgroundColor: checked ? Accent.bg : colors.surface,
                          },
                        ]}>
                        <View style={styles.deckBody}>
                          <ThemedText style={[styles.deckTitle, { color: colors.text }]} numberOfLines={1}>
                            {deck.title}
                          </ThemedText>
                          <View style={styles.deckMeta}>
                            <FiLayers size={11} color={colors.textHint} strokeWidth={2} />
                            <ThemedText style={[styles.deckMetaText, { color: colors.textHint }]}>
                              {deck.entryCount} cards
                            </ThemedText>
                            {!deck.isFree && (
                              <View style={[styles.paidPill, { borderColor: Accent.base }]}>
                                <ThemedText style={[styles.paidPillText, { color: Accent.base }]}>PAID</ThemedText>
                              </View>
                            )}
                          </View>
                        </View>
                        <View
                          style={[
                            styles.checkbox,
                            {
                              borderColor: checked ? Accent.base : colors.border,
                              backgroundColor: checked ? Accent.base : 'transparent',
                            },
                          ]}>
                          {checked && <FiCheck size={14} color="#fff" strokeWidth={2.5} />}
                        </View>
                      </PressableScale>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Sticky CTA — disabled when nothing selected. */}
        <View
          style={[
            styles.footer,
            {
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, Spacing.three),
            },
          ]}>
          <View style={styles.footerSummary}>
            <ThemedText style={[styles.footerLabel, { color: colors.textHint }]}>
              SELECTION · เลือก
            </ThemedText>
            <ThemedText style={[styles.footerCount, { color: Accent.base }]}>
              {selectedCount} <ThemedText style={[styles.footerSub, { color: colors.textMuted }]}>{selectedCount === 0 ? 'decks' : selectedCount === 1 ? 'deck'  : 'decks'} · {totalCards} cards</ThemedText>
            </ThemedText>
          </View>
          <PressableScale
            onPress={handleStudy}
            disabled={selectedCount === 0}
            accessibilityRole="button"
            accessibilityLabel={`เริ่มเรียน ${selectedCount} ชุด`}
            style={[
              styles.ctaPrimary,
              {
                backgroundColor: selectedCount === 0 ? colors.border : Accent.base,
              },
              selectedCount === 0 && { opacity: 0.5 },
            ]}>
            <FiPlay size={14} color="#fff" strokeWidth={2.2} />
            <ThemedText style={styles.ctaLabel}>
              {selectedCount === 0 ? 'STUDY · เริ่ม' : `เริ่มเรียน · ${selectedCount} ชุด`}
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
  clearBtn: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Radii.sm,
    borderWidth: 1,
  },
  clearLabel: {
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
    fontSize: 220,
    lineHeight: 220,
    opacity: 0.04,
    zIndex: 0,
  },

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

  section: { gap: Spacing.two, zIndex: 1 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sectionKanji: {
    fontFamily: Platform.select({ web: '"Noto Serif JP", serif', default: undefined }),
    fontSize: 22,
    lineHeight: 24,
  },
  sectionLabel: {
    fontFamily: Platform.select({ web: '"Oswald", sans-serif', default: undefined }),
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  sectionMeta: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 10,
    letterSpacing: 1,
  },

  deckList: { gap: Spacing.one },
  deckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.sm,
    borderWidth: 1,
  },
  deckBody: { flex: 1, gap: 2 },
  deckTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  deckMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deckMetaText: {
    fontSize: 11,
  },
  paidPill: {
    marginLeft: 6,
    paddingVertical: 1,
    paddingHorizontal: 5,
    borderRadius: Radii.sm,
    borderWidth: 1,
  },
  paidPillText: {
    fontFamily: Platform.select({ web: '"Oswald", sans-serif', default: undefined }),
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: Radii.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    /* paddingBottom set inline (safe-area-aware) per round-3 verdict. */
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerSummary: { flex: 1 },
  footerLabel: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  footerCount: {
    fontFamily: Platform.select({ web: '"Oswald", sans-serif', default: undefined }),
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  footerSub: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.8,
  },

  ctaPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: Radii.md,
    minWidth: 140,
  },
  ctaLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
