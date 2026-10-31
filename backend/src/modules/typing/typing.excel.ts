import ExcelJS from 'exceljs';
import { classMatchDetail } from './typing.service';

/**
 * Sinf musobaqasi natijalari — dizaynli Excel (2 varaq), test paneli
 * Excel'i (quiz-test.excel.ts) bilan bir xil uslubda:
 *   1. Natijalar — statistika kartalari, 1–3 o'rin medal rangi, holat
 *                  ranglari, WPM ustunida data bar.
 *   2. Matn      — musobaqada yozilgan matn/kod (keyin tahlil uchun).
 */

const C = {
  navy: 'FF0F1B2D',
  navy2: 'FF1F2937',
  red: 'FFFF2B00',
  orange: 'FFF97316',
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
};

const fill = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const thin = { style: 'thin' as const, color: { argb: C.line } };
const box: Partial<ExcelJS.Borders> = { top: thin, bottom: thin, left: thin, right: thin };
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const dtf = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
const fmtDT = (d?: Date | null) => (d ? dtf.format(d).replace(',', '') : '');
const SRC: Record<string, string> = { en: 'English', uz: "O'zbek", tech: 'Dasturlash' };
const OUTCOME: Record<string, string> = { finished: 'Tugatdi', timeout: 'Vaqt tugadi', left: 'Chiqib ketdi' };

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
  ws.getRow(3).height = meta.length > 110 ? 30 : 18;
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

export async function buildClassWorkbook(viewer: { userId: string; role: string }, matchId: string) {
  const m = await classMatchDetail(viewer, matchId);
  const ps = m.players;
  const counted = ps.filter((p) => p.outcome !== 'left');
  const finishedN = ps.filter((p) => p.finished).length;
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  const best = [...counted].sort((a, b) => b.wpm - a.wpm)[0];
  const content = m.contentType === 'text' ? `Matn · ${SRC[m.variant] ?? m.variant}` : `Kod · ${m.variant}`;
  const title = m.title || `Sinf musobaqasi ${m.code}`;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'IT Live Score';
  wb.created = new Date();

  const meta = [
    `Mentor: ${m.host?.fullName ?? '—'}`,
    `Kod: ${m.code}`,
    content,
    `${m.textLength} belgi`,
    `Vaqt chegarasi: ${m.timeLimitSec} s`,
    `O'tkazilgan: ${fmtDT(m.startedAt)}`,
  ].join('   ·   ');

  // ═════════ 1. Natijalar ═════════
  const ws = wb.addWorksheet('Natijalar', {
    properties: { tabColor: { argb: C.orange } },
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  ws.columns = [
    { width: 7 }, { width: 30 }, { width: 22 }, { width: 14 }, { width: 9 }, { width: 10 },
    { width: 9 }, { width: 12 }, { width: 10 }, { width: 22 },
  ];
  titleBlock(ws, 'J', "IT LIVE ACADEMY  ·  TEZ YOZISH MUSOBAQASI", title, meta);

  const cards: [string, string, string | number, string][] = [
    ['A', 'B', ps.length, 'Ishtirokchilar'],
    ['C', 'C', `${finishedN} / ${ps.length}`, 'Oxirigacha yozdi'],
    ['D', 'E', `${avg(counted.map((p) => p.wpm))} wpm`, "O'rtacha tezlik"],
    ['F', 'G', `${avg(counted.map((p) => p.accuracy))}%`, "O'rtacha aniqlik"],
    ['H', 'J', best ? `${best.wpm} wpm — ${best.fullName}` : '—', 'Eng tez'],
  ];
  ws.getRow(5).height = 18;
  ws.getRow(6).height = 28;
  for (const [from, to, value, label] of cards) {
    if (from !== to) {
      ws.mergeCells(`${from}5:${to}5`);
      ws.mergeCells(`${from}6:${to}6`);
    }
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
  hr.values = ["O'rin", 'Ism-familiya', 'Guruh', 'Holat', 'WPM', 'Aniqlik', 'Xatolar', 'Yozgani', 'Vaqt (s)', 'Izoh'];
  headerRow(hr);

  ps.forEach((p, i) => {
    const row = ws.addRow([
      p.place ?? '—',
      p.fullName,
      p.groups.join(', '),
      OUTCOME[p.outcome] ?? p.outcome,
      p.wpm,
      p.accuracy / 100,
      p.errors ?? '',
      m.textLength ? Math.min(1, p.progress / m.textLength) : 0,
      p.timeSec ?? '',
      p.flagged ? `Shubhali: ${p.flagReason ?? ''}` : '',
    ]);
    row.height = 20;
    const medal = p.place === 1 ? C.gold : p.place === 2 ? C.silver : p.place === 3 ? C.bronze : i % 2 ? C.zebra : null;
    row.eachCell({ includeEmpty: true }, (c, col) => {
      c.border = box;
      c.font = { size: 10, color: { argb: C.ink } };
      c.alignment = { vertical: 'middle', horizontal: col === 2 || col === 3 || col === 10 ? 'left' : 'center', indent: col === 2 ? 1 : 0 };
      if (medal) c.fill = fill(medal);
    });
    row.getCell(1).font = { size: 11, bold: true, color: { argb: C.navy } };
    row.getCell(2).font = { size: 10, bold: true, color: { argb: C.ink } };
    row.getCell(5).font = { size: 11, bold: true, color: { argb: C.orange } };
    row.getCell(6).numFmt = '0%';
    row.getCell(8).numFmt = '0%';
    const st = row.getCell(4);
    const [bg, fg] = p.outcome === 'finished' ? [C.greenBg, C.greenFg] : p.outcome === 'left' ? [C.redBg, C.redFg] : [C.amberBg, C.amberFg];
    st.fill = fill(bg);
    st.font = { size: 10, bold: true, color: { argb: fg } };
    if (p.flagged) row.getCell(10).font = { size: 9, color: { argb: C.redFg } };
  });

  if (ps.length) {
    const last = HEAD + ps.length;
    ws.addConditionalFormatting({
      ref: `E${HEAD + 1}:E${last}`,
      rules: [{ type: 'dataBar', priority: 1, cfvo: [{ type: 'num', value: 0 }, { type: 'max' }], color: { argb: 'FFFDBA74' } } as any],
    });
    ws.autoFilter = { from: `A${HEAD}`, to: `J${last}` };
  } else {
    ws.mergeCells(`A${HEAD + 1}:J${HEAD + 1}`);
    ws.getCell(`A${HEAD + 1}`).value = 'Ishtirokchi yo\'q';
  }
  ws.views = [{ state: 'frozen', ySplit: HEAD }];

  // ═════════ 2. Matn ═════════
  const wt = wb.addWorksheet('Matn', { properties: { tabColor: { argb: C.navy } } });
  wt.columns = [{ width: 110 }];
  titleBlock(wt, 'A', 'MUSOBAQA MATNI', title, `${content}   ·   ${m.textLength} belgi`);
  const tc = wt.getCell('A5');
  tc.value = m.text;
  tc.font = { name: m.contentType === 'code' ? 'Consolas' : 'Calibri', size: 11, color: { argb: C.ink } };
  tc.alignment = { wrapText: true, vertical: 'top' };
  wt.getRow(5).height = Math.min(409, 16 * Math.max(3, m.text.split('\n').length + Math.ceil(m.text.length / 110)));

  const safe = title.replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60) || m.code;
  return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), filename: `${safe} — natijalar.xlsx` };
}
