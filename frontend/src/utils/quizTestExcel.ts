import * as XLSX from 'xlsx';

/**
 * Universal test uchun Excel o'qish.
 *
 * Mavjud `parseExcelQuestions` faqat 4 variantli yopiq savolni biladi.
 * Bu yerda ochiq savol ham, 2–6 variant ham, ko'p to'g'ri javob ham bor.
 *
 * Kutilayotgan ustunlar (sarlavha qatori majburiy emas, lekin tavsiya etiladi):
 *
 *   A: Savol matni                     (majburiy)
 *   B: Tur — "ochiq" yoki "yopiq"      (bo'sh = yopiq)
 *   C–H: Variantlar (yopiq savol uchun, 2 tadan 6 tagacha)
 *   I: To'g'ri javob                   (raqam, harf yoki matn; ko'p javob vergul bilan)
 *   J: Ball                            (bo'sh = 1)
 *
 * Ochiq savolda C ustunidan boshlab qabul qilinadigan javoblar yoziladi,
 * I ustuni esa e'tiborga olinmaydi.
 */

export interface ParsedQuestion {
  type: 'closed' | 'open';
  text: string;
  options?: string[];
  correctIndexes?: number[];
  acceptedAnswers?: string[];
  points: number;
  /** Foydalanuvchiga ko'rsatiladigan ogohlantirish (qator qabul qilingan, lekin e'tibor talab qiladi) */
  warning?: string;
}

export interface ParseResult {
  questions: ParsedQuestion[];
  skipped: { row: number; reason: string }[];
}

const LETTER_INDEX: Record<string, number> = {
  a: 0, b: 1, c: 2, d: 3, e: 4, f: 5,
  а: 0, б: 1, в: 2, г: 3, д: 4, е: 5, // kirill
};

function cell(row: any[], i: number): string {
  const v = row[i];
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

/** Sarlavha qatorini aniqlash — birinchi katakda "savol" so'zi bo'lsa. */
function looksLikeHeader(row: any[]): boolean {
  const first = cell(row, 0).toLowerCase();
  return (
    first.includes('savol') ||
    first.includes('вопрос') ||
    first.includes('question')
  );
}

function isOpenType(value: string): boolean {
  const v = value.toLowerCase();
  return (
    v.startsWith('ochiq') ||
    v.startsWith('open') ||
    v.startsWith('откр') ||
    v === 'o' ||
    v === 'text'
  );
}

/**
 * To'g'ri javob ustunini indekslarga aylantiradi.
 * Qabul qilinadigan shakllar: "1", "3", "A", "b", "1,3", "A,C", yoki variant matni.
 */
function parseCorrect(raw: string, options: string[]): number[] {
  if (!raw) return [];

  const parts = raw
    .split(/[,;/]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const out = new Set<number>();

  for (const part of parts) {
    const lower = part.toLowerCase();

    // 1) Variant matni bilan aynan mos kelsa
    const byText = options.findIndex(
      (o) => o.length > 0 && o.toLowerCase() === lower
    );
    if (byText !== -1) {
      out.add(byText);
      continue;
    }

    // 2) Harf: A / B / C ...
    if (lower.length === 1 && LETTER_INDEX[lower] !== undefined) {
      const idx = LETTER_INDEX[lower];
      if (idx < options.length) out.add(idx);
      continue;
    }

    // 3) Raqam. 1-dan boshlanadigan sanoq keng tarqalgan, lekin 0 ham uchraydi.
    const num = Number(part);
    if (Number.isFinite(num)) {
      const asOneBased = Math.round(num) - 1;
      const asZeroBased = Math.round(num);
      if (asOneBased >= 0 && asOneBased < options.length) out.add(asOneBased);
      else if (asZeroBased >= 0 && asZeroBased < options.length) out.add(asZeroBased);
    }
  }

  return [...out].sort((a, b) => a - b);
}

export function parseQuizTestRows(rows: any[][]): ParseResult {
  const questions: ParsedQuestion[] = [];
  const skipped: { row: number; reason: string }[] = [];

  let start = 0;
  if (rows.length > 0 && looksLikeHeader(rows[0])) start = 1;

  for (let i = start; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const rowNo = i + 1;

    const text = cell(row, 0);
    if (!text) continue; // bo'sh qator — jim o'tkazamiz

    const typeRaw = cell(row, 1);
    const type: 'closed' | 'open' = isOpenType(typeRaw) ? 'open' : 'closed';

    // C–H ustunlari
    const rawOptions = [2, 3, 4, 5, 6, 7].map((c) => cell(row, c));
    const pointsRaw = cell(row, 9);
    const points = Number(pointsRaw) > 0 ? Number(pointsRaw) : 1;

    if (type === 'open') {
      const accepted = rawOptions.filter(Boolean);
      questions.push({
        type: 'open',
        text,
        acceptedAnswers: accepted,
        points,
        warning:
          accepted.length === 0
            ? 'javob namunasi yo\'q — qo\'lda baholanadi'
            : undefined,
      });
      continue;
    }

    const options = rawOptions.filter(Boolean);
    if (options.length < 2) {
      skipped.push({ row: rowNo, reason: 'kamida 2 ta variant kerak' });
      continue;
    }

    const correctIndexes = parseCorrect(cell(row, 8), options);
    if (correctIndexes.length === 0) {
      skipped.push({
        row: rowNo,
        reason: 'to\'g\'ri javob o\'qilmadi (I ustuni)',
      });
      continue;
    }

    questions.push({
      type: 'closed',
      text,
      options,
      correctIndexes,
      points,
      warning:
        correctIndexes.length > 1 ? 'bir nechta to\'g\'ri javob' : undefined,
    });
  }

  return { questions, skipped };
}

/** Faylni o'qib, birinchi varaqni tahlil qiladi. */
export async function parseQuizTestFile(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, blankrows: false });
  return parseQuizTestRows(rows);
}

