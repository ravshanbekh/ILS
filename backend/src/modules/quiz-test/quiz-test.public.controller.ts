import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/database';
import {
  finalizeAttempt,
  generateAttemptToken,
  gradeAnswer,
  pickQuestionIds,
  shuffle,
} from './quiz-test.service';

// ─────────────────────────────────────────────────────────────────────────────
//  Ishtirokchi tomoni — AUTH YO'Q.
//  Havola ochiladi, ism-familiya yoziladi, test boshlanadi.
//  Urinish `token` bilan tanib olinadi (sahifa yangilansa davom etadi).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * To'g'ri javob ishtirokchiga hech qachon yuborilmaydi.
 *
 * `order` — variantlarning ko'rsatiladigan tartibi (asl indekslar ro'yxati).
 * U urinish boshlanganda bir marta hisoblanadi va `attempt.optionOrders` da
 * muhrlanadi, shuning uchun bu yerda faqat qo'llaniladi. Har so'rovda qayta
 * aralashtirish javobni buzardi: ishtirokchi ko'rgan indeks bilan asl
 * `correctIndexes` mos kelmay qolardi.
 */
function sanitizeQuestion(q: any, order?: number[] | null) {
  const options = Array.isArray(q.options) ? (q.options as string[]) : [];
  const shown =
    order && order.length === options.length ? order.map((i) => options[i]) : options;
  return {
    id: q.id,
    type: q.type,
    text: q.text,
    imageUrl: q.imageUrl,
    points: q.points,
    options: q.type === 'closed' ? shown : undefined,
  };
}

/** Ko'rsatiladigan tartibni bir marta hisoblaydi (0..n-1 indekslar). */
function buildOptionOrder(q: any, shuffleOptions: boolean): number[] | null {
  if (q.type !== 'closed') return null;
  const options = Array.isArray(q.options) ? (q.options as string[]) : [];
  if (options.length === 0) return null;
  const base = options.map((_, i) => i);
  return shuffleOptions ? shuffle(base) : base;
}

/** Ishtirokchi ko'rgan indekslarni asl indekslarga qaytaradi. */
function toOriginalIndexes(selected: number[], order?: number[] | null): number[] {
  if (!order || order.length === 0) return selected;
  return selected
    .map((i) => (i >= 0 && i < order.length ? order[i] : -1))
    .filter((i) => i >= 0);
}

function testWindowError(test: {
  status: string;
  startsAt: Date | null;
  expiresAt: Date | null;
}): string | null {
  if (test.status === 'draft') return 'Bu test hali boshlanmagan';
  if (test.status === 'closed') return 'Bu test yopilgan';
  const now = new Date();
  if (test.startsAt && now < test.startsAt) {
    return `Test ${test.startsAt.toLocaleString('uz-UZ')} da boshlanadi`;
  }
  if (test.expiresAt && now > test.expiresAt) return 'Test muddati tugagan';
  return null;
}

// ─── 1. Testni ochish (savollarsiz) ──────────────────────────────────────────

