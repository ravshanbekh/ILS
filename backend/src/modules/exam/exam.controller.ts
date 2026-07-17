import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../../config/database';
import { env } from '../../config/env';

interface ExamSessionPayload {
  type: 'exam_session';
  participantId: string;
  examId: string;
  studentId: string;
  questionIds: string[];
}

// Generate unique access code
function generateCode(len = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function createExamSessionToken(
  participant: { id: string; examId: string; studentId: string },
  expiresAt: Date,
  questionIds: string[]
): string {
  const expiresIn = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  return jwt.sign(
    {
      type: 'exam_session',
      participantId: participant.id,
      examId: participant.examId,
      studentId: participant.studentId,
      questionIds,
    } satisfies ExamSessionPayload,
    env.JWT_SECRET,
    { expiresIn }
  );
}

function verifyExamSessionToken(token: unknown): ExamSessionPayload | null {
  if (typeof token !== 'string' || !token) return null;

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as ExamSessionPayload;
    if (
      payload.type !== 'exam_session' ||
      typeof payload.participantId !== 'string' ||
      typeof payload.examId !== 'string' ||
      typeof payload.studentId !== 'string' ||
      !Array.isArray(payload.questionIds) ||
      !payload.questionIds.every(id => typeof id === 'string')
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

async function isExamOwner(examId: string, userId: string): Promise<boolean> {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, createdById: userId },
    select: { id: true },
  });
  return Boolean(exam);
}


// ─── O'qituvchi: Imtihon yaratish ────────────────────────────────────────────
export const createExam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, categoryId, testCount = 20, maxTestScore = 40, maxAiScore = 20, maxProjectScore = 40, isGlobal, step2Name, step3Name } = req.body;
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;
    if (!userId) return res.status(401).json({ error: 'Auth xatosi' });


    const accessCode = generateCode(10);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // +2 soat

    const exam = await prisma.exam.create({
      data: {
        title,
        description: description || null,
        ...(categoryId ? { category: { connect: { id: categoryId } } } : {}),
        createdBy: { connect: { id: userId } },
        accessCode,
        startsAt: now,
        expiresAt,
        testCount,
        maxTestScore,
        maxAiScore,
        maxProjectScore,
        status: 'draft',
        isGlobal: Boolean(isGlobal && userRole === 'admin'),
        step2Name: step2Name || undefined,
        step3Name: step3Name || undefined,
      },
      include: {
        category: true,
        createdBy: { select: { id: true, fullName: true } },
      },
    });

    res.status(201).json({ data: exam });
  } catch (e: any) {
    next(e);
  }
};

// ─── O'qituvchi: Mening imtihonlarim ────────────────────────────────────────
export const getMyExams = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const exams = await prisma.exam.findMany({
      where: { createdById: userId },
      include: {
        category: true,
        _count: { select: { questions: true, participants: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: exams });
  } catch (e: any) {
    next(e);
  }
};

// ─── Markaz: Global imtihonlar ──────────────────────────────────────────────
export const getGlobalExams = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exams = await prisma.exam.findMany({
      where: { isGlobal: true },
      include: {
        category: true,
        _count: { select: { questions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: exams });
  } catch (e: any) {
    next(e);
  }
};

// ─── O'qituvchi: Global imtihonni aktivlashtirish ───────────────────────────
export const activateGlobalExam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;
    
    const globalExam = await prisma.exam.findFirst({ where: { id, isGlobal: true } });
    if (!globalExam) return res.status(404).json({ error: 'Global imtihon topilmadi' });

    const accessCode = generateCode(10);
    const now = new Date();
    
    const newExam = await prisma.exam.create({
      data: {
        title: globalExam.title,
        description: globalExam.description,
        categoryId: globalExam.categoryId,
        createdById: userId,
        accessCode,
        startsAt: now,
        expiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
        status: 'active',
        testCount: globalExam.testCount,
        maxTestScore: globalExam.maxTestScore,
        maxAiScore: globalExam.maxAiScore,
        maxProjectScore: globalExam.maxProjectScore,
        step2Name: globalExam.step2Name,
        step3Name: globalExam.step3Name,
        isGlobal: false,
        templateId: globalExam.id,
      }
    });

    res.status(201).json({ data: newExam, message: 'Global imtihon aktivlashtirildi' });
  } catch (e: any) {
    next(e);
  }
};

