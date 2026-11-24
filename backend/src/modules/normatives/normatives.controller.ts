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
      // Normativlar ro'yxati sahifalar to'liq ro'yxatni bir so'rovda oladi (o'quvchi sahifasi 500 so'raydi).
      // Umumiy getPagination 100 ga cheklaydi — 2026 tahriri bilan 100 dan oshadi va ro'yxat jimgina kesilardi.
      const base = getPagination({ ...(req.query as any), limit: '1' });
      const limit = Math.min(1000, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
      const pagination = { page: base.page, limit, skip: (base.page - 1) * limit };
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

      if (validated.data.archived !== undefined && req.user?.role !== 'admin') {
        throw ApiError.forbidden('Normativni arxivlash faqat administrator uchun');
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

  /**
   * GET /api/normatives/export — barcha normativlar JSON fayl sifatida (admin)
   */
  async exportJson(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await normativesService.exportAll();
      const date = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Disposition', `attachment; filename="normativlar-${date}.json"`);
      res.json(data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/normatives/import?dryRun=1 — oldindan ko'rish (hech narsa yozmaydi)
   * POST /api/normatives/import          — bajarish (xato bo'lsa hech narsa yozilmaydi)
   */
  async importJson(req: Request, res: Response, next: NextFunction) {
    try {
      const dryRun = req.query.dryRun === '1' || req.query.dryRun === 'true';
      if (dryRun) {
        const plan = await normativesService.planImport(req.body);
        return res.json({ success: true, data: normativesService.summarize(plan) });
      }
      const result = await normativesService.applyImport(req.body, req.user?.userId);
      const summary = normativesService.summarize(result.plan);
      if (!result.applied) {
        return res.status(400).json({
          success: false,
          error: { message: `Faylda ${summary.errorCount} ta xato bor — hech narsa yozilmadi` },
          data: summary,
        });
      }
      res.json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  }
}

export default new NormativesController();
