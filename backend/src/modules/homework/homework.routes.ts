import { Router } from 'express';
import homeworkController from './homework.controller';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';
import { permissionGuard } from '../../shared/middleware/permission.middleware';

const router = Router();
router.use(authenticate);

// ── Bank: vazifalarni yozish (admin; kerak bo'lsa qo'lda beriladi) ──────────
// Ko'rish o'qituvchiga ham kerak — u bankdan tanlab guruhiga beradi.
router.get('/bank', roleGuard('admin', 'teacher', 'administrator', 'filial_rahbari'), homeworkController.listBank);
router.post('/bank', permissionGuard('homework_manage'), homeworkController.createBank);
router.put('/bank/:id', permissionGuard('homework_manage'), homeworkController.updateBank);
router.delete('/bank/:id', permissionGuard('homework_manage'), homeworkController.deleteBank);

// ── Berish: o'qituvchi o'z darsiga vazifa biriktiradi ───────────────────────
// Egalik tekshiruvi servisda: o'qituvchi faqat o'z sessiyasiga tega oladi.
const TEACHER = roleGuard('admin', 'teacher');
router.get('/session/:sessionId/options', TEACHER, homeworkController.getAssignOptions);
router.post('/session/:sessionId/assign', TEACHER, homeworkController.assign);
router.delete('/session/:sessionId/assign', TEACHER, homeworkController.unassign);
router.get('/session/:sessionId/to-grade', TEACHER, homeworkController.getToGrade);

// ── O'quvchi o'z vazifalarini ko'radi ───────────────────────────────────────
router.get('/mine', roleGuard('student'), homeworkController.getMine);

export default router;
