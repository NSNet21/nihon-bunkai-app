import { describe, expect, it, vi } from 'vitest';

import { navigateBackOrFallback, studyFallbackHref } from './navigation-back';

describe('studyFallbackHref', () => {
  it('falls back to the deck hub for a normal study route', () => {
    expect(studyFallbackHref('kanji-n5-pack-02')).toBe('/deck/kanji-n5-pack-02');
  });

  it('falls back to Browse for group study routes', () => {
    expect(studyFallbackHref('__group__')).toBe('/');
  });
});

describe('navigateBackOrFallback', () => {
  it('uses history back when available', () => {
    const back = vi.fn();
    const push = vi.fn();

    navigateBackOrFallback({ canGoBack: () => true, back, push }, '/deck/kanji-n5-pack-02');

    expect(back).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
  });

  it('uses fallback navigation when history is unavailable', () => {
    const back = vi.fn();
    const push = vi.fn();

    navigateBackOrFallback({ canGoBack: () => false, back, push }, '/deck/kanji-n5-pack-02');

    expect(back).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/deck/kanji-n5-pack-02');
  });
});
