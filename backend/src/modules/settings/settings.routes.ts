import { Router } from 'express';
import settingsController from './settings.controller';
import { authenticate, roleGuard } from '../../shared/middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// GET /api/settings/tutorial-videos — Tutorial videolarni olish (barcha rollar)
router.get('/tutorial-videos', settingsController.getTutorialVideos);

// PUT /api/settings/tutorial-videos — Tutorial videolarni yangilash (faqat admin)
router.put('/tutorial-videos', roleGuard('admin'), settingsController.updateTutorialVideos);

export default router;
