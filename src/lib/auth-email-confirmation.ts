const LOGIN_PATH = '/login';

export function buildAuthEmailRedirectTo(originOrUrl?: string | null): string | undefined {
  if (!originOrUrl) return undefined;
  try {
    const url = new URL(originOrUrl);
    return `${url.origin}${LOGIN_PATH}`;
  } catch {
    return undefined;
  }
}

export function getEmailConfirmationSentMessage(email: string): string {
  const normalized = email.trim();
  return `สมัครแล้ว · เช็คอีเมล ${normalized} เพื่อยืนยันก่อนเข้าสู่ระบบ`;
}

export function mapAuthEmailError(message: string | null | undefined): string | null {
  if (!message) return null;
  if (/email not confirmed/i.test(message)) {
    return 'อีเมลนี้ยังไม่ได้ยืนยัน · เปิดอีเมลจาก Nihon Bunkai แล้วกดยืนยันก่อนเข้าสู่ระบบ';
  }
  return message;
}
