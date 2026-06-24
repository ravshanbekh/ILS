import TelegramBot from 'node-telegram-bot-api';
type BotInstance = InstanceType<typeof TelegramBot>;
import botService from './bot.service';
import { checkNotificationMessage, inactivityMessage, newFreezeNotificationMessage } from './bot.messages';
import { NotifyCheckPayload, NotifyFreezePayload } from './bot.types';
import logger from '../../shared/utils/logger';
import { generateText, getAISettings } from '../../shared/utils/ai';

let botInstance: BotInstance | null = null;

/** Bot instansini o'rnatish */
export function setBotInstance(bot: BotInstance) {
  botInstance = bot;
}

type SendOpts = Parameters<TelegramBot['sendMessage']>[2];

/** Xavfsiz xabar yuborish (xato bo'lsa log qiladi, ishni to'xtatmaydi) */
async function safeSend(chatId: bigint | number, text: string, options?: SendOpts) {
  if (!botInstance) return;
  try {
    await botInstance.sendMessage(Number(chatId), text, options);
  } catch (err: any) {
    logger.warn(`Bot xabar yuborishda xato (chatId=${chatId}): ${err.message}`);
  }
}

// ============ EVENT-BASED BILDIRISHNOMALAR ============

/**
 * Topshiriq tekshirilganda ota-onalarga xabar yuborish.
 * submissions.service.ts -> check() metodidan chaqiriladi.
 */
export async function notifyParentsOnCheck(studentId: string, submission: {
  normative: { taskNumber: number; title: string; maxScore: number };
  result: string | null;
  score: number;
  comment?: string | null;
}) {
  if (!botInstance) return;

  const chatIds = await botService.getParentChatIds(studentId, 'notifyOnCheck');
  if (chatIds.length === 0) return;

  // Umumiy ball hisoblash
  const prisma = (await import('../../config/database')).default;
  const allChecked = await prisma.submission.findMany({
    where: { studentId, status: 'checked' },
    select: { score: true },
  });
  const totalScore = allChecked.reduce((sum, s) => sum + s.score, 0);

  const payload: NotifyCheckPayload = {
    studentId,
    normativeTaskNumber: submission.normative.taskNumber,
    normativeTitle: submission.normative.title,
    result: submission.result as 'green' | 'blue' | 'red',
    score: submission.score,
    comment: submission.comment,
    totalScore,
  };

  const message = checkNotificationMessage(payload);
  for (const chatId of chatIds) {
    await safeSend(chatId, message, { parse_mode: 'Markdown' });
  }

  logger.info(`Bot: ${chatIds.length} ta ota-onaga natija xabari yuborildi (student: ${studentId})`);
}

/**
 * Yangi muzlatilgan yaratilganda operatorlarga xabar yuborish.
 * freezes.service.ts -> freezeStudent() metodidan chaqiriladi.
 */
export async function notifyOperatorsOnFreeze(freeze: NotifyFreezePayload) {
  if (!botInstance) return;

  const chatIds = await botService.getOperatorChatIds();
  if (chatIds.length === 0) return;

  const message = newFreezeNotificationMessage({
    studentName: freeze.studentName,
    groupName: freeze.groupName,
    reason: freeze.reason,
    phone: freeze.phone,
  });

  for (const chatId of chatIds) {
    await safeSend(chatId, message, { parse_mode: 'Markdown' });
  }

  logger.info(`Bot: ${chatIds.length} ta operatorga yangi freeze xabari yuborildi`);
}

/**
 * Faolsizlik eslatmasi — scheduler tomonidan chaqiriladi.
 */
export async function sendInactivityAlerts() {
  if (!botInstance) return;

  const inactiveStudents = await botService.getInactiveStudentParents(3);
  let count = 0;

  for (const item of inactiveStudents) {
    const stats = await botService.getStudentStats(item.studentId);
    const daysSince = await getDaysSinceLastSubmission(item.studentId);

    const message = inactivityMessage(
      item.studentName,
      daysSince,
      item.completed,
      stats?.submissions.length || 0
    );

    for (const chatId of item.chatIds) {
      await safeSend(chatId, message, { parse_mode: 'Markdown' });
      count++;
    }
  }

  if (count > 0) {
    logger.info(`Bot: ${count} ta ota-onaga faolsizlik eslatmasi yuborildi`);
  }
}

/**
 * Haftalik AI hisobot — scheduler tomonidan chaqiriladi.
 */
export async function sendWeeklyReports() {
  if (!botInstance) return;

  const links = await botService.getAllActiveParentLinks();
  let count = 0;

  const { apiKey } = getAISettings();

  for (const link of links) {
    const stats = await botService.getStudentStats(link.studentId);
    if (!stats) continue;

    const weekStats = await botService.getWeeklyStats(link.studentId);

    let aiSummary = '';
    if (apiKey && weekStats.newSubmissions > 0) {
      aiSummary = await generateWeeklyAISummary(stats.student.fullName, weekStats);
    } else {
      aiSummary = weekStats.newSubmissions === 0
        ? '_Bu hafta topshiriq topshirilmadi._'
        : '_AI tahlil mavjud emas (API key sozlanmagan)._';
    }

    const { weeklyReportMessage } = await import('./bot.messages');
    const message = weeklyReportMessage(stats.student.fullName, weekStats, aiSummary);

    await safeSend(link.chatId, message, { parse_mode: 'Markdown' });
    count++;

    // Rate limit uchun kichik pauza
    await new Promise((r) => setTimeout(r, 100));
  }

  if (count > 0) {
    logger.info(`Bot: ${count} ta ota-onaga haftalik hisobot yuborildi`);
  }
}

// ============ HELPER FUNKSIYALAR ============

async function getDaysSinceLastSubmission(studentId: string): Promise<number> {
  const prisma = (await import('../../config/database')).default;
  const last = await prisma.submission.findFirst({
    where: { studentId },
    orderBy: { submittedAt: 'desc' },
    select: { submittedAt: true },
  });
  if (!last) return 999;
  const diff = Date.now() - new Date(last.submittedAt).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

async function generateWeeklyAISummary(
  studentName: string,
  stats: {
    newSubmissions: number;
    greenCount: number;
    blueCount: number;
    redCount: number;
    gainedScore: number;
  }
): Promise<string> {
  const prompt = `O'quv markazi tizimidagi o'quvchi "${studentName}" ning haftalik natijalari:
- Topshirilgan normativlar: ${stats.newSubmissions} ta
- Yashil (a'lo): ${stats.greenCount} ta
- Ko'k (yaxshi): ${stats.blueCount} ta
- Qizil (qoniqarsiz): ${stats.redCount} ta
- Qo'shilgan ball: ${stats.gainedScore}

Ota-ona uchun 2-3 jumlada qisqa, rag'batlantiruvchi va konstruktiv tahlil yozing. O'zbek tilida. Markdown ishlatmang.`;

  try {
    return await generateText(prompt, 300, 0.6);
  } catch {
    return '_AI tahlil yuklab bo\'lmadi._';
  }
}
