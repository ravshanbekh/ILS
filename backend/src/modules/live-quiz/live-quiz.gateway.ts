import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import prisma from '../../config/database';

let io: SocketIOServer | null = null;

export function initSocketIO(socketIoServer: SocketIOServer) {
  io = socketIoServer;

  const socketToPlayerMap = new Map<string, { playerId: string; code: string }>();

  io.on('connection', (socket) => {
    console.log(`[Socket] Yangi ulanish: ${socket.id}`);

    // O'quvchi/o'qituvchi quiz xonasiga qo'shiladi
    socket.on('join-room', ({ code, role, playerId }) => {
      socket.join(`quiz-${code}`);
      if (role === 'player' && playerId) {
        socketToPlayerMap.set(socket.id, { playerId, code });
      }
      console.log(`[Socket] ${socket.id} quiz-${code} ga qo'shildi (${role})`);
    });

    // O'qituvchi: navbatdagi savolga o'tish (real-time trigger)
    socket.on('teacher:next-question', ({ code, questionData }) => {
      socket.to(`quiz-${code}`).emit('quiz:question', questionData);
    });

    // O'quvchi: javob berdim (o'qituvchi panelida ko'rinadi)
    socket.on('player:answered', ({ code, playerId, fullName, isCorrect }) => {
      socket.to(`quiz-${code}`).emit('quiz:answer-received', { playerId, fullName, isCorrect });
    });

    socket.on('disconnect', async () => {
      console.log(`[Socket] Uzildi: ${socket.id}`);
      const p = socketToPlayerMap.get(socket.id);
      if (p) {
        socketToPlayerMap.delete(socket.id);
        try {
          const player = await prisma.liveQuizPlayer.findUnique({
            where: { id: p.playerId },
            include: { quiz: true }
          });
          if (player && player.quiz.status === 'waiting') {
            await prisma.liveQuizPlayer.delete({ where: { id: p.playerId } });
            const playerCount = await prisma.liveQuizPlayer.count({ where: { quizId: player.quizId } });
            io?.to(`quiz-${p.code}`).emit('quiz:player-left', { playerId: p.playerId, playerCount });
            console.log(`[Socket] Player ${player.fullName} disconnected & removed from lobby`);
          }
        } catch (e) {
          console.error('[Socket] Disconnect error:', e);
        }
      }
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}
