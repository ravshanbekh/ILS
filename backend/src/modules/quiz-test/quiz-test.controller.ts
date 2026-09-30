import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import prisma from '../../config/database';
import {
  generateUniqueCode,
  pickQuestionIds,
  recalculateAttempt,
  shuffle,
} from './quiz-test.service';

// ─────────────────────────────────────────────────────────────────────────────
//  Mentor tomoni: test yaratish, savollar, natijalar
// ─────────────────────────────────────────────────────────────────────────────

/** Admin hamma testni ko'radi, qolganlar faqat o'zinikini.
 *  Diqqat: auth middleware `req.user` ga `userId` yozadi, `id` emas. */
function ownerFilter(req: Request) {
  const user = (req as any).user;
  return user?.role === 'admin' ? {} : { createdById: user.userId };
}

async function assertOwner(req: Request, testId: string) {
  const test = await prisma.quizTest.findFirst({
    where: { id: testId, ...ownerFilter(req) },
    select: { id: true, createdById: true },
  });
  return test;
}

// ─── Test CRUD ───────────────────────────────────────────────────────────────

export const createTest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const {
      title,
      description,
      durationMin,
      startsAt,
      expiresAt,
      closedCount,
      openCount,
      shuffleQuestions,
      shuffleOptions,
      attemptsAllowed,
      requirePhone,
      showResult,
      showCorrectAnswers,
      passPercent,
    } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'Test nomi kiritilmagan' });
    }

    const code = await generateUniqueCode();

    const test = await prisma.quizTest.create({
      data: {
        title: String(title).trim().slice(0, 200),
        description: description ? String(description).slice(0, 2000) : null,
        code,
        createdById: user.userId,
        durationMin: Number(durationMin) > 0 ? Number(durationMin) : 30,
        startsAt: startsAt ? new Date(startsAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        closedCount: closedCount === null || closedCount === undefined || closedCount === ''
          ? null
          : Number(closedCount),
        openCount: openCount === null || openCount === undefined || openCount === ''
          ? null
          : Number(openCount),
        shuffleQuestions: shuffleQuestions !== false,
        shuffleOptions: shuffleOptions !== false,
        attemptsAllowed: Number(attemptsAllowed) > 0 ? Number(attemptsAllowed) : 1,
        requirePhone: requirePhone === true,
        showResult: showResult !== false,
        showCorrectAnswers: showCorrectAnswers === true,
        passPercent:
          passPercent === null || passPercent === undefined || passPercent === ''
            ? null
            : Number(passPercent),
      },
    });

    res.status(201).json({ data: test });
  } catch (err) {
    next(err);
  }
};

export const getMyTests = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tests = await prisma.quizTest.findMany({
      where: ownerFilter(req),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        code: true,
        status: true,
        durationMin: true,
        closedCount: true,
        openCount: true,
        startsAt: true,
        expiresAt: true,
        createdAt: true,
        createdById: true,
        // BigInt serializatsiya tuzog'idan qochish uchun ataylab `select`
        createdBy: { select: { id: true, fullName: true } },
        _count: { select: { questions: true, attempts: true } },
      },
    });
    res.json({ data: tests });
  } catch (err) {
    next(err);
  }
};

export const getTestById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const test = await prisma.quizTest.findFirst({
      where: { id: req.params.id, ...ownerFilter(req) },
      include: {
        questions: { orderBy: { order: 'asc' } },
        createdBy: { select: { id: true, fullName: true } },
        _count: { select: { attempts: true } },
      },
    });
    if (!test) return res.status(404).json({ error: 'Test topilmadi' });

    const closedTotal = test.questions.filter((q) => q.type === 'closed').length;
    const openTotal = test.questions.filter((q) => q.type === 'open').length;

    res.json({ data: { ...test, closedTotal, openTotal } });
  } catch (err) {
    next(err);
  }
};

