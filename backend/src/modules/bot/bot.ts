import fs from 'fs';
import path from 'path';
import TelegramBot from 'node-telegram-bot-api';
type BotInstance = InstanceType<typeof TelegramBot>;
import { env } from '../../config/env';
import logger from '../../shared/utils/logger';
import { registerHandlers } from './bot.handlers';
import { setBotInstance } from './bot.notifications';
import { setReportBotInstance } from './bot.ai-report';
import { startScheduler } from './bot.scheduler';

let bot: BotInstance | null = null;

/**
 * Settings.json yoki .env dan bot tokenni olish
 */
export function getBotToken(): string {
  try {
    const settingsPath = path.join(__dirname, '../../../data/settings.json');
    if (fs.existsSync(settingsPath)) {
      const raw = fs.readFileSync(settingsPath, 'utf-8');
      const s = JSON.parse(raw);
      if (s.telegramBotToken && typeof s.telegramBotToken === 'string' && s.telegramBotToken.trim() !== '') {
        return s.telegramBotToken.trim();
      }
    }
  } catch {
    // ignore
  }
  return env.TELEGRAM_BOT_TOKEN || '';
}

/**
 * Telegram botni ishga tushirish
 */
export function startBot(customToken?: string): BotInstance | null {
  const token = (customToken && customToken.trim() !== '') ? customToken.trim() : getBotToken();

  if (!token) {
    logger.warn('⚠️ TELEGRAM_BOT_TOKEN (env va settings.json da) sozlanmagan — bot ishga tushmaydi');
    return null;
  }

  if (bot) {
    logger.warn('⚠️ Bot allaqachon ishlamoqda');
    return bot;
  }

  try {
    bot = new TelegramBot(token, {
      polling: {
        interval: 300,
        autoStart: true,
        params: { timeout: 10 },
      },
    });

    // Barcha handlerlarni ulash
    registerHandlers(bot);

    // Notification tizimiga bot instansini berish
    setBotInstance(bot);
    setReportBotInstance(bot);

    // Scheduler ishga tushirish
    startScheduler();

    // Polling xatoliklarini ushlash
    bot.on('polling_error', (err) => {
      logger.error(`Bot polling xato: ${err.message}`);
    });

    bot.on('error', (err) => {
      logger.error(`Bot umumiy xato: ${err.message}`);
    });

    // Bot info olish
    bot.getMe().then((me) => {
      logger.info(`🤖 Telegram bot ishga tushdi: @${me.username} (ID: ${me.id})`);
    }).catch((err) => {
      logger.error(`⚠️ Telegram bot ulanish xatosi (token yaroqsiz bo'lishi mumkin yoki tarmoq muammosi): ${err.message}`);
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
      logger.info('🤖 Bot to\'xtatilmoqda (SIGINT)...');
      bot?.stopPolling();
    });

    process.on('SIGTERM', () => {
      logger.info('🤖 Bot to\'xtatilmoqda (SIGTERM)...');
      bot?.stopPolling();
    });

    return bot;
  } catch (err) {
    logger.error('❌ Telegram bot ishga tushmadi:', err);
    return null;
  }
}

/**
 * Telegram botni qayta ishga tushirish (yangi token kiritilganda)
 */
export function restartBot(customToken?: string): BotInstance | null {
  if (bot) {
    try {
      bot.stopPolling();
      logger.info('🤖 Eskisiz bot polling to\'xtatildi');
    } catch (e: any) {
      logger.error('Bot stopPolling xatosi:', e.message);
    }
    bot = null;
  }
  return startBot(customToken);
}

/** Bot instansini olish (boshqa joylardan ishlatish uchun) */
export function getBot(): BotInstance | null {
  return bot;
}
