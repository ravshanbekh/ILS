import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { ApiError } from '../../shared/middleware/errorHandler';
import { CreateUserInput, UpdateUserInput } from './users.validation';
import { PaginationParams, createPaginatedResult } from '../../shared/utils/pagination';
import logger from '../../shared/utils/logger';

class UsersService {
  /**
   * Barcha foydalanuvchilarni olish (pagination bilan)
   */
  async getAll(params: PaginationParams, filters?: { role?: string; search?: string }) {
    const where: Prisma.UserWhereInput = { isActive: true };

    if (filters?.role) {
      where.role = filters.role as any;
    }

    if (filters?.search) {
      where.OR = [
        { fullName: { contains: filters.search, mode: 'insensitive' } },
        { login: { contains: filters.search, mode: 'insensitive' } },
      ];
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
          isActive: true,
          createdAt: true,
          groupStudents: {
            select: {
              group: {
                select: { id: true, name: true }
              }
            },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.limit,
      }),
      prisma.user.count({ where }),
    ]);

    // groupStudents dan birinchi guruhni chiqaramiz
    const usersWithGroup = users.map(u => ({
      ...u,
      group: (u as any).groupStudents?.[0]?.group || null,
    }));

    return createPaginatedResult(usersWithGroup, total, params);
  }

  /**
   * Guruhda bo'lmagan o'quvchilarni olish (GroupDetailPage uchun bug fix)
   * Pagination CHEGARASI yo'q — barcha guruhsiz o'quvchilar qaytariladi
   */
  async getUngrouped(search?: string) {
    const where: Prisma.UserWhereInput = {
      role: 'student',
      isActive: true,
      groupStudents: { none: {} }, // Hech bir guruhda yo'q
    };

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { login: { contains: search, mode: 'insensitive' } },
      ];
    }

    return prisma.user.findMany({
      where,
      select: { id: true, fullName: true, login: true, avatarUrl: true, createdAt: true },
      orderBy: { fullName: 'asc' },
    });
  }

  /**
   * Teacher ning barcha o'quvchilarini BITTA so'rovda olish (tezkor)
   */
  async getMyStudents(teacherId: string, params: PaginationParams, search?: string) {
    // Bitta JOIN query — N+1 muammosi yo'q
    const where: Prisma.GroupStudentWhereInput = {
      group: {
        teacherId,
        isActive: true,
      },
      student: {
        isActive: true,
        ...(search ? {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { login: { contains: search, mode: 'insensitive' } },
          ]
        } : {}),
      },
    };

    const [groupStudents, total] = await Promise.all([
      prisma.groupStudent.findMany({
        where,
        select: {
          student: {
            select: {
              id: true,
              fullName: true,
              login: true,
              role: true,
              avatarUrl: true,
              createdAt: true,
            },
          },
        },
        orderBy: { student: { fullName: 'asc' } },
      }),
      // unique count uchun distinct
      prisma.groupStudent.findMany({
        where,
        select: { studentId: true },
        distinct: ['studentId'],
      }).then(r => r.length),
    ]);

    // Duplicate studentlarni olib tashlaymiz (bir o'quvchi bir necha guruhda bo'lishi mumkin)
    const uniqueMap = new Map<string, any>();
    for (const gs of groupStudents) {
      uniqueMap.set(gs.student.id, gs.student);
    }
    const allStudents = Array.from(uniqueMap.values());
    const uniqueTotal = allStudents.length;

    // Pagination (in-memory, chunki unique kerak)
    const paged = allStudents.slice(params.skip, params.skip + params.limit);

    return createPaginatedResult(paged, uniqueTotal, params);
  }

  /**
   * Bitta foydalanuvchini ID bo'yicha olish
   */
  async getById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        login: true,
        role: true,
        avatarUrl: true,
        isActive: true,
        createdAt: true,
        groupStudents: {
          include: {
            group: {
              select: { id: true, name: true },
            },
          },
        },
        teacherGroups: {
          select: { id: true, name: true },
        },
      },
    });

    if (!user) {
      throw ApiError.notFound('Foydalanuvchi topilmadi');
    }

    return user;
  }

  /**
   * Yangi foydalanuvchi yaratish
   */
  async create(data: CreateUserInput, createdByUserId?: string) {
    // Login mavjudligini tekshirish
    const existing = await prisma.user.findUnique({
      where: { login: data.login },
    });

    if (existing) {
      throw ApiError.conflict(`"${data.login}" login allaqachon mavjud`);
    }

    // Parolni hash qilish
    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        fullName: data.fullName,
        login: data.login,
        passwordHash,
        role: data.role as any,
        avatarUrl: data.avatarUrl,
      },
      select: {
        id: true,
        fullName: true,
        login: true,
        role: true,
        avatarUrl: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Audit log
    if (createdByUserId) {
      await prisma.auditLog.create({
        data: {
          userId: createdByUserId,
          action: 'CREATE_USER',
          targetType: 'user',
          targetId: user.id,
          details: { role: data.role, login: data.login },
        },
      });
    }

    logger.info(`User created: ${user.login} (${user.role})`);
    return user;
  }

  /**
   * Bulk import users
   */
  async bulkCreate(users: CreateUserInput[], createdByUserId?: string) {
    let created = 0;
    const errors: string[] = [];

    for (const data of users) {
      try {
        const existing = await prisma.user.findUnique({ where: { login: data.login } });
        if (existing) {
          errors.push(`${data.login} - allaqachon mavjud`);
          continue;
        }
        const passwordHash = await bcrypt.hash(data.password, 10);
        await prisma.user.create({
          data: {
            fullName: data.fullName,
            login: data.login,
            passwordHash,
            role: data.role as any,
          }
        });
        created++;
      } catch (err: any) {
        errors.push(`${data.login} - saqlashda xato: ${err.message}`);
      }
    }

    if (createdByUserId && created > 0) {
      await prisma.auditLog.create({
        data: {
          userId: createdByUserId,
          action: 'BULK_CREATE_USERS',
          targetType: 'user',
          targetId: 'bulk',
          details: { createdCount: created },
        },
      });
    }

    return { created, errors };
  }

  /**
   * Foydalanuvchini yangilash
   */
  async update(id: string, data: UpdateUserInput, updatedByUserId?: string) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw ApiError.notFound('Foydalanuvchi topilmadi');
    }

    // Agar login o'zgarsa, unique tekshirish
    if (data.login && data.login !== existing.login) {
      const loginExists = await prisma.user.findUnique({
        where: { login: data.login },
      });
      if (loginExists) {
        throw ApiError.conflict(`"${data.login}" login allaqachon mavjud`);
      }
    }

    const updateData: Prisma.UserUpdateInput = {};

    // Ma'lumotlarni to'ldirish
    if (data.fullName) updateData.fullName = data.fullName;
    if (data.login) updateData.login = data.login;
    if (data.role) updateData.role = data.role as any;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    // Parolni hash qilish (agar o'zgaryapti)
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 12);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        login: true,
        role: true,
        avatarUrl: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Audit log
    if (updatedByUserId) {
      await prisma.auditLog.create({
        data: {
          userId: updatedByUserId,
          action: 'UPDATE_USER',
          targetType: 'user',
          targetId: id,
          details: { changes: Object.keys(data) },
        },
      });
    }

    logger.info(`User updated: ${user.login}`);
    return user;
  }

  /**
   * Foydalanuvchini o'chirish (soft delete)
   */
  async delete(id: string, deletedByUserId?: string) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw ApiError.notFound('Foydalanuvchi topilmadi');
    }

    // Soft delete — isActive = false
    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    // Audit log
    if (deletedByUserId) {
      await prisma.auditLog.create({
        data: {
          userId: deletedByUserId,
          action: 'DELETE_USER',
          targetType: 'user',
          targetId: id,
          details: { login: existing.login },
        },
      });
    }

    logger.info(`User deactivated: ${existing.login}`);
    return { message: 'Foydalanuvchi o\'chirildi' };
  }
}

export default new UsersService();
