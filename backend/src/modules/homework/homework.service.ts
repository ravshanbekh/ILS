import prisma from '../../config/database';
import { ApiError } from '../../shared/middleware/errorHandler';
import { getTeacherVisibility, rootFolderOf } from '../../shared/utils/lessonAccess';

/**
 * Uyga vazifa tizimi.
 *
 * Uch qatlam:
 *   1. BANK  — admin darslik materialiga vazifa biriktiradi (Homework)
 *   2. BERISH — o'qituvchi darsni o'tgach guruhiga bittasini beradi (HomeworkAssignment)
 *   3. BAHOLASH — keyingi darsda baho aynan o'sha vazifaga bog'lanadi (LessonGrade.assignmentId)
 *
 * Asosiy qoida: N-darsda baholanayotgan vazifa N-1 darsda berilgan bo'ladi.
 */
class HomeworkService {
  // ============ DARS RAQAMI ============

  /**
   * Guruhning nechanchi darsi ekanini hisoblaydi.
   *
   * Bazada dars raqami saqlanmaydi (LessonSession da faqat sana bor), shuning
   * uchun "shu sanagacha bo'lgan sessiyalar soni" sifatida hisoblaymiz.
   * Dars o'tkazib yuborilsa raqam siljiydi — bu kutilgan xatti-harakat,
   * chunki raqam "nechanchi o'tilgan dars" degani.
   */
  private async lessonNumber(groupId: string, date: Date): Promise<number> {
    return prisma.lessonSession.count({
      where: { groupId, date: { lte: date } },
    });
  }

  /** Bir nechta sessiya uchun raqamni bitta so'rovda hisoblaydi */
  private async lessonNumbers(groupId: string, dates: Date[]): Promise<Map<string, number>> {
    if (dates.length === 0) return new Map();
    const all = await prisma.lessonSession.findMany({
      where: { groupId },
      select: { date: true },
      orderBy: { date: 'asc' },
    });
    const sorted = all.map((s) => s.date.getTime()).sort((a, b) => a - b);
    const map = new Map<string, number>();
    for (const d of dates) {
      const n = sorted.filter((t) => t <= d.getTime()).length;
      map.set(d.toISOString(), n);
    }
    return map;
  }

  // ============ 1. BANK (admin) ============

