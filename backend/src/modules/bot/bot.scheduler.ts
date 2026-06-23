import cron from 'node-cron';
import { sendInactivityAlerts, sendWeeklyReports } from './bot.notifications';
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

  // ── Har kuni soat 20:00 — Faolsizlik eslatmasi ──
  cron.schedule('0 20 * * *', async () => {
    logger.info('🤖 Bot scheduler: Faolsizlik eslatmalari yuborilmoqda...');
    try {
      await sendInactivityAlerts();
    } catch (err) {
      logger.error('Bot scheduler faolsizlik eslatmasi xatosi:', err);
    }
  }, { timezone: 'Asia/Tashkent' });

  logger.info('⏰ Bot scheduler ishga tushdi (haftalik + faolsizlik cron)');
}

export function stopScheduler() {
  schedulerStarted = false;
}