export const updateTest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const owned = await assertOwner(req, req.params.id);
    if (!owned) return res.status(404).json({ error: 'Test topilmadi' });

    const b = req.body;
    const data: any = {};

    if (b.title !== undefined) data.title = String(b.title).trim().slice(0, 200);
    if (b.description !== undefined)
      data.description = b.description ? String(b.description).slice(0, 2000) : null;
    if (b.durationMin !== undefined) data.durationMin = Math.max(1, Number(b.durationMin));
    if (b.startsAt !== undefined) data.startsAt = b.startsAt ? new Date(b.startsAt) : null;
    if (b.expiresAt !== undefined) data.expiresAt = b.expiresAt ? new Date(b.expiresAt) : null;
    if (b.closedCount !== undefined)
      data.closedCount = b.closedCount === null || b.closedCount === '' ? null : Number(b.closedCount);
    if (b.openCount !== undefined)
      data.openCount = b.openCount === null || b.openCount === '' ? null : Number(b.openCount);
    if (b.shuffleQuestions !== undefined) data.shuffleQuestions = b.shuffleQuestions === true;
    if (b.shuffleOptions !== undefined) data.shuffleOptions = b.shuffleOptions === true;
    if (b.attemptsAllowed !== undefined)
      data.attemptsAllowed = Math.max(1, Number(b.attemptsAllowed));
    if (b.requirePhone !== undefined) data.requirePhone = b.requirePhone === true;
    if (b.showResult !== undefined) data.showResult = b.showResult === true;
    if (b.showCorrectAnswers !== undefined) data.showCorrectAnswers = b.showCorrectAnswers === true;
    if (b.passPercent !== undefined)
      data.passPercent = b.passPercent === null || b.passPercent === '' ? null : Number(b.passPercent);
    if (b.status !== undefined && ['draft', 'active', 'closed'].includes(b.status))
      data.status = b.status;

    const test = await prisma.quizTest.update({ where: { id: req.params.id }, data });
    res.json({ data: test });
  } catch (err) {
    next(err);
  }
};

export const deleteTest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const owned = await assertOwner(req, req.params.id);
    if (!owned) return res.status(404).json({ error: 'Test topilmadi' });

    await prisma.quizTest.delete({ where: { id: req.params.id } });
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
};

/** Testning nusxasini oladi — savollar bilan, lekin urinishlarsiz. */
export const duplicateTest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const src = await prisma.quizTest.findFirst({
      where: { id: req.params.id, ...ownerFilter(req) },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
    if (!src) return res.status(404).json({ error: 'Test topilmadi' });

    const code = await generateUniqueCode();
    const copy = await prisma.quizTest.create({
      data: {
        title: `${src.title} (nusxa)`,
        description: src.description,
        code,
        createdById: user.userId,
        durationMin: src.durationMin,
        closedCount: src.closedCount,
        openCount: src.openCount,
        shuffleQuestions: src.shuffleQuestions,
        shuffleOptions: src.shuffleOptions,
        attemptsAllowed: src.attemptsAllowed,
        requirePhone: src.requirePhone,
        showResult: src.showResult,
        showCorrectAnswers: src.showCorrectAnswers,
        passPercent: src.passPercent,
        status: 'draft',
        questions: {
          create: src.questions.map((q) => ({
            type: q.type,
            text: q.text,
            imageUrl: q.imageUrl,
            options: q.options ?? undefined,
            correctIndexes: q.correctIndexes ?? undefined,
            acceptedAnswers: q.acceptedAnswers ?? undefined,
            caseSensitive: q.caseSensitive,
            manualReview: q.manualReview,
            points: q.points,
            order: q.order,
          })),
        },
      },
    });

    res.status(201).json({ data: copy });
  } catch (err) {
    next(err);
  }
};

// ─── Savollar ────────────────────────────────────────────────────────────────

function parseJsonField(value: unknown): any {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  return value;
}

/**
 * Bitta savol qo'shish. `multipart/form-data` bilan keladi, chunki rasm
 * biriktirilishi mumkin — shuning uchun massiv maydonlar JSON matn sifatida.
 */
