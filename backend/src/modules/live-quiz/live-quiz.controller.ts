import { Request, Response, NextFunction } from 'express';
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

function selectRandomQuestionIds(allQuestions: { id: string }[], limit = 20): string[] {
  const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, limit).map(q => q.id);
}

// Reveal qilingan savollar (idempotency himoyasi): bitta savol uchun
// leaderboard faqat BIR marta yuboriladi. O'qituvchi taymeri tugashi va
// "hamma javob berdi" triggeri bir vaqtda kelsa ham ikki marta o'tmaydi.
const revealedQuestions = new Map<string, Set<string>>();

function filterActiveQuestions(quiz: any) {
  if (!quiz) return quiz;
  const activeIds = quiz.activeQuestionIds as string[] | null;
  if (!activeIds || activeIds.length === 0) return quiz;
  const questionsMap = new Map(quiz.questions.map((q: any) => [q.id, q]));
  const activeQuestions = activeIds
    .map(id => questionsMap.get(id))
    .filter(q => q !== undefined);
  quiz.questions = activeQuestions;
  return quiz;
}

// ─── O'qituvchi/Admin: Quiz yaratish ─────────────────────────────────────────
export const createQuiz = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, timePerQ = 20, isGlobal = false, categoryId } = req.body;
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'Quiz nomi kerak' });
    }

    if (categoryId) {
      const category = await prisma.category.findUnique({ where: { id: categoryId } });
      if (!category) {
        return res.status(400).json({ error: 'Tanlangan kategoriya topilmadi — ro\'yxatni yangilab ko\'ring' });
      }
    }

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
        ...(categoryId ? { category: { connect: { id: categoryId } } } : {}),
      },
      include: {
        category: true,
        createdBy: { select: { id: true, fullName: true } },
      },
    });
    res.status(201).json({ data: quiz });
  } catch (e: any) {
    next(e);
  }
};

// ─── O'qituvchi/Admin: Mening quizlarim ─────────────────────────────────────
export const getMyQuizzes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const quizzes = await prisma.liveQuiz.findMany({
      where: { createdById: userId },
      include: {
        category: true,
        _count: { select: { questions: true, players: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: quizzes });
  } catch (e: any) {
    next(e);
  }
};

// ─── Global (Markaz) Quizlar — hamma o'qituvchilarga ─────────────────────────
export const getGlobalQuizzes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizzes = await prisma.liveQuiz.findMany({
      where: { isGlobal: true },
      include: {
        category: true,
        _count: { select: { questions: true, players: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: quizzes });
  } catch (e: any) {
    next(e);
  }
};

// ─── Quiz batafsil ────────────────────────────────────────────────────────────
export const getQuizById = async (req: Request, res: Response, next: NextFunction) => {
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
          music: true,
        },
      });
    } else {
      quiz = await prisma.liveQuiz.findFirst({
        where: { id, OR: [{ createdById: userId }, { isGlobal: true }] },
        include: {
          questions: { orderBy: { order: 'asc' } },
          players: { orderBy: { score: 'desc' } },
          createdBy: { select: { id: true, fullName: true } },
          music: true,
        },
      });
    }

    if (!quiz) return res.status(404).json({ error: 'Topilmadi' });
    if (quiz.status === 'active' || quiz.status === 'waiting') {
      filterActiveQuestions(quiz);
    }
    res.json({ data: quiz });
  } catch (e: any) {
    next(e);
  }
};

// ─── Quiz yangilash (faqat yaratuvchi/admin) ──────────────────────────────────
export const updateQuiz = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { title, description, timePerQ, isGlobal, categoryId } = req.body;
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
        ...(categoryId !== undefined ? (categoryId ? { categoryId } : { categoryId: null }) : {}),
        ...(userRole === 'admin' && isGlobal !== undefined ? { isGlobal } : {}),
      },
      include: {
        category: true,
        createdBy: { select: { id: true, fullName: true } },
      },
    });
    res.json({ data: updated });
  } catch (e: any) {
    next(e);
  }
};

// ─── Quiz o'chirish (faqat yaratuvchi, global bo'lmagan) ──────────────────────
export const deleteQuiz = async (req: Request, res: Response, next: NextFunction) => {
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
    next(e);
  }
};

// ─── Savol qo'shish ───────────────────────────────────────────────────────────
export const addQuestions = async (req: Request, res: Response, next: NextFunction) => {
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
    next(e);
  }
};

