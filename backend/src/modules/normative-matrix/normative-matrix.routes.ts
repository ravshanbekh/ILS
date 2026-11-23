/**
 * /api/normative-matrix — normativ natijalari paneli (mentor → guruh → o'quvchi).
 *   GET /options   — filtrlar uchun mentorlar, guruhlar, kategoriyalar
 *   GET /          — jadval ma'lumoti   ?teacherId=&groupId=&status=active|graduated|all&categoryId=
 *   GET /excel     — shu jadval Excel'da (xuddi shu filtrlar)
 * Kirish: xodim; ko'lam service.scopeOf da (admin/ruxsat — hammasi, o'qituvchi — o'ziniki).
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { staffOnly } from '../../shared/middleware/permission.middleware';
import { heavyLimiter } from '../../shared/middleware/rateLimiter';
import { ApiError } from '../../shared/middleware/errorHandler';
import { buildMatrix, matrixOptions } from './normative-matrix.service';
import { buildMatrixWorkbook } from './normative-matrix.excel';

const router = Router();
router.use(authenticate, staffOnly);

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);
const actorOf = (req: Request) => ({ userId: req.user!.userId, role: req.user!.role });

const filtersSchema = z.object({
  teacherId: z.union([z.string().uuid(), z.literal('none')]).optional(),
  groupId: z.string().uuid().optional(),
  status: z.enum(['active', 'graduated', 'all']).default('active'),
  categoryId: z.string().uuid().optional(),
});
const filtersOf = (req: Request) => {
  const p = filtersSchema.safeParse(req.query);
  if (!p.success) throw ApiError.badRequest(p.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '));
  return p.data;
};

router.get('/options', wrap(async (req, res) => res.json({ success: true, data: await matrixOptions(actorOf(req)) })));

router.get('/', wrap(async (req, res) => res.json({ success: true, data: await buildMatrix(actorOf(req), filtersOf(req)) })));

router.get(
  '/excel',
  heavyLimiter, // Excel og'ir — eksport/zaxira bilan bir xil chegara
  wrap(async (req, res) => {
    const buf = await buildMatrixWorkbook(actorOf(req), filtersOf(req));
    const day = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="normativ-natijalari-${day}.xlsx"`);
    res.send(buf);
  })
);

export default router;
