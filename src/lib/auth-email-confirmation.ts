const LOGIN_PATH = '/login';
const RESET_PASSWORD_PATH = '/reset-password';

export type AuthEmailLinkIssue = {
  code: 'otp_expired' | 'invalid_link';
  title: string;
  message: string;
};

export function buildAuthEmailRedirectTo(originOrUrl?: string | null): string | undefined {
  return buildAuthRouteRedirectTo(LOGIN_PATH, originOrUrl);
}

export function buildAuthPasswordResetRedirectTo(originOrUrl?: string | null): string | undefined {
  return buildAuthRouteRedirectTo(RESET_PASSWORD_PATH, originOrUrl);
}

function buildAuthRouteRedirectTo(path: string, originOrUrl?: string | null): string | undefined {
  if (!originOrUrl) return undefined;
  try {
    const url = new URL(originOrUrl);
    return `${url.origin}${path}`;
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

export function parseAuthEmailLinkIssue(urlOrHash: string | null | undefined): AuthEmailLinkIssue | null {
  if (!urlOrHash) return null;

  const rawHash = extractHashParams(urlOrHash);
  if (!rawHash) return null;

  const params = new URLSearchParams(rawHash);
  const error = params.get('error') ?? '';
  const code = params.get('error_code') ?? '';
  const description = params.get('error_description') ?? '';
  const combined = `${error} ${code} ${description}`;

  if (/otp_expired|expired/i.test(combined)) {
    return {
      code: 'otp_expired',
      title: 'ลิงก์ยืนยันหมดอายุ',
      message: 'ลิงก์นี้ถูกใช้งานแล้วหรือหมดอายุ กรุณากรอกอีเมลเดิมเพื่อรับลิงก์ยืนยันใหม่อีกครั้ง',
    };
  }

  if (/access_denied|invalid/i.test(combined)) {
    return {
      code: 'invalid_link',
      title: 'ลิงก์ยืนยันใช้ไม่ได้',
      message: 'ลิงก์นี้อาจถูกใช้ไปแล้วหรือไม่ตรงกับบัญชี กรอกอีเมลที่สมัครไว้ แล้วส่งอีเมลยืนยันใหม่อีกครั้ง',
    };
  }

  return null;
}

function extractHashParams(urlOrHash: string): string | null {
  if (urlOrHash.startsWith('#')) return urlOrHash.slice(1);
  try {
    const url = new URL(urlOrHash);
    return url.hash ? url.hash.slice(1) : null;
  } catch {
    const hashIndex = urlOrHash.indexOf('#');
    return hashIndex >= 0 ? urlOrHash.slice(hashIndex + 1) : null;
  }
}