// ─── Bulk savol ───────────────────────────────────────────────────────────────
export const bulkAddQuestions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { questions } = req.body;
    if (!Array.isArray(questions)) {
      return res.status(400).json({ error: 'Savollar ro\'yxat ko\'rinishida bo\'lishi kerak' });
    }
    await prisma.liveQuizQuestion.deleteMany({ where: { quizId: id } });
    const data = questions.map((q, i) => ({
      quizId: id,
      question: String(q.question || ''),
      options: Array.isArray(q.options) ? q.options : [],
      correct: (typeof q.correct === 'number' && !isNaN(q.correct)) ? q.correct : 0,
      order: i,
      imageUrl: q.imageUrl || null,
    }));
    await prisma.liveQuizQuestion.createMany({ data });
    res.json({ message: `${data.length} ta savol saqlandi` });
  } catch (e: any) {
    next(e);
  }
};

// ─── Savol tahrirlash ─────────────────────────────────────────────────────────
export const updateQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { qId } = req.params;
    const { question, options, correct, imageUrl } = req.body;
    const updated = await prisma.liveQuizQuestion.update({
      where: { id: qId },
      data: {
        question,
        options,
        correct,
        ...(imageUrl !== undefined && { imageUrl }),
      },
    });
    res.json({ data: updated });
  } catch (e: any) {
    next(e);
  }
};

// ─── Savol o'chirish ──────────────────────────────────────────────────────────
export const deleteQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.liveQuizQuestion.delete({ where: { id: req.params.qId } });
    res.json({ message: 'O\'chirildi' });
  } catch (e: any) {
    next(e);
  }
};

// ─── Rasm yuklash ─────────────────────────────────────────────────────────────
export const uploadQuizImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Rasm yuklanmadi' });
    const imageUrl = `/uploads/quiz-images/${req.file.filename}`;
    res.json({ data: { imageUrl } });
  } catch (e: any) {
    next(e);
  }
};

// ─── Quizni boshlash — YANGI KOD generatsiya ─────────────────────────────────
export const startQuiz = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;
    const { musicId, groupId } = req.body || {};

    const existingQuiz = await prisma.liveQuiz.findUnique({
      where: { id },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
    if (!existingQuiz) return res.status(404).json({ error: 'Topilmadi' });

    if (existingQuiz.questions.length === 0) {
      return res.status(400).json({ error: 'Savol yo\'q. Avval savol qo\'shing.' });
    }

    if (groupId) {
      const group = await prisma.group.findUnique({ where: { id: groupId } });
      if (!group) return res.status(400).json({ error: 'Tanlangan guruh topilmadi — ro\'yxatni yangilab ko\'ring' });
    }

    if (musicId) {
      const music = await prisma.quizMusic.findUnique({ where: { id: musicId } });
      if (!music) return res.status(400).json({ error: 'Tanlangan musiqa topilmadi — ro\'yxatni yangilab ko\'ring' });
    }

    // Eski o'yinchilarni va ularning natijalarini tozalash
    await prisma.liveQuizPlayer.deleteMany({
      where: { quizId: id }
    });

    revealedQuestions.delete(id);

    // Har safar yangi kod generatsiya qilish
    const newCode = await genUniqueCode();

    const activeQuestionIds = selectRandomQuestionIds(existingQuiz.questions, 20);

    let quiz = await prisma.liveQuiz.update({
      where: { id },
      data: {
        status: 'waiting',
        currentQ: -1,
        code: newCode,
        activeQuestionIds,
        musicId: musicId || null,
        activeTeacherId: userId,
        groupId: groupId || null,
      },
      include: { questions: { orderBy: { order: 'asc' } }, music: true, group: true },
    });

    filterActiveQuestions(quiz);

    res.json({ data: quiz });
  } catch (e: any) {
    next(e);
  }
};

// ─── O'qituvchi Global Quizni o'z nomiga boshlash (nusxalash) ─────────────────
export const useGlobalQuiz = async (req: Request, res: Response, next: NextFunction) => {
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
    let fullQuiz = await prisma.liveQuiz.findUnique({
      where: { id: newQuiz.id },
      include: { questions: { orderBy: { order: 'asc' } }, music: true },
    });

    if (fullQuiz && fullQuiz.questions.length > 0) {
      const activeQuestionIds = selectRandomQuestionIds(fullQuiz.questions, 20);
      fullQuiz = await prisma.liveQuiz.update({
        where: { id: newQuiz.id },
        data: { activeQuestionIds },
        include: { questions: { orderBy: { order: 'asc' } }, music: true },
      });
    }

    filterActiveQuestions(fullQuiz);

    res.status(201).json({ data: fullQuiz });
  } catch (e: any) {
    next(e);
  }
};

