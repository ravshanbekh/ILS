import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { ApiError } from '../../shared/middleware/errorHandler';
import { CreateGroupInput, UpdateGroupInput } from './groups.validation';
import { PaginationParams, createPaginatedResult } from '../../shared/utils/pagination';
import logger from '../../shared/utils/logger';

class GroupsService {
  /**
   * Barcha guruhlarni olish
   */
  async getAll(params: PaginationParams, filters?: { teacherId?: string; search?: string }) {
    const where: Prisma.GroupWhereInput = { isActive: true };

    if (filters?.teacherId) {
      where.teacherId = filters.teacherId;
    }

    if (filters?.search) {
      where.name = { contains: filters.search, mode: 'insensitive' };
    }

    const [groups, total] = await Promise.all([
      prisma.group.findMany({
        where,
        include: {
          teacher: {
            select: { id: true, fullName: true },
          },
          groupStudents: {
            where: { student: { isActive: true } },
            select: { id: true }
          },
          _count: {
            select: { groupNormatives: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.limit,
      }),
      prisma.group.count({ where }),
    ]);

    const formattedGroups = groups.map((g) => ({
      id: g.id,
      name: g.name,
      teacher: g.teacher,
      studentsCount: g.groupStudents.length,
      normativesCount: g._count.groupNormatives,
      isActive: g.isActive,
      createdAt: g.createdAt,
    }));

    return createPaginatedResult(formattedGroups, total, params);
  }

  /**
   * Bitta guruhni olish (o'quvchilar bilan)
   */
  async getById(id: string) {
    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        teacher: {
          select: { id: true, fullName: true, login: true },
        },
        groupStudents: {
          where: { student: { isActive: true } },
          include: {
            student: {
              select: { id: true, fullName: true, login: true, avatarUrl: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
        groupNormatives: {
          include: {
            normative: {
              select: { id: true, taskNumber: true, title: true, maxScore: true },
            },
          },
          orderBy: { assignedAt: 'asc' },
        },
        _count: {
          select: { submissions: true },
        },
      },
    });

    if (!group) {
      throw ApiError.notFound('Guruh topilmadi');
    }

    return {
      ...group,
      students: group.groupStudents.map((gs) => ({
        ...gs.student,
        joinedAt: gs.joinedAt,
      })),
      normatives: group.groupNormatives.map((gn) => ({
        ...gn.normative,
        assignedAt: gn.assignedAt,
      })),
      submissionsCount: group._count.submissions,
    };
  }

  /**
   * Guruh yaratish
   */
  async create(data: CreateGroupInput, createdByUserId?: string) {
    // Agar teacherId berilgan bo'lsa, teacher mavjudligini tekshirish
    if (data.teacherId) {
      const teacher = await prisma.user.findFirst({
        where: { id: data.teacherId, role: 'teacher', isActive: true },
      });
      if (!teacher) {
        throw ApiError.badRequest('O\'qituvchi topilmadi yoki faol emas');
      }
    }

    const group = await prisma.group.create({
      data: {
        name: data.name,
        teacherId: data.teacherId,
      },
      include: {
        teacher: {
          select: { id: true, fullName: true },
        },
      },
    });

    // Audit log
    if (createdByUserId) {
      await prisma.auditLog.create({
        data: {
          userId: createdByUserId,
          action: 'CREATE_GROUP',
          targetType: 'group',
          targetId: group.id,
          details: { name: data.name },
        },
      });
    }

    logger.info(`Group created: ${group.name}`);
    return group;
  }

  /**
   * Guruhni yangilash
   */
  async update(id: string, data: UpdateGroupInput, updatedByUserId?: string) {
    const existing = await prisma.group.findUnique({ where: { id } });
    if (!existing) {
      throw ApiError.notFound('Guruh topilmadi');
    }

    const group = await prisma.group.update({
      where: { id },
      data,
      include: {
        teacher: {
          select: { id: true, fullName: true },
        },
      },
    });

    if (updatedByUserId) {
      await prisma.auditLog.create({
        data: {
          userId: updatedByUserId,
          action: 'UPDATE_GROUP',
          targetType: 'group',
          targetId: id,
          details: { changes: Object.keys(data) },
        },
      });
    }

    logger.info(`Group updated: ${group.name}`);
    return group;
  }

  /**
   * Guruhga o'quvchi qo'shish
   */
  async addStudent(groupId: string, studentId: string, addedByUserId?: string) {
    // Guruh mavjudligini tekshirish
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw ApiError.notFound('Guruh topilmadi');

    // O'quvchi mavjudligini tekshirish
    const student = await prisma.user.findFirst({
      where: { id: studentId, role: 'student', isActive: true },
    });
    if (!student) throw ApiError.badRequest('O\'quvchi topilmadi yoki faol emas');

    // Allaqachon guruhda ekanligini tekshirish
    const existing = await prisma.groupStudent.findUnique({
      where: { groupId_studentId: { groupId, studentId } },
    });
    if (existing) throw ApiError.conflict('O\'quvchi allaqachon bu guruhda');

    const result = await prisma.groupStudent.create({
      data: { groupId, studentId },
      include: {
        student: {
          select: { id: true, fullName: true, login: true },
        },
      },
    });

    if (addedByUserId) {
      await prisma.auditLog.create({
        data: {
          userId: addedByUserId,
          action: 'ADD_STUDENT_TO_GROUP',
          targetType: 'group',
          targetId: groupId,
          details: { studentId, studentName: student.fullName },
        },
      });
    }

    logger.info(`Student ${student.fullName} added to group ${group.name}`);
    return result;
  }

  /**
   * Ko'plab o'quvchilarni guruhga qo'shish
   */
  async addStudents(groupId: string, studentIds: string[], addedByUserId?: string) {
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw ApiError.notFound('Guruh topilmadi');

    const results = [];
    const errors = [];

    for (const studentId of studentIds) {
      try {
        const result = await this.addStudent(groupId, studentId, addedByUserId);
        results.push(result);
      } catch (error: any) {
        errors.push({ studentId, error: error.message });
      }
    }

    return { added: results.length, errors, results };
  }

  /**
   * O'quvchini guruhdan chiqarish
   */
  async removeStudent(groupId: string, studentId: string, removedByUserId?: string) {
    const record = await prisma.groupStudent.findUnique({
      where: { groupId_studentId: { groupId, studentId } },
    });

    if (!record) {
      throw ApiError.notFound('O\'quvchi bu guruhda topilmadi');
    }

    await prisma.groupStudent.delete({
      where: { id: record.id },
    });

    if (removedByUserId) {
      await prisma.auditLog.create({
        data: {
          userId: removedByUserId,
          action: 'REMOVE_STUDENT_FROM_GROUP',
          targetType: 'group',
          targetId: groupId,
          details: { studentId },
        },
      });
    }

    logger.info(`Student ${studentId} removed from group ${groupId}`);
    return { message: 'O\'quvchi guruhdan chiqarildi' };
  }

  /**
   * Guruhni o'chirish (soft delete)
   */
  async delete(id: string, deletedByUserId?: string) {
    const existing = await prisma.group.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('Guruh topilmadi');

    await prisma.group.update({
      where: { id },
      data: { isActive: false },
    });

    if (deletedByUserId) {
      await prisma.auditLog.create({
        data: {
          userId: deletedByUserId,
          action: 'DELETE_GROUP',
          targetType: 'group',
          targetId: id,
          details: { name: existing.name },
        },
      });
    }

    logger.info(`Group deactivated: ${existing.name}`);
    return { message: 'Guruh o\'chirildi' };
  }
}

export default new GroupsService();
