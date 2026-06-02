export const IMPORT_SCHEMA_HEADERS = ['NO', 'T', 'D', 'P', 'E'] as const;

export type ImportHowToStep = {
  key: 'prepare' | 'export' | 'import';
  eyebrow: string;
  title: string;
  body: string;
  image?: 'example-table' | 'download-menu';
};

export const IMPORT_HOW_TO_STEPS: ImportHowToStep[] = [
  {
    key: 'prepare',
    eyebrow: 'STEP 1',
    title: 'เตรียมตาราง',
    body: 'สร้างตารางใน Google Sheets หรือ Excel แล้วใช้ header NO,T,D,P,E หรือ T,D,P,E โดย T คือคำศัพท์, D คือความหมาย, P คือเสียงอ่าน, E คือคำอธิบายเพิ่มเติม',
    image: 'example-table',
  },
  {
    key: 'export',
    eyebrow: 'STEP 2',
    title: 'บันทึกเป็น CSV',
    body: 'เลือกเมนูดาวน์โหลดหรือ export แล้วบันทึกเป็นไฟล์ .csv หากมีหลาย deck สามารถรวมหลาย CSV เป็น ZIP ได้',
    image: 'download-menu',
  },
  {
    key: 'import',
    eyebrow: 'STEP 3',
    title: 'นำเข้า Library',
    body: 'กลับมาที่ Nihon Bunkai เปิด Library actions แล้วเลือก Import one file หรือ Batch import จากนั้นเลือกไฟล์ CSV/ZIP ที่เตรียมไว้',
  },
];
