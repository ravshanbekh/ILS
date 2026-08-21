import cron from 'node-cron';
import lessonSessionsService from './lesson-sessions.service';
import { notifyParentsLessonGrade, sendGroupDailySummaries, notifyAdminUngradedGroups } from '../bot/bot.notifications';
import logger from '../../shared/utils/logger';

let schedulerStarted = false;

export function startLessonSessionsScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // Har 2 daqiqada — vaqti (1:40) tugagan, lekin yakunlanmagan sessiyalarni avtomatik yopish
  cron.schedule('*/2 * * * *', async () => {
    try {
      const closed = await lessonSessionsService.closeExpiredSessions();
      if (closed > 0) logger.info(`Dars sessiyalari: ${closed} ta vaqt tugab avtomatik yopildi`);
    } catch (err) {
      logger.error('Dars sessiyalarini avtomatik yopishda xato:', err);
    }
  });

  // Har 5 daqiqada — yakunlanganidan 1 soat o'tgan sessiyalar uchun ota-onaga xabar
  cron.schedule('*/5 * * * *', async () => {
    try {
      const due = await lessonSessionsService.getSessionsDueForParentNotify();
      for (const session of due) {
        await notifyParentsLessonGrade(session.id);
      }
    } catch (err) {
      logger.error('Ota-onaga dars natijasi yuborishda xato:', err);
    }
  }, { timezone: 'Asia/Tashkent' });

  // Har kuni 20:00 — guruh chatlariga ismsiz xulosa + Ravshanga nazorat hisoboti
  cron.schedule('0 20 * * *', async () => {
    logger.info('🤖 Dars baholash: kuniga 20:00 xabarlari yuborilmoqda...');
    try {
      await sendGroupDailySummaries();
    } catch (err) {
      logger.error('Guruh kunlik xulosasini yuborishda xato:', err);
    }
    try {
      await notifyAdminUngradedGroups();
    } catch (err) {
      logger.error('Admin nazorat hisobotini yuborishda xato:', err);
    }
  }, { timezone: 'Asia/Tashkent' });

  logger.info('⏰ Dars baholash scheduleri ishga tushdi (avto-yopish, ota-ona xabari, 20:00 nazorat)');
}
