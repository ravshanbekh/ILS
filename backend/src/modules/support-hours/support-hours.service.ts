import prisma from '../../config/database';
import { ApiError } from '../../shared/middleware/errorHandler';
import {
  ALLOWED_START_HOURS,
  MAX_STUDENTS_PER_SLOT,
  formatSlotRange,
  isAllowedStartHour,
  isClosedDay,
  isPastSlot,
  parseDateOnly,
  todayInCenter,
  toDateOnlyString,
} from '../../shared/constants/supportHours';
import { filialLabel } from '../../shared/constants/filials';

const ASSISTANT_ROLES = ['assistant', 'robototexnika_ustoz'];

interface SlotRow {
  id: string;
  date: Date;
  startHour: number;
  capacity: number;
  note: string | null;
  isOpen: boolean;
  assistantId: string;
}

class SupportHoursService {
  // ============ YORDAMCHILAR ============

  /** "YYYY-MM-DD" ni tekshirib Date ga aylantiradi, yakshanbani rad etadi */
  private requireOpenDate(value: string): Date {
    const date = parseDateOnly(value);
    if (!date) throw ApiError.badRequest("Sana noto'g'ri — YYYY-MM-DD ko'rinishida bo'lishi kerak");
    if (isClosedDay(date)) throw ApiError.badRequest('Yakshanba kuni qabul yo\'q');
    return date;
  }

  /** Assistent o'z soatiga tegyaptimi? Admin har kimnikiga tega oladi. */
  private assertOwnerOrAdmin(slotAssistantId: string, user: { userId: string; role: string }) {
    if (user.role === 'admin') return;
    if (slotAssistantId !== user.userId) {
      throw ApiError.forbidden("Bu soat sizniki emas");
    }
  }

  private shape(slot: SlotRow & { assistant?: { fullName: string }; bookings?: any[] }) {
    const active = (slot.bookings || []).filter((b) => b.status !== 'bekor');
    return {
      id: slot.id,
      date: toDateOnlyString(slot.date),
      startHour: slot.startHour,
      timeRange: formatSlotRange(slot.startHour),
      capacity: slot.capacity,
      booked: active.length,
      free: Math.max(slot.capacity - active.length, 0),
      note: slot.note,
      isOpen: slot.isOpen,
      assistantId: slot.assistantId,
      assistantName: slot.assistant?.fullName ?? null,
      students: active.map((b) => ({
        bookingId: b.id,
        studentId: b.studentId,
        fullName: b.student?.fullName ?? null,
        groupName: b.student?.groupStudents?.[0]?.group?.name ?? null,
        topic: b.topic,
        status: b.status,
        createdAt: b.createdAt,
      })),
    };
  }

  // ============ ASSISTENT: O'Z SOATLARINI BOSHQARISH ============

  /**
   * Bir kunga bir nechta soatni birdaniga ochish/yopish.
   * `hours` — o'sha kuni ochiq turishi kerak bo'lgan soatlar ro'yxati.
   * Ro'yxatda yo'q, lekin ilgari ochilgan soatlar yopiladi (yozilganlar bo'lsa
   * o'chirilmaydi — faqat yangi yozilish to'xtatiladi).
   */
  async setDayHours(
    assistantId: string,
    dateStr: string,
    hours: number[],
    options?: { capacity?: number; note?: string | null }
  ) {
    const date = this.requireOpenDate(dateStr);

    const unique = [...new Set(hours)].sort((a, b) => a - b);
    for (const h of unique) {
      if (!isAllowedStartHour(h)) {
        throw ApiError.badRequest(
          `${formatSlotRange(h)} — bu vaqtga ochib bo'lmaydi. Ish vaqti 08:00–19:00, tushlik 12:00–14:00.`
        );
      }
      if (isPastSlot(dateStr, h)) {
        throw ApiError.badRequest(`${formatSlotRange(h)} allaqachon o'tib ketgan`);
      }
    }

    const capacity = options?.capacity ?? MAX_STUDENTS_PER_SLOT;
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_STUDENTS_PER_SLOT) {
      throw ApiError.badRequest(`Bir soatga 1 dan ${MAX_STUDENTS_PER_SLOT} tagacha o'quvchi yozilishi mumkin`);
    }

