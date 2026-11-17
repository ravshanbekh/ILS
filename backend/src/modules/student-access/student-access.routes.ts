/**
 * /api/student-access — o'quvchi kirishini yopish/ochish (to'lov va h.k.).
 *   GET  /blocked                 — kirishi yopilganlar (o'qituvchi — o'z guruhlari)
 *   GET  /group/:groupId          — guruhdagi holatlar { studentId: status }
 *   POST /:studentId/block        — { reason: 'payment'|'other', note? }
 *   POST /:studentId/unblock
 *
 * Faqat xodimlar + student_access_block ruxsati (o'qituvchilarda standart).
 * Holat ATAYLAB guruh javobiga (GET /groups/:id) qo'shilmagan: u yo'lni
 * o'quvchilar ham chaqiradi — sinfdoshlar kim bloklanganini bilmasin.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { permissionGuard, staffOnly } from '../../shared/middleware/permission.middleware';
import { ApiError } from '../../shared/middleware/errorHandler';
import studentAccessService, { BLOCK_REASONS } from './student-access.service';

const router = Router();
router.use(authenticate, staffOnly, permissionGuard('student_access_block'));

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);
const uuid = z.string().uuid();
const actorOf = (req: Request) => ({ userId: req.user!.userId, role: req.user!.role });
const parseId = (v: unknown, what: string) => {
  const r = uuid.safeParse(v);
  if (!r.success) throw ApiError.badRequest(`${what} ID noto'g'ri`);
  return r.data;
};

router.get(
  '/blocked',
  wrap(async (req, res) => {
    res.json({ success: true, data: await studentAccessService.listBlocked(actorOf(req)) });
  })
);

router.get(
  '/group/:groupId',
  wrap(async (req, res) => {
    const groupId = parseId(req.params.groupId, 'Guruh');
    res.json({ success: true, data: await studentAccessService.groupStatus(actorOf(req), groupId) });
  })
);

const blockSchema = z.object({
  reason: z.enum(BLOCK_REASONS).default('payment'),
  note: z.string().max(200).nullable().optional(),
});

router.post(
  '/:studentId/block',
  wrap(async (req, res) => {
    const studentId = parseId(req.params.studentId, "O'quvchi");
    const b = blockSchema.safeParse(req.body ?? {});
    if (!b.success) throw ApiError.badRequest(b.error.errors.map((e) => e.message).join('; '));
    res.json({ success: true, data: await studentAccessService.block(actorOf(req), studentId, b.data.reason, b.data.note) });
  })
);

router.post(
  '/:studentId/unblock',
  wrap(async (req, res) => {
    const studentId = parseId(req.params.studentId, "O'quvchi");
    res.json({ success: true, data: await studentAccessService.unblock(actorOf(req), studentId) });
  })
);

export default router;
