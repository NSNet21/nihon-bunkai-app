/**
 * Payhip product code → our SKU slug mapping.
 *
 * Source of truth: companion-app/src/data/products.ts (PAYHIP_CODES).
 * Duplicated here because Deno edge functions can't reach the app's TS code.
 * Keep in sync when adding new Payhip products.
 */

export const PAYHIP_CODE_TO_SKU: Record<string, string> = {
  "zIqYe": "n5-starter",
  "GeoNg": "n5-vocab-v2",
  "VlpGw": "n4-pdf",
  "VQTAk": "n4-csv",
  "0uk8y": "n4-bundle",
  "KY6k7": "n3-pdf",
  "m0Nrh": "n3-csv",
  "2XwzZ": "n3-bundle",
  "Vlq65": "n2-pdf",
  "lsvFp": "n2-csv",
  "a39xU": "n2-bundle",
  "aXBoJ": "n1-pdf",
  "fGm32": "n1-csv",
  "ut1XH": "n1-bundle",
  "4njgv": "pdf-bundle",
  "CFv7l": "full-bundle",
  "AvbVT": "first-edition",
};

/**
 * Resolve a SKU slug from anything Payhip sends as product identifier.
 * Accepts: product_key (5-char code), product_permalink (full URL), or raw slug.
 */
export function resolveSkuSlug(opts: {
  product_key?: string;
  product_permalink?: string;
  product_name?: string;
}): string | null {
  // 1. Direct product_key match (most reliable)
  if (opts.product_key && PAYHIP_CODE_TO_SKU[opts.product_key]) {
    return PAYHIP_CODE_TO_SKU[opts.product_key];
  }

  // 2. Extract code from permalink (https://payhip.com/b/XXXXX)
  if (opts.product_permalink) {
    const m = opts.product_permalink.match(/\/b\/([A-Za-z0-9]+)/);
    if (m && PAYHIP_CODE_TO_SKU[m[1]]) {
      return PAYHIP_CODE_TO_SKU[m[1]];
    }
  }

  return null;
}
