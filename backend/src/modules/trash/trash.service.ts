import prisma from '../../config/database';
import { ApiError } from '../../shared/middleware/errorHandler';
import { PaginationParams, createPaginatedResult } from '../../shared/utils/pagination';
import logger from '../../shared/utils/logger';

class TrashService {
  /**
   * O'chirilgan (soft-deleted) guruhlarni olish
   */
  async getTrashGroups(params: PaginationParams, search?: string) {
    const where: any = { isActive: false };
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [groups, total] = await Promise.all([
      prisma.group.findMany({
        where,
        include: {
          teacher: { select: { id: true, fullName: true, login: true } },
          _count: { select: { groupStudents: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.limit,
      }),
      prisma.group.count({ where }),
    ]);

    const formatted = groups.map((g: any) => ({
      id: g.id,
      name: g.name,
      teacher: g.teacher,
      studentsCount: g._count?.groupStudents || 0,
      createdAt: g.createdAt,
    }));

    return createPaginatedResult(formatted, total, params);
  }

  /**
   * O'chirilgan (soft-deleted) foydalanuvchilarni olish
   */
  async getTrashUsers(params: PaginationParams, search?: string, role?: string) {
    const where: any = { isActive: false };
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { login: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) {
      where.role = role;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          login: true,
          role: true,
          avatarUrl: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.limit,
      }),
      prisma.user.count({ where }),
    ]);

    return createPaginatedResult(users, total, params);
  }

  /**
   * Guruhni qaytarish (Restore)
   */
  async restoreGroup(id: string, restoredByUserId?: string) {
    const group = await prisma.group.findUnique({ where: { id } });
    if (!group) throw ApiError.notFound('Guruh topilmadi');
    if (group.isActive) throw ApiError.badRequest('Guruh allaqachon faol');

    const updated = await prisma.group.update({
      where: { id },
      data: { isActive: true },
    });

    if (restoredByUserId) {
      await prisma.auditLog.create({
        data: {
          userId: restoredByUserId,
          action: 'RESTORE_GROUP',
          targetType: 'group',
          targetId: id,
          details: { name: group.name },
        },
      });
    }

    logger.info(`Group restored: ${group.name}`);
    return updated;
  }

  /**
   * Foydalanuvchini qaytarish (Restore)
   */
  async restoreUser(id: string, restoredByUserId?: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw ApiError.notFound('Foydalanuvchi topilmadi');
    if (user.isActive) throw ApiError.badRequest('Foydalanuvchi allaqachon faol');

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: true },
      select: {
        id: true,
        fullName: true,
        login: true,
        role: true,
        isActive: true,
      },
    });

    if (restoredByUserId) {
      await prisma.auditLog.create({
        data: {
          userId: restoredByUserId,
          action: 'RESTORE_USER',
          targetType: 'user',
          targetId: id,
          details: { login: user.login },
        },
      });
    }

    logger.info(`User restored: ${user.login}`);
    return updated;
  }

  /**
   * Guruhni butunlay o'chirish (Permanent Hard Delete)
   */
  async permanentlyDeleteGroup(id: string, deletedByUserId?: string) {
    const group = await prisma.group.findUnique({ where: { id } });
    if (!group) throw ApiError.notFound('Guruh topilmadi');

    await prisma.group.delete({ where: { id } });

    if (deletedByUserId) {
      await prisma.auditLog.create({
        data: {
          userId: deletedByUserId,
          action: 'PERMANENT_DELETE_GROUP',
          targetType: 'group',
          targetId: id,
          details: { name: group.name },
        },
      });
    }

    logger.info(`Group permanently deleted: ${group.name}`);
    return { message: 'Guruh keshdan va bazadan butunlay o\'chirildi' };
  }

  /**
   * Foydalanuvchini butunlay o'chirish (Permanent Hard Delete)
   */
  async permanentlyDeleteUser(id: string, deletedByUserId?: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw ApiError.notFound('Foydalanuvchi topilmadi');

    await prisma.user.delete({ where: { id } });

    if (deletedByUserId) {
      await prisma.auditLog.create({
        data: {
          userId: deletedByUserId,
          action: 'PERMANENT_DELETE_USER',
          targetType: 'user',
          targetId: id,
          details: { login: user.login },
        },
      });
    }

    logger.info(`User permanently deleted: ${user.login}`);
    return { message: 'Foydalanuvchi keshdan va bazadan butunlay o\'chirildi' };
  }

  /**
   * Korzinkani butunlay tozalash (Empty Trash)
   */
  async emptyTrash(deletedByUserId?: string) {
    const [deletedGroups, deletedUsers] = await Promise.all([
      prisma.group.deleteMany({ where: { isActive: false } }),
      prisma.user.deleteMany({ where: { isActive: false } }),
    ]);

    if (deletedByUserId) {
      await prisma.auditLog.create({
        data: {
          userId: deletedByUserId,
          action: 'EMPTY_TRASH',
          targetType: 'system',
          targetId: 'trash',
          details: { groupsCount: deletedGroups.count, usersCount: deletedUsers.count },
        },
      });
    }

    logger.info(`Trash emptied: ${deletedGroups.count} groups, ${deletedUsers.count} users purged.`);
    return {
      message: 'Savat to' + "'" + 'liq tozalandi',
      deletedGroups: deletedGroups.count,
      deletedUsers: deletedUsers.count,
    };
  }
}

export default new TrashService();
