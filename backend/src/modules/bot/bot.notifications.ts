import TelegramBot from 'node-telegram-bot-api';
type BotInstance = InstanceType<typeof TelegramBot>;
import botService from './bot.service';
import {
  checkNotificationMessage,
  inactivityMessage,
  allNormativesDoneMessage,
  lessonGradeParentMessage,
  lessonPeriodSummaryMessage,
  groupDailySummaryMessage,
  adminUngradedReportMessage,
  eventInvitationMessage,
  eventReminderMessage,
  eventFeedbackRequestMessage,
} from './bot.messages';
import { rsvpInlineKeyboard, eventFeedbackKeyboard } from './bot.keyboards';
import { NotifyCheckPayload } from './bot.types';
import logger from '../../shared/utils/logger';
import { generateText, getAISettings } from '../../shared/utils/ai';
import lessonSessionsService from '../lesson-sessions/lesson-sessions.service';
import groupEventsService from '../group-events/group-events.service';

let botInstance: BotInstance | null = null;
let botUsername: string | null = null;

/** Bot instansini o'rnatish */
export function setBotInstance(bot: BotInstance) {
  botInstance = bot;
}

/** Bot username'ini o'rnatish (bot.ts dagi getMe() dan) — guruh xabarlaridagi havola uchun */
export function setBotUsername(username: string) {
  botUsername = username;
}

/** Bot username'ini olish (@ belgisiz) — nusxalash tugmasi uchun */
export function getBotUsername(): string | null {
  return botUsername;
}

/**
 * Bot username hali keshlanmagan bo'lsa (masalan, server endigina qayta ishga tushgan
 * paytda getMe() ulgurmagan bo'lsa), live getMe() bilan qayta urinib ko'radi.
 * Har safar bo'sh chiqmaydi — muvaffaqiyatsizlik keshlanmaydi, keyingi so'rov qayta uradi.
 */
export async function ensureBotUsername(): Promise<string | null> {
  if (botUsername) return botUsername;
  if (!botInstance) return null;
  try {
    const me = await botInstance.getMe();
    if (me.username) botUsername = me.username;
  } catch (err: any) {
    logger.warn(`Bot username olishda xato (keyingi so'rovda qayta urinib ko'riladi): ${err.message}`);
  }
  return botUsername;
}

/** Ota-onaga "/start bosing" havolasi — guruh kunlik xulosasida ishlatiladi */
export function getBotLink(): string | undefined {
  return botUsername ? `https://t.me/${botUsername}` : undefined;
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

/** Boshqa modullar (masalan murojaat javobi) uchun ochiq wrapper */
export async function safeSendToParent(chatId: bigint | number, text: string) {
  await safeSend(chatId, text, { parse_mode: 'Markdown' });
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
 * Faolsizlik eslatmasi — scheduler tomonidan chaqiriladi (har kuni 20:00).
 *
 * "Yangi topshiriq yo'q" o'z-o'zidan "ishlamayapti" degani emas: barcha
 * normativini tugatgan o'quvchida ham yangi topshiriq bo'lmaydi. Shuning uchun
 * bu yerda uch xil holat ajratiladi:
 *   1) hammasi topshirilgan  -> tabrik, va faqat BIR MARTA (har kuni emas)
 *   2) 1-2 ta qolgan         -> "finishgacha ozgina qoldi" turtkisi
 *   3) qolgani ko'p          -> odatdagi eslatma, aniq X/Y raqami bilan
 */
