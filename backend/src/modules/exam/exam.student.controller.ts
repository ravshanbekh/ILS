import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/database';
import { ApiError } from '../../shared/middleware/errorHandler';

/**
 * O'quvchi tomonidagi imtihon: o'z profilidan ko'radi va kiradi.
 *
 * Ilgari imtihon faqat kod orqali ishlardi va o'quvchi tizimga kirgan bo'lsa
 * ham login/parolini QAYTA kiritardi. Endi guruhga biriktirilgan imtihon
 * profilda ko'rinadi va JWT bilan boshlanadi.
 */

/** O'quvchining guruh id lari */
async function myGroupIds(studentId: string): Promise<string[]> {
  const links = await prisma.groupStudent.findMany({
    where: { studentId },
    select: { groupId: true },
  });
  return links.map((l) => l.groupId);
}

/**
 * GET /api/exam/my-active — o'quvchi hozir kira oladigan imtihonlar.
 * Faqat o'z guruhiga biriktirilgan, faol va vaqti tugamagan imtihonlar.
 */
export const getMyActiveExams = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = req.user!.userId;
    const groupIds = await myGroupIds(studentId);
    if (groupIds.length === 0) return res.json({ success: true, data: [] });

    const now = new Date();
    const exams = await prisma.exam.findMany({
      where: {
        status: 'active',
        expiresAt: { gt: now },
        examGroups: { some: { groupId: { in: groupIds } } },
      },
      orderBy: { startsAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        accessCode: true,
        startsAt: true,
        expiresAt: true,
        testCount: true,
        durationHours: true,
        maxTestScore: true,
        maxAiScore: true,
        maxProjectScore: true,
        step2Name: true,
        step3Name: true,
      },
    });

    // Boshlab bo'lgan/topshirgan holatini qo'shamiz
    const participants = await prisma.examParticipant.findMany({
      where: { studentId, examId: { in: exams.map((e) => e.id) } },
      orderBy: { attemptNumber: 'desc' },
      select: { examId: true, status: true, totalScore: true },
    });
    const byExam = new Map<string, (typeof participants)[number]>();
    for (const p of participants) if (!byExam.has(p.examId)) byExam.set(p.examId, p);

    res.json({
      success: true,
      data: exams.map((e) => {
        const p = byExam.get(e.id);
        return {
          ...e,
          myStatus: p?.status ?? null,
          myScore: p?.totalScore ?? null,
          canEnter: !p || p.status === 'in_progress',
        };
      }),
    });
  } catch (e) {
    next(e);
  }
};

/**
 * GET /api/exam/my-results — o'quvchining barcha imtihon natijalari.
 * Faqat o'ziniki: req.user.userId bo'yicha, id parametr yo'q (IDOR bo'lmaydi).
 */
export const getMyExamResults = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = req.user!.userId;

    const rows = await prisma.examParticipant.findMany({
      where: { studentId, status: { in: ['submitted', 'timeout'] } },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        attemptNumber: true,
        status: true,
        submittedAt: true,
        testScore: true,
        correctCount: true,
        aiScore: true,
        projectScore: true,
        totalScore: true,
        aiComment: true,
        projectComment: true,
        gradedAt: true,
        exam: {
          select: {
            id: true,
            title: true,
            testCount: true,
            maxTestScore: true,
            maxAiScore: true,
            maxProjectScore: true,
            step2Name: true,
            step3Name: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: rows.map((r) => ({
        participantId: r.id,
        examId: r.exam.id,
        title: r.exam.title,
        attemptNumber: r.attemptNumber,
        status: r.status,
        submittedAt: r.submittedAt,
        gradedAt: r.gradedAt,
        testScore: r.testScore,
        correctCount: r.correctCount,
        testCount: r.exam.testCount,
        maxTestScore: r.exam.maxTestScore,
        step2Name: r.exam.step2Name,
        aiScore: r.aiScore,
        maxAiScore: r.exam.maxAiScore,
        aiComment: r.aiComment,
        step3Name: r.exam.step3Name,
        projectScore: r.projectScore,
        maxProjectScore: r.exam.maxProjectScore,
        projectComment: r.projectComment,
        totalScore: r.totalScore,
        maxTotal: r.exam.maxTestScore + r.exam.maxAiScore + r.exam.maxProjectScore,
      })),
    });
  } catch (e) {
    next(e);
  }
};

/**
 * POST /api/exam/:id/enter — o'quvchi o'z profilidan imtihonga kiradi.
 * Login/parol qayta kerak emas: kim ekani JWT dan olinadi.
 * Kod bilan kirish yo'li (join/:code/start) saqlanib qoladi.
 */
export const enterExamAsMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = req.user!.userId;
    const examId = req.params.id;

    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw ApiError.notFound('Imtihon topilmadi');
    if (exam.status !== 'active') throw ApiError.badRequest('Imtihon faol emas');
    if (new Date() > exam.expiresAt) throw ApiError.badRequest('Imtihon vaqti tugagan');

    // Egalik: imtihon o'quvchining guruhiga biriktirilganmi?
    const groupIds = await myGroupIds(studentId);
    const allowed = await prisma.examGroup.findFirst({
      where: { examId, groupId: { in: groupIds } },
      select: { groupId: true },
    });
    if (!allowed) throw ApiError.forbidden('Bu imtihon sizning guruhingizga biriktirilmagan');

    res.json({
      success: true,
      data: { accessCode: exam.accessCode, examId: exam.id, title: exam.title },
    });
  } catch (e) {
    next(e);
  }
};

/**
 * PATCH /api/exam/:id/groups — imtihonni guruhlarga biriktirish.
 * O'qituvchi FAQAT o'z guruhlarini tanlay oladi (admin — hammasini).
 */
export const setExamGroups = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const examId = req.params.id;
    const { groupIds } = req.body;
    if (!Array.isArray(groupIds)) throw ApiError.badRequest("groupIds ro'yxat bo'lishi kerak");

    const user = req.user!;
    const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { id: true, createdById: true } });
    if (!exam) throw ApiError.notFound('Imtihon topilmadi');
    if (user.role !== 'admin' && exam.createdById !== user.userId) {
      throw ApiError.forbidden('Bu imtihon sizga tegishli emas');
    }

    // IDOR himoyasi: o'qituvchi begona guruhni biriktira olmasligi kerak
    if (user.role !== 'admin' && groupIds.length > 0) {
      const mine = await prisma.group.findMany({
        where: { id: { in: groupIds }, teacherId: user.userId },
        select: { id: true },
      });
      if (mine.length !== groupIds.length) {
        throw ApiError.forbidden("Faqat o'z guruhlaringizni tanlay olasiz");
      }
    }

    await prisma.$transaction([
      prisma.examGroup.deleteMany({ where: { examId } }),
      ...(groupIds.length > 0
        ? [prisma.examGroup.createMany({ data: groupIds.map((groupId: string) => ({ examId, groupId })) })]
        : []),
    ]);

    const saved = await prisma.examGroup.findMany({
      where: { examId },
      select: { groupId: true, group: { select: { name: true } } },
    });

    res.json({
      success: true,
      data: saved.map((g) => ({ groupId: g.groupId, groupName: g.group.name })),
    });
  } catch (e) {
    next(e);
  }
};

/** GET /api/exam/:id/groups — imtihonga biriktirilgan guruhlar */
export const getExamGroups = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.examGroup.findMany({
      where: { examId: req.params.id },
      select: { groupId: true, group: { select: { name: true } } },
    });
    res.json({
      success: true,
      data: rows.map((g) => ({ groupId: g.groupId, groupName: g.group.name })),
    });
  } catch (e) {
    next(e);
  }
};
