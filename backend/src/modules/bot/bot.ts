import TelegramBot from 'node-telegram-bot-api';
type BotInstance = InstanceType<typeof TelegramBot>;
import { env } from '../../config/env';
import logger from '../../shared/utils/logger';
import { registerHandlers } from './bot.handlers';
import { setBotInstance } from './bot.notifications';
import { startScheduler } from './bot.scheduler';

let bot: BotInstance | null = null;

/**
 * Telegram botni ishga tushirish
 */
export function startBot(): BotInstance | null {
  if (!env.TELEGRAM_BOT_TOKEN) {
    logger.warn('⚠️  TELEGRAM_BOT_TOKEN sozlanmagan — bot ishga tushmaydi');
    return null;
  }

  if (bot) {
    logger.warn('⚠️  Bot allaqachon ishlamoqda');
    return bot;
  }

  try {
    bot = new TelegramBot(env.TELEGRAM_BOT_TOKEN, {
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

/** Bot instansini olish (boshqa joylardan ishlatish uchun) */
export function getBot(): BotInstance | null {
  return bot;
}