// ─── O'qituvchi: Imtihon batafsil ───────────────────────────────────────────
export const getExamById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;
    const exam = await prisma.exam.findFirst({
      where: { id, createdById: userId },
      include: {
        category: true,
        questions: { orderBy: { order: 'asc' } },
        _count: { select: { participants: true } },
      },
    });
    if (!exam) return res.status(404).json({ error: 'Topilmadi' });

    if (exam.templateId) {
      const templateQuestions = await prisma.examQuestion.findMany({
        where: { examId: exam.templateId },
        orderBy: { order: 'asc' }
      });
      (exam as any).questions = templateQuestions;
    }

    res.json({ data: exam });
  } catch (e: any) {
    next(e);
  }
};

// ─── O'qituvchi: Aktivlashtirish ────────────────────────────────────────────
export const activateExam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;
    const exam = await prisma.exam.findFirst({ where: { id, createdById: userId } });
    if (!exam) return res.status(404).json({ error: 'Topilmadi' });

    const qCount = await prisma.examQuestion.count({ where: { examId: exam.templateId || id } });
    if (qCount < exam.testCount) {
      return res.status(400).json({ error: `Kamida ${exam.testCount} ta savol kerak (hozir ${qCount} ta)` });
    }

    const now = new Date();
    const updated = await prisma.exam.update({
      where: { id },
      data: {
        status: 'active',
        startsAt: now,
        expiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
      },
    });
    res.json({ data: updated });
  } catch (e: any) {
    next(e);
  }
};

// ─── O'qituvchi: Yakunlash ───────────────────────────────────────────────────
export const completeExam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;
    const updated = await prisma.exam.update({
      where: { id, createdById: userId },
      data: { status: 'completed' },
    });
    res.json({ data: updated });
  } catch (e: any) {
    next(e);
  }
};

// ─── O'qituvchi: O'chirish ───────────────────────────────────────────────────
export const deleteExam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;
    await prisma.exam.delete({ where: { id, createdById: userId } });
    res.json({ message: 'O\'chirildi' });
  } catch (e: any) {
    next(e);
  }
};

// ─── O'qituvchi: Savol qo'shish (bitta yoki ko'p) ────────────────────────────────
export const addQuestions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Auth xatosi' });
    if (!(await isExamOwner(id, userId))) {
      return res.status(403).json({ error: 'Bu imtihonni tahrirlash uchun ruxsatingiz yo\'q' });
    }

    let questions = req.body.questions;
    
    // Agar form-data orqali 1 ta savol kelsa
    if (!questions && req.body.question) {
      questions = [{
        question: req.body.question,
        options: JSON.parse(req.body.options || '[]'),
        correct: parseInt(req.body.correct || '0', 10),
      }];
    } else if (typeof questions === 'string') {
      questions = JSON.parse(questions);
    }
    
    if (!Array.isArray(questions)) return res.status(400).json({ error: 'Savollar formati noto\'g\'ri' });

    const imageUrl = req.file ? `/uploads/exam-images/${req.file.filename}` : undefined;

    const existing = await prisma.examQuestion.count({ where: { examId: id } });
    const data = questions.map((q: any, i: number) => ({
      examId: id,
      question: q.question,
      options: q.options,
      correct: q.correct,
      imageUrl: imageUrl || q.imageUrl,
      order: existing + i,
    }));

    await prisma.examQuestion.createMany({ data });
    const total = await prisma.examQuestion.count({ where: { examId: id } });
    res.status(201).json({ message: `${questions.length} ta savol qo'shildi`, total });
  } catch (e: any) {
    next(e);
  }
};

