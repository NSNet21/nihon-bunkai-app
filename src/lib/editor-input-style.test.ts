import { describe, expect, it } from 'vitest';

import { getEditorInputShellStyle, getEditorTextInputWebStyle } from './editor-input-style';

const colors = {
  border: '#d8cfc1',
  background: '#fffaf1',
  backgroundElement: '#f5eee3',
};
const accent = '#e0202c';

describe('editor input focus styling', () => {
  it('moves focus decoration to the visible outer shell', () => {
    expect(getEditorInputShellStyle({ colors, focused: true, disabled: false })).toMatchObject({
      borderColor: accent,
      backgroundColor: colors.backgroundElement,
    });
  });

  it('keeps disabled shells muted instead of accent focused', () => {
    expect(getEditorInputShellStyle({ colors, focused: true, disabled: true })).toMatchObject({
      borderColor: colors.border,
      backgroundColor: colors.background,
      opacity: 0.58,
    });
  });

  it('removes the web-native inner TextInput outline', () => {
    expect(getEditorTextInputWebStyle()).toMatchObject({
      outlineStyle: 'none',
    });
  });

  it('keeps web TextInput text selectable', () => {
    expect(getEditorTextInputWebStyle()).toMatchObject({
      userSelect: 'text',
      WebkitUserSelect: 'text',
      cursor: 'text',
    });
  });

  it('uses multi-script input safeguards on web', () => {
    expect(getEditorTextInputWebStyle()).toMatchObject({
      minWidth: 0,
      maxWidth: '100%',
      fontFamily: '"Sarabun", "Noto Sans Thai", "Noto Sans JP", "Inter", system-ui, sans-serif',
      overflowWrap: 'anywhere',
      wordBreak: 'break-word',
    });
  });
});
