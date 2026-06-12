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

export function getEmailConfirmationSentMessage(_email: string): string {
  return 'สมัครสมาชิกสำเร็จ • โปรดตรวจสอบอีเมลเพื่อยืนยันบัญชี';
}

export function mapAuthEmailError(message: string | null | undefined): string | null {
  if (!message) return null;
  if (/email not confirmed/i.test(message)) {
    return 'อีเมลนี้ยังไม่ได้ยืนยัน · เปิดอีเมลจาก Nihon Bunkai แล้วกดยืนยันก่อนเข้าสู่ระบบ';
  }
  return message;
}
