import { Router } from 'express';
import { checklistController } from './checklist.controller';
import { getChecklistStats } from './checklist.stats.controller';
import { getUserChecklistDetail } from './checklist.detail.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import prisma from '../../config/database';

const router = Router();

// Xodimlar uchun
router.get('/today', authenticate, checklistController.getToday);
router.get('/day', authenticate, checklistController.getDay);        // ?date=YYYY-MM-DD
router.get('/weekly', authenticate, checklistController.getWeekly);  // oxirgi 7 kun
router.post('/:itemId/toggle', authenticate, checklistController.toggle);

// Admin/Nazoratchi uchun statistika
router.get('/admin-stats', authenticate, getChecklistStats);

// Xodim detail ko'rinishi
router.get('/user-detail/:userId', authenticate, getUserChecklistDetail);

// Role bo'yicha checklist items (masalan, farrosh uchun read-only ko'rinish)
router.get('/items', authenticate, async (req: any, res: any) => {
  const role = req.query.role as string;
  if (!role) return res.status(400).json({ success: false, message: 'role query param required' });
  const items = await prisma.checklistItem.findMany({
    where: { role: role as any, isActive: true },
    orderBy: [{ section: 'asc' }, { order: 'asc' }],
    select: { id: true, category: true, description: true, order: true, section: true, score: true },
  });
  return res.json({ success: true, data: items });
});

export default router;
