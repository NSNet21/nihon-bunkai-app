export type PwaShortcutMode = 'hidden' | 'prompt' | 'instructions';

export type PwaShortcutModeInput = {
  standalone: boolean;
  canPromptInstall: boolean;
  isIOS: boolean;
  isMobileLike: boolean;
};

export function getPwaShortcutMode({
  standalone,
  canPromptInstall,
  isIOS,
  isMobileLike,
}: PwaShortcutModeInput): PwaShortcutMode {
  if (standalone || !isMobileLike) return 'hidden';
  if (isIOS) return 'instructions';
  if (canPromptInstall) return 'prompt';
  return 'hidden';
}

export function isIOSLikePlatform(navigatorLike: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'>): boolean {
  const userAgent = navigatorLike.userAgent ?? '';
  const platform = navigatorLike.platform ?? '';
  const touchPoints = navigatorLike.maxTouchPoints ?? 0;
  return /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && touchPoints > 1);
}
