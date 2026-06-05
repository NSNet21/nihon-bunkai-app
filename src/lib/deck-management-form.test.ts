import { describe, expect, it } from 'vitest';

import { canSaveDeckManagementForm, normalizeDeckManagementFields } from './deck-management-form';

describe('normalizeDeckManagementFields', () => {
  it('trims title, group, and section fields', () => {
    expect(normalizeDeckManagementFields({
      title: '  My deck  ',
      group: '  N2 weak set ',
      section: ' Week 1 ',
    })).toEqual({
      title: 'My deck',
      group: 'N2 weak set',
      section: 'Week 1',
    });
  });

  it('keeps optional group and section undefined when blank', () => {
    expect(normalizeDeckManagementFields({
      title: 'My deck',
      group: '   ',
      section: '',
    })).toEqual({
      title: 'My deck',
      group: undefined,
      section: undefined,
    });
  });
});

describe('canSaveDeckManagementForm', () => {
  it('requires an editable deck and non-empty title', () => {
    expect(canSaveDeckManagementForm({ editable: true, title: 'My deck' })).toBe(true);
    expect(canSaveDeckManagementForm({ editable: true, title: '   ' })).toBe(false);
    expect(canSaveDeckManagementForm({ editable: false, title: 'My deck' })).toBe(false);
  });

  it('allows save when only group or section changes', () => {
    expect(canSaveDeckManagementForm({
      editable: true,
      title: 'My deck',
      initial: { title: 'My deck', group: 'A', section: undefined },
      group: 'B',
      section: undefined,
    })).toBe(true);
  });

  it('disables save when normalized values are unchanged', () => {
    expect(canSaveDeckManagementForm({
      editable: true,
      title: ' My deck ',
      group: ' A ',
      section: ' Week 1 ',
      initial: { title: 'My deck', group: 'A', section: 'Week 1' },
    })).toBe(false);
  });
});
