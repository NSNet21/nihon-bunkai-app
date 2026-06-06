type EditorInputColors = {
  border: string;
  background: string;
  backgroundElement: string;
};

type EditorInputStyleInput = {
  colors: EditorInputColors;
  focused: boolean;
  disabled: boolean;
  accent?: string;
};

const DEFAULT_ACCENT = '#e0202c';

export function getEditorInputShellStyle({
  colors,
  focused,
  disabled,
  accent = DEFAULT_ACCENT,
}: EditorInputStyleInput) {
  if (disabled) {
    return {
      borderColor: colors.border,
      backgroundColor: colors.background,
      opacity: 0.58,
    };
  }
  return {
    borderColor: focused ? accent : colors.border,
    backgroundColor: focused ? colors.backgroundElement : colors.background,
    opacity: 1,
  };
}

export function getEditorTextInputWebStyle() {
  return {
    outlineStyle: 'none',
  };
}
