import { Request, Response, NextFunction } from 'express';
import normativesService from './normatives.service';
import { createNormativeSchema, updateNormativeSchema, assignNormativeSchema } from './normatives.validation';
import { getPagination } from '../../shared/utils/pagination';
import { ApiError } from '../../shared/middleware/errorHandler';

class NormativesController {
  /**
   * GET /api/normatives
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = getPagination(req.query as any);
      const filters = {
        search: req.query.search as string | undefined,
      };

      const result = await normativesService.getAll(pagination, filters);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/normatives/:id
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const normative = await normativesService.getById(req.params.id);
      res.json({ success: true, data: normative });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/normatives
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createNormativeSchema.safeParse(req.body);
      if (!validated.success) {
        throw ApiError.badRequest(
          validated.error.errors.map((e) => e.message).join(', ')
        );
      }

      const normative = await normativesService.create(validated.data, req.user?.userId);
      res.status(201).json({ success: true, data: normative });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/normatives/:id
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateNormativeSchema.safeParse(req.body);
      if (!validated.success) {
        throw ApiError.badRequest(
          validated.error.errors.map((e) => e.message).join(', ')
        );
      }

      const normative = await normativesService.update(req.params.id, validated.data, req.user?.userId);
      res.json({ success: true, data: normative });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/groups/:id/normatives — Guruhga normativ biriktirish
   */
  async assignToGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = assignNormativeSchema.safeParse(req.body);
      if (!validated.success) {
        throw ApiError.badRequest(
          validated.error.errors.map((e) => e.message).join(', ')
        );
      }

      const result = await normativesService.assignToGroup(
        req.params.id,
        validated.data.normativeIds,
        req.user?.userId
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/normatives/:id
   */
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await normativesService.delete(req.params.id, req.user?.userId);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
}

export default new NormativesController();
