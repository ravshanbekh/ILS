import { LessonDayType } from '@prisma/client';

/**
 * IT Live markazidagi qabul qilingan qoida: guruhlar hafta kuniga qarab
 * ikkiga bo'linadi — "toq" va "juft" — oyning sanasiga (25, 26...) emas.
 * Toq kunlar:  Dushanba, Chorshanba, Juma
 * Juft kunlar: Seshanba, Payshanba, Shanba
 * Yakshanba — ikkalasi uchun ham dam olish kuni.
 */
const TOQ_WEEKDAYS = new Set([1, 3, 5]); // JS Date#getUTCDay(): 0=Yak,1=Dush,...,6=Shan
const JUFT_WEEKDAYS = new Set([2, 4, 6]);

/**
 * @param date — kalendar kunni ifodalovchi Date. Aniqlik uchun UTC kun raqami ishlatiladi
 * (lesson-sessions.service.ts dagi tashkentDateOnly() aynan shu shaklda beradi).
 */
export function isLessonDay(dayType: LessonDayType | null, date: Date): boolean {
  if (!dayType) return false;
  if (dayType === 'har_kuni') return true;
  const weekday = date.getUTCDay();
  if (dayType === 'toq') return TOQ_WEEKDAYS.has(weekday);
  if (dayType === 'juft') return JUFT_WEEKDAYS.has(weekday);
  return false;
}

/** Berilgan oyda, guruhning dars kuni turiga ko'ra nechta dars kuni bo'lishi kerakligi */
export function countExpectedLessonDaysInMonth(dayType: LessonDayType | null, year: number, month: number): number {
  if (!dayType) return 0;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    if (isLessonDay(dayType, new Date(Date.UTC(year, month - 1, d)))) count++;
  }
  return count;
}
