import { describe, expect, it } from 'vitest';

import { formatToastText } from '../lib/toast-message';

describe('formatToastText', () => {
  it('keeps plain toast messages unchanged', () => {
    expect(formatToastText('บันทึกคำแล้ว')).toBe('บันทึกคำแล้ว');
  });

  it('joins action label with a middle dot for clickable toasts', () => {
    expect(formatToastText('บันทึกคำแล้ว', 'เปิดดู')).toBe('บันทึกคำแล้ว · เปิดดู');
  });
});
