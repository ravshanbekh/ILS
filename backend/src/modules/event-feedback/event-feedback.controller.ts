import { Request, Response, NextFunction } from 'express';
import eventFeedbackService from './event-feedback.service';

function parseFilters(query: Record<string, any>) {
  return {
    groupId: query.groupId || undefined,
    teacherId: query.teacherId || undefined,
    eventId: query.eventId || undefined,
    from: query.from || undefined,
    to: query.to || undefined,
  };
}

class EventFeedbackController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const feedbacks = await eventFeedbackService.getAll(parseFilters(req.query));
      res.json({ success: true, data: feedbacks });
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await eventFeedbackService.getStats(parseFilters(req.query));
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  async aiAnalyze(req: Request, res: Response, next: NextFunction) {
    try {
      const analysis = await eventFeedbackService.aiAnalyze(parseFilters(req.query));
      res.json({ success: true, data: { analysis } });
    } catch (err: any) {
      if (err.message === 'API_KEY_NOT_SET') {
        return res.status(400).json({ success: false, error: 'API_KEY_NOT_SET' });
      }
      if (err.message === 'NO_DATA') {
        return res.status(400).json({ success: false, error: 'NO_DATA' });
      }
      next(err);
    }
  }
}

export default new EventFeedbackController();
