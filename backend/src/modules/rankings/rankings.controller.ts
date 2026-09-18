import { Request, Response, NextFunction } from 'express';
import rankingsService from './rankings.service';
import { getPagination } from '../../shared/utils/pagination';
import { hasPermission } from '../../shared/middleware/permission.middleware';
import { ApiError } from '../../shared/middleware/errorHandler';

/**
 * Reytingni ko'rish huquqi.
 *
 * O'quvchi, o'qituvchi va admin — ruxsatsiz o'tadi: reyting ularning
 * kundalik sahifasi (o'quvchi paneli "Reyting" tugmasi aynan shu yo'lni
 * chaqiradi). Qolgan xodim rollariga qo'lda beriladigan ruxsat kerak.
 *
 * Ilgari bu yo'llarda roleGuard UMUMAN yo'q edi — tizimga kirgan har kim
 * butun maktab reytingini o'qiy olardi.
 */
async function assertCanViewRankings(req: Request) {
  const role = req.user?.role;
  if (role === 'admin' || role === 'teacher' || role === 'student') return;
  if (await hasPermission(req.user, 'view_rankings')) return;
  throw ApiError.forbidden("Reytingni ko'rish uchun ruxsat kerak — administratordan so'rang");
}

class RankingsController {
  /**
   * GET /api/rankings/overall — Umumiy reyting
   */
  async getOverall(req: Request, res: Response, next: NextFunction) {
    try {
      await assertCanViewRankings(req);
      const pagination = getPagination(req.query as any);
      const filters = {
        teacherId: req.query.teacherId as string | undefined,
        groupId: req.query.groupId as string | undefined,
        search: req.query.search as string | undefined,
      };
      
      const result = await rankingsService.getOverallRanking(pagination, filters);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/rankings/group/:id — Guruh reytingi
   */
  async getGroupRanking(req: Request, res: Response, next: NextFunction) {
    try {
      await assertCanViewRankings(req);
      const result = await rankingsService.getGroupRanking(req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/rankings/categories — O'quvchilarni past/o'rtacha/yuqori natijaga bo'lish.
   * O'qituvchi faqat o'z o'quvchilarini ko'radi, admin hammasini (yoki filtr bo'yicha).
   */
  async getCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const filters: { teacherId?: string; groupId?: string } = {
        groupId: req.query.groupId as string | undefined,
      };
      if (req.user?.role === 'teacher') {
        filters.teacherId = req.user.userId;
      } else {
        filters.teacherId = req.query.teacherId as string | undefined;
      }
      const result = await rankingsService.getStudentCategories(filters);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export default new RankingsController();
