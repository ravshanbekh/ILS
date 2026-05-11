import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { env } from '../../config/env';
import logger from './logger';

let io: SocketIOServer;

export const initSocket = (server: HttpServer) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: env.CORS_ORIGIN,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    logger.info(`🔌 Socket ulandi: ${socket.id}`);

    // Foydalanuvchi o'zining ID si bilan xonaga (room) qo'shiladi
    socket.on('join', (userId: string) => {
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