// ─── O'qituvchi: Savolni tahrirlash ──────────────────────────────────────────
export const updateQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, qId } = req.params;
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Auth xatosi' });
    if (!(await isExamOwner(id, userId))) {
      return res.status(403).json({ error: 'Bu imtihonni tahrirlash uchun ruxsatingiz yo\'q' });
    }

    const question = await prisma.examQuestion.findFirst({ where: { id: qId, examId: id } });
    if (!question) return res.status(404).json({ error: 'Savol topilmadi' });
    
    const updateData: any = {};
    if (req.body.question) updateData.question = req.body.question;
    if (req.body.options) updateData.options = typeof req.body.options === 'string' ? JSON.parse(req.body.options) : req.body.options;
    if (req.body.correct !== undefined) updateData.correct = parseInt(req.body.correct, 10);
    
    if (req.file) {
      updateData.imageUrl = `/uploads/exam-images/${req.file.filename}`;
    } else if (req.body.imageUrl === '') {
      updateData.imageUrl = null;
    }

    await prisma.examQuestion.update({
      where: { id: qId },
      data: updateData,
    });
    
    res.json({ message: 'Savol tahrirlandi' });
  } catch (e: any) {
    next(e);
  }
};

// ─── O'qituvchi: Bulk savol (Excel import'dan) ──────────────────────────────
export const bulkAddQuestions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Auth xatosi' });
    if (!(await isExamOwner(id, userId))) {
      return res.status(403).json({ error: 'Bu imtihonni tahrirlash uchun ruxsatingiz yo\'q' });
    }

    const { questions } = req.body;
    if (!Array.isArray(questions)) return res.status(400).json({ error: 'Array kerak' });

    // Avvalgi savollarni o'chirib yangilari qo'yiladi
    await prisma.examQuestion.deleteMany({ where: { examId: id } });

    const data = questions.map((q: any, i: number) => ({
      examId: id,
      question: q.question,
      options: q.options,
      correct: q.correct,
      order: i,
    }));

    await prisma.examQuestion.createMany({ data });
    res.json({ message: `${data.length} ta savol saqlandi` });
  } catch (e: any) {
    next(e);
  }
};

// ─── O'qituvchi: Savol o'chirish ─────────────────────────────────────────────
export const deleteQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, qId } = req.params;
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Auth xatosi' });
    if (!(await isExamOwner(id, userId))) {
      return res.status(403).json({ error: 'Bu imtihonni tahrirlash uchun ruxsatingiz yo\'q' });
    }

    const question = await prisma.examQuestion.findFirst({ where: { id: qId, examId: id } });
    if (!question) return res.status(404).json({ error: 'Savol topilmadi' });

    await prisma.examQuestion.delete({ where: { id: qId } });
    res.json({ message: 'O\'chirildi' });
  } catch (e: any) {
    next(e);
  }
};

