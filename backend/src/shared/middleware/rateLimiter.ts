import rateLimit from 'express-rate-limit';
import { env } from '../../config/env';

// Umumiy API rate limiter
export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  message: {
    success: false,
    error: { message: 'Juda ko\'p so\'rov. Biroz kuting.' },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Login uchun maxsus limiter (qattiqroq)
export const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 daqiqa
  max: 5, // 5 urinish
  message: {
    success: false,
    error: { message: 'Juda ko\'p login urinishi. 1 daqiqa kuting.' },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * AI (sun'iy intellekt) endpointlari uchun limiter.
 *
 * Bu chaqiruvlar tashqi API ga boradi — ya'ni HAR BIRI PUL turadi va bir necha
 * sekund davom etadi. Umumiy 100/daqiqa limiti bu yerda juda bo'sh: bitta
 * o'quvchi ham hisobni bo'shatib, ham serverni band qilib qo'yishi mumkin edi.
 *
 * IP emas, FOYDALANUVCHI bo'yicha sanaymiz — bir sinfdagi bolalar bitta Wi-Fi
 * (bitta IP) dan kirishadi, IP bo'yicha sanasak halol o'quvchilar bir-birini
 * bloklab qo'yardi.
 */
export const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 daqiqa
  max: 15, // foydalanuvchiga 10 daqiqada 15 ta AI so'rovi
  keyGenerator: (req) => req.user?.userId || req.ip || 'anon',
  message: {
    success: false,
    error: { message: 'AI so\'rovlari limiti tugadi. Bir necha daqiqadan keyin urinib ko\'ring.' },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * "Og'ir" endpointlar uchun (eksport, zaxira nusxa) — javob hajmi katta,
 * bir nechta so'rov kanalni to'ldirib qo'yishi mumkin.
 */
export const heavyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 daqiqa
  max: 20,
  keyGenerator: (req) => req.user?.userId || req.ip || 'anon',
  message: {
    success: false,
    error: { message: 'Juda ko\'p og\'ir so\'rov. Biroz kuting.' },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
