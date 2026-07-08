import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';

let io: SocketIOServer | null = null;

export function initSocketIO(socketIoServer: SocketIOServer) {
  io = socketIoServer;

  io.on('connection', (socket) => {
    console.log(`[Socket] Yangi ulanish: ${socket.id}`);

    // O'quvchi/o'qituvchi quiz xonasiga qo'shiladi
    socket.on('join-room', ({ code, role }) => {
      socket.join(`quiz-${code}`);
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
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}
