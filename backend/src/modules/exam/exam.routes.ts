import { Router, json } from 'express';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';
import { loginLimiter } from '../../shared/middleware/rateLimiter';
import * as examController from './exam.controller';
import * as examGradeController from './exam.grade.controller';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// ── Multer (Rasm yuklash) ────────────────────────────────────────────────────
const uploadDir = path.join(process.cwd(), 'uploads', 'exam-images');
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
router.post('/', authenticate, roleGuard('admin', 'teacher'), examController.createExam);
router.get('/', authenticate, roleGuard('admin', 'teacher'), examController.getMyExams);

// Global imtihonlar (Admin + Teachers)
router.get('/global', authenticate, roleGuard('admin', 'teacher'), examController.getGlobalExams);
router.post('/global/:id/activate', authenticate, roleGuard('admin', 'teacher'), examController.activateGlobalExam);

router.get('/:id', authenticate, roleGuard('admin', 'teacher'), examController.getExamById);
router.patch('/:id/activate', authenticate, roleGuard('admin', 'teacher'), examController.activateExam);
router.patch('/:id/complete', authenticate, roleGuard('admin', 'teacher'), examController.completeExam);
router.delete('/:id', authenticate, roleGuard('admin', 'teacher'), examController.deleteExam);

// Savollar (qo'lda + Excel import)
router.post('/:id/questions', authenticate, roleGuard('admin', 'teacher'), upload.single('image'), examController.addQuestions);
router.post('/:id/questions/bulk', authenticate, roleGuard('admin', 'teacher'), json({ limit: '5mb' }), examController.bulkAddQuestions);
router.put('/:id/questions/:qId', authenticate, roleGuard('admin', 'teacher'), upload.single('image'), examController.updateQuestion);
router.delete('/:id/questions/:qId', authenticate, roleGuard('admin', 'teacher'), examController.deleteQuestion);

// Natijalar — o'qituvchi uchun
router.get('/:id/results', authenticate, roleGuard('admin', 'teacher'), examController.getExamResults);
router.patch('/:id/grade/:participantId', authenticate, roleGuard('admin', 'teacher'), examGradeController.gradeParticipant);

// ── O'quvchi tomonidan (Public — faqat accessCode kerak) ──
router.get('/join/:code', examController.getExamByCode);
router.post('/join/:code/start', loginLimiter, examController.startExam);
router.post('/join/:code/submit-test', examController.submitTest);
router.post('/join/:code/submit-videos', examController.submitVideos);

export default router;
