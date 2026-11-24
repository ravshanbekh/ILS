/**
 * Tadbir (chempionat) uchun coin — dars sessiyasisiz.
 *
 * Demo-mentor (kurator) haftalik "Chempionat kuni"ni o'z guruhida bo'lmagan
 * bolalar bilan, dars sessiyasidan tashqarida o'tkazadi. Oddiy coin esa faqat
 * dars sessiyasi ichida beriladi (adjustLessonCoin). Bu yerda:
 *   - ledger yozuvi lessonSessionId = null, shopOrderId = null, sabab majburiy;
 *   - bitta topshiriqdagi barcha yozuvlar bir xil createdAt oladi — "Coin
 *     nazorati" ularni bitta tadbir sifatida guruhlaydi;
 *   - teacherId = bergan xodim → coin avtomatik uning kunlik yig'indisiga
 *     (checkTeacherLimit) kiradi va chegaradan oshsa admin/kassirga xabar boradi.
 *
 * Doira (IDOR'dan himoya — hammasi serverda):
 *   - admin yoki `coin_oversight` egasi — istalgan faol o'quvchi;
 *   - boshqalar (asosan kurator) — faqat o'ziga biriktirilgan, holati "faol"
 *     kurator o'quvchilari (CuratorStudent).
 * Ro'yxatda bitta ham doiradan tashqari o'quvchi bo'lsa — hech kimga berilmaydi.
 */
import prisma from '../../config/database';
import { ApiError } from '../../shared/middleware/errorHandler';
import { hasPermission } from '../../shared/middleware/permission.middleware';
import settingsService from '../settings/settings.service';
import coinsService from './coins.service';
import logger from '../../shared/utils/logger';

export const EVENT_COIN_MAX_AMOUNT = 100;
export const EVENT_COIN_MAX_STUDENTS = 50;

export interface Actor {
  userId: string;
  role: string;
}

type Scope = 'all' | 'own';

async function scopeOf(actor: Actor): Promise<Scope> {
  if (actor.role === 'admin' || (await hasPermission(actor, 'coin_oversight'))) return 'all';
  return 'own';
}

/** Bugungi kun boshi — checkTeacherLimit bilan bir xil hisob (server vaqti) */
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function givenToday(userId: string): Promise<number> {
  const agg = await prisma.coinTransaction.aggregate({
    where: { teacherId: userId, amount: { gt: 0 }, createdAt: { gte: startOfToday() } },
    _sum: { amount: true },
  });
  return agg._sum.amount || 0;
}

/** Sahifa uchun: doira, kunlik chegara, bugun berilgan, cheklovlar */
export async function eventContext(actor: Actor) {
  const [scope, settings, today] = await Promise.all([scopeOf(actor), settingsService.getCoinSettings(), givenToday(actor.userId)]);
  return {
    scope,
    dailyLimit: settings.coinDailyLimitPerTeacher,
    givenToday: today,
    maxAmount: EVENT_COIN_MAX_AMOUNT,
    maxStudents: EVENT_COIN_MAX_STUDENTS,
  };
}

const studentSelect = {
  id: true,
  fullName: true,
  login: true,
  groupStudents: { select: { group: { select: { name: true } } }, take: 2, orderBy: { joinedAt: 'desc' as const } },
};
const shape = (u: { id: string; fullName: string; login: string; groupStudents: { group: { name: string } }[] }) => ({
  id: u.id,
  fullName: u.fullName,
  login: u.login,
  groups: u.groupStudents.map((g) => g.group.name),
});

/**
 * Tanlash ro'yxati. Kurator — o'zining barcha faol o'quvchilari (qidiruv
 * ixtiyoriy). Nazoratchi — faqat qidiruv bo'yicha (kamida 2 harf, 20 ta).
 * Faqat kerakli maydonlar tanlanadi (telegramId/chatId kabi BigInt yo'q).
 */
export async function eligibleStudents(actor: Actor, q: string) {
  const scope = await scopeOf(actor);
  const query = q.trim();
  const nameFilter = query
    ? { OR: [{ fullName: { contains: query, mode: 'insensitive' as const } }, { login: { contains: query, mode: 'insensitive' as const } }] }
    : {};
  if (scope === 'own') {
    const rows = await prisma.user.findMany({
      where: { role: 'student', isActive: true, curatorEnrollment: { curatorId: actor.userId, status: 'faol' }, ...nameFilter },
      select: studentSelect,
      orderBy: { fullName: 'asc' },
      take: 200,
    });
    return { scope, students: rows.map(shape) };
  }
  if (query.length < 2) return { scope, students: [] };
  const rows = await prisma.user.findMany({
    where: { role: 'student', isActive: true, ...nameFilter },
    select: studentSelect,
    orderBy: { fullName: 'asc' },
    take: 20,
  });
  return { scope, students: rows.map(shape) };
}

export interface AwardInput {
  studentIds: string[];
  amount: number;
  reason: string;
}

