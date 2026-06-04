export type StudyMode = 'flashcard' | 'multiple-choice' | 'dictation';
export type StudyGoal = 'term' | 'meaning' | 'reading';
export type StudyOrder = 'normal' | 'shuffle';
export type StudyCount = 10 | 20 | 30 | 50 | 'all';
export type StudyField = 't' | 'd' | 'p' | 'e';

export type StudyHints = {
  term: boolean;
  meaning: boolean;
  reading: boolean;
};

export type StudyModeConfig = {
  count: StudyCount;
  order: StudyOrder;
  goal: StudyGoal;
  hints: StudyHints;
  configured: boolean;
};

export const DEFAULT_STUDY_MODE_CONFIGS: Record<StudyMode, StudyModeConfig> = {
  flashcard: {
    count: 'all',
    order: 'normal',
    goal: 'meaning',
    hints: { term: true, meaning: false, reading: true },
    configured: false,
  },
  'multiple-choice': {
    count: 20,
    order: 'shuffle',
    goal: 'meaning',
    hints: { term: true, meaning: false, reading: true },
    configured: false,
  },
  dictation: {
    count: 20,
    order: 'shuffle',
    goal: 'term',
    hints: { term: false, meaning: true, reading: true },
    configured: false,
  },
};

const VALID_COUNTS: StudyCount[] = [10, 20, 30, 50, 'all'];
const VALID_ORDERS: StudyOrder[] = ['normal', 'shuffle'];
const VALID_GOALS: StudyGoal[] = ['term', 'meaning', 'reading'];

export function studyModeConfigKey(mode: StudyMode) {
  return `study-mode-config.${mode}`;
}

export function sanitizeStudyModeConfig(raw: unknown, mode: StudyMode = 'flashcard'): StudyModeConfig {
  const fallback = DEFAULT_STUDY_MODE_CONFIGS[mode];
  if (!raw || typeof raw !== 'object') return fallback;
  const value = raw as Partial<StudyModeConfig>;
  const hints = value.hints;
  const validHints =
    hints &&
    typeof hints === 'object' &&
    typeof hints.term === 'boolean' &&
    typeof hints.meaning === 'boolean' &&
    typeof hints.reading === 'boolean';

  if (
    !VALID_COUNTS.includes(value.count as StudyCount) ||
    !VALID_ORDERS.includes(value.order as StudyOrder) ||
    !VALID_GOALS.includes(value.goal as StudyGoal) ||
    !validHints
  ) {
    return fallback;
  }

  return {
    count: value.count as StudyCount,
    order: value.order as StudyOrder,
    goal: value.goal as StudyGoal,
    hints: {
      term: hints.term,
      meaning: hints.meaning,
      reading: hints.reading,
    },
    configured: value.configured === true,
  };
}

export function deriveStudyFields(config: StudyModeConfig): {
  prompt: StudyField[];
  answer: StudyField[];
  answerField: Extract<StudyField, 't' | 'd' | 'p'>;
} {
  const answerField = config.goal === 'term' ? 't' : config.goal === 'meaning' ? 'd' : 'p';
  const prompt: StudyField[] = [];
  const answer: StudyField[] = [];

  const place = (field: StudyField, isHint: boolean) => {
    if (field === answerField) {
      answer.push(field);
      return;
    }
    if (isHint) prompt.push(field);
    else answer.push(field);
  };

  place('t', config.hints.term);
  place('d', config.hints.meaning);
  place('p', config.hints.reading);
  answer.push('e');

  return { prompt, answer, answerField };
}
