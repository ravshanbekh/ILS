import { Router, json } from 'express';
import groupsController from './groups.controller';
import normativesController from '../normatives/normatives.controller';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';

const router = Router();

// Barcha routelar authenticate talab qiladi
router.use(authenticate);

const VIEWER_ROLES = ['admin', 'teacher', 'student', 'kassir', 'administrator', 'sotuv_operatori', 'filial_rahbari', 'moliya_rahbari', 'assistant', 'nazoratchi', 'hr_rahbari', 'call_operatori'];

// GET /api/groups — Barcha guruhlar
router.get('/', roleGuard('admin', 'teacher', 'kassir', 'administrator', 'sotuv_operatori', 'filial_rahbari', 'moliya_rahbari', 'assistant', 'nazoratchi', 'hr_rahbari', 'call_operatori'), groupsController.getAll);

// GET /api/groups/:id — Bitta guruh
router.get('/:id', roleGuard('admin', 'teacher', 'student', 'kassir', 'administrator', 'sotuv_operatori', 'filial_rahbari', 'moliya_rahbari', 'assistant', 'nazoratchi', 'hr_rahbari', 'call_operatori'), groupsController.getById);

// POST /api/groups — Guruh yaratish
router.post('/', roleGuard('admin', 'teacher'), groupsController.create);

// PUT /api/groups/:id — Guruhni yangilash
router.put('/:id', roleGuard('admin', 'teacher'), groupsController.update);

// DELETE /api/groups/:id — Guruhni o'chirish
router.delete('/:id', roleGuard('admin'), groupsController.delete);

// POST /api/groups/:id/students — O'quvchi qo'shish
router.post('/:id/students', roleGuard('admin', 'teacher'), groupsController.addStudent);

// POST /api/groups/:id/students/bulk — Ko'plab o'quvchi qo'shish
router.post('/:id/students/bulk', roleGuard('admin', 'teacher'), json({ limit: '5mb' }), groupsController.addStudents);

// DELETE /api/groups/:id/students/:studentId — O'quvchini chiqarish
router.delete('/:id/students/:studentId', roleGuard('admin', 'teacher'), groupsController.removeStudent);

// POST /api/groups/transfer-student — O'quvchini bir guruhdan boshqa guruhga o'tkazish
router.post('/transfer-student', roleGuard('admin', 'teacher', 'administrator', 'sotuv_operatori'), groupsController.transferStudent);

// POST /api/groups/:id/normatives — Guruhga normativ biriktirish
router.post('/:id/normatives', roleGuard('admin', 'teacher'), normativesController.assignToGroup);

export default router;
