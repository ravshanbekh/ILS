import prisma from '../../config/database';
import logger from '../../shared/utils/logger';
import { generateText, getAISettings } from '../../shared/utils/ai';
import TelegramBot from 'node-telegram-bot-api';

let botInstance: InstanceType<typeof TelegramBot> | null = null;

export function setReportBotInstance(bot: InstanceType<typeof TelegramBot>) {
  botInstance = bot;
}

// ─── 8 bo'limli batafsil ta'lim metrikalarini yig'ish ──────────────────────
export async function fetchEducationalMetrics() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

  // ═══════════ 1. GURUHLAR VA O'QITUVCHILAR ═══════════
  const groups = await prisma.group.findMany({
    where: { isActive: true },
    include: {
      teacher: { select: { id: true, fullName: true } },
      groupStudents: {
        include: {
          student: { select: { id: true, fullName: true, isActive: true } }
        }
      }
    }
  });

  const allTeachers = await prisma.user.findMany({
    where: { role: 'teacher', isActive: true },
    select: { id: true, fullName: true }
  });

  // ═══════════ 2. BUGUNGI TOPSHIRIQLAR (NORMATIVLAR) ═══════════
  const todaySubmissions = await prisma.submission.findMany({
    where: { submittedAt: { gte: todayStart } },
    include: {
      student: { select: { id: true, fullName: true } },
      group: { select: { id: true, name: true, teacherId: true } },
      normative: { select: { title: true, maxScore: true, taskNumber: true } }
    }
  });

  const checkedToday = todaySubmissions.filter(s => s.status === 'checked');
  const pendingToday = todaySubmissions.filter(s => s.status === 'pending');
  const greenCount = checkedToday.filter(s => s.result === 'green').length;
  const blueCount = checkedToday.filter(s => s.result === 'blue').length;
  const redCount = checkedToday.filter(s => s.result === 'red').length;

  // ═══════════ 3. IMTIHON NATIJALARI (Oxirgi 24 soat) ═══════════
  const recentExamParticipants = await prisma.examParticipant.findMany({
    where: {
      submittedAt: { gte: yesterday }
    },
    include: {
      student: { select: { id: true, fullName: true } },
      group: { select: { id: true, name: true } },
      exam: { select: { id: true, title: true, createdBy: { select: { fullName: true } } } }
    },
    orderBy: { submittedAt: 'desc' }
  });

  const passedExam: any[] = [];
  const failedExam: any[] = [];

  recentExamParticipants.forEach(p => {
    const score = p.totalScore ?? 0;
    const entry = {
      studentName: p.student?.fullName || 'Nomalum',
      examTitle: p.exam?.title || '',
      groupName: p.group?.name || '',
      score,
      teacherName: p.exam?.createdBy?.fullName || 'Nomalum',
    };
    if (score >= 50) passedExam.push(entry);
    else failedExam.push(entry);
  });

  // ═══════════ 4. LIVE QUIZ NATIJALARI (Oxirgi 24 soat) ═══════════
  const recentQuizResults = await prisma.liveQuizResult.findMany({
    where: { updatedAt: { gte: yesterday } },
    include: {
      teacher: { select: { fullName: true } },
      quiz: { select: { title: true, groupId: true } }
    },
    orderBy: { updatedAt: 'desc' },
    take: 20
  });

  const quizStats = recentQuizResults.map(r => {
    const leaderboard = (r.leaderboard as any[]) || [];
    const scores = leaderboard.map((p: any) => p.score || 0);
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0;
    const topPlayer = leaderboard.length > 0 ? leaderboard[0] : null;
    return {
      quizTitle: r.quizTitle || r.quiz?.title || 'Nomalum',
      teacherName: r.teacher?.fullName || 'Nomalum',
      totalPlayers: r.totalPlayers,
      avgScore,
      topPlayerName: topPlayer?.fullName || '-',
      topPlayerScore: topPlayer?.score || 0,
    };
  });

  // ═══════════ 5. O'QITUVCHILAR KESIMIDAGI STATISTIKA ═══════════
  const teacherStatsMap = new Map<string, {
    teacherName: string;
    groupCount: number;
    studentCount: number;
    todaySubmissions: number;
    greenCount: number;
    blueCount: number;
    redCount: number;
    pendingCount: number;
    examPassedCount: number;
    examFailedCount: number;
    quizCount: number;
  }>();

  // Initialize from all teachers
  allTeachers.forEach(t => {
    teacherStatsMap.set(t.id, {
      teacherName: t.fullName,
      groupCount: 0,
      studentCount: 0,
      todaySubmissions: 0,
      greenCount: 0,
      blueCount: 0,
      redCount: 0,
      pendingCount: 0,
      examPassedCount: 0,
      examFailedCount: 0,
      quizCount: 0,
    });
  });

  groups.forEach(g => {
    const tId = g.teacherId;
    if (tId && teacherStatsMap.has(tId)) {
      const stat = teacherStatsMap.get(tId)!;
      stat.groupCount += 1;
      stat.studentCount += g.groupStudents.length;
    }
  });

  todaySubmissions.forEach(sub => {
    const group = groups.find(g => g.id === sub.groupId);
    const tId = group?.teacherId;
    if (tId && teacherStatsMap.has(tId)) {
      const stat = teacherStatsMap.get(tId)!;
      stat.todaySubmissions += 1;
      if (sub.status === 'checked') {
        if (sub.result === 'green') stat.greenCount += 1;
        else if (sub.result === 'blue') stat.blueCount += 1;
        else if (sub.result === 'red') stat.redCount += 1;
      } else {
        stat.pendingCount += 1;
      }
    }
  });

  // Imtihon natijalarini o'qituvchilarga ulash
  recentExamParticipants.forEach(p => {
    const tId = allTeachers.find(t => t.fullName === p.exam?.createdBy?.fullName)?.id;
    if (tId && teacherStatsMap.has(tId)) {
      const stat = teacherStatsMap.get(tId)!;
      const score = p.totalScore ?? 0;
      if (score >= 50) stat.examPassedCount += 1;
      else stat.examFailedCount += 1;
    }
  });

  // Quiz natijalarini o'qituvchilarga ulash
  recentQuizResults.forEach(r => {
    const tId = allTeachers.find(t => t.fullName === r.teacher?.fullName)?.id;
    if (tId && teacherStatsMap.has(tId)) {
      teacherStatsMap.get(tId)!.quizCount += 1;
    }
  });

  const teacherStats = Array.from(teacherStatsMap.values()).sort((a, b) => b.todaySubmissions - a.todaySubmissions);

  // ═══════════ 6. FAOL VA SUST GURUHLAR ═══════════
  const activeGroupIds = new Set(todaySubmissions.map(s => s.groupId));
  const activeGroups = groups.filter(g => activeGroupIds.has(g.id));
  const laggingGroups = groups.filter(g => !activeGroupIds.has(g.id));

  // ═══════════ 7. MUZLATILGANLAR VA XAVF ═══════════
  const activeFreezes = await prisma.studentFreeze.findMany({
    take: 15,
    orderBy: { createdAt: 'desc' }
  });

  // Oxirgi 7 kunda topshiriq topshirmagan o'quvchilar
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const allStudentIds = groups.flatMap(g => g.groupStudents.map(gs => gs.studentId));
  const recentSubmitterIds = await prisma.submission.findMany({
    where: { studentId: { in: allStudentIds }, submittedAt: { gte: weekAgo } },
    select: { studentId: true },
    distinct: ['studentId']
  });
  const recentSet = new Set(recentSubmitterIds.map(s => s.studentId));
  const inactiveStudents = allStudentIds.filter(id => !recentSet.has(id));

  // ═══════════ 8. UMUMIY RAQAMLAR ═══════════
  const totalStudents = await prisma.user.count({ where: { role: 'student', isActive: true } });

  return {
    date: todayStart.toLocaleDateString('uz-UZ'),
    time: now.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }),
    // Bo'lim 1: Umumiy
    totalActiveGroupsCount: groups.length,
    totalStudentsCount: totalStudents,
    totalTeachersCount: allTeachers.length,
    // Bo'lim 2: O'qituvchilar
    teacherStats,
    // Bo'lim 3: Guruhlar faolligi
    todayActiveGroupsCount: activeGroups.length,
    todayLaggingGroupsCount: laggingGroups.length,
    activeGroupsList: activeGroups.map(g => ({ name: g.name, teacher: g.teacher?.fullName, students: g.groupStudents.length })),
    laggingGroupsList: laggingGroups.slice(0, 10).map(g => ({ name: g.name, teacher: g.teacher?.fullName, students: g.groupStudents.length })),
    // Bo'lim 4: Topshiriqlar
    todaySubmissionsCount: todaySubmissions.length,
    checkedCount: checkedToday.length,
    pendingCount: pendingToday.length,
    greenCount,
    blueCount,
    redCount,
    // Bo'lim 5: Imtihonlar
    recentExamCount: recentExamParticipants.length,
    examPassedCount: passedExam.length,
    examFailedCount: failedExam.length,
    passedExam: passedExam.slice(0, 10),
    failedExam: failedExam.slice(0, 10),
    // Bo'lim 6: Live Quiz
    quizCount: recentQuizResults.length,
    quizStats: quizStats.slice(0, 10),
    // Bo'lim 7: Xavflar
    activeFreezesCount: activeFreezes.length,
    frozenStudentsSample: activeFreezes.slice(0, 5).map(f => ({ student: f.studentName, group: f.groupName })),
    inactiveStudentsCount: inactiveStudents.length,
  };
}

