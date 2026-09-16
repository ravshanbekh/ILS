/**
 * O'zbekcha sana formatlari.
 *
 * NEGA Intl EMAS
 * `toLocaleDateString('uz-UZ', { month: 'short' })` brauzerga qarab
 * "M05", "M06" kabi ICU kodlarini qaytaradi — foydalanuvchi buni
 * tushunmaydi. Grafik o'qida aynan shu chiqib qolgan edi.
 * Shuning uchun oy nomlari qo'lda yoziladi.
 */

const MONTHS_SHORT = [
  'yan', 'fev', 'mar', 'apr', 'may', 'iyn',
  'iyl', 'avg', 'sen', 'okt', 'noy', 'dek',
];

const MONTHS_FULL = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
];

function toDate(value: string | number | Date): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 15-may */
export function uzDayMonth(value: string | number | Date): string {
  const d = toDate(value);
  if (!d) return '—';
  return `${d.getDate()}-${MONTHS_SHORT[d.getMonth()]}`;
}

/** 15-may 2026 */
export function uzDate(value: string | number | Date): string {
  const d = toDate(value);
  if (!d) return '—';
  return `${d.getDate()}-${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** 15-may, 14:30 */
export function uzDateTime(value: string | number | Date): string {
  const d = toDate(value);
  if (!d) return '—';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()}-${MONTHS_SHORT[d.getMonth()]}, ${hh}:${mm}`;
}

/** 15-may 2026, 14:30 */
export function uzDateTimeFull(value: string | number | Date): string {
  const d = toDate(value);
  if (!d) return '—';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()}-${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}
