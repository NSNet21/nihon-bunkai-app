import type { Deck } from '@/data/types';

export type DeckOrganization = {
  group?: string;
  section?: string;
};

const USER_EDITABLE_SOURCES = new Set(['manual', 'custom']);
const OFFICIAL_SOURCES = new Set(['free', 'entitlement']);
const ORGANIZATION_TAG_KEYS = new Set(['group', 'set', 'collection', 'section', 'subgroup']);

export function isUserEditableDeck(deck: Pick<Deck, 'source'>): boolean {
  return USER_EDITABLE_SOURCES.has(deck.source);
}

export function isOfficialDeck(deck: Pick<Deck, 'source'>): boolean {
  return OFFICIAL_SOURCES.has(deck.source);
}

export function getDeckOrganization(deck: Pick<Deck, 'tags' | 'userGroup' | 'userSection'>): DeckOrganization {
  const group = cleanValue(deck.userGroup) ?? findTagValue(deck.tags, ['group', 'set', 'collection']);
  const section = cleanValue(deck.userSection) ?? findTagValue(deck.tags, ['section', 'subgroup']);
  return {
    ...(group ? { group } : {}),
    ...(section ? { section } : {}),
  };
}

export function applyDeckOrganization<T extends Deck>(deck: T, patch: DeckOrganization): T {
  const group = cleanValue(patch.group);
  const section = cleanValue(patch.section);
  const tags = stripOrganizationTags(deck.tags);
  if (group) tags.push(`group:${group}`);
  if (section) tags.push(`section:${section}`);
  return {
    ...deck,
    tags,
    userGroup: group,
    userSection: section,
    isUserContent: true,
    updatedAt: Date.now(),
  };
}

function findTagValue(tags: readonly string[] | undefined, keys: readonly string[]): string | undefined {
  for (const tag of tags ?? []) {
    const [key, ...rest] = tag.split(':');
    if (!key || rest.length === 0) continue;
    if (!keys.includes(key.trim().toLowerCase())) continue;
    const value = cleanValue(rest.join(':'));
    if (value) return value;
  }
  return undefined;
}

function stripOrganizationTags(tags: readonly string[] | undefined): string[] {
  return (tags ?? []).filter((tag) => {
    const [key, ...rest] = tag.split(':');
    if (rest.length === 0) return true;
    return !ORGANIZATION_TAG_KEYS.has(key.trim().toLowerCase());
  });
}

function cleanValue(value: string | undefined): string | undefined {
  const clean = value?.trim();
  return clean ? clean : undefined;
}
