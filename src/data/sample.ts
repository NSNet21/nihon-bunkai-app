/**
 * Sample data — Phase 1.1 UI scaffold only.
 * Format matches the 5-column CSV (NO, T, D, P, E) that customers receive.
 * Real free data extraction lands in Phase 1.2.
 */

import type { Deck, Entry } from './types';

export const sampleEntries: Entry[] = [
  {
    id: 'vocab-n5-1', type: 'vocab', level: 'N5',
    no: 1,
    t: '毎朝',
    d: 'ทุกเช้า',
    p: 'まいあさ',
    e: `### คำอธิบาย
'毎朝' (まいあさ) ประกอบจาก 毎 (mai · ทุกๆ) + 朝 (asa · เช้า) → 'ทุกเช้า'

---

### ตัวอย่าง

**1.** 毎朝(まいあさ)コーヒーを飲(の)みます。
> まいあさ コーヒーを のみます。
> ดื่มกาแฟทุกเช้า`,
  },
  {
    id: 'vocab-n5-2', type: 'vocab', level: 'N5',
    no: 2,
    t: '問題',
    d: 'ปัญหา, คำถาม, โจทย์',
    p: 'もんだい',
    e: `### คำอธิบาย
'問題' = 問 (mon · คำถาม) + 題 (dai · หัวข้อ) → 'หัวข้อที่เป็นปัญหา'`,
  },
  {
    id: 'vocab-n5-3', type: 'vocab', level: 'N5',
    no: 3,
    t: '学校',
    d: 'โรงเรียน',
    p: 'がっこう',
    e: `### คำอธิบาย
名詞 (meishi) แปลตรงตัวว่า 'โรงเรียน'`,
  },
  {
    id: 'kanji-n5-1', type: 'kanji', level: 'N5',
    no: 1,
    t: '日',
    d: 'วัน, ดวงอาทิตย์',
    p: 'にち / ひ',
    e: `### การอ่าน
- **音読み (onyomi):** ニチ・ジツ
- **訓読み (kunyomi):** ひ・か

### ความหมาย
รากของวัน เวลา และพระอาทิตย์`,
  },
  {
    id: 'kanji-n5-2', type: 'kanji', level: 'N5',
    no: 2,
    t: '月',
    d: 'เดือน, ดวงจันทร์',
    p: 'げつ / つき',
    e: `### การอ่าน
- **音読み:** ゲツ・ガツ
- **訓読み:** つき`,
  },
  {
    id: 'grammar-n5-1', type: 'grammar', level: 'N5',
    no: 1,
    t: 'です',
    d: 'เป็น, อยู่, คือ (สุภาพ)',
    p: 'desu',
    e: `### คำอธิบาย
助動詞 (jodōshi) คำลงท้ายสุภาพประจำประโยค

### ตัวอย่าง
**1.** 私(わたし)は学生(がくせい)です。
> わたしは がくせい です。
> ฉันเป็นนักเรียน`,
  },
  {
    id: 'grammar-n5-2', type: 'grammar', level: 'N5',
    no: 2,
    t: 'が',
    d: 'particle ชี้ประธาน / ขัดแย้ง',
    p: 'ga',
    e: `### คำอธิบาย
助詞 (joshi) — ใช้ชี้ประธานของประโยค (ใหม่/เน้น) หรือเชื่อมประโยคแบบขัดแย้ง`,
  },
  {
    id: 'glossary-1', type: 'glossary', level: null,
    no: 1,
    t: '助詞',
    d: 'คำช่วย (particle)',
    p: 'joshi',
    e: `### คำอธิบาย
คำที่ติดหลังคำนาม/กริยา ระบุหน้าที่ในประโยค เช่น は が を に で

### ตัวอย่าง
**1.** 私(わたし)**は** 日本語(にほんご)**を** 勉強(べんきょう)します。
> は = topic particle, を = object particle`,
  },
];

export const sampleDecks: Deck[] = [
  { id: 'vocab-n5',   type: 'vocab',    level: 'N5', title: 'Vocab · N5',   entryCount: 3, isFree: true },
  { id: 'kanji-n5',   type: 'kanji',    level: 'N5', title: 'Kanji · N5',   entryCount: 2, isFree: true },
  { id: 'grammar-n5', type: 'grammar',  level: 'N5', title: 'Grammar · N5', entryCount: 2, isFree: true },
  { id: 'glossary',   type: 'glossary', level: null, title: 'Glossary',     entryCount: 1, isFree: true },
  { id: 'vocab-n4',   type: 'vocab',    level: 'N4', title: 'Vocab · N4',   entryCount: 0, isFree: false },
  { id: 'kanji-n4',   type: 'kanji',    level: 'N4', title: 'Kanji · N4',   entryCount: 0, isFree: false },
  { id: 'grammar-n4', type: 'grammar',  level: 'N4', title: 'Grammar · N4', entryCount: 0, isFree: false },
];

export function entriesForDeck(deckId: string): Entry[] {
  return sampleEntries.filter(
    (e) => `${e.type}${e.level ? `-${e.level.toLowerCase()}` : ''}` === deckId,
  );
}
