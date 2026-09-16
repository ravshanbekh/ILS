/**
 * Demo day va imtihon jadvalini hisoblash.
 *
 * Bu fayl ATAYLAB toza (pure) — bazaga ham, vaqtga ham tegmaydi. Sabab:
 * sana arifmetikasi eng xatoga moyil qism (oy oxiri, fevral, 31-kun) va uni
 * alohida sinab ko'rish imkoni bo'lishi kerak.
 */

export type LessonDayType = 'juft' | 'toq' | 'har_kuni';
export type MilestoneType = 'demo_day' | 'imtihon';

export interface PlannedMilestone {
  type: MilestoneType;
  /** Nechanchi demo day / imtihon (1 dan boshlanadi) */
  seq: number;
  /** Boshlanishdan necha oy keyin — hisob tekshirish uchun saqlanadi */
  monthOffset: number;
  /** O'qituvchiga taklif qilinadigan sanalar (odatda 3 ta) */
  candidates: Date[];
  /** Oxirgi nomzod = muddat. Undan keyin "kechikdi". */
  dueDate: Date;
}

/** UTC yarim tun — vaqt mintaqasi siljishidan qutulish uchun */
function utcDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day));
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Oydagi dars kunlari.
 *
 * `juft`/`toq` — oyning KUN RAQAMI juft yoki toq (schema izohiga muvofiq:
 * "Oyning juft kunlari"), hafta kuni emas.
 */
export function lessonDaysInMonth(
  year: number,
  monthIndex: number,
  type: LessonDayType
): Date[] {
  const total = daysInMonth(year, monthIndex);
  const out: Date[] = [];
  for (let d = 1; d <= total; d++) {
    if (type === 'har_kuni' || (type === 'juft' ? d % 2 === 0 : d % 2 === 1)) {
      out.push(utcDate(year, monthIndex, d));
    }
  }
  return out;
}

/**
 * Bitta bosqich uchun nomzod sanalar:
 *   1) maqsad oyning OXIRGI dars kuni
 *   2) keyingi oyning 1-dars kuni
 *   3) keyingi oyning 2-dars kuni   ← muddat
 *
 * Ravshanning talabi: "oyni oxirida yoki keyingi oyni boshida 1 maximum
 * 2 darsida". Bitta aniq kun belgilansa o'qituvchi ulgurmay qolishi mumkin.
 */
export function candidateDates(
  year: number,
  monthIndex: number,
  type: LessonDayType
): Date[] {
  const thisMonth = lessonDaysInMonth(year, monthIndex, type);
  const nextY = monthIndex === 11 ? year + 1 : year;
  const nextM = monthIndex === 11 ? 0 : monthIndex + 1;
  const nextMonth = lessonDaysInMonth(nextY, nextM, type);

  const out: Date[] = [];
  if (thisMonth.length > 0) out.push(thisMonth[thisMonth.length - 1]);
  if (nextMonth.length > 0) out.push(nextMonth[0]);
  if (nextMonth.length > 1) out.push(nextMonth[1]);
  return out;
}

/**
 * Guruhning butun jadvali.
 *
 * Demo day: +1, +3, +5 ... oy  (birinchisi 1 oydan keyin, keyin har 2 oyda)
 * Imtihon:  +1, +2, +3 ... oy  (har oy, 1-oydan boshlab)
 *
 * Ikkalasi `durationMonths` ichida qoladi. Kurs uzunligi berilmagan bo'lsa
 * jadval qurilmaydi — guruh "sozlanmagan" holatida turadi.
 */
export function buildSchedule(params: {
  startDate: Date;
  durationMonths: number | null;
  lessonDayType: LessonDayType | null;
}): PlannedMilestone[] {
  const { startDate, durationMonths, lessonDayType } = params;
  if (!durationMonths || durationMonths < 1 || !lessonDayType) return [];

  const startY = startDate.getUTCFullYear();
  const startM = startDate.getUTCMonth();

  const make = (type: MilestoneType, seq: number, monthOffset: number): PlannedMilestone => {
    // Oy indeksini normallashtirish Date konstruktorining o'zi bajaradi:
    // Date.UTC(2026, 14, 1) → 2027-mart. Qo'lda bo'lish/qoldiq hisoblash shart emas.
    const target = new Date(Date.UTC(startY, startM + monthOffset, 1));
    const candidates = candidateDates(target.getUTCFullYear(), target.getUTCMonth(), lessonDayType);
    return {
      type,
      seq,
      monthOffset,
      candidates,
      dueDate: candidates[candidates.length - 1],
    };
  };

  const out: PlannedMilestone[] = [];

  let seq = 1;
  for (let off = 1; off <= durationMonths; off += 2) {
    out.push(make('demo_day', seq++, off));
  }

  seq = 1;
  for (let off = 1; off <= durationMonths; off += 1) {
    out.push(make('imtihon', seq++, off));
  }

  return out;
}
