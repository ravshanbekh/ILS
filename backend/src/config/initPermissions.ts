import permissionsService from '../modules/permissions/permissions.service';
import settingsService from '../modules/settings/settings.service';
import { PERMISSION_KEYS } from '../shared/constants/permissions';
import logger from '../shared/utils/logger';

/**
 * Har bir ruxsat birinchi marta paydo bo'lganda — uni o'sha amalni roli tufayli
 * allaqachon bajara olgan xodimlarga bir marta berib chiqadi (permissions.ts
 * dagi `legacyRoles`). Shu bilan yangi ruxsat yoqilganda hech kimning ishi
 * to'xtab qolmaydi.
 *
 * Har bir ruxsat ALOHIDA belgilanadi (settings.json dagi `seededPermissionKeys`),
 * shuning uchun:
 *   • admin ruxsatni olib qo'ysa, server qayta ishga tushganda u qaytib kelmaydi;
 *   • keyinchalik qo'shilgan yangi ruxsat esa o'z navbatida taqsimlanadi.
 */
export async function initPermissions() {
  try {
    const alreadySeeded = await settingsService.getSeededPermissionKeys();
    const newKeys = PERMISSION_KEYS.filter((k) => !alreadySeeded.includes(k));

    if (newKeys.length === 0) return;

    const { granted } = await permissionsService.seedLegacyPermissions(newKeys);
    await settingsService.markPermissionsSeeded(newKeys);

    logger.info(
      `🔐 Yangi ruxsatlar taqsimlandi: ${newKeys.join(', ')} — ${granted} ta yozuv berildi`
    );
  } catch (error) {
    logger.error("❌ Ruxsatlarni boshlang'ich sozlashda xatolik:", error);
  }
}