export async function sendInactivityAlerts() {
  if (!botInstance) return;

  const items = await botService.getInactiveStudentParents(3);
  let reminderCount = 0;
  let congratsCount = 0;

  const congratsSentLinkIds: string[] = [];
  const stillWorkingStudentIds: string[] = [];

  for (const item of items) {
    const finishedAll = item.assigned > 0 && item.submitted >= item.assigned;

    if (finishedAll) {
      // Tabrikni faqat hali olmagan ota-onaga yuboramiz
      const fresh = item.links.filter((l) => l.completionCongratsAt === null);
      if (fresh.length === 0) continue;

      const stats = await botService.getStudentStats(item.studentId);
      const message = allNormativesDoneMessage(
        item.studentName,
        item.assigned,
        item.checked,
        stats?.totalScore
      );

      for (const link of fresh) {
        await safeSend(link.chatId, message, { parse_mode: 'Markdown' });
        congratsSentLinkIds.push(link.id);
        congratsCount++;
      }
      continue;
    }

    // Yana bajariladigan normativ bor — keyin tugatsa, tabrik qayta yuborilsin
    stillWorkingStudentIds.push(item.studentId);

    const message = inactivityMessage(
      item.studentName,
      item.daysSinceLastSubmission,
      item.submitted,
      item.assigned,
      item.checked
    );

    for (const link of item.links) {
      await safeSend(link.chatId, message, { parse_mode: 'Markdown' });
      reminderCount++;
    }
  }

  await botService.markCompletionCongrats(congratsSentLinkIds);
  await botService.resetCompletionCongrats(stillWorkingStudentIds);

  if (reminderCount > 0 || congratsCount > 0) {
    logger.info(
      `Bot: ${reminderCount} ta faolsizlik eslatmasi, ${congratsCount} ta tugatish tabrigi yuborildi`
    );
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
    const lessonStats = await lessonSessionsService.getStudentLessonSummary(link.studentId, 7);

    let aiSummary = '';
    if (apiKey && weekStats.newSubmissions > 0) {
      aiSummary = await generateWeeklyAISummary(stats.student.fullName, weekStats);
    } else {
      aiSummary = weekStats.newSubmissions === 0
        ? '_Bu hafta topshiriq topshirilmadi._'
        : '_AI tahlil mavjud emas (API key sozlanmagan)._';
    }

    const message = lessonPeriodSummaryMessage('hafta', lessonStats, weekStats, {
      studentName: stats.student.fullName,
      aiSummary,
    });

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

// ============ DARS BAHOLASH BILDIRISHNOMALARI ============

/**
 * Yakunlangan sessiyadan 1 soat o'tgach — ota-onalarga dars natijasi.
 * lesson-sessions.scheduler.ts dan chaqiriladi.
 */
export async function notifyParentsLessonGrade(sessionId: string) {
  if (!botInstance) return;

  const session = await lessonSessionsService.getById(sessionId);
  let count = 0;

  for (const grade of session.grades) {
    if (!grade.homework) continue;

    const chatIds = await botService.getParentChatIds(grade.studentId, 'notifyOnCheck');
    if (chatIds.length === 0) continue;

    const weeklyAvg = await lessonSessionsService.getStudentWeeklyHomeworkAvg(grade.studentId);
    const message = lessonGradeParentMessage({
      studentName: grade.student.fullName,
      groupName: session.group.name,
      date: new Date(session.date).toLocaleDateString('uz-UZ'),
      homework: grade.homework,
      homeworkScore: grade.homeworkScore,
      activityScore: grade.activityScore,
      weeklyAvgHomework: weeklyAvg,
      teacherComment: grade.comment,
    });

    for (const chatId of chatIds) {
      await safeSend(chatId, message, { parse_mode: 'Markdown' });
      count++;
    }
  }

  await lessonSessionsService.markParentNotified(sessionId);
  if (count > 0) {
    logger.info(`Bot: ${count} ta ota-onaga dars natijasi yuborildi (session: ${sessionId})`);
  }
}

/**
 * Kuniga 20:00 — yakunlangan va chati ulangan guruhlarga ismsiz xulosa.
 */
export async function sendGroupDailySummaries() {
  if (!botInstance) return;

  const sessions = await lessonSessionsService.getFinalizedSessionsTodayWithChat();
  let count = 0;

  for (const session of sessions) {
    const summary = await lessonSessionsService.getGroupDailySummary(session.id);
    if (!summary || summary.total === 0) continue;

    const message = groupDailySummaryMessage({ ...summary, botLink: getBotLink() });
    await safeSend(session.group.telegramChatId!, message, { parse_mode: 'Markdown' });
    count++;
  }

  if (count > 0) {
    logger.info(`Bot: ${count} ta guruh chatiga kunlik xulosa yuborildi`);
  }
}

/**
 * Kuniga 20:00 — Ravshanga qaysi guruhlar ochilmagan/yakunlanmagan.
 */
export async function notifyAdminUngradedGroups() {
  if (!botInstance) return;

  const report = await lessonSessionsService.getUngradedGroupsToday();
  if (report.notOpened.length === 0 && report.notFinalized.length === 0) return;

  const chatIds = await botService.getAdminChatIds();
  if (chatIds.length === 0) return;

  const message = adminUngradedReportMessage(report);
  for (const chatId of chatIds) {
    await safeSend(chatId, message, { parse_mode: 'Markdown' });
  }

  logger.info(`Bot: ${chatIds.length} ta rahbarga kunlik nazorat hisoboti yuborildi`);
}

// ============ OTA-ONALAR BAZASI: OMMAVIY XABAR ============

/**
 * Filtrlangan ota-onalarga bitta matnli xabar yuborish.
 * {ism} shabloni har bir farzandning ismi bilan almashtiriladi.
 * bot.controller.ts dan chaqiriladi.
 */
export async function broadcastToParents(
  filters: { groupId?: string; teacherId?: string; studentIds?: string[] },
  message: string
): Promise<{ total: number; sent: number; failed: number }> {
  if (!botInstance) return { total: 0, sent: 0, failed: 0 };

  const recipients = await botService.getBroadcastRecipients(filters);
  let sent = 0;
  let failed = 0;

  for (const r of recipients) {
    const firstName = r.student.fullName.split(' ')[0];
    const personalized = message.replace(/\{ism\}/g, firstName);
    try {
      await botInstance.sendMessage(Number(r.chatId), personalized, { parse_mode: 'Markdown' });
      sent++;
    } catch (err: any) {
      failed++;
      logger.warn(`Broadcast: chatId=${r.chatId} ga yuborilmadi — ${err.message}`);
    }
    // Telegram rate-limit uchun kichik pauza
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  logger.info(`Bot: ommaviy xabar — ${sent}/${recipients.length} ta ota-onaga yetkazildi (${failed} xato)`);
  return { total: recipients.length, sent, failed };
}

// ============ DEMO DAY ============

/** Yangi tadbir yaratilganda — guruh ota-onalariga taklifnoma */
export async function sendEventInvitations(eventId: string) {
  if (!botInstance) return;

  const event = await groupEventsService.getById(eventId);
  const recipients = await botService.getBroadcastRecipients({ groupId: event.group.id });

  const message = eventInvitationMessage({
    groupName: event.group.name,
    title: event.title,
    eventAt: event.eventAt,
    place: event.place,
    description: event.description,
  });

  for (const r of recipients) {
    await safeSend(r.chatId, message, { parse_mode: 'Markdown', reply_markup: rsvpInlineKeyboard(eventId) });
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  await groupEventsService.markInvited(eventId);
  logger.info(`Bot: ${recipients.length} ta ota-onaga "${event.title}" taklifnomasi yuborildi`);
}

/** 7 kun / 1 kun / 2 soat oldin eslatma */
export async function sendEventReminders(stage: '7d' | '1d' | '2h') {
  if (!botInstance) return;

  const events = await groupEventsService.getEventsNeedingReminder(stage);
  for (const event of events) {
    const recipients = await botService.getBroadcastRecipients({ groupId: event.groupId });
    const message = eventReminderMessage(
      { groupName: event.group.name, title: event.title, eventAt: event.eventAt, place: event.place },
      stage
    );

    for (const r of recipients) {
      await safeSend(r.chatId, message, { parse_mode: 'Markdown', reply_markup: rsvpInlineKeyboard(event.id) });
      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    await groupEventsService.markReminderSent(event.id, stage);
    logger.info(`Bot: "${event.title}" uchun ${stage} eslatmasi ${recipients.length} ta ota-onaga yuborildi`);
  }
}

// ============ MUROJAATLAR ============

/** Shoshilinch murojaat (urgency >= 4) — Ravshanga darhol xabar */
export async function notifyAdminUrgentAppeal(data: {
  code: string;
  type: string;
  studentName: string;
  groupName: string | null;
  teacherName: string | null;
  message: string;
  urgency: number;
}) {
  if (!botInstance) return;

  const chatIds = await botService.getAdminChatIds();
  if (chatIds.length === 0) return;

  const { urgentAppealAdminMessage } = await import('./bot.messages');
  const message = urgentAppealAdminMessage(data);
  for (const chatId of chatIds) {
    await safeSend(chatId, message, { parse_mode: 'Markdown' });
  }
  logger.info(`Bot: shoshilinch murojaat #${data.code} haqida rahbarga xabar yuborildi`);
}

// ============ GAMIFIKATSIYA — COIN NAZORATI ============

/** O'qituvchi kunlik coin chegarasidan oshganda — rahbarlarga darhol xabar */
export async function notifyAdminCoinLimitExceeded(data: {
  teacherName: string;
  todayTotal: number;
  limit: number;
}) {
  if (!botInstance) return;

  const chatIds = await botService.getAdminChatIds();
  if (chatIds.length === 0) return;

  const { coinLimitExceededMessage } = await import('./bot.messages');
  const message = coinLimitExceededMessage(data);
  for (const chatId of chatIds) {
    await safeSend(chatId, message, { parse_mode: 'Markdown' });
  }
  logger.info(`Bot: coin chegarasi haqida rahbarlarga xabar yuborildi (teacher: ${data.teacherName})`);
}

// ============ DEMO DAY FIKR-MULOHAZASI ============

/**
 * Kuniga 20:00 da — o'sha kungacha bo'lib o'tgan tadbirlar uchun guruhdagi barcha
 * ulangan ota-onalarga baho so'ralib xabar yuboriladi. group-events.scheduler.ts dan chaqiriladi.
 */
export async function sendEventFeedbackRequests() {
  if (!botInstance) return;

  const events = await groupEventsService.getEventsPendingFeedbackRequest();

  for (const event of events) {
    const recipients = await botService.getBroadcastRecipients({ groupId: event.groupId });
    const message = eventFeedbackRequestMessage(event.title, event.group.name);

    for (const r of recipients as Array<{ id: string; chatId: bigint }>) {
      await safeSend(r.chatId, message, { parse_mode: 'Markdown', reply_markup: eventFeedbackKeyboard(event.id) });
      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    await groupEventsService.markFeedbackRequested(event.id);
    logger.info(`Bot: "${event.title}" uchun ${recipients.length} ta ota-onadan fikr-mulohaza so'raldi`);
  }
}
