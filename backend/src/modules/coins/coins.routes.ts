import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import coinsController from './coins.controller';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';
import { permissionGuard } from '../../shared/middleware/permission.middleware';
import { ApiError } from '../../shared/middleware/errorHandler';
import { awardEventCoins, eligibleStudents, eventContext, listEventAwards, EVENT_COIN_MAX_AMOUNT, EVENT_COIN_MAX_STUDENTS } from './coins.event.service';

const router = Router();
router.use(authenticate);

// Balans va tarix — o'zi/o'z guruhi/hammasi (aniq tekshiruv controllerda)
router.get('/balance/:studentId', coinsController.getBalance);
router.get('/history/:studentId', coinsController.getHistory);

// Nazorat — "coin_oversight" ruxsati bo'lganlar (admin har doim)
router.get('/teacher-stats', permissionGuard('coin_oversight'), coinsController.getTeacherStats);
router.get('/student-stats', permissionGuard('coin_oversight'), coinsController.getStudentStats);
router.get('/teacher-breakdown/:teacherId', permissionGuard('coin_oversight'), coinsController.getTeacherBreakdown);

// Kunlik chegara sozlamasi
router.get('/settings', permissionGuard('coin_oversight'), coinsController.getSettings);
router.put('/settings', permissionGuard('coin_settings'), coinsController.updateSettings);

// ── Tadbir (chempionat) coini — dars sessiyasisiz. Batafsil: docs/event-coins.md ──
// Avval rol (o'quvchi hech qachon), keyin qo'lda beriladigan ruxsat. Admin har doim o'tadi.
const STAFF_ROLES = Object.values(UserRole).filter((r) => r !== 'student');
const eventGuard = [roleGuard(...STAFF_ROLES), permissionGuard('event_coins')];

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);
const actorOf = (req: Request) => ({ userId: req.user!.userId, role: req.user!.role });

const awardSchema = z.object({
  studentIds: z
    .array(z.string().uuid("Noto'g'ri o'quvchi ID"), { invalid_type_error: "O'quvchilar ro'yxati kerak" })
    .min(1, "Kamida bitta o'quvchini tanlang")
    .max(EVENT_COIN_MAX_STUDENTS, `Bir martada ${EVENT_COIN_MAX_STUDENTS} tadan ortiq o'quvchi tanlab bo'lmaydi`),
  amount: z
    .number({ invalid_type_error: "Miqdor son bo'lishi kerak", required_error: 'Miqdorni kiriting' })
    .int("Miqdor butun son bo'lishi kerak")
    .min(1, `Miqdor 1 dan ${EVENT_COIN_MAX_AMOUNT} gacha bo'lishi kerak`)
    .max(EVENT_COIN_MAX_AMOUNT, `Miqdor 1 dan ${EVENT_COIN_MAX_AMOUNT} gacha bo'lishi kerak`),
  reason: z.string().trim().min(3, 'Sabab yoki tadbir nomini yozing (kamida 3 belgi)').max(200),
});

router.get('/event-award/context', ...eventGuard, wrap(async (req, res) => res.json({ success: true, data: await eventContext(actorOf(req)) })));
router.get(
  '/event-award/students',
  ...eventGuard,
  wrap(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 100) : '';
    res.json({ success: true, data: await eligibleStudents(actorOf(req), q) });
  }),
);
router.post(
  '/event-award',
  ...eventGuard,
  wrap(async (req, res) => {
    const p = awardSchema.safeParse(req.body);
    if (!p.success) throw ApiError.badRequest(p.error.errors.map((e) => e.message).join('; '));
    res.json({ success: true, data: await awardEventCoins(actorOf(req), p.data) });
  }),
);

// Nazorat: tadbir coinlari sababi bilan
router.get(
  '/event-awards',
  permissionGuard('coin_oversight'),
  wrap(async (req, res) => {
    const period = z.enum(['today', 'week', 'month', 'all']).catch('month').parse(req.query.period);
    res.json({ success: true, data: await listEventAwards(period) });
  }),
);

export default router;
