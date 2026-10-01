import { Router } from 'express';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';
import { roleOrPermission } from '../../shared/middleware/permission.middleware';
import * as lessonsController from './lessons.controller';

const router = Router();

router.use(authenticate);

// ─── Papkalar ──────────────────────────────────────────────────────────────────

// GET  /api/lessons/folders?parentId=xxx — shu daraja ro'yxati (admin: hammasi, teacher: ruxsatlilar)
router.get('/folders', lessonsController.getFolders);

// GET  /api/lessons/folders/tree — barcha papkalar yassi ro'yxati (admin, ko'chirish uchun)
// Uyga vazifa bankini boshqaruvchi (ruxsat bilan) ham butun daraxtni ko'radi —
// vazifani istalgan darslikka yozishi kerak. Faqat o'qish; papkani
// yaratish/o'zgartirish avvalgidek faqat rollarga.
router.get(
  '/folders/tree',
  roleOrPermission(['admin', 'administrator', 'filial_rahbari'], 'homework_manage'),
  lessonsController.getFolderTree,
);

// POST /api/lessons/folders — papka yaratish (admin, parentId bo'lsa — ichki papka)
router.post('/folders', roleGuard('admin', 'administrator', 'filial_rahbari'), lessonsController.createFolder);

// PATCH /api/lessons/folders/:id — papka tahrirlash (admin)
router.patch('/folders/:id', roleGuard('admin', 'administrator', 'filial_rahbari'), lessonsController.updateFolder);

// DELETE /api/lessons/folders/:id — papka o'chirish (admin)
router.delete('/folders/:id', roleGuard('admin', 'administrator', 'filial_rahbari'), lessonsController.deleteFolder);

// ─── Darsliklar ────────────────────────────────────────────────────────────────

// GET  /api/lessons/folders/:id/items — papka darsliklarini olish
router.get('/folders/:id/items', lessonsController.getItems);

// POST /api/lessons/folders/:id/items — darslik qo'shish (admin)
router.post('/folders/:id/items', roleGuard('admin', 'administrator', 'filial_rahbari'), lessonsController.addItem);

// PATCH /api/lessons/items/:itemId — darslik tahrirlash (admin)
router.patch('/items/:itemId', roleGuard('admin', 'administrator', 'filial_rahbari'), lessonsController.updateItem);

// DELETE /api/lessons/items/:itemId — darslik o'chirish (admin)
router.delete('/items/:itemId', roleGuard('admin', 'administrator', 'filial_rahbari'), lessonsController.deleteItem);

// ─── Ruxsatlar ────────────────────────────────────────────────────────────────

// GET  /api/lessons/folders/:id/access — ruxsatlar ro'yxati (admin)
router.get('/folders/:id/access', roleGuard('admin', 'administrator', 'filial_rahbari'), lessonsController.getFolderAccess);

// POST /api/lessons/folders/:id/access — ruxsatlar sinxronizatsiya (admin)
router.post('/folders/:id/access', roleGuard('admin', 'administrator', 'filial_rahbari'), lessonsController.syncAccess);

// GET /api/lessons/teachers — barcha o'qituvchilar (ruxsat berish uchun)
router.get('/teachers', roleGuard('admin', 'administrator', 'filial_rahbari'), lessonsController.getAllTeachers);

export default router;
