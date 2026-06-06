<!-- cspell:disable -->

# ดีไซน์ Loading Polish สำหรับ Browse / Deck Preview

วันที่: 2026-06-07
สถานะ: design draft ที่ตกลงทิศทางแล้ว รอ review
พื้นที่งาน: Companion App

## เป้าหมาย

ทำให้หน้า Browse และ Deck Preview รู้สึกว่าโหลด/แสดงผลอย่างตั้งใจ ไม่ใช่เหมือน UI ต่อชิ้นส่วนขึ้นมาทีละจังหวะจาก async data หลายแหล่ง งานนี้จำกัดเฉพาะ loading/readiness behavior, reserved space, และ motion เบา ๆ ระดับ section เท่านั้น ไม่ใช่การ redesign UI กว้าง ๆ

## ปัญหาปัจจุบัน

Browse และ Deck Preview อ่านข้อมูลจากหลายแหล่งที่พร้อมไม่พร้อมคนละจังหวะ:

- embedded/free decks และ library decks จาก IndexedDB
- Continue sessions จาก localStorage
- progress ของ SRS และ review candidates จาก IndexedDB
- entries ของ deck ที่โหลดแบบ lazy

ข้อมูลเหล่านี้อาจ resolve คนละ frame กัน แม้ข้อมูลถูกต้อง แต่ UI จะรู้สึก flicker ได้ เพราะ Continue, progress, และ list sections โผล่หรือสลับในจังหวะที่เหลื่อมกันเล็กน้อย

## ดีไซน์ Browse

Browse ควรให้ page shell ขึ้นทันที:

- background, accent stripe, ghost kanji, safe area, และ header `// BROWSE` render ทันที
- readiness ของ Continue ยัง gate ด้วย hydration, deck loading, และ SRS review-candidate readiness
- เมื่อรู้ผล Continue readiness แล้ว Browse ใช้ single reveal rule:
  - ถ้ามี Continue ให้แสดง Continue section และ Library section พร้อมกันในจังหวะเดียว
  - ถ้าไม่มี Continue ให้ reveal Library section ทันทีหลังรู้ว่าไม่มี Continue
  - ไม่ทำ staged reveal ระหว่าง Continue กับ Library เพราะจะยังรู้สึกเหมือน UI ประกอบขึ้นมาคนละชั้น

Library section รวม heading `คลังคำศัพท์`, toolbar, และ deck/group rows โดยอยู่ใน reveal group เดียวกับ Continue เมื่อ Continue มีอยู่

ไม่ใช้ shimmer และไม่เพิ่ม row-by-row stagger เพราะจะยิ่งทำให้รู้สึกว่า UI render เป็นชั้น ๆ อยู่

## ดีไซน์ Deck Preview

Deck Preview คง route-level behavior เดิมไว้:

- ถ้า deck route ยัง resolving หรือ not found ให้ใช้ route-state handling เดิม
- เมื่อรู้ deck แล้ว ให้ render Back และ deck hero ตามปกติ
- Progress และ Terms ใช้ reserved pending blocks ระหว่างรอ async reads เสร็จ

Progress pending state ควรอยู่ใน visual block เดียวกับ progress card ตัวจริง ส่วน Terms pending state ควรอยู่ใน lane เดียวกับ result/list area ตัวจริง สำหรับ route นี้ควรถอด spinner ใหญ่กลาง content flow ออก ยกเว้นกรณีที่ทั้ง route ยัง loading อยู่จริง ๆ

## Motion

Motion เป็นระดับ section และต้องเบา:

- Browse main content group: ใช้ opacity + ขยับขึ้นเล็กน้อยประมาณ 4-8 px ได้ ระยะเวลาประมาณ 140-180 ms
- Continue และ Library ไม่ควร animate แยกเป็นคนละ step
- Library เมื่อไม่มี Continue: ขึ้นทันทีหรือใช้ transition ที่สั้นกว่า โดยไม่มีการรอเทียม
- DP pending replacement: สลับ content ภายในพื้นที่ reserved เดิม ด้วย opacity/translate เบา ๆ เท่านั้น

ไม่ animate deck rows หรือ term rows ทีละแถวใน pass นี้

## Implementation Notes

ไฟล์ที่น่าจะเกี่ยวข้อง:

- `src/app/(tabs)/index.tsx`
- `src/app/deck/[deckId]/index.tsx`
- อาจเพิ่ม helper/component เล็ก ๆ สำหรับ editorial pending blocks ถ้าช่วยลด duplication ได้จริง

Browse ควร derive readiness state เล็ก ๆ แทนการกระจาย boolean checks ใน JSX หลายจุด behavior สำคัญคือ:

- `continueClusterReady = hasHydrated && !decksLoading && reviewCandidateReady`
- `hasContinue = showContinueLearn || showFlashcardContinue || showReviewContinue`
- Library reveal ได้เมื่อ `continueClusterReady` โดยอยู่ในกลุ่มเดียวกับ Continue ถ้า Continue มีอยู่

Deck Preview ควรหลีกเลี่ยง empty progress text หรือ spinner ใหญ่ที่ทำให้ rhythm ของหน้าเปลี่ยน ใช้ stable blocks ที่อิง border/background language เดิมของแอป

## Testing / Verification

หลัง implementation ให้ run checks แบบเจาะจง:

- unit tests รอบ readiness helper ถ้ามีการ extract
- existing Continue/progress tests ถ้าแตะ logic ที่เกี่ยวข้อง
- `pnpm smoke:deck-route http://localhost:8097`
- `pnpm smoke:perf http://localhost:8097`
- browser visual checks บน mobile และ desktop สำหรับ Browse และ Deck Preview

Visual checks ควรยืนยันว่า:

- Browse ที่มี Continue แสดง Continue และ Library ใน reveal จังหวะเดียวกัน โดย Continue อยู่เหนือ Library ตามลำดับ layout
- Browse ที่ไม่มี Continue ไม่หน่วง Library โดยไม่จำเป็น
- DP ไม่แสดง spinner ใหญ่กลาง content หลัง hero แสดงแล้ว
- ไม่มี horizontal overflow
- ไม่มี console errors
- known dev warnings ยังยอมรับได้ถ้าไม่เปลี่ยนจากเดิม

## Non-goals

- ไม่ redesign Browse กว้าง ๆ
- ไม่เพิ่ม global Review Queue
- ไม่เพิ่ม deck-row due badges
- ไม่เปลี่ยน FSRS scheduling
- ไม่เปลี่ยน import/export, deck organization, หรือ official/user content rules
- ไม่ทำ full bilingual copy work

<!-- cspell:enable -->
