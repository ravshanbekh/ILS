import { Request, Response, NextFunction } from 'express';
import groupEventsService from './group-events.service';
import { createEventSchema } from './group-events.validation';
import { ApiError } from '../../shared/middleware/errorHandler';

function isAdminRole(role?: string) {
  return role === 'admin' || role === 'administrator';
}

class GroupEventsController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createEventSchema.safeParse(req.body);
      if (!validated.success) {
        throw ApiError.badRequest(validated.error.errors.map((e) => e.message).join(', '));
      }
      const event = await groupEventsService.create(validated.data, req.user!.userId, isAdminRole(req.user?.role));
      res.status(201).json({ success: true, data: event });
    } catch (error) {
      next(error);
    }
  }

  async getByGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const groupId = req.query.groupId as string;
      if (!groupId) throw ApiError.badRequest('groupId talab qilinadi');
      const events = await groupEventsService.getByGroup(groupId);
      res.json({ success: true, data: events });
    } catch (error) {
      next(error);
    }
  }

  async getRsvpSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const summary = await groupEventsService.getRsvpSummary(req.params.id);
      res.json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await groupEventsService.delete(req.params.id, req.user!.userId, isAdminRole(req.user?.role));
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
}

export default new GroupEventsController();
