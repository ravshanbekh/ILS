import ExcelJS from 'exceljs';
import { buildMatrix, MatrixFilters } from './normative-matrix.service';

/** Vaqt soniyada saqlanadi (frontend utils/duration bilan bir xil): 30 → "30 sek", 150 → "2 daq 30 sek" */
export const formatDuration = (sec: number | null | undefined): string => {
  if (!sec || sec <= 0) return '';
  const s = Math.round(sec);
  if (s < 60) return `${s} sek`;
  const m = Math.floor(s / 60);
  return s % 60 ? `${m} daq ${s % 60} sek` : `${m} daq`;
};

/**
 * Normativ natijalari — Excel (panel bilan bir xil joylashuv):
 *   1-qator: mentor (o'quvchilari ustidan birlashtirilgan)
 *   2-qator: qizil guruh ustuni (nomi vertikal) + o'quvchilar ismi vertikal
 *   3+:      normativlar — N, nomi, vazifasi, vaqti, foiz | kataklar
 *   oxirgi:  har o'quvchining bajarish foizi
 * Chap 5 ustun va 2 sarlavha qatori qotirilgan (ikki tomonga aylantirish).
 */

const C = {
  navy: 'FF0F1B2D',
  head: 'FFC2560F', // 2-rasmdagi to'q sariq sarlavha
  red: 'FFFF2B00',
  white: 'FFFFFFFF',
  ink: 'FF111827',
  muted: 'FF6B7280',
  line: 'FFD5DCE6',
  left: 'FFBDD7EE', // normativ ustunlari (1-rasm)
  leftAlt: 'FFFFE699',
  green: 'FFE2F5E8',
  greenFg: 'FF15803D',
  blue: 'FFDBEAFE', // biladi — ko'k
  blueFg: 'FF1D4ED8',
  redFg: 'FFDC2626',
  amber: 'FFFFF4D6',
  amberFg: 'FF8A4B00',
  na: 'FFF1F2F4',
};
const fill = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const thin = { style: 'thin' as const, color: { argb: C.line } };
const box: Partial<ExcelJS.Borders> = { top: thin, bottom: thin, left: thin, right: thin };

const MARK = { g: '✔', b: '✔', r: '✘', p: '⏳' } as const;

