import prisma from '../../config/database';
import logger from '../../shared/utils/logger';
import { generateText, getAISettings } from '../../shared/utils/ai';
import TelegramBot from 'node-telegram-bot-api';

let botInstance: InstanceType<typeof TelegramBot> | null = null;

export function setReportBotInstance(bot: InstanceType<typeof TelegramBot>) {
  botInstance = bot;
}

/**
 * Markazning bugungi ta'lim ko'rsatkichlarini bazadan to'plash
 */
export async function fetchEducationalMetrics() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 1. Faol guruhlar va ustozlar
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

  // 2. Bugungi topshiriqlar (Submissions)
  const todaySubmissions = await prisma.submission.findMany({
    where: { submittedAt: { gte: todayStart } },
    include: {
      student: { select: { id: true, fullName: true } },
      group: { select: { id: true, name: true, teacherId: true } },
      normative: { select: { title: true, maxScore: true } }
    }
  });

  // 3. Jami va faolsiz muzlatilganlar
  const activeFreezes = await prisma.studentFreeze.findMany({
    where: { status: 'frozen' },
    include: {
      student: { select: { fullName: true } },
      group: { select: { name: true } }
    }
  });

  // 4. Imtihonlar (Bugungi yoki so'nggi topshirishlar)
  const recentExamParticipants = await prisma.examParticipant.findMany({
    where: {
      submittedAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } // oxirgi 24 soat
    },
    include: {
      student: { select: { id: true, fullName: true } },
      group: { select: { id: true, name: true } },
      exam: { select: { id: true, title: true, createdBy: { select: { fullName: true } } } }
    },
    orderBy: { submittedAt: 'desc' }
  });

  // 5. O'qituvchilar miqyosida statistika
  const teacherStatsMap = new Map<string, {
    teacherName: string;
    groupCount: number;
    studentCount: number;
    todaySubmissionsCount: number;
    checkedGreen: number;
    checkedBlue: number;
    checkedRed: number;
    examPassedCount: number;
    examFailedCount: number;
  }>();

  groups.forEach(g => {
    const tName = g.teacher?.fullName || 'Tayinlanmagan';
    if (!teacherStatsMap.has(tName)) {
      teacherStatsMap.set(tName, {
        teacherName: tName,
        groupCount: 0,
        studentCount: 0,
        todaySubmissionsCount: 0,
        checkedGreen: 0,
        checkedBlue: 0,
        checkedRed: 0,
        examPassedCount: 0,
        examFailedCount: 0,
      });
    }
    const stat = teacherStatsMap.get(tName)!;
    stat.groupCount += 1;
    stat.studentCount += g.groupStudents.length;
  });

  // Topshiriqlarni ustozlar kesimida taqsimlash
  todaySubmissions.forEach(sub => {
    const group = groups.find(g => g.id === sub.groupId);
    const tName = group?.teacher?.fullName || 'Tayinlanmagan';
    if (teacherStatsMap.has(tName)) {
      const stat = teacherStatsMap.get(tName)!;
      stat.todaySubmissionsCount += 1;
      if (sub.result === 'green') stat.checkedGreen += 1;
      else if (sub.result === 'blue') stat.checkedBlue += 1;
      else if (sub.result === 'red') stat.checkedRed += 1;
    }
  });

  // Imtihonlar yiqilgan va o'tganlar tahlili
  const failedStudents: any[] = [];
  const passedStudents: any[] = [];

  recentExamParticipants.forEach(p => {
    const score = p.totalScore ?? 0;
    const isPass = score >= 50; // 50+ ball o'tgan
    const tName = p.exam?.createdBy?.fullName || 'Tayinlanmagan';

    if (isPass) {
      passedStudents.push({
        studentName: p.student?.fullName,
        examTitle: p.exam?.title,
        groupName: p.group?.name,
        score,
        teacherName: tName,
      });
      if (teacherStatsMap.has(tName)) teacherStatsMap.get(tName)!.examPassedCount += 1;
    } else {
      failedStudents.push({
        studentName: p.student?.fullName,
        examTitle: p.exam?.title,
        groupName: p.group?.name,
        score,
        teacherName: tName,
      });
      if (teacherStatsMap.has(tName)) teacherStatsMap.get(tName)!.examFailedCount += 1;
    }
  });

  // Bugungi faol va orqada qolayotgan guruhlarni aniqlash
  const activeGroupIds = new Set(todaySubmissions.map(s => s.groupId));
  const activeGroups = groups.filter(g => activeGroupIds.has(g.id));
  const laggingGroups = groups.filter(g => !activeGroupIds.has(g.id) || g.groupStudents.length === 0);

  return {
    date: todayStart.toLocaleDateString('uz-UZ'),
    time: now.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }),
    totalActiveGroupsCount: groups.length,
    totalStudentsCount: groups.reduce((acc, g) => acc + g.groupStudents.length, 0),
    todaySubmissionsCount: todaySubmissions.length,
    todayActiveGroupsCount: activeGroups.length,
    todayLaggingGroupsCount: laggingGroups.length,
    activeGroupsList: activeGroups.map(g => ({ name: g.name, teacher: g.teacher?.fullName, students: g.groupStudents.length })),
    laggingGroupsList: laggingGroups.slice(0, 10).map(g => ({ name: g.name, teacher: g.teacher?.fullName, students: g.groupStudents.length })),
    teacherStats: Array.from(teacherStatsMap.values()),
    activeFreezesCount: activeFreezes.length,
    frozenStudentsSample: activeFreezes.slice(0, 5).map(f => ({ student: f.student.fullName, group: f.group.name })),
    recentExamCount: recentExamParticipants.length,
    examPassedCount: passedStudents.length,
    examFailedCount: failedStudents.length,
    failedStudents,
    passedStudents,
  };
}

