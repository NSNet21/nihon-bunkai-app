import { describe, expect, it } from 'vitest';

import {
  LOCAL_DATA_SAFETY_LINES,
  SUPPORT_EMAIL,
  buildSupportMailto,
} from './support-safety';

describe('buildSupportMailto', () => {
  it('builds an encoded support email with account, purchase, and order fields', () => {
    const url = buildSupportMailto({
      issue: 'restore',
      accountEmail: 'learner@example.com',
      purchaseEmail: 'buyer@example.com',
      orderId: '8B1oMwnmWZ',
    });

    expect(url).toContain(`mailto:${SUPPORT_EMAIL}`);
    expect(decodeURIComponent(url)).toContain('[Restore / Unlock]');
    expect(decodeURIComponent(url)).toContain('Account email: learner@example.com');
    expect(decodeURIComponent(url)).toContain('Purchase email: buyer@example.com');
    expect(decodeURIComponent(url)).toContain('Payhip Order ID: 8B1oMwnmWZ');
    expect(url).not.toContain(' ');
  });

  it('keeps local-only import backup guidance separate from official restore guidance', () => {
    const copy = LOCAL_DATA_SAFETY_LINES.join('\n');

    expect(copy).toMatch(/official/i);
    expect(copy).toMatch(/Payhip/i);
    expect(copy).toMatch(/manual import/i);
    expect(copy).toMatch(/export backup/i);
  });
});

