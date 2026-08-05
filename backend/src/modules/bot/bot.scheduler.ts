import cron from 'node-cron';
import { sendInactivityAlerts, sendWeeklyReports } from './bot.notifications';
import { sendDailyAIReport } from './bot.ai-report';
import logger from '../../shared/utils/logger';

let schedulerStarted = false;

/**
 * Barcha cron vazifalarni ishga tushirish
 */
export function startScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // ── Har dushanba soat 09:00 — Haftalik AI hisobot ──
  cron.schedule('0 9 * * 1', async () => {
    logger.info('🤖 Bot scheduler: Haftalik hisobot yuborilmoqda...');
    try {
      await sendWeeklyReports();
    } catch (err) {
      logger.error('Bot scheduler haftalik hisobot xatosi:', err);
    }
  }, { timezone: 'Asia/Tashkent' });

  // ── Har kuni soat 13:00 — Kunlik 1-AI Ta'lim Hisoboti ──
  cron.schedule('0 13 * * *', async () => {
    logger.info('🤖 Bot scheduler: 13:00 AI Ta\'lim hisoboti yuborilmoqda...');
    try {
      await sendDailyAIReport('13:00 Kunlik Oraqliq Hisobot');
    } catch (err) {
      logger.error('Bot 13:00 AI hisobot xatosi:', err);
    }
  }, { timezone: 'Asia/Tashkent' });

  // ── Har kuni soat 17:00 — Kunlik 2-AI Ta'lim Hisoboti ──
  cron.schedule('0 17 * * *', async () => {
    logger.info('🤖 Bot scheduler: 17:00 AI Ta\'lim hisoboti yuborilmoqda...');
    try {
      await sendDailyAIReport('17:00 Kunlik Yakuniy Hisobot');
    } catch (err) {
      logger.error('Bot 17:00 AI hisobot xatosi:', err);
    }
  }, { timezone: 'Asia/Tashkent' });

  // ── Har kuni soat 20:00 — Faolsizlik eslatmasi ──
  cron.schedule('0 20 * * *', async () => {
    logger.info('🤖 Bot scheduler: Faolsizlik eslatmalari yuborilmoqda...');
    try {
      await sendInactivityAlerts();
    } catch (err) {
      logger.error('Bot scheduler faolsizlik eslatmasi xatosi:', err);
    }
  }, { timezone: 'Asia/Tashkent' });

  logger.info('⏰ Bot scheduler ishga tushdi (13:00 va 17:00 AI ta\'lim hisobotlari + haftalik cron)');
}

export function stopScheduler() {
  schedulerStarted = false;
}
