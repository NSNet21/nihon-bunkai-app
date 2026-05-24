/**
 * SKU → storage zip file mapping.
 *
 * GPT-aligned design (Phase 1.3):
 *   - SKU slug is the stable business identifier.
 *   - Zip filename is an implementation detail (may change to v2/dated filenames later).
 *   - Bundles map to a list of zips (multi-file download).
 *
 * Source of truth for SKU slugs: companion-app/src/data/products.ts (PAYHIP_CODES keys).
 * Add a new SKU here when adding it to Payhip + landing pricing.
 */

export const SKU_TO_ZIPS: Record<string, readonly string[]> = {
  // ── N5 (Starter is free, embedded in app — only Vol.2 sold) ──────
  "n5-vocab-v2": ["csv-n5-vol2.zip"],

  // ── N4 ─────────────────────────────────────────────────────────
  "n4-csv":    ["csv-n4.zip"],
  "n4-bundle": ["csv-n4.zip"], // bundle = PDF (Payhip) + CSV (app)

  // ── N3 ─────────────────────────────────────────────────────────
  "n3-csv":    ["csv-n3.zip"],
  "n3-bundle": ["csv-n3.zip"],

  // ── N2 ─────────────────────────────────────────────────────────
  "n2-csv":    ["csv-n2.zip"],
  "n2-bundle": ["csv-n2.zip"],

  // ── N1 ─────────────────────────────────────────────────────────
  "n1-csv":    ["csv-n1.zip"],
  "n1-bundle": ["csv-n1.zip"],

  // ── Cross-level bundles (all paid levels) ──────────────────────
  // N5 Starter is free + embedded, so N5 portion = Vol.2 only here
  "full-bundle":   ["csv-n5-vol2.zip", "csv-n4.zip", "csv-n3.zip", "csv-n2.zip", "csv-n1.zip"],
  "first-edition": ["csv-n5-vol2.zip", "csv-n4.zip", "csv-n3.zip", "csv-n2.zip", "csv-n1.zip"],
};

export const BUCKET = "paid-content";

export type SkuId = keyof typeof SKU_TO_ZIPS;

export function isValidSku(sku: string): sku is SkuId {
  return sku in SKU_TO_ZIPS;
}