// ─── O'yin boshlash (status active, 1-savol yuborish) ─────────────────────────
export const launchQuiz = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    revealedQuestions.delete(id);

    let quiz = await prisma.liveQuiz.update({
      where: { id },
      data: { status: 'active', currentQ: 0 },
      include: { questions: { orderBy: { order: 'asc' } }, music: true },
    });

    filterActiveQuestions(quiz);

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
    next(e);
  }
};

// ─── Leaderboard ko'rsatish (Natija fazasi) ───────────────────────────────────
// Faqat leaderboard emit qiladi, keyingi savolni AVTOMATIK yubormaydi.
// Uch joydan chaqiriladi: o'qituvchi taymeri tugaganda, o'qituvchi qo'lda
// "skip" bosganda va "hamma o'yinchi javob berdi" triggeridan (submitAnswer).
// expectedQuestionId — kechikkan trigger boshqa (yangi) savolni ochib
// yubormasligi uchun tekshiruv.
async function revealLeaderboard(quizId: string, expectedQuestionId?: string): Promise<
  { ok: true; nextIndex: number; isLast: boolean; skipped?: boolean } | { ok: false; status: number; error: string }
> {
  const quiz = await prisma.liveQuiz.findUnique({
    where: { id: quizId },
    include: { questions: { orderBy: { order: 'asc' } } },
  });
  if (!quiz) return { ok: false, status: 404, error: 'Topilmadi' };
  if (quiz.status !== 'active') return { ok: false, status: 400, error: 'Quiz faol emas' };

  filterActiveQuestions(quiz);

  const prevQ = quiz.questions[quiz.currentQ];
  if (!prevQ) return { ok: false, status: 400, error: 'Savol topilmadi' };

  const nextIndex = quiz.currentQ + 1;
  const isLast = nextIndex >= quiz.questions.length;

  // Kechikkan trigger — hozirgi savol boshqa bo'lsa hech narsa qilmaymiz
  if (expectedQuestionId && prevQ.id !== expectedQuestionId) {
    return { ok: true, nextIndex, isLast, skipped: true };
  }

  let revealed = revealedQuestions.get(quizId);
  if (!revealed) { revealed = new Set(); revealedQuestions.set(quizId, revealed); }
  if (revealed.has(prevQ.id)) return { ok: true, nextIndex, isLast, skipped: true };
  revealed.add(prevQ.id);

  // currentQ ni yangilaymiz (keyingi showQuestion chaqirig'ida ishlatiladi).
  // Oxirgi savolda oshirmaymiz — o'qituvchi "Yakunlash"ni bosadi.
  if (!isLast) {
    await prisma.liveQuiz.update({ where: { id: quizId }, data: { currentQ: nextIndex } });
  }

  const players = await prisma.liveQuizPlayer.findMany({
    where: { quizId },
    orderBy: { score: 'desc' },
  });

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
      isLast,
    });
  }

  return { ok: true, nextIndex, isLast };
}

export const nextQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { questionId } = (req.body || {}) as { questionId?: string };
    const result = await revealLeaderboard(id, questionId);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.json({ message: 'Leaderboard yuborildi', nextIndex: result.nextIndex, isLast: result.isLast, skipped: result.skipped ?? false });
  } catch (e: any) {
    next(e);
  }
};

// ─── Keyingi savolni yuborish (O'qituvchi tugmasi bosishi bilan) ───────────────
export const showQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const quiz = await prisma.liveQuiz.findUnique({
      where: { id },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
    if (!quiz) return res.status(404).json({ error: 'Topilmadi' });

    filterActiveQuestions(quiz);

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
    next(e);
  }
};

// ─── Quizni yakunlash ─────────────────────────────────────────────────────────
export const finishQuiz = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    revealedQuestions.delete(id);
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

    // Save or overwrite latest results for this Teacher + Group + Quiz
    const teacherId = quiz.activeTeacherId || quiz.createdById;
    const groupId = quiz.groupId || '';
    const leaderboardData = players.map((p, i) => ({ rank: i + 1, fullName: p.fullName, score: p.score, streak: p.streak }));

    if (teacherId) {
      await prisma.liveQuizResult.upsert({
        where: {
          quizId_groupId_teacherId: {
            quizId: id,
            groupId,
            teacherId,
          },
        },
        create: {
          quizId: id,
          groupId,
          teacherId,
          quizTitle: quiz.title,
          leaderboard: leaderboardData,
          totalPlayers: players.length,
        },
        update: {
          quizTitle: quiz.title,
          leaderboard: leaderboardData,
          totalPlayers: players.length,
          updatedAt: new Date(),
        },
      });
    }

    const io = getIO();
    if (io) {
      io.to(`quiz-${quiz.code}`).emit('quiz:finished', {
        leaderboard: players.map((p, i) => ({ rank: i + 1, fullName: p.fullName, score: p.score })),
      });
    }

    res.json({ data: { quiz, playerCount: players.length } });
  } catch (e: any) {
    next(e);
  }
};