export const getTestByCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const code = String(req.params.code ?? '').toUpperCase();
    const test = await prisma.quizTest.findUnique({
      where: { code },
      select: {
        id: true,
        title: true,
        description: true,
        code: true,
        status: true,
        durationMin: true,
        startsAt: true,
        expiresAt: true,
        requirePhone: true,
        attemptsAllowed: true,
        closedCount: true,
        openCount: true,
        showResult: true,
        passPercent: true,
        createdBy: { select: { fullName: true } },
        _count: { select: { questions: true } },
      },
    });
    if (!test) return res.status(404).json({ error: 'Bunday test topilmadi' });

    const blocked = testWindowError(test);

    // Nechta savol beriladi — sozlamaga qarab
    const counts = await prisma.quizTestQuestion.groupBy({
      by: ['type'],
      where: { testId: test.id },
      _count: true,
    });
    const closedTotal = counts.find((c) => c.type === 'closed')?._count ?? 0;
    const openTotal = counts.find((c) => c.type === 'open')?._count ?? 0;
    const closedShown = test.closedCount === null ? closedTotal : Math.min(test.closedCount, closedTotal);
    const openShown = test.openCount === null ? openTotal : Math.min(test.openCount, openTotal);

    res.json({
      data: {
        ...test,
        blocked,
        questionCount: closedShown + openShown,
        closedShown,
        openShown,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── 2. Boshlash ─────────────────────────────────────────────────────────────

export const startAttempt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const code = String(req.params.code ?? '').toUpperCase();
    const fullName = String(req.body.fullName ?? '').trim();
    const phone = req.body.phone ? String(req.body.phone).trim() : null;

    if (fullName.length < 3) {
      return res.status(400).json({ error: 'Ism-familiyani to\'liq yozing' });
    }

    const test = await prisma.quizTest.findUnique({
      where: { code },
      include: { questions: true },
    });
    if (!test) return res.status(404).json({ error: 'Bunday test topilmadi' });

    const blocked = testWindowError(test);
    if (blocked) return res.status(403).json({ error: blocked });

    if (test.requirePhone && (!phone || phone.length < 7)) {
      return res.status(400).json({ error: 'Telefon raqam kiritilishi shart' });
    }
    if (test.questions.length === 0) {
      return res.status(400).json({ error: 'Bu testda hali savol yo\'q' });
    }

    // Urinishlar chegarasi — ism bo'yicha (ro'yxatdan o'tish yo'q, shuning
    // uchun bu qat'iy himoya emas, balki tasodifiy takrorlashdan saqlanish)
    const previous = await prisma.quizTestAttempt.findMany({
      where: { testId: test.id, fullName },
      orderBy: { attemptNumber: 'desc' },
    });

    const active = previous.find((a) => a.status === 'in_progress');
    if (active && new Date() < active.deadlineAt) {
      // Tugallanmagan urinish bor — davom ettiramiz
      return res.json({ data: await buildAttemptPayload(test, active) });
    }

    const finished = previous.filter((a) => a.status !== 'in_progress').length;
    if (finished >= test.attemptsAllowed) {
      return res.status(403).json({
        error: `Siz bu testni ${test.attemptsAllowed} marta ishlagansiz. Qayta urinish mumkin emas.`,
      });
    }

    const closed = test.questions.filter((q) => q.type === 'closed');
    const open = test.questions.filter((q) => q.type === 'open');
    const questionIds = pickQuestionIds({
      closed,
      open,
      closedCount: test.closedCount,
      openCount: test.openCount,
      shuffleQuestions: test.shuffleQuestions,
    });

    if (questionIds.length === 0) {
      return res.status(400).json({ error: 'Sozlamaga mos savol topilmadi' });
    }

    const deadline = new Date(Date.now() + test.durationMin * 60 * 1000);
    // Test tugash vaqti yaqin bo'lsa, taymer undan oshmasin
    const cappedDeadline =
      test.expiresAt && test.expiresAt < deadline ? test.expiresAt : deadline;

    // Variantlar tartibi SHU YERDA bir marta muhrlanadi — keyin o'zgarmaydi.
    const qById = new Map(test.questions.map((q: any) => [q.id, q]));
    const optionOrders: Record<string, number[]> = {};
    for (const qid of questionIds) {
      const q = qById.get(qid);
      const order = buildOptionOrder(q, test.shuffleOptions);
      if (order) optionOrders[qid] = order;
    }

    const attempt = await prisma.quizTestAttempt.create({
      data: {
        testId: test.id,
        fullName: fullName.slice(0, 150),
        phone: phone ? phone.slice(0, 30) : null,
        attemptNumber: (previous[0]?.attemptNumber ?? 0) + 1,
        questionIds,
        optionOrders,
        token: generateAttemptToken(),
        deadlineAt: cappedDeadline,
        ip: (req.ip ?? '').slice(0, 64),
      },
    });

    res.status(201).json({ data: await buildAttemptPayload(test, attempt) });
  } catch (err) {
    next(err);
  }
};

async function buildAttemptPayload(test: any, attempt: any) {
  const questionIds = (attempt.questionIds as string[]) ?? [];
  const all = test.questions
    ? test.questions
    : await prisma.quizTestQuestion.findMany({ where: { id: { in: questionIds } } });

  const qMap = new Map(all.map((q: any) => [q.id, q]));
  const orders = (attempt.optionOrders as Record<string, number[]> | null) ?? {};
  const questions = questionIds
    .map((id) => qMap.get(id))
    .filter(Boolean)
    .map((q: any) => sanitizeQuestion(q, orders[q.id]));

  // Allaqachon berilgan javoblar (sahifa yangilangan holat uchun)
  const saved = await prisma.quizTestAnswer.findMany({
    where: { attemptId: attempt.id },
    select: { questionId: true, selected: true, textAnswer: true },
  });

  return {
    attempt: {
      id: attempt.id,
      token: attempt.token,
      fullName: attempt.fullName,
      startedAt: attempt.startedAt,
      deadlineAt: attempt.deadlineAt,
      status: attempt.status,
    },
    test: {
      id: test.id,
      title: test.title,
      description: test.description,
      durationMin: test.durationMin,
      showResult: test.showResult,
    },
    questions,
    savedAnswers: saved,
  };
}

// ─── 3. Davom ettirish ───────────────────────────────────────────────────────

export const resumeAttempt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = String(req.params.token ?? '');
    const attempt = await prisma.quizTestAttempt.findUnique({
      where: { token },
      include: { test: { include: { questions: true } } },
    });
    if (!attempt) return res.status(404).json({ error: 'Urinish topilmadi' });

    if (attempt.status !== 'in_progress') {
      return res.status(409).json({
        error: 'Bu urinish yakunlangan',
        data: { finished: true, attemptId: attempt.id },
      });
    }
    if (new Date() > attempt.deadlineAt) {
      await finalizeAttempt(attempt.id);
      return res.status(410).json({ error: 'Vaqt tugagan', data: { attemptId: attempt.id } });
    }

    res.json({ data: await buildAttemptPayload(attempt.test, attempt) });
  } catch (err) {
    next(err);
  }
};

