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
  roleGuard('admin', 'administrator', 'sotuv_operatori', 'kassir', 'filial_rahbari'),
  freezesController.aiAnalyze
);

// ============================================================
// HISOBOT (GET) — admin, filial_rahbari, kassir
// ============================================================
router.get(
  '/report',
  roleGuard('admin', 'administrator', 'sotuv_operatori', 'kassir', 'filial_rahbari'),
  freezesController.getReport
);

router.get(
  '/teacher-rating',
  roleGuard('admin', 'administrator', 'sotuv_operatori', 'kassir', 'filial_rahbari'),
  freezesController.getTeacherRating
);

// ============================================================
// RO'YXAT (GET) — admin, administrator, sotuv_operatori, kassir, filial_rahbari
// ============================================================
router.get(
  '/',
  roleGuard('admin', 'administrator', 'sotuv_operatori', 'kassir', 'filial_rahbari'),
  freezesController.getAll
);

// ============================================================
// OPERATOR SCRIPT YARATISH (POST) — barcha vakolatli rollar
// ============================================================
router.post(
  '/:id/script',
  roleGuard('admin', 'administrator', 'sotuv_operatori', 'kassir', 'filial_rahbari'),
  freezesController.generateScript
);

// ============================================================
// BEKOR QILISH (DELETE) — faqat admin
// ============================================================
router.delete('/:id', roleGuard('admin', 'administrator', 'sotuv_operatori', 'kassir'), freezesController.unfreeze);

export default router;
