/**
 * Global ⌘/Ctrl+K shortcut → jump to /search.
 *
 * Web only (desktop keyboards). Mobile + tablet touch users use the tab bar.
 * iPad/tablet with a hardware keyboard naturally still works — we don't
 * gate by viewport because that would miss bluetooth-paired tablets.
 *
 * Mount once at the root (under _layout). Listener is on window, so it
 * fires from any screen and pulls the user into Search.
 */

import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

export function SearchShortcut() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    function onKeydown(e: KeyboardEvent) {
      /* Use e.code (physical key) — survives Thai/JP keyboard layouts where e.key changes. */
      const isK = e.code === 'KeyK';
      const withMod = e.ctrlKey || e.metaKey;
      if (!isK || !withMod) return;
      e.preventDefault();
      router.push('/(tabs)/search');
      /* Tell the search screen to grab the input — works even when route is already active.
         Dispatched after navigate so the search screen is mounted by the time it fires. */
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event(FOCUS_SEARCH_EVENT));
      });
    }

    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, [router]);

  return null;
}

/** Window event name — fired by Ctrl/⌘+K, listened to by the search input. */
export const FOCUS_SEARCH_EVENT = 'nb:focus-search';