/**
 * Gemini AI orqali har kuni 13:00 va 17:00 da batafsil ta'lim hisobotini yaratish
 */
export async function generateEducationalAIReport(timeLabel: string): Promise<string> {
  const metrics = await fetchEducationalMetrics();
  const { apiKey } = getAISettings();

  const prompt = `Sen "ILS - IT Live" O'quv markazining Bosh ta'lim analitigi va Sun'iy Intellekt Assistentisan.
Bugun (${metrics.date}, vaqt: ${metrics.time}) markazdagi ${timeLabel} holati bo'yicha quyidagi haqiqiy ko'rsatkichlar to'plangan:

TA'LIM STATISTIKA MA'LUMOTLARI:
- Jami faol guruhlar: ${metrics.totalActiveGroupsCount} ta
- Jami o'quvchilar soni: ${metrics.totalStudentsCount} ta
- Bugun topshirilgan normativlar (vazifalar): ${metrics.todaySubmissionsCount} ta
- Bugun vazifa topshirgan aktiv guruhlar: ${metrics.todayActiveGroupsCount} ta
- Bugun vazifa topshirmagan/sust guruhlar: ${metrics.todayLaggingGroupsCount} ta
- Muzlatilgan (ketib qolgan) o'quvchilar: ${metrics.activeFreezesCount} ta

O'QITUVCHILAR BO'YICHA STATISTIKA:
${JSON.stringify(metrics.teacherStats, null, 2)}

SUST VA ORQADA QOLAYOTGAN GURUHLAR:
${JSON.stringify(metrics.laggingGroupsList, null, 2)}

IMTIHONLAR NATIJASI (Oxirgi 24 soat):
- Imtihonda qatnashgan o'quvchilar: ${metrics.recentExamCount} ta
- Imtihondan o'tganlar (>=50 ball): ${metrics.examPassedCount} ta
- Imtihondan yiqilganlar (<50 ball): ${metrics.examFailedCount} ta
- YIQILGAN O'QUVCHILAR RO'YXATI: ${JSON.stringify(metrics.failedStudents, null, 2)}

VAZIFA:
Yuqoridagi ma'lumotlar asosida Rahbar (Admin) uchun Telegramda qulay o'qiladigan, nihoyatda tushunarli, chuqur tahliliy va ko'rkam HISOBOT yozib ber.

HISOBOT QUYIDAGI 5 TA BO'LIMGA BO'LINSIN:
1. 📊 **UMUMIY TA'LIM VA GURUHLAR HOLATI** (Bugungi faol va orqada qolayotgan guruhlar)
2. 👨‍🏫 **O'QITUVCHILAR KESIMIDAGI TAHLIL** (A'lo va sust ishlayotgan ustozlar)
3. 📋 **IMTIHONLAR VA YIQILGAN O'QUVCHILAR** (Bugungi imtihon natijalari va yiqilgan o'quvchilar ro'yxati)
4. ⚠️ **MUAMMO VA XAVFLAR** (Muzlash xavfi bor guruhlar)
5. 💡 **AI TAVSIYALARI VA RAHBAR UCHUN HARAKAT REJASI** (3-5 ta amaliy va ta'sirchan tavsiya)

QOIDALAR:
- O'zbek tilida, samimiy va professional ohangda yoz.
- Emojilardan unumli va ko'rkam foydalan.
- Markdown belgilardan mutlaqo foydalanma (*, **, # belgilarini ishlatma, shunchaki har bir sarlavha va matnni toza yoz).
- Yiqilgan o'quvchilar bo'lsa, ularni ismi va guruhi bilan ko'rsat.`;

  if (apiKey) {
    try {
      const aiResponse = await generateText(prompt, 3000, 0.7, true);
      return `📢 **O'QUV MARKAZ TA'LIMI BO'YICHA KUNLIK AI HISOBOT**\n🕒 *Vaqt: ${metrics.time} (${timeLabel})*\n📅 *Sana: ${metrics.date}*\n\n${aiResponse}`;
    } catch (err: any) {
      logger.error('AI Report Generation Error:', err);
    }
  }

  // Fallback if AI Key is not configured
  return `📢 O'QUV MARKAZ TA'LIMI BO'YICHA KUNLIK HISOBOT
🕒 Vaqt: ${metrics.time} (${timeLabel})
📅 Sana: ${metrics.date}

📊 1. UMUMIY HOLAT:
- Jami faol guruhlar: ${metrics.totalActiveGroupsCount} ta
- Jami o'quvchilar: ${metrics.totalStudentsCount} ta
- Bugungi topshiriqlar: ${metrics.todaySubmissionsCount} ta
- Bugun faol guruhlar: ${metrics.todayActiveGroupsCount} ta
- Sust guruhlar: ${metrics.todayLaggingGroupsCount} ta

👨‍🏫 2. O'QITUVCHILAR STATISTIKASI:
${metrics.teacherStats.map(t => `• ${t.teacherName}: ${t.groupCount} ta guruh, ${t.todaySubmissionsCount} ta vazifa`).join('\n')}

📋 3. IMTIHONLAR NATIJASI:
- Imtihon topshirganlar: ${metrics.recentExamCount} ta
- O'tganlar (>=50 ball): ${metrics.examPassedCount} ta
- Yiqilganlar (<50 ball): ${metrics.examFailedCount} ta
${metrics.failedStudents.length > 0 ? `❌ Yiqilganlar: ${metrics.failedStudents.map(f => `${f.studentName} (${f.groupName})`).join(', ')}` : '✅ Yiqilgan o'quvchilar yo'q'}

⚠️ 4. SUST GURUHLAR:
${metrics.laggingGroupsList.slice(0, 5).map(g => `• ${g.name} (${g.teacher})`).join('\n')}

💡 5. AI TAVSIYASI:
(AI API key sozlanganda chuqur AI tahlili yaratiladi)`;
}

