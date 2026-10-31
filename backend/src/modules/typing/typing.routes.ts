/**
 * /api/typing — "Tez yozish" o'yini.
 *   O'quvchi: mashq sessiyasi (start/finish), shaxsiy statistika
 *   Hamma (tizimga kirgan): katalog, reyting
 *   Mentor (o'qituvchi/admin): sinf musobaqalari tarixi, natija, Excel
 *   Admin: umumiy ko'rinish, barcha natijalar, o'yinlar, jonli xonalar,
 *          o'quvchi statistikasi
 * Bellashuvlar real vaqtda — Socket.IO `/typing` (typing.rooms.ts).
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';
import { ApiError } from '../../shared/middleware/errorHandler';
import * as svc from './typing.service';
import { liveRoomsSnapshot, MENTOR_ROLES } from './typing.rooms';
import { buildClassWorkbook } from './typing.excel';

const router = Router();
router.use(authenticate);

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

const parse = <T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> => {
  const r = schema.safeParse(data);
  if (!r.success) throw ApiError.badRequest(r.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '));
  return r.data;
};

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const toDate = (s?: string, endOfDay = false) =>
  s ? new Date(new Date(`${s}T00:00:00+05:00`).getTime() + (endOfDay ? 86400_000 : 0)) : undefined;

router.get('/catalog', (_req, res) => res.json({ success: true, data: svc.catalog() }));

router.get(
  '/leaderboard',
  wrap(async (req, res) => {
    const q = parse(
      z.object({
        category: z.enum(['text', 'code', 'battle']).default('text'),
        period: z.enum(['week', 'month', 'all']).default('all'),
        groupId: z.string().uuid().optional(),
        limit: z.coerce.number().int().min(1).max(200).default(50),
      }),
      req.query
    );
    res.json({ success: true, data: await svc.leaderboard({ ...q, meId: req.user!.userId }) });
  })
);

// ── O'quvchi ─────────────────────────────────────────────────────────────────
const student = roleGuard('student');

router.post(
  '/solo/start',
  student,
  wrap(async (req, res) => {
    const b = parse(
      z.object({
        contentType: z.enum(['text', 'code']),
        variant: z.string().max(30).optional(),
        durationSec: z.number().int().optional(),
        punctuation: z.boolean().optional(),
        numbers: z.boolean().optional(),
      }),
      req.body
    );
    res.json({ success: true, data: svc.startSolo(req.user!.userId, b) });
  })
);

router.post(
  '/solo/finish',
  student,
  wrap(async (req, res) => {
    const b = parse(
      z.object({
        sessionId: z.string().uuid(),
        elapsedMs: z.number().positive().max(60 * 60 * 1000),
        counts: z.object({
          correctChars: z.number().int().min(0),
          totalKeys: z.number().int().min(0),
          errors: z.number().int().min(0),
          maxCombo: z.number().int().min(0),
        }),
      }),
      req.body
    );
    res.json({ success: true, data: await svc.finishSolo(req.user!.userId, b.sessionId, b.counts, b.elapsedMs) });
  })
);

router.get(
  '/me/stats',
  student,
  wrap(async (req, res) => {
    res.json({ success: true, data: await svc.myStats(req.user!.userId) });
  })
);

// ── Mentor: sinf musobaqalari (o'qituvchi — o'ziniki, admin — hammasi) ──────────
const mentor = roleGuard(...MENTOR_ROLES);
const viewerOf = (req: Request) => ({ userId: req.user!.userId, role: req.user!.role });

router.get(
  '/class/matches',
  mentor,
  wrap(async (req, res) => {
    const q = parse(
      z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      }),
      req.query
    );
    res.json({ success: true, data: await svc.classMatches(viewerOf(req), q) });
  })
);

router.get(
  '/class/matches/:id',
  mentor,
  wrap(async (req, res) => {
    const id = parse(z.string().uuid(), req.params.id);
    res.json({ success: true, data: await svc.classMatchDetail(viewerOf(req), id) });
  })
);

router.get(
  '/class/matches/:id/excel',
  mentor,
  wrap(async (req, res) => {
    const id = parse(z.string().uuid(), req.params.id);
    const file = await buildClassWorkbook(viewerOf(req), id);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="musobaqa.xlsx"; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
    res.send(file.buffer);
  })
);

// ── Admin ────────────────────────────────────────────────────────────────────
const admin = roleGuard('admin');

router.get('/admin/overview', admin, wrap(async (_req, res) => res.json({ success: true, data: await svc.adminOverview() })));

router.get('/admin/live', admin, (_req, res) => res.json({ success: true, data: liveRoomsSnapshot() }));

router.get(
  '/admin/results',
  admin,
  wrap(async (req, res) => {
    const q = parse(
      z.object({
        userId: z.string().uuid().optional(),
        groupId: z.string().uuid().optional(),
        mode: z.enum(['solo', 'duel', 'ffa', 'team', 'class']).optional(),
        contentType: z.enum(['text', 'code']).optional(),
        flagged: z.enum(['true', 'false']).optional(),
        search: z.string().trim().max(100).optional(),
        from: day.optional(),
        to: day.optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(200).default(50),
      }),
      req.query
    );
    res.json({
      success: true,
      data: await svc.adminResults({
        ...q,
        flagged: q.flagged === undefined ? undefined : q.flagged === 'true',
        from: toDate(q.from),
        to: toDate(q.to, true),
      }),
    });
  })
);

router.get(
  '/admin/matches',
  admin,
  wrap(async (req, res) => {
    const q = parse(
      z.object({
        mode: z.enum(['duel', 'ffa', 'team', 'class']).optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(30),
      }),
      req.query
    );
    res.json({ success: true, data: await svc.adminMatches(q) });
  })
);

router.get(
  '/admin/matches/:id',
  admin,
  wrap(async (req, res) => {
    const id = parse(z.string().uuid(), req.params.id);
    res.json({ success: true, data: await svc.matchDetail(id) });
  })
);

router.get(
  '/admin/students/:id/stats',
  admin,
  wrap(async (req, res) => {
    const id = parse(z.string().uuid(), req.params.id);
    res.json({ success: true, data: await svc.myStats(id) });
  })
);

export default router;
