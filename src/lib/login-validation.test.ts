import { describe, expect, it } from 'vitest';

import {
  getPasswordRequirementState,
  normalizeLoginEmail,
  validateLaunchPassword,
} from './login-validation';

describe('login validation helpers', () => {
  it('normalizes and validates email before auth submission', () => {
    expect(normalizeLoginEmail('  learner@example.com  ')).toEqual({
      ok: true,
      value: 'learner@example.com',
    });
    expect(normalizeLoginEmail('learner.example.com')).toEqual({
      ok: false,
      message: 'กรุณากรอกอีเมลให้ถูกต้อง',
    });
  });

  it('accepts Thai and Japanese letters as password letters', () => {
    expect(validateLaunchPassword('日本分解語彙1!')).toEqual({ ok: true });
    expect(validateLaunchPassword('ภาษาไทย12!')).toEqual({ ok: true });
  });

  it('requires length, a Unicode letter, a Unicode number, and a special character', () => {
    expect(getPasswordRequirementState('abc')).toEqual({
      length: false,
      letter: true,
      number: false,
      special: false,
    });
    expect(getPasswordRequirementState('12345678!')).toEqual({
      length: true,
      letter: false,
      number: true,
      special: true,
    });
    expect(validateLaunchPassword('日本分解ภาษา')).toEqual({
      ok: false,
      message: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร, ตัวอักษร, ตัวเลข และสัญลักษณ์',
      missing: ['number', 'special'],
    });
  });
});