    const existing = await prisma.supportSlot.findMany({
      where: { assistantId, date },
      include: { _count: { select: { bookings: true } } },
    });
    const byHour = new Map(existing.map((s) => [s.startHour, s]));

    await prisma.$transaction(async (tx) => {
      // Ochilishi kerak bo'lganlar
      for (const hour of unique) {
        const found = byHour.get(hour);
        if (found) {
          await tx.supportSlot.update({
            where: { id: found.id },
            data: { isOpen: true, capacity, note: options?.note ?? found.note },
          });
        } else {
          await tx.supportSlot.create({
            data: { assistantId, date, startHour: hour, capacity, note: options?.note ?? null },
          });
        }
      }

      // Ro'yxatdan chiqarilganlar
      for (const slot of existing) {
        if (unique.includes(slot.startHour)) continue;
        if (slot._count.bookings > 0) {
          // O'quvchi yozilgan soatni yo'q qilib bo'lmaydi — yopib qo'yamiz,
          // aks holda bola kelib qolib, hech kim kutmayotgan bo'lardi.
          await tx.supportSlot.update({ where: { id: slot.id }, data: { isOpen: false } });
        } else {
          await tx.supportSlot.delete({ where: { id: slot.id } });
        }
      }
    });

    return this.getAssistantDay(assistantId, dateStr);
  }

  /** Bitta soatni yopish/ochish */
  async toggleSlot(slotId: string, isOpen: boolean, user: { userId: string; role: string }) {
    const slot = await prisma.supportSlot.findUnique({ where: { id: slotId } });
    if (!slot) throw ApiError.notFound('Soat topilmadi');
    this.assertOwnerOrAdmin(slot.assistantId, user);

    await prisma.supportSlot.update({ where: { id: slotId }, data: { isOpen } });
    return { success: true };
  }

  /** Soatni o'chirish — faqat hech kim yozilmagan bo'lsa */
  async deleteSlot(slotId: string, user: { userId: string; role: string }) {
    const slot = await prisma.supportSlot.findUnique({
      where: { id: slotId },
      include: { _count: { select: { bookings: true } } },
    });
    if (!slot) throw ApiError.notFound('Soat topilmadi');
    this.assertOwnerOrAdmin(slot.assistantId, user);

    if (slot._count.bookings > 0) {
      throw ApiError.badRequest(
        "Bu soatga o'quvchi yozilgan — o'chirib bo'lmaydi. Yangi yozilishni to'xtatish uchun soatni yoping."
      );
    }

    await prisma.supportSlot.delete({ where: { id: slotId } });
    return { success: true };
  }

  /** Assistentning bitta kundagi soatlari (kim yozilgani bilan) */
  async getAssistantDay(assistantId: string, dateStr: string) {
    const date = parseDateOnly(dateStr);
    if (!date) throw ApiError.badRequest("Sana noto'g'ri");

    const slots = await prisma.supportSlot.findMany({
      where: { assistantId, date },
      orderBy: { startHour: 'asc' },
      include: {
        assistant: { select: { fullName: true } },
        bookings: {
          include: {
            student: {
              select: {
                fullName: true,
                groupStudents: {
                  take: 1,
                  orderBy: { joinedAt: 'desc' },
                  select: { group: { select: { name: true } } },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return {
      date: dateStr,
      isClosedDay: isClosedDay(date),
      allowedHours: ALLOWED_START_HOURS,
      maxCapacity: MAX_STUDENTS_PER_SLOT,
      slots: slots.map((s) => this.shape(s as any)),
    };
  }

  /** Assistentning kelayotgan kunlardagi soatlari — qisqa ro'yxat */
  async getAssistantRange(assistantId: string, fromStr: string, days = 7) {
    const from = parseDateOnly(fromStr);
    if (!from) throw ApiError.badRequest("Sana noto'g'ri");
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + days);

    const slots = await prisma.supportSlot.findMany({
      where: { assistantId, date: { gte: from, lt: to } },
      orderBy: [{ date: 'asc' }, { startHour: 'asc' }],
      include: { _count: { select: { bookings: true } } },
    });

    return slots.map((s) => ({
      id: s.id,
      date: toDateOnlyString(s.date),
      startHour: s.startHour,
      timeRange: formatSlotRange(s.startHour),
      capacity: s.capacity,
      booked: s._count.bookings,
      isOpen: s.isOpen,
    }));
  }

  // ============ O'QUVCHI: YOZILISH ============

  /**
   * O'quvchiga bir kunda ochiq turgan soatlar — assistentlar bo'yicha.
   * To'lib qolgan va yopilgan soatlar ham ko'rinadi (nega yozilolmayotgani
   * tushunarli bo'lishi uchun), lekin `canBook: false` bilan.
   */
  async getStudentDay(studentId: string, dateStr: string) {
    const date = parseDateOnly(dateStr);
    if (!date) throw ApiError.badRequest("Sana noto'g'ri");

    const [slots, myBooking] = await Promise.all([
      prisma.supportSlot.findMany({
        where: { date },
        orderBy: [{ startHour: 'asc' }],
        include: {
          assistant: { select: { id: true, fullName: true, avatarUrl: true, bio: true, filial: true } },
          bookings: { select: { id: true, studentId: true, status: true } },
        },
      }),
      this.getMyBookingOnDate(studentId, date),
    ]);

    const items = slots.map((slot) => {
      const active = slot.bookings.filter((b) => b.status !== 'bekor');
      const free = Math.max(slot.capacity - active.length, 0);
      const mine = active.find((b) => b.studentId === studentId);
      const past = isPastSlot(dateStr, slot.startHour);

      let reason: string | null = null;
      if (mine) reason = null;
      else if (past) reason = "Vaqt o'tib ketgan";
      else if (!slot.isOpen) reason = 'Yopilgan';
      else if (free === 0) reason = "To'lib qolgan";
      else if (myBooking) reason = "Bugun allaqachon yozilgansiz";

      return {
        slotId: slot.id,
        startHour: slot.startHour,
        timeRange: formatSlotRange(slot.startHour),
        assistantId: slot.assistant.id,
        assistantName: slot.assistant.fullName,
        assistantAvatar: slot.assistant.avatarUrl,
        assistantBio: slot.assistant.bio,
        assistantFilial: filialLabel(slot.assistant.filial),
        capacity: slot.capacity,
        booked: active.length,
        free,
        isMine: !!mine,
        myBookingId: mine?.id ?? null,
        canBook: !mine && !past && slot.isOpen && free > 0 && !myBooking,
        reason,
      };
    });

    return {
      date: dateStr,
      isClosedDay: isClosedDay(date),
      alreadyBooked: myBooking
        ? {
            bookingId: myBooking.id,
            slotId: myBooking.slotId,
            timeRange: formatSlotRange(myBooking.slot.startHour),
            assistantName: myBooking.slot.assistant.fullName,
            topic: myBooking.topic,
          }
        : null,
      slots: items,
    };
  }

  private async getMyBookingOnDate(studentId: string, date: Date) {
    return prisma.supportBooking.findFirst({
      where: {
        studentId,
        status: { not: 'bekor' },
        slot: { date },
      },
      include: { slot: { include: { assistant: { select: { fullName: true } } } } },
    });
  }

  /**
   * Yozilish. Barcha qoida shu yerda tekshiriladi:
   *   - yakshanba emas, vaqt o'tmagan, soat ochiq
   *   - soat to'lmagan (max 10)
   *   - o'quvchi o'sha kuni boshqa soatga yozilmagan (kuniga 1 marta)
   *
   * Sig'im tekshiruvi tranzaksiya ichida: ikki bola bir vaqtda oxirgi joyni
   * bosganda 11-chi yozilib qolmasligi kerak.
   */
  async book(studentId: string, slotId: string, topic?: string) {
    const slot = await prisma.supportSlot.findUnique({
      where: { id: slotId },
      include: { assistant: { select: { fullName: true } } },
    });
    if (!slot) throw ApiError.notFound('Bunday soat topilmadi');

    const dateStr = toDateOnlyString(slot.date);
    if (isClosedDay(slot.date)) throw ApiError.badRequest("Yakshanba kuni qabul yo'q");
    if (!slot.isOpen) throw ApiError.badRequest('Bu soat yopilgan');
    if (isPastSlot(dateStr, slot.startHour)) {
      throw ApiError.badRequest("Bu vaqt o'tib ketgan — keyingi soatlardan tanlang");
    }

    return prisma.$transaction(
      async (tx) => {
        // Shu kuni boshqa yozuv bormi?
        const sameDay = await tx.supportBooking.findFirst({
          where: { studentId, status: { not: 'bekor' }, slot: { date: slot.date } },
          include: { slot: true },
        });
        if (sameDay) {
          if (sameDay.slotId === slotId) {
            throw ApiError.badRequest('Siz bu soatga allaqachon yozilgansiz');
          }
          throw ApiError.badRequest(
            `Bir kunda faqat bitta soatga yozilish mumkin. Siz ${formatSlotRange(
              sameDay.slot.startHour
            )} ga yozilgansiz — avval uni bekor qiling.`
          );
        }

        const taken = await tx.supportBooking.count({
          where: { slotId, status: { not: 'bekor' } },
        });
        if (taken >= slot.capacity) {
          throw ApiError.badRequest("Bu soat to'lib qoldi — boshqa vaqtni tanlang");
        }

        // Ilgari bekor qilingan yozuv bo'lsa uni tiklaymiz (unique [slotId, studentId])
        const cancelled = await tx.supportBooking.findUnique({
          where: { slotId_studentId: { slotId, studentId } },
        });

        const booking = cancelled
          ? await tx.supportBooking.update({
              where: { id: cancelled.id },
              data: { status: 'band', topic: topic || null, cancelledAt: null, createdAt: new Date() },
            })
          : await tx.supportBooking.create({
              data: { slotId, studentId, topic: topic || null },
            });

        return booking;
      },
      { isolationLevel: 'Serializable' }
    ).then((booking) => ({
      id: booking.id,
      date: dateStr,
      timeRange: formatSlotRange(slot.startHour),
      assistantName: slot.assistant.fullName,
      topic: booking.topic,
    }));
  }

  /** O'quvchi o'z yozuvini bekor qiladi */
  async cancel(bookingId: string, user: { userId: string; role: string }) {
    const booking = await prisma.supportBooking.findUnique({
      where: { id: bookingId },
      include: { slot: true },
    });
    if (!booking) throw ApiError.notFound('Yozuv topilmadi');

    const isOwner = booking.studentId === user.userId;
    const isStaff = user.role === 'admin' || booking.slot.assistantId === user.userId;
    if (!isOwner && !isStaff) throw ApiError.forbidden('Bu yozuv sizniki emas');

    if (booking.status === 'bekor') return { success: true };

    // O'quvchi boshlanib ketgan darsni bekor qila olmaydi (xodim qila oladi)
    if (isOwner && !isStaff && isPastSlot(toDateOnlyString(booking.slot.date), booking.slot.startHour)) {
      throw ApiError.badRequest("Boshlanib ketgan vaqtni bekor qilib bo'lmaydi");
    }

    await prisma.supportBooking.update({
      where: { id: bookingId },
      data: { status: 'bekor', cancelledAt: new Date() },
    });
    return { success: true };
  }

  /** Assistent yoki admin — o'quvchi keldimi/kelmadimi belgilaydi */
  async markAttendance(
    bookingId: string,
    status: 'keldi' | 'kelmadi',
    user: { userId: string; role: string }
  ) {
    const booking = await prisma.supportBooking.findUnique({
      where: { id: bookingId },
      include: { slot: true },
    });
    if (!booking) throw ApiError.notFound('Yozuv topilmadi');
    this.assertOwnerOrAdmin(booking.slot.assistantId, user);

    await prisma.supportBooking.update({ where: { id: bookingId }, data: { status } });
    return { success: true };
  }

  /** O'quvchining o'z yozuvlari tarixi */
  async getMyBookings(studentId: string, limit = 20) {
    const bookings = await prisma.supportBooking.findMany({
      where: { studentId },
      orderBy: [{ slot: { date: 'desc' } }, { slot: { startHour: 'desc' } }],
      take: limit,
      include: { slot: { include: { assistant: { select: { fullName: true } } } } },
    });

    return bookings.map((b) => ({
      id: b.id,
      date: toDateOnlyString(b.slot.date),
      timeRange: formatSlotRange(b.slot.startHour),
      assistantName: b.slot.assistant.fullName,
      topic: b.topic,
      status: b.status,
      canCancel:
        b.status === 'band' && !isPastSlot(toDateOnlyString(b.slot.date), b.slot.startHour),
    }));
  }

  // ============ ADMIN: NAZORAT ============

  /**
   * Bir kunning to'liq manzarasi: har bir assistent, u ochgan soatlar,
   * kim yozilgani va kim kelgani. Assistentlar ro'yxati to'liq — soat
   * ochmaganlari ham ko'rinadi, chunki nazoratning asosiy savoli aynan
   * "kim umuman soat ochmayapti?".
   */
  async getAdminDay(dateStr: string) {
    const date = parseDateOnly(dateStr);
    if (!date) throw ApiError.badRequest("Sana noto'g'ri");

    const [assistants, slots] = await Promise.all([
      prisma.user.findMany({
        where: { role: { in: ASSISTANT_ROLES as any }, isActive: true },
        select: { id: true, fullName: true, avatarUrl: true },
        orderBy: { fullName: 'asc' },
      }),
      prisma.supportSlot.findMany({
        where: { date },
        orderBy: { startHour: 'asc' },
        include: {
          assistant: { select: { fullName: true } },
          bookings: {
            include: {
              student: {
                select: {
                  fullName: true,
                  groupStudents: {
                    take: 1,
                    orderBy: { joinedAt: 'desc' },
                    select: { group: { select: { name: true } } },
                  },
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
    ]);

    const slotsByAssistant = new Map<string, typeof slots>();
    for (const slot of slots) {
      const list = slotsByAssistant.get(slot.assistantId);
      if (list) list.push(slot);
      else slotsByAssistant.set(slot.assistantId, [slot]);
    }

    const rows = assistants.map((a) => {
      const own = (slotsByAssistant.get(a.id) || []).map((s) => this.shape(s as any));
      const openSlots = own.filter((s) => s.isOpen);
      const booked = own.reduce((sum, s) => sum + s.booked, 0);
      const capacity = openSlots.reduce((sum, s) => sum + s.capacity, 0);
      const attended = own.reduce(
        (sum, s) => sum + s.students.filter((st) => st.status === 'keldi').length,
        0
      );
      const missed = own.reduce(
        (sum, s) => sum + s.students.filter((st) => st.status === 'kelmadi').length,
        0
      );

      return {
        assistantId: a.id,
        assistantName: a.fullName,
        avatarUrl: a.avatarUrl,
        openHours: openSlots.length,
        capacity,
        booked,
        attended,
        missed,
        slots: own,
      };
    });

    const totals = rows.reduce(
      (acc, r) => ({
        openHours: acc.openHours + r.openHours,
        capacity: acc.capacity + r.capacity,
        booked: acc.booked + r.booked,
        attended: acc.attended + r.attended,
        missed: acc.missed + r.missed,
        idleAssistants: acc.idleAssistants + (r.openHours === 0 ? 1 : 0),
      }),
      { openHours: 0, capacity: 0, booked: 0, attended: 0, missed: 0, idleAssistants: 0 }
    );

    return {
      date: dateStr,
      isClosedDay: isClosedDay(date),
      today: todayInCenter(),
      assistants: rows,
      totals: { ...totals, assistantCount: assistants.length },
    };
  }

  /** Assistentlar ro'yxati (admin bir assistent nomidan soat ochishi uchun) */
  async listAssistants() {
    return prisma.user.findMany({
      where: { role: { in: ASSISTANT_ROLES as any }, isActive: true },
      select: { id: true, fullName: true, role: true },
      orderBy: { fullName: 'asc' },
    });
  }
}

export default new SupportHoursService();
