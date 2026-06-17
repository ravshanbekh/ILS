import ExcelJS from 'exceljs';
import prisma from '../../config/database';
import { ApiError } from '../../shared/middleware/errorHandler';
import { getResultEmoji } from '../../shared/utils/scoreCalculator';

class ExportService {
  /**
   * Guruh natijalarini Excel formatda tayyorlash
   */
  async exportGroupResults(groupId: string): Promise<ExcelJS.Workbook> {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        teacher: { select: { fullName: true } },
        groupStudents: {
          include: {
            student: { select: { id: true, fullName: true, login: true } },
          },
          orderBy: { joinedAt: 'asc' },
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

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Normativ Tizim';
    workbook.created = new Date();

    // ============ SHEET 1: Umumiy ko'rinish ============
    const sheet1 = workbook.addWorksheet('Umumiy ko\'rinish');

    // Header
    sheet1.columns = [
      { header: '#', key: 'rank', width: 5 },
      { header: 'O\'quvchi', key: 'student', width: 25 },
      { header: 'Jami ball', key: 'totalScore', width: 12 },
      { header: 'Bajarilgan', key: 'completed', width: 12 },
      { header: 'Kutilmoqda', key: 'pending', width: 12 },
      { header: 'Yashil', key: 'green', width: 10 },
      { header: 'Ko\'k', key: 'blue', width: 10 },
      { header: 'Qizil', key: 'red', width: 10 },
    ];

    // Header stilini o'rnatish
    sheet1.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet1.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F2937' },
    };

    // O'quvchilar ma'lumotlarini hisoblash va qo'shish
    const studentStats = await Promise.all(
      group.groupStudents.map(async (gs) => {
        const submissions = await prisma.submission.findMany({
          where: { studentId: gs.student.id, groupId },
          select: { score: true, result: true, status: true },
        });

        const checked = submissions.filter((s) => s.status === 'checked');
        const totalScore = checked.reduce((sum, s) => sum + s.score, 0);

        return {
          student: gs.student,
          totalScore,
          completed: checked.length,
          pending: submissions.length - checked.length,
          green: checked.filter((s) => s.result === 'green').length,
          blue: checked.filter((s) => s.result === 'blue').length,
          red: checked.filter((s) => s.result === 'red').length,
        };
      })
    );

    // Ball bo'yicha tartiblash
    studentStats.sort((a, b) => b.totalScore - a.totalScore);

    let currentRank = 1;
    let previousScore: number | null = null;

    studentStats.forEach((s) => {
      if (previousScore !== null && s.totalScore < previousScore) {
        currentRank++;
      }
      previousScore = s.totalScore;

      const row = sheet1.addRow({
        rank: currentRank,
        student: s.student.fullName,
        totalScore: s.totalScore,
        completed: s.completed,
        pending: s.pending,
        green: s.green,
        blue: s.blue,
        red: s.red,
      });

      // Top 3 uchun maxsus rang (O'rin bo'yicha)
      if (currentRank === 1) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD700' } };
      if (currentRank === 2) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC0C0C0' } };
      if (currentRank === 3) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCD7F32' } };
    });

    // ============ SHEET 2: Normativlar bo'yicha ============
    const sheet2 = workbook.addWorksheet('Normativlar bo\'yicha');

    // Dinamik header — O'quvchi + har bir normativ ustuni
    const normHeaders: Partial<ExcelJS.Column>[] = [
      { header: 'O\'quvchi', key: 'student', width: 25 },
    ];
    for (const gn of group.groupNormatives) {
      normHeaders.push({
        header: `#${gn.normative.taskNumber}\n(${gn.normative.maxScore}b)`,
        key: `n_${gn.normative.id}`,
        width: 10,
      });
    }
    normHeaders.push({ header: 'Jami', key: 'total', width: 10 });

    sheet2.columns = normHeaders;

    // Header stili
    sheet2.getRow(1).font = { bold: true, size: 9 };
    sheet2.getRow(1).alignment = { wrapText: true, horizontal: 'center' };

    // Ma'lumotlar
    for (const stat of studentStats) {
      const rowData: any = { student: stat.student.fullName };

      const submissions = await prisma.submission.findMany({
        where: { studentId: stat.student.id, groupId },
        select: { normativeId: true, result: true, score: true, status: true },
      });

      let total = 0;
      for (const gn of group.groupNormatives) {
        const sub = submissions.find((s) => s.normativeId === gn.normative.id);
        if (sub && sub.status === 'checked') {
          rowData[`n_${gn.normative.id}`] = `${getResultEmoji(sub.result as any)} ${sub.score}`;
          total += sub.score;
        } else if (sub) {
          rowData[`n_${gn.normative.id}`] = '⏳';
        } else {
          rowData[`n_${gn.normative.id}`] = '—';
        }
      }
      rowData.total = total;

      sheet2.addRow(rowData);
    }

    // ============ SHEET 3: Topshiriq tarixi ============
    const sheet3 = workbook.addWorksheet('Topshiriq tarixi');

    sheet3.columns = [
      { header: 'Sana', key: 'date', width: 18 },
      { header: 'O\'quvchi', key: 'student', width: 22 },
      { header: 'Normativ', key: 'normative', width: 25 },
      { header: 'Natija', key: 'result', width: 10 },
      { header: 'Ball', key: 'score', width: 8 },
      { header: 'Tekshirgan', key: 'checkedBy', width: 20 },
      { header: 'YouTube', key: 'youtube', width: 35 },
    ];

    sheet3.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet3.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F2937' },
    };

