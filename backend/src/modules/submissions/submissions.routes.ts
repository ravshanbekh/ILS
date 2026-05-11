import { Router } from 'express';
import submissionsController from './submissions.controller';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// GET /api/submissions — Tekshirilmagan topshiriqlar (teacher/admin)
router.get('/', roleGuard('admin', 'teacher'), submissionsController.getPending);

// GET /api/submissions/student/:id — O'quvchi topshiriqlari
router.get('/student/:id', submissionsController.getByStudent);

// GET /api/submissions/all — Barcha topshiriqlar (admin)
router.get('/all', roleGuard('admin'), submissionsController.getAll);

// GET /api/submissions/:id — Bitta submission
router.get('/:id', submissionsController.getById);

// POST /api/submissions — Topshirish (student)
router.post('/', roleGuard('student'), submissionsController.create);

// PATCH /api/submissions/:id/check — Baholash (teacher/admin)
router.patch('/:id/check', roleGuard('admin', 'teacher'), submissionsController.check);

// PATCH /api/submissions/:id/allow-resubmit — Qayta topshirishga ochib berish
router.patch('/:id/allow-resubmit', roleGuard('admin', 'teacher'), submissionsController.allowResubmit);

export default router;
