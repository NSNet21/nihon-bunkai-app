import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CARD_VISIBILITY,
  DEFAULT_FRONT_HERO,
  applyCardVisibilityToggle,
} from './card-display-config';

describe('card display config', () => {
  it('keeps at least one front field visible', () => {
    expect(applyCardVisibilityToggle({ t: true, pf: false, pb: true, d: true, e: true }, 't', 't')).toEqual({
      visibility: { t: true, pf: false, pb: true, d: true, e: true },
      frontHero: 't',
    });
  });

  it('keeps at least one back field visible', () => {
    expect(applyCardVisibilityToggle({ t: true, pf: true, pb: false, d: false, e: true }, 'e', 't')).toEqual({
      visibility: { t: true, pf: true, pb: false, d: false, e: true },
      frontHero: 't',
    });
  });

  it('moves the front hero from term to pronunciation when term is hidden', () => {
    expect(applyCardVisibilityToggle(DEFAULT_CARD_VISIBILITY, 't', 't')).toEqual({
      visibility: { ...DEFAULT_CARD_VISIBILITY, t: false },
      frontHero: 'p',
    });
  });

  it('restores term as front hero when term is re-enabled after an auto-swap', () => {
    expect(applyCardVisibilityToggle({ ...DEFAULT_CARD_VISIBILITY, t: false }, 't', 'p')).toEqual({
      visibility: DEFAULT_CARD_VISIBILITY,
      frontHero: DEFAULT_FRONT_HERO,
    });
  });
});
