import { Request, Response, NextFunction } from 'express';
import monitoringService from './monitoring.service';

class MonitoringController {
  // ─── CALLS ────────────────────────────────────────
  createCall = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const groupId = req.body.groupId as string;
      const summary = req.body.summary as string | undefined;
      const callDate = req.body.callDate as string | undefined;
      const calledById = req.user?.userId;
      if (!groupId) {
        return res.status(400).json({ success: false, message: 'groupId majburiy' });
      }
      if (!calledById) {
        return res.status(401).json({ success: false, message: 'Foydalanuvchi topilmadi' });
      }
      const call = await monitoringService.createCall({ groupId, calledById, summary, callDate });
      res.status(201).json({ success: true, data: call });
    } catch (e: any) {
      if (e.message === 'GROUP_NOT_FOUND') {
        return res.status(404).json({ success: false, message: 'Guruh topilmadi' });
      }
      next(e);
    }
  };

  deleteCall = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await monitoringService.deleteCall(req.params.callId as string);
      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  };

  // ─── NOTES ────────────────────────────────────────
  addNote = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const callId = req.params.callId as string;
      const studentId = req.body.studentId as string;
      const mood = req.body.mood as string;
      const note = req.body.note as string;
      const tags = req.body.tags as string[] | undefined;
      if (!studentId || !mood || !note) {
        return res.status(400).json({ success: false, message: 'studentId, mood, note majburiy' });
      }
      const result = await monitoringService.addNote({ callId, studentId, mood, note, tags });
      res.status(201).json({ success: true, data: result });
    } catch (e: any) {
      if (e.message === 'CALL_NOT_FOUND') {
        return res.status(404).json({ success: false, message: "Qo'ng'iroq topilmadi" });
      }
      next(e);
    }
  };

  updateNote = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const noteId = req.params.noteId as string;
      const mood = req.body.mood as string | undefined;
      const note = req.body.note as string | undefined;
      const tags = req.body.tags as string[] | undefined;
      const result = await monitoringService.updateNote(noteId, { mood, note, tags });
      res.json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  };

  deleteNote = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await monitoringService.deleteNote(req.params.noteId as string);
      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  };

  // ─── READ / DASHBOARD ─────────────────────────────
  getGroupsList = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const groups = await monitoringService.getGroupsList();
      res.json({ success: true, data: groups });
    } catch (e) {
      next(e);
    }
  };

  getGroupDashboard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await monitoringService.getGroupDashboard(req.params.groupId as string);
      res.json({ success: true, data });
    } catch (e: any) {
      if (e.message === 'GROUP_NOT_FOUND') {
        return res.status(404).json({ success: false, message: 'Guruh topilmadi' });
      }
      next(e);
    }
  };

  getGroupCalls = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const groupId = req.params.groupId as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const data = await monitoringService.getGroupCalls(groupId, page, limit);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  };

  getStudentTimeline = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await monitoringService.getStudentTimeline(req.params.studentId as string);
      res.json({ success: true, data });
    } catch (e: any) {
      if (e.message === 'STUDENT_NOT_FOUND') {
        return res.status(404).json({ success: false, message: "O'quvchi topilmadi" });
      }
      next(e);
    }
  };

  // ─── AI ───────────────────────────────────────────
  analyzeGroup = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const analysis = await monitoringService.analyzeGroupWithAI(req.params.groupId as string);
      res.json({ success: true, data: { analysis } });
    } catch (e: any) {
      if (e.message === 'API_KEY_NOT_SET') {
        return res.status(400).json({ success: false, error: 'API_KEY_NOT_SET', message: 'Gemini API key sozlanmagan' });
      }
      if (e.message === 'NO_DATA') {
        return res.status(400).json({ success: false, error: 'NO_DATA', message: "Bu guruh uchun monitoring ma'lumotlari yo'q" });
      }
      if (e.message === 'GEMINI_API_ERROR') {
        return res.status(502).json({ success: false, error: 'GEMINI_API_ERROR', message: "Gemini API bilan bog'lanib bo'lmadi" });
      }
      next(e);
    }
  };

  analyzeTeacher = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const analysis = await monitoringService.analyzeTeacherWithAI(req.params.teacherId as string);
      res.json({ success: true, data: { analysis } });
    } catch (e: any) {
      if (e.message === 'API_KEY_NOT_SET') {
        return res.status(400).json({ success: false, error: 'API_KEY_NOT_SET', message: 'Gemini API key sozlanmagan' });
      }
      if (e.message === 'NO_DATA') {
        return res.status(400).json({ success: false, error: 'NO_DATA', message: "Bu o'qituvchi uchun monitoring ma'lumotlari yo'q" });
      }
      if (e.message === 'GEMINI_API_ERROR') {
        return res.status(502).json({ success: false, error: 'GEMINI_API_ERROR' });
      }
      next(e);
    }
  };

  generateStudentScript = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const studentId = req.params.id as string;
      const script = await monitoringService.generateStudentScript(studentId);
      res.json({ success: true, data: { script } });
    } catch (e: any) {
      if (e.message === 'API_KEY_NOT_SET') {
        return res.status(400).json({ success: false, error: 'API_KEY_NOT_SET', message: 'Gemini API key sozlanmagan' });
      }
      if (e.message === 'STUDENT_NOT_FOUND') {
        return res.status(404).json({ success: false, error: 'STUDENT_NOT_FOUND', message: "O'quvchi topilmadi" });
      }
      if (e.message === 'GEMINI_API_ERROR') {
        return res.status(502).json({ success: false, error: 'GEMINI_API_ERROR', message: "Gemini API bilan bog'lanib bo'lmadi" });
      }
      next(e);
    }
  };
}

export default new MonitoringController();
