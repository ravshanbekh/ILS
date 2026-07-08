import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware';
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
router.post('/', authenticate, examController.createExam);
router.get('/', authenticate, examController.getMyExams);
router.get('/:id', authenticate, examController.getExamById);
router.patch('/:id/activate', authenticate, examController.activateExam);
router.patch('/:id/complete', authenticate, examController.completeExam);
router.delete('/:id', authenticate, examController.deleteExam);

// Savollar (qo'lda + Excel import)
router.post('/:id/questions', authenticate, upload.single('image'), examController.addQuestions);
router.post('/:id/questions/bulk', authenticate, examController.bulkAddQuestions);
router.put('/:id/questions/:qId', authenticate, upload.single('image'), examController.updateQuestion);
router.delete('/:id/questions/:qId', authenticate, examController.deleteQuestion);

// Natijalar — o'qituvchi uchun
router.get('/:id/results', authenticate, examController.getExamResults);
router.patch('/:id/grade/:participantId', authenticate, examGradeController.gradeParticipant);

// ── O'quvchi tomonidan (Public — faqat accessCode kerak) ──
router.get('/join/:code', examController.getExamByCode);
router.post('/join/:code/start', examController.startExam);
router.post('/join/:code/submit-test', examController.submitTest);
router.post('/join/:code/submit-videos', examController.submitVideos);

export default router;
