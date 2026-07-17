import dotenv from 'dotenv';
dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),

  // Database
  DATABASE_URL: process.env.DATABASE_URL || '',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),

  // Initial Admin (serverga birinchi ulanganda avtomatik yaratiladi)
  INITIAL_ADMIN_LOGIN: process.env.INITIAL_ADMIN_LOGIN || '',
  INITIAL_ADMIN_PASSWORD: process.env.INITIAL_ADMIN_PASSWORD || '',
  INITIAL_ADMIN_FULLNAME: process.env.INITIAL_ADMIN_FULLNAME || 'Administrator',

  isDev: process.env.NODE_ENV === 'development',
  isProd: process.env.NODE_ENV === 'production',

  // Demo rejim (taqdimot uchun)
  DEMO_MODE: process.env.DEMO_MODE === 'true',

  // Telegram Bot
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
};

// Production'da zaif yoki yo'q JWT secretlar bilan ishga tushishni oldini olish
if (env.isProd) {
  if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
    throw new Error('PRODUCTION XATO: JWT_SECRET va JWT_REFRESH_SECRET .env da majburiy!');
  }
  if (env.JWT_SECRET === 'dev-secret' || env.JWT_SECRET.length < 32) {
    throw new Error('PRODUCTION XATO: JWT_SECRET juda qisqa yoki default qiymatda!');
  }
  if (env.JWT_REFRESH_SECRET === 'dev-refresh-secret' || env.JWT_REFRESH_SECRET.length < 32) {
    throw new Error('PRODUCTION XATO: JWT_REFRESH_SECRET juda qisqa yoki default qiymatda!');
  }
}