// ─── O'qituvchi o'tkazgan quizlar natijalari (Guruhlar bo'yicha) ───────────────
export const getQuizResults = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;

    const where = userRole === 'admin' ? {} : { teacherId: userId };
    const results = await prisma.liveQuizResult.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });

    const teacherGroups = userRole === 'admin'
      ? await prisma.group.findMany({ where: { isActive: true }, select: { id: true, name: true } })
      : await prisma.group.findMany({ where: { teacherId: userId, isActive: true }, select: { id: true, name: true } });

    res.json({ data: { results, groups: teacherGroups } });
  } catch (e: any) {
    next(e);
  }
};

// ─── Batafsil statistika ──────────────────────────────────────────────────────
export const getQuizStats = async (req: Request, res: Response, next: NextFunction) => {
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

    filterActiveQuestions(quiz);

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
    next(e);
  }
};

// ─── O'yinchi: Kodni tekshirish ───────────────────────────────────────────────
export const getQuizByCode = async (req: Request, res: Response, next: NextFunction) => {
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
    next(e);
  }
};

// ─── O'yinchi: Kirish (ism bilan) ────────────────────────────────────────────
export const joinQuiz = async (req: Request, res: Response, next: NextFunction) => {
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
    next(e);
  }
};

// ─── O'yinchi: Sessiyani tiklash (refresh'dan keyin) ─────────────────────────
// localStorage'dagi sessiya tiklanganda chaqiriladi. Agar o'yinchi DB'da hali
// bor bo'lsa — o'shani qaytaradi. Agar o'chirilgan bo'lsa (masalan, lobby'da
// uzilib qolib tozalangan) — xuddi shu ism bilan qayta yaratadi. Shu tufayli
// "bola o'ynayapti-yu, o'qituvchi ro'yxatida yo'q" (ghost player) holati
// o'z-o'zidan davolanadi.
export const rejoinQuiz = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.params;
    const { playerId, fullName } = req.body;

    const quiz = await prisma.liveQuiz.findFirst({ where: { code } });
    if (!quiz) return res.status(404).json({ error: 'Quiz topilmadi' });
    if (quiz.status === 'finished') return res.status(410).json({ error: 'Quiz tugagan' });

    let player = typeof playerId === 'string' && playerId
      ? await prisma.liveQuizPlayer.findFirst({ where: { id: playerId, quizId: quiz.id } })
      : null;

    let recreated = false;
    if (!player) {
      if (!fullName?.trim()) return res.status(400).json({ error: 'Ism majburiy' });
      player = await prisma.liveQuizPlayer.create({
        data: { quizId: quiz.id, fullName: fullName.trim() },
      });
      recreated = true;

      const io = getIO();
      if (io) {
        io.to(`quiz-${quiz.code}`).emit('quiz:player-joined', {
          playerId: player.id,
          fullName: player.fullName,
          playerCount: await prisma.liveQuizPlayer.count({ where: { quizId: quiz.id } }),
        });
      }
    }

    const playerCount = await prisma.liveQuizPlayer.count({ where: { quizId: quiz.id } });
    res.json({
      data: {
        player,
        recreated,
        quiz: { id: quiz.id, title: quiz.title, status: quiz.status, code: quiz.code, playerCount },
      },
    });
  } catch (e: any) {
    next(e);
  }
};

// ─── O'yinchi: Ismni o'zgartirish ────────────────────────────────────────────
export const updatePlayerName = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { playerId } = req.params;
    const { fullName } = req.body;
    if (!fullName?.trim()) return res.status(400).json({ error: 'Ism majburiy' });

    const player = await prisma.liveQuizPlayer.update({
      where: { id: playerId },
      data: { fullName: fullName.trim() },
      include: { quiz: true },
    });

    const io = getIO();
    if (io) {
      // O'qituvchiga ro'yxatni yangilash uchun event
      const players = await prisma.liveQuizPlayer.findMany({
        where: { quizId: player.quizId },
        orderBy: { score: 'desc' },
      });
      io.to(`quiz-${player.quiz.code}`).emit('quiz:score-update', {
        players: players.map((p, i) => ({ ...p, rank: i + 1 })),
        answeredCount: 0,
      });
    }
    res.json({ data: player });
  } catch (e: any) {
    next(e);
  }
};

