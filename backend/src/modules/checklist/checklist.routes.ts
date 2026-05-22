import { Router } from 'express';
import { checklistController } from './checklist.controller';
import { getChecklistStats } from './checklist.stats.controller';
import { getUserChecklistDetail } from './checklist.detail.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';

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

export default router;
