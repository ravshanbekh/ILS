import { lazy, type ComponentType } from 'react';

/**
 * Deploy'dan keyin "Failed to fetch dynamically imported module" xatosini yopadi.
 *
 * MUAMMO: sahifalar lazy (talab bo'yicha) yuklanadi va Vite har build'da fayl
 * nomiga yangi hash qo'yadi (LessonsPage-D8mpUvbu.js -> LessonsPage-XyZ123.js).
 * Yangi deploy'da eski fayllar serverdan o'chib ketadi. Brauzerda ALLAQACHON
 * ochiq turgan sahifa esa hali eski nomlarni biladi — foydalanuvchi yangi
 * bo'limga o'tsa, mavjud bo'lmagan faylni so'raydi va React qulab tushadi.
 *
 * YECHIM: chunk yuklanmasa sahifani bir marta yangilaymiz — brauzer yangi
 * index.html ni oladi, unda yangi fayl nomlari bo'ladi va hammasi tiklanadi.
 *
 * Cheksiz aylanishdan himoya: qayta yuklash 10 soniyada bir martadan ko'p
 * bo'lmaydi. Agar shundan keyin ham yuklanmasa (masalan internet uzilgan),
 * xato o'z yo'li bilan ketadi va ErrorBoundary uni ushlaydi.
 */

const RELOAD_KEY = 'ils:chunk-reload-at';
const RELOAD_COOLDOWN_MS = 10_000;

function shouldReload(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    return true;
  } catch {
    // sessionStorage yopiq bo'lsa (private rejim) — bir marta urinib ko'ramiz
    return true;
  }
}

export function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      if (shouldReload()) {
        window.location.reload();
        // Sahifa yangilanguncha React'ga hech narsa qaytarmaymiz
        return new Promise<{ default: T }>(() => {});
      }
      throw error;
    }
  });
}
