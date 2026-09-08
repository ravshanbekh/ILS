import { Router } from 'express';
import supportHoursController from './support-hours.controller';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';
import { permissionGuard } from '../../shared/middleware/permission.middleware';

const router = Router();
router.use(authenticate);

/** Qoidalar (ish vaqti, tushlik, chegaralar) — hamma ko'ra oladi */
router.get('/rules', supportHoursController.getRules);

// ── Assistent o'z soatlarini boshqaradi ──────────────────────────────────
const SLOT_OWNERS = roleGuard('assistant', 'robototexnika_ustoz', 'admin');

router.get('/my-day', SLOT_OWNERS, supportHoursController.getMyDay);
router.get('/my-week', SLOT_OWNERS, supportHoursController.getMyWeek);
router.put('/my-day', SLOT_OWNERS, supportHoursController.setMyDay);
router.patch('/slots/:id/toggle', SLOT_OWNERS, supportHoursController.toggleSlot);
router.delete('/slots/:id', SLOT_OWNERS, supportHoursController.deleteSlot);
router.patch('/bookings/:id/attendance', SLOT_OWNERS, supportHoursController.markAttendance);

// ── O'quvchi o'z profilidan yoziladi ─────────────────────────────────────
router.get('/available', roleGuard('student'), supportHoursController.getAvailable);
router.post('/bookings', roleGuard('student'), supportHoursController.book);
router.get('/bookings/mine', roleGuard('student'), supportHoursController.getMyBookings);
/** Bekor qilish — o'quvchi o'zinikini, assistent/admin o'z soatidagini */
router.delete('/bookings/:id', supportHoursController.cancel);

// ── Admin nazorati (qo'lda beriladigan ruxsat) ───────────────────────────
router.get('/overview', permissionGuard('support_oversight'), supportHoursController.getOverview);
router.get('/assistants', permissionGuard('support_oversight'), supportHoursController.listAssistants);

export default router;
