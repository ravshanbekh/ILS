import prisma from '../../config/database';
import { ApiError } from '../../shared/middleware/errorHandler';
import fs from 'fs';
import path from 'path';
import { generateText, getAISettings } from '../../shared/utils/ai';

class StatisticsService {
  /**
   * Umumiy statistika (admin uchun)
   */
  async getOverview() {
    const [
      totalStudents,
      totalTeachers,
      totalGroups,
      totalNormatives,
      totalSubmissions,
      pendingSubmissions,
      checkedSubmissions,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'student', isActive: true } }),
      prisma.user.count({ where: { role: 'teacher', isActive: true } }),
      prisma.group.count({ where: { isActive: true } }),
      prisma.normative.count({ where: { isActive: true } }),
      prisma.submission.count(),
      prisma.submission.count({ where: { status: 'pending' } }),
      prisma.submission.count({ where: { status: 'checked' } }),
    ]);

    // Natijalar taqsimoti
    const resultDistribution = await prisma.submission.groupBy({
      by: ['result'],
      where: { status: 'checked' },
      _count: true,
    });

    return {
      totalStudents,
      totalTeachers,
      totalGroups,
      totalNormatives,
      totalSubmissions,
      pendingSubmissions,
      checkedSubmissions,
      resultDistribution: resultDistribution.map((r) => ({
        result: r.result,
        count: r._count,
      })),
    };
  }

  /**
   * Barcha o'qituvchilar reytingi va oylik hisobot uchun (JSON)
   */
  async getTeachersRanking() {
    const teachers = await prisma.user.findMany({
      where: { role: 'teacher', isActive: true },
    });

    const teacherStats = await Promise.all(
      teachers.map(async (teacher) => {
        const groups = await prisma.group.findMany({
          where: { teacherId: teacher.id, isActive: true },
          include: { 
            groupStudents: {
              where: { student: { isActive: true } },
              select: { id: true }
            } 
          },
        });

        const groupIds = groups.map((g) => g.id);
        const studentsCount = groups.reduce((sum, g) => sum + g.groupStudents.length, 0);

        const submissions = await prisma.submission.findMany({
          where: { groupId: { in: groupIds }, status: 'checked' },
          select: { score: true, result: true },
        });

        const checkedCount = submissions.length;
        const totalScore = submissions.reduce((sum, s) => sum + s.score, 0);
        const avgScore = checkedCount > 0 ? Math.round(totalScore / checkedCount) : 0;

        const green = submissions.filter((s) => s.result === 'green').length;
        const blue = submissions.filter((s) => s.result === 'blue').length;
        const red = submissions.filter((s) => s.result === 'red').length;

        return {
          id: teacher.id,
          teacher: teacher.fullName,
          groupsCount: groups.length,
          studentsCount,
          checkedCount,
          green,
          blue,
          red,
          avgScore,
          scoreForSort: checkedCount * avgScore
        };
      })
    );

    teacherStats.sort((a, b) => b.scoreForSort - a.scoreForSort);
    let currentRank = 1;
    let previousScore: number | null = null;
    return teacherStats.map((stat) => {
      if (previousScore !== null && stat.scoreForSort < previousScore) {
        currentRank++;
      }
      previousScore = stat.scoreForSort;
      return {
        rank: currentRank,
        ...stat
      };
    });
  }

  /**
   * O'qituvchi statistikasi
   */
  async getTeacherStats(teacherId: string) {
    // O'qituvchining guruhlari
    const groups = await prisma.group.findMany({
      where: { teacherId, isActive: true },
      include: {
        groupStudents: {
          where: { student: { isActive: true } },
          select: { id: true }
        },
        _count: {
          select: { groupNormatives: true, submissions: true },
        },
      },
    });

    // Tekshirilmagan topshiriqlar soni
    const pendingCount = await prisma.submission.count({
      where: {
        status: 'pending',
        group: { teacherId },
      },
    });

    // Guruhlar bo'yicha statistika
    const groupStats = await Promise.all(
      groups.map(async (group) => {
        const submissions = await prisma.submission.findMany({
          where: { groupId: group.id, status: 'checked' },
          select: { score: true, result: true },
        });

        const totalScore = submissions.reduce((sum, s) => sum + s.score, 0);
        const studentsCount = group.groupStudents.length;
        const avgScore = studentsCount > 0
          ? Math.round(totalScore / studentsCount)
          : 0;

        const greenCount = submissions.filter((s) => s.result === 'green').length;
        const blueCount = submissions.filter((s) => s.result === 'blue').length;
        const redCount = submissions.filter((s) => s.result === 'red').length;

        return {
          id: group.id,
          name: group.name,
          studentsCount,
          normativesCount: group._count.groupNormatives,
          submissionsCount: group._count.submissions,
          avgScore,
          results: { green: greenCount, blue: blueCount, red: redCount },
        };
      })
    );

    return {
      groupsCount: groups.length,
      totalStudents: groups.reduce((sum, g) => sum + g.groupStudents.length, 0),
      pendingCount,
      groupStats,
    };
  }

  /**
   * Guruh statistikasi
   */
  async getGroupStats(groupId: string) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        groupStudents: {
          where: { student: { isActive: true } },
          include: {
            student: { select: { id: true, fullName: true, login: true, avatarUrl: true } },
          },
        },
        groupNormatives: {
          include: {
            normative: { select: { id: true, taskNumber: true, title: true, maxScore: true } },
          },
          orderBy: { normative: { taskNumber: 'asc' } },
        },
      },
    });

    if (!group) throw ApiError.notFound('Guruh topilmadi');

    // Har bir o'quvchining natijalari
    const studentStats = await Promise.all(
      group.groupStudents.map(async (gs) => {
        const submissions = await prisma.submission.findMany({
          where: { studentId: gs.studentId, groupId },
          include: {
            normative: { select: { taskNumber: true, maxScore: true } },
          },
        });

        const totalScore = submissions
          .filter((s) => s.status === 'checked')
          .reduce((sum, s) => sum + s.score, 0);

        const completed = submissions.filter((s) => s.status === 'checked').length;
        const pending = submissions.filter((s) => s.status === 'pending').length;

        return {
          student: gs.student,
          totalScore,
          completed,
          pending,
          totalNormatives: group.groupNormatives.length,
          submissions: submissions.map((s) => ({
            normativeTaskNumber: s.normative.taskNumber,
            status: s.status,
            result: s.result,
            score: s.score,
          })),
        };
      })
    );

    // O'ringa bo'yicha tartiblash
    studentStats.sort((a, b) => b.totalScore - a.totalScore);
    let currentGroupRank = 1;
    let previousGroupScore: number | null = null;
    studentStats.forEach((s) => {
      if (previousGroupScore !== null && s.totalScore < previousGroupScore) {
        currentGroupRank++;
      }
      previousGroupScore = s.totalScore;
      (s as any).rank = currentGroupRank;
    });

    // Umumiy ko'rsatkichlar
    const maxPossibleScore = group.groupNormatives.reduce(
      (sum, gn) => sum + gn.normative.maxScore,
      0
    );

    const avgScore = studentStats.length > 0
      ? Math.round(
          studentStats.reduce((sum, s) => sum + s.totalScore, 0) / studentStats.length
        )
      : 0;

    return {
      groupName: group.name,
      normatives: group.groupNormatives.map((gn) => gn.normative),
      maxPossibleScore,
      avgScore,
      topStudent: studentStats[0] || null,
      students: studentStats,
    };
  }

  /**
   * O'quvchi statistikasi
   */
  async getStudentStats(studentId: string) {
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, fullName: true, login: true, avatarUrl: true },
    });

    if (!student) throw ApiError.notFound('O\'quvchi topilmadi');

    // O'quvchining guruhlari
    const groupStudents = await prisma.groupStudent.findMany({
      where: { studentId },
      include: {
        group: { select: { id: true, name: true } },
      },
    });

    // Barcha topshiriqlari
    const submissions = await prisma.submission.findMany({
      where: { studentId },
      include: {
        normative: { select: { id: true, taskNumber: true, title: true, maxScore: true } },
        group: { select: { id: true, name: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });

    const totalScore = submissions
      .filter((s) => s.status === 'checked')
      .reduce((sum, s) => sum + s.score, 0);

    const completed = submissions.filter((s) => s.status === 'checked').length;
    const pending = submissions.filter((s) => s.status === 'pending').length;

    // Guruh ichidagi o'rin
    const groupRanks = await Promise.all(
      groupStudents.map(async (gs) => {
        const allStudentsInGroup = await prisma.groupStudent.findMany({
          where: { groupId: gs.groupId, student: { isActive: true } },
          select: { studentId: true },
        });

        const scores = await Promise.all(
          allStudentsInGroup.map(async (s) => {
            const subs = await prisma.submission.findMany({
              where: { studentId: s.studentId, groupId: gs.groupId, status: 'checked' },
            });
            return {
              studentId: s.studentId,
              totalScore: subs.reduce((sum, sub) => sum + sub.score, 0),
            };
          })
        );

        scores.sort((a, b) => b.totalScore - a.totalScore);
        
        let currentGroupRankForStudent = 1;
        let previousScoreForStudent: number | null = null;
        let finalRank = 1;
        for (let i = 0; i < scores.length; i++) {
          if (previousScoreForStudent !== null && scores[i].totalScore < previousScoreForStudent) {
            currentGroupRankForStudent++;
          }
          previousScoreForStudent = scores[i].totalScore;
          if (scores[i].studentId === studentId) {
            finalRank = currentGroupRankForStudent;
            break;
          }
        }
        const rank = finalRank;

        return {
          group: gs.group,
          rank,
          totalInGroup: scores.length,
        };
      })
    );

    const level = Math.floor(totalScore / 50) + 1;
    const progressToNextLevel = (totalScore % 50) * 2; // out of 100% (since each level is 50 pts)

    const badges = [];
    const greens = submissions.filter(s => s.result === 'green');
    
    if (greens.length >= 1) badges.push({ id: 'first_green', name: "🟢 Ilk G'alaba", desc: "Birinchi marta yashil natija oldi" });
    if (greens.length >= 10) badges.push({ id: 'perfect_10', name: "🥇 A'lochi", desc: "10 ta vazifani a'lo darajada bajardi" });
    if (totalScore >= 100) badges.push({ id: 'century', name: "💯 Yuzlik", desc: "Umumiy 100 ball to'pladi" });
    if (totalScore >= 200) badges.push({ id: 'double_century', name: "🏆 200 lik Klub", desc: "Eng ilg'or o'quvchilar safida (200+ ball)" });
    if (totalScore >= 300) badges.push({ id: 'triple_century', name: "👑 Spartalik", desc: "Haqiqiy afsona! (300+ ball)" });
    if (totalScore >= 500) badges.push({ id: 'dragon', name: "🐉 Ajdarho", desc: "Markazning faxri! (500+ ball)" });
    if (groupStudents.length > 1) badges.push({ id: 'multitasker', name: "🎓 Ko'p qirrali", desc: "Bir nechta guruhda baravar o'qiydi" });
    
    // Tungi boyo'g'li (00:00 dan 05:00 gacha topshirganlar)
    const hasNightSubmission = submissions.some(s => {
      const h = new Date(s.submittedAt).getHours();
      return h >= 0 && h <= 5;
    });
    if (hasNightSubmission) badges.push({ id: 'night_owl', name: "🦉 Tungi boyo'g'li", desc: "Uyqu o'rniga kod yozadiganlar uchun" });

    // Kamalak (Yashil, Ko'k, Qizil dan kamida 2 tadan bor)
    const blues = submissions.filter(s => s.result === 'blue');
    const reds = submissions.filter(s => s.result === 'red');
    if (greens.length >= 2 && blues.length >= 2 && reds.length >= 2) {
      badges.push({ id: 'rainbow', name: "🌈 Kamalak", desc: "Hayotda hamma narsa bo'ladi! (Y, K, Q)" });
    }

    // Snayper (10 ta yashil va umuman qizil/ko'k yo'q - faqat a'lochi)
    if (greens.length >= 10 && blues.length === 0 && reds.length === 0) {
      badges.push({ id: 'sniper', name: "🎯 Snayper", doc: "Faqat nishonga! Xatosiz ishlaydi" });
    }

    // Jonlantirish (So'nggi 3 ta Qizildan keyin Yashil olsa)
    let comeback = false;
    const sortedSubs = [...submissions].sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
    for (let i = 3; i < sortedSubs.length; i++) {
      if (sortedSubs[i-3].result === 'red' && sortedSubs[i-2].result === 'red' && sortedSubs[i-1].result === 'red' && sortedSubs[i].result === 'green') {
        comeback = true;
        break;
      }
    }
    if (comeback) badges.push({ id: 'comeback', name: "🚑 O'likdan tirilgan", desc: "3 ta qizildan so'ng taslim bo'lmagan qahramon!" });

    // Raketa (Bir kunda 3 ta vazifa)
    const days: any = {};
    let isRocket = false;
    submissions.forEach(s => {
      const d = new Date(s.submittedAt).toISOString().split('T')[0];
      days[d] = (days[d] || 0) + 1;
      if (days[d] >= 3) isRocket = true;
    });
    if (isRocket) badges.push({ id: 'rocket', name: "🚀 Raketa", desc: "Bir kunning o'zida 3ta vazifa jo'natgan" });

    // Ketma-ket 5 marta yashil (streak)
    let currentStreak = 0;
    let maxStreak = 0;
    sortedSubs.filter(s => s.status === 'checked').forEach(s => {
      if (s.result === 'green') {
        currentStreak++;
        if (currentStreak > maxStreak) maxStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    });
    if (maxStreak >= 5) badges.push({ id: 'streak_5', name: "🔥 Olovli", desc: "Ketma-ket 5 ta a'lo natija" });

    return {
      student,
      totalScore,
      level,
      progressToNextLevel,
      badges,
      completed,
      pending,
      groups: groupRanks,
      submissions,
    };
  }

  async analyzeStudentWithAI(studentId: string): Promise<string> {
    const { apiKey, centerContext } = getAISettings();
    if (!apiKey) throw new Error('API_KEY_NOT_SET');

    // Ma'lumotlarni yig'ish
    const student = await prisma.user.findUnique({ where: { id: studentId } });
    const submissions = await prisma.submission.findMany({
      where: { studentId },
      include: { normative: { include: { category: true } }, group: true },
      orderBy: { submittedAt: 'asc' },
    });

    const greenCount = submissions.filter(s => s.result === 'green').length;
    const blueCount = submissions.filter(s => s.result === 'blue').length;
    const redCount = submissions.filter(s => s.result === 'red').length;
    const pendingCount = submissions.filter(s => s.status === 'pending').length;
    const totalScore = submissions.reduce((sum, s) => sum + s.score, 0);

    // Kategoriya bo'yicha breakdown
    const categoryStats: Record<string, { green: number; blue: number; red: number; total: number }> = {};
    submissions.forEach(s => {
      const cat = s.normative?.category?.name || 'Umumiy';
      if (!categoryStats[cat]) categoryStats[cat] = { green: 0, blue: 0, red: 0, total: 0 };
      if (s.status === 'checked' && s.result) {
        categoryStats[cat][s.result]++;
        categoryStats[cat].total += s.score;
      }
    });

    const prompt = `Sen 10 yillik tajribali IT ta'lim mentorisan.
${centerContext ? `O'quv markaz haqida: ${centerContext}` : ''}

O'quvchi: ${student?.fullName}
Jami ball: ${totalScore}
Natijalar: 🟢 ${greenCount} | 🔵 ${blueCount} | 🔴 ${redCount} | ⏳ ${pendingCount}

Kategoriya bo'yicha:
${Object.entries(categoryStats).map(([cat, st]) => 
  `${cat}: 🟢${st.green} 🔵${st.blue} 🔴${st.red} — ${st.total} ball`
).join('\n')}

Topshiriqlar ketma-ketligi (vaqt bo'yicha):
${submissions.slice(-20).map(s => 
  `${s.normative?.title}: ${s.status === 'checked' ? s.result : 'kutilmoqda'} (${s.score} ball) — ${new Date(s.submittedAt).toLocaleDateString()}`
).join('\n')}

Quyidagilarni tahlil qil:

📊 UMUMIY HOLAT
(O'quvchining hozirgi darajasi va o'rni haqida qisqa xulosa)

💪 KUCHLI TOMONLARI
(Qaysi sohalarda yaxshi natija ko'rsatmoqda)

⚠️ ZAIF TOMONLARI
(Qaysi normativlar/sohalar yomonroq)

📈 O'SISH DINAMIKASI
(Vaqt o'tishi bilan yaxshilanmoqdami yoki yomonlashmoqdami)

🎯 INDIVIDUAL TAVSIYALAR
(Aniq, amaliy maslahatlar — nima qilishi kerak)

O'zbek tilida, tushunarli va amaliy uslubda yozing.
Har bir bo'lim uchun 3-5 ta gap yeting. Javob tugal va to'liq bo'lsin.
HECH QANDAY MARKDOWN BELGILARINI (*, **, #) ISHLATMANG! Sarlavhalarni faqat bosh harflar va emoji bilan yozing.`;

    return generateText(prompt, 65536);
  }
}

export default new StatisticsService();
