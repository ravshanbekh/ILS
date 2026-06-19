import prisma from '../../config/database';

// Human-readable sabab nomlari
export const FREEZE_REASON_LABELS: Record<string, string> = {
  moliyaviy: "Moliyaviy (to'lov)",
  kochib_ketish: "Ko'chib/safarga ketish",
  vaqtincha_toxtatgan: "Vaqtincha to'xtatgan (qaytish rejasi bor)",
  kasallik: 'Kasallik',
  kanikul: 'Lager/Kanikul (vaqtinchalik)',
  boshqa_fan: "Boshqa fan/sertifikatga o'tish",
  kurs_tugadi: "Kurs tugadi, davomi yo'q",
  motivatsiya: 'Motivatsiya/oilaviy sabab',
  ish_tadbir: 'Ishga ketish/oilaviy tadbir',
  universitet: 'Universitet sessiyasi',
  shaxsiy: 'Shaxsiy sabab',
  oqituvchidan_norozi: "O'qituvchidan norozilik",
  boshqa: 'Boshqa',
  sabab_korsatilmagan: "Sabab ko'rsatilmagan",
};

class FreezesService {
  /**
   * O'quvchini muzlatish
   */
  async freezeStudent(data: {
    studentId: string;
    frozenById: string;
    reason: string;
    detailedNote?: string;
    phone?: string;
    startDate?: string;
    filial?: string;
  }) {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // O'quvchi ma'lumotlari (snapshot uchun)
    const student = await prisma.user.findUnique({
      where: { id: data.studentId },
      include: {
        groupStudents: {
          include: {
            group: { include: { teacher: { select: { fullName: true } } } },
          },
          orderBy: { joinedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!student) throw new Error('O\'quvchi topilmadi');

    const latestGroup = student.groupStudents[0];
    const teacherName = latestGroup?.group?.teacher?.fullName || null;
    const groupName = latestGroup?.group?.name || null;

    // Freeze yozuvi yaratish
    const freeze = await prisma.studentFreeze.create({
      data: {
        studentId: data.studentId,
        frozenById: data.frozenById,
        month,
        year,
        reason: data.reason as any,
        detailedNote: data.detailedNote || null,
        phone: data.phone || null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        filial: data.filial || null,
        studentName: student.fullName,
        teacherName,
        groupName,
      },
      include: {
        student: { select: { id: true, fullName: true, login: true } },
        frozenBy: { select: { id: true, fullName: true } },
      },
    });

    return freeze;
  }

  /**
   * Muzlatilganlar ro'yxati (filtrlar bilan)
   */
  async getFrozen(filters?: {
    month?: number;
    year?: number;
    reason?: string;
    teacherName?: string;
    filial?: string;
    search?: string;
  }) {
    const where: any = {};

    if (filters?.month) where.month = filters.month;
    if (filters?.year) where.year = filters.year;
    if (filters?.reason) where.reason = filters.reason;
    if (filters?.filial) where.filial = { contains: filters.filial, mode: 'insensitive' };
    if (filters?.teacherName) {
      where.teacherName = { contains: filters.teacherName, mode: 'insensitive' };
    }
    if (filters?.search) {
      where.studentName = { contains: filters.search, mode: 'insensitive' };
    }

    const freezes = await prisma.studentFreeze.findMany({
      where,
      include: {
        student: { select: { id: true, fullName: true, login: true } },
        frozenBy: { select: { id: true, fullName: true } },
      },
      orderBy: { frozenAt: 'desc' },
    });

    return freezes;
  }

  /**
   * Shu oyda muzlatilgan studentlar ID lari
   * (guruh ko'rsatishdan exclude qilish uchun)
   */
  async getCurrentMonthFrozenIds(): Promise<string[]> {
    const now = new Date();
    const freezes = await prisma.studentFreeze.findMany({
      where: { month: now.getMonth() + 1, year: now.getFullYear() },
      select: { studentId: true },
    });
    return freezes.map((f) => f.studentId);
  }

  /**
   * Hisobot uchun aggregated ma'lumotlar
   */
  async getReportData(month: number, year: number) {
    const freezes = await prisma.studentFreeze.findMany({
      where: { month, year },
    });

    if (freezes.length === 0) {
      return null;
    }

    // O'rtacha o'qigan muddat (oy)
    const durations = freezes
      .filter((f) => f.startDate)
      .map((f) => {
        const start = new Date(f.startDate!);
        const end = new Date(f.frozenAt);
        return (
          (end.getFullYear() - start.getFullYear()) * 12 +
          (end.getMonth() - start.getMonth())
        );
      });

    const avgDuration =
      durations.length > 0
        ? +(durations.reduce((s, d) => s + d, 0) / durations.length).toFixed(2)
        : 0;
    const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
    const minDuration = durations.length > 0 ? Math.min(...durations) : 0;

    // Sabablar statistikasi
    const reasonStats: Record<string, number> = {};
    for (const f of freezes) {
      const label = FREEZE_REASON_LABELS[f.reason] || f.reason;
      reasonStats[label] = (reasonStats[label] || 0) + 1;
    }

    const reasonsArray = Object.entries(reasonStats)
      .map(([reason, count]) => ({
        reason,
        count,
        percent: +((count / freezes.length) * 100).toFixed(1),
      }))
      .sort((a, b) => b.count - a.count);

    // O'qituvchilar statistikasi
    const teacherStats: Record<string, { count: number; durations: number[] }> = {};
    for (const f of freezes) {
      const name = f.teacherName || 'Noma\'lum';
      if (!teacherStats[name]) teacherStats[name] = { count: 0, durations: [] };
      teacherStats[name].count++;
      const d = f.startDate
        ? ((new Date(f.frozenAt).getTime() - new Date(f.startDate).getTime()) /
            (1000 * 60 * 60 * 24 * 30))
        : 0;
      teacherStats[name].durations.push(+d.toFixed(1));
    }

    const teachersArray = Object.entries(teacherStats)
      .map(([teacher, { count, durations }]) => ({
        teacher,
        count,
        avgDuration:
          durations.length > 0
            ? +(durations.reduce((s, d) => s + d, 0) / durations.length).toFixed(2)
            : 0,
        percent: +((count / freezes.length) * 100).toFixed(1),
      }))
      .sort((a, b) => b.count - a.count);

    // O'qigan muddat taqsimoti
    const durationGroups: Record<string, number> = {
      '1 oy': 0,
      '2-3 oy': 0,
      '4-6 oy': 0,
      '7-9 oy': 0,
      '10-12 oy': 0,
      '12+ oy': 0,
    };
    for (const d of durations) {
      if (d <= 1) durationGroups['1 oy']++;
      else if (d <= 3) durationGroups['2-3 oy']++;
      else if (d <= 6) durationGroups['4-6 oy']++;
      else if (d <= 9) durationGroups['7-9 oy']++;
      else if (d <= 12) durationGroups['10-12 oy']++;
      else durationGroups['12+ oy']++;
    }

    const durationArray = Object.entries(durationGroups).map(([label, count]) => ({
      label,
      count,
      percent: freezes.length > 0 ? +((count / freezes.length) * 100).toFixed(1) : 0,
    }));

    return {
      total: freezes.length,
      withDuration: durations.length,
      avgDuration,
      maxDuration,
      minDuration,
      reasons: reasonsArray,
      teachers: teachersArray,
      durationGroups: durationArray,
      rawList: freezes,
    };
  }

  /**
   * O'qituvchilar reytingi (oylik)
   * studentsAtStart = joriy aktiv + shu oyda muzlatilganlar
   */
  async getTeacherRating(month: number, year: number) {
    // Shu oy muzlatilganlar
    const freezes = await prisma.studentFreeze.findMany({
      where: { month, year },
    });

    // Barcha o'qituvchilar
    const teachers = await prisma.user.findMany({
      where: { role: 'teacher', isActive: true },
      select: { id: true, fullName: true },
    });

    const result = await Promise.all(
      teachers.map(async (teacher) => {
        // Joriy aktiv o'quvchilar
        const activeStudents = await prisma.groupStudent.count({
          where: {
            group: { teacherId: teacher.id, isActive: true },
            student: { isActive: true },
          },
        });

        // Shu oy bu o'qituvchidan ketganlar
        const frozenCount = freezes.filter(
          (f) => f.teacherName === teacher.fullName
        ).length;

        const studentsAtStart = activeStudents + frozenCount;
        const dropoutPercent =
          studentsAtStart > 0
            ? +((frozenCount / studentsAtStart) * 100).toFixed(1)
            : 0;

        const teacherFreezes = freezes.filter(
          (f) => f.teacherName === teacher.fullName
        );
        const durations = teacherFreezes
          .filter((f) => f.startDate)
          .map((f) => {
            const s = new Date(f.startDate!);
            const e = new Date(f.frozenAt);
            return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
          });
        const avgDuration =
          durations.length > 0
            ? +(durations.reduce((s, d) => s + d, 0) / durations.length).toFixed(2)
            : 0;

        return {
          teacherId: teacher.id,
          teacher: teacher.fullName,
          activeStudents,
          frozenCount,
          studentsAtStart,
          dropoutPercent,
          avgDuration,
        };
      })
    );

    // Faqat aktiv yoki ketgan o'quvchisi bor o'qituvchilar
    const filtered = result.filter((r) => r.studentsAtStart > 0);
    filtered.sort((a, b) => a.dropoutPercent - b.dropoutPercent);

    return filtered.map((r, i) => ({ rank: i + 1, ...r }));
  }

  /**
   * Muzlatishni bekor qilish (faqat admin)
   */
  async unfreeze(id: string) {
    return prisma.studentFreeze.delete({ where: { id } });
  }

  /**
   * Gemini AI bilan tahlil
   */
  async analyzeWithAI(month: number, year: number): Promise<string> {
    // Settings dan API key olish
    let apiKey = '';
    let model = 'gemini-2.5-flash';
    try {
      const fs = await import('fs');
      const path = await import('path');
      const settingsPath = path.join(__dirname, '../../../data/settings.json');
      if (fs.existsSync(settingsPath)) {
        const raw = fs.readFileSync(settingsPath, 'utf-8');
        const settings = JSON.parse(raw);
        apiKey = settings.geminiApiKey || '';
        model = settings.geminiModel || 'gemini-2.5-flash';
      }
    } catch (e) {
      throw new Error('API_KEY_NOT_SET');
    }

    if (!apiKey) throw new Error('API_KEY_NOT_SET');

    // Ma'lumotlarni tayyorlash
    const reportData = await this.getReportData(month, year);
    if (!reportData) throw new Error('NO_DATA');

    const monthNames = [
      '', 'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
      'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr',
    ];

    const reasonsText = reportData.reasons
      .map((r) => `- ${r.reason}: ${r.count} ta (${r.percent}%)`)
      .join('\n');

    const teachersText = reportData.teachers
      .map((t) => `- ${t.teacher}: ${t.count} ta ketgan, o'rt.muddat: ${t.avgDuration} oy (${t.percent}%)`)
      .join('\n');

    const durationText = reportData.durationGroups
      .filter((d) => d.count > 0)
      .map((d) => `- ${d.label}: ${d.count} ta (${d.percent}%)`)
      .join('\n');

    const prompt = `Sen O'quv markaz uchun ma'lumotlar tahlilchisisisan. Quyidagi oylik statistika asosida chuqur tahlil qil va amaliy maslahatlar ber.

=== ${monthNames[month]} ${year} OYLIK HISOBOTI ===

UMUMIY:
- Jami muzlatilgan (ketgan) o'quvchilar: ${reportData.total} ta
- O'rtacha o'qigan muddat: ${reportData.avgDuration} oy
- Eng uzoq o'qigan: ${reportData.maxDuration} oy | Eng qisqa: ${reportData.minDuration} oy

KETISH SABABLARI (eng ko'pdan kamga):
${reasonsText}

O'QITUVCHILAR BO'YICHA:
${teachersText}

O'QIGAN MUDDAT TAQSIMOTI:
${durationText}

===

Iltimos quyidagilarni tahlil qilib ber:

## 🔍 Asosiy Muammolar
Eng katta muammolarni aniqlab, har birini izohlang.

## 👨‍🏫 O'qituvchilar Tahlili  
Eng yuqori va past ko'rsatkichli o'qituvchilar haqida mulohaza yuriting.

## ⚡ Tezkor Choralar (kelgusi 30 kun)
3-5 ta darhol amalga oshirish mumkin bo'lgan chora-tadbirlar.

## 📋 Uzoq Muddatli Tavsiyalar (3-6 oy)
Tizimli yechimlar.

## 📈 Prognoz
Hozirgi tendentsiya davom etsa nima kutish mumkin.

Javobni o'zbek tilida, aniq va foydali yozing. Markdown formatini ishlating.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Gemini error:', errBody);
      throw new Error('GEMINI_API_ERROR');
    }

    const data: any = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
}

export default new FreezesService();
