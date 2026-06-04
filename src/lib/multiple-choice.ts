import type { Entry } from '@/data/types';
import type { StudyGoal } from './study-mode-config';

export type MultipleChoiceQuestion = {
  correct: string;
  choices: string[];
};

function valueForGoal(entry: Entry, goal: StudyGoal) {
  if (goal === 'term') return entry.t.trim();
  if (goal === 'meaning') return entry.d.trim();
  return entry.p.trim();
}

function stableScore(value: string, seed: string) {
  let h = 2166136261;
  const input = `${seed}:${value}`;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function buildMultipleChoiceQuestion(current: Entry, pool: Entry[], goal: StudyGoal): MultipleChoiceQuestion {
  const correct = valueForGoal(current, goal);
  const seen = new Set<string>([correct]);
  const distractors: string[] = [];

  for (const entry of pool) {
    if (entry.id === current.id) continue;
    const value = valueForGoal(entry, goal);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    distractors.push(value);
    if (distractors.length >= 3) break;
  }

  const seed = `${current.id}:${goal}`;
  const choices = [correct, ...distractors]
    .slice(0, 4)
    .sort((a, b) => stableScore(a, seed) - stableScore(b, seed));

  return { correct, choices };
}
