import { describe, expect, it } from 'vitest';

import { checkDictationAnswer, normalizeDictationAnswer } from './dictation';

describe('normalizeDictationAnswer', () => {
  it('trims and collapses spaces without stripping Japanese or Thai text', () => {
    expect(normalizeDictationAnswer('  เทพ   เจ้า  ')).toBe('เทพ เจ้า');
    expect(normalizeDictationAnswer('  神  ')).toBe('神');
    expect(normalizeDictationAnswer('  かみ  ')).toBe('かみ');
  });

  it('lowercases latin text', () => {
    expect(normalizeDictationAnswer(' Kami ')).toBe('kami');
  });
});

describe('checkDictationAnswer', () => {
  it('passes exact normalized answers', () => {
    expect(checkDictationAnswer(' เทพ ', 'เทพ')).toBe(true);
    expect(checkDictationAnswer('KAMI', 'kami')).toBe(true);
  });

  it('fails different answers', () => {
    expect(checkDictationAnswer('น้ำ', 'เทพ')).toBe(false);
  });
});
