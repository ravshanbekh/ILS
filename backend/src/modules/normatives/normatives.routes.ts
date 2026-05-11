import { Router } from 'express';
import normativesController from './normatives.controller';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// GET /api/normatives — Barcha normativlar (barcha rollar)
router.get('/', normativesController.getAll);

// GET /api/normatives/:id — Bitta normativ
router.get('/:id', normativesController.getById);

// POST /api/normatives — Yangi normativ yaratish (admin/teacher)
router.post('/', roleGuard('admin', 'teacher'), normativesController.create);

// PUT /api/normatives/:id — Yangilash (admin/teacher)
router.put('/:id', roleGuard('admin', 'teacher'), normativesController.update);

// DELETE /api/normatives/:id — O'chirish (admin)
router.delete('/:id', roleGuard('admin'), normativesController.delete);

export default router;
