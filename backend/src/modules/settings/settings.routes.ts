import { Router } from 'express';
import settingsController from './settings.controller';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/tutorial-videos', settingsController.getTutorialVideos);
router.put('/tutorial-videos', roleGuard('admin'), settingsController.updateTutorialVideos);

// Gemini AI sozlamalari (admin only)
router.get('/gemini', roleGuard('admin'), settingsController.getGeminiStatus);
router.put('/gemini', roleGuard('admin'), settingsController.updateGemini);
router.post('/gemini/test', roleGuard('admin'), settingsController.testGemini);

export default router;
