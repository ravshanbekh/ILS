/**
 * Kurator (demo-mentor) qoidalari — tizimning yagona manbasi.
 *
 * Kurator bola bilan 20 daqiqa shug'ullanadi, lekin jadval 30 daqiqalik
 * oraliqlarda yuritiladi (10 daqiqa — keyingi guruhga tayyorlanish).
 * Bitta vaqtga eng ko'pi bilan 8 ta o'quvchi yozila oladi.
 *
 * Sana bilan ishlash qoidasi supportHours bilan bir xil: @db.Date maydonlar
 * UTC yarim tunda saqlanadi, "bugun" esa Toshkent vaqti bo'yicha aniqlanadi.
 */
import { CENTER_TIMEZONE, parseDateOnly, todayInCenter, toDateOnlyString, isClosedDay } from './supportHours';

export { parseDateOnly, todayInCenter, toDateOnlyString, isClosedDay };

/** Jadval qadami — bitta oraliq necha daqiqa */
export const CURATOR_SLOT_MINUTES = 30;

/** Mashg'ulotning o'zi necha daqiqa (ma'lumot uchun ko'rsatiladi) */
export const CURATOR_SESSION_MINUTES = 20;

/** Bitta vaqtga eng ko'pi bilan nechta o'quvchi */
export const CURATOR_MAX_PER_SLOT = 8;

/** Ish kuni: 08:00 dan, oxirgi oraliq 19:30–20:00 */
export const CURATOR_DAY_START_MINUTE = 8 * 60;
export const CURATOR_DAY_END_MINUTE = 20 * 60;

/** Kuzatuv muddati — demo kunidan boshlab necha oy */
export const CURATOR_PROGRAM_MONTHS = 2;

/** Ochish mumkin bo'lgan oraliq boshlari: 480, 510, ..., 1170 */
export const CURATOR_ALLOWED_MINUTES: number[] = (() => {
  const out: number[] = [];
  for (let m = CURATOR_DAY_START_MINUTE; m < CURATOR_DAY_END_MINUTE; m += CURATOR_SLOT_MINUTES) out.push(m);
  return out;
})();

export const isAllowedStartMinute = (m: number) => CURATOR_ALLOWED_MINUTES.includes(m);

const pad = (n: number) => String(n).padStart(2, '0');

/** 630 → "10:30" */
export function formatMinute(minute: number): string {
  return `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
}

/** 630 → "10:30–11:00" */
export function formatCuratorSlot(startMinute: number): string {
  return `${formatMinute(startMinute)}–${formatMinute(startMinute + CURATOR_SLOT_MINUTES)}`;
}

/** Toshkent vaqti bo'yicha kun boshidan o'tgan daqiqalar */
export function currentMinuteInCenter(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CENTER_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

/** Oraliq boshlanib bo'lganmi (yoki o'tib ketganmi)? */
export function isPastCuratorSlot(dateOnly: string, startMinute: number, now: Date = new Date()): boolean {
  const today = todayInCenter(now);
  if (dateOnly < today) return true;
  if (dateOnly > today) return false;
  return startMinute <= currentMinuteInCenter(now);
}

/** UTC sana + n oy (31-yanvar + 1 oy → 28/29-fevral, oy oxiridan oshmaydi) */
export function addMonthsUtc(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const d = date.getUTCDate();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d, lastDay)));
}

/** Ikki "YYYY-MM-DD" sana orasidagi kunlar (b - a) */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * 2 oylik kuzatuvning bugungi holati: nechanchi kun, jami kun, reja bo'yicha
 * nechta mashg'ulot o'tilgan bo'lishi kerak edi.
 */
export function programTimeline(demoDate: Date, endDate: Date, totalLessons: number, today = todayInCenter()) {
  const start = toDateOnlyString(demoDate);
  const end = toDateOnlyString(endDate);
  const totalDays = Math.max(1, daysBetween(start, end));
  const elapsed = Math.min(totalDays, Math.max(0, daysBetween(start, today)));
  return {
    day: Math.min(totalDays, elapsed + 1),
    totalDays,
    daysLeft: Math.max(0, daysBetween(today, end)),
    expectedLessons: Math.min(totalLessons, Math.floor((totalLessons * elapsed) / totalDays)),
    finished: today > end,
  };
}
