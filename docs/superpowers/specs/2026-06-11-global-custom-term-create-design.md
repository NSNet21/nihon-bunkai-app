# ออกแบบ Global Custom Term Create

วันที่: 2026-06-11

## เป้าหมาย

เพิ่ม flow สำหรับสร้างคำใหม่แบบ global เพื่อให้ผู้เรียนสร้าง User Content term ได้โดยไม่ต้องเปิด deck เดิมก่อน

feature นี้ปิด loop ของ custom content แบบ local-first:

1. เขียนคำที่อยากเพิ่ม
2. เลือกว่าจะเก็บไว้ที่ไหน
3. บันทึกลง existing custom deck หรือ new custom deck
4. เพิ่มคำต่อได้เร็วโดยไม่ถูกเด้งออกจาก flow

Official Source ยัง immutable เหมือนเดิม flow นี้เขียนเฉพาะ User Content / Custom Deck เท่านั้น

## Scope

รวมในงานนี้:

- Mobile-first create flow
- route/page สำหรับ mobile
- modal หรือ sheet จาก Browse/Library สำหรับ tablet/desktop
- shared logic สำหรับ destination, deck, และ form ระหว่าง mobile route กับ modal
- เลือก existing group + section ได้
- สร้าง new group + section ได้
- เลือก existing custom/manual deck ได้
- สร้าง new custom deck ได้
- save แล้วอยู่ต่อเพื่อเพิ่มคำถัดไป พร้อม toast link ไป Term Preview ของคำที่เพิ่งสร้าง
- concise `E` markdown help ใกล้ editor ของ `E`
- targeted tests และ short regression sweep

ไม่รวมในงานนี้:

- แก้ Official Source เป็น source data
- sync custom terms ไป Supabase
- Google Drive backup
- bulk manual entry แบบ spreadsheet
- full TH/EN copy toggle
- central progress dashboard

## UX Shape

### Mobile

Mobile ใช้ first-class route/page เปิดจาก future Browse bottom action slot

หน้า mobile ใช้ underlying flow component ตัวเดียวกับ desktop/tablet แต่แสดงเป็น full-screen page ที่ scroll ได้ดี แทนการยัด flow หนัก ๆ ลง modal บนจอเล็ก

route ที่แนะนำ:

- `/term/new`

route นี้ควรมี back behavior ปกติบน mobile และถ้าเปิด direct URL มา ควร fallback กลับ Browse ได้อย่างปลอดภัย

### Tablet / Desktop

Tablet และ desktop เปิด flow เดียวกันจาก Browse/Library เป็น modal หรือ sheet

modal ควรรู้สึกใกล้กับ Library Actions / import destination surfaces ที่มีอยู่:

- header fixed
- scroll lane เดียวที่ modal เป็นเจ้าของ
- footer save action
- footer ไม่ถูกตัด
- ไม่มี double scrollbar
- ไม่มี horizontal overflow ของ page

modal ไม่ควรปิดเองหลัง save สำเร็จ ต้องปิดเมื่อผู้ใช้กด close/cancel เอง หรือกด toast เพื่อไป Term Preview

## ลำดับ Step

ลำดับ flow:

1. ใส่ `T / D / P / E`
2. เลือก destination group + section
3. เลือก existing custom deck หรือ create new custom deck
4. Save

ลำดับนี้ตรงกับ mental model ของผู้เรียนมากกว่า: เขียนคำก่อน แล้วค่อยตัดสินใจว่าจะเก็บไว้ที่ไหน

## Step 1: Term Fields

Fields:

- `T`: คำศัพท์ / Japanese expression
- `D`: ความหมายภาษาไทย
- `P`: คำอ่าน / pronunciation
- `E`: รายละเอียดหรือ note แบบ markdown

Validation:

- `T` required หลัง trim
- `D` required หลัง trim
- `P` optional
- `E` optional
- ใช้ normalization และ save validation จาก `term-editing-form` เดิมเท่าที่เหมาะสม

`E` markdown help:

- help ต้องสั้นและอยู่ใกล้ field `E`
- แสดงตัวอย่าง heading, bold label, blockquote/reading note, และ separator
- v1 ยังไม่ต้องทำเป็น docs page ใหญ่
- ถ้า help ที่ละเอียดกว่านี้ทำให้ UI หนาเกินไป ค่อยย้าย full guide ไป Settings/Help ภายหลัง

## Step 2: Destination Group + Section

Destination picker ควร reuse behavior และ data model จาก Import Destination

ต้องรองรับ:

- list existing User Content / manual import groups
- list sections ภายใน selected group
- create new group
- create new section
- ถ้าแสดง Official Source hierarchy ให้แสดงเป็น disabled context เท่านั้น

logic ปัจจุบันของ import destination อยู่ที่:

- `src/components/library-actions-modal.tsx`
- `src/lib/import-export/import-destination.ts`

implementation ควร extract reusable pieces แทนการ copy behavior แยก:

- shared destination option builder หรือ adapter
- shared destination picker component ถ้าทำได้คุ้ม
- shared group/section validation และ disabled-official behavior

destination ที่เลือกต้องเขียน metadata เดียวกับที่ Browse, Group Search, Deck Actions, Export, และ Backup ใช้อยู่:

- `userGroup`
- `userSection`
- tag แบบ `group:*` / `section:*` เฉพาะจุดที่ existing helpers ยังต้องใช้

## Step 3: Deck Choice

หลังเลือก group/section แล้ว ผู้เรียนเลือกว่าจะเก็บ term นี้ไว้ใน deck ไหนของ destination นั้น

Options:

- existing user-editable deck ใน selected group/section
- create new custom deck ใน selected group/section

Official decks ต้องเลือกเป็น save target ไม่ได้

