import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import prisma from '../../config/database';
import type { JwtPayload } from '../middleware/auth.middleware';
import logger from './logger';

let io: SocketIOServer;

/**
 * Socket'ga biriktirilgan foydalanuvchi ma'lumoti.
 * Autentifikatsiyadan o'tmagan ulanishda `userId` bo'lmaydi.
 */
type SocketUser = { userId?: string };

export const initSocket = (server: HttpServer) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: env.CORS_ORIGIN,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // DDoS/flood himoyasi: bitta xabar hajmi cheklangan (katta payload bilan
    // xotirani to'ldirishga qarshi) va o'lik ulanishlar tez tozalanadi.
    maxHttpBufferSize: 1e6, // 1 MB — bundan katta xabar ulanishni uzadi
    pingInterval: 25_000,
    pingTimeout: 20_000,
    connectTimeout: 10_000, // handshake shuncha vaqtda tugamasa — uzamiz
  });

  /**
   * IXTIYORIY autentifikatsiya.
   *
   * Ulanish RAD ETILMAYDI: Live Quiz'ga o'quvchilar tizimga kirmasdan, faqat
   * kod bilan qo'shiladi (live-quiz.gateway.ts, 'join-room'). Majburiy token
   * talab qilsak o'sha oqim buziladi.
   *
   * Shuning uchun token bo'lsa tekshiramiz va socket'ga biriktiramiz; bo'lmasa
   * ulanish anonim qoladi va shaxsiy xonaga kira olmaydi.
   */
  io.use(async (socket: Socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string' || !token) return next();

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { isActive: true, tokenVersion: true },
      });

      // HTTP tarafdagi `authenticate` bilan bir xil shartlar: foydalanuvchi
      // faol bo'lishi va tokeni bekor qilinmagan bo'lishi kerak.
      if (user && user.isActive && (decoded.tv ?? 0) === user.tokenVersion) {
        (socket.data as SocketUser).userId = decoded.userId;
      }
    } catch {
      // Yaroqsiz/muddati o'tgan token — anonim ulanish sifatida davom etadi.
    }

    next();
  });

  io.on('connection', (socket) => {
    logger.info(`🔌 Socket ulandi: ${socket.id}`);

    /**
     * Shaxsiy bildirishnoma xonasi.
     *
     * MIJOZ YUBORGAN ID GA ISHONILMAYDI. Ilgari `socket.join(userId)` deb
     * mijoz bergan qiymat ishlatilardi — ya'ni istalgan odam ulanib
     * `join('<admin-id>')` yuborsa, o'sha adminning barcha bildirishnomalarini
     * (baho, tanga, topshiriq — ism va natijalar bilan) real vaqtda o'qiy
     * olardi. Endi faqat token tasdiqlagan ID ishlatiladi.
     */
    socket.on('join', () => {
      const userId = (socket.data as SocketUser).userId;
      if (!userId) {
        logger.warn(`⛔ Autentifikatsiyasiz 'join' urinishi: ${socket.id}`);
        return;
      }
      socket.join(userId);
      logger.info(`👤 User ${userId} xonaga qo'shildi (${socket.id})`);
    });

    socket.on('disconnect', () => {
      logger.info(`🔌 Socket uzildi: ${socket.id}`);
    });
  });

  return io;
};

export const getSocketIO = () => {
  if (!io) {
    throw new Error('Socket.io initsializatsiya qilinmagan!');
  }
  return io;
};

export const emitToUser = (userId: string, event: string, data: any) => {
  if (io) {
    io.to(userId).emit(event, data);
  }
};

export const emitToAll = (event: string, data: any) => {
  if (io) {
    io.emit(event, data);
  }
};
