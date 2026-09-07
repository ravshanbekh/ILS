import prisma from '../../config/database';

/**
 * Bir nechta o'quvchining topshiriq statistikasini BITTA so'rov bilan yig'adi.
 *
 * Ilgari bu hisob har bir o'quvchi uchun alohida so'rov bilan olinardi
 * (`students.map(async ... prisma.submission.findMany(...))`) — ya'ni 300 ta
 * o'quvchi = 300 ta so'rov. Bu yerda hammasi bitta so'rovda olinib, xotirada
 * Map orqali guruhlanadi. Natija ilgarigidek — faqat so'rovlar soni tushadi.
 */

export interface StudentSubmissionStats {
  /** Tekshirilgan topshiriqlar bali yig'indisi */
  totalScore: number;
  /** Tekshirilgan topshiriqlar soni */
  completed: number;
  green: number;
  blue: number;
  red: number;
}

const EMPTY: StudentSubmissionStats = { totalScore: 0, completed: 0, green: 0, blue: 0, red: 0 };

/** Bo'sh (topshiriqsiz) o'quvchi uchun standart qiymat */
export function emptyStats(): StudentSubmissionStats {
  return { ...EMPTY };
}

/**
 * @param studentIds — kimlar uchun
 * @param normativeIds — faqat shu normativlar bo'yicha (null = cheklovsiz).
 *                       Bo'sh massiv berilsa, hech qanday topshiriq sanalmaydi —
 *                       bu ilgarigi `normativeId: { in: [] }` xatti-harakati bilan bir xil.
 */
export async function getCheckedStatsByStudent(
  studentIds: string[],
  normativeIds?: string[] | null
): Promise<Map<string, StudentSubmissionStats>> {
  const map = new Map<string, StudentSubmissionStats>();
  if (studentIds.length === 0) return map;

  const where: any = { studentId: { in: studentIds }, status: 'checked' };
  if (normativeIds !== undefined && normativeIds !== null) {
    where.normativeId = { in: normativeIds };
  }

  const submissions = await prisma.submission.findMany({
    where,
    select: { studentId: true, score: true, result: true },
  });

  for (const s of submissions) {
    let stats = map.get(s.studentId);
    if (!stats) {
      stats = emptyStats();
      map.set(s.studentId, stats);
    }
    stats.totalScore += s.score;
    stats.completed++;
    if (s.result === 'green') stats.green++;
    else if (s.result === 'blue') stats.blue++;
    else if (s.result === 'red') stats.red++;
  }

  return map;
}

/**
 * O'quvchi bo'yicha topshirilgan (status'dan qat'iy nazar) topshiriqlar soni —
 * "kutilmoqda" ni hisoblash uchun kerak bo'ladi.
 */
export async function getTotalCountByStudent(
  studentIds: string[],
  normativeIds?: string[] | null
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (studentIds.length === 0) return map;

  const where: any = { studentId: { in: studentIds } };
  if (normativeIds !== undefined && normativeIds !== null) {
    where.normativeId = { in: normativeIds };
  }

  const grouped = await prisma.submission.groupBy({
    by: ['studentId'],
    where,
    _count: { _all: true },
  });

  for (const row of grouped) {
    map.set(row.studentId, row._count._all);
  }
  return map;
}
