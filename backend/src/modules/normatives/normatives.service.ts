import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { ApiError } from '../../shared/middleware/errorHandler';
import { CreateNormativeInput, UpdateNormativeInput } from './normatives.validation';
import { PaginationParams, createPaginatedResult } from '../../shared/utils/pagination';
import logger from '../../shared/utils/logger';

class NormativesService {
  /**
   * Barcha normativlarni olish
   */
  async getAll(params: PaginationParams, filters?: { search?: string }) {
    const where: Prisma.NormativeWhereInput = { isActive: true };

    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [normatives, total] = await Promise.all([
      prisma.normative.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
        },
        orderBy: [{ categoryId: 'asc' }, { taskNumber: 'asc' }],
        skip: params.skip,
        take: params.limit,
      }),
      prisma.normative.count({ where }),
    ]);

    return createPaginatedResult(normatives, total, params);
  }

  /**
   * Bitta normativni olish
   */
  async getById(id: string) {
    const normative = await prisma.normative.findUnique({
      where: { id },
      include: {
        groupNormatives: {
          include: {
            group: { select: { id: true, name: true } },
          },
        },
        category: { select: { id: true, name: true } },
        _count: {
          select: { submissions: true },
        },
      },
    });

    if (!normative) {
      throw ApiError.notFound('Normativ topilmadi');
    }

    return {
      ...normative,
      assignedGroups: normative.groupNormatives.map((gn) => ({
        ...gn.group,
        assignedAt: gn.assignedAt,
      })),
      submissionsCount: normative._count.submissions,
    };
  }

  /**
   * Normativ yaratish
   */
  async create(data: CreateNormativeInput, createdByUserId?: string) {
    const normative = await prisma.normative.create({
      data: {
        taskNumber: data.taskNumber,
        title: data.title,
        description: data.description,
        timeLimit: data.timeLimit,
        url: data.url,
        maxScore: data.maxScore,
        categoryId: data.categoryId,
      },
    });

    if (createdByUserId) {
      await prisma.auditLog.create({
        data: {
          userId: createdByUserId,
          action: 'CREATE_NORMATIVE',
          targetType: 'normative',
          targetId: normative.id,
          details: { taskNumber: data.taskNumber, title: data.title },
        },
      });
    }

    logger.info(`Normative created: #${data.taskNumber} - ${data.title}`);
    return normative;
  }

  /**
   * Normativni yangilash
   */
  async update(id: string, data: UpdateNormativeInput, updatedByUserId?: string) {
    const existing = await prisma.normative.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('Normativ topilmadi');

    const normative = await prisma.normative.update({
      where: { id },
      data: {
        ...data,
      },
    });

    if (updatedByUserId) {
      await prisma.auditLog.create({
        data: {
          userId: updatedByUserId,
          action: 'UPDATE_NORMATIVE',
          targetType: 'normative',
          targetId: id,
          details: { changes: Object.keys(data) },
        },
      });
    }

    logger.info(`Normative updated: #${normative.taskNumber}`);
    return normative;
  }

  /**
   * Guruhga normativlar biriktirish
   */
  async assignToGroup(groupId: string, normativeIds: string[], assignedByUserId?: string) {
    // Guruh mavjudligini tekshirish
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw ApiError.notFound('Guruh topilmadi');

    const results = [];
    const errors = [];

    for (const normativeId of normativeIds) {
      try {
        // Normativ mavjudligini tekshirish
        const normative = await prisma.normative.findUnique({ where: { id: normativeId } });
        if (!normative) {
          errors.push({ normativeId, error: 'Normativ topilmadi' });
          continue;
        }

        // Allaqachon biriktirilganligini tekshirish
        const existing = await prisma.groupNormative.findUnique({
          where: { groupId_normativeId: { groupId, normativeId } },
        });

        if (existing) {
          errors.push({ normativeId, error: 'Allaqachon biriktirilgan' });
          continue;
        }

        const result = await prisma.groupNormative.create({
          data: { groupId, normativeId },
          include: {
            normative: { select: { taskNumber: true, title: true } },
          },
        });

        results.push(result);
      } catch (error: any) {
        errors.push({ normativeId, error: error.message });
      }
    }

    if (assignedByUserId) {
      await prisma.auditLog.create({
        data: {
          userId: assignedByUserId,
          action: 'ASSIGN_NORMATIVES_TO_GROUP',
          targetType: 'group',
          targetId: groupId,
          details: { normativeIds, assigned: results.length, errors: errors.length },
        },
      });
    }

    logger.info(`${results.length} normatives assigned to group ${group.name}`);
    return { assigned: results.length, errors, results };
  }

  /**
   * Normativni o'chirish (soft delete)
   */
  async delete(id: string, deletedByUserId?: string) {
    const existing = await prisma.normative.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('Normativ topilmadi');

    await prisma.normative.update({
      where: { id },
      data: { isActive: false },
    });

    if (deletedByUserId) {
      await prisma.auditLog.create({
        data: {
          userId: deletedByUserId,
          action: 'DELETE_NORMATIVE',
          targetType: 'normative',
          targetId: id,
          details: { taskNumber: existing.taskNumber, title: existing.title },
        },
      });
    }

    logger.info(`Normative deactivated: #${existing.taskNumber}`);
    return { message: 'Normativ o\'chirildi' };
  }
}

export default new NormativesService();