// ─── O'qituvchi: O'yinchini chiqarib yuborish ─────────────────────────────────
export const kickPlayer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, playerId } = req.params;
    const userId = (req as any).user?.userId;

    const quiz = await prisma.liveQuiz.findUnique({ where: { id } });
    if (!quiz || quiz.createdById !== userId) return res.status(403).json({ error: 'Ruxsat yo\'q' });

    await prisma.liveQuizPlayer.delete({ where: { id: playerId } });

    const io = getIO();
    if (io) {
      io.to(`quiz-${quiz.code}`).emit('quiz:player-kicked', { playerId });
      // Qolganlar uchun o'yinchilar sonini yangilash
      const playerCount = await prisma.liveQuizPlayer.count({ where: { quizId: quiz.id } });
      io.to(`quiz-${quiz.code}`).emit('quiz:player-left', { playerId, playerCount });
    }
    res.json({ success: true });
  } catch (e: any) {
    next(e);
  }
};


// ─── O'yinchi: Javob yuborish ─────────────────────────────────────────────────
export const submitAnswer = async (req: Request, res: Response, next: NextFunction) => {
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
    // Oddiy holat: tezlikka qarab 500..1000 ball
    let points = isCorrect ? Math.round(500 + 500 * timeRatio) : 0;

    const newStreak = isCorrect ? player.streak + 1 : 0;
    // Streak bonusi 3-streakda maksimumga yetadi va undan keyin O'SMAYDI:
    // 2-streak: +100 (maks 1100), 3+ streak: +200 (maks 1200).
    // 4, 5, 10... streaklarda ham bonus +200 ligicha qoladi — jami ball
    // hech qachon 1200 dan oshmaydi.
    if (isCorrect && newStreak >= 2) {
      points += 100 * Math.min(newStreak - 1, 2);
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

    // HAMMA o'yinchi javob berdi — taymerni kutmasdan leaderboard'ga o'tamiz.
    // Kichik kechikish: javob bergan o'quvchining HTTP javobi socket eventdan
    // OLDIN yetib borishi uchun (aks holda natija ekranida balli ko'rinmaydi).
    if (allPlayers.length > 0 && answeredCount >= allPlayers.length) {
      setTimeout(() => {
        revealLeaderboard(player.quizId, questionId).catch(err =>
          console.error('[LiveQuiz] Auto-reveal xatosi:', err)
        );
      }, 400);
    }
  } catch (e: any) {
    next(e);
  }
};

export const leaveQuiz = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { playerId } = req.params;
    const player = await prisma.liveQuizPlayer.findUnique({
      where: { id: playerId },
      include: { quiz: true }
    });
    if (!player) return res.status(404).json({ error: 'O\'yinchi topilmadi' });

    await prisma.liveQuizPlayer.delete({ where: { id: playerId } });

    const io = getIO();
    if (io) {
      const playerCount = await prisma.liveQuizPlayer.count({ where: { quizId: player.quizId } });
      io.to(`quiz-${player.quiz.code}`).emit('quiz:player-left', { playerId, playerCount });
    }

    res.json({ success: true });
  } catch (e: any) {
    next(e);
  }
};

// ─── Quiz Musiqa Tizimi ───────────────────────────────────────────────────────
export const getQuizMusics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const musics = await prisma.quizMusic.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: musics });
  } catch (e: any) {
    next(e);
  }
};

export const uploadQuizMusic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userRole = (req as any).user?.role;
    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Faqat administrator musiqa yuklay oladi' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Fayl yuklanmadi' });
    }

    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Musiqa sarlavhasi kiritilishi shart' });
    }

    const url = `/uploads/quiz-music/${req.file.filename}`;

    const music = await prisma.quizMusic.create({
      data: { title, url },
    });

    res.status(201).json({ data: music });
  } catch (e: any) {
    next(e);
  }
};

export const deleteQuizMusic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userRole = (req as any).user?.role;
    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Faqat administrator musiqa o\'chira oladi' });
    }

    const { musicId } = req.params;

    const music = await prisma.quizMusic.findUnique({ where: { id: musicId } });
    if (!music) return res.status(404).json({ error: 'Musiqa topilmadi' });

    const filePath = path.join(process.cwd(), music.url);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error('Musiqa faylini o\'chirishda xatolik:', err);
      }
    }

    await prisma.quizMusic.delete({ where: { id: musicId } });

    res.json({ message: 'Musiqa o\'chirildi' });
  } catch (e: any) {
    next(e);
  }
};
