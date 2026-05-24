/**
 * Client-side mirror of supabase/functions/_shared/sku-map.ts.
 *
 * Kept in sync manually — both sides are small (12 SKUs, low churn).
 * Used for: "is this SKU already fully downloaded?" check in Shop.
 */

export const SKU_TO_ZIPS: Record<string, readonly string[]> = {
  'n5-vocab-v2': ['csv-n5-vol2.zip'],
  'n4-csv':      ['csv-n4.zip'],
  'n4-bundle':   ['csv-n4.zip'],
  'n3-csv':      ['csv-n3.zip'],
  'n3-bundle':   ['csv-n3.zip'],
  'n2-csv':      ['csv-n2.zip'],
  'n2-bundle':   ['csv-n2.zip'],
  'n1-csv':      ['csv-n1.zip'],
  'n1-bundle':   ['csv-n1.zip'],
  'full-bundle':   ['csv-n5-vol2.zip', 'csv-n4.zip', 'csv-n3.zip', 'csv-n2.zip', 'csv-n1.zip'],
  'first-edition': ['csv-n5-vol2.zip', 'csv-n4.zip', 'csv-n3.zip', 'csv-n2.zip', 'csv-n1.zip'],
};

export function getZipsForSku(slug: string): readonly string[] {
  return SKU_TO_ZIPS[slug] ?? [];
}
