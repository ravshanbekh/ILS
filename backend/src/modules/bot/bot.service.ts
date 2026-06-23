import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import { TelegramLinkRecord, FreezeItem } from './bot.types';
import { FREEZE_REASON_LABELS } from '../freezes/freezes.service';

class BotService {
  // ============ ALOQA BO'LGAN O'QUVCHI ============

  /**
   * Telegram ID bo'yicha bog'langan linkni olish
   */
  async getLinkByTelegramId(telegramId: number | bigint): Promise<TelegramLinkRecord | null> {
    return prisma.telegramLink.findUnique({
      where: { telegramId: BigInt(telegramId) },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            login: true,
            role: true,
            avatarUrl: true,
            groupStudents: {
              include: { group: { select: { id: true, name: true } } },
              take: 3,
            },
          },
        },
      },
    }) as any;
  }

  /**
   * Login va parol orqali o'quvchini tekshirib bog'lash (ota-ona uchun)
   */
  async linkParent(data: {
    telegramId: number;
    chatId: number;
    login: string;
    password: string;
    fullName?: string;
    username?: string;
  }): Promise<{ success: boolean; message: string; studentName?: string; groupName?: string }> {
    // O'quvchini topish
    const user = await prisma.user.findUnique({ where: { login: data.login } });

    if (!user) return { success: false, message: 'not_found' };
    if (!user.isActive) return { success: false, message: 'not_active' };
    if (user.role !== 'student') return { success: false, message: 'not_student' };

    // Parolni tekshirish
    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) return { success: false, message: 'wrong_password' };

    // Guruhini olish
    const groupStudent = await prisma.groupStudent.findFirst({
      where: { studentId: user.id },
      include: { group: { select: { name: true } } },
      orderBy: { joinedAt: 'desc' },
    });

    // TelegramLink yaratish yoki yangilash
    await prisma.telegramLink.upsert({
      where: { telegramId: BigInt(data.telegramId) },
      create: {
        telegramId: BigInt(data.telegramId),
        chatId: BigInt(data.chatId),
        studentId: user.id,
        role: 'parent',
        fullName: data.fullName,
        username: data.username,
      },
      update: {
        chatId: BigInt(data.chatId),
        studentId: user.id,
        role: 'parent',
        fullName: data.fullName,
        username: data.username,
        isActive: true,
      },
    });

    return {
      success: true,
      message: 'ok',
      studentName: user.fullName,
      groupName: groupStudent?.group.name,
    };
  }

  /**
   * Operator sifatida kirish (call_operatori va admin rollari)
   */
  async linkOperator(data: {
    telegramId: number;
    chatId: number;
    login: string;
    password: string;
    fullName?: string;
    username?: string;
  }): Promise<{ success: boolean; message: string; name?: string }> {
    const user = await prisma.user.findUnique({ where: { login: data.login } });

    if (!user) return { success: false, message: 'not_found' };
    if (!user.isActive) return { success: false, message: 'not_active' };

    const allowedRoles = ['call_operatori', 'admin', 'administrator', 'sotuv_operatori', 'filial_rahbari'];
    if (!allowedRoles.includes(user.role)) {
      return { success: false, message: 'unauthorized' };
    }

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) return { success: false, message: 'wrong_password' };

    // Birinchi student bor bo'lsa, uni ishlatamiz; aks holda admin o'zini bog'laydi
    // Operator uchun studentId sifatida o'zini ishlatamiz (workaround)
    // Lekin schema TelegramLink.studentId NOT NULL — shuning uchun operatorni admin student sifatida saqlaymiz
    // Haqiqiy tekshiruv role orqali bo'ladi
    await prisma.telegramLink.upsert({
      where: { telegramId: BigInt(data.telegramId) },
      create: {
        telegramId: BigInt(data.telegramId),
        chatId: BigInt(data.chatId),
        studentId: user.id,  // operator o'zi
        role: 'operator',
        fullName: data.fullName || user.fullName,
        username: data.username,
      },
      update: {
        chatId: BigInt(data.chatId),
        studentId: user.id,
        role: 'operator',
        fullName: data.fullName || user.fullName,
        username: data.username,
        isActive: true,
      },
    });

    return { success: true, message: 'ok', name: user.fullName };
  }

  /**
   * Telegram bog'lanishni uzish
   */
  async unlink(telegramId: number): Promise<void> {
    await prisma.telegramLink.updateMany({
      where: { telegramId: BigInt(telegramId) },
      data: { isActive: false },
    });
  }

  // ============ O'QUVCHI MA'LUMOTLARI ============

  /**
   * O'quvchi to'liq statistikasini olish
   */
  async getStudentStats(studentId: string) {
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, fullName: true, login: true, avatarUrl: true },
    });
    if (!student) return null;

    const groupStudents = await prisma.groupStudent.findMany({
      where: { studentId },
      include: { group: { select: { id: true, name: true } } },
    });

    const submissions = await prisma.submission.findMany({
      where: { studentId },
      include: {
        normative: { select: { id: true, taskNumber: true, title: true, maxScore: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });

    const totalScore = submissions
      .filter((s) => s.status === 'checked')
      .reduce((sum, s) => sum + s.score, 0);
    const completed = submissions.filter((s) => s.status === 'checked').length;
    const pending = submissions.filter((s) => s.status === 'pending').length;
    const level = Math.floor(totalScore / 50) + 1;

    // Guruh reytingi
    const groups = await Promise.all(
      groupStudents.map(async (gs) => {
        const allInGroup = await prisma.groupStudent.findMany({
          where: { groupId: gs.groupId },
          select: { studentId: true },
        });
        const scores = await Promise.all(
          allInGroup.map(async (s) => {
            const subs = await prisma.submission.findMany({
              where: { studentId: s.studentId, groupId: gs.groupId, status: 'checked' },
            });
            return { studentId: s.studentId, total: subs.reduce((sum, sub) => sum + sub.score, 0) };
          })
        );
        scores.sort((a, b) => b.total - a.total);
        let rank = 1;
        for (let i = 0; i < scores.length; i++) {
          if (i > 0 && scores[i].total < scores[i - 1].total) rank++;
          if (scores[i].studentId === studentId) break;
        }
        return { group: gs.group, rank, totalInGroup: allInGroup.length };
      })
    );

    // Badges (oddiy versiya)
    const badges: Array<{ id: string; name: string }> = [];
    const greens = submissions.filter((s) => s.result === 'green').length;
    if (greens >= 1) badges.push({ id: 'first_green', name: "🟢 Ilk G'alaba" });
    if (greens >= 10) badges.push({ id: 'perfect_10', name: "🥇 A'lochi" });
    if (totalScore >= 100) badges.push({ id: 'century', name: '💯 Yuzlik' });
    if (totalScore >= 200) badges.push({ id: 'double_century', name: '🏆 200lik Klub' });
    if (totalScore >= 300) badges.push({ id: 'triple_century', name: '👑 Spartalik' });
    if (totalScore >= 500) badges.push({ id: 'dragon', name: '🐉 Ajdarho' });

    return {
      student,
      totalScore,
      completed,
      pending,
      level,
      badges,
      groups,
      submissions: submissions.map((s) => ({
        id: s.id,
        normativeId: s.normativeId,
        status: s.status,
        result: s.result,
        score: s.score,
        comment: s.comment,
        submittedAt: s.submittedAt,
        normative: s.normative,
      })),
    };
  }

  /**
   * Guruh top-10 leaderboard
   */
  async getGroupLeaderboard(
    groupId: string
  ): Promise<Array<{ name: string; score: number; rank: number }>> {
    const groupStudents = await prisma.groupStudent.findMany({
      where: { groupId },
      include: { student: { select: { id: true, fullName: true } } },
    });

    const scores = await Promise.all(
      groupStudents.map(async (gs) => {
        const subs = await prisma.submission.findMany({
          where: { studentId: gs.studentId, groupId, status: 'checked' },
        });
        return {
          name: gs.student.fullName,
          studentId: gs.studentId,
          score: subs.reduce((s, sub) => s + sub.score, 0),
        };
      })
    );

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, 10).map((s, i) => ({ ...s, rank: i + 1 }));
  }

  // ============ FEEDBACK ============

  /**
   * Ota-onadan feedback saqlash
   */
  async saveFeedback(data: {
    telegramId: number;
    studentId: string;
    teacherId?: string;
    message: string;
  }) {
    return prisma.telegramFeedback.create({
      data: {
        telegramId: BigInt(data.telegramId),
        studentId: data.studentId,
        teacherId: data.teacherId,
        message: data.message,
      },
    });
  }

  /**
   * O'qituvchini o'quvchi orqali topish
   */
  async getTeacherByStudentId(studentId: string): Promise<{ id: string; fullName: string } | null> {
    const gs = await prisma.groupStudent.findFirst({
      where: { studentId },
      include: {
        group: {
          include: { teacher: { select: { id: true, fullName: true } } },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });
    return gs?.group?.teacher || null;
  }

  // ============ SOZLAMALAR ============

  /**
   * Bildirishnoma sozlamalarini olish
   */
  async getNotificationSettings(telegramId: number) {
    return prisma.telegramLink.findUnique({
      where: { telegramId: BigInt(telegramId) },
      select: {
        notifyOnCheck: true,
        notifyOnRank: true,
        notifyWeekly: true,
        notifyInactivity: true,
      },
    });
  }

  /**
   * Bildirishnoma sozlamalarini yangilash
   */
  async updateNotificationSettings(
    telegramId: number,
    field: 'notifyOnCheck' | 'notifyOnRank' | 'notifyWeekly' | 'notifyInactivity',
    value: boolean
  ) {
    return prisma.telegramLink.update({
      where: { telegramId: BigInt(telegramId) },
      data: { [field]: value },
      select: {
        notifyOnCheck: true,
        notifyOnRank: true,
        notifyWeekly: true,
        notifyInactivity: true,
      },
    });
  }

  // ============ OPERATOR FUNKSIYALARI ============

  /**
   * Muzlatilganlar ro'yxatini olish (operator uchun)
   */
  async getFrozenList(month?: number, year?: number): Promise<FreezeItem[]> {
    const now = new Date();
    const m = month || now.getMonth() + 1;
    const y = year || now.getFullYear();

    const freezes = await prisma.studentFreeze.findMany({
      where: { month: m, year: y },
      orderBy: { frozenAt: 'desc' },
    });

    return freezes.map((f) => ({
      id: f.id,
      studentName: f.studentName,
      teacherName: f.teacherName,
      groupName: f.groupName,
      filial: f.filial,
      phone: f.phone,
      reason: FREEZE_REASON_LABELS[f.reason] || f.reason,
      detailedNote: f.detailedNote,
      frozenAt: f.frozenAt,
      startDate: f.startDate,
    }));
  }

  /**
   * Qidiruv (nom bo'yicha)
   */
  async searchFrozen(query: string): Promise<FreezeItem[]> {
    const now = new Date();
    const freezes = await prisma.studentFreeze.findMany({
      where: {
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        studentName: { contains: query, mode: 'insensitive' },
      },
      orderBy: { frozenAt: 'desc' },
      take: 10,
    });

    return freezes.map((f) => ({
      id: f.id,
      studentName: f.studentName,
      teacherName: f.teacherName,
      groupName: f.groupName,
      filial: f.filial,
      phone: f.phone,
      reason: FREEZE_REASON_LABELS[f.reason] || f.reason,
      detailedNote: f.detailedNote,
      frozenAt: f.frozenAt,
      startDate: f.startDate,
    }));
  }

  // ============ PROAKTIV XABARLAR UCHUN ============

  /**
   * O'quvchiga bog'langan barcha ota-onalar chat ID larini olish (notifyOnCheck = true)
   */
  async getParentChatIds(
    studentId: string,
    field: 'notifyOnCheck' | 'notifyOnRank' | 'notifyWeekly' | 'notifyInactivity' = 'notifyOnCheck'
  ): Promise<bigint[]> {
    const links = await prisma.telegramLink.findMany({
      where: { studentId, role: 'parent', isActive: true, [field]: true },
      select: { chatId: true },
    });
    return links.map((l) => l.chatId);
  }

  /**
   * Barcha aktiv operator chatId larini olish
   */
  async getOperatorChatIds(): Promise<bigint[]> {
    const links = await prisma.telegramLink.findMany({
      where: { role: 'operator', isActive: true },
      select: { chatId: true },
    });
    return links.map((l) => l.chatId);
  }

  /**
   * 3+ kun topshiriq bermagan o'quvchilarga bog'langan ota-onalar
   */
  async getInactiveStudentParents(days = 3): Promise<Array<{
    studentId: string;
    studentName: string;
    chatIds: bigint[];
    completed: number;
  }>> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    // Barcha aktiv link'lar (parent)
    const links = await prisma.telegramLink.findMany({
      where: { role: 'parent', isActive: true, notifyInactivity: true },
      select: { studentId: true, chatId: true },
    });

    // Unikal studentlar
    const studentMap = new Map<string, bigint[]>();
    for (const l of links) {
      if (!studentMap.has(l.studentId)) studentMap.set(l.studentId, []);
      studentMap.get(l.studentId)!.push(l.chatId);
    }

    const result: Array<{ studentId: string; studentName: string; chatIds: bigint[]; completed: number }> = [];

    for (const [studentId, chatIds] of studentMap.entries()) {
      // So'nggi submission sanasini tekshirish
      const lastSub = await prisma.submission.findFirst({
        where: { studentId },
        orderBy: { submittedAt: 'desc' },
        select: { submittedAt: true },
      });

      const isInactive = !lastSub || lastSub.submittedAt < cutoff;
      if (!isInactive) continue;

      const student = await prisma.user.findUnique({
        where: { id: studentId },
        select: { fullName: true },
      });

      const completed = await prisma.submission.count({
        where: { studentId, status: 'checked' },
      });

      if (student) {
        result.push({ studentId, studentName: student.fullName, chatIds, completed });
      }
    }

    return result;
  }

  /**
   * Haftalik statistika hisoblash
   */
  async getWeeklyStats(studentId: string) {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const subs = await prisma.submission.findMany({
      where: { studentId, submittedAt: { gte: weekAgo }, status: 'checked' },
      select: { result: true, score: true },
    });

    return {
      newSubmissions: subs.length,
      greenCount: subs.filter((s) => s.result === 'green').length,
      blueCount: subs.filter((s) => s.result === 'blue').length,
      redCount: subs.filter((s) => s.result === 'red').length,
      gainedScore: subs.reduce((sum, s) => sum + s.score, 0),
    };
  }

  /**
   * Barcha aktiv parent link'lar (haftalik hisobot uchun)
   */
  async getAllActiveParentLinks(): Promise<Array<{ chatId: bigint; studentId: string }>> {
    const links = await prisma.telegramLink.findMany({
      where: { role: 'parent', isActive: true, notifyWeekly: true },
      select: { chatId: true, studentId: true },
    });
    return links;
  }
}

export default new BotService();