export const addQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const owned = await assertOwner(req, req.params.id);
    if (!owned) return res.status(404).json({ error: 'Test topilmadi' });

    const { type, text, points, caseSensitive, manualReview } = req.body;
    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: 'Savol matni kiritilmagan' });
    }

    const qType = type === 'open' ? 'open' : 'closed';
    const options = parseJsonField(req.body.options);
    const correctIndexes = parseJsonField(req.body.correctIndexes);
    const acceptedAnswers = parseJsonField(req.body.acceptedAnswers);

    if (qType === 'closed') {
      if (!Array.isArray(options) || options.length < 2) {
        return res.status(400).json({ error: 'Yopiq savolga kamida 2 ta variant kerak' });
      }
      if (!Array.isArray(correctIndexes) || correctIndexes.length === 0) {
        return res.status(400).json({ error: 'To\'g\'ri javob belgilanmagan' });
      }
    }

    const last = await prisma.quizTestQuestion.findFirst({
      where: { testId: req.params.id },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const question = await prisma.quizTestQuestion.create({
      data: {
        testId: req.params.id,
        type: qType,
        text: String(text).trim(),
        imageUrl: req.file ? `/uploads/quiz-tests/${req.file.filename}` : null,
        options: qType === 'closed' ? options : undefined,
        correctIndexes: qType === 'closed' ? correctIndexes : undefined,
        acceptedAnswers: qType === 'open' ? acceptedAnswers ?? [] : undefined,
        caseSensitive: caseSensitive === 'true' || caseSensitive === true,
        manualReview: manualReview === 'true' || manualReview === true,
        points: Number(points) > 0 ? Number(points) : 1,
        order: (last?.order ?? -1) + 1,
      },
    });

    res.status(201).json({ data: question });
  } catch (err) {
    next(err);
  }
};

/**
 * Excel/qo'lda ko'p savol qo'shish.
 * Frontend xlsx'ni o'zi o'qiydi va tayyor massiv yuboradi — shunda
 * fayl formatidagi farqlar brauzerda hal bo'ladi, serverda emas.
 */
export const bulkAddQuestions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const owned = await assertOwner(req, req.params.id);
    if (!owned) return res.status(404).json({ error: 'Test topilmadi' });

    const items = Array.isArray(req.body.questions) ? req.body.questions : [];
    if (items.length === 0) {
      return res.status(400).json({ error: 'Savollar yuborilmadi' });
    }
    if (items.length > 500) {
      return res.status(400).json({ error: 'Bir marta 500 tadan ko\'p savol qo\'shib bo\'lmaydi' });
    }

    const last = await prisma.quizTestQuestion.findFirst({
      where: { testId: req.params.id },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    let order = (last?.order ?? -1) + 1;

    const rows: any[] = [];
    const skipped: { row: number; reason: string }[] = [];

    items.forEach((raw: any, i: number) => {
      const text = String(raw.text ?? '').trim();
      if (!text) {
        skipped.push({ row: i + 1, reason: 'savol matni bo\'sh' });
        return;
      }
      const type = raw.type === 'open' ? 'open' : 'closed';

      if (type === 'closed') {
        const options = (Array.isArray(raw.options) ? raw.options : [])
          .map((o: any) => String(o ?? '').trim())
          .filter(Boolean);
        if (options.length < 2) {
          skipped.push({ row: i + 1, reason: 'kamida 2 ta variant kerak' });
          return;
        }
        const correct = (Array.isArray(raw.correctIndexes) ? raw.correctIndexes : [])
          .map(Number)
          .filter((n: number) => Number.isInteger(n) && n >= 0 && n < options.length);
        if (correct.length === 0) {
          skipped.push({ row: i + 1, reason: 'to\'g\'ri javob noto\'g\'ri yoki yo\'q' });
          return;
        }
        rows.push({
          testId: req.params.id,
          type,
          text,
          options,
          correctIndexes: correct,
          points: Number(raw.points) > 0 ? Number(raw.points) : 1,
          order: order++,
        });
      } else {
        const accepted = (Array.isArray(raw.acceptedAnswers) ? raw.acceptedAnswers : [])
          .map((a: any) => String(a ?? '').trim())
          .filter(Boolean);
        rows.push({
          testId: req.params.id,
          type,
          text,
          acceptedAnswers: accepted,
          caseSensitive: raw.caseSensitive === true,
          // Javob namunasi berilmagan ochiq savol — majburan qo'lda baholanadi
          manualReview: raw.manualReview === true || accepted.length === 0,
          points: Number(raw.points) > 0 ? Number(raw.points) : 1,
          order: order++,
        });
      }
    });

    if (rows.length === 0) {
      return res.status(400).json({
        error: 'Hech bir savol qo\'shilmadi',
        details: skipped,
      });
    }

    await prisma.quizTestQuestion.createMany({ data: rows });

    res.status(201).json({
      data: { added: rows.length, skipped },
    });
  } catch (err) {
    next(err);
  }
};

