/**
 * SKU coverage map — which SKUs grant access to which sub-items.
 *
 * Example: owning `full-bundle` covers n4-pdf, n4-csv, n4-bundle, n3-*, n2-*, n1-*, etc.
 * The UI uses this so a user who bought Full Bundle sees OWNED on every sub-card.
 *
 * Source of truth for SKU slugs: src/data/products.ts (PAYHIP_CODES keys).
 * Keep in sync with supabase/functions/_shared/sku-map.ts on backend side.
 */

/**
 * For each SKU slug, the list of SKUs that — if owned — grant access to it.
 * Always includes the SKU itself.
 */
export const SKU_COVERAGE: Record<string, readonly string[]> = {
  // ── N5 ────────────────────────────────────────────────────────
  'n5-vocab-v2': ['n5-vocab-v2', 'full-bundle', 'first-edition'],

  // ── N4 ────────────────────────────────────────────────────────
  'n4-pdf':    ['n4-pdf',    'n4-bundle', 'pdf-bundle', 'full-bundle', 'first-edition'],
  'n4-csv':    ['n4-csv',    'n4-bundle',               'full-bundle', 'first-edition'],
  'n4-bundle': ['n4-bundle',                            'full-bundle', 'first-edition'],

  // ── N3 ────────────────────────────────────────────────────────
  'n3-pdf':    ['n3-pdf',    'n3-bundle', 'pdf-bundle', 'full-bundle', 'first-edition'],
  'n3-csv':    ['n3-csv',    'n3-bundle',               'full-bundle', 'first-edition'],
  'n3-bundle': ['n3-bundle',                            'full-bundle', 'first-edition'],

  // ── N2 ────────────────────────────────────────────────────────
  'n2-pdf':    ['n2-pdf',    'n2-bundle', 'pdf-bundle', 'full-bundle', 'first-edition'],
  'n2-csv':    ['n2-csv',    'n2-bundle',               'full-bundle', 'first-edition'],
  'n2-bundle': ['n2-bundle',                            'full-bundle', 'first-edition'],

  // ── N1 ────────────────────────────────────────────────────────
  'n1-pdf':    ['n1-pdf',    'n1-bundle', 'pdf-bundle', 'full-bundle', 'first-edition'],
  'n1-csv':    ['n1-csv',    'n1-bundle',               'full-bundle', 'first-edition'],
  'n1-bundle': ['n1-bundle',                            'full-bundle', 'first-edition'],

  // ── Cross-level bundles ──────────────────────────────────────
  'pdf-bundle':    ['pdf-bundle',  'full-bundle', 'first-edition'], // full-bundle ⊃ pdf-bundle
  'full-bundle':   ['full-bundle',                'first-edition'],
  'first-edition': ['first-edition'],
};

/** SKUs whose product includes a PDF component (shipped via Payhip, not app). */
export const HAS_PDF_PART = new Set<string>([
  'n4-pdf', 'n3-pdf', 'n2-pdf', 'n1-pdf',
  'n4-bundle', 'n3-bundle', 'n2-bundle', 'n1-bundle',
  'pdf-bundle', 'full-bundle', 'first-edition',
]);

export function isSkuOwned(slug: string, entitledSkus: Set<string>): boolean {
  const covering = SKU_COVERAGE[slug] ?? [slug];
  for (const s of covering) {
    if (entitledSkus.has(s)) return true;
  }
  return false;
}

export function hasPdfPart(slug: string): boolean {
  return HAS_PDF_PART.has(slug);
}

/** Payhip customer account — for accessing PDF downloads after purchase. */
export const PAYHIP_ACCOUNT_URL = 'https://payhip.com/account';
