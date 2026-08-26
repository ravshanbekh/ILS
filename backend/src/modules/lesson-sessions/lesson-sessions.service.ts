import { LessonSessionStatus, HomeworkGrade } from '@prisma/client';
import prisma from '../../config/database';
import { ApiError } from '../../shared/middleware/errorHandler';
import logger from '../../shared/utils/logger';
import { isLessonDay } from '../../shared/utils/lessonSchedule';

const LESSON_WINDOW_MINUTES = 100; // 1 soat 40 daqiqa

const HOMEWORK_SCORE: Record<HomeworkGrade, number | null> = {
  toliq: 5,
  qisman: 3,
  bajarmagan: 0,
  kelmadi: null,
};

/** Serverning o'z vaqt zonasidan qat'i nazar, Toshkent taqvimidagi "bugun"ni UTC yarim tunda saqlash */
function tashkentDateOnly(d: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tashkent',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  return new Date(`${parts}T00:00:00.000Z`);
}

class LessonSessionsService {
  /**
   * O'qituvchi darsni boshlaydi — bugungi sessiyani yaratadi (yoki mavjudini qaytaradi).
   */
  async start(groupId: string, teacherId: string, isAdmin: boolean, topic?: string) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { groupStudents: { where: { student: { isActive: true } }, select: { studentId: true } } },
    });
    if (!group) throw ApiError.notFound('Guruh topilmadi');
    if (!isAdmin && group.teacherId !== teacherId) {
      throw ApiError.forbidden('Bu guruh sizga tegishli emas');
    }

    const today = tashkentDateOnly();

    const existing = await prisma.lessonSession.findUnique({
      where: { groupId_date: { groupId, date: today } },
    });

    if (existing) {
      if (existing.status === 'ochiq') return this.getById(existing.id);
      throw ApiError.badRequest(
        existing.status === 'yakunlandi'
          ? "Bugungi dars allaqachon yakunlangan"
          : "Bu dars vaqti tugab avtomatik yopilgan — baholash uchun rahbardan ruxsat so'rang"
      );
    }

    if (!isAdmin && !isLessonDay(group.lessonDayType, today)) {
      throw ApiError.badRequest(
        group.lessonDayType
          ? "Bugun bu guruhda dars kuni emas"
          : "Guruh uchun dars kuni (juft/toq) belgilanmagan — administratordan so'rang"
      );
    }

    const startedAt = new Date();
    const deadlineAt = new Date(startedAt.getTime() + LESSON_WINDOW_MINUTES * 60 * 1000);

    const session = await prisma.lessonSession.create({
      data: {
        groupId,
        teacherId: group.teacherId || teacherId,
        date: today,
        status: 'ochiq',
        topic,
        startedAt,
        deadlineAt,
        grades: {
          create: group.groupStudents.map((gs) => ({ studentId: gs.studentId })),
        },
      },
    });

    logger.info(`Dars sessiyasi boshlandi: guruh=${group.name}, deadline=${deadlineAt.toISOString()}`);
    return this.getById(session.id);
  }

  /**
   * Bugungi (yoki ochiq turgan) sessiyani ro'yxat bilan olish.
   */
  async getToday(groupId: string, teacherId: string, isAdmin: boolean) {
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw ApiError.notFound('Guruh topilmadi');
    if (!isAdmin && group.teacherId !== teacherId) {
      throw ApiError.forbidden('Bu guruh sizga tegishli emas');
    }

    const today = tashkentDateOnly();
    const session = await prisma.lessonSession.findUnique({
      where: { groupId_date: { groupId, date: today } },
    });

    return {
      isLessonDay: isLessonDay(group.lessonDayType, today),
      lessonDayType: group.lessonDayType,
      session: session ? await this.getById(session.id) : null,
    };
  }

  async getById(id: string) {
    const session = await prisma.lessonSession.findUnique({
      where: { id },
      include: {
        group: { select: { id: true, name: true, teacherId: true } },
        grades: {
          include: { student: { select: { id: true, fullName: true, avatarUrl: true } } },
        },
      },
    });
    if (!session) throw ApiError.notFound('Sessiya topilmadi');
    return session;
  }

  private assertOwnerAndOpen(session: { teacherId: string; status: LessonSessionStatus; deadlineAt: Date }, teacherId: string, isAdmin: boolean) {
    if (!isAdmin && session.teacherId !== teacherId) {
      throw ApiError.forbidden('Bu sessiya sizga tegishli emas');
    }
    if (session.status !== 'ochiq') {
      throw ApiError.badRequest(
        session.status === 'yakunlandi'
          ? 'Bu dars allaqachon yakunlangan'
          : "Baholash vaqti tugagan — rahbardan ruxsat so'rang"
      );
    }
    if (new Date() > session.deadlineAt) {
      throw ApiError.badRequest('Baholash vaqti (1 soat 40 daqiqa) tugadi');
    }
  }

  async gradeHomework(sessionId: string, teacherId: string, isAdmin: boolean, studentId: string, homework: HomeworkGrade, comment?: string) {
    const session = await prisma.lessonSession.findUnique({ where: { id: sessionId } });
    if (!session) throw ApiError.notFound('Sessiya topilmadi');
    this.assertOwnerAndOpen(session, teacherId, isAdmin);

    const grade = await prisma.lessonGrade.findUnique({
      where: { sessionId_studentId: { sessionId, studentId } },
    });
    if (!grade) throw ApiError.notFound("O'quvchi bu sessiyada topilmadi");

    await prisma.lessonGrade.update({
      where: { id: grade.id },
      data: {
        homework,
        homeworkScore: HOMEWORK_SCORE[homework],
        autoZero: false,
        comment: comment ?? grade.comment,
        gradedAt: new Date(),
      },
    });

    return this.getById(sessionId);
  }

  async gradeActivity(sessionId: string, teacherId: string, isAdmin: boolean, studentId: string, activityScore: number) {
    const session = await prisma.lessonSession.findUnique({ where: { id: sessionId } });
    if (!session) throw ApiError.notFound('Sessiya topilmadi');
    this.assertOwnerAndOpen(session, teacherId, isAdmin);

    const grade = await prisma.lessonGrade.findUnique({
      where: { sessionId_studentId: { sessionId, studentId } },
    });
    if (!grade) throw ApiError.notFound("O'quvchi bu sessiyada topilmadi");

    await prisma.lessonGrade.update({
      where: { id: grade.id },
      data: { activityScore, activityGradedAt: new Date() },
    });

    return this.getById(sessionId);
  }

  /**
   * O'qituvchi "Yakunlash" bosadi. Baholanmagan o'quvchilar (kelmadi belgilanmaganlar) 0 ball oladi.
   */
  async finalize(sessionId: string, teacherId: string, isAdmin: boolean) {
    const session = await prisma.lessonSession.findUnique({
      where: { id: sessionId },
      include: { grades: true },
    });
    if (!session) throw ApiError.notFound('Sessiya topilmadi');
    this.assertOwnerAndOpen(session, teacherId, isAdmin);

    const now = new Date();

    await prisma.$transaction([
      ...session.grades
        .filter((g) => g.homework === null)
        .map((g) =>
          prisma.lessonGrade.update({
            where: { id: g.id },
            data: { homework: 'bajarmagan', homeworkScore: 0, autoZero: true, gradedAt: now },
          })
        ),
      prisma.lessonSession.update({
        where: { id: sessionId },
        data: {
          status: 'yakunlandi',
          finalizedAt: now,
          parentNotifyAt: new Date(now.getTime() + 60 * 60 * 1000),
        },
      }),
    ]);

    logger.info(`Dars sessiyasi yakunlandi: ${sessionId}`);
    return this.getById(sessionId);
  }

  // ============ CRON: AVTO-YOPISH ============

  /** Vaqti tugagan, lekin yakunlanmagan sessiyalarni avtomatik yopadi (baholanmaganlar 0 oladi, ota-onaga xabar ketmaydi) */
  async closeExpiredSessions() {
    const expired = await prisma.lessonSession.findMany({
      where: { status: 'ochiq', deadlineAt: { lt: new Date() } },
      include: { grades: true, group: { select: { name: true } } },
    });

    for (const session of expired) {
      const now = new Date();
      await prisma.$transaction([
        ...session.grades
          .filter((g) => g.homework === null)
          .map((g) =>
            prisma.lessonGrade.update({
              where: { id: g.id },
              data: { homework: 'bajarmagan', homeworkScore: 0, autoZero: true, gradedAt: now },
            })
          ),
        prisma.lessonSession.update({
          where: { id: session.id },
          data: { status: 'avto_yopildi' },
        }),
      ]);
      logger.warn(`Dars sessiyasi vaqt tugagani uchun avtomatik yopildi: guruh=${session.group.name}`);
    }

    return expired.length;
  }

  // ============ ADMIN: RUXSAT BERISH ============

  /**
   * Ravshan (admin) o'tkazib yuborilgan yoki avto-yopilgan kunni qayta ochadi.
   */
  async adminUnlock(groupId: string, adminId: string, note: string, date?: Date) {
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw ApiError.notFound('Guruh topilmadi');
    if (!group.teacherId) throw ApiError.badRequest("Guruhga o'qituvchi biriktirilmagan");

    const targetDate = date ? tashkentDateOnly(date) : tashkentDateOnly();
    const now = new Date();
    const deadlineAt = new Date(now.getTime() + LESSON_WINDOW_MINUTES * 60 * 1000);

    const existing = await prisma.lessonSession.findUnique({
      where: { groupId_date: { groupId, date: targetDate } },
    });

    if (!existing) {
      const students = await prisma.groupStudent.findMany({
        where: { groupId, student: { isActive: true } },
        select: { studentId: true },
      });
      const session = await prisma.lessonSession.create({
        data: {
          groupId,
          teacherId: group.teacherId,
          date: targetDate,
          status: 'ochiq',
          startedAt: now,
          deadlineAt,
          unlockedById: adminId,
          unlockedAt: now,
          unlockNote: note,
          grades: { create: students.map((s) => ({ studentId: s.studentId })) },
        },
      });
      return this.getById(session.id);
    }

    if (existing.status === 'yakunlandi') {
      throw ApiError.badRequest('Bu dars allaqachon yakunlangan, qayta ochish shart emas');
    }

    // avto_yopildi -> qayta ochish, avtomatik 0 baholarni tozalash
    await prisma.$transaction([
      prisma.lessonGrade.updateMany({
        where: { sessionId: existing.id, autoZero: true },
        data: { homework: null, homeworkScore: null, autoZero: false, gradedAt: null },
      }),
      prisma.lessonSession.update({
        where: { id: existing.id },
        data: {
          status: 'ochiq',
          deadlineAt,
          unlockedById: adminId,
          unlockedAt: now,
          unlockNote: note,
        },
      }),
    ]);

    return this.getById(existing.id);
  }

  // ============ ADMIN: KUNLIK NAZORAT HISOBOTI ============

  /** Bugun dars kuni bo'lgan, lekin ochilmagan yoki yakunlanmagan guruhlar (o'qituvchi kesimida) */
  async getUngradedGroupsToday() {
    const today = tashkentDateOnly();

    const groups = await prisma.group.findMany({
      where: { isActive: true, teacherId: { not: null } },
      include: {
        teacher: { select: { id: true, fullName: true } },
        lessonSessions: { where: { date: today } },
      },
    });

    const notConfigured: Array<{ groupId: string; groupName: string }> = [];
    const notOpened: Array<{ groupId: string; groupName: string; teacherId: string; teacherName: string }> = [];
    const notFinalized: Array<{ groupId: string; groupName: string; teacherId: string; teacherName: string }> = [];

    for (const g of groups) {
      if (!g.lessonDayType) {
        notConfigured.push({ groupId: g.id, groupName: g.name });
        continue;
      }
      if (!isLessonDay(g.lessonDayType, today)) continue;

      const session = g.lessonSessions[0];
      if (!session) {
        notOpened.push({ groupId: g.id, groupName: g.name, teacherId: g.teacherId!, teacherName: g.teacher!.fullName });
      } else if (session.status === 'avto_yopildi') {
        notFinalized.push({ groupId: g.id, groupName: g.name, teacherId: g.teacherId!, teacherName: g.teacher!.fullName });
      }
    }

    return { date: today, notOpened, notFinalized, notConfigured };
  }

  // ============ OTA-ONA XABARI VA GURUH XULOSASI UCHUN MA'LUMOT ============

  /** finalizedAt + 1 soatdan keyin ota-onaga xabar yuborish uchun tayyor sessiyalar */
  async getSessionsDueForParentNotify() {
    return prisma.lessonSession.findMany({
      where: {
        status: 'yakunlandi',
        parentNotifyAt: { lte: new Date() },
        parentNotifiedAt: null,
      },
      include: {
        group: { select: { id: true, name: true } },
        grades: { include: { student: { select: { id: true, fullName: true } } } },
      },
    });
  }

  async markParentNotified(sessionId: string) {
    await prisma.lessonSession.update({
      where: { id: sessionId },
      data: { parentNotifiedAt: new Date() },
    });
  }

  /** O'quvchining oxirgi 7 kunlik uy vazifasi o'rtacha bali (kelmadi va autoZero hisobga kirmaydi bo'lsa ham, autoZero=0 ball sifatida hisobga olinadi — bu intizom belgisi) */
  async getStudentWeeklyHomeworkAvg(studentId: string): Promise<number | null> {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const grades = await prisma.lessonGrade.findMany({
      where: {
        studentId,
        homeworkScore: { not: null },
        session: { date: { gte: tashkentDateOnly(weekAgo) }, status: { in: ['yakunlandi', 'avto_yopildi'] } },
      },
      select: { homeworkScore: true },
    });
    if (grades.length === 0) return null;
    const sum = grades.reduce((s, g) => s + (g.homeworkScore || 0), 0);
    return sum / grades.length;
  }

  /** Bugun yakunlangan va Telegram chati ulangan guruhlar — 20:00 xulosa yuborish uchun */
  async getFinalizedSessionsTodayWithChat() {
    const today = tashkentDateOnly();
    return prisma.lessonSession.findMany({
      where: { date: today, status: 'yakunlandi', group: { telegramChatId: { not: null } } },
      include: { group: { select: { id: true, name: true, telegramChatId: true } } },
    });
  }

  /** Guruh chatiga yuboriladigan kuniga bir martalik ismsiz xulosa (faqat yakunlangan sessiyalar uchun) */
  async getGroupDailySummary(sessionId: string) {
    const session = await prisma.lessonSession.findUnique({
      where: { id: sessionId },
      include: { grades: true },
    });
    if (!session) return null;

    const graded = session.grades.filter((g) => g.homework && g.homework !== 'kelmadi');
    const full = graded.filter((g) => g.homework === 'toliq').length;
    const partial = graded.filter((g) => g.homework === 'qisman').length;
    const none = graded.filter((g) => g.homework === 'bajarmagan').length;

    const activityScores = session.grades.map((g) => g.activityScore).filter((s): s is number => s !== null);
    const avgActivity = activityScores.length > 0 ? activityScores.reduce((a, b) => a + b, 0) / activityScores.length : null;

    return { total: graded.length, full, partial, none, avgActivity };
  }

  // ============ OTA-ONA BOTI: BUGUN / HAFTA / OY ============

  /** Bugun yakunlangan darsdagi o'quvchi bahosi (bot "📅 Bugun" tugmasi uchun) */
  async getStudentTodayGrade(studentId: string) {
    const today = tashkentDateOnly();
    return prisma.lessonGrade.findFirst({
      where: { studentId, session: { date: today, status: 'yakunlandi' } },
      include: { session: { select: { date: true, group: { select: { name: true } } } } },
    });
  }

  /** So'nggi N kunlik dars baholari xulosasi (bot "🗓 Hafta" / "📆 Oy" tugmalari uchun) */
  async getStudentLessonSummary(studentId: string, days: number) {
    const since = tashkentDateOnly(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
    const grades = await prisma.lessonGrade.findMany({
      where: {
        studentId,
        session: { date: { gte: since }, status: { in: ['yakunlandi', 'avto_yopildi'] } },
      },
    });

    const withHomework = grades.filter((g) => g.homeworkScore !== null);
    const avgHomework = withHomework.length
      ? withHomework.reduce((s, g) => s + (g.homeworkScore || 0), 0) / withHomework.length
      : null;

    const withActivity = grades.filter((g) => g.activityScore !== null);
    const avgActivity = withActivity.length
      ? withActivity.reduce((s, g) => s + (g.activityScore || 0), 0) / withActivity.length
      : null;

    return {
      totalSessions: grades.length,
      avgHomework,
      avgActivity,
      full: grades.filter((g) => g.homework === 'toliq').length,
      partial: grades.filter((g) => g.homework === 'qisman').length,
      none: grades.filter((g) => g.homework === 'bajarmagan').length,
      absent: grades.filter((g) => g.homework === 'kelmadi').length,
    };
  }
}

export default new LessonSessionsService();
