import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { FiVolume2 } from 'react-icons/fi';

import { Accent, Colors, Radii, Spacing } from '@/constants/theme';
import { speak, stop, type SpeakLang } from '@/lib/tts';

type Props = {
  text: string;
  language: SpeakLang;
  colors: typeof Colors.light;
  /** Visual scale — 'sm' for inline next to text, 'md' for standalone. */
  size?: 'sm' | 'md';
};

/**
 * Tap the speaker icon to read the adjacent text aloud via expo-speech.
 * Subsequent taps interrupt the in-flight utterance and restart — predictable
 * behavior matching every consumer speaker UI (Onevoca, Quizlet, etc.).
 *
 * Tracks a local `playing` flag for the icon-tint feedback. Polls
 * `isSpeakingAsync` after kicking off speech because expo-speech doesn't
 * fire callbacks on every backend (web in particular fires onEnd reliably
 * but onStart can be delayed by user-gesture/voice-load latency).
 */
export function SpeakButton({ text, language, colors, size = 'sm' }: Props) {
  const [playing, setPlaying] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      /* Don't stop on unmount — flipping the card unmounts the button
         transiently; we want the utterance to keep playing through. */
    };
  }, []);

  function onPress(e: any) {
    e.stopPropagation?.();
    speak(text, language);
    setPlaying(true);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const stillSpeaking = await import('@/lib/tts').then((m) => m.isSpeakingAsync());
      if (!stillSpeaking) {
        setPlaying(false);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    }, 150);
  }

  const iconSize = size === 'md' ? 18 : 14;
  const dim = size === 'md' ? 32 : 24;
  const color = playing ? Accent.base : colors.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`อ่านออกเสียง ${language === 'ja-JP' ? 'ภาษาญี่ปุ่น' : 'ภาษาไทย'}`}
      style={({ pressed }) => [
        styles.btn,
        { width: dim, height: dim, borderColor: colors.border },
        pressed && styles.pressed,
      ]}>
      <FiVolume2 size={iconSize} color={color} strokeWidth={2} />
    </Pressable>
  );
}

/* Side helper — stop any current utterance (e.g. when navigating away). */
export function stopSpeaking() {
  stop();
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radii.sm,
    backgroundColor: 'transparent',
    padding: Spacing.half,
  },
  pressed: { opacity: 0.7 },
});
