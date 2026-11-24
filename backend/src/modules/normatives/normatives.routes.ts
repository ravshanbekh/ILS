import { Router } from 'express';
import normativesController from './normatives.controller';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';
import { z } from 'zod';
import { ApiError } from '../../shared/middleware/errorHandler';
import { applyFoundation2026, planFoundation2026 } from './normatives.foundation2026';

const router = Router();

router.use(authenticate);

// GET /api/normatives — Barcha normativlar (barcha rollar)
router.get('/', normativesController.getAll);

// GET /api/normatives/:id — Bitta normativ
// JSON eksport / import — faqat admin. '/:id' dan OLDIN turishi shart,
// aks holda "export" so'zi id deb olinadi.
router.get('/export', roleGuard('admin'), normativesController.exportJson);
router.post('/import', roleGuard('admin'), normativesController.importJson);
// Foundation 2026 ga o'tish (bir martalik): oldindan ko'rish va qo'llash — faqat admin
router.get('/foundation-2026/plan', roleGuard('admin'), async (_req, res, next) => {
  try {
    res.json({ success: true, data: await planFoundation2026() });
  } catch (e) {
    next(e);
  }
});
router.post('/foundation-2026/apply', roleGuard('admin'), async (req, res, next) => {
  try {
    const p = z.object({ groupIds: z.array(z.string().uuid("Noto'g'ri guruh ID")).max(500) }).safeParse(req.body);
    if (!p.success) throw ApiError.badRequest(p.error.errors.map((e) => e.message).join('; '));
    res.json({ success: true, data: await applyFoundation2026(req.user!.userId, p.data.groupIds) });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', normativesController.getById);

// POST /api/normatives — Yangi normativ yaratish (admin/teacher)
router.post('/', roleGuard('admin', 'teacher'), normativesController.create);

// PUT /api/normatives/:id — Yangilash (admin/teacher)
router.put('/:id', roleGuard('admin', 'teacher'), normativesController.update);

// DELETE /api/normatives/:id — O'chirish (admin)
router.delete('/:id', roleGuard('admin'), normativesController.delete);

export default router;