// ─── 4. Javobni saqlash ──────────────────────────────────────────────────────

/**
 * Har savol javobi alohida saqlanadi — sahifa yopilsa ham yo'qolmaydi.
 * Baholash shu yerda bajariladi, lekin natija ishtirokchiga qaytarilmaydi.
 */
export const saveAnswer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = String(req.params.token ?? '');
    const { questionId, selected, textAnswer } = req.body;

    const attempt = await prisma.quizTestAttempt.findUnique({
      where: { token },
      select: {
        id: true, status: true, deadlineAt: true,
        questionIds: true, optionOrders: true,
      },
    });
    if (!attempt) return res.status(404).json({ error: 'Urinish topilmadi' });
    if (attempt.status !== 'in_progress') {
      return res.status(409).json({ error: 'Urinish yakunlangan' });
    }
    if (new Date() > attempt.deadlineAt) {
      await finalizeAttempt(attempt.id);
      return res.status(410).json({ error: 'Vaqt tugagan' });
    }

    const allowed = (attempt.questionIds as string[]) ?? [];
    if (!allowed.includes(questionId)) {
      return res.status(400).json({ error: 'Bu savol sizning variantingizda yo\'q' });
    }

    const question = await prisma.quizTestQuestion.findUnique({ where: { id: questionId } });
    if (!question) return res.status(404).json({ error: 'Savol topilmadi' });

    // Ishtirokchi ko'rgan indeks aralashtirilgan tartibda — baholashdan oldin
    // asl tartibga qaytariladi, aks holda to'g'ri javob ham noto'g'ri sanaladi.
    const orders = (attempt.optionOrders as Record<string, number[]> | null) ?? {};
    const shownSelected = Array.isArray(selected) ? selected.map(Number) : null;
    const originalSelected = shownSelected
      ? toOriginalIndexes(shownSelected, orders[questionId])
      : null;

    const graded = gradeAnswer(question, {
      selected: originalSelected,
      textAnswer: textAnswer ?? null,
    });

    await prisma.quizTestAnswer.upsert({
      where: { attemptId_questionId: { attemptId: attempt.id, questionId } },
      create: {
        attemptId: attempt.id,
        questionId,
        // Asl indeks saqlanadi: mentor paneli va natija sahifasi savolning
        // asl variant tartibini ko'rsatadi.
        selected: originalSelected ?? undefined,
        textAnswer: textAnswer ? String(textAnswer).slice(0, 5000) : null,
        isCorrect: graded.isCorrect,
        points: graded.points,
        needsReview: graded.needsReview,
      },
      update: {
        selected: originalSelected ?? undefined,
        textAnswer: textAnswer ? String(textAnswer).slice(0, 5000) : null,
        isCorrect: graded.isCorrect,
        points: graded.points,
        needsReview: graded.needsReview,
        // Qayta javob berilsa, avvalgi qo'lda baho bekor bo'ladi
        reviewedById: null,
        reviewedAt: null,
      },
    });

    res.json({ data: { saved: true } });
  } catch (err) {
    next(err);
  }
};

