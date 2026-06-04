import type { ColumnVisibility, FrontHero } from '@/components/flashcard';

export const DEFAULT_CARD_VISIBILITY: ColumnVisibility = {
  t: true,
  pf: true,
  pb: true,
  d: true,
  e: true,
};

export const DEFAULT_FRONT_HERO: FrontHero = 't';

export const CARD_VISIBILITY_STORAGE_KEY = 'visibility';
export const FRONT_HERO_STORAGE_KEY = 'front-hero';

export function applyCardVisibilityToggle(
  visibility: ColumnVisibility,
  key: keyof ColumnVisibility,
  frontHero: FrontHero,
): { visibility: ColumnVisibility; frontHero: FrontHero } {
  const next = { ...visibility, [key]: !visibility[key] };
  if (!next.t && !next.pf) return { visibility, frontHero };
  if (!next.d && !next.pb && !next.e) return { visibility, frontHero };

  let nextHero = frontHero;
  if (key === 't' && !next.t && frontHero === 't' && next.pf) nextHero = 'p';
  if (key === 'pf' && !next.pf && frontHero === 'p' && next.t) nextHero = 't';
  if (key === 't' && next.t && frontHero === 'p' && !visibility.t) nextHero = DEFAULT_FRONT_HERO;

  return { visibility: next, frontHero: nextHero };
}

export function visibleFrontCount(visibility: ColumnVisibility): number {
  return (visibility.t ? 1 : 0) + (visibility.pf ? 1 : 0);
}

export function visibleBackCount(visibility: ColumnVisibility): number {
  return (visibility.d ? 1 : 0) + (visibility.pb ? 1 : 0) + (visibility.e ? 1 : 0);
}
