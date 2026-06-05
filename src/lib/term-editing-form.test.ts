import { describe, expect, it } from 'vitest';

import {
  canSaveTermEditingForm,
  normalizeTermEditingFields,
} from './term-editing-form';

describe('term editing form helpers', () => {
  it('trims compact fields while preserving multiline explanation text', () => {
    expect(normalizeTermEditingFields({
      t: '  食べる  ',
      d: '  กิน  ',
      p: '  たべる  ',
      e: '  ### Note\n\nยังเก็บบรรทัดไว้  ',
    })).toEqual({
      t: '食べる',
      d: 'กิน',
      p: 'たべる',
      e: '### Note\n\nยังเก็บบรรทัดไว้',
    });
  });

  it('requires editable deck and non-empty term/meaning fields', () => {
    expect(canSaveTermEditingForm({ editable: true, t: '語', d: 'คำ', p: '', e: '' })).toBe(true);
    expect(canSaveTermEditingForm({ editable: true, t: '   ', d: 'คำ', p: '', e: '' })).toBe(false);
    expect(canSaveTermEditingForm({ editable: true, t: '語', d: '   ', p: '', e: '' })).toBe(false);
    expect(canSaveTermEditingForm({ editable: false, t: '語', d: 'คำ', p: '', e: '' })).toBe(false);
  });

  it('disables save when fields match the initial entry after normalization', () => {
    expect(canSaveTermEditingForm({
      editable: true,
      t: ' 語 ',
      d: 'คำ',
      p: 'ご',
      e: '### Note',
      initial: { t: '語', d: 'คำ', p: 'ご', e: '### Note' },
    })).toBe(false);
    expect(canSaveTermEditingForm({
      editable: true,
      t: '語ใหม่',
      d: 'คำ',
      p: 'ご',
      e: '### Note',
      initial: { t: '語', d: 'คำ', p: 'ご', e: '### Note' },
    })).toBe(true);
  });
});
