/**
 * Static params for Expo Router SSG of dynamic deck routes.
 *
 * Background: `/deck/[deckId]/{index,quiz,memorize,config}` are dynamic
 * routes. Without `generateStaticParams`, Expo's static export does not
 * pre-render any HTML for them — Cloudflare Pages then falls back to
 * serving `index.html` (the Browse page) for those URLs. The client
 * router reads the URL and renders the Quiz/Memorize/etc. screen,
 * producing a major hydration mismatch (#418) on every cold load of a
 * deck URL.
 *
 * Fix: enumerate the deck IDs we know at build time (free-tier packs)
 * and return them from each route's `generateStaticParams`. Each ID
 * becomes a `.html` file in the export and CF Pages serves the right
 * shell on cold load — hydration matches.
 *
 * Paid/custom deck IDs are not knowable at build time (they live in the
 * user's IndexedDB after purchase/import/create). For user-created custom
 * term preview routes, `public/_redirects` rewrites `custom-*` term URLs
 * to the generic dynamic HTML shell so cold load/reload can hydrate before
 * local-library lookup finishes instead of falling through to Browse.
 */

import { decks as freeDecks } from './free-tier';

/** All free deck IDs that should be pre-rendered for /deck/* routes. */
export function freeDeckParams(): Array<{ deckId: string }> {
  return freeDecks.map((d) => ({ deckId: d.id }));
}
