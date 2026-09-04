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
   * O'qituvchi dars baholash paytida bitta o'quvchiga coin belgilaydi.
   * LessonGrade.coinAwarded ustiga yoziladi; farq (delta) CoinTransaction sifatida
   * qo'shiladi — shu bilan balans har doim ledger yig'indisidan hisoblanadi, ikki marta
   * bosilib qolsa ham (masalan 10 dan 15 ga o'zgartirilsa) faqat +5 lik yozuv qo'shiladi.
   */
  async setLessonCoin(sessionId: string, studentId: string, teacherId: string, amount: number) {
    if (!Number.isInteger(amount) || amount < 0) {
      throw ApiError.badRequest("Coin manfiy bo'lmagan butun son bo'lishi kerak");
    }
    if (amount > 1000) {
      throw ApiError.badRequest("Bir martada 1000 coindan ortiq berib bo'lmaydi");
    }

    const grade = await prisma.lessonGrade.findUnique({
      where: { sessionId_studentId: { sessionId, studentId } },
    });
    if (!grade) throw ApiError.notFound('Baholash yozuvi topilmadi');

    const previous = grade.coinAwarded || 0;
    const delta = amount - previous;

    await prisma.$transaction(async (tx) => {
      await tx.lessonGrade.update({
        where: { id: grade.id },
        data: { coinAwarded: amount, coinAwardedAt: new Date() },
      });
      if (delta !== 0) {
        await tx.coinTransaction.create({
          data: {
            studentId,
            teacherId,
            amount: delta,
            reason: 'Dars uchun gamifikatsiya coini',
            lessonSessionId: sessionId,
          },
        });
      }
    });

    if (delta > 0) {
      this.checkTeacherLimit(teacherId).catch((err) => {
        logger.warn(`Coin chegarasini tekshirishda xato: ${err.message}`);
      });
    }

    return { coinAwarded: amount, balance: await this.getBalance(studentId) };
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

    const stats = await Promise.all(
      teachers.map(async (t) => {
        const agg = await prisma.coinTransaction.aggregate({
          where: { teacherId: t.id, amount: { gt: 0 }, createdAt: { gte: since } },
          _sum: { amount: true },
          _count: true,
        });
        const total = agg._sum.amount || 0;
        return {
          teacherId: t.id,
          teacherName: t.fullName,
          total,
          awardsCount: agg._count,
          overLimit: period === 'today' && coinDailyLimitPerTeacher > 0 && total > coinDailyLimitPerTeacher,
        };
      })
    );

    stats.sort((a, b) => b.total - a.total);
    return { period, dailyLimit: coinDailyLimitPerTeacher, teachers: stats };
  }
}

export default new CoinsService();
