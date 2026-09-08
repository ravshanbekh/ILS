/**
 * Assistent (support teacher) qabul soatlari qoidalari.
 *
 * Bu yerdagi raqamlar tizimning yagona manbasi — backend tekshiruvi ham,
 * frontend ko'rsatadigan soatlar ro'yxati ham shu qoidaga tayanadi.
 */

/** Ish boshlanishi (shu soatdan yozilish mumkin) */
export const WORK_START_HOUR = 8;

/** Ish tugashi — oxirgi soat 18:00–19:00 bo'ladi */
export const WORK_END_HOUR = 19;

/** Tushlik boshlanishi */
export const LUNCH_START_HOUR = 12;

/** Tushlik tugashi */
export const LUNCH_END_HOUR = 14;

/** Bitta soatga eng ko'pi bilan nechta o'quvchi yozila oladi */
export const MAX_STUDENTS_PER_SLOT = 10;

/** Dam olish kuni — yakshanba (getUTCDay(): 0 = yakshanba) */
export const CLOSED_WEEKDAY = 0;

/** Bitta o'quvchi bir kunda nechta soatga yozila oladi */
export const MAX_BOOKINGS_PER_STUDENT_PER_DAY = 1;

/** O'quv markaz vaqt mintaqasi — "bugun" shu bo'yicha aniqlanadi */
export const CENTER_TIMEZONE = 'Asia/Tashkent';

/**
 * Ochish mumkin bo'lgan soat boshlari: 8, 9, 10, 11, 14, 15, 16, 17, 18.
 * Tushlik (12:00–14:00) tushib qoladi.
 */
export const ALLOWED_START_HOURS: number[] = (() => {
  const hours: number[] = [];
  for (let h = WORK_START_HOUR; h < WORK_END_HOUR; h++) {
    if (h >= LUNCH_START_HOUR && h < LUNCH_END_HOUR) continue;
    hours.push(h);
  }
  return hours;
})();

/** "14:00–15:00" ko'rinishidagi matn */
export function formatSlotRange(startHour: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(startHour)}:00–${pad(startHour + 1)}:00`;
}

/** Soat ochilishi mumkinmi? */
export function isAllowedStartHour(hour: number): boolean {
  return ALLOWED_START_HOURS.includes(hour);
}

/**
 * "YYYY-MM-DD" matnini kun boshiga (UTC) aylantiradi.
 *
 * Prisma @db.Date maydonini vaqt mintaqasi surib yubormasligi uchun sana
 * har doim UTC yarim tunda saqlanadi — aks holda Toshkent vaqtida (+5)
 * kiritilgan sana bazada bir kun oldingi kunga tushib qolishi mumkin.
 * Shu sababli sana bilan ishlaganda faqat getUTC* metodlari ishlatiladi.
 */
export function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (Number.isNaN(date.getTime())) return null;
  // "2026-02-31" kabi mavjud bo'lmagan sanani rad etish
  if (toDateOnlyString(date) !== value) return null;
  return date;
}

/** Date -> "YYYY-MM-DD" (UTC bo'yicha) */
export function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Sana yakshanbami? */
export function isClosedDay(date: Date): boolean {
  return date.getUTCDay() === CLOSED_WEEKDAY;
}

/**
 * Toshkent vaqti bo'yicha bugungi sana ("YYYY-MM-DD").
 * Server UTC da ishlaydi, shuning uchun oddiy new Date() kechqurun
 * noto'g'ri kunni berardi.
 */
export function todayInCenter(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CENTER_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Toshkent vaqti bo'yicha hozirgi soat (0–23) */
export function currentHourInCenter(now: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: CENTER_TIMEZONE,
      hour: '2-digit',
      hour12: false,
    }).format(now)
  );
}

/**
 * Shu soat allaqachon o'tib ketganmi? (bugungi kun uchun)
 * Boshlanishiga kirib bo'lgan soatga yozilib bo'lmaydi.
 */
export function isPastSlot(dateOnly: string, startHour: number, now: Date = new Date()): boolean {
  const today = todayInCenter(now);
  if (dateOnly < today) return true;
  if (dateOnly > today) return false;
  return startHour <= currentHourInCenter(now);
}
