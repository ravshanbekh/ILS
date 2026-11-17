/**
 * O'quvchi kirishini vaqtincha yopish / ochish.
 *
 * Maqsad: to'lov kechikkan (yoki boshqa sabab bilan) o'quvchining tizimga
 * kirishini mentor bitta tugma bilan yopadi, to'lansa — yana ochadi. To'lov
 * tekshiruvi boshqa platformada; bu yerda faqat holat.
 *
 * Nega isActive emas: isActive=false o'quvchini guruh ro'yxati, reyting,
 * statistikadan butunlay yashiradi (o'chirilgan kabi). Bu yerda esa o'quvchi
 * hamma joyda o'z o'rnida qoladi — sinfdoshlariga hech narsa sezilmaydi,
 * faqat o'zi tizimga kira olmaydi:
 *   - login: parol to'g'ri bo'lsa ham betaraf xabar (sabab aytilmaydi);
 *   - token yangilash va har bir so'rov (authenticate) rad etiladi;
 *   - yopilganda tokenVersion oshadi → ochiq sessiyalar darhol tugaydi.
 *
 * Kim qila oladi: student_access_block ruxsati bor xodim (o'qituvchilarda
 * standart). O'qituvchi — faqat O'Z guruhidagi o'quvchiga; admin va ruxsat
 * berilgan boshqa xodimlar — istalgan o'quvchiga.
 */
import prisma from '../../config/database';
import { ApiError } from '../../shared/middleware/errorHandler';
import usersService from '../users/users.service';

export const BLOCK_REASONS = ['payment', 'other'] as const;
export type BlockReason = (typeof BLOCK_REASONS)[number];

/** O'quvchiga ko'rinadigan matn — ataylab sababsiz (to'lov haqida gapirilmaydi) */
export { STUDENT_ACCESS_BLOCKED_MESSAGE as BLOCKED_MESSAGE } from '../../shared/constants/studentAccess';

type Actor = { userId: string; role: string };

async function loadStudentFor(actor: Actor, studentId: string) {
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, fullName: true, login: true, role: true, isActive: true, accessBlockedAt: true },
  });
  if (!student || student.role !== 'student') throw ApiError.notFound("O'quvchi topilmadi");
  // Egalik: o'qituvchi faqat o'z guruhidagi o'quvchini boshqaradi (IDOR'ga qarshi)
  if (actor.role === 'teacher' && !(await usersService.isStudentOfTeacher(studentId, actor.userId))) {
    throw ApiError.forbidden("Bu o'quvchi sizning guruhingizda emas");
  }
  return student;
}

const statusOf = (u: {
  accessBlockedAt: Date | null;
  accessBlockReason: string | null;
  accessBlockNote: string | null;
  accessBlockedById: string | null;
}, names: Map<string, string>) =>
  u.accessBlockedAt
    ? {
        blocked: true,
        blockedAt: u.accessBlockedAt,
        reason: u.accessBlockReason,
        note: u.accessBlockNote,
        blockedBy: u.accessBlockedById ? { id: u.accessBlockedById, fullName: names.get(u.accessBlockedById) ?? null } : null,
      }
    : { blocked: false };

async function namesOf(ids: (string | null)[]) {
  const uniq = [...new Set(ids.filter((x): x is string => !!x))];
  if (!uniq.length) return new Map<string, string>();
  const rows = await prisma.user.findMany({ where: { id: { in: uniq } }, select: { id: true, fullName: true } });
  return new Map(rows.map((r) => [r.id, r.fullName]));
}

class StudentAccessService {
  async block(actor: Actor, studentId: string, reason: BlockReason, note?: string | null) {
    const student = await loadStudentFor(actor, studentId);
    const cleanNote = note?.replace(/\s+/g, ' ').trim().slice(0, 200) || null;
    const updated = await prisma.user.update({
      where: { id: student.id },
      data: {
        accessBlockedAt: student.accessBlockedAt ?? new Date(), // qayta bosilsa vaqt o'zgarmaydi
        accessBlockedById: actor.userId,
        accessBlockReason: reason,
        accessBlockNote: cleanNote,
        // Ochiq sessiyalar (telefon, kompyuter) darhol tugaydi
        ...(student.accessBlockedAt ? {} : { tokenVersion: { increment: 1 } }),
      },
      select: { accessBlockedAt: true, accessBlockReason: true, accessBlockNote: true, accessBlockedById: true },
    });
    await prisma.auditLog.create({
      data: {
        userId: actor.userId,
        action: 'STUDENT_ACCESS_BLOCKED',
        targetType: 'user',
        targetId: student.id,
        details: { login: student.login, reason, note: cleanNote },
      },
    });
    return { student: { id: student.id, fullName: student.fullName, login: student.login }, ...statusOf(updated, await namesOf([actor.userId])) };
  }

  async unblock(actor: Actor, studentId: string) {
    const student = await loadStudentFor(actor, studentId);
    if (student.accessBlockedAt) {
      await prisma.user.update({
        where: { id: student.id },
        data: { accessBlockedAt: null, accessBlockedById: null, accessBlockReason: null, accessBlockNote: null },
      });
      await prisma.auditLog.create({
        data: {
          userId: actor.userId,
          action: 'STUDENT_ACCESS_UNBLOCKED',
          targetType: 'user',
          targetId: student.id,
          details: { login: student.login, blockedSince: student.accessBlockedAt },
        },
      });
    }
    return { student: { id: student.id, fullName: student.fullName, login: student.login }, blocked: false };
  }

  /** Guruh sahifasi uchun: shu guruhdagi kirishi yopilgan o'quvchilar */
  async groupStatus(actor: Actor, groupId: string) {
    const group = await prisma.group.findUnique({ where: { id: groupId }, select: { id: true, teacherId: true } });
    if (!group) throw ApiError.notFound('Guruh topilmadi');
    if (actor.role === 'teacher' && group.teacherId !== actor.userId) {
      throw ApiError.forbidden('Bu guruh sizniki emas');
    }
    const rows = await prisma.groupStudent.findMany({
      where: { groupId, student: { accessBlockedAt: { not: null } } },
      select: {
        student: {
          select: { id: true, accessBlockedAt: true, accessBlockReason: true, accessBlockNote: true, accessBlockedById: true },
        },
      },
    });
    const names = await namesOf(rows.map((r) => r.student.accessBlockedById));
    return Object.fromEntries(rows.map((r) => [r.student.id, statusOf(r.student, names)]));
  }

  /** Kirishi yopilgan barcha o'quvchilar (o'qituvchi — faqat o'z guruhlaridagilar) */
  async listBlocked(actor: Actor) {
    const rows = await prisma.user.findMany({
      where: {
        role: 'student',
        accessBlockedAt: { not: null },
        ...(actor.role === 'teacher' ? { groupStudents: { some: { group: { teacherId: actor.userId } } } } : {}),
      },
      orderBy: { accessBlockedAt: 'asc' },
      select: {
        id: true, fullName: true, login: true, accessBlockedAt: true, accessBlockReason: true, accessBlockNote: true, accessBlockedById: true,
        groupStudents: { select: { group: { select: { id: true, name: true } } } },
      },
    });
    const names = await namesOf(rows.map((r) => r.accessBlockedById));
    return rows.map((r) => ({
      id: r.id,
      fullName: r.fullName,
      login: r.login,
      groups: r.groupStudents.map((g) => g.group),
      ...statusOf(r, names),
    }));
  }
}

export default new StudentAccessService();
