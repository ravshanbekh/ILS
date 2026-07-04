import { Request, Response } from 'express';
import prisma from '../../config/database';

import { getIO } from './live-quiz.gateway';

// ─── Kod generator ───────────────────────────────────────────────────────────
function genCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─── O'qituvchi: Quiz yaratish ───────────────────────────────────────────────
export const createQuiz = async (req: Request, res: Response) => {
  try {
    const { title, timePerQ = 20 } = req.body;
    const userId = (req as any).user?.userId;

    // Unikal 6 xonali kod
    let code = genCode();
    while (await prisma.liveQuiz.findFirst({ where: { code, status: { not: 'finished' } } })) {
      code = genCode();
    }

    const quiz = await prisma.liveQuiz.create({
      data: { title, code, createdBy: { connect: { id: userId } }, timePerQ },
    });
    res.status(201).json({ data: quiz });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── O'qituvchi: Mening quizlarim ───────────────────────────────────────────
export const getMyQuizzes = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const quizzes = await prisma.liveQuiz.findMany({
      where: { createdById: userId },
      include: { _count: { select: { questions: true, players: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: quizzes });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── O'qituvchi: Quiz batafsil ───────────────────────────────────────────────
export const getQuizById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;
    const quiz = await prisma.liveQuiz.findFirst({
      where: { id, createdById: userId },
      include: {
        questions: { orderBy: { order: 'asc' } },
        players: { orderBy: { score: 'desc' } },
      },
    });
    if (!quiz) return res.status(404).json({ error: 'Topilmadi' });
    res.json({ data: quiz });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── O'qituvchi: Savol qo'shish ─────────────────────────────────────────────
export const addQuestions = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { questions } = req.body;
    const existing = await prisma.liveQuizQuestion.count({ where: { quizId: id } });
    const data = (questions as any[]).map((q, i) => ({
      quizId: id,
      question: q.question,
      options: q.options,
      correct: q.correct,
      order: existing + i,
      imageUrl: q.imageUrl || null,
    }));
    await prisma.liveQuizQuestion.createMany({ data });
    res.status(201).json({ message: `${data.length} ta savol qo'shildi` });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── O'qituvchi: Bulk savol ──────────────────────────────────────────────────
export const bulkAddQuestions = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { questions } = req.body;
    await prisma.liveQuizQuestion.deleteMany({ where: { quizId: id } });
    const data = (questions as any[]).map((q, i) => ({
      quizId: id,
      question: q.question,
      options: q.options,
      correct: q.correct,
      order: i,
      imageUrl: q.imageUrl || null,
    }));
    await prisma.liveQuizQuestion.createMany({ data });
    res.json({ message: `${data.length} ta savol saqlandi` });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── O'qituvchi: Savol o'chirish ─────────────────────────────────────────────
export const deleteQuestion = async (req: Request, res: Response) => {
  try {
    await prisma.liveQuizQuestion.delete({ where: { id: req.params.qId } });
    res.json({ message: 'O\'chirildi' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── O'qituvchi: Quizni boshlash ─────────────────────────────────────────────
export const startQuiz = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const quiz = await prisma.liveQuiz.update({
      where: { id },
      data: { status: 'active', currentQ: 0 },
      include: { questions: { orderBy: { order: 'asc' } } },
    });

    // Socket orqali hamma o'yinchiga xabar berish
    const io = getIO();
    if (io) {
      const firstQ = quiz.questions[0];
      io.to(`quiz-${quiz.code}`).emit('quiz:started', {
        question: {
          id: firstQ.id,
          question: firstQ.question,
          options: firstQ.options,
          timePerQ: quiz.timePerQ,
          index: 0,
          total: quiz.questions.length,
        },
      });
    }

    res.json({ data: quiz });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── O'qituvchi: Keyingi savol ───────────────────────────────────────────────
export const nextQuestion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const quiz = await prisma.liveQuiz.findUnique({
      where: { id },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
    if (!quiz) return res.status(404).json({ error: 'Topilmadi' });

    const nextIndex = quiz.currentQ + 1;
    if (nextIndex >= quiz.questions.length) {
      return res.status(400).json({ error: 'Oxirgi savolga yetildi. finish qiling.' });
    }

    await prisma.liveQuiz.update({ where: { id }, data: { currentQ: nextIndex } });

    // Leaderboardni hisoblash
    const players = await prisma.liveQuizPlayer.findMany({
      where: { quizId: id },
      orderBy: { score: 'desc' },
    });

    // Oldingi savol statistikasi
    const prevQ = quiz.questions[quiz.currentQ];
    const answers = await prisma.liveQuizAnswer.findMany({
      where: { questionId: prevQ.id },
      include: { player: { select: { fullName: true } } },
    });
    const optionCounts = [0, 1, 2, 3].map(i => ({
      option: i,
      count: answers.filter(a => a.selected === i).length,
      isCorrect: i === prevQ.correct,
    }));

    const io = getIO();
    if (io) {
      // Leaderboard ko'rsatish
      io.to(`quiz-${quiz.code}`).emit('quiz:leaderboard', {
        players: players.map((p, i) => ({ rank: i + 1, fullName: p.fullName, score: p.score, streak: p.streak })),
        prevQuestion: { question: prevQ.question, correct: prevQ.correct, optionCounts },
      });

      // Keyin yangi savol
      setTimeout(() => {
        const nextQ = quiz.questions[nextIndex];
        io.to(`quiz-${quiz.code}`).emit('quiz:question', {
          id: nextQ.id,
          question: nextQ.question,
          options: nextQ.options,
          imageUrl: nextQ.imageUrl,
          timePerQ: quiz.timePerQ,
          index: nextIndex,
          total: quiz.questions.length,
        });
      }, 5000); // 5 soniya leaderboard ko'rsatib keyin yangi savol
    }

    res.json({ message: 'Keyingi savol yuborildi', index: nextIndex });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── O'qituvchi: Quizni yakunlash ────────────────────────────────────────────
export const finishQuiz = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const quiz = await prisma.liveQuiz.update({
      where: { id },
      data: { status: 'finished' },
    });

    const players = await prisma.liveQuizPlayer.findMany({
      where: { quizId: id },
      orderBy: { score: 'desc' },
    });

    // Rank ni saqlash
    for (let i = 0; i < players.length; i++) {
      await prisma.liveQuizPlayer.update({ where: { id: players[i].id }, data: { rank: i + 1 } });
    }

    const io = getIO();
    if (io) {
      io.to(`quiz-${quiz.code}`).emit('quiz:finished', {
        leaderboard: players.map((p, i) => ({ rank: i + 1, fullName: p.fullName, score: p.score })),
      });
    }

    res.json({ data: { quiz, playerCount: players.length } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── O'qituvchi: Real-time statistika ───────────────────────────────────────
export const getQuizStats = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const quiz = await prisma.liveQuiz.findUnique({
      where: { id },
      include: {
        questions: {
          include: {
            answers: {
              include: { player: { select: { fullName: true } } },
            },
          },
          orderBy: { order: 'asc' },
        },
        players: { orderBy: { score: 'desc' } },
      },
    });
    if (!quiz) return res.status(404).json({ error: 'Topilmadi' });
    res.json({ data: quiz });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── O'yinchi: Kodni tekshirish ───────────────────────────────────────────────
export const getQuizByCode = async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const quiz = await prisma.liveQuiz.findFirst({
      where: { code },
      include: { _count: { select: { players: true } } },
    });
    if (!quiz) return res.status(404).json({ error: 'Quiz topilmadi. Kodni tekshiring.' });
    if (quiz.status === 'finished') return res.status(410).json({ error: 'Quiz tugagan' });
    res.json({ data: { id: quiz.id, title: quiz.title, status: quiz.status, playerCount: (quiz as any)._count.players } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── O'yinchi: Kirish (ism bilan) ────────────────────────────────────────────
export const joinQuiz = async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const { fullName } = req.body;
    if (!fullName?.trim()) return res.status(400).json({ error: 'Ism majburiy' });

    const quiz = await prisma.liveQuiz.findFirst({ where: { code } });
    if (!quiz) return res.status(404).json({ error: 'Quiz topilmadi' });
    if (quiz.status === 'finished') return res.status(410).json({ error: 'Quiz tugagan' });

    const player = await prisma.liveQuizPlayer.create({
      data: { quizId: quiz.id, fullName: fullName.trim() },
    });

    // Socket xabar
    const io = getIO();
    if (io) {
      io.to(`quiz-${quiz.code}`).emit('quiz:player-joined', {
        playerId: player.id, fullName: player.fullName,
        playerCount: await prisma.liveQuizPlayer.count({ where: { quizId: quiz.id } }),
      });
    }

    res.json({ data: { player, quiz: { id: quiz.id, title: quiz.title, status: quiz.status, code: quiz.code } } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── O'yinchi: Javob yuborish ─────────────────────────────────────────────────
export const submitAnswer = async (req: Request, res: Response) => {
  try {
    const { playerId, questionId, selected, timeMs } = req.body;

    const player = await prisma.liveQuizPlayer.findUnique({ where: { id: playerId }, include: { quiz: true } });
    if (!player) return res.status(404).json({ error: 'O\'yinchi topilmadi' });

    const question = await prisma.liveQuizQuestion.findUnique({ where: { id: questionId } });
    if (!question) return res.status(404).json({ error: 'Savol topilmadi' });

    const isCorrect = question.correct === selected;

    // Tezlik ball: max 1000, kamida 0, vaqtga teskari
    const maxTime = player.quiz.timePerQ * 1000;
    const timeRatio = Math.max(0, 1 - timeMs / maxTime);
    let points = isCorrect ? Math.round(500 + 500 * timeRatio) : 0;

    // Streak bonus
    const newStreak = isCorrect ? player.streak + 1 : 0;
    if (isCorrect && newStreak >= 2) {
      points += 50 * Math.min(newStreak - 1, 10); // Max 500 bonus
    }

    await prisma.liveQuizAnswer.create({
      data: { playerId, questionId, selected, isCorrect, timeMs, points },
    });

    await prisma.liveQuizPlayer.update({
      where: { id: playerId },
      data: { score: player.score + points, streak: newStreak },
    });

    res.json({ data: { isCorrect, points, streak: newStreak, correct: question.correct } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};
