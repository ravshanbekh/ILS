import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/database';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { ApiError } from '../../shared/middleware/errorHandler';

const router = Router();

router.use(authenticate);

/**
 * GET /api/notifications — Foydalanuvchi xabarnomalarni olish
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw ApiError.unauthorized();

    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const unreadCount = await prisma.notification.count({
      where: { userId: req.user.userId, isRead: false },
    });

    res.json({
      success: true,
      data: { notifications, unreadCount },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/notifications/:id/read — O'qildi deb belgilash
 */
router.patch('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw ApiError.unauthorized();

    const notification = await prisma.notification.findUnique({
      where: { id: req.params.id },
    });

    if (!notification || notification.userId !== req.user.userId) {
      throw ApiError.notFound('Xabarnoma topilmadi');
    }

    await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });

    res.json({ success: true, message: 'O\'qildi' });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/notifications/read-all — Barchasini o'qildi deb belgilash
 */
router.patch('/read-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw ApiError.unauthorized();

    await prisma.notification.updateMany({
      where: { userId: req.user.userId, isRead: false },
      data: { isRead: true },
    });

    res.json({ success: true, message: 'Barcha xabarnomalar o\'qildi' });
  } catch (error) {
    next(error);
  }
});

export default router;