// ─── Fallback hisobot (AI yo'q bo'lganda) ──────────────────────────────────
function buildFallbackReport(metrics: Awaited<ReturnType<typeof fetchEducationalMetrics>>, timeLabel: string): string {
  const lines: string[] = [];

  lines.push(`📢 O'QUV MARKAZ TA'LIMI BO'YICHA KUNLIK HISOBOT`);
  lines.push(`🕒 Vaqt: ${metrics.time} (${timeLabel})`);
  lines.push(`📅 Sana: ${metrics.date}`);
  lines.push('');

  // 1. Umumiy
  lines.push(`📊 1. UMUMIY STATISTIKA`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`🏫 Faol guruhlar: ${metrics.totalActiveGroupsCount} ta`);
  lines.push(`👨‍🎓 Jami o'quvchilar: ${metrics.totalStudentsCount} ta`);
  lines.push(`👨‍🏫 O'qituvchilar: ${metrics.totalTeachersCount} ta`);
  lines.push('');

  // 2. O'qituvchilar
  lines.push(`👨‍🏫 2. O'QITUVCHILAR KESIMI`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  if (metrics.teacherStats.length === 0) {
    lines.push(`Hozircha ma'lumot yo'q`);
  } else {
    metrics.teacherStats.forEach(t => {
      const emoji = t.todaySubmissions > 0 ? '✅' : '⚠️';
      lines.push(`${emoji} ${t.teacherName}`);
      lines.push(`   📚 ${t.groupCount} guruh | 👥 ${t.studentCount} o'quvchi`);
      lines.push(`   📝 Bugun: ${t.todaySubmissions} ta vazifa (🟢${t.greenCount} 🔵${t.blueCount} 🔴${t.redCount})`);
      if (t.examPassedCount > 0 || t.examFailedCount > 0) {
        lines.push(`   🎓 Imtihon: ✅${t.examPassedCount} o'tdi | ❌${t.examFailedCount} yiqildi`);
      }
      if (t.quizCount > 0) {
        lines.push(`   🎯 Quiz: ${t.quizCount} ta o'tkazdi`);
      }
    });
  }
  lines.push('');

  // 3. Guruhlar
  lines.push(`📚 3. GURUHLAR FAOLLIGI`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`✅ Bugun faol: ${metrics.todayActiveGroupsCount} ta`);
  lines.push(`⚠️ Sust: ${metrics.todayLaggingGroupsCount} ta`);
  if (metrics.laggingGroupsList.length > 0) {
    lines.push(`Sust guruhlar:`);
    metrics.laggingGroupsList.slice(0, 5).forEach(g => {
      lines.push(`  ❌ ${g.name} (${g.teacher || 'Nomalum'})`);
    });
  }
  lines.push('');

  // 4. Topshiriqlar
  lines.push(`📋 4. BUGUNGI TOPSHIRIQLAR`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`📝 Jami: ${metrics.todaySubmissionsCount} ta`);
  lines.push(`✅ Tekshirilgan: ${metrics.checkedCount} ta`);
  lines.push(`⏳ Kutilmoqda: ${metrics.pendingCount} ta`);
  lines.push(`🟢 Yashil: ${metrics.greenCount} | 🔵 Ko'k: ${metrics.blueCount} | 🔴 Qizil: ${metrics.redCount}`);
  lines.push('');

  // 5. Imtihonlar
  lines.push(`🎓 5. IMTIHON NATIJALARI (24 soat)`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  if (metrics.recentExamCount === 0) {
    lines.push(`Oxirgi 24 soatda imtihon topshirilmagan`);
  } else {
    lines.push(`📊 Qatnashchilar: ${metrics.recentExamCount} ta`);
    lines.push(`✅ O'tganlar: ${metrics.examPassedCount} ta`);
    lines.push(`❌ Yiqilganlar: ${metrics.examFailedCount} ta`);
    if (metrics.failedExam.length > 0) {
      lines.push(`Yiqilganlar:`);
      metrics.failedExam.forEach(f => {
        lines.push(`  ❌ ${f.studentName} — ${f.examTitle} (${f.score} ball, ${f.groupName})`);
      });
    }
  }
  lines.push('');

  // 6. Live Quiz
  lines.push(`🎯 6. LIVE QUIZ NATIJALARI`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  if (metrics.quizCount === 0) {
    lines.push(`Oxirgi 24 soatda quiz o'tkazilmagan`);
  } else {
    lines.push(`📊 Jami: ${metrics.quizCount} ta quiz`);
    metrics.quizStats.slice(0, 5).forEach(q => {
      lines.push(`  🎮 "${q.quizTitle}" (${q.teacherName})`);
      lines.push(`     👥 ${q.totalPlayers} o'yinchi | O'rtacha: ${q.avgScore} ball`);
      lines.push(`     🏆 Eng yaxshi: ${q.topPlayerName} (${q.topPlayerScore} ball)`);
    });
  }
  lines.push('');

  // 7. Xavflar
  lines.push(`⚠️ 7. XAVF VA MUAMMOLAR`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`❄️ Muzlatilganlar: ${metrics.activeFreezesCount} ta`);
  lines.push(`😴 7 kun faolsiz o'quvchilar: ${metrics.inactiveStudentsCount} ta`);
  if (metrics.frozenStudentsSample.length > 0) {
    metrics.frozenStudentsSample.forEach(f => {
      lines.push(`  ❄️ ${f.student} (${f.group || 'Nomalum guruh'})`);
    });
  }
  lines.push('');

  // 8. Tavsiya
  lines.push(`💡 8. TAVSIYALAR`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  if (metrics.todayLaggingGroupsCount > 3) {
    lines.push(`🔸 ${metrics.todayLaggingGroupsCount} ta guruh bugun sust — o'qituvchilarga eslatma yuboring`);
  }
  if (metrics.inactiveStudentsCount > 5) {
    lines.push(`🔸 ${metrics.inactiveStudentsCount} ta o'quvchi 7 kun davomida faolsiz — ota-onalar bilan bog'laning`);
  }
  if (metrics.examFailedCount > 0) {
    lines.push(`🔸 ${metrics.examFailedCount} ta o'quvchi imtihondan yiqildi — qo'shimcha mashg'ulot rejalashtiring`);
  }
  if (metrics.pendingCount > 5) {
    lines.push(`🔸 ${metrics.pendingCount} ta topshiriq tekshirilmagan — o'qituvchilarga eslatma bering`);
  }
  lines.push(`🔸 AI tomonidan chuqur tahlil uchun admin panelda AI kalitni sozlang`);

  return lines.join('\n');
}

// ─── AI bilan hisobot yaratish ─────────────────────────────────────────────
export async function generateEducationalAIReport(timeLabel: string): Promise<string> {
  const metrics = await fetchEducationalMetrics();
  const { apiKey } = getAISettings();

  if (!apiKey) {
    return buildFallbackReport(metrics, timeLabel);
  }

  const prompt = `Sen "ILS - IT Live" O'quv markazining Bosh ta'lim analitigi va Sun'iy Intellekt Assistentisan.
Bugun (${metrics.date}, vaqt: ${metrics.time}) markazdagi ${timeLabel} holati bo'yicha quyidagi haqiqiy ko'rsatkichlar to'plangan:

UMUMIY STATISTIKA:
- Jami faol guruhlar: ${metrics.totalActiveGroupsCount} ta
- Jami o'quvchilar: ${metrics.totalStudentsCount} ta
- O'qituvchilar: ${metrics.totalTeachersCount} ta

O'QITUVCHILAR BO'YICHA STATISTIKA:
${JSON.stringify(metrics.teacherStats, null, 2)}

GURUHLAR FAOLLIGI:
- Bugun faol guruhlar: ${metrics.todayActiveGroupsCount} ta
- Sust guruhlar: ${metrics.todayLaggingGroupsCount} ta
- Sust guruhlar ro'yxati: ${JSON.stringify(metrics.laggingGroupsList, null, 2)}

BUGUNGI TOPSHIRIQLAR:
- Jami: ${metrics.todaySubmissionsCount} ta
- Tekshirilgan: ${metrics.checkedCount} ta (Yashil: ${metrics.greenCount}, Ko'k: ${metrics.blueCount}, Qizil: ${metrics.redCount})
- Kutilmoqda: ${metrics.pendingCount} ta

IMTIHONLAR (Oxirgi 24 soat):
- Qatnashchilar: ${metrics.recentExamCount} ta
- O'tganlar (>=50): ${metrics.examPassedCount} ta
- Yiqilganlar (<50): ${metrics.examFailedCount} ta
- Yiqilganlar ro'yxati: ${JSON.stringify(metrics.failedExam, null, 2)}

LIVE QUIZ NATIJALARI:
- Jami: ${metrics.quizCount} ta quiz
- Natijalar: ${JSON.stringify(metrics.quizStats, null, 2)}

XAVF VA MUAMMOLAR:
- Muzlatilganlar: ${metrics.activeFreezesCount} ta
- 7 kun faolsiz o'quvchilar: ${metrics.inactiveStudentsCount} ta

VAZIFA:
Yuqoridagi ma'lumotlar asosida Rahbar uchun Telegramda qulay o'qiladigan, tushunarli va chuqur tahliliy HISOBOT yozib ber.

HISOBOT QUYIDAGI 8 TA BO'LIMGA BO'LINSIN:
1. 📊 UMUMIY STATISTIKA (Jami raqamlar va umumiy holat)
2. 👨‍🏫 O'QITUVCHILAR KESIMI (Har bir o'qituvchining faolligi, a'lo va sust ishlayotganlarni ajrat)
3. 📚 GURUHLAR FAOLLIGI (Faol va sust guruhlar, sabablari)
4. 📋 BUGUNGI TOPSHIRIQLAR (Topshirilgan normativlar, natijalar taqsimoti)
5. 🎓 IMTIHON NATIJALARI (Yiqilganlar ro'yxati bilan)
6. 🎯 LIVE QUIZ NATIJALARI (Quiz o'tkazgan o'qituvchilar va natijalar)
7. ⚠️ XAVF VA MUAMMOLAR (Muzlatilganlar, faolsiz o'quvchilar, ketish xavfi)
8. 💡 AI TAVSIYALARI VA HARAKAT REJASI (5 ta aniq amaliy tavsiya)

QOIDALAR:
- O'zbek tilida, professional ohangda yoz.
- Emojilardan unumli foydalan.
- Markdown belgilardan MUTLAQO foydalanma (*, **, #, \` belgilarini ishlatma). Shunchaki toza matn va emojilar bilan yoz.
- Yiqilgan o'quvchilar bo'lsa, ularni ismi, guruhi va balli bilan ko'rsat.
- Hisobot 3000 belgidan oshmasin.`;

  try {
    const aiResponse = await generateText(prompt, 3000, 0.7, true);
    return `📢 O'QUV MARKAZ TA'LIMI BO'YICHA KUNLIK AI HISOBOT\n🕒 Vaqt: ${metrics.time} (${timeLabel})\n📅 Sana: ${metrics.date}\n\n${aiResponse}`;
  } catch (err: any) {
    logger.error('AI Report Generation Error:', err);
    // Fallback: AI ishlamasa ham hisobot yuborilsin
    return buildFallbackReport(metrics, timeLabel);
  }
}

// ─── Hisobotni yuborish ────────────────────────────────────────────────────
export async function sendDailyAIReport(timeLabel: string = 'Kunlik Hisobot', directChatId?: number) {
  try {
    const reportText = await generateEducationalAIReport(timeLabel);

    if (!botInstance) {
      logger.warn('Bot instansi mavjud emas — AI Hisobot faqat log qilindi');
      return reportText;
    }

    // Agar to'g'ridan-to'g'ri chatId berilsa (masalan /report buyrug'i orqali)
    if (directChatId) {
      try {
        await sendLongMessage(botInstance, directChatId, reportText);
      } catch (err: any) {
        logger.error(`AI Hisobot yuborishda xatolik (directChatId=${directChatId}):`, err.message);
      }
      return reportText;
    }

    // Admin va Operator chat ID larini bazadan olish
    const adminLinks = await prisma.telegramLink.findMany({
      where: { isActive: true, role: { in: ['admin', 'operator'] } },
      select: { chatId: true }
    });

    if (adminLinks.length === 0) {
      logger.warn('AI Hisobot uchun birorta ham bog\'langan Admin/Operator topilmadi. /admin buyrug\'i bilan Telegram bog\'lang.');
      return reportText;
    }

    // Har bir adminga xabar yuborish
    for (const link of adminLinks) {
      try {
        await sendLongMessage(botInstance, Number(link.chatId), reportText);
      } catch (err: any) {
        logger.error(`AI Hisobot yuborishda xatolik (chatId=${link.chatId}):`, err.message);
      }
    }

    logger.info(`🤖 AI Ta'lim hisoboti ${adminLinks.length} ta adminga yuborildi (${timeLabel})`);
    return reportText;
  } catch (err: any) {
    logger.error('sendDailyAIReport xatosi:', err);
    throw err;
  }
}

// ─── Helper: Uzun xabarni bo'laklarga bo'lib yuborish ──────────────────────
async function sendLongMessage(bot: InstanceType<typeof TelegramBot>, chatId: number, text: string) {
  if (text.length <= 4000) {
    await bot.sendMessage(chatId, text);
    return;
  }
  // Bo'laklarga bo'lish — yangi qatordan ajratish
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= 4000) {
      chunks.push(remaining);
      break;
    }
    let cutAt = remaining.lastIndexOf('\n', 4000);
    if (cutAt < 1000) cutAt = 4000;
    chunks.push(remaining.substring(0, cutAt));
    remaining = remaining.substring(cutAt);
  }
  for (const chunk of chunks) {
    await bot.sendMessage(chatId, chunk);
    // Rate limit uchun
    await new Promise(r => setTimeout(r, 200));
  }
}
