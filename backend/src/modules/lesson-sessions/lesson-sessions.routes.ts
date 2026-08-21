import { Router } from 'express';
import lessonSessionsController from './lesson-sessions.controller';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';

const router = Router();
router.use(authenticate);

// O'qituvchi va admin — baholash oqimi
router.post('/start', roleGuard('admin', 'teacher'), lessonSessionsController.start);
router.get('/today', roleGuard('admin', 'teacher'), lessonSessionsController.today);
router.get('/:id', roleGuard('admin', 'teacher'), lessonSessionsController.getById);
router.patch('/:id/homework', roleGuard('admin', 'teacher'), lessonSessionsController.gradeHomework);
router.patch('/:id/activity', roleGuard('admin', 'teacher'), lessonSessionsController.gradeActivity);
router.post('/:id/finalize', roleGuard('admin', 'teacher'), lessonSessionsController.finalize);

// Faqat admin (Ravshan) — nazorat va ruxsat berish
router.post('/admin/unlock', roleGuard('admin'), lessonSessionsController.adminUnlock);
router.get('/admin/ungraded', roleGuard('admin'), lessonSessionsController.adminUngraded);

export default router;
