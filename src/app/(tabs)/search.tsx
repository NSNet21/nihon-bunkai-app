import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { FiSearch, FiX } from 'react-icons/fi';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FOCUS_SEARCH_EVENT } from '@/components/search-shortcut';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemePalette } from '@/context/theme';
import { useSearchIndex } from '@/hooks/use-search-index';
import { Accent, BottomTabInset, Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import type { ContentType, JlptLevel } from '@/data/types';
import type { SearchResult } from '@/lib/search-index';

const TYPE_LABEL: Record<ContentType, string> = {
  vocab: 'VOCAB',
  grammar: 'GRAMMAR',
  kanji: 'KANJI',
  glossary: 'GLOSSARY',
};

const SEARCH_DEBOUNCE_MS = 120;
/* No more visible cap — user requested the full match set surface so
   they can sweep through everything. FlashList still virtualizes
   render to ~20 visible rows at a time so the DOM stays light even
   with 1k+ matches. Cap kept at 10k as a hard safety so a degenerate
   wildcard query can't lock up Fuse on the largest corpora. */
const RESULT_HARD_CAP = 10_000;

export default function SearchScreen() {
  const router = useRouter();
  const c = useThemePalette();

  const { ready, totalEntries, allEntries, run } = useSearchIndex();

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  /* Debounce: avoid running Fuse on every keystroke. */
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  const hasQuery = debounced.trim().length > 0;

  /* Active filter result-set OR fall-through to the full corpus.
     When no query is active, every indexed entry is surfaced as a
     synthesized SearchResult (score 0, no matches) so the row
     renderer + FlashList stay on the same data shape — no branching
     in the list code path. */
  const results = useMemo(() => {
    if (!ready) return [];
    if (hasQuery) return run(debounced, RESULT_HARD_CAP);
    return allEntries.map((entry) => ({ entry, score: 0 }));
  }, [ready, hasQuery, debounced, run, allEntries]);
  const hasResults = results.length > 0;

  /* Auto-focus on mount + on Ctrl/⌘+K from anywhere (web only). */
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    inputRef.current?.focus();
    const onFocusEvent = () => inputRef.current?.focus();
    window.addEventListener(FOCUS_SEARCH_EVENT, onFocusEvent);
    return () => window.removeEventListener(FOCUS_SEARCH_EVENT, onFocusEvent);
  }, []);

  const openEntry = useCallback(
    (deckId: string, entryId: string) => {
      /* Search jump-through opens Quiz mode at the matched entry — the
         user came looking for that specific card, they want active study. */
      router.push(`/deck/${deckId}/quiz?entryId=${encodeURIComponent(entryId)}` as never);
    },
    [router],
  );

  /* Stable renderItem closure — FlashList recycles row instances, so a
     fresh inline arrow on every parent re-render would re-attach
     handlers per cell each frame. With useCallback the same closure
     reference is reused across renders. */
  const renderItem = useCallback(
    ({ item }: { item: SearchResult }) => (
      <ResultRow result={item} onPress={() => openEntry(item.entry.deckId, item.entry.id)} themeColor={c} />
    ),
    [c, openEntry],
  );

  return (
    <ThemedView style={styles.container}>
      {/* Ghost kanji 検 (search) — sticky background decoration. Mirrors
          Shop's muted scale (smaller than Browse main page since secondary
          surface). Lives at ThemedView root so it stays fixed while the
          result list scrolls. */}
      <ThemedText style={[styles.ghostKanji, { color: c.textHint }]}>
        検
      </ThemedText>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.headerWrap}>
          <ThemedText type="title">Search</ThemedText>

          <View
            style={[
              styles.inputRow,
              {
                backgroundColor: c.surface,
                borderColor: focused ? Accent.base : c.border,
              },
            ]}
          >
            {/* C: top 3px crimson bar slides in from left on focus. */}
            <View
              style={[
                styles.accentBar,
                Platform.OS === 'web'
                  ? ({
                      transform: focused ? 'scaleX(1)' : 'scaleX(0)',
                      transformOrigin: 'left center',
                      transition: 'transform 240ms cubic-bezier(0.4, 0, 0.2, 1)',
                    } as unknown as object)
                  : { transform: [{ scaleX: focused ? 1 : 0 }] },
                { pointerEvents: 'none' },
              ]}
            />
            <FiSearch size={18} color={focused ? Accent.base : c.textHint} />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="คำญี่ปุ่น · ความหมายไทย · เสียงอ่าน"
              placeholderTextColor={c.textHint}
              style={[styles.input, { color: c.text }]}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery('')} hitSlop={10} style={styles.clearBtn}>
                <FiX size={16} color={c.textHint} />
              </Pressable>
            ) : null}
          </View>

          {/* Loading hint — only while the index is still building.
              Once ready, the TotalStrip below carries the count for
              both the idle (all entries) and active-query states. */}
          {!ready && (
            <ThemedText type="small" themeColor="textHint">กำลังสร้าง index…</ThemedText>
          )}
          {/* Round-5 P1 — GPT round-4: "Keep minimal · ห้ามใส่ popular
              searches · เพิ่ม subtle hint แทน · muted mono tiny · ไม่ใช่
              onboarding/tutorial". One-line marginal annotation showing
              the kana/kanji/grammar shapes the index supports. Hidden
              once the user starts typing. */}
          {ready && !hasQuery && (
            <ThemedText style={[styles.queryHint, { color: c.textHint }]}>
              ลอง: 食べる · 一緒 · 〜ように
            </ThemedText>
          )}
        </View>

        {/* Total strip — left-aligned count above the result list.
            "ทั้งหมด N รายการ" reflects the full corpus when no query
            is active, or the matched subset when filtering. Always
            visible once the index is ready so the count is always one
            glance away. */}
        {ready && hasResults && (
          <View style={[styles.totalStrip, { borderBottomColor: c.border }]}>
            <ThemedText style={[styles.totalText, { color: c.textMuted }]}>
              ทั้งหมด <ThemedText style={[styles.totalNumber, { color: c.text }]}>{results.length.toLocaleString()}</ThemedText> รายการ
              {hasQuery && results.length !== totalEntries ? (
                <ThemedText style={[styles.totalText, { color: c.textHint }]}>
                  {' '}· จาก {totalEntries.toLocaleString()}
                </ThemedText>
              ) : null}
            </ThemedText>
          </View>
        )}

        <FlashList<SearchResult>
          data={results}
          keyExtractor={(r) => r.entry.id}
          contentContainerStyle={styles.listContent}
          renderItem={renderItem}
          /* drawDistance defines how far ABOVE + BELOW the viewport
             FlashList renders out cells, in CSS px. Tighter window =
             fewer mounted rows when scanning a long corpus. flash-list
             v2 auto-measures item size on its own, so no
             estimatedItemSize override is needed. */
          drawDistance={400}
          ListEmptyComponent={
            ready && hasQuery ? (
              <View style={styles.empty}>
                <ThemedText type="default" themeColor="textSecondary">
                  ไม่เจอ — ลองพิมพ์ใหม่
                </ThemedText>
              </View>
            ) : null
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

interface RowProps {
  result: SearchResult;
  onPress: () => void;
  themeColor: typeof Colors.light | typeof Colors.dark;
}

function ResultRow({ result, onPress, themeColor: c }: RowProps) {
  const { entry } = result;
  /* p is the expanded variants array; show the first reading (cleaned, no Kunyomi: prefix).
     Skip if it duplicates the term itself (kana entries where T == P). */
  const displayReading = entry.p[0] ?? '';
  const showP = displayReading && displayReading !== entry.t;

  /* 2-line scan layout — top line carries the Japanese term + type/
     level chrome (the entry's identity); bottom line carries the
     reading + Thai meaning (the lookup payload). Designed so the eye
     fixates once for identity then once for meaning. Numerals locked
     to 1 line each — long Thai definitions ellipsize at the right
     edge rather than forcing a third row that would break list rhythm. */
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? c.surface2 : 'transparent',
          borderBottomColor: c.border,
        },
      ]}
    >
      <View style={styles.rowTopLine}>
        <ThemedText style={[styles.term, { color: c.text }]} numberOfLines={1}>
          {entry.t}
        </ThemedText>
        <View style={styles.chips}>
          <Chip text={TYPE_LABEL[entry.type]} color={c} />
          {entry.level ? <Chip text={entry.level} color={c} accent /> : null}
        </View>
      </View>
      <View style={styles.rowBottomLine}>
        {showP ? (
          <ThemedText style={[styles.reading, { color: c.textHint }]} numberOfLines={1}>
            {displayReading}
          </ThemedText>
        ) : null}
        {entry.d ? (
          <ThemedText style={[styles.meaning, { color: c.textMuted }]} numberOfLines={1}>
            {entry.d}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

function Chip({ text, color: c, accent }: { text: string; color: typeof Colors.light | typeof Colors.dark; accent?: boolean }) {
  return (
    <View
      style={[
        styles.chip,
        {
          borderColor: accent ? Accent.base : c.border,
          backgroundColor: accent ? Accent.bg : c.surface2,
        },
      ]}
    >
      <ThemedText
        type="small"
        style={[styles.chipText, accent ? { color: Accent.base } : { color: c.textMuted }]}
      >
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  /* Ghost kanji backdrop — sticky, anchored to ThemedView root.
     Matches Shop's muted treatment (secondary surface, not the main
     Browse page which uses crimson + larger). */
  ghostKanji: {
    position: 'absolute',
    top: 40,
    right: -20,
    fontFamily: Platform.select({ web: '"Noto Serif JP", serif', default: undefined }),
    fontSize: 200,
    lineHeight: 200,
    opacity: 0.04,
    zIndex: 0,
    pointerEvents: 'none',
  } as any,
  headerWrap: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.three,
    height: 44,
    /* relative so the absolute accentBar anchors here. */
    position: 'relative',
    overflow: 'hidden',
    /* Smooth focus transition on web. */
    ...(Platform.OS === 'web'
      ? ({ transition: 'border-color 180ms ease' } as unknown as object)
      : null),
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Accent.base,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
    /* Strip native focus ring on web — replaced by crimson border + glow on parent. */
    ...(Platform.OS === 'web'
      ? ({ outlineStyle: 'none', outlineWidth: 0 } as unknown as object)
      : null),
  },
  clearBtn: { padding: 4 },
  /* Tiny marginal hint shown only on initial empty state — sits below
     the status line. Mixed Thai+JP so we stay on the default app
     font (mono Latin can't render JP), but smaller letter-spacing +
     fontSize keeps the "marginal annotation" feel GPT asked for. */
  queryHint: {
    fontSize: 11,
    letterSpacing: 0.4,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  empty: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  /* Total strip — sits between header cluster and result list, left-
     aligned per user spec ("ทั้งหมด N รายการ" aligned left). Editorial
     mono uppercase, thin bottom rule to separate from the list. */
  totalStrip: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  totalText: {
    fontFamily: Platform.select({ web: 'JetBrains Mono, monospace', default: undefined }),
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  totalNumber: {
    fontFamily: Platform.select({ web: 'JetBrains Mono, monospace', default: undefined }),
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  /* 2-line row — top line: term + chips, bottom line: reading + meaning.
     hairline bottom border separates rows without claiming the visual
     weight of a full surface fill. ~72px tall — matches FlashList's
     estimatedItemSize so the virtualization windows stay accurate. */
  row: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  rowTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  rowBottomLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.three,
  },
  term: { fontSize: 17, fontWeight: '500', flex: 1 },
  reading: {
    fontFamily: Platform.select({ web: 'JetBrains Mono, monospace', default: undefined }),
    fontSize: 12,
    minWidth: 60,
  },
  meaning: { fontSize: 13, flex: 1 },
  chips: { flexDirection: 'row', gap: Spacing.one, alignItems: 'center', flexShrink: 0 },
  chip: {
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  chipText: { fontSize: 10, letterSpacing: 0.8 },
});
