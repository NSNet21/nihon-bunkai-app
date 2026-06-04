import { describe, expect, it } from 'vitest';

import {
  buildMultipleChoiceQuestion,
  getMultipleChoiceChoiceState,
  gradeMultipleChoiceAttempt,
} from './multiple-choice';
import type { Entry } from '@/data/types';

const entries = ['神', '水', '火', '山', '川'].map((term, i) => ({
  id: `entry-${i + 1}`,
  type: 'vocab' as const,
  level: 'N5' as const,
  pack: 'vocab-n5-pack01',
  tags: ['vocab', 'n5'],
  no: i + 1,
  t: term,
  d: ['เทพ', 'น้ำ', 'ไฟ', 'ภูเขา', 'แม่น้ำ'][i],
  p: ['かみ', 'みず', 'ひ', 'やま', 'かわ'][i],
  e: '',
})) satisfies Entry[];

describe('buildMultipleChoiceQuestion', () => {
  it('uses meaning choices for meaning recall', () => {
    const q = buildMultipleChoiceQuestion(entries[0], entries, 'meaning');

    expect(q.correct).toBe('เทพ');
    expect(q.choices).toContain('เทพ');
    expect(q.choices).toHaveLength(4);
    expect(new Set(q.choices).size).toBe(4);
  });

  it('uses term choices for term recall', () => {
    const q = buildMultipleChoiceQuestion(entries[0], entries, 'term');

    expect(q.correct).toBe('神');
    expect(q.choices).toContain('神');
    expect(q.choices).toHaveLength(4);
  });

  it('uses reading choices for reading recall', () => {
    const q = buildMultipleChoiceQuestion(entries[0], entries, 'reading');

    expect(q.correct).toBe('かみ');
    expect(q.choices).toContain('かみ');
    expect(q.choices).toHaveLength(4);
  });

  it('avoids duplicate choices', () => {
    const duplicateMeanings = entries.map((entry, index) => ({
      ...entry,
      d: index < 3 ? 'เหมือนกัน' : entry.d,
    }));

    const q = buildMultipleChoiceQuestion(duplicateMeanings[0], duplicateMeanings, 'meaning');

    expect(new Set(q.choices).size).toBe(q.choices.length);
    expect(q.choices).toContain('เหมือนกัน');
  });

  it('uses stable choice order for the same card and goal', () => {
    const first = buildMultipleChoiceQuestion(entries[0], entries, 'meaning');
    const second = buildMultipleChoiceQuestion(entries[0], entries, 'meaning');

    expect(first.choices).toEqual(second.choices);
  });
});

describe('gradeMultipleChoiceAttempt', () => {
  it('grades only the selected first attempt against the correct answer', () => {
    expect(gradeMultipleChoiceAttempt('แม่', 'แม่')).toEqual({
      selected: 'แม่',
      correct: 'แม่',
      isCorrect: true,
    });

    expect(gradeMultipleChoiceAttempt('พ่อ', 'แม่')).toEqual({
      selected: 'พ่อ',
      correct: 'แม่',
      isCorrect: false,
    });
  });
});

describe('getMultipleChoiceChoiceState', () => {
  it('marks only the submitted wrong choice and the correct choice after a wrong attempt', () => {
    const attempt = gradeMultipleChoiceAttempt('พ่อ', 'แม่');

    expect(getMultipleChoiceChoiceState('พ่อ', attempt)).toBe('wrong');
    expect(getMultipleChoiceChoiceState('แม่', attempt)).toBe('correct');
    expect(getMultipleChoiceChoiceState('ลูก', attempt)).toBe('idle');
  });

  it('marks the selected choice as correct after a correct attempt', () => {
    const attempt = gradeMultipleChoiceAttempt('แม่', 'แม่');

    expect(getMultipleChoiceChoiceState('แม่', attempt)).toBe('correct');
    expect(getMultipleChoiceChoiceState('พ่อ', attempt)).toBe('idle');
  });
});
