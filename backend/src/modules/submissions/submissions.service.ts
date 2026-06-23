import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { ApiError } from '../../shared/middleware/errorHandler';
import { CreateSubmissionInput, CheckSubmissionInput } from './submissions.validation';
import { calculateScore } from '../../shared/utils/scoreCalculator';
import { PaginationParams, createPaginatedResult } from '../../shared/utils/pagination';
import logger from '../../shared/utils/logger';
import { emitToUser } from '../../shared/utils/socket';
import { notifyParentsOnCheck } from '../bot/bot.notifications';

class SubmissionsService {
  /**
   * Barcha tekshirilmagan topshiriqlar (teacher uchun)
   */
  async getPending(params: PaginationParams, filters?: { groupId?: string; teacherId?: string }) {
    const where: Prisma.SubmissionWhereInput = { status: 'pending' };

    if (filters?.groupId) {
      where.groupId = filters.groupId;
    }

    // O'qituvchi faqat o'z guruhlaridagi submissionlarni ko'radi
    if (filters?.teacherId) {
      where.group = {
        teacherId: filters.teacherId,
      };
    }

    const [submissions, total] = await Promise.all([
      prisma.submission.findMany({
        where,
        include: {
          student: {
            select: { id: true, fullName: true, login: true, avatarUrl: true },
          },
          normative: {
            select: { id: true, taskNumber: true, title: true, maxScore: true, timeLimit: true },
          },
          group: {
            select: { id: true, name: true },
          },
        },
        orderBy: { submittedAt: 'asc' }, // Eng eski birinchi
        skip: params.skip,
        take: params.limit,
      }),
      prisma.submission.count({ where }),
    ]);

    return createPaginatedResult(submissions, total, params);
  }

  /**
   * Barcha topshiriqlar (admin uchun)
   */
  async getAll(params: PaginationParams) {
    const [submissions, total] = await Promise.all([
      prisma.submission.findMany({
        include: {
          student: {
            select: { id: true, fullName: true, login: true, avatarUrl: true },
          },
          normative: {
            select: { id: true, taskNumber: true, title: true, maxScore: true },
          },
          group: {
            select: { id: true, name: true },
          },
          checkedBy: {
            select: { id: true, fullName: true },
          },
        },
        orderBy: { submittedAt: 'desc' },
        skip: params.skip,
        take: params.limit,
      }),
      prisma.submission.count(),
    ]);

    return createPaginatedResult(submissions, total, params);
  }

  /**
   * O'quvchining barcha topshiriqlari
   */
  async getByStudent(studentId: string, params: PaginationParams) {
    const where = { studentId };

    const [submissions, total] = await Promise.all([
      prisma.submission.findMany({
        where,
        include: {
          normative: {
            select: { id: true, taskNumber: true, title: true, maxScore: true },
          },
          group: {
            select: { id: true, name: true },
          },
          checkedBy: {
            select: { id: true, fullName: true },
          },
        },
        orderBy: { submittedAt: 'desc' },
        skip: params.skip,
        take: params.limit,
      }),
      prisma.submission.count({ where }),
    ]);

    return createPaginatedResult(submissions, total, params);
  }

