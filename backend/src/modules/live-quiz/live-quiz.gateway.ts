import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import prisma from '../../config/database';

let io: SocketIOServer | null = null;

// Lobby'da socket uzilganda darhol o'chirmaymiz — refresh yoki telefonda
// boshqa ilovaga o'tish ham "disconnect" beradi. Shu muddat ichida qayta
// ulanmasa (join-room kelmasa), o'shanda lobby'dan chiqariladi.
const DISCONNECT_GRACE_MS = 60 * 1000;

export function initSocketIO(socketIoServer: SocketIOServer) {
  io = socketIoServer;

  const socketToPlayerMap = new Map<string, { playerId: string; code: string }>();
  // Bitta o'yinchi bir nechta socket bilan ulanishi mumkin (eski socket hali
  // yopilmasdan yangi ochilishi) — shuning uchun to'plam sifatida yuritamiz.
  const playerSockets = new Map<string, Set<string>>();
  const pendingRemovals = new Map<string, NodeJS.Timeout>();

  io.on('connection', (socket) => {
    console.log(`[Socket] Yangi ulanish: ${socket.id}`);

    // O'quvchi/o'qituvchi quiz xonasiga qo'shiladi
    socket.on('join-room', ({ code, role, playerId }) => {
      socket.join(`quiz-${code}`);
      if (role === 'player' && playerId) {
        socketToPlayerMap.set(socket.id, { playerId, code });

        if (!playerSockets.has(playerId)) playerSockets.set(playerId, new Set());
        playerSockets.get(playerId)!.add(socket.id);

        // Qayta ulandi — rejalashtirilgan o'chirishni bekor qilamiz
        const pending = pendingRemovals.get(playerId);
        if (pending) {
          clearTimeout(pending);
          pendingRemovals.delete(playerId);
          console.log(`[Socket] Player ${playerId} qayta ulandi — lobby'dan o'chirish bekor qilindi`);
        }
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

    socket.on('disconnect', () => {
      console.log(`[Socket] Uzildi: ${socket.id}`);
      const p = socketToPlayerMap.get(socket.id);
      if (!p) return;
      socketToPlayerMap.delete(socket.id);

      const sockets = playerSockets.get(p.playerId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size > 0) return; // boshqa faol ulanishi bor — hech narsa qilmaymiz
        playerSockets.delete(p.playerId);
      }

      // Grace period: shu vaqt ichida qayta ulanmasa, lobby'dan chiqariladi.
      // Faqat 'waiting' holatda o'chiramiz — o'yin boshlangach o'quvchi
      // uzilib qolsa ham natijalari saqlanib qoladi.
      const timeout = setTimeout(async () => {
        pendingRemovals.delete(p.playerId);
        if (playerSockets.has(p.playerId)) return; // ulgurib qayta ulangan
        try {
          const player = await prisma.liveQuizPlayer.findUnique({
            where: { id: p.playerId },
            include: { quiz: true },
          });
          if (player && player.quiz.status === 'waiting') {
            await prisma.liveQuizPlayer.delete({ where: { id: p.playerId } });
            const playerCount = await prisma.liveQuizPlayer.count({ where: { quizId: player.quizId } });
            io?.to(`quiz-${p.code}`).emit('quiz:player-left', { playerId: p.playerId, playerCount });
            console.log(`[Socket] Player ${player.fullName} qayta ulanmadi — lobby'dan o'chirildi`);
          }
        } catch (e) {
          console.error('[Socket] Grace-period cleanup xatosi:', e);
        }
      }, DISCONNECT_GRACE_MS);

      pendingRemovals.set(p.playerId, timeout);
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}
