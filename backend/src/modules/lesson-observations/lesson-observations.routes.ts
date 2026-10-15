import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../../config/database';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';
import { ApiError } from '../../shared/middleware/errorHandler';
import {
  OBSERVATION_MAX_SCORE, OBSERVATION_SECTIONS,
  createObservationSchema, observationTotal,
} from './lesson-observations.criteria';
import { observationFilters } from './lesson-observations.filters';

const router = Router();
router.use(authenticate);

async function list(req: Request, res: Response, next: NextFunction, own = false) {
  try {
    const { where, page } = observationFilters(req.query, own ? req.user!.userId : undefined);
    const pageSize = 20;
    const [items, total, aggregate] = await Promise.all([
      prisma.lessonObservation.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
      prisma.lessonObservation.count({ where }),
      prisma.lessonObservation.aggregate({ where, _avg: { totalScore: true } }),
    ]);
    res.json({ success: true, data: { items, total, page, pageSize, averageScore: aggregate._avg.totalScore } });
  } catch (error) { next(error); }
}

// PDFning barcha mezonlari va ustozning faol guruhlari bitta so'rovda.
router.get('/form', roleGuard('admin'), async (_req, res, next) => {
  try {
    const [teachers, observedTeachers] = await Promise.all([prisma.user.findMany({
      where: { role: { in: ['teacher', 'robototexnika_ustoz'] }, isActive: true },
      select: {
        id: true, fullName: true, role: true,
        teacherGroups: { where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } },
      },
      orderBy: { fullName: 'asc' },
    }), prisma.lessonObservation.groupBy({ by: ['teacherId'] })]);
    const historicalTeachers = await Promise.all(observedTeachers
      .filter(item => !teachers.some(teacher => teacher.id === item.teacherId))
      .map(async item => {
        const latest = await prisma.lessonObservation.findFirst({
          where: { teacherId: item.teacherId }, orderBy: { createdAt: 'desc' }, select: { teacherName: true },
        });
        return { id: item.teacherId, fullName: latest?.teacherName ?? 'Noma’lum ustoz' };
      }));
    const filterTeachers = [
      ...teachers.map(item => ({ id: item.id, fullName: item.fullName })),
      ...historicalTeachers,
    ].sort((a, b) => a.fullName.localeCompare(b.fullName));
    res.json({ success: true, data: { teachers, filterTeachers, sections: OBSERVATION_SECTIONS, maxScore: OBSERVATION_MAX_SCORE } });
  } catch (error) { next(error); }
});

router.get('/ranking', roleGuard('admin'), async (req, res, next) => {
  try {
    const { where } = observationFilters(req.query);
    const grouped = await prisma.lessonObservation.groupBy({
      by: ['teacherId'], where,
      _count: { _all: true }, _sum: { totalScore: true }, _max: { createdAt: true },
    });
    const names = await prisma.user.findMany({
      where: { id: { in: grouped.map(row => row.teacherId) } },
      select: { id: true, fullName: true },
    });
    const nameMap = new Map(names.map(user => [user.id, user.fullName]));
    const missing = grouped.filter(row => !nameMap.has(row.teacherId));
    await Promise.all(missing.map(async row => {
      const snapshot = await prisma.lessonObservation.findFirst({ where: { teacherId: row.teacherId }, orderBy: { createdAt: 'desc' }, select: { teacherName: true } });
      nameMap.set(row.teacherId, snapshot?.teacherName ?? 'Noma’lum ustoz');
    }));
    const ranking = grouped.map(row => {
      const count = row._count._all;
      const averageScore = (row._sum.totalScore ?? 0) / count;
      return {
        teacherId: row.teacherId,
        teacherName: nameMap.get(row.teacherId),
        count,
        averageScore: Math.round(averageScore * 10) / 10,
        percentage: Math.round((averageScore / OBSERVATION_MAX_SCORE) * 1000) / 10,
        lastObservedAt: row._max.createdAt,
      };
    }).sort((a, b) => b.averageScore - a.averageScore || b.count - a.count || (a.teacherName ?? '').localeCompare(b.teacherName ?? ''));
    res.json({ success: true, data: ranking.map((row, index) => ({ ...row, rank: index + 1 })) });
  } catch (error) { next(error); }
});

router.get('/me', roleGuard('teacher', 'robototexnika_ustoz'), (req, res, next) => list(req, res, next, true));
router.get('/', roleGuard('admin'), (req, res, next) => list(req, res, next));

router.post('/', roleGuard('admin'), async (req, res, next) => {
  try {
    const parsed = createObservationSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0]?.message ?? 'Forma noto‘g‘ri');
    const input = parsed.data;
    const teacher = await prisma.user.findFirst({
      where: { id: input.teacherId, role: { in: ['teacher', 'robototexnika_ustoz'] }, isActive: true },
      select: { id: true, fullName: true },
    });
    if (!teacher) throw ApiError.badRequest('Faol ustoz topilmadi');

    let groupName = input.groupName;
    if (input.groupId) {
      const group = await prisma.group.findFirst({ where: { id: input.groupId, teacherId: teacher.id, isActive: true }, select: { name: true } });
      if (!group) throw ApiError.badRequest('Tanlangan guruh bu ustozga tegishli emas');
      groupName = group.name;
    }
    const observer = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { fullName: true } });
    if (!observer) throw ApiError.unauthorized();

    const scores = OBSERVATION_SECTIONS.flatMap(section => section.items.map(item => ({
      id: item.id, label: item.label, sectionId: section.id, sectionTitle: section.title,
      score: input.ratings[item.id],
    })));
    const saved = await prisma.lessonObservation.create({
      data: {
        teacherId: teacher.id, teacherName: teacher.fullName,
        observerId: req.user!.userId, observerName: observer.fullName,
        groupId: input.groupId, groupName, topic: input.topic,
        studentsEnrolled: input.studentsEnrolled, studentsPresent: input.studentsPresent,
        scores, totalScore: observationTotal(input.ratings),
        childrenAnswer: input.childrenAnswer || null,
        strengths: input.strengths, improvements: input.improvements,
        // createdAt faqat ma'lumotlar bazasi vaqtida yaratiladi.
      },
    });
    res.status(201).json({ success: true, data: saved });
  } catch (error) { next(error); }
});

export default router;