การสร้าง new deck ต้อง require deck title ที่ไม่ว่าง term แรกที่ save จะเป็น row `NO = 1` ของ deck นั้น

ถ้า save เข้า existing deck ให้ append ด้วย next row number behavior เดิม:

- `NO = max(existing no) + 1`
- preserve row numbers เดิม
- update deck `entryCount`
- update deck `updatedAt`

## Save Behavior

หลัง save สำเร็จ:

- reset `T / D / P / E`
- keep selected group/section/deck เดิมไว้
- keep flow open เพื่อให้เพิ่มคำถัดไปได้เร็ว
- show toast เล็ก ๆ: `บันทึกคำแล้ว · เปิดดู`
- กด toast แล้ว navigate ไป Term Preview ของคำที่เพิ่งสร้าง

บน mobile กด toast แล้วออกจาก create route ไป:

- `/deck/:deckId/term/:entryId`

บน tablet/desktop modal กด toast แล้วควรปิด modal ก่อน จากนั้น navigate ไป Term Preview

ถ้า save fail:

- keep fields ที่ผู้ใช้พิมพ์ไว้
- show inline status ใกล้ save action
- ไม่ clear form

## Architecture

สร้าง shared flow component เช่น:

- `src/components/custom-term-create-flow.tsx`

component นี้เป็นเจ้าของ:

- term form state
- destination selection state
- deck selection / new deck state
- save status
- toast/link state
- calls ไปที่ library-management helpers

ใช้ shell สองแบบ:

- mobile route shell: `src/app/term/new.tsx`
- Browse/Library modal shell: mount จาก `src/app/(tabs)/index.tsx`

shell ควรรับผิดชอบแค่ entry/exit presentation และ navigation ส่วน behavior หลักอยู่ใน shared flow

## Data Helpers

extend `src/lib/library-management.ts` แบบแคบ ๆ สำหรับ global creation

helper shape ที่แนะนำ:

- `createUserLibraryDeckWithEntry(input)`
- หรือ `createGlobalUserLibraryEntry(input)`

helper ต้องรองรับ:

- existing deck id + fields
- new deck title + organization + fields
- normalized fields
- user-content metadata
- dispatch library change event

ควรใช้ storage helpers เดิม:

- `putLibraryDeck`
- `putLibraryEntriesRecord`
- `createUserLibraryEntry`
- `listLibraryDecks`

ห้าม rewrite Local Library storage และห้าม mutate Official Source

## State Refresh

ใช้ event path เดิม `DECKS_IMPORTED_EVENT` / local library changed event เพื่อ notify:

- Browse hierarchy
- Group Search
- Search corpus
- Export picker
- Backup/restore summaries เท่าที่เกี่ยว

ถ้าต้องเพิ่ม event detail ให้ใช้ `source: 'user-content'` และ action เช่น:

- `deck-create`
- `term-create`

อย่าเพิ่ม event system ชุดที่สอง

## Copy

Thai-first copy

labels ที่แนะนำ:

- Entry point: `เพิ่มคำ`
- Page/modal title: `เพิ่มคำใหม่`
- Step 1: `เขียนคำ`
- Step 2: `เก็บไว้ที่ไหน`
- Step 3: `เลือก deck`
- Save: `บันทึกคำ`
- Toast: `บันทึกคำแล้ว · เปิดดู`

copy ควรนิ่ง ชัด และ practical ไม่ต้องมี gamified/SaaS encouragement

## Risks

Regression risk เป็น medium-low ถ้า implementation reuse destination และ term creation paths เดิม

risks หลัก:

- Browse hierarchy ไม่ refresh หลังสร้าง new deck
- Search ไม่ pick up term ใหม่
- Export หรือ backup ไม่รวม custom deck/term ใหม่
- modal footer หรือ scroll lane ถูกตัดบน desktop/tablet
- mobile route มี back behavior แปลก
- Official Source เผลอ selectable
- destination picker behavior drift จาก import/batch import

## Verification

Unit tests:

- create term ใน existing custom deck ผ่าน global flow helper
- create new deck + first term ใน new group/section
- reject official deck as target
- keep next `NO` behavior สำหรับ existing decks
- destination option builder ยัง disable Official Source
- preserve metadata ที่ export/backup ต้องเห็น

Smoke / browser checks:

- mobile Browse -> Add term -> fill fields -> create new group/section/deck -> save
- toast appears และเปิด Term Preview ได้
- กลับมาที่ create flow แล้ว destination/deck เดิมยังอยู่ แต่ fields ถูก clear
- desktop/tablet Browse -> Add term modal -> existing group/section/deck -> save
- Browse hierarchy แสดง deck ที่สร้าง
- Search หา term ที่สร้างเจอ
- Export/backup surfaces ไม่ error
- console errors = 0
- horizontal overflow = 0
- modal footer visible

Short regression sweep หลัง implementation:

- `pnpm vitest run`
- targeted custom-term/global-create tests
- existing import/export smoke ถ้า extract destination picker แล้วแตะ Library Actions
- focused Playwright mobile + desktop checks สำหรับ Browse, create flow, Term Preview, Search, และ modal layout

## Acceptance Criteria

- ผู้เรียนสร้าง custom term ได้โดยไม่ต้องเปิด existing deck ก่อน
- flow รองรับ existing และ new group/section destinations
- flow รองรับ existing และ new custom decks
- Official Source เลือกเป็น save target ไม่ได้
- save แล้ว reset term fields, keep destination/deck, และ show clickable toast ไป Term Preview
- created content แสดงใน Browse และ Search
- created content อยู่ใน local backup/export behavior ผ่าน Local Library data เดิม
- mobile ใช้ route/page; tablet/desktop ใช้ Browse/Library modal หรือ sheet
- shared core flow ถูก reuse ทั้งสอง surface
