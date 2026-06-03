type BackRouter = {
  canGoBack: () => boolean;
  back: () => void;
  push: (href: string) => void;
};

export function studyFallbackHref(deckId?: string) {
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
