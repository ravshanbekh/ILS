import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/database';


// ─── O'qituvchi: Video bahosi va kommentariya qo'yish ────────────────────────
export const gradeParticipant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, participantId } = req.params;
    const { aiScore, projectScore, aiComment, projectComment } = req.body;
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Auth xatosi' });

    const participant = await prisma.examParticipant.findFirst({
      where: { id: participantId, examId: id },
      include: { exam: true },
    });
    if (!participant) return res.status(404).json({ error: 'Ishtirokchi topilmadi' });
    if (participant.exam.createdById !== userId) {
      return res.status(403).json({ error: 'Bu imtihonni baholash uchun ruxsatingiz yo\'q' });
    }

    // Validate max scores
    const exam = participant.exam;
    if (aiScore !== undefined && aiScore > exam.maxAiScore) {
      return res.status(400).json({ error: `AI ball max ${exam.maxAiScore}` });
    }
    if (projectScore !== undefined && projectScore > exam.maxProjectScore) {
      return res.status(400).json({ error: `Loyiha ball max ${exam.maxProjectScore}` });
    }

    const updatedAiScore = aiScore ?? participant.aiScore;
    const updatedProjectScore = projectScore ?? participant.projectScore;
    const totalScore = (participant.testScore ?? 0) + (updatedAiScore ?? 0) + (updatedProjectScore ?? 0);

    const updated = await prisma.examParticipant.update({
      where: { id: participantId },
      data: {
        aiScore: updatedAiScore,
        projectScore: updatedProjectScore,
        totalScore,
        aiComment: aiComment ?? participant.aiComment,
        projectComment: projectComment ?? participant.projectComment,
        gradedById: userId,
        gradedAt: new Date(),
      },
      include: {
        student: { select: { fullName: true, login: true } },
      },
    });

    res.json({ data: updated });
  } catch (e: any) {
    next(e);
  }
};