// ─── O'qituvchi: Natijalar ───────────────────────────────────────────────────
export const getExamResults = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;
    const exam = await prisma.exam.findFirst({ where: { id, createdById: userId } });
    if (!exam) return res.status(404).json({ error: 'Topilmadi' });

    const participants = await prisma.examParticipant.findMany({
      where: { examId: id },
      include: {
        student: { select: { id: true, fullName: true, login: true } },
        answers: { include: { question: { select: { id: true, question: true, correct: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ data: { exam, participants } });
  } catch (e: any) {
    next(e);
  }
};

// ─── O'quvchi: Imtihonni kod bilan topish ────────────────────────────────────
export const getExamByCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.params;
    const exam = await prisma.exam.findFirst({
      where: { accessCode: code.toUpperCase() },
      include: { category: true, createdBy: { select: { fullName: true } } },
    });
    if (!exam) return res.status(404).json({ error: 'Imtihon topilmadi' });
    if (exam.status === 'cancelled') return res.status(410).json({ error: 'Imtihon bekor qilingan' });
    if (exam.status === 'completed') return res.status(410).json({ error: 'Imtihon tugagan' });
    if (new Date() > exam.expiresAt && exam.status !== 'draft') {
      return res.status(410).json({ error: 'Imtihon vaqti tugagan' });
    }

    // Savol sonini emas, faqat meta ma'lumotni qaytaramiz
    const questionCount = await prisma.examQuestion.count({ where: { examId: exam.id } });
    res.json({ data: { ...exam, questionCount } });
  } catch (e: any) {
    next(e);
  }
};

// ─── O'quvchi: Imtihonni boshlash (login kerak) ──────────────────────────────
export const startExam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.params;
    const { login, password } = req.body;

    // Login tekshirish
    const bcrypt = await import('bcryptjs');
    const student = await prisma.user.findFirst({ where: { login } });
    if (!student || !student.isActive || !(await bcrypt.default.compare(password, student.passwordHash))) {
      return res.status(401).json({ error: 'Login yoki parol noto\'g\'ri' });
    }

    const exam = await prisma.exam.findFirst({
      where: { accessCode: code.toUpperCase(), status: 'active' },
    });
    if (!exam) return res.status(404).json({ error: 'Faol imtihon topilmadi' });
    if (new Date() > exam.expiresAt) {
      return res.status(410).json({ error: 'Imtihon vaqti tugagan' });
    }

    // Allaqachon qatnashganmi?
    const existing = await prisma.examParticipant.findFirst({
      where: { examId: exam.id, studentId: student.id },
    });
    if (existing?.status === 'submitted') {
      return res.status(409).json({ error: 'Siz allaqachon imtihon topshirdingiz' });
    }
    if (existing?.status === 'in_progress') {
      // Sessiyani davom ettirish
      const randomQs = await getRandomQuestions(exam.id, exam.testCount);
      const sessionToken = createExamSessionToken(existing, exam.expiresAt, randomQs.map(q => q.id));
      return res.json({ data: { participant: existing, questions: randomQs, sessionToken, student: { id: student.id, fullName: student.fullName } } });
    }

    // Yangi ishtirokchi
    const participant = await prisma.examParticipant.create({
      data: { examId: exam.id, studentId: student.id, status: 'in_progress', startedAt: new Date() },
    });

    const questions = await getRandomQuestions(exam.id, exam.testCount);
    const sessionToken = createExamSessionToken(participant, exam.expiresAt, questions.map(q => q.id));
    res.json({ data: { participant, questions, sessionToken, student: { id: student.id, fullName: student.fullName } } });
  } catch (e: any) {
    next(e);
  }
};

// ─── O'quvchi: Test topshirish ───────────────────────────────────────────────
export const submitTest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.params;
    const { participantId, answers, sessionToken } = req.body;
    // answers: [{ questionId, selectedOption }]

    if (typeof participantId !== 'string' || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'Topshirish ma\'lumotlari noto\'g\'ri' });
    }

    const exam = await prisma.exam.findFirst({
      where: { accessCode: code.toUpperCase(), status: 'active' },
    });
    if (!exam) return res.status(404).json({ error: 'Faol imtihon topilmadi' });
    if (new Date() > exam.expiresAt) return res.status(410).json({ error: 'Imtihon vaqti tugagan' });

    const participant = await prisma.examParticipant.findFirst({
      where: { id: participantId, examId: exam.id },
    });
    if (!participant) return res.status(404).json({ error: 'Ishtirokchi topilmadi' });
    if (participant.status === 'submitted') return res.status(409).json({ error: 'Allaqachon topshirilgan' });
    if (participant.testScore !== null) return res.status(409).json({ error: 'Test allaqachon topshirilgan' });

    const session = verifyExamSessionToken(sessionToken);
    if (
      !session ||
      session.participantId !== participant.id ||
      session.examId !== exam.id ||
      session.studentId !== participant.studentId
    ) {
      return res.status(401).json({ error: 'Imtihon sessiyasi yaroqsiz yoki muddati tugagan' });
    }

    const allowedQuestionIds = new Set(session.questionIds);
    const uniqueAnswers = new Map<string, any>();
    for (const answer of answers) {
      if (!answer || typeof answer.questionId !== 'string' || !allowedQuestionIds.has(answer.questionId)) {
        return res.status(400).json({ error: 'Javoblarda ushbu sessiyaga tegishli bo\'lmagan savol bor' });
      }
      if (uniqueAnswers.has(answer.questionId)) {
        return res.status(400).json({ error: 'Bir savolga takroriy javob yuborilgan' });
      }
      uniqueAnswers.set(answer.questionId, answer);
    }

    const actualExamId = exam.templateId || exam.id;
    const questions = await prisma.examQuestion.findMany({
      where: { id: { in: [...uniqueAnswers.keys()] }, examId: actualExamId },
    });
    if (questions.length !== uniqueAnswers.size) {
      return res.status(400).json({ error: 'Savollardan biri bu imtihonga tegishli emas' });
    }

    // Javoblarni tekshirish
    let correct = 0;
    const answerData: any[] = [];
    for (const q of questions) {
      const a = uniqueAnswers.get(q.id);
      const dbOptions = q.options as string[];
      const correctText = dbOptions[q.correct as number];
      const isCorrect = a.selectedText === correctText;
      if (isCorrect) correct++;

      const selectedText = typeof a.selectedText === 'string' ? a.selectedText : null;
      const originalSelectedOption = selectedText === null ? -1 : dbOptions.indexOf(selectedText);
      if (selectedText !== null && originalSelectedOption === -1) {
        return res.status(400).json({ error: 'Tanlangan javob varianti noto\'g\'ri' });
      }

      answerData.push({ participantId, questionId: q.id, selectedOption: originalSelectedOption, isCorrect });
    }

    // Ball hisoblash (40 ball max, to'g'ri/jami * max)
    const testScore = Math.round((correct / exam.testCount) * exam.maxTestScore);

    await prisma.$transaction([
      prisma.examAnswer.createMany({ data: answerData, skipDuplicates: true }),
      prisma.examParticipant.update({
        where: { id: participantId },
        data: { testScore, correctCount: correct, status: 'in_progress' },
      }),
    ]);

    res.json({ data: { correct, total: exam.testCount, testScore } });
  } catch (e: any) {
    next(e);
  }
};