export const updateQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const owned = await assertOwner(req, req.params.id);
    if (!owned) return res.status(404).json({ error: 'Test topilmadi' });

    const existing = await prisma.quizTestQuestion.findFirst({
      where: { id: req.params.qId, testId: req.params.id },
    });
    if (!existing) return res.status(404).json({ error: 'Savol topilmadi' });

    const b = req.body;
    const data: any = {};

    if (b.text !== undefined) data.text = String(b.text).trim();
    if (b.type !== undefined) data.type = b.type === 'open' ? 'open' : 'closed';
    if (b.points !== undefined) data.points = Math.max(1, Number(b.points));
    if (b.caseSensitive !== undefined)
      data.caseSensitive = b.caseSensitive === 'true' || b.caseSensitive === true;
    if (b.manualReview !== undefined)
      data.manualReview = b.manualReview === 'true' || b.manualReview === true;
    if (b.order !== undefined) data.order = Number(b.order);

    const options = parseJsonField(b.options);
    if (options !== undefined) data.options = options;
    const correctIndexes = parseJsonField(b.correctIndexes);
    if (correctIndexes !== undefined) data.correctIndexes = correctIndexes;
    const acceptedAnswers = parseJsonField(b.acceptedAnswers);
    if (acceptedAnswers !== undefined) data.acceptedAnswers = acceptedAnswers;

    if (req.file) {
      // Eski rasmni o'chiramiz — volume ichida keraksiz fayl to'planmasin
      if (existing.imageUrl) {
        const old = path.join(process.cwd(), 'data', existing.imageUrl.replace(/^\//, ''));
        fs.promises.unlink(old).catch(() => {});
      }
      data.imageUrl = `/uploads/quiz-tests/${req.file.filename}`;
    } else if (b.removeImage === 'true' || b.removeImage === true) {
      if (existing.imageUrl) {
        const old = path.join(process.cwd(), 'data', existing.imageUrl.replace(/^\//, ''));
        fs.promises.unlink(old).catch(() => {});
      }
      data.imageUrl = null;
    }

    const question = await prisma.quizTestQuestion.update({
      where: { id: req.params.qId },
      data,
    });
    res.json({ data: question });
  } catch (err) {
    next(err);
  }
};

export const deleteQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const owned = await assertOwner(req, req.params.id);
    if (!owned) return res.status(404).json({ error: 'Test topilmadi' });

    const q = await prisma.quizTestQuestion.findFirst({
      where: { id: req.params.qId, testId: req.params.id },
    });
    if (!q) return res.status(404).json({ error: 'Savol topilmadi' });

    if (q.imageUrl) {
      const file = path.join(process.cwd(), 'data', q.imageUrl.replace(/^\//, ''));
      fs.promises.unlink(file).catch(() => {});
    }
    await prisma.quizTestQuestion.delete({ where: { id: q.id } });
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
};

/** Savollar tartibini almashtirish (drag-and-drop uchun). */
export const reorderQuestions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const owned = await assertOwner(req, req.params.id);
    if (!owned) return res.status(404).json({ error: 'Test topilmadi' });

    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (ids.length === 0) return res.status(400).json({ error: 'Tartib yuborilmadi' });

    await prisma.$transaction(
      ids.map((id: string, index: number) =>
        prisma.quizTestQuestion.updateMany({
          where: { id, testId: req.params.id },
          data: { order: index },
        })
      )
    );
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
};

// ─── Natijalar ───────────────────────────────────────────────────────────────

export const getResults = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const test = await prisma.quizTest.findFirst({
      where: { id: req.params.id, ...ownerFilter(req) },
      select: { id: true, title: true, passPercent: true },
    });
    if (!test) return res.status(404).json({ error: 'Test topilmadi' });

    const attempts = await prisma.quizTestAttempt.findMany({
      where: { testId: test.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        phone: true,
        attemptNumber: true,
        status: true,
        startedAt: true,
        submittedAt: true,
        score: true,
        maxScore: true,
        percent: true,
        correctCount: true,
        passed: true,
        needsReview: true,
      },
    });

    const submitted = attempts.filter((a) => a.status === 'submitted');
    const avg =
      submitted.length > 0
        ? Math.round(submitted.reduce((s, a) => s + (a.percent ?? 0), 0) / submitted.length)
        : null;

    res.json({
      data: {
        test,
        attempts,
        stats: {
          total: attempts.length,
          submitted: submitted.length,
          inProgress: attempts.filter((a) => a.status === 'in_progress').length,
          needsReview: attempts.filter((a) => a.needsReview).length,
          avgPercent: avg,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/** Bitta urinishning to'liq tafsiloti — savol, berilgan javob, to'g'risi. */
export const getAttemptDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attempt = await prisma.quizTestAttempt.findFirst({
      where: { id: req.params.attemptId, test: ownerFilter(req) },
      include: {
        test: { select: { id: true, title: true, passPercent: true } },
        answers: true,
      },
    });
    if (!attempt) return res.status(404).json({ error: 'Urinish topilmadi' });

    const questionIds = (attempt.questionIds as string[]) ?? [];
    const questions = await prisma.quizTestQuestion.findMany({
      where: { id: { in: questionIds } },
    });
    const qMap = new Map(questions.map((q) => [q.id, q]));
    const aMap = new Map(attempt.answers.map((a) => [a.questionId, a]));

    const items = questionIds.map((qid) => ({
      question: qMap.get(qid) ?? null,
      answer: aMap.get(qid) ?? null,
    }));

    res.json({ data: { attempt, items } });
  } catch (err) {
    next(err);
  }
};

/** Ochiq javobni mentor qo'lda baholaydi. */
export const reviewAnswer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { isCorrect, points } = req.body;

    const answer = await prisma.quizTestAnswer.findFirst({
      where: { id: req.params.answerId, attempt: { test: ownerFilter(req) } },
      include: { question: { select: { points: true } } },
    });
    if (!answer) return res.status(404).json({ error: 'Javob topilmadi' });

    const correct = isCorrect === true;
    const given =
      points === undefined || points === null
        ? correct
          ? answer.question.points
          : 0
        : Math.max(0, Math.min(Number(points), answer.question.points));

    await prisma.quizTestAnswer.update({
      where: { id: answer.id },
      data: {
        isCorrect: correct,
        points: given,
        needsReview: false,
        reviewedById: user.userId,
        reviewedAt: new Date(),
      },
    });

    const attempt = await recalculateAttempt(answer.attemptId);
    res.json({ data: { ok: true, attempt } });
  } catch (err) {
    next(err);
  }
};

/** Urinishni o'chirish (xato yoki sinov yozuvi). */
export const deleteAttempt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attempt = await prisma.quizTestAttempt.findFirst({
      where: { id: req.params.attemptId, test: ownerFilter(req) },
      select: { id: true },
    });
    if (!attempt) return res.status(404).json({ error: 'Urinish topilmadi' });

    await prisma.quizTestAttempt.delete({ where: { id: attempt.id } });
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
};

/** Mentor test ko'rinishini oldindan ko'radi — natija saqlanmaydi. */
export const previewTest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const test = await prisma.quizTest.findFirst({
      where: { id: req.params.id, ...ownerFilter(req) },
      include: { questions: true },
    });
    if (!test) return res.status(404).json({ error: 'Test topilmadi' });

    const closed = test.questions.filter((q) => q.type === 'closed');
    const open = test.questions.filter((q) => q.type === 'open');
    const ids = pickQuestionIds({
      closed,
      open,
      closedCount: test.closedCount,
      openCount: test.openCount,
      shuffleQuestions: test.shuffleQuestions,
    });

    const qMap = new Map(test.questions.map((q) => [q.id, q]));
    const questions = ids.map((id) => {
      const q = qMap.get(id)!;
      const options = Array.isArray(q.options) ? (q.options as string[]) : [];
      return {
        id: q.id,
        type: q.type,
        text: q.text,
        imageUrl: q.imageUrl,
        points: q.points,
        options: test.shuffleOptions ? shuffle(options) : options,
      };
    });

    res.json({ data: { test: { id: test.id, title: test.title }, questions } });
  } catch (err) {
    next(err);
  }
};
