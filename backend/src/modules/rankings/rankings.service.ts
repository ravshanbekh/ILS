import prisma from '../../config/database';
import { PaginationParams, createPaginatedResult } from '../../shared/utils/pagination';

export type StudentCategory = 'past' | 'ortacha' | 'yuqori' | 'malumot_yoq';

// Natija foizi (checked topshiriqlar bali / guruhga biriktirilgan normativlarning umumiy max bali)
const CATEGORY_THRESHOLDS = { yuqori: 80, ortacha: 50 };

class RankingsService {
  /**
   * Umumiy reyting (o'quv markaz, o'qituvchi yoki guruh bo'yicha)
   */
  async getOverallRanking(params: PaginationParams, filters?: { teacherId?: string; groupId?: string; search?: string }) {
    const whereClause: any = { role: 'student', isActive: true };

    if (filters?.groupId) {
      whereClause.groupStudents = { some: { groupId: filters.groupId } };
    } else if (filters?.teacherId) {
      whereClause.groupStudents = { some: { group: { teacherId: filters.teacherId } } };
    }

    if (filters?.search) {
      whereClause.fullName = { contains: filters.search, mode: 'insensitive' };
    }

    // Barcha active studentlarni olish
    const students = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        fullName: true,
        login: true,
        avatarUrl: true,
        groupStudents: {
          include: {
            group: { select: { id: true, name: true } },
          },
        },
      },
    });

    let targetNormativeIds: string[] | null = null;
    if (filters?.groupId) {
      const gNorms = await prisma.groupNormative.findMany({ where: { groupId: filters.groupId }, select: { normativeId: true } });
      targetNormativeIds = gNorms.map(g => g.normativeId);
    } else if (filters?.teacherId) {
      const gNorms = await prisma.groupNormative.findMany({ where: { group: { teacherId: filters.teacherId } }, select: { normativeId: true } });
      targetNormativeIds = gNorms.map(g => g.normativeId);
    }

    // Har bir o'quvchining umumiy balini hisoblash
    const studentScores = await Promise.all(
      students.map(async (student) => {
        // Agar teacherId yoki groupId bo'lsa, faqat shu guruhlarga oid topshiriqlarni sanaymiz
        const subWhereClause: any = { studentId: student.id, status: 'checked' };
        if (targetNormativeIds !== null) {
          subWhereClause.normativeId = { in: targetNormativeIds };
        }

        const submissions = await prisma.submission.findMany({
          where: subWhereClause,
          select: { score: true, result: true },
        });

        const totalScore = submissions.reduce((sum, s) => sum + s.score, 0);
        const completed = submissions.length;
        const greenCount = submissions.filter((s) => s.result === 'green').length;
        const blueCount = submissions.filter((s) => s.result === 'blue').length;
        const redCount = submissions.filter((s) => s.result === 'red').length;

        return {
          student: {
            id: student.id,
            fullName: student.fullName,
            login: student.login,
            avatarUrl: student.avatarUrl,
          },
          groups: student.groupStudents.map((gs) => gs.group),
          totalScore,
          completed,
          results: { green: greenCount, blue: blueCount, red: redCount },
        };
      })
    );

    // Ball bo'yicha tartiblash
    studentScores.sort((a, b) => b.totalScore - a.totalScore);

    // Rank qo'shish (Dense Ranking)
    let currentRank = 1;
    let previousScore: number | null = null;
    const ranked = studentScores.map((s) => {
      if (previousScore !== null && s.totalScore < previousScore) {
        currentRank++;
      }
      previousScore = s.totalScore;
      return {
        rank: currentRank,
        ...s,
      };
    });

    // Pagination
    const total = ranked.length;
    const paginated = ranked.slice(params.skip, params.skip + params.limit);

    return createPaginatedResult(paginated, total, params);
  }

  /**
   * O'quvchilarni natijasiga qarab 3 kategoriyaga bo'lish (past / o'rtacha / yuqori)
   * — o'qituvchi faqat o'z o'quvchilarini, admin hammasini ko'radi (scoping controllerda).
   */
  async getStudentCategories(filters?: { teacherId?: string; groupId?: string }) {
    const whereClause: any = { role: 'student', isActive: true };
    if (filters?.groupId) {
      whereClause.groupStudents = { some: { groupId: filters.groupId } };
    } else if (filters?.teacherId) {
      whereClause.groupStudents = { some: { group: { teacherId: filters.teacherId } } };
    }

    const students = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        fullName: true,
        groupStudents: {
          orderBy: { joinedAt: 'desc' },
          take: 1,
          select: { group: { select: { id: true, name: true, teacher: { select: { fullName: true } } } } },
        },
        telegramLinks: {
          where: { role: 'parent', isActive: true },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { fullName: 'asc' },
    });

    // Guruh normativlarini har bir guruh uchun bir marta hisoblash (N+1 oldini olish)
    const groupMaxCache = new Map<string, { normativeIds: string[]; maxPossible: number }>();
    const getGroupNormatives = async (groupId: string) => {
      if (!groupMaxCache.has(groupId)) {
        const groupNormatives = await prisma.groupNormative.findMany({
          where: { groupId },
          select: { normativeId: true, normative: { select: { maxScore: true } } },
        });
        groupMaxCache.set(groupId, {
          normativeIds: groupNormatives.map((gn) => gn.normativeId),
          maxPossible: groupNormatives.reduce((sum, gn) => sum + gn.normative.maxScore, 0),
        });
      }
      return groupMaxCache.get(groupId)!;
    };

    const results = await Promise.all(
      students.map(async (student) => {
        const group = student.groupStudents[0]?.group;
        let percent: number | null = null;

        if (group) {
          const { normativeIds, maxPossible } = await getGroupNormatives(group.id);
          if (maxPossible > 0) {
            const submissions = await prisma.submission.findMany({
              where: { studentId: student.id, normativeId: { in: normativeIds }, status: 'checked' },
              select: { score: true },
            });
            const totalScore = submissions.reduce((sum, s) => sum + s.score, 0);
            percent = Math.round((totalScore / maxPossible) * 100);
          }
        }

        const category: StudentCategory =
          percent === null
            ? 'malumot_yoq'
            : percent >= CATEGORY_THRESHOLDS.yuqori
            ? 'yuqori'
            : percent >= CATEGORY_THRESHOLDS.ortacha
            ? 'ortacha'
            : 'past';

        return {
          id: student.id,
          fullName: student.fullName,
          groupId: group?.id || null,
          groupName: group?.name || null,
          teacherName: group?.teacher?.fullName || null,
          percent,
          category,
          parentLinked: student.telegramLinks.length > 0,
        };
      })
    );

    const counts: Record<StudentCategory, number> = { past: 0, ortacha: 0, yuqori: 0, malumot_yoq: 0 };
    results.forEach((r) => counts[r.category]++);

    return { students: results, counts, total: results.length };
  }

  /**
   * Guruh reytingi
   */
  async getGroupRanking(groupId: string) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, name: true },
    });

    if (!group) {
      throw new Error('Guruh topilmadi');
    }

    // Guruhdagi o'quvchilar
    const groupStudents = await prisma.groupStudent.findMany({
      where: { groupId },
      include: {
        student: {
          select: { id: true, fullName: true, login: true, avatarUrl: true },
        },
      },
    });

    // Guruh normativlari
    const groupNormatives = await prisma.groupNormative.findMany({
      where: { groupId },
      select: { normativeId: true },
    });
    const normativeIds = groupNormatives.map(gn => gn.normativeId);
    const normativesCount = normativeIds.length;

    // Har bir o'quvchining balini hisoblash
    const studentScores = await Promise.all(
      groupStudents.map(async (gs) => {
        const submissions = await prisma.submission.findMany({
          where: { studentId: gs.studentId, normativeId: { in: normativeIds }, status: 'checked' },
          select: { score: true, result: true },
        });

        const totalSubmissions = await prisma.submission.count({
          where: { studentId: gs.studentId, normativeId: { in: normativeIds } },
        });

        const totalScore = submissions.reduce((sum, s) => sum + s.score, 0);
        const completed = submissions.length;
        const pending = totalSubmissions - completed;
        const greenCount = submissions.filter((s) => s.result === 'green').length;
        const blueCount = submissions.filter((s) => s.result === 'blue').length;
        const redCount = submissions.filter((s) => s.result === 'red').length;

        return {
          student: gs.student,
          totalScore,
          completed,
          pending,
          results: { green: greenCount, blue: blueCount, red: redCount },
        };
      })
    );

    // Ball bo'yicha tartiblash
    studentScores.sort((a, b) => b.totalScore - a.totalScore);

    // Rank qo'shish (Dense Ranking)
    let currentGroupRank = 1;
    let previousGroupScore: number | null = null;
    const ranked = studentScores.map((s) => {
      if (previousGroupScore !== null && s.totalScore < previousGroupScore) {
        currentGroupRank++;
      }
      previousGroupScore = s.totalScore;
      return {
        rank: currentGroupRank,
        ...s,
      };
    });

    return {
      group,
      normativesCount,
      studentsCount: ranked.length,
      students: ranked,
    };
  }
}

export default new RankingsService();
