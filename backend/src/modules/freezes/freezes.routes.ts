import { Router } from 'express';
import freezesController from './freezes.controller';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';

const router = Router();
router.use(authenticate);

// ============================================================
// MUZLATISH (POST) — admin, administrator, sotuv_operatori, kassir
// ============================================================
router.post(
  '/',
  roleGuard('admin', 'administrator', 'sotuv_operatori', 'kassir'),
  freezesController.freeze
);

// ============================================================
// AI TAHLIL (POST) — admin, filial_rahbari, kassir
// ============================================================
router.post(
  '/ai-analyze',
  roleGuard('admin', 'filial_rahbari', 'kassir'),
  freezesController.aiAnalyze
);

// ============================================================
// HISOBOT (GET) — admin, filial_rahbari, kassir
// ============================================================
router.get(
  '/report',
  roleGuard('admin', 'filial_rahbari', 'kassir'),
  freezesController.getReport
);

router.get(
  '/teacher-rating',
  roleGuard('admin', 'filial_rahbari', 'kassir'),
  freezesController.getTeacherRating
);

// ============================================================
// RO'YXAT (GET) — admin, filial_rahbari, kassir
// ============================================================
router.get(
  '/',
  roleGuard('admin', 'filial_rahbari', 'kassir'),
  freezesController.getAll
);

// ============================================================
// BEKOR QILISH (DELETE) — faqat admin
// ============================================================
router.delete('/:id', roleGuard('admin'), freezesController.unfreeze);

export default router;
