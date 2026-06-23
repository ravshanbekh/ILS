import type {
  ReplyKeyboardMarkup,
  ReplyKeyboardRemove,
  InlineKeyboardMarkup,
  InlineKeyboardButton,
} from 'node-telegram-bot-api';

// ============ REPLY KEYBOARDS ============

/** Asosiy ota-ona menu */
export const mainMenuKeyboard = (): ReplyKeyboardMarkup => ({
  keyboard: [
    [{ text: '📊 Natijalar' }, { text: '📈 Reyting' }],
    [{ text: '📋 Ma\'lumot' }, { text: '🏆 Leaderboard' }],
    [{ text: '💬 Fikr bildirish' }, { text: '🤖 AI Konsultant' }],
    [{ text: '⚙️ Sozlamalar' }, { text: '🔗 Bog\'lanishni uzish' }],
  ],
  resize_keyboard: true,
  is_persistent: true,
});

/** Operator menu */
export const operatorMenuKeyboard = (): ReplyKeyboardMarkup => ({
  keyboard: [
    [{ text: '❄️ Muzlatilganlar ro\'yxati' }, { text: '🔍 Qidirish' }],
    [{ text: '📊 Oylik hisobot' }, { text: '🔗 Chiqish' }],
  ],
  resize_keyboard: true,
  is_persistent: true,
});

/** Til tanlash */
export const langKeyboard = (): ReplyKeyboardMarkup => ({
  keyboard: [[{ text: "🇺🇿 O'zbek" }, { text: '🇷🇺 Русский' }]],
  resize_keyboard: true,
  one_time_keyboard: true,
});

/** Bekor qilish */
export const cancelKeyboard = (): ReplyKeyboardMarkup => ({
  keyboard: [[{ text: '❌ Bekor qilish' }]],
  resize_keyboard: true,
  one_time_keyboard: true,
});

/** Klaviaturani olib tashlash */
export const removeKeyboard = (): ReplyKeyboardRemove => ({
  remove_keyboard: true,
});

// ============ INLINE KEYBOARDS ============

/** Sozlamalar inline keyboard */
export const settingsInlineKeyboard = (settings: {
  notifyOnCheck: boolean;
  notifyOnRank: boolean;
  notifyWeekly: boolean;
  notifyInactivity: boolean;
}): InlineKeyboardMarkup => ({
  inline_keyboard: [
    [
      {
        text: `${settings.notifyOnCheck ? '🔔' : '🔕'} Natija bildirishi`,
        callback_data: 'toggle_check',
      },
    ],
    [
      {
        text: `${settings.notifyOnRank ? '🔔' : '🔕'} Reyting bildirishi`,
        callback_data: 'toggle_rank',
      },
    ],
    [
      {
        text: `${settings.notifyWeekly ? '🔔' : '🔕'} Haftalik hisobot`,
        callback_data: 'toggle_weekly',
      },
    ],
    [
      {
        text: `${settings.notifyInactivity ? '🔔' : '🔕'} Faolsizlik bildirishnomasi`,
        callback_data: 'toggle_inactivity',
      },
    ],
    [{ text: '✅ Saqlash', callback_data: 'settings_done' }],
  ],
});

/** Muzlatilgan o'quvchi uchun script inline button */
export const freezeScriptInlineKeyboard = (freezeId: string): InlineKeyboardMarkup => ({
  inline_keyboard: [
    [
      {
        text: '📝 AI Script yaratish',
        callback_data: `gen_script:${freezeId}`,
      },
    ],
  ],
});

/** Pagination inline keyboard */
export const paginationKeyboard = (
  page: number,
  total: number,
  prefix: string
): InlineKeyboardMarkup => {
  const buttons: InlineKeyboardButton[] = [];
  if (page > 0) buttons.push({ text: '⬅️ Oldingi', callback_data: `${prefix}:${page - 1}` });
  buttons.push({ text: `${page + 1}`, callback_data: 'noop' });
  if ((page + 1) * 5 < total) buttons.push({ text: 'Keyingi ➡️', callback_data: `${prefix}:${page + 1}` });
  return { inline_keyboard: [buttons] };
};