  /** Bitta darslik materialiga tegishli vazifalar */
  async listByLessonItem(lessonItemId: string, includeInactive = false) {
    return prisma.homework.findMany({
      where: { lessonItemId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      include: {
        lessonItem: { select: { id: true, title: true, folder: { select: { id: true, name: true } } } },
        _count: { select: { assignments: true } },
      },
    });
  }

  /** Papka bo'yicha — admin boshqaruv sahifasi uchun */
  async listByFolder(folderId: string) {
    return prisma.homework.findMany({
      where: { lessonItem: { folderId } },
      orderBy: [{ lessonItem: { order: 'asc' } }, { order: 'asc' }],
      include: {
        lessonItem: { select: { id: true, title: true } },
        _count: { select: { assignments: true } },
      },
    });
  }

  async create(data: {
    lessonItemId: string;
    title: string;
    description?: string | null;
    contentType: string;
    content: string;
    order?: number;
  }, createdById: string) {
    const item = await prisma.lessonItem.findUnique({ where: { id: data.lessonItemId } });
    if (!item) throw ApiError.notFound('Darslik materiali topilmadi');

    if (data.contentType !== 'link' && data.contentType !== 'text') {
      throw ApiError.badRequest("Vazifa turi 'link' yoki 'text' bo'lishi kerak");
    }
    if (!data.content?.trim()) throw ApiError.badRequest("Vazifa mazmuni bo'sh bo'lmasligi kerak");
    if (!data.title?.trim()) throw ApiError.badRequest("Sarlavha bo'sh bo'lmasligi kerak");

    return prisma.homework.create({
      data: {
        lessonItemId: data.lessonItemId,
        title: data.title.trim(),
        description: data.description?.trim() || null,
        contentType: data.contentType,
        content: data.content.trim(),
        order: data.order ?? 0,
        createdById,
      },
    });
  }

  async update(id: string, data: Partial<{
    title: string;
    description: string | null;
    contentType: string;
    content: string;
    order: number;
    isActive: boolean;
  }>) {
    const existing = await prisma.homework.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('Vazifa topilmadi');

    if (data.contentType && data.contentType !== 'link' && data.contentType !== 'text') {
      throw ApiError.badRequest("Vazifa turi 'link' yoki 'text' bo'lishi kerak");
    }

    return prisma.homework.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        ...(data.contentType !== undefined ? { contentType: data.contentType } : {}),
        ...(data.content !== undefined ? { content: data.content.trim() } : {}),
        ...(data.order !== undefined ? { order: data.order } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  /**
   * O'chirish. Agar vazifa allaqachon biror guruhga berilgan bo'lsa — o'chirmaymiz,
   * yashiramiz: aks holda o'quvchining tarixidagi yozuv va unga qo'yilgan baho
   * "nimaga qo'yilgani" noma'lum bo'lib qolardi.
   */
  async remove(id: string) {
    const hw = await prisma.homework.findUnique({
      where: { id },
      include: { _count: { select: { assignments: true } } },
    });
    if (!hw) throw ApiError.notFound('Vazifa topilmadi');

    if (hw._count.assignments > 0) {
      await prisma.homework.update({ where: { id }, data: { isActive: false } });
      return { deleted: false, hidden: true };
    }

    await prisma.homework.delete({ where: { id } });
    return { deleted: true, hidden: false };
  }

  // ============ 2. BERISH (o'qituvchi) ============

  private async loadSessionForTeacher(sessionId: string, user: { userId: string; role: string }) {
    const session = await prisma.lessonSession.findUnique({
      where: { id: sessionId },
      include: {
        group: { select: { id: true, name: true, teacherId: true } },
        assignment: {
          include: {
            homework: { include: { lessonItem: { select: { id: true, title: true } } } },
          },
        },
      },
    });
    if (!session) throw ApiError.notFound('Dars sessiyasi topilmadi');
    if (user.role !== 'admin' && session.teacherId !== user.userId) {
      throw ApiError.forbidden('Bu dars sizga tegishli emas');
    }
    return session;
  }

  /**
   * O'qituvchi shu darsda nima bera oladi va nima allaqachon bergan.
   * Tanlash uchun barcha faol vazifalar darsliklar bo'yicha guruhlangan holda.
   */
  async getAssignOptions(sessionId: string, user: { userId: string; role: string }) {
    const session = await this.loadSessionForTeacher(sessionId, user);

    // O'qituvchiga FAQAT dostup berilgan kurslarning vazifalari ko'rinadi.
    // Aks holda 3 ta kursning 200+ vazifasi bitta ro'yxatda chiqib, kerakligini
    // topib bo'lmasdi. Admin — hammasini ko'radi.
    const { inherited, parentMap } = await getTeacherVisibility(user.userId);
    const isAdmin = user.role === 'admin';

    const homeworks = await prisma.homework.findMany({
      where: {
        isActive: true,
        ...(isAdmin ? {} : { lessonItem: { folderId: { in: [...inherited] } } }),
      },
      orderBy: [{ lessonItem: { order: 'asc' } }, { order: 'asc' }],
      include: {
        lessonItem: {
          select: { id: true, title: true, order: true, folder: { select: { id: true, name: true } } },
        },
      },
    });

    // Barcha papkalar — kurs (eng yuqoridagi ajdod) nomini topish uchun
    const folders = await prisma.lessonFolder.findMany({ select: { id: true, name: true, parentId: true } });
    const folderNames = new Map(folders.map((f) => [f.id, f.name]));
    const fullParentMap = new Map(folders.map((f) => [f.id, f.parentId]));
    // Admin uchun parentMap alohida kelmaydi — to'liq ro'yxatdan yasaymiz
    const pm = isAdmin ? fullParentMap : parentMap;

    // Kurs -> darslik -> vazifalar
    interface LessonNode { itemId: string; itemTitle: string; folderName: string; items: any[] }
    interface CourseNode { id: string; name: string; lessons: LessonNode[]; count: number }
    const courses = new Map<string, CourseNode>();

    for (const hw of homeworks) {
      const folderId = hw.lessonItem.folder?.id;
      if (!folderId) continue;
      const rootId = rootFolderOf(folderId, pm);
      const courseName = folderNames.get(rootId) ?? '—';

      let course = courses.get(rootId);
      if (!course) {
        course = { id: rootId, name: courseName, lessons: [], count: 0 };
        courses.set(rootId, course);
      }

      let lesson = course.lessons.find((l) => l.itemId === hw.lessonItem.id);
      if (!lesson) {
        lesson = {
          itemId: hw.lessonItem.id,
          itemTitle: hw.lessonItem.title,
          folderName: hw.lessonItem.folder?.name ?? '—',
          items: [],
        };
        course.lessons.push(lesson);
      }

      lesson.items.push({
        id: hw.id,
        title: hw.title,
        description: hw.description,
        contentType: hw.contentType,
        content: hw.content,
      });
      course.count++;
    }

    const courseList = [...courses.values()].sort((a, b) => a.name.localeCompare(b.name));

    const lessonNo = await this.lessonNumber(session.groupId, session.date);

    return {
      sessionId: session.id,
      groupName: session.group.name,
      lessonNumber: lessonNo,
      topic: session.topic,
      date: session.date.toISOString().slice(0, 10),
      current: session.assignment
        ? {
            assignmentId: session.assignment.id,
            homeworkId: session.assignment.homeworkId,
            title: session.assignment.homework.title,
            lessonItemTitle: session.assignment.homework.lessonItem.title,
            note: session.assignment.note,
          }
        : null,
      /** Kurslar bo'yicha kategoriyalangan — faqat dostup berilganlari */
      courses: courseList,
      /** Eski tekis ro'yxat (moslik uchun) */
      lessons: courseList.flatMap((c) => c.lessons),
    };
  }

  /** Guruhga vazifa berish (bitta darsga bitta vazifa — qayta berilsa almashadi) */
  async assign(
    sessionId: string,
    homeworkId: string,
    note: string | null,
    user: { userId: string; role: string }
  ) {
    const session = await this.loadSessionForTeacher(sessionId, user);

    const hw = await prisma.homework.findUnique({ where: { id: homeworkId } });
    if (!hw) throw ApiError.notFound('Vazifa topilmadi');
    if (!hw.isActive) throw ApiError.badRequest('Bu vazifa yashirilgan');

    const assignment = await prisma.homeworkAssignment.upsert({
      where: { assignedInSessionId: sessionId },
      create: {
        homeworkId,
        groupId: session.groupId,
        assignedInSessionId: sessionId,
        assignedById: user.userId,
        note: note?.trim() || null,
      },
      update: {
        homeworkId,
        note: note?.trim() || null,
        assignedById: user.userId,
        assignedAt: new Date(),
      },
      include: { homework: { include: { lessonItem: { select: { title: true } } } } },
    });

    return {
      assignmentId: assignment.id,
      title: assignment.homework.title,
      lessonItemTitle: assignment.homework.lessonItem.title,
      note: assignment.note,
    };
  }

  /** Berilgan vazifani olib tashlash */
  async unassign(sessionId: string, user: { userId: string; role: string }) {
    await this.loadSessionForTeacher(sessionId, user);
    await prisma.homeworkAssignment.deleteMany({ where: { assignedInSessionId: sessionId } });
    return { success: true };
  }

  // ============ 3. BAHOLASH ============

  /**
   * Shu darsda QAYSI vazifa baholanayotganini topadi.
   * Bu — guruhning oldingi darsida berilgan vazifa.
   */
  async getAssignmentToGrade(session: { id: string; groupId: string; date: Date }) {
    const previous = await prisma.lessonSession.findFirst({
      where: { groupId: session.groupId, date: { lt: session.date } },
      orderBy: { date: 'desc' },
      select: { id: true, date: true, topic: true },
    });
    if (!previous) return null;

    const assignment = await prisma.homeworkAssignment.findUnique({
      where: { assignedInSessionId: previous.id },
      include: {
        homework: { include: { lessonItem: { select: { title: true } } } },
      },
    });
    if (!assignment) return null;

    const lessonNo = await this.lessonNumber(session.groupId, previous.date);

    return {
      assignmentId: assignment.id,
      homeworkId: assignment.homeworkId,
      title: assignment.homework.title,
      description: assignment.homework.description,
      contentType: assignment.homework.contentType,
      content: assignment.homework.content,
      lessonItemTitle: assignment.homework.lessonItem.title,
      note: assignment.note,
      assignedLessonNumber: lessonNo,
      assignedTopic: previous.topic,
      assignedDate: previous.date.toISOString().slice(0, 10),
    };
  }

  /** Baholash ekrani uchun — sessiya id si bo'yicha */
  async getToGradeBySession(sessionId: string, user: { userId: string; role: string }) {
    const session = await prisma.lessonSession.findUnique({
      where: { id: sessionId },
      select: { id: true, groupId: true, date: true, teacherId: true },
    });
    if (!session) throw ApiError.notFound('Dars sessiyasi topilmadi');
    if (user.role !== 'admin' && session.teacherId !== user.userId) {
      throw ApiError.forbidden('Bu dars sizga tegishli emas');
    }
    return this.getAssignmentToGrade(session);
  }

  // ============ 4. O'QUVCHI KO'RINISHI ============

  /**
   * O'quvchining uyga vazifalari: joriy (hali baholanmagan) va tarix.
   * Har bir yozuv — qaysi darsda berilgani, mavzusi va bahosi bilan.
   */
  async getStudentHomework(studentId: string, limit = 50) {
    const links = await prisma.groupStudent.findMany({
      where: { studentId },
      select: { groupId: true },
    });
    const groupIds = links.map((l) => l.groupId);
    if (groupIds.length === 0) return { current: null, history: [] };

    const assignments = await prisma.homeworkAssignment.findMany({
      where: { groupId: { in: groupIds } },
      orderBy: { assignedAt: 'desc' },
      take: limit,
      include: {
        homework: { include: { lessonItem: { select: { title: true } } } },
        session: { select: { id: true, date: true, topic: true, groupId: true } },
        group: { select: { id: true, name: true } },
        grades: {
          where: { studentId },
          select: { homework: true, homeworkScore: true, comment: true, gradedAt: true },
        },
      },
    });

    if (assignments.length === 0) return { current: null, history: [] };

    // Dars raqamlarini guruh bo'yicha hisoblaymiz
    const byGroup = new Map<string, Date[]>();
    for (const a of assignments) {
      const list = byGroup.get(a.groupId) || [];
      list.push(a.session.date);
      byGroup.set(a.groupId, list);
    }
    const numberMaps = new Map<string, Map<string, number>>();
    for (const [gid, dates] of byGroup) {
      numberMaps.set(gid, await this.lessonNumbers(gid, dates));
    }

    const rows = assignments.map((a) => {
      const grade = a.grades[0];
      return {
        assignmentId: a.id,
        title: a.homework.title,
        description: a.homework.description,
        contentType: a.homework.contentType,
        content: a.homework.content,
        lessonItemTitle: a.homework.lessonItem.title,
        note: a.note,
        groupName: a.group.name,
        lessonNumber: numberMaps.get(a.groupId)?.get(a.session.date.toISOString()) ?? null,
        topic: a.session.topic,
        assignedDate: a.session.date.toISOString().slice(0, 10),
        // Baho — keyingi darsda qo'yiladi
        grade: grade?.homework ?? null,
        score: grade?.homeworkScore ?? null,
        comment: grade?.comment ?? null,
        gradedAt: grade?.gradedAt ?? null,
      };
    });

    // Eng oxirgi baholanmagani — "joriy vazifa"
    const current = rows.find((r) => r.grade === null) ?? null;
    return { current, history: rows };
  }
}

export default new HomeworkService();
