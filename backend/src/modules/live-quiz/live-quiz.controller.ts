import { Request, Response } from 'express';
import prisma from '../../config/database';
import path from 'path';
import fs from 'fs';
import { getIO } from './live-quiz.gateway';

// ─── Kod generator ───────────────────────────────────────────────────────────
async function genUniqueCode(): Promise<string> {
  let code = Math.floor(100000 + Math.random() * 900000).toString();
  while (await prisma.liveQuiz.findFirst({ where: { code, status: { not: 'finished' } } })) {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  }
  return code;
}

// ─── O'qituvchi/Admin: Quiz yaratish ─────────────────────────────────────────
export const createQuiz = async (req: Request, res: Response) => {
  try {
    const { title, description, timePerQ = 20, isGlobal = false } = req.body;
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;

    // Faqat admin global quiz yarata oladi
    const canBeGlobal = userRole === 'admin' && isGlobal;

    const code = await genUniqueCode();

    const quiz = await prisma.liveQuiz.create({
      data: {
        title,
        description: description || null,
        code,
        createdBy: { connect: { id: userId } },
        timePerQ,
        isGlobal: canBeGlobal,
      },
    });
    res.status(201).json({ data: quiz });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── O'qituvchi/Admin: Mening quizlarim ─────────────────────────────────────
export const getMyQuizzes = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const quizzes = await prisma.liveQuiz.findMany({
      where: { createdById: userId },
      include: {
        _count: { select: { questions: true, players: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: quizzes });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── Global (Markaz) Quizlar — hamma o'qituvchilarga ─────────────────────────
export const getGlobalQuizzes = async (req: Request, res: Response) => {
  try {
    const quizzes = await prisma.liveQuiz.findMany({
      where: { isGlobal: true },
      include: {
        _count: { select: { questions: true, players: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: quizzes });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── Quiz batafsil ────────────────────────────────────────────────────────────
export const getQuizById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;

    // Admin global quizni, o'qituvchi o'z quizini ko'ra oladi, global quizni ham ko'ra oladi
    let quiz;
    if (userRole === 'admin') {
      quiz = await prisma.liveQuiz.findFirst({
        where: { id },
        include: {
          questions: { orderBy: { order: 'asc' } },
          players: { orderBy: { score: 'desc' } },
          createdBy: { select: { id: true, fullName: true } },
        },
      });
    } else {
      quiz = await prisma.liveQuiz.findFirst({
        where: { id, OR: [{ createdById: userId }, { isGlobal: true }] },
        include: {
          questions: { orderBy: { order: 'asc' } },
          players: { orderBy: { score: 'desc' } },
          createdBy: { select: { id: true, fullName: true } },
        },
      });
    }

    if (!quiz) return res.status(404).json({ error: 'Topilmadi' });
    res.json({ data: quiz });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── Quiz yangilash (faqat yaratuvchi/admin) ──────────────────────────────────
export const updateQuiz = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, timePerQ, isGlobal } = req.body;
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;

    const quiz = await prisma.liveQuiz.findUnique({ where: { id } });
    if (!quiz) return res.status(404).json({ error: 'Topilmadi' });

    // Ruxsat: admin hamma narsani, o'qituvchi faqat o'zini (va global quizni emas)
    if (userRole !== 'admin' && quiz.createdById !== userId) {
      return res.status(403).json({ error: 'Ruxsat yo\'q. Bu quiz siz yaratmagan.' });
    }
    if (userRole !== 'admin' && quiz.isGlobal) {
      return res.status(403).json({ error: 'Markaz quizini o\'zgartira olmaysiz.' });
    }

    const updated = await prisma.liveQuiz.update({
      where: { id },
      data: {
        title: title ?? quiz.title,
        description: description !== undefined ? description : quiz.description,
        timePerQ: timePerQ ?? quiz.timePerQ,
        ...(userRole === 'admin' && isGlobal !== undefined ? { isGlobal } : {}),
      },
    });
    res.json({ data: updated });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── Quiz o'chirish (faqat yaratuvchi, global bo'lmagan) ──────────────────────
export const deleteQuiz = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;

    const quiz = await prisma.liveQuiz.findUnique({ where: { id } });
    if (!quiz) return res.status(404).json({ error: 'Topilmadi' });

    if (userRole !== 'admin' && quiz.createdById !== userId) {
      return res.status(403).json({ error: 'Ruxsat yo\'q.' });
    }
    if (userRole !== 'admin' && quiz.isGlobal) {
      return res.status(403).json({ error: 'Markaz quizini o\'chira olmaysiz.' });
    }

    await prisma.liveQuiz.delete({ where: { id } });
    res.json({ message: 'Quiz o\'chirildi' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── Savol qo'shish ───────────────────────────────────────────────────────────
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

// ─── Bulk savol ───────────────────────────────────────────────────────────────
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

// ─── Savol o'chirish ──────────────────────────────────────────────────────────
export const deleteQuestion = async (req: Request, res: Response) => {
  try {
    await prisma.liveQuizQuestion.delete({ where: { id: req.params.qId } });
    res.json({ message: 'O\'chirildi' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── Rasm yuklash ─────────────────────────────────────────────────────────────
export const uploadQuizImage = async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Rasm yuklanmadi' });
    const imageUrl = `/uploads/quiz-images/${req.file.filename}`;
    res.json({ data: { imageUrl } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── Quizni boshlash — YANGI KOD generatsiya ─────────────────────────────────
export const startQuiz = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;

    // Global quiz ni o'qituvchi ham boshlashi mumkin, lekin faqat o'zi boshqaradi
    const existingQuiz = await prisma.liveQuiz.findUnique({
      where: { id },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
    if (!existingQuiz) return res.status(404).json({ error: 'Topilmadi' });

    // Ruxsat tekshirish
    if (userRole !== 'admin' && existingQuiz.createdById !== userId) {
      // Global quizni o'qituvchi boshqarish uchun nusxalash kerak
      return res.status(403).json({ error: 'Siz ushbu quizni boshqara olmaysiz. "Ishlatish" tugmasini bosing.' });
    }

    if (existingQuiz.questions.length === 0) {
      return res.status(400).json({ error: 'Savol yo\'q. Avval savol qo\'shing.' });
    }

    // Har safar yangi kod generatsiya qilish
    const newCode = await genUniqueCode();

    const quiz = await prisma.liveQuiz.update({
      where: { id },
      data: { status: 'waiting', currentQ: -1, code: newCode },
      include: { questions: { orderBy: { order: 'asc' } } },
    });

    res.json({ data: quiz });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── O'qituvchi Global Quizni o'z nomiga boshlash (nusxalash) ─────────────────
export const useGlobalQuiz = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    const original = await prisma.liveQuiz.findFirst({
      where: { id, isGlobal: true },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
    if (!original) return res.status(404).json({ error: 'Markaz quizi topilmadi' });

    const newCode = await genUniqueCode();

    // O'qituvchi uchun yangi "session" quizi yaratiladi
    const newQuiz = await prisma.liveQuiz.create({
      data: {
        title: original.title,
        description: original.description,
        code: newCode,
        createdBy: { connect: { id: userId } },
        timePerQ: original.timePerQ,
        isGlobal: false,
        status: 'waiting',
      },
    });

    // Savollarni nusxalash
    if (original.questions.length > 0) {
      await prisma.liveQuizQuestion.createMany({
        data: original.questions.map((q, i) => ({
          quizId: newQuiz.id,
          question: q.question,
          options: q.options as any,
          correct: q.correct,
          order: i,
          imageUrl: q.imageUrl,
        })),
      });
    }

    // To'liq ma'lumot qaytarish
    const fullQuiz = await prisma.liveQuiz.findUnique({
      where: { id: newQuiz.id },
      include: { questions: { orderBy: { order: 'asc' } } },
    });

    res.status(201).json({ data: fullQuiz });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── O'yin boshlash (status active, 1-savol yuborish) ─────────────────────────
export const launchQuiz = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const quiz = await prisma.liveQuiz.update({
      where: { id },
      data: { status: 'active', currentQ: 0 },
      include: { questions: { orderBy: { order: 'asc' } } },
    });

    const io = getIO();
    if (io && quiz.questions.length > 0) {
      const firstQ = quiz.questions[0];
      io.to(`quiz-${quiz.code}`).emit('quiz:started', {
        question: {
          id: firstQ.id,
          question: firstQ.question,
          options: firstQ.options,
          imageUrl: firstQ.imageUrl,
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

// ─── Leaderboard ko'rsatish (Natija fazasi) ───────────────────────────────────
// Faqat leaderboard emit qiladi, keyingi savolni AVTOMATIK yubormaydi.
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
      return res.status(400).json({ error: 'Oxirgi savolga yetildi. Quizni yakunlang.' });
    }

    // currentQ ni yangilaymiz (keyingi showQuestion chaqirida ishlatiladi)
    await prisma.liveQuiz.update({ where: { id }, data: { currentQ: nextIndex } });

    const players = await prisma.liveQuizPlayer.findMany({
      where: { quizId: id },
      orderBy: { score: 'desc' },
    });

    const prevQ = quiz.questions[quiz.currentQ];
    const answers = await prisma.liveQuizAnswer.findMany({
      where: { questionId: prevQ.id },
    });
    const optionCounts = [0, 1, 2, 3].map(i => ({
      option: i,
      count: answers.filter(a => a.selected === i).length,
      isCorrect: i === prevQ.correct,
    }));

    const io = getIO();
    if (io) {
      // Faqat leaderboard — keyingi savolni O'QITUVCHI tugmasi bosishi bilan yuboramiz
      io.to(`quiz-${quiz.code}`).emit('quiz:leaderboard', {
        players: players.map((p, i) => ({ rank: i + 1, fullName: p.fullName, score: p.score, streak: p.streak, id: p.id })),
        prevQuestion: {
          question: prevQ.question,
          correct: prevQ.correct,
          imageUrl: prevQ.imageUrl,
          optionCounts,
          totalAnswers: answers.length,
        },
        nextIndex,
        totalQuestions: quiz.questions.length,
      });
    }

    res.json({ message: 'Leaderboard yuborildi', nextIndex });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── Keyingi savolni yuborish (O'qituvchi tugmasi bosishi bilan) ───────────────
export const showQuestion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const quiz = await prisma.liveQuiz.findUnique({
      where: { id },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
    if (!quiz) return res.status(404).json({ error: 'Topilmadi' });

    const q = quiz.questions[quiz.currentQ];
    if (!q) return res.status(400).json({ error: 'Savol topilmadi' });

    const io = getIO();
    if (io) {
      io.to(`quiz-${quiz.code}`).emit('quiz:question', {
        id: q.id,
        question: q.question,
        options: q.options,
        imageUrl: q.imageUrl,
        timePerQ: quiz.timePerQ,
        index: quiz.currentQ,
        total: quiz.questions.length,
        startedAt: Date.now(), // Taymer sinxronlash uchun
      });
    }

    res.json({ message: 'Savol yuborildi', index: quiz.currentQ });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── Quizni yakunlash ─────────────────────────────────────────────────────────
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

// ─── Batafsil statistika ──────────────────────────────────────────────────────
export const getQuizStats = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const quiz = await prisma.liveQuiz.findUnique({
      where: { id },
      include: {
        questions: {
          include: {
            answers: {
              include: { player: { select: { id: true, fullName: true, score: true } } },
            },
          },
          orderBy: { order: 'asc' },
        },
        players: { orderBy: { score: 'desc' } },
      },
    });
    if (!quiz) return res.status(404).json({ error: 'Topilmadi' });

    // Har bir savol uchun tahlil
    const questionAnalysis = quiz.questions.map(q => {
      const totalAnswers = q.answers.length;
      const correctAnswers = q.answers.filter(a => a.isCorrect).length;
      const optionDistribution = [0, 1, 2, 3].map(i => ({
        option: i,
        label: (q.options as string[])[i] || '',
        count: q.answers.filter(a => a.selected === i).length,
        isCorrect: i === q.correct,
        percentage: totalAnswers > 0 ? Math.round((q.answers.filter(a => a.selected === i).length / totalAnswers) * 100) : 0,
      }));

      return {
        id: q.id,
        question: q.question,
        imageUrl: q.imageUrl,
        correct: q.correct,
        options: q.options,
        totalAnswers,
        correctAnswers,
        incorrectAnswers: totalAnswers - correctAnswers,
        correctPercentage: totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0,
        avgTimeMs: totalAnswers > 0 ? Math.round(q.answers.reduce((sum, a) => sum + a.timeMs, 0) / totalAnswers) : 0,
        optionDistribution,
      };
    });

    // Har bir o'yinchi uchun batafsil
    const playerDetails = quiz.players.map(player => {
      const playerAnswers = quiz.questions.map(q => {
        const answer = q.answers.find(a => a.player.id === player.id);
        return {
          questionId: q.id,
          question: q.question,
          selected: answer?.selected ?? null,
          isCorrect: answer?.isCorrect ?? false,
          points: answer?.points ?? 0,
          timeMs: answer?.timeMs ?? 0,
        };
      });

      const correctCount = playerAnswers.filter(a => a.isCorrect).length;
      return {
        id: player.id,
        fullName: player.fullName,
        score: player.score,
        rank: player.rank,
        streak: player.streak,
        correctCount,
        totalQuestions: quiz.questions.length,
        accuracy: quiz.questions.length > 0 ? Math.round((correctCount / quiz.questions.length) * 100) : 0,
        answers: playerAnswers,
      };
    });

    res.json({
      data: {
        quiz: {
          id: quiz.id,
          title: quiz.title,
          code: quiz.code,
          status: quiz.status,
          timePerQ: quiz.timePerQ,
          totalQuestions: quiz.questions.length,
          totalPlayers: quiz.players.length,
        },
        leaderboard: quiz.players.map((p, i) => ({ ...p, rank: i + 1 })),
        questionAnalysis,
        playerDetails,
      },
    });
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

    const io = getIO();
    if (io) {
      io.to(`quiz-${quiz.code}`).emit('quiz:player-joined', {
        playerId: player.id,
        fullName: player.fullName,
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

    // Allaqachon javob berganmi?
    const existing = await prisma.liveQuizAnswer.findUnique({ where: { playerId_questionId: { playerId, questionId } } });
    if (existing) return res.json({ data: { isCorrect: existing.isCorrect, points: existing.points, streak: player.streak, correct: question.correct } });

    const isCorrect = question.correct === selected;
    const maxTime = player.quiz.timePerQ * 1000;
    const timeRatio = Math.max(0, 1 - timeMs / maxTime);
    let points = isCorrect ? Math.round(500 + 500 * timeRatio) : 0;

    const newStreak = isCorrect ? player.streak + 1 : 0;
    if (isCorrect && newStreak >= 2) {
      points += 50 * Math.min(newStreak - 1, 10);
    }

    await prisma.liveQuizAnswer.create({
      data: { playerId, questionId, selected, isCorrect, timeMs, points },
    });

    await prisma.liveQuizPlayer.update({
      where: { id: playerId },
      data: { score: player.score + points, streak: newStreak },
    });

    // Real-time: barcha o'yinchilar va o'qituvchiga yangilangan reyting
    const allPlayers = await prisma.liveQuizPlayer.findMany({
      where: { quizId: player.quizId },
      orderBy: { score: 'desc' },
    });
    const answeredCount = await prisma.liveQuizAnswer.count({
      where: { questionId },
    });

    const io = getIO();
    if (io) {
      // Kimlar javob berdi va ballar
      io.to(`quiz-${player.quiz.code}`).emit('quiz:score-update', {
        players: allPlayers.map((p, i) => ({
          id: p.id,
          fullName: p.fullName,
          score: p.score,
          rank: i + 1,
          streak: p.streak,
        })),
        answeredCount,
        latestAnswer: { playerId, fullName: player.fullName, isCorrect, points },
      });
    }

    res.json({ data: { isCorrect, points, streak: newStreak, correct: question.correct } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};
