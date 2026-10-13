import ExcelJS from 'exceljs';
import prisma from '../../config/database';

/**
 * Test natijalari — dizaynli Excel (3 ta varaq).
 *
 *  1. Natijalar      — reyting (foiz bo‘yicha), statistika kartalari, 1–3 o‘rin
 *                      medal rangi, o‘tdi/o‘tmadi ranglari, foizda data bar.
 *  2. Savollar tahlili — har savolga necha kishi to‘g‘ri javob bergani va eng
 *                      ko‘p tanlangan variant (keng tarqalgan xatoni ko‘rsatadi).
 *  3. Javoblar       — har ishtirokchi × har savol: ✓ / ✗ / ? / —.
 *
 * Ilgari natijalar brauzerda SheetJS bilan oddiy jadval qilib yuklanardi —
 * u rang va formatlashni qo‘llamaydi. Endi fayl serverda exceljs bilan quriladi.
 */

const C = {
  navy: 'FF0F1B2D',
  navy2: 'FF1F2937',
  red: 'FFFF2B00',
  white: 'FFFFFFFF',
  ink: 'FF111827',
  muted: 'FF6B7280',
  line: 'FFD5DCE6',
  zebra: 'FFF7F9FC',
  card: 'FFF1F5FB',
  greenBg: 'FFE7F6EC',
  greenFg: 'FF15803D',
  redBg: 'FFFDE8E4',
  redFg: 'FFB91C1C',
  amberBg: 'FFFFF4D6',
  amberFg: 'FF8A4B00',
  gold: 'FFFFF1C2',
  silver: 'FFEEF1F5',
  bronze: 'FFFBE5D2',
  grayBg: 'FFF3F4F6',
};

const fill = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const thin = { style: 'thin' as const, color: { argb: C.line } };
const box: Partial<ExcelJS.Borders> = { top: thin, bottom: thin, left: thin, right: thin };

