/**
 * Normativ deadline'lari — toza (pure) hisob-kitob. Bazaga ham, joriy vaqtga
 * ham tegmaydi: hamma narsa argument sifatida keladi, shuning uchun alohida
 * sinab ko'rish oson (tests/normative-deadlines.e2e.ts).
 *
 * Qoidalar:
 *   - reja haftalarga bo'linadi (dushanba–yakshanba), har haftaga `perWeek` ta normativ;
 *   - haftaning muddati — guruhning shu haftadagi OXIRGI dars kuni, DARS SOATIGACHA.
 *     Dars soati kiritilmagan bo'lsa — o'sha kun 23:59; dars kunlari ham
 *     kiritilmagan bo'lsa — yakshanba 23:59;
 *   - muddatdan keyin `graceDays` kun qo'shimcha imkon;
 *   - qo'shimcha muddatda ham topshirmasa — qizil ("missed").
 *
 * Vaqtlar Toshkent bo'yicha (UTC+5, yozgi vaqt yo'q). Sanalar UTC yarim tunda.
 */
import { isLessonDay } from '../../shared/utils/lessonSchedule';

export type DayType = 'juft' | 'toq' | 'har_kuni';
export const CENTER_OFFSET_MIN = 5 * 60;
const DAY_MS = 86_400_000;

export interface GroupScheduleLike {
  lessonDayType: DayType | null;
  lessonStartMinute: number | null;
}

/** 'YYYY-MM-DD' → UTC yarim tun */
export const utcDay = (s: string): Date => new Date(`${s}T00:00:00.000Z`);
export const dayStr = (d: Date): string => d.toISOString().slice(0, 10);
export const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * DAY_MS);

/** Shu sanani o'z ichiga olgan haftaning dushanbasi */
export function mondayOf(d: Date): Date {
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const wd = day.getUTCDay(); // 0 = yakshanba
  return addDays(day, wd === 0 ? -6 : 1 - wd);
}

/** Toshkentdagi bugungi sana (UTC yarim tun ko'rinishida) */
export function centerToday(now: Date): Date {
  const shifted = new Date(now.getTime() + CENTER_OFFSET_MIN * 60_000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

/** Toshkentdagi shu kunning `minute`-daqiqasi → aniq UTC payt */
export function centerInstant(day: Date, minute: number): Date {
  return new Date(day.getTime() + (minute - CENTER_OFFSET_MIN) * 60_000);
}

/** Haftaning muddati: oxirgi dars kuni, dars soatigacha */
export function dueAtFor(weekStart: Date, g: GroupScheduleLike): Date {
  const endOfDay = (day: Date) => new Date(centerInstant(day, 24 * 60).getTime() - 1000); // 23:59:59
  if (g.lessonDayType) {
    for (let i = 6; i >= 0; i--) {
      const day = addDays(weekStart, i);
      if (isLessonDay(g.lessonDayType, day)) {
        return g.lessonStartMinute != null ? centerInstant(day, g.lessonStartMinute) : endOfDay(day);
      }
    }
  }
  return endOfDay(addDays(weekStart, 6));
}

export const graceEndFor = (dueAt: Date, graceDays: number): Date => new Date(dueAt.getTime() + graceDays * DAY_MS);

/**
 * Bitta o'quvchi × bitta reja bandi holati.
 *   done        — muddatgacha topshirdi
 *   grace_done  — qo'shimcha muddatda topshirdi
 *   late_done   — qo'shimcha muddatdan keyin topshirdi (qizil tarixi bor)
 *   open        — muddat hali kelmagan, topshirmagan
 *   grace       — muddat o'tdi, qo'shimcha muddat ketyapti
 *   missed      — qo'shimcha muddat ham o'tdi — QIZIL
 *   na          — guruhga muddatdan keyin qo'shilgan, hisobga olinmaydi
 */
export type DeadlineState = 'done' | 'grace_done' | 'late_done' | 'open' | 'grace' | 'missed' | 'na';

export function stateOf(p: {
  dueAt: Date;
  graceEnd: Date;
  submittedAt: Date | null;
  joinedAt: Date;
  now: Date;
}): DeadlineState {
  if (p.joinedAt > p.dueAt) return 'na';
  // `now` dan keyingi topshiriq hali yo'q hisoblanadi (o'tgan sana bo'yicha hisob uchun)
  const sub = p.submittedAt && p.submittedAt <= p.now ? p.submittedAt : null;
  if (sub) {
    if (sub <= p.dueAt) return 'done';
    if (sub <= p.graceEnd) return 'grace_done';
    return 'late_done';
  }
  if (p.now <= p.dueAt) return 'open';
  if (p.now <= p.graceEnd) return 'grace';
  return 'missed';
}

export const isSubmittedState = (s: DeadlineState) => s === 'done' || s === 'grace_done' || s === 'late_done';
export const isRedState = (s: DeadlineState) => s === 'missed' || s === 'late_done';

/**
 * Yangi bandlarni haftalarga joylash. `taken` — haftada allaqachon
 * band qilingan (rejadan chiqarilmagan) joylar soni, kalit — 'YYYY-MM-DD'.
 * Har bir haftaga ko'pi bilan `perWeek` ta; `firstWeek` dan oldinga qo'yilmaydi.
 */
export function layOut<T>(items: T[], firstWeek: Date, perWeek: number, taken: Map<string, number> = new Map()) {
  const out: { item: T; weekStart: Date }[] = [];
  let week = mondayOf(firstWeek);
  const used = new Map(taken);
  for (const item of items) {
    while ((used.get(dayStr(week)) ?? 0) >= perWeek) week = addDays(week, 7);
    out.push({ item, weekStart: week });
    used.set(dayStr(week), (used.get(dayStr(week)) ?? 0) + 1);
  }
  return out;
}

/** Hafta kunlari nomlari (dars kunlarini ko'rsatish uchun) */
export const WEEKDAY_SHORT = ['Yak', 'Du', 'Se', 'Chor', 'Pay', 'Ju', 'Sha'];

export const minuteToHHMM = (m: number | null | undefined): string | null =>
  m == null ? null : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
