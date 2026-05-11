import prisma from '../../config/database';
import { ApiError } from '../../shared/middleware/errorHandler';

class BackupService {
  /**
   * Barcha ma'lumotlarni JSON shaklida yuklab olish (Faqat admin uchun)
   */
  async createBackup() {
    // Fetch everything
    const users = await prisma.user.findMany();
    const groups = await prisma.group.findMany();
    const normatives = await prisma.normative.findMany();
    const groupStudents = await prisma.groupStudent.findMany();
    const groupNormatives = await prisma.groupNormative.findMany();
    const submissions = await prisma.submission.findMany();
    const rankingCache = await prisma.rankingCache.findMany();
    const notifications = await prisma.notification.findMany();

    return {
      version: '1.1',
      timestamp: new Date().toISOString(),
      data: {
        users,
        groups,
        normatives,
        groupStudents,
        groupNormatives,
        submissions,
        rankingCache,
        notifications,
      }
    };
  }

  /**
   * JSON backup fayldan ma'lumotlarni tiklash (Xavfli operatsiya, faqat admin)
   */
  async restoreBackup(backupData: any) {
    if (!backupData || !backupData.data) {
      throw ApiError.badRequest("Noto'g'ri zaxira fayli formati");
    }

    const { 
      users, groups, normatives, groupStudents, 
      groupNormatives, submissions, rankingCache, notifications 
    } = backupData.data;

    // Everything inside a massive transaction
    await prisma.$transaction(async (tx) => {
      // 1. Delete existing data in reverse dependency order
      await tx.notification.deleteMany();
      await tx.rankingCache.deleteMany();
      await tx.submission.deleteMany();
      await tx.groupNormative.deleteMany();
      await tx.groupStudent.deleteMany();
      await tx.normative.deleteMany();
      await tx.group.deleteMany();
      
      // Keep admin user, delete others? Actually, let's delete all EXCEPT the current admin doing the restore to prevent getting locked out.
      // But backup contains all users including the admin. The safest is to deleteMany on users but bypass foreign key checks or just delete everything.
      // Since it's PostgreSQL, deleting users will fail if we don't cascade, but we already deleted child records.
      await tx.user.deleteMany();

      // 2. Insert Data
      if (users && users.length > 0) {
        await tx.user.createMany({ data: users });
      }
      if (groups && groups.length > 0) {
        await tx.group.createMany({ data: groups });
      }
      if (normatives && normatives.length > 0) {
        await tx.normative.createMany({ data: normatives });
      }
      if (groupStudents && groupStudents.length > 0) {
        await tx.groupStudent.createMany({ data: groupStudents });
      }
      if (groupNormatives && groupNormatives.length > 0) {
        await tx.groupNormative.createMany({ data: groupNormatives });
      }
      if (submissions && submissions.length > 0) {
        await tx.submission.createMany({ data: submissions });
      }
      if (rankingCache && rankingCache.length > 0) {
        await tx.rankingCache.createMany({ data: rankingCache });
      }
      if (notifications && notifications.length > 0) {
        await tx.notification.createMany({ data: notifications });
      }
    }, {
      timeout: 30000, // 30s timeout for large data
    });

    return { message: "Barcha ma'lumotlar muvaffaqiyatli tiklandi!" };
  }
}

export default new BackupService();
