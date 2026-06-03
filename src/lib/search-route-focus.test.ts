import { describe, expect, it } from 'vitest';

import { searchFocusToken } from './search-route-focus';

describe('searchFocusToken', () => {
  it('does not request focus without the focus flag', () => {
    expect(searchFocusToken(undefined, '123')).toBeNull();
  });

  it('uses the changing navigation token when focus is requested', () => {
    expect(searchFocusToken('1', '123')).toBe('123');
    expect(searchFocusToken('1', '456')).toBe('456');
  });

  it('still focuses once when no navigation token is present', () => {
    expect(searchFocusToken('1', undefined)).toBe('initial');
  });
});
