import { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env';

/**
 * Demo Mode Guard Middleware
 * 
 * DEMO_MODE=true bo'lganda:
 * - Ma'lumot o'chirish (DELETE) bloklaydi
 * - Backup yuklab olishni bloklaydi
 * - Xato o'rniga JSON xabar qaytaradi
 */
export const demoGuard = (req: Request, res: Response, next: NextFunction): void => {
  if (!env.DEMO_MODE) {
    return next();
  }

  const method = req.method.toUpperCase();
  const path = req.path.toLowerCase();

  // Bloklangan yo'llar
  const blockedPaths = [
    '/backup',
  ];

  // Bloklangan metodlar (ma'lumot o'zgartiruvchi)
  // Faqat quyidagi safe metodlarga ruxsat: GET, POST (login, submission, monitoring)
  const dangerousDeletePaths = [
    '/users',    // foydalanuvchi o'chirish
    '/groups',   // guruh o'chirish
    '/normatives', // normativ o'chirish
  ];

  // Backup'ni to'liq bloklash
  if (blockedPaths.some(p => path.startsWith(p))) {
    res.status(403).json({
      success: false,
      error: {
        message: '🔒 Demo rejimda bu amal mumkin emas',
        hint: 'Backup faqat ishchi tizimda mavjud',
        demoMode: true,
      },
    });
    return;
  }

  // Asosiy ma'lumotlarni o'chirishni bloklash
  if (method === 'DELETE' && dangerousDeletePaths.some(p => path.includes(p))) {
    res.status(403).json({
      success: false,
      error: {
        message: '🔒 Demo rejimda o\'chirish mumkin emas',
        hint: 'Bu demo tizim — haqiqiy ma\'lumotlar yo\'q',
        demoMode: true,
      },
    });
    return;
  }

  next();
};
