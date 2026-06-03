export function searchFocusToken(focusParam?: string, navigationToken?: string) {
  if (focusParam !== '1') return null;
  return navigationToken || 'initial';
}
