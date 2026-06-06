import { describe, expect, it } from 'vitest';

import { getGlobalShortcutAction } from './global-shortcuts';

describe('getGlobalShortcutAction', () => {
  it('maps Ctrl/Meta+K to search focus', () => {
    expect(getGlobalShortcutAction({ code: 'KeyK', ctrlKey: true, metaKey: false })).toBe('search');
    expect(getGlobalShortcutAction({ code: 'KeyK', ctrlKey: false, metaKey: true })).toBe('search');
  });

  it('maps Ctrl/Meta+B to browse home', () => {
    expect(getGlobalShortcutAction({ code: 'KeyB', ctrlKey: true, metaKey: false })).toBe('browse');
    expect(getGlobalShortcutAction({ code: 'KeyB', ctrlKey: false, metaKey: true })).toBe('browse');
  });

  it('maps Ctrl/Meta+Home to browse home as a personal alias', () => {
    expect(getGlobalShortcutAction({ code: 'Home', ctrlKey: true, metaKey: false })).toBe('browse');
    expect(getGlobalShortcutAction({ code: 'Home', ctrlKey: false, metaKey: true })).toBe('browse');
  });

  it('ignores keys without Ctrl/Meta', () => {
    expect(getGlobalShortcutAction({ code: 'KeyK', ctrlKey: false, metaKey: false })).toBeNull();
    expect(getGlobalShortcutAction({ code: 'KeyB', ctrlKey: false, metaKey: false })).toBeNull();
  });
});
