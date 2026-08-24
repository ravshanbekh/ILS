import { RsvpAnswer } from '@prisma/client';
import prisma from '../../config/database';
import { ApiError } from '../../shared/middleware/errorHandler';
import { CreateEventInput } from './group-events.validation';

class GroupEventsService {
  async create(data: CreateEventInput, creatorId: string, isAdmin: boolean) {
    const group = await prisma.group.findUnique({ where: { id: data.groupId } });
    if (!group) throw ApiError.notFound('Guruh topilmadi');
    if (!isAdmin && group.teacherId !== creatorId) {
      throw ApiError.forbidden('Bu guruh sizga tegishli emas');
    }

    return prisma.groupEvent.create({
      data: {
        groupId: data.groupId,
        title: data.title,
        eventAt: new Date(data.eventAt),
        place: data.place,
        description: data.description,
        createdById: creatorId,
      },
      include: { group: { select: { id: true, name: true } } },
    });
  }

  async getByGroup(groupId: string) {
    return prisma.groupEvent.findMany({
      where: { groupId },
      orderBy: { eventAt: 'desc' },
      include: {
        _count: { select: { rsvps: true } },
      },
    });
  }

  async getById(id: string) {
    const event = await prisma.groupEvent.findUnique({
      where: { id },
      include: { group: { select: { id: true, name: true, teacherId: true } } },
    });
    if (!event) throw ApiError.notFound('Tadbir topilmadi');
    return event;
  }

  async delete(id: string, requesterId: string, isAdmin: boolean) {
    const event = await this.getById(id);
    if (!isAdmin && event.group.teacherId !== requesterId) {
      throw ApiError.forbidden('Bu tadbir sizga tegishli emas');
    }
    await prisma.groupEvent.delete({ where: { id } });
    return { message: "Tadbir o'chirildi" };
  }

  async getRsvpSummary(id: string) {
    const rsvps = await prisma.eventRsvp.findMany({ where: { eventId: id } });
    return {
      boraman: rsvps.filter((r) => r.answer === 'boraman').length,
      yoq: rsvps.filter((r) => r.answer === 'yoq').length,
      aniqEmas: rsvps.filter((r) => r.answer === 'aniq_emas').length,
      total: rsvps.length,
    };
  }

  async recordRsvp(eventId: string, telegramLinkId: string, answer: RsvpAnswer) {
    return prisma.eventRsvp.upsert({
      where: { eventId_telegramLinkId: { eventId, telegramLinkId } },
      create: { eventId, telegramLinkId, answer },
      update: { answer, respondedAt: new Date() },
    });
  }

  /** Taklifnoma yuborilmagan (yangi yaratilgan) tadbirlar */
  async getEventsPendingInvite() {
    return prisma.groupEvent.findMany({
      where: { invitedAt: null, eventAt: { gt: new Date() } },
      include: { group: { select: { id: true, name: true, telegramChatId: true } } },
    });
  }

  async markInvited(id: string) {
    await prisma.groupEvent.update({ where: { id }, data: { invitedAt: new Date() } });
  }

  /** 7 kun / 1 kun / 2 soat oldin eslatma yuborilishi kerak bo'lgan tadbirlar */
  async getEventsNeedingReminder(stage: '7d' | '1d' | '2h') {
    const now = new Date();
    const thresholdMs = stage === '7d' ? 7 * 24 * 60 * 60 * 1000 : stage === '1d' ? 24 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000;
    const field = stage === '7d' ? 'reminder7dAt' : stage === '1d' ? 'reminder1dAt' : 'reminder2hAt';

    return prisma.groupEvent.findMany({
      where: {
        [field]: null,
        eventAt: { gt: now, lte: new Date(now.getTime() + thresholdMs) },
      } as any,
      include: { group: { select: { id: true, name: true } } },
    });
  }

  async markReminderSent(id: string, stage: '7d' | '1d' | '2h') {
    const field = stage === '7d' ? 'reminder7dAt' : stage === '1d' ? 'reminder1dAt' : 'reminder2hAt';
    await prisma.groupEvent.update({ where: { id }, data: { [field]: new Date() } as any });
  }

  /** Kuniga 20:00 da chaqiriladi — bo'lib o'tgan, lekin hali so'ralmagan tadbirlar */
  async getEventsPendingFeedbackRequest() {
    return prisma.groupEvent.findMany({
      where: { feedbackRequestedAt: null, eventAt: { lte: new Date() } },
      include: { group: { select: { id: true, name: true } } },
    });
  }

  async markFeedbackRequested(id: string) {
    await prisma.groupEvent.update({ where: { id }, data: { feedbackRequestedAt: new Date() } });
  }
}

export default new GroupEventsService();
