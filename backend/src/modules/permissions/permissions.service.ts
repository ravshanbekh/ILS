import prisma from '../../config/database';
import { ApiError } from '../../shared/middleware/errorHandler';
import { PermissionKey, PERMISSION_KEYS, isValidPermission } from '../../shared/constants/permissions';
import logger from '../../shared/utils/logger';

/** Ruxsat berilishi mumkin bo'lgan rollar — o'quvchiga ruxsat berish mantiqsiz */
const ASSIGNABLE_ROLES = [
  'teacher',
  'filial_rahbari',
  'assistant',
  'moliya_rahbari',
  'kassir',
  'administrator',
  'nazoratchi',
  'hr_rahbari',
  'sotuv_operatori',
  'call_operatori',
  'robototexnika_ustoz',
  'farrosh',
];

class PermissionsService {
  /** Bitta foydalanuvchining ruxsatlari (kalitlar ro'yxati) */
  async getUserPermissions(userId: string): Promise<PermissionKey[]> {
    const rows = await prisma.userPermission.findMany({
      where: { userId },
      select: { permission: true },
    });
    return rows.map((r) => r.permission).filter(isValidPermission);
  }

  /**
   * Ruxsat berish mumkin bo'lgan foydalanuvchilar + har birining ruxsatlari.
   * Admin har doim to'liq huquqli bo'lgani uchun ro'yxatga kirmaydi.
   */
  async listUsersWithPermissions(filters?: { search?: string; role?: string }) {
    const where: any = {
      isActive: true,
      role: filters?.role && ASSIGNABLE_ROLES.includes(filters.role)
        ? filters.role
        : { in: ASSIGNABLE_ROLES },
    };

    if (filters?.search) {
      where.OR = [
        { fullName: { contains: filters.search, mode: 'insensitive' } },
        { login: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        login: true,
        role: true,
        permissions: { select: { permission: true } },
      },
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
    });

    return users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      login: u.login,
      role: u.role,
      permissions: u.permissions.map((p) => p.permission).filter(isValidPermission),
    }));
  }

  /**
   * Foydalanuvchining ruxsatlarini to'liq almashtiradi (berilganlar ro'yxati).
   * Ro'yxatda yo'q ruxsatlar olib tashlanadi.
   */
  async setUserPermissions(userId: string, permissions: string[], grantedById: string) {
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isActive: true },
    });
    if (!target) throw ApiError.notFound('Foydalanuvchi topilmadi');
    if (target.role === 'admin') {
      throw ApiError.badRequest('Admin har doim to\'liq huquqli — unga ruxsat belgilash shart emas');
    }
    if (target.role === 'student') {
      throw ApiError.badRequest("O'quvchilarga bunday ruxsatlar berilmaydi");
    }

    const invalid = permissions.filter((p) => !isValidPermission(p));
    if (invalid.length > 0) {
      throw ApiError.badRequest(`Noma'lum ruxsat: ${invalid.join(', ')}`);
    }

    const desired = new Set(permissions);
    const current = new Set(await this.getUserPermissions(userId));

    const toAdd = [...desired].filter((p) => !current.has(p as PermissionKey));
    const toRemove = [...current].filter((p) => !desired.has(p));

    await prisma.$transaction(async (tx) => {
      if (toRemove.length > 0) {
        await tx.userPermission.deleteMany({
          where: { userId, permission: { in: toRemove } },
        });
      }
      if (toAdd.length > 0) {
        await tx.userPermission.createMany({
          data: toAdd.map((permission) => ({ userId, permission, grantedById })),
          skipDuplicates: true,
        });
      }
    });

    if (toAdd.length || toRemove.length) {
      logger.info(
        `Ruxsatlar yangilandi: user=${userId}, berildi=[${toAdd.join(',')}], olindi=[${toRemove.join(',')}]`
      );
    }

    return this.getUserPermissions(userId);
  }

  /**
   * Ruxsatlar tizimi birinchi marta ishga tushganda — hozirgi holatni saqlab qolish.
   * Har bir ruxsat uchun, ilgari o'sha amalni roli tufayli bajara olgan
   * foydalanuvchilarga o'sha ruxsat beriladi. Shu bilan yangi tizim yoqilganda
   * hech kimning ishi to'xtamaydi; admin keyin kerakmaslarini olib qo'yadi.
   */
  async seedLegacyPermissions(): Promise<number> {
    const { PERMISSIONS } = await import('../../shared/constants/permissions');

    let granted = 0;
    for (const key of PERMISSION_KEYS) {
      const legacyRoles = PERMISSIONS[key].legacyRoles as readonly string[];
      if (legacyRoles.length === 0) continue;

      const users = await prisma.user.findMany({
        where: { isActive: true, role: { in: legacyRoles as any } },
        select: { id: true },
      });
      if (users.length === 0) continue;

      const result = await prisma.userPermission.createMany({
        data: users.map((u) => ({ userId: u.id, permission: key })),
        skipDuplicates: true,
      });
      granted += result.count;
    }

    return granted;
  }
}

export default new PermissionsService();
