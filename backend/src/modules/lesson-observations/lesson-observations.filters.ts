import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { ApiError } from '../../shared/middleware/errorHandler';
import { observationDateRange } from './lesson-observations.criteria';

type Query = { from?: unknown; to?: unknown; teacherId?: unknown; page?: unknown };

export function observationFilters(query: Query, ownTeacherId?: string): { where: Prisma.LessonObservationWhereInput; page: number } {
  const from = query.from;
  const to = query.to;
  if ((from !== undefined && typeof from !== 'string') || (to !== undefined && typeof to !== 'string')) {
    throw ApiError.badRequest('Sana oralig‘i noto‘g‘ri');
  }
  const dateRange = observationDateRange(from as string | undefined, to as string | undefined);
  if (dateRange === null) throw ApiError.badRequest('Sana oralig‘i noto‘g‘ri');

  const page = query.page === undefined ? 1 : Number(query.page);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw ApiError.badRequest('Sahifa raqami noto‘g‘ri');

  // /me doim JWTdagi IDdan foydalanadi; mijozning teacherId parametri e'tiborsiz.
  const teacherId = ownTeacherId ?? query.teacherId;
  if (teacherId !== undefined && (typeof teacherId !== 'string' || !z.string().uuid().safeParse(teacherId).success)) {
    throw ApiError.badRequest('Ustoz ID noto‘g‘ri');
  }
  return {
    page,
    where: {
      ...(teacherId ? { teacherId } : {}),
      ...((from || to) ? { createdAt: dateRange } : {}),
    },
  };
}