export async function awardEventCoins(actor: Actor, input: AwardInput) {
  const ids = [...new Set(input.studentIds)];
  const reason = input.reason.trim();
  if (!ids.length) throw ApiError.badRequest("Kamida bitta o'quvchini tanlang");
  if (ids.length > EVENT_COIN_MAX_STUDENTS) throw ApiError.badRequest(`Bir martada ${EVENT_COIN_MAX_STUDENTS} tadan ortiq o'quvchi tanlab bo'lmaydi`);
  if (!Number.isInteger(input.amount) || input.amount < 1 || input.amount > EVENT_COIN_MAX_AMOUNT) {
    throw ApiError.badRequest(`Miqdor 1 dan ${EVENT_COIN_MAX_AMOUNT} gacha butun son bo'lishi kerak`);
  }
  if (reason.length < 3) throw ApiError.badRequest('Sabab yoki tadbir nomini yozing (kamida 3 belgi)');

  const scope = await scopeOf(actor);
  const allowed = await prisma.user.findMany({
    where: {
      id: { in: ids },
      role: 'student',
      isActive: true,
      ...(scope === 'own' ? { curatorEnrollment: { curatorId: actor.userId, status: 'faol' } } : {}),
    },
    select: { id: true, fullName: true },
  });
  if (allowed.length !== ids.length) {
    // Qaysilari tashqarida ekanini nomi bilan aytmaymiz — begona id haqida ma'lumot oqmasin
    const outside = ids.length - allowed.length;
    throw ApiError.forbidden(
      scope === 'own'
        ? `${outside} ta o'quvchi sizga biriktirilgan faol o'quvchilar ro'yxatida yo'q — hech kimga coin berilmadi`
        : `${outside} ta o'quvchi topilmadi yoki faol emas — hech kimga coin berilmadi`,
    );
  }

  // Bitta tadbir = bir xil vaqt belgisi (nazoratda guruhlash uchun)
  const at = new Date();
  await prisma.coinTransaction.createMany({
    data: allowed.map((s) => ({
      studentId: s.id,
      teacherId: actor.userId,
      amount: input.amount,
      reason: `Tadbir: ${reason}`.slice(0, 300),
      lessonSessionId: null,
      shopOrderId: null,
      createdAt: at,
    })),
  });

  await prisma.auditLog.create({
    data: {
      userId: actor.userId,
      action: 'EVENT_COIN_AWARD',
      targetType: 'coin',
      targetId: null,
      details: { reason, amount: input.amount, students: allowed.length, studentIds: allowed.map((s) => s.id) },
    },
  });

  // Kunlik chegara: yig'indiga kiradi, oshsa admin/kassirga xabar (kuniga bir marta)
  coinsService.checkTeacherLimit(actor.userId).catch((err) => logger.warn(`Coin chegarasini tekshirishda xato: ${err.message}`));

  const balances = await prisma.coinTransaction.groupBy({
    by: ['studentId'],
    where: { studentId: { in: allowed.map((s) => s.id) } },
    _sum: { amount: true },
  });
  const bal = new Map(balances.map((b) => [b.studentId, b._sum.amount || 0]));
  const ctx = await eventContext(actor);
  return {
    awarded: allowed.length,
    amount: input.amount,
    total: allowed.length * input.amount,
    reason,
    at: at.toISOString(),
    students: allowed.map((s) => ({ id: s.id, fullName: s.fullName, balance: bal.get(s.id) ?? 0 })),
    givenToday: ctx.givenToday,
    dailyLimit: ctx.dailyLimit,
    overLimit: ctx.dailyLimit > 0 && ctx.givenToday > ctx.dailyLimit,
  };
}

/**
 * "Coin nazorati" uchun: tadbir coinlari (dars va do'kondan tashqari) —
 * bitta tadbir bitta qator: kim, qachon, sabab, nechta bola, jami.
 */
export async function listEventAwards(period: 'today' | 'week' | 'month' | 'all') {
  const since = new Date();
  if (period === 'today') since.setHours(0, 0, 0, 0);
  else if (period === 'week') since.setDate(since.getDate() - 7);
  else if (period === 'month') since.setDate(since.getDate() - 30);

  const rows = await prisma.coinTransaction.findMany({
    where: {
      lessonSessionId: null,
      shopOrderId: null,
      teacherId: { not: null },
      amount: { gt: 0 },
      reason: { startsWith: 'Tadbir: ' },
      ...(period === 'all' ? {} : { createdAt: { gte: since } }),
    },
    orderBy: { createdAt: 'desc' },
    take: 2000,
    select: {
      teacherId: true,
      amount: true,
      reason: true,
      createdAt: true,
      teacher: { select: { fullName: true, role: true } },
      student: { select: { id: true, fullName: true } },
    },
  });

  const groups = new Map<
    string,
    { at: string; giverId: string; giverName: string; giverRole: string; reason: string; amount: number; total: number; students: { id: string; fullName: string }[] }
  >();
  for (const r of rows) {
    const key = `${r.teacherId}|${r.createdAt.toISOString()}|${r.reason}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        at: r.createdAt.toISOString(),
        giverId: r.teacherId!,
        giverName: r.teacher?.fullName ?? '—',
        giverRole: r.teacher?.role ?? '',
        reason: (r.reason ?? '').replace(/^Tadbir: /, ''),
        amount: r.amount,
        total: 0,
        students: [],
      };
      groups.set(key, g);
    }
    g.total += r.amount;
    g.students.push(r.student);
  }
  const awards = [...groups.values()];
  return { period, total: awards.reduce((s, a) => s + a.total, 0), awards };
}
