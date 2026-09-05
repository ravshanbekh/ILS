import { Request, Response, NextFunction } from 'express';
import permissionsService from './permissions.service';
import { getPermissionCatalog, PERMISSION_KEYS } from '../../shared/constants/permissions';

class PermissionsController {
  /** GET /api/permissions/catalog — mavjud ruxsatlar ro'yxati (admin) */
  async getCatalog(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: getPermissionCatalog() });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/permissions/users — odamlar + ularning ruxsatlari (admin) */
  async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, role } = req.query as { search?: string; role?: string };
      const data = await permissionsService.listUsersWithPermissions({ search, role });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /** PUT /api/permissions/users/:id — ruxsatlarni to'liq belgilash (admin) */
  async setUserPermissions(req: Request, res: Response, next: NextFunction) {
    try {
      const { permissions } = req.body;
      if (!Array.isArray(permissions)) {
        return res.status(400).json({ success: false, message: 'permissions massiv bo\'lishi kerak' });
      }
      const data = await permissionsService.setUserPermissions(
        req.params.id,
        permissions,
        req.user!.userId
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/permissions/me — o'zining ruxsatlari (barcha rollar).
   * Frontend shu asosda tugmalarni ko'rsatadi/yashiradi.
   */
  async getMine(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      // Admin — hamma narsaga ruxsatli
      if (user.role === 'admin') {
        return res.json({ success: true, data: { isAdmin: true, permissions: PERMISSION_KEYS } });
      }
      const permissions = await permissionsService.getUserPermissions(user.userId);
      res.json({ success: true, data: { isAdmin: false, permissions } });
    } catch (error) {
      next(error);
    }
  }
}

export default new PermissionsController();