/**
 * Telegram orqali barcha Admin/Operatorlarga hisobotni yuborish
 */
export async function sendDailyAIReport(timeLabel: string = 'Kunlik Hisobot') {
  try {
    const reportText = await generateEducationalAIReport(timeLabel);

    if (!botInstance) {
      logger.warn('Bot instansi mavjud emas — AI Hisobot faqat log qilindi');
      return reportText;
    }

    // Admin va Operator chat ID larini bazadan olish
    const adminLinks = await prisma.telegramLink.findMany({
      where: { isActive: true, role: { in: ['admin', 'operator'] } },
      select: { chatId: true }
    });

    if (adminLinks.length === 0) {
      logger.warn('AI Hisobot uchun birorta ham bog\'langan Admin Telegram chat ID topilmadi');
      return reportText;
    }

    // Har bir adminga xabar yuborish
    for (const link of adminLinks) {
      try {
        // Telegram xabari 4096 belgidan oshsa, bo'laklab yuboriladi
        if (reportText.length > 4000) {
          const part1 = reportText.substring(0, 4000);
          const part2 = reportText.substring(4000);
          await botInstance.sendMessage(Number(link.chatId), part1);
          await botInstance.sendMessage(Number(link.chatId), part2);
        } else {
          await botInstance.sendMessage(Number(link.chatId), reportText);
        }
      } catch (err: any) {
        logger.error(`AI Hisobot yuborishda xatolik (chatId=${link.chatId}):`, err.message);
      }
    }

    logger.info(`🤖 AI Ta'lim hisoboti ${adminLinks.length} ta adminga muvaffaqiyatli yuborildi (${timeLabel})`);
    return reportText;
  } catch (err: any) {
    logger.error('sendDailyAIReport xatosi:', err);
    throw err;
  }
}
