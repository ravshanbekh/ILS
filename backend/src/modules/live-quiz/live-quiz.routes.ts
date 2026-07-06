import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware';
import * as quizController from './live-quiz.controller';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// ── Multer (Rasm yuklash) ────────────────────────────────────────────────────
const uploadDir = path.join(process.cwd(), 'uploads', 'quiz-images');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `quiz-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (/image\/(jpeg|jpg|png|webp)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Faqat JPG/PNG/WEBP rasm yuklanadi'));
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// ── O'qituvchi/Admin ──────────────────────────────────────────────────────────
router.post('/', authenticate, quizController.createQuiz);
router.get('/', authenticate, quizController.getMyQuizzes);
router.get('/global', authenticate, quizController.getGlobalQuizzes);
router.get('/:id', authenticate, quizController.getQuizById);
router.patch('/:id', authenticate, quizController.updateQuiz);
router.delete('/:id', authenticate, quizController.deleteQuiz);
router.post('/:id/questions', authenticate, quizController.addQuestions);
router.post('/:id/questions/bulk', authenticate, quizController.bulkAddQuestions);
router.delete('/:id/questions/:qId', authenticate, quizController.deleteQuestion);
router.post('/:id/use', authenticate, quizController.useGlobalQuiz);   // Global quizni nusxalash
router.patch('/:id/start', authenticate, quizController.startQuiz);    // Yangi kod + waiting
router.patch('/:id/launch', authenticate, quizController.launchQuiz);  // 1-savolni yuborish
router.patch('/:id/next', authenticate, quizController.nextQuestion);
router.patch('/:id/finish', authenticate, quizController.finishQuiz);
router.get('/:id/stats', authenticate, quizController.getQuizStats);
router.post('/upload-image', authenticate, upload.single('image'), quizController.uploadQuizImage);

// ── O'yinchi (Public) ─────────────────────────────────────────────────────────
router.get('/join/:code', quizController.getQuizByCode);
router.post('/join/:code/enter', quizController.joinQuiz);
router.post('/answer', quizController.submitAnswer);

export default router;
