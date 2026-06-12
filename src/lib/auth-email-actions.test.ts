import { describe, expect, it, vi } from 'vitest';

import {
  resendSignUpConfirmationEmail,
  signInWithConfirmedPassword,
  signUpWithEmailConfirmation,
} from './auth-email-actions';

describe('auth email actions', () => {
  it('signs up with an email confirmation redirect and reports confirmation-needed state', async () => {
    const signUp = vi.fn().mockResolvedValue({
      data: { user: { id: 'user-1' }, session: null },
      error: null,
    });
    const client = { auth: { signUp } };

    const result = await signUpWithEmailConfirmation(
      client,
      'learner@example.com',
      'Passw0rd!',
      'https://app.nihon-bunkai.com/settings',
    );

    expect(signUp).toHaveBeenCalledWith({
      email: 'learner@example.com',
      password: 'Passw0rd!',
      options: { emailRedirectTo: 'https://app.nihon-bunkai.com/login' },
    });
    expect(result).toEqual({ error: null, needsEmailConfirm: true });
  });

  it('resends the signup confirmation email with the same login redirect', async () => {
    const resend = vi.fn().mockResolvedValue({ error: null });
    const client = { auth: { resend } };

    const result = await resendSignUpConfirmationEmail(
      client,
      'learner@example.com',
      'https://app.nihon-bunkai.com/deck/n5',
    );

    expect(resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'learner@example.com',
      options: { emailRedirectTo: 'https://app.nihon-bunkai.com/login' },
    });
    expect(result).toEqual({ error: null });
  });

  it('maps unconfirmed password sign-in errors to Thai copy', async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      error: { message: 'Email not confirmed' },
    });
    const client = { auth: { signInWithPassword } };

    const result = await signInWithConfirmedPassword(client, 'learner@example.com', 'Passw0rd!');

    expect(result).toEqual({
      error: 'อีเมลนี้ยังไม่ได้ยืนยัน · เปิดอีเมลจาก Nihon Bunkai แล้วกดยืนยันก่อนเข้าสู่ระบบ',
    });
  });
});
