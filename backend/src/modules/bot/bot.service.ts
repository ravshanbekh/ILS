import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import { TelegramLinkRecord } from './bot.types';

/**
 * Bitta farzandga eng ko'pi bilan shuncha Telegram akkaunt ulanishi mumkin.
 * Ikkitasi — ota va ona. Cheklovsiz qoldirilsa, login-parolni bilgan har kim
 * ulanib bola haqidagi barcha xabarlarni ola boshlardi.
 */
export const MAX_PARENTS_PER_STUDENT = 2;

class BotService {
  // ============ ALOQA BO'LGAN O'QUVCHI ============

  /**
   * Telegram ID bo'yicha "faol" (oxirgi tanlangan) farzand linkini olish.
   * Bir ota-ona bir nechta farzandga ulangan bo'lishi mumkin — shundan
   * lastActiveAt bo'yicha eng oxirgisi "hozir ko'rsatilayotgan bola" hisoblanadi.
   */
  async getLinkByTelegramId(telegramId: number | bigint): Promise<TelegramLinkRecord | null> {
    return prisma.telegramLink.findFirst({
      where: { telegramId: BigInt(telegramId) },
      orderBy: { lastActiveAt: 'desc' },
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
   * Shu Telegram akkauntga ulangan barcha farzandlar (bola almashtirish menyusi uchun)
   */
  async getAllChildLinksByTelegramId(telegramId: number | bigint) {
    return prisma.telegramLink.findMany({
      where: { telegramId: BigInt(telegramId), role: 'parent', isActive: true },
      orderBy: { lastActiveAt: 'desc' },
      include: { student: { select: { id: true, fullName: true } } },
    });
  }

  /** Bir nechta farzand orasida "hozir faol" bolani almashtirish */
  async setActiveChild(telegramId: number | bigint, studentId: string): Promise<void> {
    await prisma.telegramLink.updateMany({
      where: { telegramId: BigInt(telegramId), studentId },
      data: { lastActiveAt: new Date() },
    });
  }

  /**
   * Login va parol orqali o'quvchini tekshirib bog'lash (ota-ona uchun).
   * Bitta ota-ona bir nechta farzandga ulana oladi va bitta farzandga
   * MAX_PARENTS_PER_STUDENT tagacha Telegram akkaunt ulanishi mumkin
   * (ota va ona alohida kuzatishi uchun). Chegara oshsa — avval kimdir
   * /unlink qilishi kerak.
   */
  async linkParent(data: {
    telegramId: number;
    chatId: number;
    login: string;
    password: string;
    fullName?: string;
    username?: string;
  }): Promise<{
    success: boolean;
    message: string;
    studentName?: string;
    groupName?: string;
    parentCount?: number;
  }> {
    // O'quvchini topish
    const user = await prisma.user.findUnique({ where: { login: data.login } });

    if (!user) return { success: false, message: 'not_found' };
    if (!user.isActive) return { success: false, message: 'not_active' };
    if (user.role !== 'student') return { success: false, message: 'not_student' };

    // Parolni tekshirish
    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) return { success: false, message: 'wrong_password' };

    // Bu farzandga nechta BOSHQA Telegram akkaunt ulangan?
    const otherParents = await prisma.telegramLink.count({
      where: {
        studentId: user.id,
        role: 'parent',
        isActive: true,
        telegramId: { not: BigInt(data.telegramId) },
      },
    });
    if (otherParents >= MAX_PARENTS_PER_STUDENT) {
      return { success: false, message: 'link_limit_reached' };
    }

    // Guruhini olish
    const groupStudent = await prisma.groupStudent.findFirst({
      where: { studentId: user.id },
      include: { group: { select: { name: true } } },
      orderBy: { joinedAt: 'desc' },
    });

    // TelegramLink yaratish yoki yangilash — shu bola uchun (boshqa farzandlarga ulanish saqlanib qoladi)
    await prisma.telegramLink.upsert({
      where: { telegramId_studentId: { telegramId: BigInt(data.telegramId), studentId: user.id } },
      create: {
        telegramId: BigInt(data.telegramId),
        chatId: BigInt(data.chatId),
        studentId: user.id,
        role: 'parent',
        fullName: data.fullName,
        username: data.username,
        lastActiveAt: new Date(),
      },
      update: {
        chatId: BigInt(data.chatId),
        role: 'parent',
        fullName: data.fullName,
        username: data.username,
        isActive: true,
        lastActiveAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'ok',
      studentName: user.fullName,
      groupName: groupStudent?.group.name,
      // Shu farzandni endi nechta ota-ona kuzatyapti (o'zi bilan birga)
      parentCount: otherParents + 1,
    };
  }

  /**
   * Admin/Rahbar sifatida kirish — kunlik hisobot olish uchun
   */
  async linkAdmin(data: {
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

    const allowedRoles = ['admin', 'filial_rahbari', 'administrator', 'nazoratchi'];
    if (!allowedRoles.includes(user.role)) {
      return { success: false, message: 'unauthorized' };
    }

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) return { success: false, message: 'wrong_password' };

    await prisma.telegramLink.upsert({
      where: { telegramId_studentId: { telegramId: BigInt(data.telegramId), studentId: user.id } },
      create: {
        telegramId: BigInt(data.telegramId),
        chatId: BigInt(data.chatId),
        studentId: user.id,
        role: 'admin',
        fullName: data.fullName || user.fullName,
        username: data.username,
        lastActiveAt: new Date(),
      },
      update: {
        chatId: BigInt(data.chatId),
        role: 'admin',
        fullName: data.fullName || user.fullName,
        username: data.username,
        isActive: true,
        lastActiveAt: new Date(),
      },
    });

    return { success: true, message: 'ok', name: user.fullName };
  }

  /**
   * Telegram bog'lanishni uzish. studentId berilmasa — hozir "faol" (oxirgi ko'rilgan)
   * farzand bilan bog'lanish uziladi, boshqa farzandlarga ulanish saqlanib qoladi.
   */
  async unlink(telegramId: number, studentId?: string): Promise<void> {
    if (studentId) {
      await prisma.telegramLink.updateMany({
        where: { telegramId: BigInt(telegramId), studentId },
        data: { isActive: false },
      });
      return;
    }

    const active = await prisma.telegramLink.findFirst({
      where: { telegramId: BigInt(telegramId) },
      orderBy: { lastActiveAt: 'desc' },
    });
    if (active) {
      await prisma.telegramLink.update({ where: { id: active.id }, data: { isActive: false } });
    }
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

    // Guruh reytingi — ilgari bu yerda ikki qavatli sikl bor edi (har bir guruh uchun,
    // guruhdagi har bir o'quvchi uchun alohida so'rov). Endi ikkita so'rov kifoya.
    const myGroupIds = groupStudents.map((gs) => gs.groupId);
    const [peers, peerSubs] = await Promise.all([
      myGroupIds.length
        ? prisma.groupStudent.findMany({
            where: { groupId: { in: myGroupIds } },
            select: { groupId: true, studentId: true },
          })
        : Promise.resolve([] as { groupId: string; studentId: string }[]),
      myGroupIds.length
        ? prisma.submission.findMany({
            where: { groupId: { in: myGroupIds }, status: 'checked' },
            select: { studentId: true, groupId: true, score: true },
          })
        : Promise.resolve([] as { studentId: string; groupId: string | null; score: number }[]),
    ]);

    // guruh -> (o'quvchi -> jami ball) — bitta o'tishda tayyorlanadi
    const totalsByGroup = new Map<string, Map<string, number>>();
    for (const sub of peerSubs) {
      if (!sub.groupId) continue;
      let totals = totalsByGroup.get(sub.groupId);
      if (!totals) { totals = new Map(); totalsByGroup.set(sub.groupId, totals); }
      totals.set(sub.studentId, (totals.get(sub.studentId) || 0) + sub.score);
    }

    const groups = groupStudents.map((gs) => {
      const allInGroup = peers.filter((p) => p.groupId === gs.groupId);
      const totals = totalsByGroup.get(gs.groupId) || new Map<string, number>();

      const scores = allInGroup.map((s) => ({
        studentId: s.studentId,
        total: totals.get(s.studentId) || 0,
      }));

      scores.sort((a, b) => b.total - a.total);
      let rank = 1;
      for (let i = 0; i < scores.length; i++) {
        if (i > 0 && scores[i].total < scores[i - 1].total) rank++;
        if (scores[i].studentId === studentId) break;
      }
      return { group: gs.group, rank, totalInGroup: allInGroup.length };
    });

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
   * Guruh leaderboardi — guruhdagi barcha o'quvchilar
   */
  async getGroupLeaderboard(
    groupId: string
  ): Promise<Array<{ name: string; score: number; rank: number }>> {
    const groupStudents = await prisma.groupStudent.findMany({
      where: { groupId },
      include: { student: { select: { id: true, fullName: true } } },
    });

    // Guruhdagi barcha ballar — bitta guruhlangan so'rovda
    // (ilgari har bir o'quvchi uchun alohida so'rov ketardi)
    const grouped = groupStudents.length
      ? await prisma.submission.groupBy({
          by: ['studentId'],
          where: { studentId: { in: groupStudents.map((gs) => gs.studentId) }, groupId, status: 'checked' },
          _sum: { score: true },
        })
      : [];
    const scoreByStudent = new Map(grouped.map((row) => [row.studentId, row._sum.score || 0]));

    const scores = groupStudents.map((gs) => ({
      name: gs.student.fullName,
      studentId: gs.studentId,
      score: scoreByStudent.get(gs.studentId) || 0,
    }));

    scores.sort((a, b) => b.score - a.score);
    return scores.map((s, i) => ({ ...s, rank: i + 1 }));
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
   * Bildirishnoma sozlamalarini olish — hozir faol (oxirgi ko'rilgan) farzand uchun
   */
  async getNotificationSettings(telegramId: number) {
    return prisma.telegramLink.findFirst({
      where: { telegramId: BigInt(telegramId) },
      orderBy: { lastActiveAt: 'desc' },
      select: {
        notifyOnCheck: true,
        notifyOnRank: true,
        notifyWeekly: true,
        notifyInactivity: true,
      },
    });
  }

  /**
   * Bildirishnoma sozlamalarini yangilash — hozir faol farzand uchun
   */
  async updateNotificationSettings(
    telegramId: number,
    field: 'notifyOnCheck' | 'notifyOnRank' | 'notifyWeekly' | 'notifyInactivity',
    value: boolean
  ) {
    const active = await prisma.telegramLink.findFirst({
      where: { telegramId: BigInt(telegramId) },
      orderBy: { lastActiveAt: 'desc' },
    });
    if (!active) return null;

    return prisma.telegramLink.update({
      where: { id: active.id },
      data: { [field]: value },
      select: {
        notifyOnCheck: true,
        notifyOnRank: true,
        notifyWeekly: true,
        notifyInactivity: true,
      },
    });
  }

  // ============ GURUH TELEGRAM CHATI ============

  /**
   * /ulash <kod> — guruh Telegram chatini saytda yaratilgan kod bilan bog'lash.
   * O'qituvchi botni guruh chatiga qo'shadi (admin qilish shart emas) va shu buyruqni yozadi.
   */
  async linkGroupChatByCode(
    code: string,
    chatId: number,
    chatTitle?: string
  ): Promise<{ success: boolean; groupName?: string }> {
    const normalized = code.trim();
    const group = await prisma.group.findFirst({
      where: {
        chatLinkCode: normalized,
        chatLinkCodeExpiresAt: { gt: new Date() },
      },
    });

    if (!group) return { success: false };

    await prisma.group.update({
      where: { id: group.id },
      data: {
        telegramChatId: BigInt(chatId),
        telegramChatTitle: chatTitle,
        chatLinkCode: null,
        chatLinkCodeExpiresAt: null,
      },
    });

    return { success: true, groupName: group.name };
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
   * /admin orqali bog'langan barcha rahbar chat ID lari (kuniga 20:00 sustlik hisoboti uchun)
   */
  async getAdminChatIds(): Promise<bigint[]> {
    const links = await prisma.telegramLink.findMany({
      where: { role: 'admin', isActive: true },
      select: { chatId: true },
    });
    return links.map((l) => l.chatId);
  }

  /**
   * O'quvchiga BIRIKTIRILGAN normativlar soni va u qanchasini topshirgani.
   *
   * "Biriktirilgan" hisobi o'quvchining o'z sahifasidagi ro'yxat bilan bir xil
   * bo'lishi shart, aks holda ota-onaga boshqa raqam ketadi:
   *   guruhiga biriktirilgan normativlar  ∪  o'zi allaqachon topshirganlari.
   * Guruhga hech narsa biriktirilmagan bo'lsa — barcha faol normativlar.
   *
   * Hammasi bitta o'tishda hisoblanadi (o'quvchi boshiga alohida so'rov yo'q).
   */
  async getNormativeProgress(studentIds: string[]): Promise<
    Map<string, { assigned: number; submitted: number; checked: number }>
  > {
    const result = new Map<string, { assigned: number; submitted: number; checked: number }>();
    if (studentIds.length === 0) return result;

    const [groupLinks, submissions, activeNormatives] = await Promise.all([
      prisma.groupStudent.findMany({
        where: { studentId: { in: studentIds } },
        select: { studentId: true, groupId: true },
      }),
      prisma.submission.findMany({
        where: { studentId: { in: studentIds } },
        select: { studentId: true, normativeId: true, status: true },
      }),
      prisma.normative.findMany({ where: { isActive: true }, select: { id: true } }),
    ]);

    const groupIds = [...new Set(groupLinks.map((g) => g.groupId))];
    const groupNormatives = groupIds.length
      ? await prisma.groupNormative.findMany({
          where: { groupId: { in: groupIds }, normative: { isActive: true } },
          select: { groupId: true, normativeId: true },
        })
      : [];

    const normsByGroup = new Map<string, string[]>();
    for (const gn of groupNormatives) {
      const list = normsByGroup.get(gn.groupId);
      if (list) list.push(gn.normativeId);
      else normsByGroup.set(gn.groupId, [gn.normativeId]);
    }

    const groupsByStudent = new Map<string, string[]>();
    for (const g of groupLinks) {
      const list = groupsByStudent.get(g.studentId);
      if (list) list.push(g.groupId);
      else groupsByStudent.set(g.studentId, [g.groupId]);
    }

    const subsByStudent = new Map<string, { normativeId: string; status: string }[]>();
    for (const sub of submissions) {
      const list = subsByStudent.get(sub.studentId);
      if (list) list.push(sub);
      else subsByStudent.set(sub.studentId, [sub]);
    }

    const allActiveIds = activeNormatives.map((n) => n.id);

    for (const studentId of studentIds) {
      const subs = subsByStudent.get(studentId) || [];
      const assigned = new Set<string>();

      for (const groupId of groupsByStudent.get(studentId) || []) {
        for (const nid of normsByGroup.get(groupId) || []) assigned.add(nid);
      }
      // O'zi topshirgan normativ ham ro'yxatda ko'rinadi
      for (const sub of subs) assigned.add(sub.normativeId);

      // Guruhga hech narsa biriktirilmagan va topshiriq ham yo'q — barcha faollar
      if (assigned.size === 0) for (const nid of allActiveIds) assigned.add(nid);

      const submittedIds = new Set(subs.map((sub) => sub.normativeId));
      const checkedIds = new Set(
        subs.filter((sub) => sub.status === 'checked').map((sub) => sub.normativeId)
      );

      result.set(studentId, {
        assigned: assigned.size,
        submitted: submittedIds.size,
        checked: checkedIds.size,
      });
    }

    return result;
  }

  /**
   * N kundan beri yangi topshiriq bermagan o'quvchilar va ularning ota-onalari.
   *
   * Diqqat: "yangi topshiriq yo'q" hali "ishlamayapti" degani emas — barcha
   * normativini tugatgan o'quvchida ham yangi topshiriq bo'lmaydi. Shuning uchun
   * bu yerda normativ holati ham qaytariladi va xabar matni shunga qarab tanlanadi.
   */
  async getInactiveStudentParents(days = 3): Promise<Array<{
    studentId: string;
    studentName: string;
    links: Array<{ id: string; chatId: bigint; completionCongratsAt: Date | null }>;
    assigned: number;
    submitted: number;
    checked: number;
    daysSinceLastSubmission: number;
  }>> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const links = await prisma.telegramLink.findMany({
      where: { role: 'parent', isActive: true, notifyInactivity: true },
      select: { id: true, studentId: true, chatId: true, completionCongratsAt: true },
    });
    if (links.length === 0) return [];

    const linksByStudent = new Map<string, typeof links>();
    for (const l of links) {
      const list = linksByStudent.get(l.studentId);
      if (list) list.push(l);
      else linksByStudent.set(l.studentId, [l]);
    }

    const studentIds = [...linksByStudent.keys()];

    const [students, lastSubs, progress] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, fullName: true },
      }),
      prisma.submission.groupBy({
        by: ['studentId'],
        where: { studentId: { in: studentIds } },
        _max: { submittedAt: true },
      }),
      this.getNormativeProgress(studentIds),
    ]);

    const nameById = new Map(students.map((st) => [st.id, st.fullName]));
    const lastByStudent = new Map(lastSubs.map((r) => [r.studentId, r._max.submittedAt]));

    const result = [];
    for (const studentId of studentIds) {
      const fullName = nameById.get(studentId);
      if (!fullName) continue;

      const last = lastByStudent.get(studentId) || null;
      if (last && last >= cutoff) continue; // yaqinda topshirgan — eslatma kerak emas

      const p = progress.get(studentId) || { assigned: 0, submitted: 0, checked: 0 };

      result.push({
        studentId,
        studentName: fullName,
        links: linksByStudent.get(studentId)!,
        assigned: p.assigned,
        submitted: p.submitted,
        checked: p.checked,
        daysSinceLastSubmission: last
          ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000)
          : -1, // hech qachon topshirmagan
      });
    }

    return result;
  }

  /** Tabrik yuborilganini belgilash — har kuni takrorlanmasligi uchun */
  async markCompletionCongrats(linkIds: string[]): Promise<void> {
    if (linkIds.length === 0) return;
    await prisma.telegramLink.updateMany({
      where: { id: { in: linkIds } },
      data: { completionCongratsAt: new Date() },
    });
  }

  /** Yangi normativ qo'shilib, o'quvchi yana "tugatmagan" holatga o'tsa — tabrik qayta ochiladi */
  async resetCompletionCongrats(studentIds: string[]): Promise<void> {
    if (studentIds.length === 0) return;
    await prisma.telegramLink.updateMany({
      where: { studentId: { in: studentIds }, completionCongratsAt: { not: null } },
      data: { completionCongratsAt: null },
    });
  }

  /**
   * Davr statistikasi (normativlar) — standart 7 kun (haftalik hisobot uchun ishlatiladi)
   */
  async getWeeklyStats(studentId: string, days: number = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const subs = await prisma.submission.findMany({
      where: { studentId, submittedAt: { gte: since }, status: 'checked' },
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

  /**
   * O'quvchining rasmiy imtihon natijalari (bot "🏆 Imtihonlar" tugmasi uchun)
   */
  async getStudentExamResults(studentId: string) {
    const participants = await prisma.examParticipant.findMany({
      where: { studentId, status: { in: ['submitted', 'timeout'] } },
      include: {
        exam: {
          select: { title: true, maxTestScore: true, maxAiScore: true, maxProjectScore: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return participants.map((p) => ({
      title: p.exam.title,
      maxScore: p.exam.maxTestScore + p.exam.maxAiScore + p.exam.maxProjectScore,
      totalScore: p.totalScore,
      testScore: p.testScore,
      graded: p.gradedAt !== null,
      submittedAt: p.submittedAt,
    }));
  }

  // ============ OTA-ONALAR BAZASI ============

  /**
   * Barcha faol o'quvchilar + ota-ona botga ulanganmi (qamrov ro'yxati)
   */
  async getParentCoverage(filters?: { groupId?: string; teacherId?: string }) {
    const students = await prisma.user.findMany({
      where: {
        role: 'student',
        isActive: true,
        groupStudents: filters?.groupId || filters?.teacherId
          ? {
              some: {
                ...(filters.groupId ? { groupId: filters.groupId } : {}),
                ...(filters.teacherId ? { group: { teacherId: filters.teacherId } } : {}),
              },
            }
          : undefined,
      },
      include: {
        groupStudents: {
          include: { group: { include: { teacher: { select: { fullName: true } } } } },
          orderBy: { joinedAt: 'desc' },
          take: 1,
        },
        telegramLinks: {
          where: { role: 'parent', isActive: true },
          select: { fullName: true, username: true, createdAt: true },
          take: 1,
        },
      },
      orderBy: { fullName: 'asc' },
    });

    const rows = students.map((s) => ({
      id: s.id,
      fullName: s.fullName,
      groupId: s.groupStudents[0]?.group?.id || null,
      groupName: s.groupStudents[0]?.group?.name || null,
      teacherName: s.groupStudents[0]?.group?.teacher?.fullName || null,
      linked: s.telegramLinks.length > 0,
      parentName: s.telegramLinks[0]?.fullName || null,
      parentUsername: s.telegramLinks[0]?.username || null,
      linkedAt: s.telegramLinks[0]?.createdAt || null,
    }));

    const linkedCount = rows.filter((r) => r.linked).length;
    return {
      students: rows,
      total: rows.length,
      linkedCount,
      coveragePercent: rows.length > 0 ? Math.round((linkedCount / rows.length) * 100) : 0,
    };
  }

  /**
   * Ommaviy xabar uchun qabul qiluvchilar ro'yxati (faqat ulangan ota-onalar)
   */
  async getBroadcastRecipients(filters?: { groupId?: string; teacherId?: string; studentIds?: string[] }) {
    return prisma.telegramLink.findMany({
      where: {
        role: 'parent',
        isActive: true,
        student: filters?.studentIds
          ? { id: { in: filters.studentIds } }
          : filters?.groupId || filters?.teacherId
            ? {
                groupStudents: {
                  some: {
                    ...(filters.groupId ? { groupId: filters.groupId } : {}),
                    ...(filters.teacherId ? { group: { teacherId: filters.teacherId } } : {}),
                  },
                },
              }
            : undefined,
      },
      select: { id: true, chatId: true, student: { select: { fullName: true } } },
    });
  }
}

export default new BotService();
