import crypto from 'crypto';
import prisma from '../../config/database';

// ─────────────────────────────────────────────────────────────────────────────
//  Universal test paneli — umumiy mantiq
//  Exam modulidan farqi: ishtirokchi ro'yxatdan o'tmaydi, savollar ochiq ham
//  bo'lishi mumkin, va har testning o'z sozlamalari bor.
// ─────────────────────────────────────────────────────────────────────────────

/** Havola kodi: chalkashadigan belgilar (0/O, 1/I) qasddan chiqarilgan. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export async function generateUniqueCode(length = 6): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = '';
    for (let i = 0; i < length; i++) {
      code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
    }
    const exists = await prisma.quizTest.findUnique({ where: { code } });
    if (!exists) return code;
  }
  // 20 urinish ham to'qnashsa — uzunroq kod bilan qayta urinamiz
  return generateUniqueCode(length + 1);
}

export function generateAttemptToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

/** Fisher–Yates — `sort(() => Math.random() - 0.5)` noto'g'ri taqsimot beradi. */
export function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ─── Javobni solishtirish ────────────────────────────────────────────────────

/** Ochiq javobni taqqoslash uchun normallashtirish. */
export function normalizeText(value: string, caseSensitive: boolean): string {
  let out = String(value ?? '')
    .replace(/‘|’|ʻ|ʼ|`/g, "'") // turli apostroflar → bitta shakl
    .replace(/\s+/g, ' ')
    .trim();
  if (!caseSensitive) out = out.toLocaleLowerCase('uz');
  return out;
}

export interface GradedAnswer {
  isCorrect: boolean | null; // null = qo'lda baholanadi
  points: number;
  needsReview: boolean;
}

/**
 * Bitta javobni baholaydi.
 *
 * Yopiq savol: tanlangan to'plam to'g'ri to'plam bilan AYNAN mos kelishi kerak.
 * Qisman to'g'ri javobga ball berilmaydi — aks holda "hammasini belgilash"
 * strategiyasi ball keltirib qo'yadi.
 *
 * Ochiq savol: qabul qilinadigan javoblar ro'yxati bilan solishtiriladi.
 * Ro'yxat bo'sh yoki `manualReview` yoqilgan bo'lsa — mentorga qoldiriladi.
 */
export function gradeAnswer(
  question: {
    type: string;
    options: unknown;
    correctIndexes: unknown;
    acceptedAnswers: unknown;
    caseSensitive: boolean;
    manualReview: boolean;
    points: number;
  },
  answer: { selected?: number[] | null; textAnswer?: string | null }
): GradedAnswer {
  if (question.type === 'open') {
    const text = (answer.textAnswer ?? '').trim();
    if (!text) return { isCorrect: false, points: 0, needsReview: false };

    const accepted = Array.isArray(question.acceptedAnswers)
      ? (question.acceptedAnswers as string[])
      : [];

    if (question.manualReview || accepted.length === 0) {
      return { isCorrect: null, points: 0, needsReview: true };
    }

    const given = normalizeText(text, question.caseSensitive);
    const hit = accepted.some(
      (a) => normalizeText(String(a), question.caseSensitive) === given
    );
    return { isCorrect: hit, points: hit ? question.points : 0, needsReview: false };
  }

  // ── yopiq savol ──
  const correct = Array.isArray(question.correctIndexes)
    ? (question.correctIndexes as number[]).map(Number).sort((a, b) => a - b)
    : [];
  const given = Array.isArray(answer.selected)
    ? [...new Set(answer.selected.map(Number))].sort((a, b) => a - b)
    : [];

  if (correct.length === 0) {
    // To'g'ri javob belgilanmagan savol — ball bermaymiz, lekin oqimni buzmaymiz
    return { isCorrect: null, points: 0, needsReview: true };
  }

  const same =
    given.length === correct.length && given.every((v, i) => v === correct[i]);
  return { isCorrect: same, points: same ? question.points : 0, needsReview: false };
}

// ─── Savol tanlash ───────────────────────────────────────────────────────────

interface PickArgs {
  closed: { id: string }[];
  open: { id: string }[];
  closedCount: number | null;
  openCount: number | null;
  shuffleQuestions: boolean;
}

/**
 * Urinish uchun savollarni tanlaydi.
 * `closedCount`/`openCount` null bo'lsa — o'sha turdagi hamma savol beriladi.
 * Bankda yetarli savol bo'lmasa, bor bo'lgani beriladi (xato emas).
 */
export function pickQuestionIds({
  closed,
  open,
  closedCount,
  openCount,
  shuffleQuestions,
}: PickArgs): string[] {
  const takeFrom = (pool: { id: string }[], count: number | null) => {
    const ids = shuffle(pool).map((q) => q.id);
    if (count === null || count === undefined) return ids;
    return ids.slice(0, Math.max(0, count));
  };

  const picked = [...takeFrom(closed, closedCount), ...takeFrom(open, openCount)];
  return shuffleQuestions ? shuffle(picked) : picked;
}

// ─── Urinish yakunlash ───────────────────────────────────────────────────────

/**
 * Urinishni baholaydi va yakuniy ballni yozadi.
 * Qo'lda baholanadigan javob bo'lsa, `needsReview` bilan belgilanadi —
 * ball keyin mentor baholaganda qayta hisoblanadi.
 */
export async function finalizeAttempt(attemptId: string) {
  const attempt = await prisma.quizTestAttempt.findUnique({
    where: { id: attemptId },
    include: {
      answers: true,
      test: { select: { passPercent: true } },
    },
  });
  if (!attempt) return null;

  const questionIds = (attempt.questionIds as string[]) ?? [];
  const questions = await prisma.quizTestQuestion.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, points: true },
  });

  const maxScore = questions.reduce((sum, q) => sum + q.points, 0);
  const score = attempt.answers.reduce((sum, a) => sum + a.points, 0);
  const correctCount = attempt.answers.filter((a) => a.isCorrect === true).length;
  const needsReview = attempt.answers.some((a) => a.needsReview);
  const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const passPercent = attempt.test.passPercent;

  return prisma.quizTestAttempt.update({
    where: { id: attemptId },
    data: {
      status: 'submitted',
      submittedAt: new Date(),
      score,
      maxScore,
      percent,
      correctCount,
      needsReview,
      // Qo'lda baholash kutilayotgan bo'lsa, o'tdi/yiqildi hali aniq emas
      passed: needsReview || passPercent === null ? null : percent >= passPercent,
    },
  });
}

/** Mentor ochiq javobni baholagandan keyin ballarni qayta yig'ish. */
export async function recalculateAttempt(attemptId: string) {
  return finalizeAttempt(attemptId);
}
