import * as Speech from 'expo-speech';

/**
 * Thin wrapper around expo-speech. Always cancels the in-flight utterance
 * before starting a new one — prevents queue buildup if the user mashes
 * the speaker icon. Same call on the same text effectively restarts.
 *
 * `language` uses BCP-47 codes — 'ja-JP' for Japanese, 'th-TH' for Thai.
 * If the browser/OS has no matching voice, the engine falls back silently
 * to its default — text still plays but pronunciation will be off.
 */
export type SpeakLang = 'ja-JP' | 'th-TH';

export function speak(text: string, language: SpeakLang) {
  if (!text) return;
  /* Stop is fire-and-forget — safe to call even when nothing is speaking. */
  Speech.stop();
  Speech.speak(text, { language });
}

export function stop() {
  Speech.stop();
}

export function isSpeakingAsync() {
  return Speech.isSpeakingAsync();
}