const TZ = 'Asia/Tashkent';
const dtf = new Intl.DateTimeFormat('ru-RU', {
  timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
const fmtDT = (d?: Date | null) => (d ? dtf.format(d).replace(',', '') : '');
const fmtDur = (from?: Date | null, to?: Date | null) => {
  if (!from || !to) return '';
  const s = Math.max(0, Math.round((to.getTime() - from.getTime()) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Varaq tepasidagi sarlavha bloki */
function titleBlock(ws: ExcelJS.Worksheet, lastCol: string, title: string, subtitle: string, meta: string) {
  ws.mergeCells(`A1:${lastCol}1`);
  const t = ws.getCell('A1');
  t.value = title;
  t.font = { bold: true, size: 15, color: { argb: C.white } };
  t.fill = fill(C.navy);
  t.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(1).height = 30;

  ws.mergeCells(`A2:${lastCol}2`);
  const s = ws.getCell('A2');
  s.value = subtitle;
  s.font = { bold: true, size: 13, color: { argb: C.ink } };
  s.alignment = { vertical: 'middle', indent: 1, wrapText: true };
  ws.getRow(2).height = 24;

  ws.mergeCells(`A3:${lastCol}3`);
  const m = ws.getCell('A3');
  m.value = meta;
  m.font = { size: 10, color: { argb: C.muted } };
  m.alignment = { vertical: 'middle', indent: 1, wrapText: true };
  // Uzun izoh bo‘lsa 2 qatorga sig‘sin (masalan “Javoblar” varag‘i tor)
  ws.getRow(3).height = meta.length > 110 ? 30 : 18;
  // Qizil ingichka chiziq — brend urg‘usi
  for (let i = 0; i < LETTERS.indexOf(lastCol) + 1; i++) {
    ws.getCell(`${LETTERS[i]}3`).border = { bottom: { style: 'medium', color: { argb: C.red } } };
  }
}

function headerRow(row: ExcelJS.Row) {
  row.height = 22;
  row.eachCell((c) => {
    c.font = { bold: true, size: 10, color: { argb: C.white } };
    c.fill = fill(C.navy2);
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    c.border = box;
  });
}

export async function buildResultsWorkbook(testId: string) {
  const test = await prisma.quizTest.findUnique({
    where: { id: testId },
    select: {
      id: true, title: true, code: true, durationMin: true, passPercent: true,
      createdBy: { select: { fullName: true } },
      questions: { orderBy: [{ order: 'asc' }, { id: 'asc' }] },
    },
  });
  if (!test) return null;

  const attempts = await prisma.quizTestAttempt.findMany({
    where: { testId },
    include: { answers: true },
  });

  // Reyting: yakunlanganlar foiz bo‘yicha (teng bo‘lsa — tezroq topshirgan yuqorida), keyin jarayondagilar
  const done = attempts
    .filter((a) => a.status !== 'in_progress')
    .sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1)
      || (a.submittedAt?.getTime() ?? 0) - (b.submittedAt?.getTime() ?? 0));
  const going = attempts.filter((a) => a.status === 'in_progress');
  const ordered = [...done, ...going];

  const pass = test.passPercent;
  const passedN = done.filter((a) => a.passed === true).length;
  const failedN = done.filter((a) => a.passed === false).length;
  const avg = done.length ? Math.round(done.reduce((s, a) => s + (a.percent ?? 0), 0) / done.length) : null;
  const best = done[0];

  const wb = new ExcelJS.Workbook();
  wb.creator = 'IT Live Score';
  wb.created = new Date();

  const meta = [
    `Mentor: ${test.createdBy?.fullName ?? '—'}`,
    `Havola kodi: ${test.code}`,
    `Vaqt: ${test.durationMin} daqiqa`,
    `Savollar bankida: ${test.questions.length} ta`,
    pass !== null ? `O‘tish chegarasi: ${pass}%` : 'O‘tish chegarasi belgilanmagan',
    `Yuklangan: ${fmtDT(new Date())}`,
  ].join('   ·   ');

  // ═════════ 1. Natijalar ═════════
  const ws = wb.addWorksheet('Natijalar', {
    properties: { tabColor: { argb: C.red } },
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  ws.columns = [
    { width: 6 }, { width: 30 }, { width: 16 }, { width: 9 }, { width: 15 }, { width: 10 },
    { width: 10 }, { width: 11 }, { width: 13 }, { width: 17 }, { width: 17 }, { width: 10 },
  ];
  titleBlock(ws, 'L', 'IT LIVE ACADEMY  ·  TEST NATIJALARI', test.title, meta);

  // Statistika kartalari (5–6-qatorlar)
  const cards: [string, string, string | number, string][] = [
    ['A', 'B', attempts.length, 'Ishtirokchilar'],
    ['C', 'D', done.length, 'Yakunlagan'],
    ['E', 'F', avg === null ? '—' : `${avg}%`, 'O‘rtacha natija'],
    ['G', 'I', pass === null ? '—' : `${passedN} / ${failedN}`, 'O‘tdi / O‘tmadi'],
    ['J', 'L', best ? `${best.percent ?? 0}% — ${best.fullName}` : '—', 'Eng yuqori natija'],
  ];
  ws.getRow(5).height = 18;
  ws.getRow(6).height = 28;
  for (const [from, to, value, label] of cards) {
    ws.mergeCells(`${from}5:${to}5`);
    ws.mergeCells(`${from}6:${to}6`);
    const l = ws.getCell(`${from}5`);
    l.value = label.toUpperCase();
    l.font = { size: 8, bold: true, color: { argb: C.muted } };
    l.fill = fill(C.card);
    l.alignment = { vertical: 'bottom', indent: 1 };
    const v = ws.getCell(`${from}6`);
    v.value = value;
    v.font = { size: typeof value === 'string' && value.length > 14 ? 11 : 16, bold: true, color: { argb: C.navy } };
    v.fill = fill(C.card);
    v.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  }

  const HEAD = 8;
  const hr = ws.getRow(HEAD);
  hr.values = ['№', 'Ism-familiya', 'Telefon', 'Urinish', 'Holat', 'To‘g‘ri', 'Ball', 'Foiz', 'Natija', 'Boshlagan', 'Topshirgan', 'Vaqt'];
  headerRow(hr);

  ordered.forEach((a, i) => {
    const isDone = a.status !== 'in_progress';
    const rank = isDone ? i + 1 : null;
    const total = ((a.questionIds as string[]) ?? []).length;
    const holat = !isDone ? 'Jarayonda' : a.needsReview ? 'Tekshirilmoqda' : 'Yakunlangan';
    const natija = !isDone || a.needsReview ? '—' : a.passed === null ? '—' : a.passed ? 'O‘tdi' : 'O‘tmadi';
    const row = ws.addRow([
      rank ?? '—',
      a.fullName,
      a.phone ?? '',
      a.attemptNumber,
      holat,
      isDone ? `${a.correctCount ?? 0} / ${total}` : '',
      isDone ? `${a.score ?? 0} / ${a.maxScore ?? 0}` : '',
      isDone ? (a.percent ?? 0) / 100 : null,
      natija,
      fmtDT(a.startedAt),
      isDone ? fmtDT(a.submittedAt) : '',
      isDone ? fmtDur(a.startedAt, a.submittedAt) : '',
    ]);
    row.height = 20;
    const medal = rank === 1 ? C.gold : rank === 2 ? C.silver : rank === 3 ? C.bronze : i % 2 ? C.zebra : null;
    row.eachCell({ includeEmpty: true }, (c, col) => {
      c.border = box;
      c.font = { size: 10, color: { argb: C.ink }, bold: col === 2 && !!rank && rank <= 3 };
      c.alignment = { vertical: 'middle', horizontal: col === 2 || col === 3 ? 'left' : 'center', indent: col === 2 ? 1 : 0 };
      if (medal) c.fill = fill(medal);
    });
    // 1–3 o‘rin oltin/kumush/bronza fon bilan ajralib turadi (emoji ba’zi
    // shriftlarda “▯” bo‘lib chiqardi — shuning uchun faqat rang)
    if (rank && rank <= 3) row.getCell(1).font = { size: 10, bold: true, color: { argb: C.ink } };
    row.getCell(8).numFmt = '0%';
    row.getCell(8).font = { size: 10, bold: true, color: { argb: C.ink } };
    const nat = row.getCell(9);
    if (natija === 'O‘tdi') { nat.fill = fill(C.greenBg); nat.font = { size: 10, bold: true, color: { argb: C.greenFg } }; }
    if (natija === 'O‘tmadi') { nat.fill = fill(C.redBg); nat.font = { size: 10, bold: true, color: { argb: C.redFg } }; }
    const hol = row.getCell(5);
    if (holat === 'Jarayonda') hol.font = { size: 10, italic: true, color: { argb: C.muted } };
    if (holat === 'Tekshirilmoqda') { hol.fill = fill(C.amberBg); hol.font = { size: 10, color: { argb: C.amberFg } }; }
  });

  const last = HEAD + ordered.length;
  if (ordered.length > 0) {
    ws.autoFilter = { from: { row: HEAD, column: 1 }, to: { row: last, column: 12 } };
    // Foiz ustunida data bar — natijalarni bir qarashda solishtirish
    ws.addConditionalFormatting({
      ref: `H${HEAD + 1}:H${last}`,
      rules: [{
        type: 'dataBar', priority: 1, gradient: false,
        cfvo: [{ type: 'num', value: 0 }, { type: 'num', value: 1 }],
        color: { argb: 'FF7FB3E3' },
      } as any],
    });
  } else {
    ws.mergeCells(`A${HEAD + 1}:L${HEAD + 1}`);
    const e = ws.getCell(`A${HEAD + 1}`);
    e.value = 'Hali hech kim ishlamagan';
    e.font = { italic: true, color: { argb: C.muted } };
    e.alignment = { horizontal: 'center' };
  }
  ws.views = [{ state: 'frozen', ySplit: HEAD, showGridLines: false }];
  const foot = ws.getCell(`A${last + 2}`);
  foot.value = 'itlivescore.uz — IT Live Academy test paneli';
  foot.font = { size: 8, italic: true, color: { argb: C.muted } };

  // ═════════ 2. Savollar tahlili ═════════
  const qs = wb.addWorksheet('Savollar tahlili', {
    properties: { tabColor: { argb: 'FF2B5A8C' } },
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  qs.columns = [{ width: 6 }, { width: 62 }, { width: 10 }, { width: 7 }, { width: 12 }, { width: 10 }, { width: 11 }, { width: 38 }];
  titleBlock(qs, 'H', 'SAVOLLAR TAHLILI', test.title, 'Qaysi savol qiyin bo‘lgani: to‘g‘ri javoblar foizi va eng ko‘p tanlangan variant (keng tarqalgan xato qizil).');
  const qh = qs.getRow(5);
  qh.values = ['№', 'Savol', 'Turi', 'Ball', 'Javob berdi', 'To‘g‘ri', 'To‘g‘ri %', 'Eng ko‘p tanlangan javob'];
  headerRow(qh);

  const answersByQ = new Map<string, { selected: unknown; isCorrect: boolean | null; needsReview: boolean }[]>();
  for (const a of done) {
    for (const ans of a.answers) {
      const l = answersByQ.get(ans.questionId) ?? [];
      l.push({ selected: ans.selected, isCorrect: ans.isCorrect, needsReview: ans.needsReview });
      answersByQ.set(ans.questionId, l);
    }
  }

  test.questions.forEach((q, i) => {
    const list = answersByQ.get(q.id) ?? [];
    const correct = list.filter((x) => x.isCorrect === true).length;
    const ratio = list.length ? correct / list.length : null;
    let popular = '';
    let popularWrong = false;
    const options = Array.isArray(q.options) ? (q.options as string[]) : [];
    const correctIdx = Array.isArray(q.correctIndexes) ? (q.correctIndexes as number[]) : [];
    if (q.type === 'closed' && list.length) {
      const counts = new Map<number, number>();
      for (const x of list) {
        if (Array.isArray(x.selected)) for (const s of x.selected as number[]) counts.set(s, (counts.get(s) ?? 0) + 1);
      }
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      if (top) {
        popular = `${LETTERS[top[0]] ?? '?'}) ${String(options[top[0]] ?? '').slice(0, 60)} — ${top[1]} ta`;
        popularWrong = !correctIdx.includes(top[0]);
      }
    } else if (q.type === 'open') {
      const review = list.filter((x) => x.needsReview).length;
      popular = review ? `Qo‘lda tekshiriladi: ${review} ta` : '';
    }
    const row = qs.addRow([
      i + 1, q.text, q.type === 'closed' ? 'Yopiq' : 'Ochiq', q.points, list.length, correct,
      ratio === null ? null : ratio, popular,
    ]);
    row.eachCell({ includeEmpty: true }, (c, col) => {
      c.border = box;
      c.font = { size: 10, color: { argb: C.ink } };
      c.alignment = { vertical: 'middle', horizontal: col === 2 || col === 8 ? 'left' : 'center', wrapText: col === 2 || col === 8, indent: col === 2 ? 1 : 0 };
      if (i % 2) c.fill = fill(C.zebra);
    });
    const pc = row.getCell(7);
    pc.numFmt = '0%';
    if (ratio !== null) {
      const [bg, fg] = ratio < 0.4 ? [C.redBg, C.redFg] : ratio < 0.7 ? [C.amberBg, C.amberFg] : [C.greenBg, C.greenFg];
      pc.fill = fill(bg);
      pc.font = { size: 10, bold: true, color: { argb: fg } };
    }
    if (popularWrong) row.getCell(8).font = { size: 10, color: { argb: C.redFg } };
  });
  qs.views = [{ state: 'frozen', ySplit: 5, showGridLines: false }];

  // ═════════ 3. Javoblar matritsasi ═════════
  const ms = wb.addWorksheet('Javoblar', {
    properties: { tabColor: { argb: 'FF15803D' } },
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  const n = test.questions.length;
  ms.columns = [{ width: 28 }, ...test.questions.map(() => ({ width: 5 })), { width: 9 }];
  const lastColIdx = n + 2;
  const colName = (k: number) => {
    let s = '';
    for (let x = k; x > 0; x = Math.floor((x - 1) / 26)) s = LETTERS[(x - 1) % 26] + s;
    return s;
  };
  // Sarlavha kamida 8 ustun kengligida (o‘qilishi uchun), ko‘pi bilan Z gacha
  const titleLast = colName(Math.min(Math.max(lastColIdx, 8), 26));
  titleBlock(ms, titleLast,
    'JAVOBLAR', test.title, '✓ to‘g‘ri   ✗ noto‘g‘ri   ? qo‘lda tekshiriladi   — javob berilmagan yoki variantida yo‘q. Savol raqamlari “Savollar tahlili” bilan bir xil.');
  const mh = ms.getRow(5);
  mh.values = ['Ishtirokchi', ...test.questions.map((_, i) => i + 1), 'Foiz'];
  headerRow(mh);
  done.forEach((a, i) => {
    const aMap = new Map(a.answers.map((x) => [x.questionId, x]));
    const inVariant = new Set((a.questionIds as string[]) ?? []);
    const marks = test.questions.map((q) => {
      if (!inVariant.has(q.id)) return '—';
      const x = aMap.get(q.id);
      if (!x) return '—';
      if (x.needsReview) return '?';
      return x.isCorrect ? '✓' : '✗';
    });
    const row = ms.addRow([a.fullName, ...marks, (a.percent ?? 0) / 100]);
    row.eachCell({ includeEmpty: true }, (c, col) => {
      c.border = box;
      c.alignment = { vertical: 'middle', horizontal: col === 1 ? 'left' : 'center', indent: col === 1 ? 1 : 0 };
      c.font = { size: 10, color: { argb: C.ink } };
      const v = c.value;
      if (v === '✓') { c.fill = fill(C.greenBg); c.font = { size: 11, bold: true, color: { argb: C.greenFg } }; }
      else if (v === '✗') { c.fill = fill(C.redBg); c.font = { size: 11, bold: true, color: { argb: C.redFg } }; }
      else if (v === '?') { c.fill = fill(C.amberBg); c.font = { size: 11, bold: true, color: { argb: C.amberFg } }; }
      else if (v === '—' && col > 1) { c.fill = fill(C.grayBg); c.font = { size: 10, color: { argb: C.muted } }; }
      else if (i % 2) c.fill = fill(C.zebra);
    });
    row.getCell(lastColIdx).numFmt = '0%';
    row.getCell(lastColIdx).font = { size: 10, bold: true, color: { argb: C.ink } };
  });
  ms.views = [{ state: 'frozen', xSplit: 1, ySplit: 5, showGridLines: false }];

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const safe = test.title.replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 60) || 'test';
  return { buffer, filename: `${safe} — natijalar.xlsx` };
}
