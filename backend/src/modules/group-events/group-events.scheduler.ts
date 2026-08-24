import cron from 'node-cron';
import groupEventsService from './group-events.service';
import { sendEventInvitations, sendEventReminders, sendEventFeedbackRequests } from '../bot/bot.notifications';
import logger from '../../shared/utils/logger';

let schedulerStarted = false;

export function startGroupEventsScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // Har 3 daqiqada — yangi yaratilgan tadbirlarga taklifnoma
  cron.schedule('*/3 * * * *', async () => {
    try {
      const pending = await groupEventsService.getEventsPendingInvite();
      for (const event of pending) {
        await sendEventInvitations(event.id);
      }
    } catch (err) {
      logger.error('Demo Day taklifnoma yuborishda xato:', err);
    }
  });

  // Har soatda — 7 kun / 1 kun oldin eslatmalar (kunlik aniqlik yetarli)
  cron.schedule('0 * * * *', async () => {
    try {
      await sendEventReminders('7d');
      await sendEventReminders('1d');
    } catch (err) {
      logger.error('Demo Day eslatma yuborishda xato:', err);
    }
  }, { timezone: 'Asia/Tashkent' });

  // Har 15 daqiqada — 2 soat oldin eslatma (aniqroq vaqt kerak)
  cron.schedule('*/15 * * * *', async () => {
    try {
      await sendEventReminders('2h');
    } catch (err) {
      logger.error('Demo Day 2 soat eslatmasini yuborishda xato:', err);
    }
  }, { timezone: 'Asia/Tashkent' });

  // Har 30 daqiqada — 3+ soat oldin tugagan tadbirlardan fikr-mulohaza so'rash
  cron.schedule('*/30 * * * *', async () => {
    try {
      await sendEventFeedbackRequests();
    } catch (err) {
      logger.error('Demo Day fikr-mulohaza so\'rashda xato:', err);
    }
  });

  logger.info('⏰ Demo Day scheduleri ishga tushdi (taklifnoma + eslatmalar + fikr-mulohaza)');
}
