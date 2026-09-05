import permissionsService from '../modules/permissions/permissions.service';
import settingsService from '../modules/settings/settings.service';
import logger from '../shared/utils/logger';

/**
 * Ruxsatlar tizimi birinchi marta ishga tushganda — mavjud holatni saqlab qoladi.
 *
 * Ilgari amallar faqat ROL bo'yicha ochiq edi (masalan bola o'tkazish barcha
 * o'qituvchilarda). Yangi tizim yoqilganda hech kimning ishi to'xtab qolmasligi
 * uchun, o'sha amalni roli tufayli bajara olgan har bir odamga aynan o'sha ruxsat
 * bir marta berib chiqiladi. Keyin admin kerakmaslarini qo'lda olib qo'yadi.
 *
 * Faqat BIR MARTA ishlaydi — settings.json dagi belgi bilan nazorat qilinadi,
 * shuning uchun admin ruxsatni olib qo'ygandan keyin server qayta ishga tushsa ham
 * u qaytib berilmaydi.
 */
export async function initPermissions() {
  try {
    const { permissionsSeededAt } = await settingsService.getPermissionsSeedState();
    if (permissionsSeededAt) return;

    const granted = await permissionsService.seedLegacyPermissions();
    await settingsService.markPermissionsSeeded();

    logger.info(`🔐 Ruxsatlar tizimi ishga tushdi — mavjud huquqlar saqlandi (${granted} ta yozuv)`);
  } catch (error) {
    logger.error('❌ Ruxsatlarni boshlang\'ich sozlashda xatolik:', error);
  }
}
