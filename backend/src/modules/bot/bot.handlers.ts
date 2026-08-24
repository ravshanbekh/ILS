import TelegramBot from 'node-telegram-bot-api';
type BotInstance = InstanceType<typeof TelegramBot>;
import botService from './bot.service';
import { sendDailyAIReport } from './bot.ai-report';
import lessonSessionsService from '../lesson-sessions/lesson-sessions.service';
import groupEventsService from '../group-events/group-events.service';
import appealsService from '../appeals/appeals.service';
import eventFeedbackService from '../event-feedback/event-feedback.service';
import { notifyAdminUrgentAppeal } from './bot.notifications';
import { generateText, getAISettings } from '../../shared/utils/ai';
import {
  esc,
  welcomeMessage,
  askLoginMessage,
  askPasswordMessage,
  linkedSuccessMessage,
  wrongCredentialsMessage,
  notStudentMessage,
  studentResultsMessage,
  rankingMessage,
  fullInfoMessage,
  leaderboardMessage,
  askFeedbackMessage,
  feedbackSentMessage,
  settingsMessage,
  unlinkedMessage,
  adminAskLoginMessage,
  adminAskPasswordMessage,
  adminUnauthorizedMessage,
  adminLinkedMessage,
  chatLinkedMessage,
  chatLinkInvalidMessage,
  todayLessonMessage,
  lessonPeriodSummaryMessage,
  examResultsMessage,
  askAppealMessage,
  appealReceivedMessage,
  rsvpConfirmedMessage,
  eventFeedbackAskCommentMessage,
  eventFeedbackThanksMessage,
} from './bot.messages';
import {
  mainMenuKeyboard,
  cancelKeyboard,
  removeKeyboard,
  settingsInlineKeyboard,
  appealTypeKeyboard,
  eventFeedbackCommentKeyboard,
} from './bot.keyboards';
import { BotUserState } from './bot.types';
import logger from '../../shared/utils/logger';

// In-memory state (user conversation states)
const userStates = new Map<number, BotUserState>();

function getState(chatId: number): BotUserState {
  return userStates.get(chatId) || {};
}

function setState(chatId: number, state: Partial<BotUserState>) {
  userStates.set(chatId, { ...getState(chatId), ...state });
}

function clearState(chatId: number) {
  userStates.delete(chatId);
}

// ============ HANDLER REGISTRATSIYASI ============

