import prisma from '../../config/database';
import { ApiError } from '../../shared/middleware/errorHandler';
import { buildSchedule, type LessonDayType } from './milestones.schedule';

/** Bugun — UTC yarim tun (sanalar @db.Date, vaqt qismi yo'q) */
function today(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

const sameDay = (a: Date, b: Date) => a.getTime() === b.getTime();

const DAY_MS = 86_400_000;

/**
 * Guruh jadvalini qurish/yangilash.
 *
 * IDEMPOTENT: mavjud bosqichlarning tanlangan sanasi va "o'tkazildi" belgisi
 * SAQLANADI — faqat yo'qlari qo'shiladi. Aks holda guruh sozlamasini bir
 * marta tahrirlash butun tarixni o'chirib yuborardi.
 */
export async function syncGroupSchedule(groupId: string) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, startDate: true, durationMonths: true, lessonDayType: true },
  });
  if (!group) throw ApiError.notFound('Guruh topilmadi');
  if (!group.startDate || !group.durationMonths || !group.lessonDayType) {
    return { created: 0, reason: 'sozlanmagan' as const };
  }

  const planned = buildSchedule({
    startDate: group.startDate,
    durationMonths: group.durationMonths,
    lessonDayType: group.lessonDayType as LessonDayType,
  });

  const existing = await prisma.groupMilestone.findMany({
    where: { groupId },
    select: { type: true, seq: true },
  });
  const have = new Set(existing.map((e) => `${e.type}:${e.seq}`));

  const toCreate = planned
    .filter((p) => !have.has(`${p.type}:${p.seq}`))
    .map((p) => ({
      groupId,
      type: p.type,
      seq: p.seq,
      candidates: p.candidates,
      dueDate: p.dueDate,
    }));

  if (toCreate.length > 0) {
    await prisma.groupMilestone.createMany({ data: toCreate });
  }
  return { created: toCreate.length, reason: 'ok' as const };
}

/** Guruhning barcha bosqichlari, muddat bo'yicha tartiblangan */
export async function getGroupMilestones(groupId: string) {
  return prisma.groupMilestone.findMany({
    where: { groupId },
    orderBy: [{ dueDate: 'asc' }, { type: 'asc' }],
  });
}

/**
 * O'qituvchi nomzodlardan birini tanlaydi.
 *
 * Bir kunda ham demo day, ham imtihon bo'lmasligi kerak — shuning uchun
 * o'sha guruhda boshqa bosqichga allaqachon tanlangan sana rad etiladi.
 * (Demo day #1 va imtihon #1 bir oyga tushadi va nomzodlari bir xil.)
 */
export async function pickDate(milestoneId: string, dateISO: string) {
  const m = await prisma.groupMilestone.findUnique({ where: { id: milestoneId } });
  if (!m) throw ApiError.notFound('Bosqich topilmadi');
  if (m.heldAt) throw ApiError.badRequest("Bu bosqich allaqachon o'tkazilgan");

  const chosen = new Date(`${dateISO}T00:00:00.000Z`);
  if (Number.isNaN(chosen.getTime())) throw ApiError.badRequest("Sana noto'g'ri");

  const isCandidate = m.candidates.some((c) => sameDay(c, chosen));
  // Muddat o'tgan bo'lsa yangi sana tanlashga ruxsat beramiz: kechikkan
  // bo'lsa ham o'tkazish kerak. Faqat o'tmishga belgilash mumkin emas.
  const isLateReschedule = m.dueDate < today() && chosen >= today();
  if (!isCandidate && !isLateReschedule) {
    throw ApiError.badRequest("Bu sana taklif qilingan kunlar orasida yo'q");
  }

  const clash = await prisma.groupMilestone.findFirst({
    where: { groupId: m.groupId, id: { not: m.id }, plannedDate: chosen },
    select: { type: true },
  });
  if (clash) {
    const what = clash.type === 'demo_day' ? 'demo day' : 'imtihon';
    throw ApiError.badRequest(`Bu kunga allaqachon ${what} belgilangan — boshqa kun tanlang`);
  }

  return prisma.groupMilestone.update({
    where: { id: milestoneId },
    data: { plannedDate: chosen, status: 'sana_tanlandi' },
  });
}

/**
 * Demo day o'tkazilganini belgilash.
 *
 * Imtihon uchun bu chaqirilmaydi — u `refreshStatuses` da haqiqiy imtihon
 * ma'lumotidan avtomatik aniqlanadi.
 */
export async function markHeld(milestoneId: string, userId: string) {
  const m = await prisma.groupMilestone.findUnique({ where: { id: milestoneId } });
  if (!m) throw ApiError.notFound('Bosqich topilmadi');
  if (m.heldAt) throw ApiError.badRequest('Allaqachon belgilangan');

  const late = today() > m.dueDate;
  return prisma.groupMilestone.update({
    where: { id: milestoneId },
    data: {
      heldAt: new Date(),
      heldById: userId,
      status: late ? 'kechikib_bajarildi' : 'bajarildi',
    },
  });
}

/**
 * Kunlik yangilash (cron):
 *   1) imtihon bosqichlarini haqiqiy imtihonlardan avtomatik yopish
 *   2) muddati o'tganlarni "kechikdi" ga o'tkazish
 */
