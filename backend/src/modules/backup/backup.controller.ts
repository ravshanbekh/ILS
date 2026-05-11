import { Request, Response, NextFunction } from 'express';
import backupService from './backup.service';

class BackupController {
  async downloadBackup(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await backupService.createBackup();
      
      const jsonString = JSON.stringify(data, null, 2);
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=backup_${new Date().toISOString().split('T')[0]}.json`);
      
      res.send(jsonString);
    } catch (error) {
      next(error);
    }
  }

  async restoreBackup(req: Request, res: Response, next: NextFunction) {
    try {
      const backupData = req.body;
      if (!backupData || !backupData.data) {
        return res.status(400).json({ success: false, message: 'Yaroqsiz zaxira ma\'lumotlari' });
      }

      const result = await backupService.restoreBackup(backupData);
      
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
}

export default new BackupController();
