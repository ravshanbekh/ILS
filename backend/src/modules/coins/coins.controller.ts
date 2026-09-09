import { Request, Response, NextFunction } from 'express';
import coinsService from './coins.service';
import settingsService from '../settings/settings.service';
import prisma from '../../config/database';
import { ApiError } from '../../shared/middleware/errorHandler';
import { hasPermission } from '../../shared/middleware/permission.middleware';

/**
 * Bitta o'quvchining coin ma'lumotini kim ko'rishi mumkinligini tekshiradi.
 *   - o'quvchi — faqat o'zini
 *   - o'qituvchi — faqat o'z guruhidagini
 *   - admin yoki coin_oversight ruxsati borlar — hammasini
 *   - qolganlar (farrosh, call_operatori va h.k.) — yo'q
 * Ilgari o'qituvchidan boshqa istalgan rol istalgan o'quvchining balans/tarixini
 * ko'ra olardi.
 */
async function assertCanViewStudentCoins(
  requester: { userId: string; role: string },
  studentId: string
) {
  if (requester.role === 'student') {
    if (requester.userId !== studentId) {
      throw ApiError.forbidden("Faqat o'zingizning ma'lumotingizni ko'ra olasiz");
    }
    return;
  }
  if (requester.role === 'teacher') {
    const owns = await prisma.groupStudent.findFirst({
      where: { studentId, group: { teacherId: requester.userId } },
      select: { id: true },
    });
    if (!owns) throw ApiError.forbidden("Bu o'quvchi sizning guruhingizda emas");
    return;
  }
  // Admin va coin_oversight ruxsati borlar o'tadi, qolganlar yo'q
  const allowed = await hasPermission(requester, 'coin_oversight');
  if (!allowed) {
    throw ApiError.forbidden("Sizda o'quvchi coin ma'lumotini ko'rish ruxsati yo'q");
  }
}

class CoinsController {
  /**
   * GET /api/coins/balance/:studentId
   * O'quvchi — o'zinikini, o'qituvchi — o'z guruhidagini, admin/oversight — hammasini.
   */
  async getBalance(req: Request, res: Response, next: NextFunction) {
    try {
      const { studentId } = req.params;
      await assertCanViewStudentCoins(req.user!, studentId);

      const balance = await coinsService.getBalance(studentId);
      res.json({ success: true, data: { balance } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/coins/history/:studentId
   */
  async getHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { studentId } = req.params;
      await assertCanViewStudentCoins(req.user!, studentId);

      const history = await coinsService.getHistory(studentId);
      res.json({ success: true, data: history });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/coins/teacher-stats?period=today|week|month — admin/kassir
   */
  async getTeacherStats(req: Request, res: Response, next: NextFunction) {
    try {
      const period = (req.query.period as 'today' | 'week' | 'month') || 'today';
      const result = await coinsService.getTeacherStats(period);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/coins/student-stats — o'quvchilar kesimida coin nazorati
   */
  async getStudentStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { period, groupId, teacherId } = req.query as Record<string, string | undefined>;
      const result = await coinsService.getStudentStats({
        period: (period as any) || 'month',
        groupId,
        teacherId,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/coins/teacher-breakdown/:teacherId — bitta o'qituvchi kimga qancha qo'ygan
   */
  async getTeacherBreakdown(req: Request, res: Response, next: NextFunction) {
    try {
      const period = (req.query.period as any) || 'month';
      const result = await coinsService.getTeacherBreakdown(req.params.teacherId, period);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/coins/settings — nazorat ruxsati borlar ko'radi
   */
  async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await settingsService.getCoinSettings();
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/coins/settings — faqat admin o'zgartira oladi
   */
  async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const { coinDailyLimitPerTeacher } = req.body;
      if (!Number.isInteger(coinDailyLimitPerTeacher) || coinDailyLimitPerTeacher <= 0) {
        return res.status(400).json({ success: false, message: "Chegara musbat butun son bo'lishi kerak" });
      }
      const settings = await settingsService.updateCoinSettings({ coinDailyLimitPerTeacher });
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }
}

export default new CoinsController();
