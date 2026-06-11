import { describe, expect, it } from 'vitest';

import { getPwaShortcutMode } from './pwa-shortcut';

describe('getPwaShortcutMode', () => {
  it('hides the shortcut nudge when the app is already standalone', () => {
    expect(getPwaShortcutMode({ standalone: true, canPromptInstall: true, isIOS: false, isMobileLike: true })).toBe('hidden');
  });

  it('uses the browser install prompt when mobile Chromium exposes it', () => {
    expect(getPwaShortcutMode({ standalone: false, canPromptInstall: true, isIOS: false, isMobileLike: true })).toBe('prompt');
  });

  it('uses home-screen instructions for iOS because the prompt cannot be triggered', () => {
    expect(getPwaShortcutMode({ standalone: false, canPromptInstall: false, isIOS: true, isMobileLike: true })).toBe('instructions');
  });

  it('keeps desktop hidden so the app chrome stays quiet', () => {
    expect(getPwaShortcutMode({ standalone: false, canPromptInstall: true, isIOS: false, isMobileLike: false })).toBe('hidden');
  });
});
