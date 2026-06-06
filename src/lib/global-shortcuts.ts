export type GlobalShortcutAction = 'search' | 'browse';

type ShortcutLike = {
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
};

export function getGlobalShortcutAction(event: ShortcutLike): GlobalShortcutAction | null {
  const withMod = event.ctrlKey || event.metaKey;
  if (!withMod) return null;
  if (event.code === 'KeyK') return 'search';
  if (event.code === 'KeyB' || event.code === 'Home') return 'browse';
  return null;
}
