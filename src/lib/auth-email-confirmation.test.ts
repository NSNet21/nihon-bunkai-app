import { describe, expect, it } from 'vitest';

import {
  buildAuthEmailRedirectTo,
  getEmailConfirmationSentMessage,
  mapAuthEmailError,
} from './auth-email-confirmation';

describe('auth email confirmation helpers', () => {
  it('redirects confirmation emails back to the login route on the same origin', () => {
    expect(buildAuthEmailRedirectTo('https://app.nihon-bunkai.com/deck/n5')).toBe(
      'https://app.nihon-bunkai.com/login',
    );
  });

  it('normalizes trailing slashes before building the login redirect', () => {
    expect(buildAuthEmailRedirectTo('https://app.nihon-bunkai.com/')).toBe(
      'https://app.nihon-bunkai.com/login',
    );
  });

  it('explains signup confirmation in Thai with the learner email', () => {
    expect(getEmailConfirmationSentMessage(' learner@example.com ')).toBe(
      'สมัครสมาชิกสำเร็จ • โปรดตรวจสอบอีเมลเพื่อยืนยันบัญชี',
    );
  });

  it('maps Supabase unconfirmed-email errors to a clear Thai message', () => {
    expect(mapAuthEmailError('Email not confirmed')).toBe(
      'อีเมลนี้ยังไม่ได้ยืนยัน · เปิดอีเมลจาก Nihon Bunkai แล้วกดยืนยันก่อนเข้าสู่ระบบ',
    );
  });

  it('keeps unrelated auth errors unchanged', () => {
    expect(mapAuthEmailError('Invalid login credentials')).toBe('Invalid login credentials');
  });
});