export async function refreshStatuses() {
  const now = today();

  const openExams = await prisma.groupMilestone.findMany({
    where: { type: 'imtihon', heldAt: null },
    select: { id: true, groupId: true, candidates: true, dueDate: true },
  });

  let autoClosed = 0;
  for (const m of openExams) {
    const from = m.candidates[0] ?? m.dueDate;
    const exam = await prisma.exam.findFirst({
      where: {
        status: { not: 'draft' },
        examGroups: { some: { groupId: m.groupId } },
        startsAt: { gte: from },
      },
      orderBy: { startsAt: 'asc' },
      select: { id: true, startsAt: true },
    });
    if (!exam) continue;

    const startDay = new Date(
      Date.UTC(
        exam.startsAt.getUTCFullYear(),
        exam.startsAt.getUTCMonth(),
        exam.startsAt.getUTCDate()
      )
    );
    await prisma.groupMilestone.update({
      where: { id: m.id },
      data: {
        heldAt: exam.startsAt,
        examId: exam.id,
        status: startDay > m.dueDate ? 'kechikib_bajarildi' : 'bajarildi',
      },
    });
    autoClosed++;
  }

  const late = await prisma.groupMilestone.updateMany({
    where: {
      heldAt: null,
      dueDate: { lt: now },
      status: { in: ['kutilmoqda', 'sana_tanlandi'] },
    },
    data: { status: 'kechikdi' },
  });

  return { autoClosed, markedLate: late.count };
}

const GROUP_SELECT = {
  id: true,
  name: true,
  teacher: { select: { id: true, fullName: true } },
} as const;

const daysLateOf = (dueDate: Date, now: Date) =>
  Math.floor((now.getTime() - dueDate.getTime()) / DAY_MS);

/** Nazorat paneli ro'yxati */
export async function getOverview(filters: {
  type?: 'demo_day' | 'imtihon';
  status?: string;
  teacherId?: string;
}) {
  const where: any = {};
  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;
  if (filters.teacherId) where.group = { teacherId: filters.teacherId };

  const rows = await prisma.groupMilestone.findMany({
    where,
    orderBy: [{ dueDate: 'asc' }],
    include: { group: { select: GROUP_SELECT } },
    take: 500,
  });

  const now = today();
  return rows.map((r) => ({
    ...r,
    daysLate: r.heldAt || r.dueDate >= now ? 0 : daysLateOf(r.dueDate, now),
  }));
}

/**
 * Ekran tepasidagi banner uchun.
 * Admin — hammasi, o'qituvchi — faqat o'z guruhlari.
 */
export async function getWarnings(opts: { teacherId?: string }) {
  const where: any = { status: 'kechikdi' };
  if (opts.teacherId) where.group = { teacherId: opts.teacherId };

  const rows = await prisma.groupMilestone.findMany({
    where,
    orderBy: { dueDate: 'asc' },
    include: { group: { select: GROUP_SELECT } },
    take: 50,
  });

  const now = today();
  return {
    total: rows.length,
    demoDay: rows.filter((r) => r.type === 'demo_day').length,
    exam: rows.filter((r) => r.type === 'imtihon').length,
    items: rows.map((r) => ({
      id: r.id,
      type: r.type,
      groupId: r.group.id,
      groupName: r.group.name,
      teacherName: r.group.teacher?.fullName ?? '—',
      dueDate: r.dueDate,
      daysLate: daysLateOf(r.dueDate, now),
    })),
  };
}

/**
 * Oylik statistika — o'quv bo'limi guruhiga skrinshot qilib tashlash uchun.
 * `month` — "2026-10" ko'rinishida.
 */
export async function getMonthlySummary(month: string) {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) throw ApiError.badRequest("Oy formati noto'g'ri (2026-10)");
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 1));

  const rows = await prisma.groupMilestone.findMany({
    where: { dueDate: { gte: from, lt: to } },
    include: { group: { select: GROUP_SELECT } },
  });

  const now = today();
  const bucket = (t: 'demo_day' | 'imtihon') => {
    const list = rows.filter((r) => r.type === t);
    return {
      total: list.length,
      done: list.filter((r) => r.status === 'bajarildi').length,
      lateDone: list.filter((r) => r.status === 'kechikib_bajarildi').length,
      pending: list.filter((r) => r.status === 'kutilmoqda' || r.status === 'sana_tanlandi').length,
      late: list.filter((r) => r.status === 'kechikdi').length,
    };
  };

  return {
    month,
    demoDay: bucket('demo_day'),
    exam: bucket('imtihon'),
    lateList: rows
      .filter((r) => r.status === 'kechikdi')
      .map((r) => ({
        type: r.type,
        groupName: r.group.name,
        teacherName: r.group.teacher?.fullName ?? '—',
        daysLate: daysLateOf(r.dueDate, now),
      }))
      .sort((a, b) => b.daysLate - a.daysLate),
  };
}

/** Sozlanmagan guruhlar — boshlanish sanasi, uzunlik yoki dars kuni yo'q */
export async function getUnconfiguredGroups() {
  return prisma.group.findMany({
    where: {
      isActive: true,
      OR: [{ startDate: null }, { durationMonths: null }, { lessonDayType: null }],
    },
    select: { ...GROUP_SELECT, startDate: true, durationMonths: true, lessonDayType: true },
    orderBy: { name: 'asc' },
  });
}

export default {
  syncGroupSchedule,
  getGroupMilestones,
  pickDate,
  markHeld,
  refreshStatuses,
  getOverview,
  getWarnings,
  getMonthlySummary,
  getUnconfiguredGroups,
};
