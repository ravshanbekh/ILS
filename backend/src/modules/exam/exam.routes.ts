import { Router, json } from 'express';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';
import { loginLimiter } from '../../shared/middleware/rateLimiter';
import { permissionGuard } from '../../shared/middleware/permission.middleware';
import * as examController from './exam.controller';
import * as examStudent from './exam.student.controller';
import * as examGradeController from './exam.grade.controller';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// ── Multer (Rasm yuklash) ────────────────────────────────────────────────────
// data/ ostida — shu papka docker-compose'da persistent volume, uploads/ emas
// (qarang: live-quiz.routes.ts dagi xuddi shunday izoh).
const uploadDir = path.join(process.cwd(), 'data', 'uploads', 'exam-images');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `exam-q-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (/image\/(jpeg|jpg|png|webp)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Faqat JPG/PNG/WEBP rasm yuklanadi'));
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// ── O'qituvchi tomonidan (Auth kerak) ─────────────────────
// Imtihon CRUD
// Yaratish / tahrirlash / o'chirish — rol + qo'lda beriladigan ruxsat
// (permissions.ts: exam_create, exam_edit, exam_delete). Admin har doim o'tadi.
const canCreate = permissionGuard('exam_create');
const canEdit = permissionGuard('exam_edit');
const canDelete = permissionGuard('exam_delete');

router.post('/', authenticate, roleGuard('admin', 'teacher'), canCreate, examController.createExam);
router.get('/', authenticate, roleGuard('admin', 'teacher'), examController.getMyExams);

// Global imtihonlar (Admin + Teachers)
router.get('/global', authenticate, roleGuard('admin', 'teacher'), examController.getGlobalExams);

// ── O'quvchi: o'z profilidan ko'radi va kiradi ──────────────────────────────
router.get('/my-active', authenticate, roleGuard('student'), examStudent.getMyActiveExams);
router.get('/my-results', authenticate, roleGuard('student'), examStudent.getMyExamResults);
router.post('/:id/enter', authenticate, roleGuard('student'), examStudent.enterExamAsMe);

// ── O'qituvchi: imtihonni guruhga biriktirish ───────────────────────────────
router.get('/:id/groups', authenticate, roleGuard('admin', 'teacher'), examStudent.getExamGroups);
router.patch('/:id/groups', authenticate, roleGuard('admin', 'teacher'), examStudent.setExamGroups);
router.post('/global/:id/activate', authenticate, roleGuard('admin', 'teacher'), examController.activateGlobalExam);

router.get('/results/all', authenticate, roleGuard('admin', 'teacher'), examController.getAllExamResults);
router.get('/:id', authenticate, roleGuard('admin', 'teacher'), examController.getExamById);
// Ilgari faqat admin edi, lekin sahifa ✏️ tugmasini o'qituvchiga ham
// ko'rsatardi (bosganda 403). Endi exam_edit ruxsati bor o'qituvchi O'Z
// imtihonini tahrirlaydi — egalik updateExam ichida tekshiriladi.
router.patch('/:id', authenticate, roleGuard('admin', 'teacher'), canEdit, examController.updateExam);
router.patch('/:id/activate', authenticate, roleGuard('admin', 'teacher'), examController.activateExam);
router.patch('/:id/complete', authenticate, roleGuard('admin', 'teacher'), examController.completeExam);
router.delete('/:id', authenticate, roleGuard('admin', 'teacher'), canDelete, examController.deleteExam);

// Savollar (qo'lda + Excel import)
router.post('/:id/questions', authenticate, roleGuard('admin', 'teacher'), canCreate, upload.single('image'), examController.addQuestions);
router.post('/:id/questions/bulk', authenticate, roleGuard('admin', 'teacher'), canCreate, json({ limit: '5mb' }), examController.bulkAddQuestions);
router.put('/:id/questions/:qId', authenticate, roleGuard('admin', 'teacher'), canCreate, upload.single('image'), examController.updateQuestion);
router.delete('/:id/questions/:qId', authenticate, roleGuard('admin', 'teacher'), canCreate, examController.deleteQuestion);
router.post('/:id/shuffle-options', authenticate, roleGuard('admin', 'teacher'), canCreate, examController.shuffleQuestionOptions);

// Natijalar — o'qituvchi uchun
router.get('/:id/results', authenticate, roleGuard('admin', 'teacher'), examController.getExamResults);
router.patch('/:id/grade/:participantId', authenticate, roleGuard('admin', 'teacher'), examGradeController.gradeParticipant);

// ── O'quvchi tomonidan (Public — faqat accessCode kerak) ──
router.get('/join/:code', examController.getExamByCode);
router.post('/join/:code/start', loginLimiter, examController.startExam);
router.post('/join/:code/submit-test', examController.submitTest);
router.post('/join/:code/submit-videos', examController.submitVideos);

export default router;
