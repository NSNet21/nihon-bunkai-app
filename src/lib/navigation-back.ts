type BackRouter = {
  canGoBack: () => boolean;
  back: () => void;
  push: (href: string) => void;
};

type StudyFallbackOptions = {
  fromContinue?: boolean;
};

export function isContinueOrigin(value?: string | string[]) {
  return Array.isArray(value) ? value.includes('continue') : value === 'continue';
}

export function studyFallbackHref(deckId?: string, options: StudyFallbackOptions = {}) {
  if (options.fromContinue) return '/';
  if (!deckId || deckId === '__group__') return '/';
  return `/deck/${deckId}`;
}

export function searchFallbackHref() {
  return '/?scrollTop=search-back';
}

export function navigateBackOrFallback(router: BackRouter, fallbackHref: string) {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.push(fallbackHref);
}