export function registerHandlers(bot: BotInstance) {
  // ─── /start ───
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    clearState(chatId);

    const link = await botService.getLinkByTelegramId(msg.from!.id);
    if (link && link.isActive) {
      // Allaqachon bog'langan
      await bot.sendMessage(
        chatId,
        `👋 Salom, *${esc(link.fullName || link.student?.fullName || 'Foydalanuvchi')}*!\n\nQaytib keldingiz.`,
        {
          parse_mode: 'Markdown',
          reply_markup: mainMenuKeyboard(),
        }
      );
    } else {
      await bot.sendMessage(chatId, welcomeMessage(), { parse_mode: 'Markdown' });
    }
  });

  // ─── /login ─── (ota-ona uchun)
  bot.onText(/\/login/, async (msg) => {
    const chatId = msg.chat.id;
    const link = await botService.getLinkByTelegramId(msg.from!.id);
    if (link && link.isActive && link.role === 'parent') {
      await bot.sendMessage(chatId, `✅ Siz allaqachon *${esc(link.student?.fullName)}* bilan bog'langansiz.\n\nBoshqa o'quvchiga o'tish uchun avval /unlink buyrug'ini yuboring.`, { parse_mode: 'Markdown', reply_markup: mainMenuKeyboard() });
      return;
    }
    setState(chatId, { step: 'await_login' });
    await bot.sendMessage(chatId, askLoginMessage(), {
      parse_mode: 'Markdown',
      reply_markup: cancelKeyboard(),
    });
  });

  // ─── /ulash <kod> ─── (o'qituvchi guruh chatini ulaydi — guruh chatida ishlaydi)
  bot.onText(/\/ulash(?:@\w+)?(?:\s+(\d{6}))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const code = match?.[1];
    if (!code) {
      await bot.sendMessage(chatId, "🔗 Guruh chatini ulash uchun saytdagi kodni yozing:\n`/ulash 123456`", { parse_mode: 'Markdown' });
      return;
    }
    const result = await botService.linkGroupChatByCode(code, chatId, (msg.chat as any).title);
    if (result.success) {
      await bot.sendMessage(chatId, chatLinkedMessage(result.groupName!), { parse_mode: 'Markdown' });
    } else {
      await bot.sendMessage(chatId, chatLinkInvalidMessage(), { parse_mode: 'Markdown' });
    }
  });

  // ─── /admin ─── (admin/rahbar hisobot olish uchun bog'lanish)
  bot.onText(/\/admin/, async (msg) => {
    const chatId = msg.chat.id;
    const link = await botService.getLinkByTelegramId(msg.from!.id);
    if (link && link.isActive && link.role === 'admin') {
      await bot.sendMessage(chatId, `✅ Siz allaqachon admin sifatida bog'langansiz: *${esc(link.fullName)}*\n\nHisobot: /report\nUzish: /unlink`, { parse_mode: 'Markdown' });
      return;
    }
    setState(chatId, { step: 'admin_await_login' });
    await bot.sendMessage(chatId, adminAskLoginMessage(), {
      parse_mode: 'Markdown',
      reply_markup: cancelKeyboard(),
    });
  });

  // ─── /report yoki /hisobot ─── (AI ta'lim hisoboti yuborish)
  bot.onText(/\/report|\/hisobot/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, "⚡ Ta'lim ma'lumotlari to'planmoqda va AI tahliliy hisobot tayyorlanmoqda, iltimos kuting...");
    try {
      await sendDailyAIReport("Qo'lda so'ralgan AI Hisobot", chatId);
    } catch (err: any) {
      await bot.sendMessage(chatId, `❌ Hisobot yaratishda xatolik yuz berdi: ${err.message}`);
    }
  });

  // ─── /unlink ───
  bot.onText(/\/unlink/, async (msg) => {
    await botService.unlink(msg.from!.id);
    clearState(msg.chat.id);
    await bot.sendMessage(msg.chat.id, unlinkedMessage(), {
      parse_mode: 'Markdown',
      reply_markup: removeKeyboard(),
    });
  });

  // ─── /help ───
  bot.onText(/\/help/, async (msg) => {
    await bot.sendMessage(
      msg.chat.id,
      `📖 *YORDAM*\n\n` +
        `/start — Boshlamoq\n` +
        `/login — O'quvchi hisobi bilan bog'lanish (ota-ona)\n` +
        `/admin — Admin/Rahbar sifatida kirish (kunlik hisobot olish)\n` +
        `/report — AI ta'lim hisobotini olish\n` +
        `/ulash <kod> — Guruh chatini saytdagi kod bilan ulash (o'qituvchi uchun)\n` +
        `/unlink — Bog'lanishni uzish\n` +
        `/help — Yordam`,
      { parse_mode: 'Markdown' }
    );
  });

  // ─── Matn xabarlarini qayta ishlash ───
  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;

    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const telegramId = msg.from!.id;
    const state = getState(chatId);

    // ── Bekor qilish ──
    if (text === '❌ Bekor qilish') {
      clearState(chatId);
      const link = await botService.getLinkByTelegramId(telegramId);
      if (link && link.isActive && link.role === 'parent') {
        await bot.sendMessage(chatId, '↩️ Bekor qilindi.', { reply_markup: mainMenuKeyboard() });
      } else {
        await bot.sendMessage(chatId, '↩️ Bekor qilindi.', { reply_markup: removeKeyboard() });
      }
      return;
    }

    // ── Login oqimi: login kutilmoqda ──
    if (state.step === 'await_login') {
      setState(chatId, { step: 'await_password', pendingLogin: text });
      await bot.sendMessage(chatId, askPasswordMessage(text), {
        parse_mode: 'Markdown',
        reply_markup: cancelKeyboard(),
      });
      return;
    }

    // ── Login oqimi: parol kutilmoqda ──
    if (state.step === 'await_password' && state.pendingLogin) {
      await bot.sendMessage(chatId, '⏳ Tekshirilmoqda...');
      const result = await botService.linkParent({
        telegramId,
        chatId,
        login: state.pendingLogin,
        password: text,
        fullName: msg.from!.first_name + (msg.from!.last_name ? ' ' + msg.from!.last_name : ''),
        username: msg.from!.username,
      });
      clearState(chatId);

      if (result.success) {
        await bot.sendMessage(
          chatId,
          linkedSuccessMessage(result.studentName!, result.groupName),
          { parse_mode: 'Markdown', reply_markup: mainMenuKeyboard() }
        );
      } else if (result.message === 'not_student') {
        await bot.sendMessage(chatId, notStudentMessage(), { parse_mode: 'Markdown' });
      } else {
        await bot.sendMessage(chatId, wrongCredentialsMessage(), { parse_mode: 'Markdown' });
      }
      return;
    }

    // ── Admin login oqimi ──
    if (state.step === 'admin_await_login') {
      setState(chatId, { step: 'admin_await_password', pendingAdminLogin: text });
      await bot.sendMessage(chatId, adminAskPasswordMessage(text), {
        parse_mode: 'Markdown',
        reply_markup: cancelKeyboard(),
      });
      return;
    }

    if (state.step === 'admin_await_password' && state.pendingAdminLogin) {
      await bot.sendMessage(chatId, '⏳ Tekshirilmoqda...');
      const result = await botService.linkAdmin({
        telegramId,
        chatId,
        login: state.pendingAdminLogin,
        password: text,
        fullName: msg.from!.first_name + (msg.from!.last_name ? ' ' + msg.from!.last_name : ''),
        username: msg.from!.username,
      });
      clearState(chatId);

      if (result.success) {
        await bot.sendMessage(chatId, adminLinkedMessage(result.name!), {
          parse_mode: 'Markdown',
        });
      } else if (result.message === 'unauthorized') {
        await bot.sendMessage(chatId, adminUnauthorizedMessage(), { parse_mode: 'Markdown' });
      } else {
        await bot.sendMessage(chatId, wrongCredentialsMessage(), { parse_mode: 'Markdown' });
      }
      return;
    }

    // ── Feedback kutilmoqda ──
    if (state.step === 'await_feedback') {
      const link = await botService.getLinkByTelegramId(telegramId);
      if (!link) return;

      const teacher = await botService.getTeacherByStudentId(link.studentId);
      await botService.saveFeedback({
        telegramId,
        studentId: link.studentId,
        teacherId: teacher?.id,
        message: text,
      });
      clearState(chatId);
      await bot.sendMessage(chatId, feedbackSentMessage(), {
        parse_mode: 'Markdown',
        reply_markup: mainMenuKeyboard(),
      });
      return;
    }

    // ── Murojaat matni kutilmoqda ──
    if (state.step === 'await_appeal_message' && state.pendingAppealType) {
      const link = await botService.getLinkByTelegramId(telegramId);
      if (!link) return;

      await bot.sendMessage(chatId, '⏳ Murojaatingiz qabul qilinmoqda...');

      const appeal = await appealsService.create({
        telegramLinkId: link.id,
        studentId: link.studentId,
        type: state.pendingAppealType,
        message: text,
      });
      clearState(chatId);

      const code = appeal.id.slice(0, 8).toUpperCase();
      await bot.sendMessage(chatId, appealReceivedMessage(code, appeal.aiReply), {
        parse_mode: 'Markdown',
        reply_markup: mainMenuKeyboard(),
      });

      if (appeal.aiUrgency && appeal.aiUrgency >= 4) {
        const student = link.student;
        const teacher = await botService.getTeacherByStudentId(link.studentId);
        notifyAdminUrgentAppeal({
          code,
          type: appeal.type,
          studentName: student.fullName,
          groupName: student.groupStudents?.[0]?.group?.name || null,
          teacherName: teacher?.fullName || null,
          message: text,
          urgency: appeal.aiUrgency,
        }).catch(() => {});
      }
      return;
    }

    // ── Demo Day fikr-mulohaza izohi kutilmoqda ──
    if (state.step === 'await_event_feedback_comment' && state.pendingFeedbackEventId) {
      const link = await botService.getLinkByTelegramId(telegramId);
      if (!link) return;

      await eventFeedbackService.addComment(state.pendingFeedbackEventId, link.id, text);
      clearState(chatId);
      await bot.sendMessage(chatId, eventFeedbackThanksMessage(), { reply_markup: mainMenuKeyboard() });
      return;
    }

    // ── AI savoli kutilmoqda ──
    if (state.step === 'await_ai_query') {
      const link = await botService.getLinkByTelegramId(telegramId);
      if (!link) return;

      await bot.sendMessage(chatId, '⏳ AI savolingizni va farzandingiz ma\'lumotlarini tahlil qilmoqda...');

      try {
        const stats = await botService.getStudentStats(link.studentId);
        if (!stats) {
          await bot.sendMessage(chatId, '❌ Farzandingiz ma\'lumotlari topilmadi.', { reply_markup: mainMenuKeyboard() });
          clearState(chatId);
          return;
        }

        const { apiKey } = getAISettings();

        if (!apiKey) {
          await bot.sendMessage(chatId, '❌ AI yordamchi hozirda sozlanmagan. Iltimos, admin bilan bog\'laning.', { reply_markup: mainMenuKeyboard() });
          clearState(chatId);
          return;
        }

        const checkedSubs = stats.submissions.filter((s) => s.status === 'checked');
        const last10Subs = checkedSubs.slice(0, 10).map((s) => 
          `- Normativ #${s.normative.taskNumber}: ${s.normative.title} | Natija: ${s.result} | Ball: ${s.score} | Izoh: ${s.comment || 'izoh yo\'q'}`
        ).join('\n');

        const prompt = `Siz IT Live o'quv markazining tajribali AI-Pedagog/Konsultantisiz. Farzandining o'qish natijalari yuzasidan murojaat qilayotgan ota-ona bilan gaplashyapsiz. Quyidagi ma'lumotlarga tayangan holda samimiy, tushunarli, pedagogik va konstruktiv maslahat bering.

Farzandining ma'lumotlari:
- Ismi: ${stats.student.fullName}
- O'qish darajasi (Level): ${stats.level}-daraja
- Jami to'plagan balli: ${stats.totalScore} ball
- Topshirilgan normativlar soni: ${stats.completed} ta
- Kutilayotgan (tekshirilmoqda): ${stats.pending} ta
- Badgelar (yutuqlar): ${stats.badges.map(b => b.name).join(', ') || 'Hozircha yutuqlar yo\'q'}
- Oxirgi 10 ta topshiriq natijalari va o'qituvchi izohlari:
${last10Subs || 'Hozircha topshiriqlar topshirilmagan.'}

Ota-onaning savoli: "${text}"

Qoidalarga rioya qiling:
1. Javobingizni o'zbek tilida, do'stona va pedagogik ohangda yozing.
2. Ota-onaga farzandining zaif va kuchli tomonlarini tahlil qilib, kelgusi rivojlanishi va natijalarini oshirishi uchun 3 ta aniq amaliy tavsiya bering.
3. IT sohasidan butunlay yiroq bo'lgan, dasturlashni bilmaydigan ota-ona ham tushunadigan darajada oddiy va sodda tildan foydalaning. Murakkab IT atamalarini (masalan: CSS Grid, HTML, Flexbox, Contact Form, Hero Section) to'g'ridan-to'g'ri ishlatmang, ularni o'zbekcha oddiy tushunchalar bilan almashtiring (Masalan: "CSS Grid/Flexbox" o'rniga "sayt dizayni va elementlarini chiroyli joylashtirish qoidalari", "HTML" o'rniga "veb-sahifa yaratish asoslari", "Contact Form" o'rniga "saytdagi aloqa bo'limi/anketa" deb tushuntiring).
4. Telegram Markdown parsing xatoliklarini oldini olish uchun javobingizda mutlaqo markdown elementlarini (masalan: *, _, \`, [) ishlatmang. Plain text (oddiy matn) shaklida, emojilar va yangi qatorlar bilan chiroyli formatlab yozing.
5. Javobingiz mazmunan to'liq bo'lsin, lekin juda cho'zilib ketmasligi uchun maksimal 10 ta gapdan oshmasin.`;

        const responseText = await generateText(prompt, 65536);

        await bot.sendMessage(chatId, `🤖 *AI Konsultant javobi:*\n\n${responseText}`, {
          parse_mode: 'Markdown',
          reply_markup: cancelKeyboard(),
        });

      } catch (err) {
        logger.error('AI Consultant query error:', err);
        await bot.sendMessage(chatId, '❌ Kechirasiz, savolingizni tahlil qilishda xato yuz berdi. Iltimos, keyinroq qayta urinib ko\'ring.', {
          reply_markup: mainMenuKeyboard(),
        });
        clearState(chatId);
      }
      return;
    }

    // ── Asosiy menu tugmalari ──
    const link = await botService.getLinkByTelegramId(telegramId);
    if (!link || !link.isActive) {
      await bot.sendMessage(
        chatId,
        '⚠️ Siz hali bog\'lanmadingiz.\n/login — O\'quvchi hisobi bilan bog\'lanish'
      );
      return;
    }

    // ── OTA-ONA TUGMALARI ──
    if (link.role === 'parent') {
      await handleParentButtons(bot, chatId, telegramId, text, link);
    }
  });

  // ─── Callback query (inline tugmalar) ───
  bot.on('callback_query', async (query) => {
    const chatId = query.message!.chat.id;
    const telegramId = query.from.id;
    const data = query.data || '';

    await bot.answerCallbackQuery(query.id);

    // Sozlamalar toggle
    if (data.startsWith('toggle_')) {
      const fieldMap: Record<string, 'notifyOnCheck' | 'notifyOnRank' | 'notifyWeekly' | 'notifyInactivity'> = {
        toggle_check: 'notifyOnCheck',
        toggle_rank: 'notifyOnRank',
        toggle_weekly: 'notifyWeekly',
        toggle_inactivity: 'notifyInactivity',
      };
      const field = fieldMap[data];
      if (!field) return;

      const current = await botService.getNotificationSettings(telegramId);
      if (!current) return;
      const newVal = !current[field];
      const updated = await botService.updateNotificationSettings(telegramId, field, newVal);
      await bot.editMessageReplyMarkup(settingsInlineKeyboard(updated), {
        chat_id: chatId,
        message_id: query.message!.message_id,
      });
      return;
    }

    if (data === 'settings_done') {
      await bot.editMessageText('✅ Sozlamalar saqlandi!', {
        chat_id: chatId,
        message_id: query.message!.message_id,
      });
      return;
    }

    // Murojaat turi tanlandi
    if (data.startsWith('appeal_type:')) {
      const type = data.replace('appeal_type:', '') as 'shikoyat' | 'taklif' | 'etiroz' | 'minnatdorchilik';
      setState(chatId, { step: 'await_appeal_message', pendingAppealType: type });
      await bot.sendMessage(chatId, askAppealMessage(type), {
        parse_mode: 'Markdown',
        reply_markup: cancelKeyboard(),
      });
      return;
    }

    // Demo Day RSVP
    if (data.startsWith('rsvp:')) {
      const [, eventId, answer] = data.split(':');
      const link = await botService.getLinkByTelegramId(telegramId);
      if (!link || link.role !== 'parent') return;

      await groupEventsService.recordRsvp(eventId, link.id, answer as any);
      await bot.sendMessage(chatId, rsvpConfirmedMessage(answer as any));
      return;
    }

    // Demo Day fikr-mulohaza bahosi
    if (data.startsWith('event_fb:')) {
      const [, eventId, satisfaction] = data.split(':');
      const link = await botService.getLinkByTelegramId(telegramId);
      if (!link || link.role !== 'parent') return;

      await eventFeedbackService.submitSatisfaction(eventId, link.id, satisfaction as any);
      setState(chatId, { step: 'await_event_feedback_comment', pendingFeedbackEventId: eventId });
      await bot.sendMessage(chatId, eventFeedbackAskCommentMessage(), {
        reply_markup: eventFeedbackCommentKeyboard(),
      });
      return;
    }

    // Demo Day fikr-mulohaza — izohni o'tkazib yuborish
    if (data === 'event_fb_skip') {
      clearState(chatId);
      await bot.sendMessage(chatId, eventFeedbackThanksMessage(), { reply_markup: mainMenuKeyboard() });
      return;
    }

    if (data === 'noop') return;
  });
}

