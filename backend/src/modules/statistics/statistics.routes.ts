import { Router } from 'express';
import statisticsController from './statistics.controller';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// GET /api/stats/overview — Umumiy statistika (admin)
router.get('/overview', roleGuard('admin'), statisticsController.getOverview);

// GET /api/stats/teachers-ranking — Oylik hisobot uchun (admin)
router.get('/teachers-ranking', roleGuard('admin'), statisticsController.getTeachersRanking);

// GET /api/stats/teacher — O'qituvchi statistikasi
router.get('/teacher', roleGuard('admin', 'teacher'), statisticsController.getTeacherStats);

// GET /api/stats/group/:id — Guruh statistikasi
router.get('/group/:id', roleGuard('admin', 'teacher'), statisticsController.getGroupStats);

// GET /api/stats/student/:id — O'quvchi statistikasi
router.get('/student/:id', statisticsController.getStudentStats);

// POST /api/stats/student/:id/ai-analyze — O'quvchi normativ AI tahlil
router.post('/student/:id/ai-analyze', roleGuard('admin', 'teacher', 'student'), statisticsController.analyzeStudentWithAI);

export default router;
