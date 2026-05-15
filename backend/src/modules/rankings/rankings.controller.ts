import { Request, Response, NextFunction } from 'express';
import rankingsService from './rankings.service';
import { getPagination } from '../../shared/utils/pagination';

class RankingsController {
  /**
   * GET /api/rankings/overall — Umumiy reyting
   */
  async getOverall(req: Request, res: Response, next: NextFunction) {
    try {
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
      const result = await rankingsService.getGroupRanking(req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export default new RankingsController();
