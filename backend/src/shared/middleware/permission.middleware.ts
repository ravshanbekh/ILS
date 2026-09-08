import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/database';
import { ApiError } from './errorHandler';
import { PermissionKey, PERMISSIONS } from '../constants/permissions';

/**
 * Qo'lda berilgan ruxsatni tekshiradi. roleGuard dan KEYIN ishlatiladi:
 *   router.post('/x', roleGuard('admin', 'teacher'), permissionGuard('transfer_student'), handler)
 *
 * Admin roli har doim o'tadi — u uchun ruxsatlar jadvali tekshirilmaydi.
 */
export const permissionGuard = (permission: PermissionKey) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) return next(ApiError.unauthorized());

      // Admin — to'liq huquqli
      if (user.role === 'admin') return next();

      const granted = await prisma.userPermission.findUnique({
        where: { userId_permission: { userId: user.userId, permission } },
        select: { id: true },
      });

      if (!granted) {
        return next(
          ApiError.forbidden(
            `Sizda "${PERMISSIONS[permission].label}" ruxsati yo'q — administratordan so'rang`
          )
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Guard emas — controller ichida "shu ruxsat bormi?" deb tekshirish uchun.
 * Masalan do'kon ro'yxatida yashirilgan mahsulotlarni faqat boshqaruv
 * ruxsati borlarga ko'rsatish uchun ishlatiladi.
 */
export const hasPermission = async (
  user: { userId: string; role: string } | undefined,
  permission: PermissionKey
): Promise<boolean> => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const granted = await prisma.userPermission.findUnique({
    where: { userId_permission: { userId: user.userId, permission } },
    select: { id: true },
  });
  return !!granted;
};
