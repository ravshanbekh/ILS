import { Request, Response } from 'express';
import prisma from '../../config/database';

// Generate unique access code
function generateCode(len = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}


// ─── O'qituvchi: Imtihon yaratish ────────────────────────────────────────────
export const createExam = async (req: Request, res: Response) => {
  try {
    const { title, description, categoryId, testCount = 20, maxTestScore = 40, maxAiScore = 20, maxProjectScore = 40 } = req.body;
    const userId = (req as any).user?.id;
    if (!title) return res.status(400).json({ error: 'title majburiy' });

    const accessCode = generateCode(10);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // +2 soat

    const exam = await prisma.exam.create({
      data: {
        title,
        description,
        categoryId: categoryId || null,
        createdById: userId,
        accessCode,
        startsAt: now,
        expiresAt,
        testCount,
        maxTestScore,
        maxAiScore,
        maxProjectScore,
        status: 'draft',
      },
      include: { category: true },
    });

    res.status(201).json({ data: exam });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── O'qituvchi: Mening imtihonlarim ────────────────────────────────────────
export const getMyExams = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
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
    res.status(500).json({ error: e.message });
  }
};

// ─── O'qituvchi: Imtihon batafsil ───────────────────────────────────────────
export const getExamById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const exam = await prisma.exam.findFirst({
      where: { id, createdById: userId },
      include: {
        category: true,
        questions: { orderBy: { order: 'asc' } },
        _count: { select: { participants: true } },
      },
    });
    if (!exam) return res.status(404).json({ error: 'Topilmadi' });
    res.json({ data: exam });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── O'qituvchi: Aktivlashtirish ────────────────────────────────────────────
export const activateExam = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const exam = await prisma.exam.findFirst({ where: { id, createdById: userId } });
    if (!exam) return res.status(404).json({ error: 'Topilmadi' });

    const qCount = await prisma.examQuestion.count({ where: { examId: id } });
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
    res.status(500).json({ error: e.message });
  }
};

// ─── O'qituvchi: Yakunlash ───────────────────────────────────────────────────
export const completeExam = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const updated = await prisma.exam.update({
      where: { id, createdById: userId },
      data: { status: 'completed' },
    });
    res.json({ data: updated });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── O'qituvchi: O'chirish ───────────────────────────────────────────────────
export const deleteExam = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    await prisma.exam.delete({ where: { id, createdById: userId } });
    res.json({ message: 'O\'chirildi' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── O'qituvchi: Savol qo'shish (bitta) ─────────────────────────────────────
export const addQuestions = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { questions } = req.body; // [{ question, options: [], correct }]
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'questions array kerak' });
    }

    const existing = await prisma.examQuestion.count({ where: { examId: id } });
    const data = questions.map((q: any, i: number) => ({
      examId: id,
      question: q.question,
      options: q.options,
      correct: q.correct,
      order: existing + i,
    }));

    await prisma.examQuestion.createMany({ data });
    const total = await prisma.examQuestion.count({ where: { examId: id } });
    res.status(201).json({ message: `${questions.length} ta savol qo'shildi`, total });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── O'qituvchi: Bulk savol (Excel import'dan) ──────────────────────────────
export const bulkAddQuestions = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
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
    res.status(500).json({ error: e.message });
  }
};

// ─── O'qituvchi: Savol o'chirish ─────────────────────────────────────────────
export const deleteQuestion = async (req: Request, res: Response) => {
  try {
    const { qId } = req.params;
    await prisma.examQuestion.delete({ where: { id: qId } });
    res.json({ message: 'O\'chirildi' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── O'qituvchi: Natijalar ───────────────────────────────────────────────────
export const getExamResults = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
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
    res.status(500).json({ error: e.message });
  }
};

// ─── O'quvchi: Imtihonni kod bilan topish ────────────────────────────────────
export const getExamByCode = async (req: Request, res: Response) => {
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
    res.status(500).json({ error: e.message });
  }
};

// ─── O'quvchi: Imtihonni boshlash (login kerak) ──────────────────────────────
export const startExam = async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const { login, password } = req.body;

    // Login tekshirish
    const bcrypt = await import('bcryptjs');
    const student = await prisma.user.findFirst({ where: { login } });
    if (!student || !(await bcrypt.default.compare(password, student.passwordHash))) {
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
      return res.json({ data: { participant: existing, questions: randomQs, student: { id: student.id, fullName: student.fullName } } });
    }

    // Yangi ishtirokchi
    const participant = await prisma.examParticipant.create({
      data: { examId: exam.id, studentId: student.id, status: 'in_progress', startedAt: new Date() },
    });

    const questions = await getRandomQuestions(exam.id, exam.testCount);
    res.json({ data: { participant, questions, student: { id: student.id, fullName: student.fullName } } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── O'quvchi: Test topshirish ───────────────────────────────────────────────
export const submitTest = async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const { participantId, answers } = req.body;
    // answers: [{ questionId, selectedOption }]

    const participant = await prisma.examParticipant.findUnique({
      where: { id: participantId },
      include: { exam: true },
    });
    if (!participant) return res.status(404).json({ error: 'Ishtirokchi topilmadi' });
    if (participant.status === 'submitted') return res.status(409).json({ error: 'Allaqachon topshirilgan' });

    // Javoblarni tekshirish
    let correct = 0;
    const answerData: any[] = [];
    for (const a of answers) {
      const q = await prisma.examQuestion.findUnique({ where: { id: a.questionId } });
      if (!q) continue;
      const isCorrect = q.correct === a.selectedOption;
      if (isCorrect) correct++;
      answerData.push({ participantId, questionId: a.questionId, selectedOption: a.selectedOption, isCorrect });
    }

    // Ball hisoblash (40 ball max, to'g'ri/jami * max)
    const exam = participant.exam;
    const testScore = Math.round((correct / exam.testCount) * exam.maxTestScore);

    await prisma.examAnswer.createMany({ data: answerData, skipDuplicates: true });
    await prisma.examParticipant.update({
      where: { id: participantId },
      data: { testScore, correctCount: correct, status: 'in_progress' },
    });

    res.json({ data: { correct, total: exam.testCount, testScore } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── O'quvchi: Video linklar yuborish ────────────────────────────────────────
export const submitVideos = async (req: Request, res: Response) => {
  try {
    const { participantId, aiVideoUrl, projectVideoUrl } = req.body;

    const participant = await prisma.examParticipant.findUnique({ where: { id: participantId } });
    if (!participant) return res.status(404).json({ error: 'Ishtirokchi topilmadi' });

    await prisma.examParticipant.update({
      where: { id: participantId },
      data: { aiVideoUrl, projectVideoUrl, status: 'submitted', submittedAt: new Date() },
    });

    res.json({ message: 'Imtihon muvaffaqiyatli topshirildi' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── Helper: Random savollar ─────────────────────────────────────────────────
async function getRandomQuestions(examId: string, count: number) {
  const all = await prisma.examQuestion.findMany({ where: { examId } });
  const shuffled = all.sort(() => Math.random() - 0.5).slice(0, count);
  // Options ham random bo'lsin (correct indeksni saqlagan holda)
  return shuffled.map(q => {
    const opts = q.options as string[];
    const indices = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
    const newOptions = indices.map(i => opts[i]);
    const newCorrect = indices.indexOf(q.correct);
    return { ...q, options: newOptions, correct: newCorrect };
  });
}
