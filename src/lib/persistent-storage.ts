/**
 * Request persistent storage for IndexedDB.
 *
 * Without this, browsers may evict our paid-content cache when storage is low
 * (Chrome's "best effort" mode). With persist granted, the cache survives
 * until user explicitly clears it.
 *
 * Granting heuristics vary by browser:
 *   - Chrome/Edge: grants if site is bookmarked / added to home / engaged
 *   - Firefox: prompts user
 *   - Safari: rarely grants (its own LRU is aggressive); we offer save-to-device
 *
 * Web-only. No-op on native + when API is unavailable.
 */

let requested = false;

export async function requestPersistentStorage(): Promise<'granted' | 'denied' | 'unavailable'> {
  if (requested) return 'granted'; // dedupe
  requested = true;

  if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
    return 'unavailable';
  }

  try {
    const already = await navigator.storage.persisted?.();
    if (already) return 'granted';

    const granted = await navigator.storage.persist();
    if (granted) {
      console.info('[storage] persistent storage granted');
      return 'granted';
    }
    console.info('[storage] persistent storage denied (cache may be evicted under pressure)');
    return 'denied';
  } catch (e) {
    console.warn('[storage] persistent request failed', e);
    return 'unavailable';
  }
}
