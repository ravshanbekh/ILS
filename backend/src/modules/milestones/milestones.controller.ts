import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/database';
import { ApiError } from '../../shared/middleware/errorHandler';
import milestonesService from './milestones.service';

const ADMIN_ROLES = ['admin', 'administrator'];

/**
 * O'qituvchi faqat O'Z guruhining bosqichiga tega oladi.
 *
 * Bu tekshiruv ataylab alohida: roleGuard('teacher') faqat "o'qituvchimi"
 * deb so'raydi, "SHU guruhning o'qituvchisimi" deb emas. Loyihada aynan shu
 * turdagi xato (rol bor, egalik yo'q) bir necha marta chiqqan.
 */
async function assertCanEdit(milestoneId: string, req: Request) {
  const m = await prisma.groupMilestone.findUnique({
    where: { id: milestoneId },
    select: { id: true, group: { select: { teacherId: true } } },
  });
  if (!m) throw ApiError.notFound('Bosqich topilmadi');

  if (ADMIN_ROLES.includes(req.user!.role)) return;
  if (m.group.teacherId !== req.user!.userId) {
    throw ApiError.forbidden("Bu guruh sizga biriktirilmagan");
  }
}

class MilestonesController {
  /** GET /api/milestones/group/:groupId */
  async getByGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await milestonesService.getGroupMilestones(req.params.groupId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/milestones/group/:groupId/sync — jadvalni qurish/yangilash */
  async sync(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await milestonesService.syncGroupSchedule(req.params.groupId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /** PATCH /api/milestones/:id/date  { date: "2026-11-03" } */
  async pickDate(req: Request, res: Response, next: NextFunction) {
    try {
      await assertCanEdit(req.params.id, req);
      const date = req.body?.date;
      if (typeof date !== 'string') throw ApiError.badRequest('date talab qilinadi');
      const data = await milestonesService.pickDate(req.params.id, date);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/milestones/:id/held — demo day o'tkazildi */
  async markHeld(req: Request, res: Response, next: NextFunction) {
    try {
      await assertCanEdit(req.params.id, req);
      const data = await milestonesService.markHeld(req.params.id, req.user!.userId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/milestones/overview?type=&status=&teacherId= */
  async overview(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await milestonesService.getOverview({
        type: req.query.type as any,
        status: req.query.status as string | undefined,
        teacherId: req.query.teacherId as string | undefined,
      });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/milestones/warnings — ekran tepasidagi banner.
   * O'qituvchi/assistent faqat o'z guruhlarini ko'radi.
   */
  async warnings(req: Request, res: Response, next: NextFunction) {
    try {
      const isAdmin = ADMIN_ROLES.includes(req.user!.role);
      const data = await milestonesService.getWarnings(
        isAdmin ? {} : { teacherId: req.user!.userId }
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/milestones/summary?month=2026-10 */
  async summary(req: Request, res: Response, next: NextFunction) {
    try {
      const now = new Date();
      const fallback = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
      const data = await milestonesService.getMonthlySummary(
        (req.query.month as string) || fallback
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/milestones/unconfigured */
  async unconfigured(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await milestonesService.getUnconfiguredGroups();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export default new MilestonesController();
