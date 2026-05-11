import { Request, Response, NextFunction } from 'express';
import settingsService from './settings.service';

class SettingsController {
  /**
   * GET /api/settings/tutorial-videos — Tutorial videolarni olish (barcha rollar)
   */
  async getTutorialVideos(req: Request, res: Response, next: NextFunction) {
    try {
      const videos = await settingsService.getTutorialVideos();
      res.json({ success: true, data: videos });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/settings/tutorial-videos — Tutorial videolarni yangilash (admin)
   */
  async updateTutorialVideos(req: Request, res: Response, next: NextFunction) {
    try {
      const videos = await settingsService.updateTutorialVideos(req.body);
      res.json({ success: true, data: videos });
    } catch (error) {
      next(error);
    }
  }
}

export default new SettingsController();
