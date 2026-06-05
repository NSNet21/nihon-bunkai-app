import type { Entry } from '@/data/types';
import type { StudyCount, StudyOrder } from './study-mode-config';

type SessionConfig = {
  count: StudyCount;
  order: StudyOrder;
};

function hashSeed(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed: string) {
  let state = hashSeed(seed) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1000000) / 1000000;
  };
}

export function buildStudySessionEntries(entries: Entry[], config: SessionConfig, seed: string) {
  const ordered = [...entries];
  if (config.order === 'shuffle') {
    const nextRandom = seededRandom(seed);
    for (let i = ordered.length - 1; i > 0; i -= 1) {
      const j = Math.floor(nextRandom() * (i + 1));
      [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    }
  }

  if (config.count === 'all') return ordered;
  return ordered.slice(0, config.count);
}

export function buildReshuffledStudySessionEntries(
  entries: Entry[],
  config: SessionConfig,
  seed: string,
  iteration: number,
) {
  return buildStudySessionEntries(
    entries,
    { ...config, order: 'shuffle' },
    `${seed}:reshuffle:${iteration}`,
  );
}

function twoDigit(value: number) {
  return String(value).padStart(2, '0');
}

export function buildCardPositionMeta(index: number, total: number, label?: string, sourceNo?: number) {
  const parts = [`CARD ${twoDigit(index + 1)} / ${total}`];
  if (typeof sourceNo === 'number' && Number.isFinite(sourceNo)) {
    parts.push(`NO. ${twoDigit(sourceNo)}`);
  }
  if (label) parts.push(label.toUpperCase());
  return parts.join(' // ');
}

export function buildSourcePositionMeta(entry: Entry, label?: string) {
  const base = `TERM NO. ${twoDigit(entry.no)}`;
  return label ? `${base} // ${label.toUpperCase()}` : base;
}
