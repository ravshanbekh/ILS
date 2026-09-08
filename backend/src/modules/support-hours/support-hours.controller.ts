import { Request, Response, NextFunction } from 'express';
import supportHoursService from './support-hours.service';
import { ApiError } from '../../shared/middleware/errorHandler';
import {
  ALLOWED_START_HOURS,
  LUNCH_END_HOUR,
  LUNCH_START_HOUR,
  MAX_BOOKINGS_PER_STUDENT_PER_DAY,
  MAX_STUDENTS_PER_SLOT,
  WORK_END_HOUR,
  WORK_START_HOUR,
  todayInCenter,
} from '../../shared/constants/supportHours';

/** ?date= bo'lmasa bugungi kun (Toshkent vaqti bo'yicha) */
function dateParam(req: Request): string {
  const raw = req.query.date;
  return typeof raw === 'string' && raw ? raw : todayInCenter();
}

class SupportHoursController {
  /** GET /api/support-hours/rules — frontend uchun qoidalar */
  async getRules(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({
        success: true,
        data: {
          workStartHour: WORK_START_HOUR,
          workEndHour: WORK_END_HOUR,
          lunchStartHour: LUNCH_START_HOUR,
          lunchEndHour: LUNCH_END_HOUR,
          allowedHours: ALLOWED_START_HOURS,
          maxStudentsPerSlot: MAX_STUDENTS_PER_SLOT,
          maxBookingsPerDay: MAX_BOOKINGS_PER_STUDENT_PER_DAY,
          today: todayInCenter(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // ── Assistent ─────────────────────────────────────────────────────────

  /** PUT /api/support-hours/my-day — bir kunning soatlarini belgilash */
  async setMyDay(req: Request, res: Response, next: NextFunction) {
    try {
      const { date, hours, capacity, note, assistantId } = req.body;
      if (typeof date !== 'string') throw ApiError.badRequest('Sana talab qilinadi');
      if (!Array.isArray(hours) || hours.some((h) => !Number.isInteger(h))) {
        throw ApiError.badRequest("Soatlar ro'yxati noto'g'ri");
      }

      // Admin boshqa assistent nomidan ham belgilay oladi
      const targetId =
        req.user!.role === 'admin' && typeof assistantId === 'string' && assistantId
          ? assistantId
          : req.user!.userId;

      const result = await supportHoursService.setDayHours(targetId, date, hours, {
        capacity: capacity === undefined ? undefined : Number(capacity),
        note: typeof note === 'string' ? note : null,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/support-hours/my-day?date= */
  async getMyDay(req: Request, res: Response, next: NextFunction) {
    try {
      const assistantId =
        req.user!.role === 'admin' && typeof req.query.assistantId === 'string'
          ? req.query.assistantId
          : req.user!.userId;
      const result = await supportHoursService.getAssistantDay(assistantId, dateParam(req));
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/support-hours/my-week?from=&days= */
  async getMyWeek(req: Request, res: Response, next: NextFunction) {
    try {
      const days = req.query.days ? Number(req.query.days) : 7;
      const result = await supportHoursService.getAssistantRange(
        req.user!.userId,
        dateParam(req),
        Number.isInteger(days) && days > 0 && days <= 31 ? days : 7
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /** PATCH /api/support-hours/slots/:id/toggle */
  async toggleSlot(req: Request, res: Response, next: NextFunction) {
    try {
      const isOpen = req.body?.isOpen;
      if (typeof isOpen !== 'boolean') throw ApiError.badRequest('isOpen true yoki false bo\'lishi kerak');
      const result = await supportHoursService.toggleSlot(req.params.id, isOpen, req.user!);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /** DELETE /api/support-hours/slots/:id */
  async deleteSlot(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await supportHoursService.deleteSlot(req.params.id, req.user!);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /** PATCH /api/support-hours/bookings/:id/attendance */
  async markAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      const status = req.body?.status;
      if (status !== 'keldi' && status !== 'kelmadi') {
        throw ApiError.badRequest("status 'keldi' yoki 'kelmadi' bo'lishi kerak");
      }
      const result = await supportHoursService.markAttendance(req.params.id, status, req.user!);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ── O'quvchi ──────────────────────────────────────────────────────────

  /** GET /api/support-hours/available?date= */
  async getAvailable(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await supportHoursService.getStudentDay(req.user!.userId, dateParam(req));
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/support-hours/bookings */
  async book(req: Request, res: Response, next: NextFunction) {
    try {
      const { slotId, topic } = req.body;
      if (typeof slotId !== 'string' || !slotId) throw ApiError.badRequest('slotId talab qilinadi');
      if (topic !== undefined && typeof topic !== 'string') {
        throw ApiError.badRequest("Mavzu matn bo'lishi kerak");
      }
      const result = await supportHoursService.book(
        req.user!.userId,
        slotId,
        typeof topic === 'string' ? topic.trim().slice(0, 300) : undefined
      );
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /** DELETE /api/support-hours/bookings/:id */
  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await supportHoursService.cancel(req.params.id, req.user!);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/support-hours/bookings/mine */
  async getMyBookings(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await supportHoursService.getMyBookings(req.user!.userId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ── Admin nazorati ────────────────────────────────────────────────────

  /** GET /api/support-hours/overview?date= */
  async getOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await supportHoursService.getAdminDay(dateParam(req));
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/support-hours/assistants */
  async listAssistants(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await supportHoursService.listAssistants();
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export default new SupportHoursController();
