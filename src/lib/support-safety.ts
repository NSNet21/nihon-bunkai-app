export const SUPPORT_EMAIL = 'hi@nihon-bunkai.com';

export type SupportIssue = 'restore' | 'download' | 'library-backup' | 'account' | 'other';

export const SUPPORT_ISSUE_LABELS: Record<SupportIssue, string> = {
  restore: 'Restore / Unlock',
  download: 'Download / Payhip files',
  'library-backup': 'Library backup / Import',
  account: 'Account / Privacy',
  other: 'Other',
};

export type SupportMailtoInput = {
  issue: SupportIssue;
  accountEmail?: string | null;
  purchaseEmail?: string | null;
  orderId?: string | null;
};

export const LOCAL_DATA_SAFETY_LINES = [
  'Official app content: sign in, check restore rights, then download/import the unlocked decks again.',
  'PDF files: use your Payhip receipt or Payhip account download area.',
  'Manual import/custom content: local-first on this browser, so export backup before cache reset, browser change, or device move.',
] as const;

export function buildSupportMailto(input: SupportMailtoInput): string {
  const issueLabel = SUPPORT_ISSUE_LABELS[input.issue];
  const subject = `[Nihon Bunkai Support] [${issueLabel}]`;
  const body = [
    'สวัสดีครับ/ค่ะ Nihon Bunkai Support',
    '',
    `Issue: ${issueLabel}`,
    `Account email: ${cleanValue(input.accountEmail)}`,
    `Purchase email: ${cleanValue(input.purchaseEmail)}`,
    `Payhip Order ID: ${cleanValue(input.orderId)}`,
    '',
    'รายละเอียด:',
    '',
    '',
    '-- ส่งจาก Settings · Nihon Bunkai Companion App',
  ].join('\n');

  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function cleanValue(value?: string | null): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : '-';
}

