import prisma from '../../config/database';
import { PaginationParams, createPaginatedResult } from '../../shared/utils/pagination';

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

    // Har bir o'quvchining umumiy balini hisoblash
    const studentScores = await Promise.all(
      students.map(async (student) => {
        // Agar teacherId yoki groupId bo'lsa, faqat shu guruhga oid topshiriqlarni sanaymiz
        const subWhereClause: any = { studentId: student.id, status: 'checked' };
        if (filters?.groupId) {
          subWhereClause.groupId = filters.groupId;
        } else if (filters?.teacherId) {
          subWhereClause.group = { teacherId: filters.teacherId };
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

    // Har bir o'quvchining balini hisoblash
    const studentScores = await Promise.all(
      groupStudents.map(async (gs) => {
        const submissions = await prisma.submission.findMany({
          where: { studentId: gs.studentId, groupId, status: 'checked' },
          select: { score: true, result: true },
        });

        const totalSubmissions = await prisma.submission.count({
          where: { studentId: gs.studentId, groupId },
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

    // Guruh normativlari soni
    const normativesCount = await prisma.groupNormative.count({
      where: { groupId },
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
