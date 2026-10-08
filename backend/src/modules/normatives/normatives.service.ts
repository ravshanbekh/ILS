import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { ApiError } from '../../shared/middleware/errorHandler';
import { CreateNormativeInput, UpdateNormativeInput } from './normatives.validation';
import { PaginationParams, createPaginatedResult } from '../../shared/utils/pagination';
import logger from '../../shared/utils/logger';
import { buildExport, extractItems, planImport, FIELD_LABELS, ImportPlan } from './normatives.transfer';

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

  // ─── JSON eksport / import (faqat admin) ──────────────────────────────────

  /** Barcha normativlar — o'chirilganlari ham (isActive belgisi bilan) */
  async exportAll() {
    const [normatives, categories] = await Promise.all([
      prisma.normative.findMany({ orderBy: [{ categoryId: 'asc' }, { taskNumber: 'asc' }, { createdAt: 'asc' }] }),
      prisma.category.findMany({ select: { id: true, name: true } }),
    ]);
    return buildExport(normatives, categories);
  }

  /** Reja: nima yaratiladi / yangilanadi / qayerda xato. Bazaga yozmaydi. */
  async planImport(body: unknown): Promise<ImportPlan> {
    const extracted = extractItems(body);
    if ('error' in extracted) throw ApiError.badRequest(extracted.error);
    const [db, categories] = await Promise.all([
      prisma.normative.findMany({
        select: {
          id: true, taskNumber: true, title: true, description: true, timeLimit: true,
          url: true, maxScore: true, isActive: true, categoryId: true,
        },
      }),
      prisma.category.findMany({ select: { id: true, name: true } }),
    ]);
    return planImport(extracted.items, db, categories);
  }

  /** Foydalanuvchiga ko'rsatiladigan qisqa xulosa (butun rejani emas) */
  summarize(plan: ImportPlan) {
    return {
      total: plan.total,
      createCount: plan.create.length,
      updateCount: plan.update.length,
      unchanged: plan.unchanged,
      newCategories: plan.newCategories,
      errors: plan.errors.slice(0, 200),
      errorCount: plan.errors.length,
      create: plan.create.slice(0, 300).map((c) => ({
        taskNumber: c.taskNumber,
        title: c.title,
        newCategory: c.newCategoryName,
      })),
      update: plan.update.slice(0, 300).map((u) => ({
        id: u.id,
        taskNumber: u.taskNumber,
        title: u.title,
        changes: u.changes.map((f) => FIELD_LABELS[f]),
      })),
    };
  }

  /**
   * Importni bajarish. Reja QAYTA hisoblanadi (oldindan ko'rishdan beri baza
   * o'zgargan bo'lishi mumkin) va bitta tranzaksiyada yoziladi: xato bo'lsa
   * hech narsa o'zgarmaydi.
   */
  async applyImport(body: unknown, userId?: string) {
    const plan = await this.planImport(body);
    if (plan.errors.length > 0) return { applied: false as const, plan };

    await prisma.$transaction(
      async (tx) => {
        // 1) Yangi yo'nalishlar
        const catIdByName = new Map<string, string>();
        for (const name of plan.newCategories) {
          const cat = await tx.category.upsert({
            where: { name },
            update: {},
            create: { name },
            select: { id: true },
          });
          catIdByName.set(name, cat.id);
        }
        const resolveCat = (id: string | null, newName?: string | null) =>
          newName ? catIdByName.get(newName) ?? null : id;

        // 2) Yangi normativlar
        if (plan.create.length > 0) {
          await tx.normative.createMany({
            data: plan.create.map((c) => ({
              taskNumber: c.taskNumber,
              title: c.title,
              description: c.description,
              timeLimit: c.timeLimit,
              url: c.url,
              maxScore: c.maxScore,
              isActive: c.isActive,
              categoryId: resolveCat(c.categoryId, c.newCategoryName),
            })),
          });
        }

        // 3) Yangilanadiganlar — faqat o'zgargan maydonlar
        for (const u of plan.update) {
          const { newCategoryName, ...fields } = u.data;
          const data: Record<string, unknown> = { ...fields };
          if ('categoryId' in data) data.categoryId = resolveCat(data.categoryId as string | null, newCategoryName);
          await tx.normative.update({ where: { id: u.id }, data });
        }

        if (userId) {
          await tx.auditLog.create({
            data: {
              userId,
              action: 'IMPORT_NORMATIVES',
              targetType: 'normative',
              targetId: null,
              details: {
                created: plan.create.length,
                updated: plan.update.length,
                unchanged: plan.unchanged,
                newCategories: plan.newCategories,
              },
            },
          });
        }
      },
      { timeout: 60_000 },
    );

    logger.info(
      `Normatives imported: +${plan.create.length} yangi, ${plan.update.length} yangilandi, ${plan.unchanged} o'zgarishsiz`,
    );
    return { applied: true as const, plan };
  }
}

export default new NormativesService();
