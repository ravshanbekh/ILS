import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { env } from './config/env';
import logger from './shared/utils/logger';
import { errorHandler } from './shared/middleware/errorHandler';
import { apiLimiter } from './shared/middleware/rateLimiter';
import { demoGuard } from './shared/middleware/demoGuard';
import { initSocket } from './shared/utils/socket';

import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import groupsRoutes from './modules/groups/groups.routes';
import normativesRoutes from './modules/normatives/normatives.routes';
import submissionsRoutes from './modules/submissions/submissions.routes';
import statisticsRoutes from './modules/statistics/statistics.routes';
import rankingsRoutes from './modules/rankings/rankings.routes';
import exportRoutes from './modules/export/export.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import backupRoutes from './modules/backup/backup.routes';
import settingsRoutes from './modules/settings/settings.routes';
import categoriesRoutes from './modules/categories/categories.routes';
import checklistRoutes from './modules/checklist/checklist.routes';
import freezesRoutes from './modules/freezes/freezes.routes';
import monitoringRoutes from './modules/monitoring/monitoring.routes';
import { notificationEngine } from './modules/notifications/notification-engine';
import chatbotRoutes from './modules/chatbot/chatbot.routes';
import predictionsRoutes from './modules/predictions/predictions.routes';
import feedbackRoutes from './modules/feedback/feedback.routes';
import { startBot } from './modules/bot/bot';
import botRoutes from './modules/bot/bot.routes';
import examRoutes from './modules/exam/exam.routes';
import liveQuizRoutes from './modules/live-quiz/live-quiz.routes';
import lessonsRoutes from './modules/lessons/lessons.routes';
import trashRoutes from './modules/trash/trash.routes';
import lessonSessionsRoutes from './modules/lesson-sessions/lesson-sessions.routes';
import { initSocketIO } from './modules/live-quiz/live-quiz.gateway';
import { startLessonSessionsScheduler } from './modules/lesson-sessions/lesson-sessions.scheduler';
import groupEventsRoutes from './modules/group-events/group-events.routes';
import appealsRoutes from './modules/appeals/appeals.routes';
import { startGroupEventsScheduler } from './modules/group-events/group-events.scheduler';
import eventFeedbackRoutes from './modules/event-feedback/event-feedback.routes';

const app = express();
app.set('trust proxy', 1); // nginx orqasida turgani uchun — rate limit va req.ip to'g'ri ishlashi uchun
const httpServer = createServer(app);

// Initsializatsiya Socket.io (mavjud)
const socketIoServer = initSocket(httpServer);
// Live Quiz Socket.IO
initSocketIO(socketIoServer);

// ============ MIDDLEWARE ============

// Xavfsizlik headerlari (X-Content-Type-Options, X-Frame-Options va h.k.)
// crossOriginResourcePolicy 'cross-origin' — frontend boshqa origin/portda turgani uchun
// /uploads dagi rasmlar va API javoblari bloklanmasligi kerak.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Serve uploads statically — jismoniy joyi data/uploads (persistent volume), URL /uploads bo'lib qoladi
// (docker-compose'da faqat /app/data volume qilingan — bevosita uploads/ ga yozilsa, har deployda o'chib ketardi)
app.use('/uploads', express.static(path.join(process.cwd(), 'data', 'uploads')));

// CORS
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parser — global kichik limit, katta hajm kerak bo'lgan route'larga (backup restore,
// bulk import) alohida limit shu route'larning o'zida beriladi.
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

// Rate limiting
app.use('/api/', apiLimiter);

// Demo mode guard
if (env.DEMO_MODE) {
  app.use('/api/', demoGuard);
  logger.info('🎭 Demo rejimi yoqildi — soxta ma\'lumotlar ishlatiladi');
}

// ============ ROUTES ============

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Normativ Tizim API ishlayapti! ✅',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/normatives', normativesRoutes);
app.use('/api/submissions', submissionsRoutes);
app.use('/api/stats', statisticsRoutes);
app.use('/api/rankings', rankingsRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/checklist', checklistRoutes);
app.use('/api/freezes', freezesRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/predictions', predictionsRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/exam', examRoutes);
app.use('/api/live-quiz', liveQuizRoutes);
app.use('/api/lessons', lessonsRoutes);
app.use('/api/trash', trashRoutes);
app.use('/api/bot', botRoutes);
app.use('/api/lesson-sessions', lessonSessionsRoutes);
app.use('/api/group-events', groupEventsRoutes);
app.use('/api/appeals', appealsRoutes);
app.use('/api/event-feedback', eventFeedbackRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { message: 'Endpoint topilmadi' },
  });
});

// Error handler (oxirida bo'lishi kerak)
app.use(errorHandler);

// ============ SERVER START ============

const startServer = async () => {
  try {
    // Database connection test
    const { default: prisma } = await import('./config/database');
    await prisma.$connect();
    logger.info('✅ PostgreSQL bilan bog\'landi');

    // Settings migratsiyasi (eski/xato Gemini modellarini tuzatish)
    try {
      const fs = await import('fs');
      const path = await import('path');
      const settingsPath = path.join(__dirname, '../data/settings.json');
      if (fs.existsSync(settingsPath)) {
        const raw = fs.readFileSync(settingsPath, 'utf-8');
        const settings = JSON.parse(raw);
        if (
          settings.geminiModel === 'gemini-3.5-flash' ||
          settings.geminiModel === 'gemini-2.5-pro' ||
          settings.geminiModel === 'gemini-2.0-flash'
        ) {
          settings.geminiModel = 'gemini-2.5-flash';
          fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
          logger.info('⚙️  Gemini modeli avtomatik ravishda gemini-2.5-flash ga migratsiya qilindi');
        }
      }
    } catch (err) {
      logger.error('⚠️  Settings migratsiyasida xatolik:', err);
    }

    // Boshlang'ich admin yaratish (INITIAL_ADMIN_* env orqali)
    const { initAdmin } = await import('./config/initAdmin');
    await initAdmin();

    httpServer.listen(env.PORT, () => {
      logger.info(`🚀 Server ishga tushdi: http://localhost:${env.PORT}`);
      logger.info(`📋 API: http://localhost:${env.PORT}/api/health`);
      logger.info(`🌐 Environment: ${env.NODE_ENV}`);
      
      // Smart notification checks
      setTimeout(() => {
        logger.info('⏰ Running smart notification engine initial checks...');
        notificationEngine.runChecks();
      }, 10000);
      setInterval(() => {
        logger.info('⏰ Running smart notification engine periodic checks...');
        notificationEngine.runChecks();
      }, 6 * 60 * 60 * 1000);
    });

    // Telegram bot (env yoki settings.json orqali ishga tushirish)
    try {
      startBot();
    } catch (botErr) {
      logger.error('⚠️ Telegram bot ishga tushirish xatosi:', botErr);
    }

    // Dars baholash tizimi: avto-yopish, ota-onaga xabar, kunlik nazorat
    startLessonSessionsScheduler();

    // Demo Day: taklifnoma va eslatmalar
    startGroupEventsScheduler();
  } catch (error) {
    logger.error('❌ Server ishga tushmadi:', error);
    process.exit(1);
  }
};

// Kutilmagan asinxron xatoliklar tufayli server to'xtab qolmasligi uchun
process.on('unhandledRejection', (reason, promise) => {
  logger.error('⚠️ Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('⚠️ Uncaught Exception:', error);
});

startServer();

export default app;
