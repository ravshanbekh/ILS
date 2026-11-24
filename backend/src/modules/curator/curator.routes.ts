/**
 * /api/curator — kurator (demo-mentor) moduli. Batafsil: docs/curator.md
 *
 * O'quvchi:
 *   GET    /me                      — kuratorim, 2 oylik dastur holati, yozilishlarim
 *   GET    /available?from=         — kuratorimning 7 kunlik ochiq vaqtlari
 *   POST   /bookings  {slotId}      — yozilish
 *   DELETE /bookings/:id            — bekor qilish (o'quvchi / kurator / nazoratchi)
 *
 * Kurator (o'ziniki) va `curator_oversight` (hammasi):
 *   GET    /curators                — kuratorlar ro'yxati va ko'rsatkichlari
 *   GET    /program                 — 2 oylik dastur (24 mashg'ulot)
 *   POST   /program, PATCH /program/:id — tahrirlash (`curator_program` ruxsati)
 *   GET    /students                — o'quvchilar ?curatorId=&status=&search=&ungrouped=1
 *   GET    /students/suggest-login  — bo'sh login + parol taklifi
 *   POST   /students                — demo'dan keyin yangi o'quvchi (guruhsiz)
 *   POST   /students/assign         — mavjud o'quvchini biriktirish (nazoratchi)
 *   GET    /students/unassigned?q=  — kuratori yo'q o'quvchilarni qidirish (nazoratchi)
 *   GET    /students/:id            — to'liq karta (dastur + asosiy guruh + yozilishlar)
 *   PATCH  /students/:id            — holat / izoh / demo sanasi / kurator
 *   POST   /students/:id/progress   — mashg'ulotni qo'lda belgilash
 *   DELETE /progress/:id
 *   GET    /slots/day?date=&curatorId=, GET /slots/week?from=&curatorId=
 *   PUT    /slots/day               — kunning ochiq vaqtlari
 *   PATCH  /slots/:id, DELETE /slots/:id
 *   POST   /slots/:id/bookings {studentId} — o'quvchini vaqtga qo'shish
 *   PATCH  /bookings/:id/attendance {status: keldi|kelmadi}
 *
 * Xodimlar (o'quvchi profili kartasi):
 *   GET    /summary/:studentId
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';
import { staffOnly, hasPermission } from '../../shared/middleware/permission.middleware';
import { ApiError } from '../../shared/middleware/errorHandler';
import * as svc from './curator.service';

const router = Router();
router.use(authenticate);

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);
const actorOf = (req: Request): svc.Actor => ({ userId: req.user!.userId, role: req.user!.role });
const ok = (res: Response, data: unknown) => res.json({ success: true, data });

function parse<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const p = schema.safeParse(value);
  if (!p.success) throw ApiError.badRequest(p.error.errors.map((e) => `${e.path.join('.') || 'qiymat'}: ${e.message}`).join('; '));
  return p.data;
}

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');
const idParam = (req: Request, key = 'id') => parse(uuid, req.params[key]);

/** Kurator yoki nazoratchi (admin / curator_oversight) — o'quvchiga hech qachon */
const curatorGate = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    if (req.user!.role === 'student') throw ApiError.forbidden("Ruxsatingiz yo'q");
    await svc.assertCuratorOrOversee(actorOf(req));
    next();
  } catch (e) {
    next(e);
  }
};
const programGate = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    if (!(await hasPermission(req.user, 'curator_program'))) throw ApiError.forbidden('"Kurator dasturini tahrirlash" ruxsati kerak');
    next();
  } catch (e) {
    next(e);
  }
};