export async function buildMatrixWorkbook(actor: { userId: string; role: string }, f: MatrixFilters) {
  const m = await buildMatrix(actor, f);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'IT Live Score';
  wb.created = new Date();
  const ws = wb.addWorksheet('Normativ natijalari', {
    properties: { tabColor: { argb: C.head } },
    views: [{ state: 'frozen', xSplit: 5, ySplit: 2 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 0, fitToHeight: 0, paperSize: 9 },
  });

  const LEFT = 5;
  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 34;
  ws.getColumn(3).width = 46;
  ws.getColumn(4).width = 9;
  ws.getColumn(5).width = 8;
  ws.getRow(1).height = 24;
  ws.getRow(2).height = 150;

  const leftHead = ['N', 'Normativ', 'Nima qila olsin', 'Vaqti', 'Foiz'];
  leftHead.forEach((t, i) => {
    ws.mergeCells(1, i + 1, 2, i + 1);
    const c = ws.getCell(1, i + 1);
    c.value = t;
    c.font = { bold: true, color: { argb: C.white }, size: 10 };
    c.fill = fill(C.head);
    c.alignment = { vertical: 'bottom', horizontal: 'center', wrapText: true };
    c.border = box;
  });

  // Ustunlar xaritasi: har o'quvchi ustuni qaysi guruhda
  type Col = { kind: 'group'; group: any } | { kind: 'student'; group: any; student: any };
  const cols: Col[] = [];
  let col = LEFT + 1;
  for (const t of m.teachers) {
    const start = col;
    for (const g of t.groups) {
      cols.push({ kind: 'group', group: g });
      ws.getColumn(col).width = 3.2;
      col++;
      for (const s of g.students) {
        cols.push({ kind: 'student', group: g, student: s });
        ws.getColumn(col).width = 3.6;
        col++;
      }
    }
    const end = col - 1;
    if (end >= start) {
      if (end > start) ws.mergeCells(1, start, 1, end);
      const c = ws.getCell(1, start);
      c.value = t.fullName;
      c.font = { bold: true, size: 11, color: { argb: C.white } };
      c.fill = fill(C.navy);
      c.alignment = { vertical: 'middle', horizontal: 'center' };
      c.border = box;
    }
  }
  cols.forEach((cl, i) => {
    const c = ws.getCell(2, LEFT + 1 + i);
    c.value = cl.kind === 'group' ? cl.group.name + (cl.group.graduated ? ' (tamomlagan)' : '') : cl.student.fullName;
    c.alignment = { textRotation: 90, vertical: 'bottom', horizontal: 'center' };
    c.border = box;
    if (cl.kind === 'group') {
      c.fill = fill(C.red);
      c.font = { bold: true, size: 9, color: { argb: C.white } };
    } else {
      c.font = { size: 9, color: { argb: C.ink } };
    }
  });

  // Normativ qatorlari
  m.normatives.forEach((n, ri) => {
    const r = ws.getRow(3 + ri);
    let assigned = 0;
    let done = 0;
    cols.forEach((cl, i) => {
      const c = r.getCell(LEFT + 1 + i);
      c.border = box;
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      if (cl.kind === 'group') {
        c.fill = fill(C.red);
        return;
      }
      if (!cl.group.normativeIds.includes(n.id)) {
        c.fill = fill(C.na);
        return;
      }
      assigned++;
      const cell = m.cells[cl.student.id]?.[n.id];
      if (!cell) return;
      const [code, score, url] = cell;
      if (code === 'g' || code === 'b') done++;
      // Belgi bosilsa o'quvchining isbot videosi ochiladi (sahifadagidek)
      c.value = url ? { text: MARK[code], hyperlink: url, tooltip: 'Isbot videosi' } : MARK[code];
      c.font = { bold: true, size: 11, color: { argb: code === 'g' ? C.greenFg : code === 'b' ? C.blueFg : code === 'r' ? C.redFg : C.amberFg } };
      c.fill = fill(code === 'g' ? C.green : code === 'b' ? C.blue : code === 'p' ? C.amber : C.white);
      if (code !== 'p') c.note = `${cl.student.fullName}: ${score} ball`;
    });
    const left = [n.taskNumber, n.title, n.description ?? '', n.timeLimit ? formatDuration(n.timeLimit) : '', assigned ? done / assigned : null];
    left.forEach((v, i) => {
      const c = r.getCell(i + 1);
      c.value = v as any;
      c.border = box;
      c.fill = fill(i === 0 || i === 1 ? C.left : C.leftAlt);
      c.font = { size: i === 1 ? 10 : 9, bold: i <= 1, color: { argb: C.ink } };
      c.alignment = { vertical: 'top', wrapText: i === 1 || i === 2, horizontal: i === 0 || i >= 3 ? 'center' : 'left' };
    });
    r.getCell(5).numFmt = '0%';
    if (n.url) r.getCell(2).value = { text: n.title, hyperlink: n.url };
    r.height = Math.min(90, Math.max(22, Math.ceil((n.description ?? '').length / 55) * 13));
  });

  // Oxirgi qator: o'quvchining bajarish foizi
  const sr = ws.getRow(3 + m.normatives.length);
  ws.mergeCells(sr.number, 1, sr.number, LEFT);
  const sl = sr.getCell(1);
  sl.value = "O'quvchi bajargan normativlar (qo'lladi + biladi)";
  sl.font = { bold: true, size: 10, color: { argb: C.white } };
  sl.fill = fill(C.navy);
  sl.alignment = { horizontal: 'right', vertical: 'middle' };
  sr.height = 40;
  cols.forEach((cl, i) => {
    const c = sr.getCell(LEFT + 1 + i);
    c.border = box;
    if (cl.kind === 'group') {
      c.fill = fill(C.red);
      return;
    }
    const ids = cl.group.normativeIds as string[];
    const done = ids.filter((id) => ['g', 'b'].includes(m.cells[cl.student.id]?.[id]?.[0] ?? '')).length;
    c.value = ids.length ? done / ids.length : null;
    c.numFmt = '0%';
    c.font = { bold: true, size: 8 };
    c.alignment = { textRotation: 90, horizontal: 'center', vertical: 'middle' };
  });

  // Izoh varag'i
  const legend = wb.addWorksheet('Izoh');
  legend.columns = [{ width: 8 }, { width: 60 }];
  const rows: [string, string, string?][] = [
    ['✔', "qo'lladi (yashil)", C.green],
    ['✔', 'biladi (ko\'k)', C.blue],
    ['✘', 'bilmaydi (qizil)', undefined],
    ['⏳', 'topshirgan, tekshirilmoqda', C.amber],
    ['', "bo'sh — topshirmagan", undefined],
    ['', "kulrang — normativ bu guruhga biriktirilmagan", C.na],
    ['', "Foiz — normativni bajarganlar (qo'lladi + biladi) / biriktirilgan o'quvchilar", undefined],
  ];
  rows.forEach(([mk, t, bg], i) => {
    const r = legend.getRow(i + 1);
    r.getCell(1).value = mk;
    r.getCell(1).alignment = { horizontal: 'center' };
    if (bg) r.getCell(1).fill = fill(bg);
    r.getCell(2).value = t;
  });
  legend.getRow(rows.length + 2).getCell(2).value = `Yuklangan: ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' })}`;

  return Buffer.from(await wb.xlsx.writeBuffer());
}
