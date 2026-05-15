import { Request, Response, NextFunction } from 'express';
import categoriesService from './categories.service';
import { createCategorySchema, updateCategorySchema } from './categories.validation';
import { ApiError } from '../../shared/middleware/errorHandler';

class CategoriesController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await categoriesService.getAll();
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createCategorySchema.safeParse(req.body);
      if (!validated.success) {
        throw ApiError.badRequest(
          validated.error.errors.map((e) => e.message).join(', ')
        );
      }

      const result = await categoriesService.create(validated.data);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateCategorySchema.safeParse(req.body);
      if (!validated.success) {
        throw ApiError.badRequest(
          validated.error.errors.map((e) => e.message).join(', ')
        );
      }

      const result = await categoriesService.update(req.params.id, validated.data);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await categoriesService.delete(req.params.id);
      res.json({ success: true, message: 'Kategoriya o\'chirildi' });
    } catch (error) {
      next(error);
    }
  }
}

export default new CategoriesController();