// ─── O'quvchi ────────────────────────────────────────────────────────────
router.get('/me', roleGuard('student'), wrap(async (req, res) => ok(res, await svc.studentMe(req.user!.userId))));
router.get(
  '/available',
  roleGuard('student'),
  wrap(async (req, res) => ok(res, await svc.studentAvailable(req.user!.userId, parse(date.optional(), req.query.from)))),
);
router.post(
  '/bookings',
  roleGuard('student'),
  wrap(async (req, res) => ok(res, await svc.studentBook(req.user!.userId, parse(z.object({ slotId: uuid }), req.body).slotId))),
);
router.delete('/bookings/:id', wrap(async (req, res) => ok(res, await svc.cancelBooking(actorOf(req), idParam(req)))));

// ─── O'quvchi profili kartasi (xodimlar) ─────────────────────────────────
router.get('/summary/:studentId', staffOnly, wrap(async (req, res) => ok(res, await svc.summaryForStudent(actorOf(req), idParam(req, 'studentId')))));

// ─── Kurator / nazorat ───────────────────────────────────────────────────
router.get('/curators', curatorGate, wrap(async (req, res) => ok(res, await svc.listCurators(actorOf(req)))));

router.get(
  '/program',
  curatorGate,
  wrap(async (req, res) => {
    const all = req.query.all === '1' && (await hasPermission(req.user, 'curator_program'));
    ok(res, { ...(await svc.listProgram(all)), canEdit: await hasPermission(req.user, 'curator_program') });
  }),
);
const lessonSchema = z.object({
  n: z.number().int().min(1).max(200).optional(),
  week: z.number().int().min(1).max(20).optional(),
  weekTitle: z.string().trim().min(1).max(120).optional(),
  kind: z.enum(['A', 'B']).optional(),
  title: z.string().trim().min(2).max(200).optional(),
  goal: z.string().trim().max(500).nullable().optional(),
  content: z
    .object({
      fact: z.string().max(1000).nullable().optional(),
      steps: z.array(z.string().max(500)).max(20).optional(),
      wow: z.string().max(500).nullable().optional(),
      artifact: z.string().max(500).nullable().optional(),
      homework: z.string().max(1000).nullable().optional(),
      tools: z.array(z.object({ name: z.string().max(100), url: z.string().url().max(500) })).max(10).optional(),
      fallback: z.string().max(1000).nullable().optional(),
    })
    .optional(),
  isActive: z.boolean().optional(),
});
router.post('/program', staffOnly, programGate, wrap(async (req, res) => ok(res, await svc.saveLesson(null, parse(lessonSchema, req.body)))));
router.patch('/program/:id', staffOnly, programGate, wrap(async (req, res) => ok(res, await svc.saveLesson(idParam(req), parse(lessonSchema, req.body)))));

const listSchema = z.object({
  curatorId: uuid.optional(),
  status: z.enum(['faol', 'tugadi', 'toxtatildi', 'all']).default('faol'),
  search: z.string().trim().max(100).optional(),
  ungrouped: z.enum(['1', '0']).optional(),
});
router.get(
  '/students',
  curatorGate,
  wrap(async (req, res) => {
    const f = parse(listSchema, req.query);
    ok(res, await svc.listStudents(actorOf(req), { ...f, search: f.search || undefined, ungrouped: f.ungrouped === '1' }));
  }),
);
router.get('/students/suggest-login', curatorGate, wrap(async (_req, res) => ok(res, await svc.suggestLogin())));
router.get(
  '/students/unassigned',
  curatorGate,
  wrap(async (req, res) => ok(res, await svc.searchUnassigned(actorOf(req), parse(z.string().max(100).default(''), req.query.q)))),
);