// ─── 5. Yakunlash ────────────────────────────────────────────────────────────

export const submitAttempt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = String(req.params.token ?? '');
    const attempt = await prisma.quizTestAttempt.findUnique({
      where: { token },
      select: { id: true, status: true, testId: true },
    });
    if (!attempt) return res.status(404).json({ error: 'Urinish topilmadi' });

    if (attempt.status !== 'in_progress') {
      // Ikki marta yuborilsa ham xato bermaymiz — natijani qaytaramiz
      return res.json({ data: await buildResultPayload(attempt.id) });
    }

    await finalizeAttempt(attempt.id);
    res.json({ data: await buildResultPayload(attempt.id) });
  } catch (err) {
    next(err);
  }
};

async function buildResultPayload(attemptId: string) {
  const attempt = await prisma.quizTestAttempt.findUnique({
    where: { id: attemptId },
    include: {
      test: {
        select: {
          title: true,
          showResult: true,
          showCorrectAnswers: true,
          passPercent: true,
        },
      },
      answers: true,
    },
  });
  if (!attempt) return null;

  const base = {
    fullName: attempt.fullName,
    submittedAt: attempt.submittedAt,
    needsReview: attempt.needsReview,
    testTitle: attempt.test.title,
  };

  // Mentor natijani yashirgan bo'lsa — faqat "qabul qilindi"
  if (!attempt.test.showResult) {
    return { ...base, hidden: true };
  }

  const result: any = {
    ...base,
    hidden: false,
    score: attempt.score,
    maxScore: attempt.maxScore,
    percent: attempt.percent,
    correctCount: attempt.correctCount,
    totalQuestions: ((attempt.questionIds as string[]) ?? []).length,
    passed: attempt.passed,
    passPercent: attempt.test.passPercent,
  };

  if (attempt.test.showCorrectAnswers) {
    const questionIds = (attempt.questionIds as string[]) ?? [];
    const questions = await prisma.quizTestQuestion.findMany({
      where: { id: { in: questionIds } },
    });
    const qMap = new Map(questions.map((q) => [q.id, q]));
    const aMap = new Map(attempt.answers.map((a) => [a.questionId, a]));

    result.review = questionIds.map((qid) => {
      const q = qMap.get(qid);
      const a = aMap.get(qid);
      return {
        text: q?.text ?? '',
        type: q?.type ?? 'closed',
        options: q?.options ?? null,
        correctIndexes: q?.correctIndexes ?? null,
        acceptedAnswers: q?.acceptedAnswers ?? null,
        given: a ? { selected: a.selected, textAnswer: a.textAnswer } : null,
        isCorrect: a?.isCorrect ?? null,
        needsReview: a?.needsReview ?? false,
        points: a?.points ?? 0,
        maxPoints: q?.points ?? 0,
      };
    });
  }

  return result;
}

// ─── 6. Natijani qayta ko'rish ───────────────────────────────────────────────

export const getAttemptResult = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = String(req.params.token ?? '');
    const attempt = await prisma.quizTestAttempt.findUnique({
      where: { token },
      select: { id: true, status: true },
    });
    if (!attempt) return res.status(404).json({ error: 'Urinish topilmadi' });
    if (attempt.status === 'in_progress') {
      return res.status(409).json({ error: 'Test hali yakunlanmagan' });
    }
    res.json({ data: await buildResultPayload(attempt.id) });
  } catch (err) {
    next(err);
  }
};
