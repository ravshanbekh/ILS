/**
 * /api/normative-deadlines — haftalik normativ muddatlari.
 *
 *   GET    /me                       o'quvchi: shu va keyingi hafta, qo'shimcha muddat va qizillar
 *   GET    /overview?week=           xodim: hafta bo'yicha jami + guruhlar (ko'lam service.scopeOf da)
 *   GET    /groups/:groupId          xodim: guruh matritsasi (o'qituvchi — faqat o'z guruhi)
 *   POST   /preview  {startDate, perWeek}           boshqaruv: start'dan oldin ko'rib chiqish
 *   POST   /start    {startDate, perWeek, graceDays} boshqaruv: hammaga start / pauzadan davom
 *   POST   /pause                                    boshqaruv: to'xtatish (reja saqlanadi)
 *   DELETE /plan                                     boshqaruv: rejani tozalash (faqat to'xtatilganda)
 *   PATCH  /config   {perWeek?, graceDays?}          boshqaruv
 *   PATCH  /groups/:groupId/items {ids, weekStart?, excluded?}   boshqaruv
 *   POST   /groups/:groupId/rebuild {fromWeek}       boshqaruv
 *
 * Boshqaruv = normative_deadlines_manage (admin doim). Tekshiruv service'da.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';
import { staffOnly } from '../../shared/middleware/permission.middleware';
import { ApiError } from '../../shared/middleware/errorHandler';
import * as svc from './normative-deadlines.service';

const router = Router();
router.use(authenticate);

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);
const actorOf = (req: Request) => ({ userId: req.user!.userId, role: req.user!.role });

function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const p = schema.safeParse(data);
  if (!p.success) throw ApiError.badRequest(p.error.errors.map((e) => e.message).join('; '));
  return p.data;
}

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana YYYY-MM-DD ko'rinishida bo'lsin");
const perWeek = z.number().int().min(1, 'Haftasiga kamida 1 ta').max(10, 'Haftasiga 10 tadan oshmasin');
const graceDays = z.number().int().min(0, "Qo'shimcha kun manfiy bo'lmaydi").max(7, "Qo'shimcha muddat 7 kundan oshmasin");
const groupIdOf = (req: Request) => parse(z.string().uuid("Noto'g'ri guruh ID"), req.params.groupId);

// O'quvchi — faqat o'zi (studentId tokendan, parametrdan emas)
router.get(
  '/me',
  roleGuard('student'),
  wrap(async (req, res) => res.json({ success: true, data: await svc.studentMe(req.user!.userId) }))
);

router.use(staffOnly);

router.get(
  '/overview',
  wrap(async (req, res) => {
    const q = parse(z.object({ week: dateStr.optional() }), req.query);
    res.json({ success: true, data: await svc.overview(actorOf(req), q.week) });
  })
);

router.get(
  '/groups/:groupId',
  wrap(async (req, res) => res.json({ success: true, data: await svc.groupDetail(actorOf(req), groupIdOf(req)) }))
);

router.post(
  '/preview',
  wrap(async (req, res) => {
    const b = parse(z.object({ startDate: dateStr, perWeek: perWeek.default(2) }), req.body);
    res.json({ success: true, data: await svc.preview(actorOf(req), b.startDate, b.perWeek) });
  })
);

router.post(
  '/start',
  wrap(async (req, res) => {
    const b = parse(z.object({ startDate: dateStr, perWeek: perWeek.optional(), graceDays: graceDays.optional() }), req.body);
    res.json({ success: true, data: await svc.start(actorOf(req), b) });
  })
);

router.post('/pause', wrap(async (req, res) => res.json({ success: true, data: await svc.pause(actorOf(req)) })));

router.delete('/plan', wrap(async (req, res) => res.json({ success: true, data: await svc.resetPlan(actorOf(req)) })));

router.patch(
  '/config',
  wrap(async (req, res) => {
    const b = parse(z.object({ perWeek: perWeek.optional(), graceDays: graceDays.optional() }), req.body);
    res.json({ success: true, data: await svc.updateConfig(actorOf(req), b) });
  })
);

router.patch(
  '/groups/:groupId/items',
  wrap(async (req, res) => {
    const b = parse(
      z
        .object({
          ids: z.array(z.string().uuid("Noto'g'ri band ID")).min(1, 'Kamida bitta bandni tanlang').max(200),
          weekStart: dateStr.optional(),
          excluded: z.boolean().optional(),
        })
        .refine((x) => x.weekStart !== undefined || x.excluded !== undefined, 'Nimani o\'zgartirish kerakligi ko\'rsatilmagan'),
      req.body
    );
    res.json({ success: true, data: await svc.updateItems(actorOf(req), groupIdOf(req), b) });
  })
);

router.post(
  '/groups/:groupId/rebuild',
  wrap(async (req, res) => {
    const b = parse(z.object({ fromWeek: dateStr }), req.body);
    res.json({ success: true, data: await svc.rebuildGroup(actorOf(req), groupIdOf(req), b.fromWeek) });
  })
);

export default router;