const createSchema = z.object({
  fullName: z.string().trim().min(2, "Ism kamida 2 ta belgi").max(100),
  login: z
    .string()
    .trim()
    .min(3, 'Login kamida 3 ta belgi')
    .max(50)
    .regex(/^[a-zA-Z0-9_.]+$/, "Login faqat harf, raqam, nuqta va _"),
  password: z.string().min(6, 'Parol kamida 6 ta belgi').max(100),
  demoDate: date,
  demoNote: z.string().trim().max(500).nullable().optional(),
  curatorId: uuid.optional(),
});
router.post('/students', curatorGate, wrap(async (req, res) => ok(res, await svc.createStudent(actorOf(req), parse(createSchema, req.body)))));
router.post(
  '/students/assign',
  curatorGate,
  wrap(async (req, res) =>
    ok(
      res,
      await svc.assignExisting(
        actorOf(req),
        parse(z.object({ studentId: uuid, curatorId: uuid, demoDate: date, demoNote: z.string().trim().max(500).nullable().optional() }), req.body),
      ),
    ),
  ),
);
router.get('/students/:id', curatorGate, wrap(async (req, res) => ok(res, await svc.getStudentDetail(actorOf(req), idParam(req)))));
router.patch(
  '/students/:id',
  curatorGate,
  wrap(async (req, res) =>
    ok(
      res,
      await svc.updateEnrollment(
        actorOf(req),
        idParam(req),
        parse(
          z.object({
            status: z.enum(['faol', 'tugadi', 'toxtatildi']).optional(),
            demoNote: z.string().trim().max(500).nullable().optional(),
            demoDate: date.optional(),
            curatorId: uuid.optional(),
          }),
          req.body,
        ),
      ),
    ),
  ),
);
router.post(
  '/students/:id/progress',
  curatorGate,
  wrap(async (req, res) =>
    ok(
      res,
      await svc.recordProgress(
        actorOf(req),
        idParam(req),
        parse(
          z.object({
            lessonId: uuid,
            attended: z.boolean(),
            homework: z.enum(['bajardi', 'qisman', 'bajarmadi']).nullable().optional(),
            note: z.string().trim().max(500).nullable().optional(),
            date,
          }),
          req.body,
        ),
      ),
    ),
  ),
);
router.delete('/progress/:id', curatorGate, wrap(async (req, res) => ok(res, await svc.deleteProgress(actorOf(req), idParam(req)))));

// ─── Jadval ──────────────────────────────────────────────────────────────
router.get(
  '/slots/day',
  curatorGate,
  wrap(async (req, res) => ok(res, await svc.getDay(actorOf(req), parse(date, req.query.date), parse(uuid.optional(), req.query.curatorId)))),
);
router.get(
  '/slots/week',
  curatorGate,
  wrap(async (req, res) => ok(res, await svc.getWeek(actorOf(req), parse(date, req.query.from), parse(uuid.optional(), req.query.curatorId)))),
);
router.put(
  '/slots/day',
  curatorGate,
  wrap(async (req, res) =>
    ok(
      res,
      await svc.setDay(
        actorOf(req),
        parse(
          z.object({
            date,
            minutes: z.array(z.number().int()).max(48),
            capacity: z.number().int().optional(),
            lessonId: uuid.nullable().optional(),
            curatorId: uuid.optional(),
          }),
          req.body,
        ),
      ),
    ),
  ),
);
router.patch(
  '/slots/:id',
  curatorGate,
  wrap(async (req, res) =>
    ok(
      res,
      await svc.updateSlot(
        actorOf(req),
        idParam(req),
        parse(
          z.object({
            isOpen: z.boolean().optional(),
            capacity: z.number().int().optional(),
            lessonId: uuid.nullable().optional(),
            note: z.string().trim().max(300).nullable().optional(),
          }),
          req.body,
        ),
      ),
    ),
  ),
);
router.delete('/slots/:id', curatorGate, wrap(async (req, res) => ok(res, await svc.deleteSlot(actorOf(req), idParam(req)))));
router.post(
  '/slots/:id/bookings',
  curatorGate,
  wrap(async (req, res) => ok(res, await svc.addToSlot(actorOf(req), idParam(req), parse(z.object({ studentId: uuid }), req.body).studentId))),
);
router.patch(
  '/bookings/:id/attendance',
  curatorGate,
  wrap(async (req, res) =>
    ok(res, await svc.markAttendance(actorOf(req), idParam(req), parse(z.object({ status: z.enum(['keldi', 'kelmadi']) }), req.body).status)),
  ),
);

export default router;
