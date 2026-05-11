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
