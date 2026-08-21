import { AppealType, AppealStatus } from '@prisma/client';
import ExcelJS from 'exceljs';
import prisma from '../../config/database';
import { ApiError } from '../../shared/middleware/errorHandler';
import { generateText, getAISettings } from '../../shared/utils/ai';
import logger from '../../shared/utils/logger';

const TYPE_LABELS: Record<AppealType, string> = {
  shikoyat: 'Shikoyat',
  taklif: 'Taklif',
  etiroz: "E'tiroz",
  minnatdorchilik: 'Minnatdorchilik',
};

const FORBIDDEN_PROMPT_RULES = `
Qat'iy qoidalar:
1. Hech qachon pul qaytarish, chegirma, bepul dars yoki kompensatsiya va'da qilmang.
2. Hech qachon "o'qituvchini almashtiramiz" yoki "o'qituvchini jazolaymiz" demang.
3. Hech qachon muammo "hal qilindi" deb yozmang — faqat "ko'rib chiqamiz" yoki "tez orada bog'lanamiz" deb yozing.
4. Hamdard, hurmatli va qisqa (3-4 gap) bo'ling. O'zbek tilida yozing.
5. Markdown belgilaridan (*, _, \`) foydalanmang — oddiy matn.`;

class AppealsService {
  /**
   * Ota-onadan kelgan murojaatni saqlash + AI javobini generatsiya qilish.
   */
  async create(data: {
    telegramLinkId: string;
    studentId: string;
    type: AppealType;
    message: string;
  }) {
    const groupStudent = await prisma.groupStudent.findFirst({
      where: { studentId: data.studentId },
      include: { group: { select: { id: true, teacherId: true } } },
      orderBy: { joinedAt: 'desc' },
    });

    const { apiKey } = getAISettings();
    let aiReply: string | null = null;
    let aiCategory: string | null = null;
    let aiUrgency: number | null = null;

    if (apiKey) {
      try {
        const parsed = await this.generateAIResponse(data.type, data.message);
        aiReply = parsed.reply;
        aiCategory = parsed.category;
        aiUrgency = parsed.urgency;
      } catch (err) {
        logger.error('Appeal AI javob generatsiyasida xato:', err);
      }
    }

    const appeal = await prisma.parentAppeal.create({
      data: {
        telegramLinkId: data.telegramLinkId,
        studentId: data.studentId,
        groupId: groupStudent?.group?.id,
        teacherId: groupStudent?.group?.teacherId,
        type: data.type,
        message: data.message,
        aiReply,
        aiCategory,
        aiUrgency,
      },
    });

    return appeal;
  }

  private async generateAIResponse(
    type: AppealType,
    message: string
  ): Promise<{ reply: string; category: string; urgency: number }> {
    const prompt = `Siz IT Live o'quv markazining hamdard mijozlar bilan ishlash bo'yicha yordamchisisiz. Ota-ona quyidagi murojaatni yubordi:

Turi: ${TYPE_LABELS[type]}
Matn: "${message}"
${FORBIDDEN_PROMPT_RULES}

Javobni FAQAT quyidagi JSON formatida qaytaring, boshqa hech narsa yozmang:
{"reply": "ota-onaga yoziladigan javob matni", "category": "murojaat mavzusi 1-2 so'zda (masalan: dars_sifati, tolov, oqituvchi, taklif)", "urgency": 1-5 orasidagi butun son (5 = juda shoshilinch)}`;

    const raw = await generateText(prompt, 500, 0.5);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI JSON qaytarmadi');

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      reply: String(parsed.reply || '').slice(0, 1500),
      category: String(parsed.category || 'boshqa').slice(0, 50),
      urgency: Math.min(5, Math.max(1, parseInt(parsed.urgency, 10) || 3)),
    };
  }

  async getAll(filters: {
    from?: string;
    to?: string;
    type?: AppealType;
    status?: AppealStatus;
    groupId?: string;
    teacherId?: string;
  }) {
    return prisma.parentAppeal.findMany({
      where: {
        type: filters.type,
        status: filters.status,
        groupId: filters.groupId,
        teacherId: filters.teacherId,
        createdAt: {
          gte: filters.from ? new Date(filters.from) : undefined,
          lte: filters.to ? new Date(filters.to) : undefined,
        },
      },
      include: {
        student: { select: { fullName: true } },
        group: { select: { name: true } },
        teacher: { select: { fullName: true } },
        repliedBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    const appeal = await prisma.parentAppeal.findUnique({
      where: { id },
      include: {
        student: { select: { fullName: true } },
        group: { select: { name: true } },
        teacher: { select: { fullName: true } },
        telegramLink: { select: { chatId: true, fullName: true } },
      },
    });
    if (!appeal) throw ApiError.notFound('Murojaat topilmadi');
    return appeal;
  }

  async reply(id: string, adminId: string, replyText: string) {
    await this.getById(id); // mavjudligini tekshirish
    await prisma.parentAppeal.update({
      where: { id },
      data: {
        adminReply: replyText,
        repliedAt: new Date(),
        repliedById: adminId,
        status: 'hal_qilindi',
      },
    });
    return this.getById(id);
  }

  async updateStatus(id: string, status: AppealStatus) {
    await prisma.parentAppeal.update({ where: { id }, data: { status } });
    return this.getById(id);
  }

  /**
   * Murojaatlarni XLSX formatda eksport qilish — AI tahlili uchun (Ravshan so'ragan format)
   */
  async exportToExcel(filters: { from?: string; to?: string }): Promise<ExcelJS.Workbook> {
    const appeals = await this.getAll(filters);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Normativ Tizim';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Murojaatlar');
    sheet.columns = [
      { header: 'Sana', key: 'date', width: 12 },
      { header: 'Vaqt', key: 'time', width: 10 },
      { header: 'Murojaat ID', key: 'id', width: 10 },
      { header: 'Turi', key: 'type', width: 16 },
      { header: "O'quvchi", key: 'student', width: 24 },
      { header: 'Guruh', key: 'group', width: 16 },
      { header: "O'qituvchi", key: 'teacher', width: 20 },
      { header: 'Matn', key: 'message', width: 50 },
      { header: 'AI kategoriya', key: 'category', width: 18 },
      { header: 'Shoshilinchlik', key: 'urgency', width: 14 },
      { header: 'Status', key: 'status', width: 18 },
      { header: 'Javob', key: 'reply', width: 50 },
      { header: 'Javob vaqti', key: 'repliedAt', width: 16 },
      { header: 'Hal qilish soati', key: 'resolutionHours', width: 16 },
    ];
    sheet.getRow(1).font = { bold: true };

    for (const a of appeals) {
      const resolutionHours = a.repliedAt
        ? Math.round(((a.repliedAt.getTime() - a.createdAt.getTime()) / (1000 * 60 * 60)) * 10) / 10
        : null;

      sheet.addRow({
        date: a.createdAt.toLocaleDateString('uz-UZ'),
        time: a.createdAt.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }),
        id: a.id.slice(0, 8),
        type: TYPE_LABELS[a.type],
        student: a.student.fullName,
        group: a.group?.name || '—',
        teacher: a.teacher?.fullName || '—',
        message: a.message,
        category: a.aiCategory || '—',
        urgency: a.aiUrgency || '—',
        status: a.status,
        reply: a.adminReply || '—',
        repliedAt: a.repliedAt ? a.repliedAt.toLocaleString('uz-UZ') : '—',
        resolutionHours: resolutionHours ?? '—',
      });
    }

    return workbook;
  }
}

export default new AppealsService();
