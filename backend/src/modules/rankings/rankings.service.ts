import prisma from '../../config/database';
import { PaginationParams, createPaginatedResult } from '../../shared/utils/pagination';
import {
  getCheckedStatsByStudent,
  getTotalCountByStudent,
  emptyStats,
} from '../../shared/utils/submissionAggregate';

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

    // Barcha o'quvchilarning topshiriqlari — bitta so'rovda (ilgari har bir
    // o'quvchi uchun alohida so'rov ketardi: 300 o'quvchi = 300 so'rov)
    const statsByStudent = await getCheckedStatsByStudent(
      students.map((s) => s.id),
      targetNormativeIds
    );

    const studentScores = students.map((student) => {
      const stats = statsByStudent.get(student.id) || emptyStats();
      return {
        student: {
          id: student.id,
          fullName: student.fullName,
          login: student.login,
          avatarUrl: student.avatarUrl,
        },
        groups: student.groupStudents.map((gs) => gs.group),
        totalScore: stats.totalScore,
        completed: stats.completed,
        results: { green: stats.green, blue: stats.blue, red: stats.red },
      };
    });

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

    // Kerakli guruhlarning normativlari — bitta so'rovda (ilgari har bir guruh uchun alohida edi)
    const groupIds = [...new Set(students.map((s) => s.groupStudents[0]?.group?.id).filter(Boolean) as string[])];
    const groupNormatives = groupIds.length
      ? await prisma.groupNormative.findMany({
          where: { groupId: { in: groupIds } },
          select: { groupId: true, normativeId: true, normative: { select: { maxScore: true } } },
        })
      : [];

    const groupInfo = new Map<string, { normativeIds: Set<string>; maxPossible: number }>();
    for (const gn of groupNormatives) {
      let info = groupInfo.get(gn.groupId);
      if (!info) {
        info = { normativeIds: new Set(), maxPossible: 0 };
        groupInfo.set(gn.groupId, info);
      }
      info.normativeIds.add(gn.normativeId);
      info.maxPossible += gn.normative.maxScore;
    }

    // Barcha o'quvchilarning tekshirilgan topshiriqlari — bitta so'rovda.
    // Har bir o'quvchi baribir faqat O'Z guruhi normativlari bo'yicha sanaladi
    // (quyida normativeIds to'plami orqali filtrlanadi) — natija ilgarigidek.
    const checked = students.length
      ? await prisma.submission.findMany({
          where: { studentId: { in: students.map((s) => s.id) }, status: 'checked' },
          select: { studentId: true, normativeId: true, score: true },
        })
      : [];

    const subsByStudent = new Map<string, { normativeId: string; score: number }[]>();
    for (const s of checked) {
      let list = subsByStudent.get(s.studentId);
      if (!list) {
        list = [];
        subsByStudent.set(s.studentId, list);
      }
      list.push({ normativeId: s.normativeId, score: s.score });
    }

    const results = students.map((student) => {
      const group = student.groupStudents[0]?.group;
      let percent: number | null = null;

      if (group) {
        const info = groupInfo.get(group.id);
        if (info && info.maxPossible > 0) {
          const subs = subsByStudent.get(student.id) || [];
          let totalScore = 0;
          for (const s of subs) {
            if (info.normativeIds.has(s.normativeId)) totalScore += s.score;
          }
          percent = Math.round((totalScore / info.maxPossible) * 100);
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
    });

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

    // Guruhdagi barcha o'quvchilar statistikasi — ikkita so'rovda
    // (ilgari har bir o'quvchi uchun 2 tadan so'rov ketardi)
    const studentIds = groupStudents.map((gs) => gs.studentId);
    const [statsByStudent, totalByStudent] = await Promise.all([
      getCheckedStatsByStudent(studentIds, normativeIds),
      getTotalCountByStudent(studentIds, normativeIds),
    ]);

    const studentScores = groupStudents.map((gs) => {
      const stats = statsByStudent.get(gs.studentId) || emptyStats();
      const totalSubmissions = totalByStudent.get(gs.studentId) || 0;

      return {
        student: gs.student,
        totalScore: stats.totalScore,
        completed: stats.completed,
        pending: totalSubmissions - stats.completed,
        results: { green: stats.green, blue: stats.blue, red: stats.red },
      };
    });

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
