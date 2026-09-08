import prisma from '../../config/database';
import { ApiError } from '../../shared/middleware/errorHandler';
import settingsService from '../settings/settings.service';
import logger from '../../shared/utils/logger';
import { emitToUser } from '../../shared/utils/socket';

// O'qituvchi kunlik chegaradan oshganda kuniga faqat bitta marta bildirishnoma
// yuborish uchun — server umri davomida keshlanadi (qayta ishga tushganda tozalanadi,
// bu zararsiz — eng ko'pi bilan bitta ortiqcha bildirishnoma yuboriladi).
const notifiedToday = new Map<string, string>(); // teacherId -> 'YYYY-MM-DD'

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

class CoinsService {
  async getBalance(studentId: string): Promise<number> {
    const agg = await prisma.coinTransaction.aggregate({
      where: { studentId },
      _sum: { amount: true },
    });
    return agg._sum.amount || 0;
  }

  async getHistory(studentId: string, limit = 100) {
    return prisma.coinTransaction.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        teacher: { select: { fullName: true } },
        shopOrder: { include: { item: { select: { name: true } } } },
      },
    });
  }

  /**
   * O'qituvchi (yoki admin) o'quvchining shu darsdagi coiniga delta qo'shadi/ayiradi —
   * musbat son kiritilsa qo'shiladi, manfiy son (masalan -5) kiritilsa ayiriladi.
   * LessonGrade.coinAwarded — shu darsda jami berilgan coin (0 dan kamaymaydi);
   * har bir amal alohida CoinTransaction yozuvi sifatida ledgerga tushadi, shu bilan
   * o'quvchining umumiy balansi har doim shu ledger yig'indisidan hisoblanadi.
   */
  async adjustLessonCoin(sessionId: string, studentId: string, teacherId: string, delta: number) {
    if (!Number.isInteger(delta) || delta === 0) {
      throw ApiError.badRequest("Coin o'zgarishi nol bo'lmagan butun son bo'lishi kerak");
    }
    if (Math.abs(delta) > 1000) {
      throw ApiError.badRequest("Bir martada 1000 coindan ortiq o'zgartirib bo'lmaydi");
    }

    const grade = await prisma.lessonGrade.findUnique({
      where: { sessionId_studentId: { sessionId, studentId } },
    });
    if (!grade) throw ApiError.notFound('Baholash yozuvi topilmadi');

    const previous = grade.coinAwarded || 0;
    const next = previous + delta;
    if (next < 0) {
      throw ApiError.badRequest(`Bu darsda berilgan coin (${previous}) dan ko'p ayirib bo'lmaydi`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.lessonGrade.update({
        where: { id: grade.id },
        data: { coinAwarded: next, coinAwardedAt: new Date() },
      });
      await tx.coinTransaction.create({
        data: {
          studentId,
          teacherId,
          amount: delta,
          reason: 'Dars uchun gamifikatsiya coini',
          lessonSessionId: sessionId,
        },
      });
    });

    if (delta > 0) {
      this.checkTeacherLimit(teacherId).catch((err) => {
        logger.warn(`Coin chegarasini tekshirishda xato: ${err.message}`);
      });
    }

    return { coinAwarded: next, balance: await this.getBalance(studentId) };
  }

  /**
   * Bugun shu o'qituvchi jami necha coin berganini tekshiradi; sozlangan kunlik
   * chegaradan oshsa admin/kassirga (in-app + bot) bildirishnoma yuboradi — kuniga bitta marta.
   */
  private async checkTeacherLimit(teacherId: string) {
    const { coinDailyLimitPerTeacher } = await settingsService.getCoinSettings();
    if (!coinDailyLimitPerTeacher || coinDailyLimitPerTeacher <= 0) return;

    const key = todayKey();
    if (notifiedToday.get(teacherId) === key) return;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const agg = await prisma.coinTransaction.aggregate({
      where: { teacherId, amount: { gt: 0 }, createdAt: { gte: startOfDay } },
      _sum: { amount: true },
    });
    const todayTotal = agg._sum.amount || 0;
    if (todayTotal <= coinDailyLimitPerTeacher) return;

    notifiedToday.set(teacherId, key);

    const teacher = await prisma.user.findUnique({ where: { id: teacherId }, select: { fullName: true } });
    const recipients = await prisma.user.findMany({
      where: { role: { in: ['admin', 'kassir'] }, isActive: true },
      select: { id: true },
    });

    const title = 'Coin chegarasi oshib ketdi';
    const body = `${teacher?.fullName || "O'qituvchi"} bugun ${todayTotal} coin berdi (chegara: ${coinDailyLimitPerTeacher}).`;

    for (const r of recipients) {
      const notif = await prisma.notification.create({
        data: { userId: r.id, type: 'coin_limit_exceeded', title, body },
      });
      emitToUser(r.id, 'new_notification', notif);
    }

    const { notifyAdminCoinLimitExceeded } = await import('../bot/bot.notifications');
    notifyAdminCoinLimitExceeded({
      teacherName: teacher?.fullName || "O'qituvchi",
      todayTotal,
      limit: coinDailyLimitPerTeacher,
    }).catch((err: any) => logger.warn(`Coin limit bot xabari yuborilmadi: ${err.message}`));

    logger.info(`Coin limiti oshdi: teacher=${teacherId}, bugungi=${todayTotal}, chegara=${coinDailyLimitPerTeacher}`);
  }

  /**
   * Admin/kassir uchun — har bir o'qituvchi tanlangan davrda jami qancha coin bergani.
   */
  async getTeacherStats(period: 'today' | 'week' | 'month' = 'today') {
    const since = new Date();
    if (period === 'today') since.setHours(0, 0, 0, 0);
    else if (period === 'week') since.setDate(since.getDate() - 7);
    else since.setDate(since.getDate() - 30);

    const { coinDailyLimitPerTeacher } = await settingsService.getCoinSettings();

    const teachers = await prisma.user.findMany({
      where: { role: 'teacher', isActive: true },
      select: { id: true, fullName: true },
    });

    // Barcha o'qituvchilar bo'yicha yig'indi — bitta guruhlangan so'rovda
    // (ilgari har bir o'qituvchi uchun alohida aggregate so'rovi ketardi)
    const grouped = await prisma.coinTransaction.groupBy({
      by: ['teacherId'],
      where: { teacherId: { in: teachers.map((t) => t.id) }, amount: { gt: 0 }, createdAt: { gte: since } },
      _sum: { amount: true },
      _count: { _all: true },
    });
    const byTeacher = new Map(
      grouped.map((row) => [row.teacherId as string, { total: row._sum.amount || 0, count: row._count._all }])
    );

    const stats = teachers.map((t) => {
      const agg = byTeacher.get(t.id) || { total: 0, count: 0 };
      return {
        teacherId: t.id,
        teacherName: t.fullName,
        total: agg.total,
        awardsCount: agg.count,
        overLimit: period === 'today' && coinDailyLimitPerTeacher > 0 && agg.total > coinDailyLimitPerTeacher,
      };
    });

    stats.sort((a, b) => b.total - a.total);
    return { period, dailyLimit: coinDailyLimitPerTeacher, teachers: stats };
  }

  /** Davr boshlanish sanasi — nazorat ko'rinishlari uchun umumiy */
  private periodStart(period: 'today' | 'week' | 'month' | 'all'): Date | null {
    if (period === 'all') return null;
    const since = new Date();
    if (period === 'today') since.setHours(0, 0, 0, 0);
    else if (period === 'week') since.setDate(since.getDate() - 7);
    else since.setDate(since.getDate() - 30);
    return since;
  }

  /**
   * O'quvchilar kesimida: kim qancha coin to'plagan, qancha sarflagan va
   * hozir qancha balansi bor. Guruh/o'qituvchi bo'yicha filtrlanadi.
   */
  async getStudentStats(filters?: {
    period?: 'today' | 'week' | 'month' | 'all';
    groupId?: string;
    teacherId?: string;
  }) {
    const period = filters?.period || 'month';
    const since = this.periodStart(period);

    const studentWhere: any = { role: 'student', isActive: true };
    if (filters?.groupId) {
      studentWhere.groupStudents = { some: { groupId: filters.groupId } };
    } else if (filters?.teacherId) {
      studentWhere.groupStudents = { some: { group: { teacherId: filters.teacherId } } };
    }

    const students = await prisma.user.findMany({
      where: studentWhere,
      select: {
        id: true,
        fullName: true,
        groupStudents: {
          orderBy: { joinedAt: 'desc' },
          take: 1,
          select: { group: { select: { name: true, teacher: { select: { fullName: true } } } } },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    if (students.length === 0) return { period, students: [] };
    const studentIds = students.map((s) => s.id);

    // Davr ichidagi harakatlar (kim berdi — shu yerda ko'rinadi) va
    // umumiy balans (davrdan qat'iy nazar) — ikkita so'rovda
    const [periodTx, balanceRows] = await Promise.all([
      prisma.coinTransaction.findMany({
        where: {
          studentId: { in: studentIds },
          ...(since ? { createdAt: { gte: since } } : {}),
        },
        select: {
          studentId: true,
          teacherId: true,
          amount: true,
          teacher: { select: { fullName: true } },
        },
      }),
      prisma.coinTransaction.groupBy({
        by: ['studentId'],
        where: { studentId: { in: studentIds } },
        _sum: { amount: true },
      }),
    ]);

    const balanceByStudent = new Map(balanceRows.map((r) => [r.studentId, r._sum.amount || 0]));

    interface Acc {
      earned: number;
      spent: number;
      byTeacher: Map<string, { name: string; amount: number }>;
    }
    const accByStudent = new Map<string, Acc>();
    for (const tx of periodTx) {
      let acc = accByStudent.get(tx.studentId);
      if (!acc) {
        acc = { earned: 0, spent: 0, byTeacher: new Map() };
        accByStudent.set(tx.studentId, acc);
      }
      if (tx.amount > 0) {
        acc.earned += tx.amount;
        if (tx.teacherId) {
          const cur = acc.byTeacher.get(tx.teacherId);
          if (cur) cur.amount += tx.amount;
          else acc.byTeacher.set(tx.teacherId, { name: tx.teacher?.fullName || '—', amount: tx.amount });
        }
      } else {
        acc.spent += Math.abs(tx.amount);
      }
    }

    const rows = students.map((s) => {
      const acc = accByStudent.get(s.id);
      const group = s.groupStudents[0]?.group;
      const byTeacher = acc ? [...acc.byTeacher.values()].sort((a, b) => b.amount - a.amount) : [];

      return {
        studentId: s.id,
        fullName: s.fullName,
        groupName: group?.name || null,
        teacherName: group?.teacher?.fullName || null,
        earned: acc?.earned || 0,
        spent: acc?.spent || 0,
        balance: balanceByStudent.get(s.id) || 0,
        // Shu davrda kim ko'proq coin qo'ygan
        topAwarder: byTeacher[0]?.name || null,
        byTeacher,
      };
    });

    rows.sort((a, b) => b.earned - a.earned);
    return { period, students: rows };
  }

  /**
   * Bitta o'qituvchi qaysi o'quvchilarga qancha coin qo'yganini ko'rsatadi —
   * "qaysi bolalarga ko'proq qo'yyapti?" degan savolga javob.
   */
  async getTeacherBreakdown(teacherId: string, period: 'today' | 'week' | 'month' | 'all' = 'month') {
    const since = this.periodStart(period);

    const teacher = await prisma.user.findUnique({
      where: { id: teacherId },
      select: { id: true, fullName: true },
    });
    if (!teacher) throw ApiError.notFound('O\'qituvchi topilmadi');

    const tx = await prisma.coinTransaction.findMany({
      where: {
        teacherId,
        amount: { gt: 0 },
        ...(since ? { createdAt: { gte: since } } : {}),
      },
      select: {
        studentId: true,
        amount: true,
        createdAt: true,
        student: {
          select: {
            fullName: true,
            groupStudents: {
              orderBy: { joinedAt: 'desc' },
              take: 1,
              select: { group: { select: { name: true } } },
            },
          },
        },
      },
    });

    const byStudent = new Map<
      string,
      { studentId: string; fullName: string; groupName: string | null; total: number; times: number; lastAt: Date }
    >();
    for (const t of tx) {
      const cur = byStudent.get(t.studentId);
      if (cur) {
        cur.total += t.amount;
        cur.times++;
        if (t.createdAt > cur.lastAt) cur.lastAt = t.createdAt;
      } else {
        byStudent.set(t.studentId, {
          studentId: t.studentId,
          fullName: t.student.fullName,
          groupName: t.student.groupStudents[0]?.group?.name || null,
          total: t.amount,
          times: 1,
          lastAt: t.createdAt,
        });
      }
    }

    const students = [...byStudent.values()].sort((a, b) => b.total - a.total);
    const total = students.reduce((s, x) => s + x.total, 0);

    return {
      teacher: { id: teacher.id, fullName: teacher.fullName },
      period,
      total,
      studentsCount: students.length,
      students,
    };
  }
}

export default new CoinsService();
