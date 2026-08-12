import { Request, Response, NextFunction } from 'express';
import trashService from './trash.service';
import { getPagination } from '../../shared/utils/pagination';

class TrashController {
  /**
   * GET /api/trash/groups
   */
  async getTrashGroups(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = getPagination(req.query as any);
      const search = req.query.search as string | undefined;

      const result = await trashService.getTrashGroups(pagination, search);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/trash/users
   */
  async getTrashUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = getPagination(req.query as any);
      const search = req.query.search as string | undefined;
      const role = req.query.role as string | undefined;

      const result = await trashService.getTrashUsers(pagination, search, role);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/trash/groups/:id/restore
   */
  async restoreGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await trashService.restoreGroup(req.params.id, req.user?.userId);
      res.json({ success: true, data: result, message: 'Guruh qaytarildi' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/trash/users/:id/restore
   */
  async restoreUser(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await trashService.restoreUser(req.params.id, req.user?.userId);
      res.json({ success: true, data: result, message: 'Foydalanuvchi qaytarildi' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/trash/groups/:id/permanent
   */
  async permanentlyDeleteGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await trashService.permanentlyDeleteGroup(req.params.id, req.user?.userId);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/trash/users/:id/permanent
   */
  async permanentlyDeleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await trashService.permanentlyDeleteUser(req.params.id, req.user?.userId);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/trash/empty
   */
  async emptyTrash(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await trashService.emptyTrash(req.user?.userId);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
}

export default new TrashController();