/** Mentor yuklab oladigan namuna fayl. */
export function downloadTemplate() {
  const rows = [
    [
      'Savol matni',
      'Tur (yopiq/ochiq)',
      'Variant 1 / Javob 1',
      'Variant 2 / Javob 2',
      'Variant 3',
      'Variant 4',
      'Variant 5',
      'Variant 6',
      "To'g'ri javob",
      'Ball',
    ],
    [
      "O'zbekiston poytaxti qaysi shahar?",
      'yopiq',
      'Samarqand',
      'Toshkent',
      'Buxoro',
      'Xiva',
      '',
      '',
      '2',
      '1',
    ],
    [
      'HTML nimaning qisqartmasi?',
      'yopiq',
      'Hyper Text Markup Language',
      'High Tech Modern Language',
      '',
      '',
      '',
      '',
      'A',
      '2',
    ],
    [
      'Quyidagilardan qaysilari dasturlash tili?',
      'yopiq',
      'Python',
      'HTML',
      'JavaScript',
      'CSS',
      '',
      '',
      '1,3',
      '2',
    ],
    [
      "Make platformasida jarayonni boshlaydigan modul nima deb ataladi?",
      'ochiq',
      'trigger',
      'trigger moduli',
      '',
      '',
      '',
      '',
      '',
      '1',
    ],
    [
      'Bugungi darsdan nimani o\'rgandingiz?',
      'ochiq',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '3',
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 46 }, { wch: 18 }, { wch: 26 }, { wch: 26 }, { wch: 18 },
    { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 7 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Savollar');
  XLSX.writeFile(wb, 'test-savollari-namuna.xlsx');
}

/** Natijalarni Excel qilib yuklash. */
export function exportResults(
  testTitle: string,
  attempts: {
    fullName: string;
    phone: string | null;
    attemptNumber: number;
    status: string;
    score: number | null;
    maxScore: number | null;
    percent: number | null;
    correctCount: number | null;
    passed: boolean | null;
    submittedAt: string | null;
  }[]
) {
  const rows = [
    ['Ism-familiya', 'Telefon', 'Urinish', 'Holat', 'Ball', 'Maks', 'Foiz', "To'g'ri", 'Natija', 'Topshirilgan'],
    ...attempts.map((a) => [
      a.fullName,
      a.phone ?? '',
      a.attemptNumber,
      a.status === 'submitted' ? 'Yakunlangan' : a.status === 'in_progress' ? 'Jarayonda' : 'Muddati tugagan',
      a.score ?? '',
      a.maxScore ?? '',
      a.percent ?? '',
      a.correctCount ?? '',
      a.passed === null ? '' : a.passed ? "O'tdi" : "O'tmadi",
      a.submittedAt ? new Date(a.submittedAt).toLocaleString('uz-UZ') : '',
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 28 }, { wch: 16 }, { wch: 9 }, { wch: 14 }, { wch: 8 },
    { wch: 8 }, { wch: 8 }, { wch: 9 }, { wch: 11 }, { wch: 20 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Natijalar');
  const safe = testTitle.replace(/[\\/:*?"<>|]/g, '').slice(0, 60) || 'test';
  XLSX.writeFile(wb, `${safe} — natijalar.xlsx`);
}
