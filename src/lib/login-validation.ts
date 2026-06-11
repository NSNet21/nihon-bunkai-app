export type PasswordRequirementId = 'length' | 'letter' | 'number' | 'special';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LETTER_PATTERN = /\p{L}/u;
const NUMBER_PATTERN = /\p{N}/u;
const SPECIAL_PATTERN = /[^\p{L}\p{N}\s]/u;

export function normalizeLoginEmail(email: string) {
  const value = email.trim();
  if (!value || !EMAIL_PATTERN.test(value)) {
    return {
      ok: false as const,
      message: 'กรุณากรอกอีเมลให้ถูกต้อง',
    };
  }
  return { ok: true as const, value };
}

export function getPasswordRequirementState(password: string): Record<PasswordRequirementId, boolean> {
  return {
    length: Array.from(password).length >= 8,
    letter: LETTER_PATTERN.test(password),
    number: NUMBER_PATTERN.test(password),
    special: SPECIAL_PATTERN.test(password),
  };
}

export function validateLaunchPassword(password: string) {
  const state = getPasswordRequirementState(password);
  const missing = (Object.entries(state) as [PasswordRequirementId, boolean][])
    .filter(([, passed]) => !passed)
    .map(([id]) => id);

  if (missing.length === 0) return { ok: true as const };

  return {
    ok: false as const,
    message: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร, ตัวอักษร, ตัวเลข และสัญลักษณ์',
    missing,
  };
}
