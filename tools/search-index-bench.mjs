import Fuse from 'fuse.js';
import { isHiragana, isKatakana, toHiragana, toKana, toKatakana } from 'wanakana';

const count = Number(process.argv[2] || 12_000);

const options = {
  keys: [
    { name: 't', weight: 1.0 },
    { name: 'd', weight: 0.8 },
    { name: 'p', weight: 0.6 },
  ],
  threshold: 0.2,
  ignoreLocation: true,
  minMatchCharLength: 2,
  includeScore: true,
  includeMatches: true,
  shouldSort: true,
};

function now() {
  return Number(process.hrtime.bigint() / 1_000_000n);
}

function normalizeReadings(raw) {
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .flatMap((line) =>
      line
        .replace(/^(Kunyomi|Onyomi|くんよみ|おんよみ|訓読み|音読み)\s*[:：]\s*/i, '')
        .split(/[、,/／・]/),
    )
    .map((tok) => tok.replace(/[.．\s()（）\[\]【】「」『』]/g, '').trim())
    .filter((tok) => tok.length > 0);
}

function expandReadings(raw) {
  const tokens = normalizeReadings(raw);
  const out = new Set();
  for (const tok of tokens) {
    out.add(tok);
    try {
      if (isHiragana(tok)) out.add(toKatakana(tok));
      else if (isKatakana(tok)) out.add(toHiragana(tok));
    } catch {
      // Keep benchmark behavior aligned with app search-index guard.
    }
  }
  return [...out];
}

function normalizeQuery(q) {
  if (q.length < 2) return q;
  if (!/^[a-zA-Z]+$/.test(q)) return q;
  const kana = toKana(q.toLowerCase());
  return kana.length >= 2 ? kana : '';
}

const levels = ['N5', 'N4', 'N3', 'N2', 'N1'];
const types = ['vocab', 'kanji', 'grammar'];
const terms = ['去年', '食べる', '問題', '毎朝', '一緒', '勉強', '学校', '先生', '時間', '旅行'];
const meanings = ['ปีที่แล้ว', 'กิน', 'ปัญหา', 'ทุกเช้า', 'ด้วยกัน', 'เรียน', 'โรงเรียน', 'อาจารย์', 'เวลา', 'ท่องเที่ยว'];
const readings = ['きょねん', 'たべる', 'もんだい', 'まいあさ', 'いっしょ', 'べんきょう', 'がっこう', 'せんせい', 'じかん', 'りょこう'];

const buildProjectionStart = now();
const entries = Array.from({ length: count }, (_, i) => {
  const j = i % terms.length;
  return {
    id: `bench-${i}`,
    deckId: `${types[i % types.length]}-${levels[i % levels.length].toLowerCase()}-pack${String(Math.floor(i / 20) + 1).padStart(2, '0')}`,
    deckTitle: `${types[i % types.length]} ${levels[i % levels.length]}`,
    type: types[i % types.length],
    level: levels[i % levels.length],
    t: `${terms[j]}-${i}`,
    d: `${meanings[j]} ตัวอย่าง ${i}`,
    p: expandReadings(readings[j]),
    no: i + 1,
  };
});
const projectionMs = now() - buildProjectionStart;

const indexStart = now();
const fuse = new Fuse(entries, options);
const indexMs = now() - indexStart;

const queryResults = [];
for (const query of ['去年', 'きょねん', 'kyonen', 'ปัญหา', 'zz-no-hit']) {
  const normalized = normalizeQuery(query);
  const started = now();
  const results = normalized ? fuse.search(normalized, { limit: 50 }) : [];
  queryResults.push({
    query,
    normalized,
    ms: now() - started,
    count: results.length,
    first: results[0]?.item?.t ?? null,
  });
}

console.log(JSON.stringify({
  count,
  projectionMs,
  indexMs,
  queryResults,
  memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
}, null, 2));
