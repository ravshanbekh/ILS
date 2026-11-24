/**
 * Guruh boshlanish sanasi — o'qituvchi eslatmasi va o'zi kiritishi.
 *
 *   GET   /api/groups/start-date/missing   o'qituvchi: o'z faol guruhlaridan sanasi yo'qlari;
 *                                          admin/edit_group: hamma faol guruhlardan
 *   PATCH /api/groups/:id/start-date {startDate}
 *        - guruhning O'Z o'qituvchisi — faqat sana hali kiritilmagan bo'lsa (bir marta);
 *        - admin yoki edit_group ruxsati — istalgan payt.
 *
 * Sana normativ deadline rejasi (qaysi haftadan boshlanishi) va demo day/imtihon
 * jadvali uchun kerak. Boshqa guruhning o'qituvchisi — 404 (IDOR).
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../../config/database';
import { roleGuard } from '../../shared/middleware/auth.middleware';
import { hasPermission } from '../../shared/middleware/permission.middleware';
import { ApiError } from '../../shared/middleware/errorHandler';
import { syncGroupSchedule } from '../milestones/milestones.service';

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

export async function missingStartDates(actor: { userId: string; role: string }) {
  const all = actor.role === 'admin' || (await hasPermission(actor, 'edit_group'));
  if (!all && actor.role !== 'teacher') return [];
  return prisma.group.findMany({
    where: { isActive: true, startDate: null, ...(all && actor.role !== 'teacher' ? {} : { teacherId: actor.userId }) },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, createdAt: true, teacher: { select: { id: true, fullName: true } } },
  });
}

export async function setStartDate(actor: { userId: string; role: string }, groupId: string, startDate: string) {
  const d = new Date(`${startDate}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== startDate) throw ApiError.badRequest("Sana noto'g'ri");
  const today = new Date();
  if (d.getTime() > today.getTime() + 366 * 86_400_000) throw ApiError.badRequest('Sana bir yildan uzoq bo\'lmasin');
  if (d.getUTCFullYear() < 2020) throw ApiError.badRequest("Sana noto'g'ri");

  const group = await prisma.group.findFirst({ where: { id: groupId, isActive: true }, select: { id: true, teacherId: true, startDate: true } });
  const privileged = actor.role === 'admin' || (await hasPermission(actor, 'edit_group'));
  if (!group || (!privileged && group.teacherId !== actor.userId)) throw ApiError.notFound('Guruh topilmadi');
  if (!privileged && group.startDate) {
    throw ApiError.forbidden("Boshlanish sanasi allaqachon kiritilgan — o'zgartirish uchun administratorga murojaat qiling");
  }

  await prisma.group.update({ where: { id: groupId }, data: { startDate: d } });
  await syncGroupSchedule(groupId); // demo day/imtihon jadvali (kurs muddati va kunlar bo'lsa)
  await prisma.auditLog.create({
    data: { userId: actor.userId, action: 'SET_GROUP_START_DATE', targetType: 'group', targetId: groupId, details: { startDate, before: group.startDate } },
  });
  return { id: groupId, startDate };
}

export function mountStartDateRoutes(router: Router) {
  const actor = (req: Request) => ({ userId: req.user!.userId, role: req.user!.role });
  router.get(
    '/start-date/missing',
    roleGuard('admin', 'teacher', 'administrator', 'filial_rahbari', 'nazoratchi'),
    wrap(async (req, res) => res.json({ success: true, data: await missingStartDates(actor(req)) }))
  );
  router.patch(
    '/:id/start-date',
    roleGuard('admin', 'teacher', 'administrator', 'filial_rahbari', 'nazoratchi'),
    wrap(async (req, res) => {
      const p = z
        .object({ id: z.string().uuid("Noto'g'ri guruh ID"), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana YYYY-MM-DD ko'rinishida bo'lsin") })
        .safeParse({ id: req.params.id, startDate: req.body?.startDate });
      if (!p.success) throw ApiError.badRequest(p.error.errors.map((e) => e.message).join('; '));
      res.json({ success: true, data: await setStartDate(actor(req), p.data.id, p.data.startDate) });
    })
  );
}
