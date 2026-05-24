/**
 * Shop catalog — mirrors landing/src/data/pricing.js structure.
 * Shop tab shows the SAME products as landing, grouped the same way.
 * Payhip = source of truth for prices. Phase 1.4 webhook maps SKU → packs.
 */

export type ProductType = 'starter' | 'vocab-upgrade' | 'pdf' | 'csv' | 'bundle' | 'pdf-bundle' | 'full-bundle' | 'first-edition';

export type Product = {
  slug: string;       // Payhip slug (e.g. 'n4-bundle')
  name: string;       // Display label
  type: ProductType;
  price: number;      // THB · 0 = free
  was?: number;       // Strikethrough
  save?: number;
  desc?: string;
  grantsApp: boolean; // True if buying this unlocks content in app
};

export type LevelGroup = {
  level: string;      // 'N5' | 'N4' | ... | 'N1'
  kanji: string;      // Display kanji
  blurb: string;
  products: Product[];
};

const PAYHIP_CODES: Record<string, string> = {
  'n5-starter':    'zIqYe',
  'n5-vocab-v2':   'GeoNg',
  'n4-pdf':        'VlpGw',
  'n4-csv':        'VQTAk',
  'n4-bundle':     '0uk8y',
  'n3-pdf':        'KY6k7',
  'n3-csv':        'm0Nrh',
  'n3-bundle':     '2XwzZ',
  'n2-pdf':        'Vlq65',
  'n2-csv':        'lsvFp',
  'n2-bundle':     'a39xU',
  'n1-pdf':        'aXBoJ',
  'n1-csv':        'fGm32',
  'n1-bundle':     'ut1XH',
  'pdf-bundle':    '4njgv',
  'full-bundle':   'CFv7l',
  'first-edition': 'AvbVT',
};

export function buyUrl(slug: string): string {
  const code = PAYHIP_CODES[slug];
  return code ? `https://payhip.com/b/${code}` : '#';
}

export const perLevel: LevelGroup[] = [
  {
    level: 'N5',
    kanji: '五',
    blurb: 'GLOSSARY · GRAMMAR · KANJI · VOCAB Vol.1 (ฟรี)',
    products: [
      { slug: 'n5-starter',  name: 'N5 Starter',       type: 'starter',       price: 0,   grantsApp: true, desc: 'ใน Browse แล้ว · ไม่ต้องซื้อ' },
      { slug: 'n5-vocab-v2', name: 'N5 Vocab Vol.2',   type: 'vocab-upgrade', price: 99,  grantsApp: true, desc: 'เสริม starter · 350+ คำเพิ่ม' },
    ],
  },
  {
    level: 'N4',
    kanji: '四',
    blurb: '170 kanji · 600 vocab',
    products: [
      { slug: 'n4-pdf',    name: 'N4 PDF',    type: 'pdf',    price: 169, grantsApp: false, desc: 'อ่านอย่างเดียว · ไม่เปิดในแอป' },
      { slug: 'n4-csv',    name: 'N4 CSV',    type: 'csv',    price: 129, grantsApp: true,  desc: 'เปิดในแอป' },
      { slug: 'n4-bundle', name: 'N4 Bundle', type: 'bundle', price: 249, save: 49, grantsApp: true, desc: 'PDF + CSV · ครบเซ็ต' },
    ],
  },
  {
    level: 'N3',
    kanji: '三',
    blurb: '370 kanji · 1.7K vocab',
    products: [
      { slug: 'n3-pdf',    name: 'N3 PDF',    type: 'pdf',    price: 199, grantsApp: false, desc: 'อ่านอย่างเดียว · ไม่เปิดในแอป' },
      { slug: 'n3-csv',    name: 'N3 CSV',    type: 'csv',    price: 149, grantsApp: true,  desc: 'เปิดในแอป' },
      { slug: 'n3-bundle', name: 'N3 Bundle', type: 'bundle', price: 299, save: 49, grantsApp: true, desc: 'PDF + CSV · ครบเซ็ต' },
    ],
  },
  {
    level: 'N2',
    kanji: '二',
    blurb: '370 kanji · 1.8K vocab · ระดับยอดนิยม',
    products: [
      { slug: 'n2-pdf',    name: 'N2 PDF',    type: 'pdf',    price: 229, grantsApp: false, desc: 'อ่านอย่างเดียว · ไม่เปิดในแอป' },
      { slug: 'n2-csv',    name: 'N2 CSV',    type: 'csv',    price: 169, grantsApp: true,  desc: 'เปิดในแอป' },
      { slug: 'n2-bundle', name: 'N2 Bundle', type: 'bundle', price: 349, save: 49, grantsApp: true, desc: 'PDF + CSV · ครบเซ็ต' },
    ],
  },
  {
    level: 'N1',
    kanji: '一',
    blurb: '1.2K kanji · 3.4K vocab · ไม่มีอะไรถูกตัดออก',
    products: [
      { slug: 'n1-pdf',    name: 'N1 PDF',    type: 'pdf',    price: 339, grantsApp: false, desc: 'อ่านอย่างเดียว · ไม่เปิดในแอป' },
      { slug: 'n1-csv',    name: 'N1 CSV',    type: 'csv',    price: 209, grantsApp: true,  desc: 'เปิดในแอป' },
      { slug: 'n1-bundle', name: 'N1 Bundle', type: 'bundle', price: 499, save: 49, grantsApp: true, desc: 'PDF + CSV · ครบเซ็ต' },
    ],
  },
];

export const bundles: Product[] = [
  {
    slug: 'pdf-bundle',
    name: 'PDF Bundle',
    type: 'pdf-bundle',
    price: 1290,
    was: 1495,
    save: 205,
    desc: 'PDF ทุกระดับ N5–N1 · อ่านอย่างเดียว ไม่เปิดในแอป',
    grantsApp: false,
  },
  {
    slug: 'full-bundle',
    name: 'Full Bundle',
    type: 'full-bundle',
    price: 1790,
    was: 2089,
    save: 299,
    desc: 'PDF + CSV ทุกระดับ N5–N1 · วงจรเรียนครบ',
    grantsApp: true,
  },
  {
    slug: 'first-edition',
    name: 'First Edition',
    type: 'first-edition',
    price: 3290,
    desc: 'Full Bundle + ชุดในอนาคตฟรี + early access + name in credits · LIMITED 75',
    grantsApp: true,
  },
];

export const LANDING_URL = 'https://nihon-bunkai-landing.pages.dev';