    const allSubmissions = await prisma.submission.findMany({
      where: { groupId },
      include: {
        student: { select: { fullName: true } },
        normative: { select: { taskNumber: true, title: true } },
        checkedBy: { select: { fullName: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });

    for (const sub of allSubmissions) {
      sheet3.addRow({
        date: sub.submittedAt.toISOString().split('T')[0],
        student: sub.student.fullName,
        normative: `#${sub.normative.taskNumber}: ${sub.normative.title}`,
        result: sub.result ? getResultEmoji(sub.result as any) : '⏳',
        score: sub.score,
        checkedBy: sub.checkedBy?.fullName || '—',
        youtube: sub.youtubeUrl,
      });
    }

    // Guruh ma'lumotlari qo'shish
    sheet1.insertRow(1, [`${group.name} guruhi — O'qituvchi: ${group.teacher?.fullName || 'Belgilanmagan'}`]);
    sheet1.mergeCells('A1:H1');
    sheet1.getRow(1).font = { bold: true, size: 14 };
    sheet1.getRow(1).alignment = { horizontal: 'center' };

    return workbook;
  }

  /**
   * Umumiy hisobot (barcha guruhlar)
   */
  async exportOverview(): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Normativ Tizim';

    const sheet = workbook.addWorksheet('Umumiy hisobot');

    sheet.columns = [
      { header: 'Guruh', key: 'group', width: 15 },
      { header: 'O\'qituvchi', key: 'teacher', width: 22 },
      { header: 'O\'quvchilar', key: 'students', width: 12 },
      { header: 'Normativlar', key: 'normatives', width: 12 },
      { header: 'Topshiriqlar', key: 'submissions', width: 12 },
      { header: 'Tekshirilgan', key: 'checked', width: 12 },
      { header: 'Kutilmoqda', key: 'pending', width: 12 },
      { header: 'O\'rtacha ball', key: 'avgScore', width: 14 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F2937' },
    };

    const groups = await prisma.group.findMany({
      where: { isActive: true },
      include: {
        teacher: { select: { fullName: true } },
        _count: {
          select: { groupStudents: true, groupNormatives: true },
        },
      },
    });

    for (const group of groups) {
      const submissions = await prisma.submission.findMany({
        where: { groupId: group.id },
        select: { status: true, score: true },
      });

      const checked = submissions.filter((s) => s.status === 'checked');
      const pending = submissions.filter((s) => s.status === 'pending');
      const avgScore = checked.length > 0
        ? Math.round(checked.reduce((sum, s) => sum + s.score, 0) / checked.length)
        : 0;

      sheet.addRow({
        group: group.name,
        teacher: group.teacher?.fullName || '—',
        students: group._count.groupStudents,
        normatives: group._count.groupNormatives,
        submissions: submissions.length,
        checked: checked.length,
        pending: pending.length,
        avgScore,
      });
    }

    return workbook;
  }

  /**
   * Oylik hisobot (O'qituvchilar reytingi va ko'rsatkichlari)
   */
  async exportMonthlyReport(): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Normativ Tizim';

    const sheet = workbook.addWorksheet("O'qituvchilar Hisoboti");

    sheet.columns = [
      { header: "O'rin", key: 'rank', width: 6 },
      { header: "O'qituvchi", key: 'teacher', width: 25 },
      { header: 'Guruhlar soni', key: 'groupsCount', width: 15 },
      { header: 'O\'quvchilar soni', key: 'studentsCount', width: 18 },
      { header: 'Tekshirilgan vazifalar', key: 'checkedCount', width: 22 },
      { header: 'Yashil (A\'lo)', key: 'green', width: 15 },
      { header: 'Ko\'k (Yaxshi)', key: 'blue', width: 15 },
      { header: 'Qizil (Yomon)', key: 'red', width: 15 },
      { header: 'O\'rtacha Ball', key: 'avgScore', width: 15 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };

    const teachers = await prisma.user.findMany({
      where: { role: 'teacher', isActive: true },
    });

    const teacherStats = await Promise.all(
      teachers.map(async (teacher) => {
        const groups = await prisma.group.findMany({
          where: { teacherId: teacher.id, isActive: true },
          include: { _count: { select: { groupStudents: true } } },
        });

        const groupIds = groups.map((g) => g.id);
        const studentsCount = groups.reduce((sum, g) => sum + g._count.groupStudents, 0);

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
          teacher: teacher.fullName,
          groupsCount: groups.length,
          studentsCount,
          checkedCount,
          green,
          blue,
          red,
          avgScore,
          scoreForSort: checkedCount * avgScore // Simple metric for ranking
        };
      })
    );

    // Sort by performance (volume * quality)
    teacherStats.sort((a, b) => b.scoreForSort - a.scoreForSort);

    let currentTeacherRank = 1;
    let previousTeacherScore: number | null = null;

    teacherStats.forEach((stat) => {
      if (previousTeacherScore !== null && stat.scoreForSort < previousTeacherScore) {
        currentTeacherRank++;
      }
      previousTeacherScore = stat.scoreForSort;

      sheet.addRow({
        rank: currentTeacherRank,
        teacher: stat.teacher,
        groupsCount: stat.groupsCount,
        studentsCount: stat.studentsCount,
        checkedCount: stat.checkedCount,
        green: stat.green,
        blue: stat.blue,
        red: stat.red,
        avgScore: stat.avgScore,
      });
    });

    return workbook;
  }

  /**
   * Bitta o'quvchi hisoboti
   */
  async exportStudent(studentId: string): Promise<ExcelJS.Workbook> {
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, fullName: true, login: true },
    });

    if (!student) throw ApiError.notFound('O\'quvchi topilmadi');

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Normativ Tizim';

    const sheet = workbook.addWorksheet(`${student.fullName}`);

    // Header
    sheet.insertRow(1, [`${student.fullName} — Normativ natijalari`]);
    sheet.mergeCells('A1:F1');
    sheet.getRow(1).font = { bold: true, size: 14 };

    sheet.getRow(3).values = ['Normativ', 'Guruh', 'Natija', 'Ball', 'Sana', 'Izoh'];
    sheet.getRow(3).font = { bold: true };

    sheet.getColumn(1).width = 25;
    sheet.getColumn(2).width = 12;
    sheet.getColumn(3).width = 10;
    sheet.getColumn(4).width = 8;
    sheet.getColumn(5).width = 15;
    sheet.getColumn(6).width = 25;

    const submissions = await prisma.submission.findMany({
      where: { studentId },
      include: {
        normative: { select: { taskNumber: true, title: true } },
        group: { select: { name: true } },
      },
      orderBy: { normative: { taskNumber: 'asc' } },
    });

    let rowNum = 4;
    for (const sub of submissions) {
      sheet.getRow(rowNum).values = [
        `#${sub.normative.taskNumber}: ${sub.normative.title}`,
        sub.group?.name || '—',
        sub.result ? getResultEmoji(sub.result as any) : '⏳',
        sub.score,
        sub.submittedAt.toISOString().split('T')[0],
        sub.comment || '',
      ];
      rowNum++;
    }

    // Umumiy
    const totalScore = submissions
      .filter((s) => s.status === 'checked')
      .reduce((sum, s) => sum + s.score, 0);

    sheet.getRow(rowNum + 1).values = ['', '', 'JAMI:', totalScore, '', ''];
    sheet.getRow(rowNum + 1).font = { bold: true, size: 12 };

    return workbook;
  }
}

export default new ExportService();
