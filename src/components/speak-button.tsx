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
 * Uses expo-speech's native onDone/onStopped/onError callbacks for the
 * playing-state feedback (no polling, no setInterval). mountedRef guards
 * the setState calls against the "callback fires after unmount" race —
 * speech keeps playing through a transient unmount (e.g. card flip), but
 * we don't try to update unmounted UI.
 */
export function SpeakButton({ text, language, colors, size = 'sm' }: Props) {
  const [playing, setPlaying] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      /* Don't stop on unmount — flipping the card unmounts the button
         transiently; we want the utterance to keep playing through. */
    };
  }, []);

  function onPress(e: any) {
    e.stopPropagation?.();
    setPlaying(true);
    const reset = () => { if (mountedRef.current) setPlaying(false); };
    speak(text, language, { onDone: reset, onStopped: reset, onError: reset });
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
