import TelegramBot from 'node-telegram-bot-api';
type BotInstance = InstanceType<typeof TelegramBot>;
import botService from './bot.service';
import freezesService from '../freezes/freezes.service';
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
  freezeListMessage,
  operatorAskLoginMessage,
  operatorAskPasswordMessage,
  operatorUnauthorizedMessage,
  operatorLinkedMessage,
} from './bot.messages';
import {
  mainMenuKeyboard,
  operatorMenuKeyboard,
  cancelKeyboard,
  removeKeyboard,
  settingsInlineKeyboard,
  freezeScriptInlineKeyboard,
  paginationKeyboard,
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
      const isOperator = link.role === 'operator';
      await bot.sendMessage(
        chatId,
        `👋 Salom, *${esc(link.fullName || link.student?.fullName || 'Foydalanuvchi')}*!\n\nQaytib keldingiz.`,
        {
          parse_mode: 'Markdown',
          reply_markup: isOperator ? operatorMenuKeyboard() : mainMenuKeyboard(),
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

  // ─── /operator ─── (operator uchun)
  bot.onText(/\/operator/, async (msg) => {
    const chatId = msg.chat.id;
    const link = await botService.getLinkByTelegramId(msg.from!.id);
    if (link && link.isActive && link.role === 'operator') {
      await bot.sendMessage(chatId, `✅ Operator sifatida kirgansiz: *${esc(link.fullName)}*`, {
        parse_mode: 'Markdown',
        reply_markup: operatorMenuKeyboard(),
      });
      return;
    }
    setState(chatId, { step: 'operator_await_login' });
    await bot.sendMessage(chatId, operatorAskLoginMessage(), {
      parse_mode: 'Markdown',
      reply_markup: cancelKeyboard(),
    });
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
        `/login — O'quvchi hisobi bilan bog'lanish\n` +
        `/operator — Operator sifatida kirish\n` +
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
      if (link && link.isActive) {
        await bot.sendMessage(chatId, '↩️ Bekor qilindi.', {
          reply_markup: link.role === 'operator' ? operatorMenuKeyboard() : mainMenuKeyboard(),
        });
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

    // ── Operator login oqimi ──
    if (state.step === 'operator_await_login') {
      setState(chatId, { step: 'operator_await_password', pendingOperatorLogin: text });
      await bot.sendMessage(chatId, operatorAskPasswordMessage(text), {
        parse_mode: 'Markdown',
        reply_markup: cancelKeyboard(),
      });
      return;
    }

    if (state.step === 'operator_await_password' && state.pendingOperatorLogin) {
      await bot.sendMessage(chatId, '⏳ Tekshirilmoqda...');
      const result = await botService.linkOperator({
        telegramId,
        chatId,
        login: state.pendingOperatorLogin,
        password: text,
        fullName: msg.from!.first_name + (msg.from!.last_name ? ' ' + msg.from!.last_name : ''),
        username: msg.from!.username,
      });
      clearState(chatId);

      if (result.success) {
        await bot.sendMessage(chatId, operatorLinkedMessage(result.name!), {
          parse_mode: 'Markdown',
          reply_markup: operatorMenuKeyboard(),
        });
      } else if (result.message === 'unauthorized') {
        await bot.sendMessage(chatId, operatorUnauthorizedMessage(), { parse_mode: 'Markdown' });
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

    // ── Qidiruv kutilmoqda (operator) ──
    if (state.step === 'operator_await_search') {
      clearState(chatId);
      const freezes = await botService.searchFrozen(text);
      if (freezes.length === 0) {
        await bot.sendMessage(chatId, `🔍 *"${esc(text)}"* bo'yicha natija topilmadi.`, {
          parse_mode: 'Markdown',
          reply_markup: operatorMenuKeyboard(),
        });
        return;
      }
      await bot.sendMessage(chatId, freezeListMessage(freezes, 0, freezes.length), {
        parse_mode: 'Markdown',
        reply_markup: operatorMenuKeyboard(),
      });
      // Har birini alohida inline tugma bilan
      for (const f of freezes.slice(0, 5)) {
        await bot.sendMessage(chatId, `📋 *${esc(f.studentName)}*\n${esc(f.reason)}`, {
          parse_mode: 'Markdown',
          reply_markup: freezeScriptInlineKeyboard(f.id),
        });
      }
      return;
    }

    // ── Asosiy menu tugmalari ──
    const link = await botService.getLinkByTelegramId(telegramId);
    if (!link || !link.isActive) {
      await bot.sendMessage(
        chatId,
        '⚠️ Siz hali bog\'lanmadingiz.\n/login — O\'quvchi hisobi bilan bog\'lanish\n/operator — Operator sifatida kirish'
      );
      return;
    }

    // ── OTA-ONA TUGMALARI ──
    if (link.role === 'parent') {
      await handleParentButtons(bot, chatId, telegramId, text, link);
    }

    // ── OPERATOR TUGMALARI ──
    if (link.role === 'operator') {
      await handleOperatorButtons(bot, chatId, telegramId, text, link);
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

    if (data === 'noop') return;

    // Muzlatilganlar pagination
    if (data.startsWith('freezes:')) {
      const page = parseInt(data.split(':')[1]);
      const freezes = await botService.getFrozenList();
      await bot.editMessageText(freezeListMessage(freezes, page, freezes.length), {
        chat_id: chatId,
        message_id: query.message!.message_id,
        parse_mode: 'Markdown',
        reply_markup: freezes.length > 5 ? paginationKeyboard(page, freezes.length, 'freezes') : undefined,
      });
      return;
    }

    // Script yaratish
    if (data.startsWith('gen_script:')) {
      const freezeId = data.replace('gen_script:', '');
      await bot.sendMessage(chatId, '⏳ AI script yaratilmoqda... (10-30 soniya)');
      try {
        const script = await freezesService.generateOperatorScript(freezeId);
        // Telegram 4096 belgi limiti bor — bo'laklarga bo'lamiz
        const chunks = splitMessage(script, 4000);
        for (const chunk of chunks) {
          await bot.sendMessage(chatId, `📝 *OPERATOR SKRIPTI*\n\n${chunk}`, {
            parse_mode: 'Markdown',
          });
        }
      } catch (err: any) {
        if (err.message === 'API_KEY_NOT_SET') {
          await bot.sendMessage(chatId, '❌ Gemini API key sozlanmagan. Admin bilan bog\'laning.');
        } else {
          await bot.sendMessage(chatId, '❌ Script yaratishda xato yuz berdi. Qayta urinib ko\'ring.');
        }
        logger.error('Bot gen_script error:', err);
      }
      return;
    }
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

// ============ OPERATOR TUGMALARI ============

async function handleOperatorButtons(
  bot: BotInstance,
  chatId: number,
  telegramId: number,
  text: string,
  link: any
) {
  switch (text) {
    case '❄️ Muzlatilganlar ro\'yxati': {
      const freezes = await botService.getFrozenList();
      await bot.sendMessage(chatId, freezeListMessage(freezes, 0, freezes.length), {
        parse_mode: 'Markdown',
        reply_markup: freezes.length > 5 ? paginationKeyboard(0, freezes.length, 'freezes') : operatorMenuKeyboard(),
      });
      // Inline script tugmalar
      for (const f of freezes.slice(0, 5)) {
        await bot.sendMessage(chatId, `📋 *${esc(f.studentName)}* — ${esc(f.reason)}\n📞 ${esc(f.phone || '—')}`, {
          parse_mode: 'Markdown',
          reply_markup: freezeScriptInlineKeyboard(f.id),
        });
      }
      break;
    }

    case '🔍 Qidirish': {
      userStates.set(chatId, { step: 'operator_await_search' });
      await bot.sendMessage(chatId, '🔍 *Qidiruv*\n\nO\'quvchi ismini kiriting:', {
        parse_mode: 'Markdown',
        reply_markup: cancelKeyboard(),
      });
      break;
    }

    case '📊 Oylik hisobot': {
      await bot.sendMessage(chatId, '⏳ Hisobot tayyorlanmoqda...');
      try {
        const now = new Date();
        const analysis = await freezesService.analyzeWithAI(now.getMonth() + 1, now.getFullYear());
        const chunks = splitMessage(analysis, 4000);
        for (const chunk of chunks) {
          await bot.sendMessage(chatId, chunk, { parse_mode: 'Markdown', reply_markup: operatorMenuKeyboard() });
        }
      } catch (err: any) {
        await bot.sendMessage(chatId, err.message === 'API_KEY_NOT_SET'
          ? '❌ Gemini API key sozlanmagan.'
          : err.message === 'NO_DATA'
          ? '📭 Bu oy uchun ma\'lumot yo\'q.'
          : '❌ Xato yuz berdi.', { reply_markup: operatorMenuKeyboard() });
      }
      break;
    }

    case '🔗 Chiqish': {
      await botService.unlink(telegramId);
      clearState(chatId);
      await bot.sendMessage(chatId, '👋 Operator rejimidan chiqdingiz.', { reply_markup: { remove_keyboard: true } });
      break;
    }
  }
}

// ============ HELPER ============

/** Uzun matnni Telegram limitiga bo'lish */
function splitMessage(text: string, limit = 4000): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + limit));
    i += limit;
  }
  return chunks;
}