  /**
   * Bitta submission olish
   */
  async getById(id: string) {
    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        student: {
          select: { id: true, fullName: true, login: true, avatarUrl: true },
        },
        normative: true,
        group: {
          select: { id: true, name: true },
        },
        checkedBy: {
          select: { id: true, fullName: true },
        },
      },
    });

    if (!submission) {
      throw ApiError.notFound('Topshiriq topilmadi');
    }

    return submission;
  }

  /**
   * O'quvchi topshiriq topshiradi (YouTube link)
   */
  async create(studentId: string, data: CreateSubmissionInput) {
    let groupId = data.groupId || null;

    // Agar groupId berilmagan bo'lsa, o'quvchining birinchi guruhini topib olamiz
    if (!groupId) {
      const firstGroup = await prisma.groupStudent.findFirst({
        where: { studentId },
        select: { groupId: true },
      });
      if (firstGroup) {
        groupId = firstGroup.groupId;
      }
    }

    // Agar groupId bor bo'lsa — guruh a'zoligi va normativ biriktirilganligini tekshiramiz
    if (groupId) {
      const groupStudent = await prisma.groupStudent.findUnique({
        where: {
          groupId_studentId: {
            groupId,
            studentId,
          },
        },
      });

      if (!groupStudent) {
        throw ApiError.forbidden('Siz bu guruhning a\'zosi emassiz');
      }
    }

    // Allaqachon topshirilganligini tekshirish
    const existing = await prisma.submission.findFirst({
      where: {
        studentId,
        normativeId: data.normativeId,
        ...(groupId ? { groupId } : {}),
      },
    });

    if (existing) {
      if (existing.result === 'green') {
        throw ApiError.conflict('Bu normativdan maksimal ball (Yashil) olgansiz, qayta topshira olmaysiz.');
      } else if (existing.status === 'pending') {
        throw ApiError.conflict('Sizning topshirig\'ingiz hozirda tekshirilmoqda.');
      }
      
      if (!existing.canResubmit) {
        throw ApiError.conflict("Qayta topshirish uchun ruxsat yo'q. O'qituvchingizga murojaat qiling.");
      }

      // Agar qizil yoki ko'k bo'lsa va ruxsat bo'lsa, uni qayta topshirish sifatida update qilamiz
      const updatedSubmission = await prisma.submission.update({
        where: { id: existing.id },
        data: {
          youtubeUrl: data.youtubeUrl,
          status: 'pending',
          result: null,
          score: 0,
          comment: null,
          canResubmit: false,
          submittedAt: new Date(),
          checkedById: null,
          checkedAt: null,
        },
        include: {
          normative: { select: { taskNumber: true, title: true } },
          group: { select: { name: true, teacherId: true } },
        },
      });

      if (updatedSubmission.group?.teacherId) {
        const student = await prisma.user.findUnique({
          where: { id: studentId },
          select: { fullName: true },
        });

        const notif = await prisma.notification.create({
          data: {
            userId: updatedSubmission.group.teacherId,
            type: 'submission_resubmit',
            title: 'Qayta topshiriq keldi',
            body: `${student?.fullName} normativni qayta topshirdi: #${updatedSubmission.normative.taskNumber}: ${updatedSubmission.normative.title}`,
          },
        });
        emitToUser(updatedSubmission.group.teacherId, 'new_notification', notif);
      }

      logger.info(`Submission resubmitted: student=${studentId}, normative=#${updatedSubmission.normative.taskNumber}`);
      return updatedSubmission;
    }

    const submission = await prisma.submission.create({
      data: {
        studentId,
        normativeId: data.normativeId,
        groupId: groupId,
        youtubeUrl: data.youtubeUrl,
      },
      include: {
        normative: {
          select: { taskNumber: true, title: true },
        },
        group: {
          select: { name: true, teacherId: true },
        },
      },
    });

    // O'qituvchiga xabarnoma
    if (submission.group?.teacherId) {
      const student = await prisma.user.findUnique({
        where: { id: studentId },
        select: { fullName: true },
      });

      const notif = await prisma.notification.create({
        data: {
          userId: submission.group.teacherId,
          type: 'submission_new',
          title: 'Yangi topshiriq',
          body: `${student?.fullName} — #${submission.normative.taskNumber}: ${submission.normative.title}`,
        },
      });
      emitToUser(submission.group.teacherId, 'new_notification', notif);
    }

    logger.info(`Submission created: student=${studentId}, normative=#${submission.normative.taskNumber}`);
    return submission;
  }

  /**
   * O'qituvchi topshiriqni baholaydi (green/blue/red)
   */
  async check(submissionId: string, teacherId: string, data: CheckSubmissionInput) {
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        normative: { select: { maxScore: true, taskNumber: true, title: true } },
        group: { select: { teacherId: true } },
      },
    });

    if (!submission) {
      throw ApiError.notFound('Topshiriq topilmadi');
    }

    // Faqat pending yoki checked bo'lgan submissionlarni baholay oladi
    // (o'qituvchi adashib noto'g'ri ball qo'ysa qayta o'zgartira olsin)

    // Ball hisoblash
    const score = calculateScore(data.result, submission.normative.maxScore);

    const updated = await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: 'checked',
        result: data.result,
        score,
        comment: data.comment,
        checkedById: teacherId,
        checkedAt: new Date(),
      },
      include: {
        student: { select: { id: true, fullName: true } },
        normative: { select: { taskNumber: true, title: true, maxScore: true } },
        group: { select: { name: true } },
      },
    });

    // O'quvchiga xabarnoma
    const notif = await prisma.notification.create({
      data: {
        userId: submission.studentId,
        type: 'submission_checked',
        title: 'Topshiriq tekshirildi',
        body: `#${submission.normative.taskNumber}: ${submission.normative.title} — ${data.result === 'green' ? '✅ Yashil' : data.result === 'blue' ? '☑️ Ko\'k' : '❌ Qizil'} (${score} ball)`,
      },
    });
    emitToUser(submission.studentId, 'new_notification', notif);

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: teacherId,
        action: 'CHECK_SUBMISSION',
        targetType: 'submission',
        targetId: submissionId,
        details: { result: data.result, score, studentId: submission.studentId },
      },
    });

    logger.info(`Submission checked: ${submissionId} => ${data.result} (${score} ball)`);

    // Telegram orqali ota-onalarga xabar yuborish (async, xato bo'lsa ham ishlaydi)
    notifyParentsOnCheck(submission.studentId, {
      normative: updated.normative,
      result: updated.result,
      score: updated.score,
      comment: updated.comment,
    }).catch((err) => logger.warn('Telegram notify error:', err));

    return updated;
  }

  /**
   * O'qituvchi o'quvchiga qayta topshirish uchun ruxsat beradi
   */
  async allowResubmit(submissionId: string, teacherId: string) {
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { group: { select: { teacherId: true } } },
    });

    if (!submission) {
      throw ApiError.notFound('Topshiriq topilmadi');
    }

    if (submission.status === 'pending') {
      throw ApiError.conflict('Bu topshiriq hozir tekshirilmoqda, qayta topshirishga ochib berish shart emas');
    }

    if (submission.result === 'green') {
      throw ApiError.conflict('Maksimal ball (Yashil) olgan topshiriqni qayta topshirishga ochib bo\'lmaydi');
    }

    const updated = await prisma.submission.update({
      where: { id: submissionId },
      data: {
        canResubmit: true,
      },
      include: {
        normative: { select: { taskNumber: true, title: true } }
      }
    });

    // O'quvchiga xabarnoma yuborish
    const notif = await prisma.notification.create({
      data: {
        userId: submission.studentId,
        type: 'submission_allow_resubmit',
        title: 'Qayta topshirishga ruxsat berildi',
        body: `O'qituvchi #${updated.normative.taskNumber}: ${updated.normative.title} normativini qayta topshirishingizga ruxsat berdi.`,
      },
    });
    emitToUser(submission.studentId, 'new_notification', notif);

    logger.info(`Submission ${submissionId} opened for resubmission by teacher ${teacherId}`);
    return updated;
  }
}

export default new SubmissionsService();
