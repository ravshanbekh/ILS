import { Router } from 'express';
import exportController from './export.controller';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// GET /api/export/group/:id — Guruh natijalarini Excel qilish (admin/teacher)
router.get('/group/:id', roleGuard('admin', 'teacher'), exportController.exportGroup);

// GET /api/export/overview — Umumiy hisobot (admin)
router.get('/overview', roleGuard('admin'), exportController.exportOverview);

// GET /api/export/monthly-report — O'qituvchilar oylik hisoboti (admin)
router.get('/monthly-report', roleGuard('admin'), exportController.exportMonthlyReport);

// GET /api/export/student/:id — O'quvchi hisoboti (admin/teacher)
router.get('/student/:id', roleGuard('admin', 'teacher'), exportController.exportStudent);

export default router;
