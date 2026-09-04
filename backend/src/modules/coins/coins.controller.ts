import { Request, Response, NextFunction } from 'express';
import coinsService from './coins.service';
import settingsService from '../settings/settings.service';
import prisma from '../../config/database';
import { ApiError } from '../../shared/middleware/errorHandler';

class CoinsController {
  /**
   * GET /api/coins/balance/:studentId
   * O'quvchi — o'zinikini, o'qituvchi — o'z guruhidagini, admin/kassir — hammasini ko'radi.
   */
  async getBalance(req: Request, res: Response, next: NextFunction) {
    try {
      const { studentId } = req.params;
      const requester = req.user!;

      if (requester.role === 'student' && requester.userId !== studentId) {
        throw ApiError.forbidden("Faqat o'zingizning balansingizni ko'ra olasiz");
      }
      if (requester.role === 'teacher') {
        const owns = await prisma.groupStudent.findFirst({
          where: { studentId, group: { teacherId: requester.userId } },
        });
        if (!owns) throw ApiError.forbidden("Bu o'quvchi sizning guruhingizda emas");
      }

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
      const requester = req.user!;

      if (requester.role === 'student' && requester.userId !== studentId) {
        throw ApiError.forbidden("Faqat o'zingizning tarixingizni ko'ra olasiz");
      }

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
   * GET /api/coins/settings — admin/kassir ko'radi
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
