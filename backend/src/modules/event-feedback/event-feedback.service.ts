import { EventFeedbackSatisfaction } from '@prisma/client';
import prisma from '../../config/database';
import { ApiError } from '../../shared/middleware/errorHandler';
import { generateText, getAISettings } from '../../shared/utils/ai';
import logger from '../../shared/utils/logger';

interface Filters {
  groupId?: string;
  teacherId?: string;
  eventId?: string;
  from?: string;
  to?: string;
}

function buildWhere(filters: Filters) {
  return {
    groupId: filters.groupId,
    teacherId: filters.teacherId,
    eventId: filters.eventId,
    createdAt: {
      gte: filters.from ? new Date(filters.from) : undefined,
      lte: filters.to ? new Date(filters.to) : undefined,
    },
  };
}

class EventFeedbackService {
  /**
   * Ota-ona botda baho tugmasini bosganda — birinchi marta yaratiladi yoki yangilanadi.
   */
  async submitSatisfaction(eventId: string, telegramLinkId: string, satisfaction: EventFeedbackSatisfaction) {
    const link = await prisma.telegramLink.findUnique({ where: { id: telegramLinkId } });
    if (!link) throw ApiError.notFound('Bog\'lanish topilmadi');

    const event = await prisma.groupEvent.findUnique({ where: { id: eventId } });
    if (!event) throw ApiError.notFound('Tadbir topilmadi');

    const groupStudent = await prisma.groupStudent.findFirst({
      where: { studentId: link.studentId, groupId: event.groupId },
      include: { group: { select: { teacherId: true } } },
    });

    return prisma.eventFeedback.upsert({
      where: { eventId_telegramLinkId: { eventId, telegramLinkId } },
      create: {
        eventId,
        telegramLinkId,
        studentId: link.studentId,
        groupId: event.groupId,
        teacherId: groupStudent?.group?.teacherId,
        satisfaction,
      },
      update: { satisfaction },
    });
  }

  /**
   * Ixtiyoriy izoh qo'shish — baho bergandan keyin yozgan matni.
   */
  async addComment(eventId: string, telegramLinkId: string, comment: string) {
    const existing = await prisma.eventFeedback.findUnique({
      where: { eventId_telegramLinkId: { eventId, telegramLinkId } },
    });
    if (!existing) return null;

    return prisma.eventFeedback.update({
      where: { id: existing.id },
      data: { comment: comment.slice(0, 1000) },
    });
  }

  async getAll(filters: Filters) {
    return prisma.eventFeedback.findMany({
      where: buildWhere(filters),
      include: {
        event: { select: { title: true, eventAt: true } },
        student: { select: { fullName: true } },
        group: { select: { name: true } },
        teacher: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStats(filters: Filters) {
    const rows = await prisma.eventFeedback.findMany({
      where: buildWhere(filters),
      select: { satisfaction: true },
    });
    return {
      total: rows.length,
      mamnun: rows.filter((r) => r.satisfaction === 'mamnun').length,
      oddiy: rows.filter((r) => r.satisfaction === 'oddiy').length,
      norozi: rows.filter((r) => r.satisfaction === 'norozi').length,
    };
  }

  /**
   * AI tahlil — filtrlangan feedbacklar asosida muammo va tavsiyalar.
   */
  async aiAnalyze(filters: Filters): Promise<string> {
    const { apiKey } = getAISettings();
    if (!apiKey) throw new Error('API_KEY_NOT_SET');

    const feedbacks = await this.getAll(filters);
    if (feedbacks.length === 0) throw new Error('NO_DATA');

    const stats = await this.getStats(filters);
    const commentsList = feedbacks
      .filter((f) => f.comment)
      .map((f) => `- [${f.satisfaction}] ${f.group.name} (${f.teacher?.fullName || 'o\'qituvchi noma\'lum'}): "${f.comment}"`)
      .join('\n');

    const prompt = `Siz IT Live o'quv markazi uchun Demo Day tadbiri bo'yicha ota-onalar fikr-mulohazasini tahlil qiluvchi yordamchisiz.

Umumiy statistika: jami ${stats.total} ta fikr — 😊 mamnun: ${stats.mamnun}, 😐 oddiy: ${stats.oddiy}, 😞 norozi: ${stats.norozi}.

Ota-onalarning yozma izohlari:
${commentsList || 'Yozma izohlar yo\'q, faqat baholar.'}

Quyidagi tuzilishda, o'zbek tilida, aniq va amaliy javob bering (Markdown emas, oddiy matn, emoji va yangi qatorlar bilan formatlang):
1. Umumiy holat (1-2 gap)
2. Aniqlangan muammo va kamchiliklar (agar bo'lsa, aniq punktlar bilan)
3. Keyingi Demo Day'gacha nima tuzatish kerak — 3-5 ta amaliy tavsiya
Javob 250 so'zdan oshmasin.`;

    try {
      return await generateText(prompt, 800, 0.5);
    } catch (err) {
      logger.error('Event feedback AI tahlil xatosi:', err);
      throw err;
    }
  }
}

export default new EventFeedbackService();
