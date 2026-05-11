import { Request, Response, NextFunction } from 'express';
import exportService from './export.service';
import { ApiError } from '../../shared/middleware/errorHandler';

class ExportController {
  /**
   * GET /api/export/group/:id — Guruh natijalarini Excel qilish
   */
  async exportGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const workbook = await exportService.exportGroupResults(req.params.id);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=guruh_${req.params.id}.xlsx`
      );

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/export/overview — Umumiy hisobotni Excel qilish
   */
  async exportOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const workbook = await exportService.exportOverview();

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=umumiy_hisobot.xlsx'
      );

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/export/monthly-report — O'qituvchilar reytingi (oylik)
   */
  async exportMonthlyReport(req: Request, res: Response, next: NextFunction) {
    try {
      const workbook = await exportService.exportMonthlyReport();

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=oqituvchilar_hisoboti.xlsx'
      );

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/export/student/:id — O'quvchi hisobotini Excel qilish
   */
  async exportStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const workbook = await exportService.exportStudent(req.params.id);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=student_${req.params.id}.xlsx`
      );

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      next(error);
    }
  }
}

export default new ExportController();
