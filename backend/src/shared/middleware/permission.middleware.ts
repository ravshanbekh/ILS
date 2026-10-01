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
 * Rol YOKI ruxsat — ikkalasidan biri yetarli.
 *
 * permissionGuard rol tekshiruvidan KEYIN qo'shimcha cheklov sifatida
 * ishlaydi (rol + ruxsat). Bu esa aksincha — ruxsat rolga qo'shimcha
 * IMKONIYAT beradi: ro'yxatdagi rollar avvalgidek o'tadi, ro'yxatda yo'q rol
 * esa (masalan assistant) shu ruxsat qo'lda berilgan bo'lsa o'tadi.
 *
 * Nega kerak bo'ldi: "Uyga vazifa bankasini boshqarish" assistentga berilgan,
 * lekin bankni KO'RISH va darsliklar daraxti roleGuard bilan faqat
 * admin/teacher/... ga ochiq edi — ruxsat bor-u, sahifa ishlamasdi.
 */
export const roleOrPermission = (roles: string[], permission: PermissionKey) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) return next(ApiError.unauthorized());
      if (roles.includes(user.role)) return next();
      if (await hasPermission(user, permission)) return next();
      next(ApiError.forbidden("Bu amalni bajarish uchun ruxsatingiz yo'q"));
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
