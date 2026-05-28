import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Rating } from 'ts-fsrs';

import { useThemeColors } from '@/context/theme';
import type { IntervalPreviews } from '@/lib/srs-scheduler';

import { PressableScale } from './pressable-scale';
import { ThemedText } from './themed-text';

import { Radii, RateColors, Spacing } from '@/constants/theme';

/* Compact breakpoint — below this, FSRS rating row tightens further so
   Thai labels + interval hints don't crash into each other on narrow
   phones. Quiz screen is a dynamic route (not statically pre-rendered),
   so useWindowDimensions is safe here w.r.t. SSR hydration. */
const COMPACT_BREAKPOINT = 480;

/** Map FSRS Rating enum → Thai microcopy + semantic color key.
 *  All 4 buttons equal width per GPT polish round-2 verdict 2026-05-27:
 *  the 1.15x emphasis on "เข้าใจ" (tried in round-1) was too subtle to
 *  read but enough to break the 4-button rhythm — fell into the "changed
 *  but not enough to feel" zone. Consistency wins. FSRS decision-making
 *  is too consequential to nudge with width. */
const BUTTONS = [
  { rating: Rating.Again, label: 'ลืม',     colorKey: 'again' as const },
  { rating: Rating.Hard,  label: 'ยาก',     colorKey: 'hard'  as const },
  { rating: Rating.Good,  label: 'เข้าใจ', colorKey: 'good'  as const },
  { rating: Rating.Easy,  label: 'ง่าย',   colorKey: 'easy'  as const },
];

type Props = {
  onRate: (rating: Rating) => void;
  disabled?: boolean;
  /** Round-5 P0 — optional FSRS scheduling preview (days each rating
   *  would schedule). When provided, each button shows a tiny "+3D"
   *  hint below the label so the user sees the consequence of the
   *  choice (GPT round-4 "FSRS feels alive"). */
  intervals?: IntervalPreviews;
};

export function RatingButtons({ onRate, disabled = false, intervals }: Props) {
  const { scheme } = useThemeColors();
  const palette = RateColors[scheme];
  const { width } = useWindowDimensions();
  /* Gate via `width > 0` so any SSR pass (where Dimensions defaults to 0)
     resolves to the desktop sizing. Quiz isn't statically pre-rendered
     today, but this keeps the component hydration-safe if it ever gets
     reused on a route that is. */
  const isCompact = width > 0 && width < COMPACT_BREAKPOINT;

  return (
    <View style={[styles.row, isCompact && styles.rowCompact]} accessibilityRole="toolbar">
      {BUTTONS.map((btn) => {
        const fg = palette[`${btn.colorKey}Fg`];
        const bg = palette[`${btn.colorKey}Bg`];
        const days = intervals?.[btn.colorKey];
        return (
          <PressableScale
            key={btn.label}
            onPress={() => !disabled && onRate(btn.rating)}
            disabled={disabled}
            /* Lighter scale on FSRS rating buttons — these are pressed
               rapid-fire and full 0.985 reads as "jumpy" at high cadence. */
            scaleTo={0.99}
            opacityTo={0.9}
            style={[
              styles.button,
              isCompact && styles.buttonCompact,
              { backgroundColor: bg },
              disabled && styles.disabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              days !== undefined ? `${btn.label} · ${formatInterval(days)}` : btn.label
            }>
            <ThemedText style={[styles.label, isCompact && styles.labelCompact, { color: fg }]}>
              {btn.label}
            </ThemedText>
            {days !== undefined && (
              <ThemedText style={[styles.intervalHint, isCompact && styles.intervalHintCompact, { color: fg }]}>
                {formatInterval(days)}
              </ThemedText>
            )}
          </PressableScale>
        );
      })}
    </View>
  );
}

/** Format FSRS `scheduled_days` as a compact preview string. New cards in
 *  Learning state come back as fractional days (minutes/hours); review
 *  cards as integer days. We surface days/months/years with a `+` prefix
 *  matching GPT's "GOOD · +3D" example, and degrade short intervals to
 *  minutes/hours so the user sees "<10m" rather than "0D". */
function formatInterval(days: number): string {
  if (!Number.isFinite(days) || days <= 0) return '<1m';
  if (days < 1 / 1440) return '<1m';                                // < 1 minute
  if (days < 1 / 24) return `+${Math.round(days * 1440)}m`;         // minutes
  if (days < 1) return `+${Math.round(days * 24)}h`;                // hours
  if (days < 30) return `+${Math.round(days)}D`;
  if (days < 365) return `+${Math.round(days / 30)}M`;
  return `+${Math.round(days / 365)}Y`;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignSelf: 'stretch',
  },
  /* Tighter row gap on narrow phones (<480px) — 6px keeps the 4-button
     rhythm visible without each button losing usable tap area. */
  rowCompact: {
    gap: 6,
  },
  /* Default (desktop / tablet) sizing — slimmer than the old 12/44 spec
     so the row reads as a control strip rather than a 4-card block. */
  button: {
    flex: 1,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    /* Slight vertical gap between label and interval hint. */
    gap: 2,
  },
  /* Mobile sizing — 6px vertical padding + 32px minHeight stays inside
     iOS HIG's 32pt minimum for non-primary controls (FSRS rating is
     repetitive, not a one-shot CTA). */
  buttonCompact: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    minHeight: 32,
  },
  /* Label override — ThemedText's `defaultSemiBold` is 16/24 which made
     each button feel like a full chunk of UI. 14/20 with weight 600
     reads as decisive without dominating. */
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  /* Even tighter on phones to fit the 4-button row under 360px viewports
     where ThemedText 14 + interval 10 + gap was crashing into the row gap. */
  labelCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  /* Tiny mono interval preview below the label. Inherits the button's
     fg color but at ~60% opacity so it reads as a marginal annotation
     rather than competing with the label itself. */
  intervalHint: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.8,
    fontWeight: '600',
    opacity: 0.65,
  },
  intervalHintCompact: {
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 0.6,
  },
  disabled: { opacity: 0.35 },
});
