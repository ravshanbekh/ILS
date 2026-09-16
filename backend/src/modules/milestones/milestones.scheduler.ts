import cron from 'node-cron';
import milestonesService from './milestones.service';
import logger from '../../shared/utils/logger';

let started = false;

export function startMilestonesScheduler() {
  if (started) return;
  started = true;

  // Har kuni 06:00 — imtihonlarni avtomatik yopish va kechikkanlarni belgilash.
  //
  // Ogohlantirish bot orqali YUBORILMAYDI: Ravshan ekrandagi bannerni
  // tanladi (admin paneli + o'qituvchi paneli). Shuning uchun bu yerda
  // faqat holatlar yangilanadi, xabar yuborilmaydi.
  cron.schedule(
    '0 6 * * *',
    async () => {
      try {
        const r = await milestonesService.refreshStatuses();
        logger.info(
          `Bosqichlar: ${r.autoClosed} ta imtihon avtomatik yopildi, ${r.markedLate} ta kechikdi deb belgilandi`
        );
      } catch (err) {
        logger.error('Bosqichlar holatini yangilashda xato:', err);
      }
    },
    { timezone: 'Asia/Tashkent' }
  );
}
