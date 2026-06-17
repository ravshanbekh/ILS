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

  async getGeminiStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const status = await settingsService.getGeminiStatus();
      res.json({ success: true, data: status });
    } catch (error) { next(error); }
  }

  async updateGemini(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await settingsService.updateGeminiConfig(req.body);
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  }

  async testGemini(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await settingsService.testGeminiConfig();
      res.json({ success: result.success, data: result });
    } catch (error) { next(error); }
  }
}

export default new SettingsController();
