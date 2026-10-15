import { z } from 'zod';

// "Darsni kuzatish varag'i — A4.pdf", 1-versiya. IDlarni o'zgartirmang:
// avvalgi kuzatuvlarning ballari shu kalitlar bilan saqlanadi.
interface ObservationSection {
  id: string;
  title: string;
  items: { id: string; label: string }[];
}

export const OBSERVATION_SECTIONS: ObservationSection[] = [
  {
    id: 'start', title: 'Dars boshlanishi',
    items: [
      { id: 'on_time_start', label: 'Dars vaqtida boshlandi, ustoz oldindan tayyor turdi' },
      { id: 'attendance', label: "Davomat olindi va itlivescore'ga kiritildi" },
      { id: 'review', label: "O'tgan mavzu qisqa takrorlandi" },
      { id: 'homework_checked', label: 'Uyga vazifa tekshirildi va baholandi' },
      { id: 'goal', label: 'Dars maqsadi aytildi: “bugun nima yasaymiz”' },
    ],
  },
  {
    id: 'explanation', title: 'Tushuntirish',
    items: [
      { id: 'simple_language', label: 'Yoshga mos, sodda tilda, misollar bilan tushuntirdi' },
      { id: 'practice_time', label: "Nazariya qisqa, amaliyotga ko'proq vaqt qoldi" },
      { id: 'lesson_plan', label: 'Mavzu dars rejasiga (Notion) mos keldi' },
    ],
  },
  {
    id: 'practice', title: 'Amaliyot va faollik',
    items: [
      { id: 'own_work', label: "Har bir bola o'z noutbukida o'zi kod yozdi, ko'chirmadi" },
      { id: 'screen_checks', label: 'Ustoz partalar orasida yurib, ekranlarni tekshirdi' },
      { id: 'support', label: 'Orqada qolgan yoki zerikkan bolani sezdi va yordam berdi' },
      { id: 'extra_task', label: "Tez tugatganlarga qo'shimcha topshiriq bor edi" },
      { id: 'participation', label: "Bolalar savol berishdan qo'rqmadi, faol qatnashdi" },
    ],
  },
  {
    id: 'environment', title: 'Muhit va intizom',
    items: [
      { id: 'distractions', label: "Telefon, o'yin va chalg'ishlar nazorat qilindi" },
      { id: 'respect', label: "Ohang hurmatli va iliq, asabiylik yo'q" },
      { id: 'gamification', label: "Gamifikatsiya ishladi: coin, rag'bat" },
    ],
  },
  {
    id: 'ending', title: 'Dars yakuni',
    items: [
      { id: 'recap', label: 'Dars yakunlandi: “bugun nimani o‘rgandik”' },
      { id: 'clear_homework', label: 'Uyga vazifa aniq berildi, bolalar tushundi' },
      { id: 'on_time_end', label: 'Dars vaqtida tugadi' },
    ],
  },
];

export const OBSERVATION_ITEMS = OBSERVATION_SECTIONS.flatMap(section => section.items);
export const OBSERVATION_MAX_SCORE = OBSERVATION_ITEMS.length * 5; // 95
const itemIds = new Set<string>(OBSERVATION_ITEMS.map(item => item.id));

export const createObservationSchema = z.object({
  teacherId: z.string().uuid(),
  groupId: z.string().uuid().optional(),
  groupName: z.string().trim().min(1).max(100),
  topic: z.string().trim().min(1).max(200),
  studentsEnrolled: z.number().int().min(0).max(1000),
  studentsPresent: z.number().int().min(0).max(1000),
  childrenAnswer: z.string().trim().max(2000).optional(),
  strengths: z.string().trim().min(1).max(2000),
  improvements: z.string().trim().min(1).max(2000),
  ratings: z.record(z.string(), z.number().int().min(1).max(5)),
}).superRefine((value, ctx) => {
  if (value.studentsPresent > value.studentsEnrolled) {
    ctx.addIssue({ code: 'custom', path: ['studentsPresent'], message: "Kelganlar soni ro'yxatdagidan oshmasin" });
  }
  const keys = Object.keys(value.ratings);
  if (keys.length !== itemIds.size || keys.some(key => !itemIds.has(key))) {
    ctx.addIssue({ code: 'custom', path: ['ratings'], message: '19 ta mezonning barchasiga 1–5 ball qo‘ying' });
  }
});

export function observationTotal(ratings: Record<string, number>): number {
  return OBSERVATION_ITEMS.reduce((sum, item) => sum + ratings[item.id], 0);
}

export function observationDateRange(from?: string, to?: string) {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const valid = (date: string) => datePattern.test(date) &&
    new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)))).toISOString().slice(0, 10) === date;
  if ((from && !valid(from)) || (to && !valid(to)) || (from && to && from > to)) return null;
  return {
    ...(from ? { gte: new Date(`${from}T00:00:00+05:00`) } : {}),
    ...(to ? { lte: new Date(`${to}T23:59:59.999+05:00`) } : {}),
  };
}