// ─── O'quvchi: Video linklar yuborish ────────────────────────────────────────
export const submitVideos = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.params;
    const { participantId, aiVideoUrl, projectVideoUrl, sessionToken } = req.body;

    if (typeof participantId !== 'string') {
      return res.status(400).json({ error: 'Ishtirokchi ID noto\'g\'ri' });
    }

    const exam = await prisma.exam.findFirst({
      where: { accessCode: code.toUpperCase(), status: 'active' },
    });
    if (!exam) return res.status(404).json({ error: 'Faol imtihon topilmadi' });
    if (new Date() > exam.expiresAt) return res.status(410).json({ error: 'Imtihon vaqti tugagan' });

    const participant = await prisma.examParticipant.findFirst({
      where: { id: participantId, examId: exam.id },
    });
    if (!participant) return res.status(404).json({ error: 'Ishtirokchi topilmadi' });
    if (participant.status === 'submitted') return res.status(409).json({ error: 'Allaqachon topshirilgan' });
    if (participant.testScore === null) return res.status(409).json({ error: 'Avval testni topshiring' });

    const session = verifyExamSessionToken(sessionToken);
    if (
      !session ||
      session.participantId !== participant.id ||
      session.examId !== exam.id ||
      session.studentId !== participant.studentId
    ) {
      return res.status(401).json({ error: 'Imtihon sessiyasi yaroqsiz yoki muddati tugagan' });
    }

    await prisma.examParticipant.update({
      where: { id: participantId },
      data: { aiVideoUrl, projectVideoUrl, status: 'submitted', submittedAt: new Date() },
    });

    res.json({ message: 'Imtihon muvaffaqiyatli topshirildi' });
  } catch (e: any) {
    next(e);
  }
};

// ─── Helper: Random savollar ─────────────────────────────────────────────────
async function getRandomQuestions(examId: string, count: number) {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  const actualExamId = exam?.templateId || examId;
  const all = await prisma.examQuestion.findMany({ where: { examId: actualExamId } });
  const shuffled = all.sort(() => Math.random() - 0.5).slice(0, count);
  
  return shuffled.map(q => {
    const opts = q.options as string[];
    const newOptions = [...opts].sort(() => Math.random() - 0.5);
    return { 
      id: q.id, 
      question: q.question,
      imageUrl: q.imageUrl,
      options: newOptions,
    };
  });
}
