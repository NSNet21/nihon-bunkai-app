import { describe, expect, it } from 'vitest';

import {
  DEFAULT_STUDY_MODE_CONFIGS,
  deriveStudyFields,
  sanitizeStudyModeConfig,
  studyModeConfigKey,
} from './study-mode-config';

describe('studyModeConfigKey', () => {
  it('stores config globally per mode', () => {
    expect(studyModeConfigKey('flashcard')).toBe('study-mode-config.flashcard');
    expect(studyModeConfigKey('multiple-choice')).toBe('study-mode-config.multiple-choice');
    expect(studyModeConfigKey('dictation')).toBe('study-mode-config.dictation');
  });
});

describe('sanitizeStudyModeConfig', () => {
  it('keeps valid config values', () => {
    expect(
      sanitizeStudyModeConfig({
        count: 20,
        order: 'shuffle',
        goal: 'meaning',
        hints: { term: true, meaning: false, reading: true },
        configured: true,
      }),
    ).toEqual({
      count: 20,
      order: 'shuffle',
      goal: 'meaning',
      hints: { term: true, meaning: false, reading: true },
      configured: true,
    });
  });

  it('falls back to defaults for invalid data', () => {
    expect(
      sanitizeStudyModeConfig({
        count: 999,
        order: 'sideways',
        goal: 'kanji',
        hints: { term: false, meaning: false, reading: false },
      }),
    ).toEqual(DEFAULT_STUDY_MODE_CONFIGS.flashcard);
  });
});

describe('deriveStudyFields', () => {
  it('recalls meaning from term plus optional reading hint', () => {
    expect(
      deriveStudyFields({
        count: 'all',
        order: 'normal',
        goal: 'meaning',
        hints: { term: true, meaning: false, reading: true },
        configured: true,
      }),
    ).toEqual({
      prompt: ['t', 'p'],
      answer: ['d', 'e'],
      answerField: 'd',
    });
  });

  it('recalls term from meaning with reading kept on answer side when not a hint', () => {
    expect(
      deriveStudyFields({
        count: 10,
        order: 'normal',
        goal: 'term',
        hints: { term: false, meaning: true, reading: false },
        configured: true,
      }),
    ).toEqual({
      prompt: ['d'],
      answer: ['t', 'p', 'e'],
      answerField: 't',
    });
  });

  it('recalls reading from term and meaning hints', () => {
    expect(
      deriveStudyFields({
        count: 30,
        order: 'shuffle',
        goal: 'reading',
        hints: { term: true, meaning: true, reading: false },
        configured: true,
      }),
    ).toEqual({
      prompt: ['t', 'd'],
      answer: ['p', 'e'],
      answerField: 'p',
    });
  });
});
