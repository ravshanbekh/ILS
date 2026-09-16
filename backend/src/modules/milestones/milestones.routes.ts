import { Router } from 'express';
import milestonesController from './milestones.controller';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// Nazorat qiluvchi rollar — kim butun manzarani ko'radi
const OVERSIGHT = ['admin', 'administrator', 'filial_rahbari', 'nazoratchi'];
// Bosqichni boshqaradiganlar (o'z guruhida) — egalik controllerda tekshiriladi
const OWNERS = ['admin', 'administrator', 'teacher'];

// ── Nazorat ─────────────────────────────────────────────────────────────────
router.get('/overview', roleGuard(...OVERSIGHT), milestonesController.overview);
router.get('/summary', roleGuard(...OVERSIGHT), milestonesController.summary);
router.get('/unconfigured', roleGuard(...OVERSIGHT), milestonesController.unconfigured);

// Ogohlantirish banneri — HAMMA kira oladi, lekin javob rolga qarab
// filtrlanadi: o'qituvchi faqat o'z guruhlarini ko'radi (controllerda).
router.get('/warnings', milestonesController.warnings);

// ── Guruh bosqichlari ───────────────────────────────────────────────────────
router.get('/group/:groupId', roleGuard(...OWNERS, ...OVERSIGHT), milestonesController.getByGroup);
router.post('/group/:groupId/sync', roleGuard('admin', 'administrator'), milestonesController.sync);

router.patch('/:id/date', roleGuard(...OWNERS), milestonesController.pickDate);
router.post('/:id/held', roleGuard(...OWNERS), milestonesController.markHeld);

export default router;
