/**
 * Normativ natijalari paneli — barcha mentorlar, guruhlar va o'quvchilar bitta
 * jadvalda (Excel'dagi "Normativ A-F1 guruh" varag'ining hamma guruh uchun
 * kengaytmasi):
 *
 *   ustunlar: mentor → guruh → o'quvchilar
 *   qatorlar: normativlar (raqam, nomi, vazifasi, vaqti, havola, bajarish %)
 *   katak:    ✅ qo'lladi (green) · ☑ biladi (blue) · ✗ bilmaydi (red)
 *             · ⏳ tekshirilmoqda · bo'sh — topshirmagan · kulrang — guruhga
 *             biriktirilmagan
 *
 * Kim ko'radi: admin va normative_matrix_all ruxsati borlar — hammasi;
 * o'qituvchi — faqat o'z guruhlari; boshqalar — 403.
 *
 * Natija o'quvchi + normativ bo'yicha olinadi (submissions unique), guruh
 * bo'yicha EMAS: submission.groupId o'quvchi boshqa guruhga o'tsa eskirib
 * qoladi (memory: ils-group-scope-trap).
 */
import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { ApiError } from '../../shared/middleware/errorHandler';
import { hasPermission } from '../../shared/middleware/permission.middleware';

export type CellCode = 'g' | 'b' | 'r' | 'p';
export type GroupStatus = 'active' | 'graduated' | 'all';

export interface MatrixFilters {
  teacherId?: string;
  groupId?: string;
  status: GroupStatus;
  categoryId?: string;
}

type Actor = { userId: string; role: string };

/** Qaysi guruhlarni ko'ra oladi: 'all' yoki o'qituvchi IDsi */
export async function scopeOf(actor: Actor): Promise<'all' | { teacherId: string }> {
  if (actor.role === 'admin' || (await hasPermission(actor, 'normative_matrix_all'))) return 'all';
  if (actor.role === 'teacher') return { teacherId: actor.userId };
  throw ApiError.forbidden("Bu panelni ko'rish uchun ruxsatingiz yo'q");
}

export async function buildMatrix(actor: Actor, f: MatrixFilters) {
  const scope = await scopeOf(actor);

  const statusWhere: Prisma.GroupWhereInput =
    f.status === 'active'
      ? { isActive: true }
      : f.status === 'graduated'
        ? { graduatedAt: { not: null } }
        : { OR: [{ isActive: true }, { graduatedAt: { not: null } }] }; // o'chirilganlar (savat) hech qachon
  const where: Prisma.GroupWhereInput = {
    AND: [
      statusWhere,
      scope === 'all' ? {} : { teacherId: scope.teacherId },
      f.teacherId ? { teacherId: f.teacherId === 'none' ? null : f.teacherId } : {},
      f.groupId ? { id: f.groupId } : {},
    ],
  };

  const groups = await prisma.group.findMany({
    where,
    orderBy: [{ name: 'asc' }],
    select: {
      id: true,
      name: true,
      isActive: true,
      graduatedAt: true,
      teacher: { select: { id: true, fullName: true } },
      groupNormatives: { select: { normativeId: true } },
      groupStudents: {
        where: { student: { isActive: true } },
        orderBy: { student: { fullName: 'asc' } },
        select: { student: { select: { id: true, fullName: true, login: true } } },
      },
    },
  });

  // Qatorlar: shu guruhlarga biriktirilgan normativlarning birlashmasi
  const normIds = [...new Set(groups.flatMap((g) => g.groupNormatives.map((n) => n.normativeId)))];
  const normatives = normIds.length
    ? await prisma.normative.findMany({
        where: { id: { in: normIds }, ...(f.categoryId ? { categoryId: f.categoryId } : {}) },
        orderBy: [{ taskNumber: 'asc' }, { title: 'asc' }],
        select: {
          id: true, taskNumber: true, title: true, description: true, timeLimit: true, url: true, maxScore: true, isActive: true,
          category: { select: { id: true, name: true } },
        },
      })
    : [];
  const shownNorm = new Set(normatives.map((n) => n.id));

  // Ustunlar: mentor → guruh → o'quvchilar (mentor nomi bo'yicha, ustozsizlar oxirida)
  const byTeacher = new Map<string, { id: string | null; fullName: string; groups: any[] }>();
  for (const g of groups) {
    const key = g.teacher?.id ?? 'none';
    if (!byTeacher.has(key)) byTeacher.set(key, { id: g.teacher?.id ?? null, fullName: g.teacher?.fullName ?? 'Ustozsiz guruhlar', groups: [] });
    byTeacher.get(key)!.groups.push({
      id: g.id,
      name: g.name,
      graduated: !!g.graduatedAt,
      normativeIds: g.groupNormatives.map((n) => n.normativeId).filter((id) => shownNorm.has(id)),
      students: g.groupStudents.map((s) => s.student),
    });
  }
  const teachers = [...byTeacher.values()].sort((a, b) =>
    a.id === null ? 1 : b.id === null ? -1 : a.fullName.localeCompare(b.fullName, 'uz')
  );

  // Kataklar: o'quvchi × normativ → [kod, ball]
  const studentIds = [...new Set(groups.flatMap((g) => g.groupStudents.map((s) => s.student.id)))];
  const cells: Record<string, Record<string, [CellCode, number]>> = {};
  if (studentIds.length && normatives.length) {
    const subs = await prisma.submission.findMany({
      where: { studentId: { in: studentIds }, normativeId: { in: normatives.map((n) => n.id) } },
      select: { studentId: true, normativeId: true, status: true, result: true, score: true },
    });
    for (const s of subs) {
      const code: CellCode = s.status === 'pending' || !s.result ? 'p' : s.result === 'green' ? 'g' : s.result === 'blue' ? 'b' : 'r';
      (cells[s.studentId] ??= {})[s.normativeId] = [code, s.score];
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    scope: scope === 'all' ? 'all' : 'own',
    normatives,
    teachers,
    cells,
  };
}

/** Filtrlar uchun: ko'rinadigan mentorlar, guruhlar, kategoriyalar */
export async function matrixOptions(actor: Actor) {
  const scope = await scopeOf(actor);
  const groups = await prisma.group.findMany({
    where: {
      OR: [{ isActive: true }, { graduatedAt: { not: null } }],
      ...(scope === 'all' ? {} : { teacherId: scope.teacherId }),
    },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, isActive: true, graduatedAt: true, teacher: { select: { id: true, fullName: true } } },
  });
  const teachers = new Map<string, string>();
  for (const g of groups) if (g.teacher) teachers.set(g.teacher.id, g.teacher.fullName);
  const categories = await prisma.category.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } });
  return {
    scope: scope === 'all' ? 'all' : 'own',
    teachers: [...teachers.entries()].map(([id, fullName]) => ({ id, fullName })).sort((a, b) => a.fullName.localeCompare(b.fullName, 'uz')),
    hasUnassigned: groups.some((g) => !g.teacher),
    groups: groups.map((g) => ({ id: g.id, name: g.name, teacherId: g.teacher?.id ?? null, graduated: !!g.graduatedAt })),
    categories,
  };
}