// ============ OTA-ONA TUGMALARI ============

async function handleParentButtons(
  bot: BotInstance,
  chatId: number,
  telegramId: number,
  text: string,
  link: any
) {
  const studentId = link.studentId;

  switch (text) {
    case '📅 Bugun': {
      const grade = await lessonSessionsService.getStudentTodayGrade(studentId);
      await bot.sendMessage(chatId, todayLessonMessage(grade as any), { parse_mode: 'Markdown', reply_markup: mainMenuKeyboard() });
      break;
    }

    case '🗓 Hafta': {
      const [lesson, normative] = await Promise.all([
        lessonSessionsService.getStudentLessonSummary(studentId, 7),
        botService.getWeeklyStats(studentId, 7),
      ]);
      await bot.sendMessage(chatId, lessonPeriodSummaryMessage('hafta', lesson, normative), { parse_mode: 'Markdown', reply_markup: mainMenuKeyboard() });
      break;
    }

    case '📆 Oy': {
      const [lesson, normative] = await Promise.all([
        lessonSessionsService.getStudentLessonSummary(studentId, 30),
        botService.getWeeklyStats(studentId, 30),
      ]);
      await bot.sendMessage(chatId, lessonPeriodSummaryMessage('oy', lesson, normative), { parse_mode: 'Markdown', reply_markup: mainMenuKeyboard() });
      break;
    }

    case '🏅 Imtihonlar': {
      const results = await botService.getStudentExamResults(studentId);
      await bot.sendMessage(chatId, examResultsMessage(results), { parse_mode: 'Markdown', reply_markup: mainMenuKeyboard() });
      break;
    }

    case '📊 Natijalar': {
      const stats = await botService.getStudentStats(studentId);
      if (!stats) { await bot.sendMessage(chatId, '❌ Ma\'lumot topilmadi.'); return; }
      await bot.sendMessage(chatId, studentResultsMessage(stats), { parse_mode: 'Markdown', reply_markup: mainMenuKeyboard() });
      break;
    }

    case '📈 Reyting': {
      const stats = await botService.getStudentStats(studentId);
      if (!stats) { await bot.sendMessage(chatId, '❌ Ma\'lumot topilmadi.'); return; }
      await bot.sendMessage(chatId, rankingMessage(stats), { parse_mode: 'Markdown', reply_markup: mainMenuKeyboard() });
      break;
    }

    case '📋 Ma\'lumot': {
      const stats = await botService.getStudentStats(studentId);
      if (!stats) { await bot.sendMessage(chatId, '❌ Ma\'lumot topilmadi.'); return; }
      await bot.sendMessage(chatId, fullInfoMessage(stats), { parse_mode: 'Markdown', reply_markup: mainMenuKeyboard() });
      break;
    }

    case '🏆 Leaderboard': {
      const stats = await botService.getStudentStats(studentId);
      if (!stats || stats.groups.length === 0) {
        await bot.sendMessage(chatId, '📚 O\'quvchi hech bir guruhga biriktirilmagan.', { reply_markup: mainMenuKeyboard() });
        return;
      }
      const groupId = stats.groups[0].group.id;
      const groupName = stats.groups[0].group.name;
      const board = await botService.getGroupLeaderboard(groupId);
      const items = board.map((s) => ({ ...s, isSelf: s.name === stats.student.fullName }));
      await bot.sendMessage(chatId, leaderboardMessage(groupName, items), {
        parse_mode: 'Markdown',
        reply_markup: mainMenuKeyboard(),
      });
      break;
    }

    case '💬 Fikr bildirish': {
      const teacher = await botService.getTeacherByStudentId(studentId);
      userStates.set(chatId, { step: 'await_feedback' });
      await bot.sendMessage(chatId, askFeedbackMessage(teacher?.fullName), {
        parse_mode: 'Markdown',
        reply_markup: cancelKeyboard(),
      });
      break;
    }

    case '📮 Murojaat': {
      await bot.sendMessage(chatId, "📮 *Murojaat turini tanlang:*", {
        parse_mode: 'Markdown',
        reply_markup: appealTypeKeyboard(),
      });
      break;
    }

    case '🤖 AI Konsultant': {
      userStates.set(chatId, { step: 'await_ai_query' });
      await bot.sendMessage(chatId, `🤖 *AI Konsultant faollashtirildi!*\n\nFarzandingizning o'qishi, darslardagi faolligi va natijalarini yaxshilash bo'yicha savollaringizni yozib yuboring (Masalan: _"Farzandimning natijalarini qanday yaxshilasak bo'ladi?"_):\n\nAI farzandingizning haqiqiy ma'lumotlariga tayanib javob beradi.`, {
        parse_mode: 'Markdown',
        reply_markup: cancelKeyboard(),
      });
      break;
    }

    case '⚙️ Sozlamalar': {
      const settings = await botService.getNotificationSettings(telegramId);
      if (!settings) { await bot.sendMessage(chatId, '❌ Sozlamalar topilmadi.'); return; }
      await bot.sendMessage(chatId, settingsMessage(), {
        parse_mode: 'Markdown',
        reply_markup: settingsInlineKeyboard(settings),
      });
      break;
    }

    case '🔗 Bog\'lanishni uzish': {
      await botService.unlink(telegramId);
      clearState(chatId);
      await bot.sendMessage(chatId, unlinkedMessage(), { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } });
      break;
    }
  }
}
