import prisma from '../../config/database';
import fs from 'fs';
import path from 'path';

const MOOD_LABELS: Record<string, string> = {
  yaxshi: '😊 Yaxshi',
  oddiy: '😐 Oddiy',
  yomon: '😟 Yomon',
  javob_bermadi: '📵 Javob bermadi',
};

const TAG_LABELS: Record<string, string> = {
  ustoz_shikoyat: "O'qituvchidan norozi",
  tolov_muammo: "To'lov muammosi",
  motivatsiya_past: 'Motivatsiya past',
  qaytmoqchi: 'Qaytmoqchi (ketmoqchi)',
  vaqt_noqulay: 'Dars vaqti noqulay',
  dastur_murakkab: 'Dastur murakkab',
  juda_hursand: 'Juda hursand',
  tavsiya_qildi: "Do'stlarini olib kelmoqchi",
  kasal: 'Kasal yoki muammo',
  moliyaviy_qiyinchilik: 'Moliyaviy qiyinchilik',
};

class MonitoringService {
  // ─────────────────────────────────────────────────
  //  Yordamchi: Settings'dan API sozlamalarini olish
  // ─────────────────────────────────────────────────
  private getSettings(): { apiKey: string; model: string; centerContext: string } {
    const settingsPath = path.join(__dirname, '../../../data/settings.json');
    let apiKey = '';
    let model = 'gemini-2.5-flash';
    let centerContext = '';
    try {
      if (fs.existsSync(settingsPath)) {
        const raw = fs.readFileSync(settingsPath, 'utf-8');
        const s = JSON.parse(raw);
        apiKey = s.geminiApiKey || '';
        model = s.geminiModel || 'gemini-2.5-flash';
        centerContext = s.centerContext || '';
      }
    } catch {}
    return { apiKey, model, centerContext };
  }

  // ─────────────────────────────────────────────────
  //  CALL CRUD
  // ─────────────────────────────────────────────────

  /**
   * Yangi qo'ng'iroq sessiyasi yaratish
   */
  async createCall(data: {
    groupId: string;
    calledById: string;
    summary?: string;
    callDate?: string;
  }) {
    const group = await prisma.group.findUnique({ where: { id: data.groupId } });
    if (!group) throw new Error('GROUP_NOT_FOUND');

    return prisma.monitoringCall.create({
      data: {
        groupId: data.groupId,
        calledById: data.calledById,
        summary: data.summary || null,
        callDate: data.callDate ? new Date(data.callDate) : new Date(),
      },
      include: {
        group: { select: { id: true, name: true } },
        calledBy: { select: { id: true, fullName: true } },
        notes: true,
      },
    });
  }

  /**
   * Qo'ng'iroqni o'chirish
   */
  async deleteCall(id: string) {
    return prisma.monitoringCall.delete({ where: { id } });
  }

  // ─────────────────────────────────────────────────
  //  NOTE CRUD
  // ─────────────────────────────────────────────────

  /**
   * O'quvchiga fikr qo'shish
   */
  async addNote(data: {
    callId: string;
    studentId: string;
    mood: string;
    note: string;
    tags?: string[];
  }) {
    const call = await prisma.monitoringCall.findUnique({ where: { id: data.callId } });
    if (!call) throw new Error('CALL_NOT_FOUND');

    return prisma.monitoringNote.create({
      data: {
        callId: data.callId,
        studentId: data.studentId,
        mood: data.mood as any,
        note: data.note,
        tags: data.tags || [],
      },
      include: {
        student: { select: { id: true, fullName: true } },
      },
    });
  }

  /**
   * Fikrni yangilash
   */
  async updateNote(id: string, data: {
    mood?: string;
    note?: string;
    tags?: string[];
  }) {
    return prisma.monitoringNote.update({
      where: { id },
      data: {
        ...(data.mood ? { mood: data.mood as any } : {}),
        ...(data.note !== undefined ? { note: data.note } : {}),
        ...(data.tags !== undefined ? { tags: data.tags } : {}),
      },
    });
  }

  /**
   * Fikrni o'chirish
   */
  async deleteNote(id: string) {
    return prisma.monitoringNote.delete({ where: { id } });
  }

  // ─────────────────────────────────────────────────
  //  READ / DASHBOARD
  // ─────────────────────────────────────────────────

  /**
   * Barcha guruhlar ro'yxati + oxirgi qo'ng'iroq holati
   */
  async getGroupsList() {
    const groups = await prisma.group.findMany({
      where: { isActive: true },
      include: {
        teacher: { select: { id: true, fullName: true } },
        groupStudents: {
          where: { student: { isActive: true } },
          select: { id: true },
        },
        monitoringCalls: {
          orderBy: { callDate: 'desc' },
          take: 1,
          include: {
            notes: { select: { mood: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return groups.map((g) => {
      const lastCall = g.monitoringCalls[0] || null;
      const lastCallDate = lastCall?.callDate || null;
      const daysSince = lastCallDate
        ? Math.floor((Date.now() - new Date(lastCallDate).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      // Oxirgi qo'ng'iroqdagi mood taqsimoti
      const moodCounts = { yaxshi: 0, oddiy: 0, yomon: 0, javob_bermadi: 0 };
      if (lastCall) {
        for (const n of lastCall.notes) {
          moodCounts[n.mood as keyof typeof moodCounts]++;
        }
      }

      // Umumiy holat rangi
      let statusColor: 'green' | 'yellow' | 'red' | 'gray' = 'gray';
      if (daysSince === null) statusColor = 'gray';
      else if (daysSince <= 3) statusColor = 'green';
      else if (daysSince <= 7) statusColor = 'yellow';
      else statusColor = 'red';

      return {
        id: g.id,
        name: g.name,
        teacher: g.teacher,
        studentsCount: g.groupStudents.length,
        lastCallDate,
        daysSinceLastCall: daysSince,
        statusColor,
        lastCallMoods: moodCounts,
        totalCalls: g.monitoringCalls.length,
      };
    });
  }

  /**
   * Guruh monitoring dashboard — o'quvchilar + oxirgi fikrlar
   */
  async getGroupDashboard(groupId: string) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        teacher: { select: { id: true, fullName: true } },
        groupStudents: {
          where: { student: { isActive: true } },
          include: {
            student: { select: { id: true, fullName: true, login: true } },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!group) throw new Error('GROUP_NOT_FOUND');

    // Har bir o'quvchi uchun oxirgi monitoring fikrlarini olish
    const studentIds = group.groupStudents.map((gs) => gs.studentId);

    const latestNotes = await prisma.monitoringNote.findMany({
      where: { studentId: { in: studentIds } },
      orderBy: { createdAt: 'desc' },
      include: {
        call: {
          select: { id: true, callDate: true, groupId: true },
        },
      },
    });

    // Har bir student uchun oxirgi note'ni topish
    const latestNoteByStudent: Record<string, any> = {};
    for (const note of latestNotes) {
      if (!latestNoteByStudent[note.studentId]) {
        latestNoteByStudent[note.studentId] = note;
      }
    }

    // Oy uchun mood statistikasi
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyNotes = await prisma.monitoringNote.findMany({
      where: {
        studentId: { in: studentIds },
        createdAt: { gte: startOfMonth },
      },
    });

    const moodStats = { yaxshi: 0, oddiy: 0, yomon: 0, javob_bermadi: 0 };
    for (const n of monthlyNotes) {
      moodStats[n.mood as keyof typeof moodStats]++;
    }

    const students = group.groupStudents.map((gs) => {
      const lastNote = latestNoteByStudent[gs.studentId] || null;
      return {
        id: gs.student.id,
        fullName: gs.student.fullName,
        login: gs.student.login,
        lastNote: lastNote
          ? {
              id: lastNote.id,
              mood: lastNote.mood,
              note: lastNote.note,
              tags: lastNote.tags,
              callDate: lastNote.call.callDate,
              callId: lastNote.call.id,
              createdAt: lastNote.createdAt,
            }
          : null,
      };
    });

    return {
      group: {
        id: group.id,
        name: group.name,
        teacher: group.teacher,
        studentsCount: students.length,
      },
      students,
      moodStats,
      totalMonthlyNotes: monthlyNotes.length,
    };
  }

  /**
   * Guruh qo'ng'iroqlari tarixi (sahifalangan)
   */
  async getGroupCalls(groupId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [calls, total] = await Promise.all([
      prisma.monitoringCall.findMany({
        where: { groupId },
        include: {
          calledBy: { select: { id: true, fullName: true } },
          notes: {
            include: {
              student: { select: { id: true, fullName: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { callDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.monitoringCall.count({ where: { groupId } }),
    ]);

    return { calls, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Bitta o'quvchi bo'yicha barcha fikrlar tarixi (timeline)
   */
  async getStudentTimeline(studentId: string) {
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, fullName: true, login: true },
    });

    if (!student) throw new Error('STUDENT_NOT_FOUND');

    const notes = await prisma.monitoringNote.findMany({
      where: { studentId },
      include: {
        call: {
          select: {
            id: true,
            callDate: true,
            group: { select: { id: true, name: true } },
            calledBy: { select: { id: true, fullName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Mood statistikasi
    const moodStats = { yaxshi: 0, oddiy: 0, yomon: 0, javob_bermadi: 0 };
    for (const n of notes) {
      moodStats[n.mood as keyof typeof moodStats]++;
    }

    // Oxirgi trend (so'nggi 5 ta)
    const recentMoods = notes.slice(0, 5).map((n) => n.mood).reverse();

    return {
      student,
      notes: notes.map((n) => ({
        id: n.id,
        mood: n.mood,
        moodLabel: MOOD_LABELS[n.mood] || n.mood,
        note: n.note,
        tags: n.tags,
        tagLabels: n.tags.map((t) => TAG_LABELS[t] || t),
        callDate: n.call.callDate,
        group: n.call.group,
        calledBy: n.call.calledBy,
        createdAt: n.createdAt,
      })),
      moodStats,
      recentTrend: recentMoods,
      totalNotes: notes.length,
    };
  }

  // ─────────────────────────────────────────────────
  //  AI TAHLIL
  // ─────────────────────────────────────────────────

  /**
   * Guruh bo'yicha AI tahlil
   */
  async analyzeGroupWithAI(groupId: string): Promise<string> {
    const { apiKey, model, centerContext } = this.getSettings();
    if (!apiKey) throw new Error('API_KEY_NOT_SET');

    // Guruh ma'lumotlarini olish
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        teacher: { select: { fullName: true } },
        groupStudents: {
          where: { student: { isActive: true } },
          select: { id: true },
        },
      },
    });
    if (!group) throw new Error('GROUP_NOT_FOUND');

    // Oxirgi 30 kunlik barcha monitoring fikrlarini olish
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const studentIds = group.groupStudents.map((gs) => gs.id);
    // Note: groupStudents ids !== student ids, fix:
    const gsRecords = await prisma.groupStudent.findMany({
      where: { groupId },
      select: { studentId: true },
    });
    const sIds = gsRecords.map((gs) => gs.studentId);

    const notes = await prisma.monitoringNote.findMany({
      where: {
        studentId: { in: sIds },
        createdAt: { gte: since },
      },
      include: {
        student: { select: { fullName: true } },
        call: { select: { callDate: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    if (notes.length === 0) throw new Error('NO_DATA');

    // Statistika
    const moodCounts = { yaxshi: 0, oddiy: 0, yomon: 0, javob_bermadi: 0 };
    const tagCounts: Record<string, number> = {};
    for (const n of notes) {
      moodCounts[n.mood as keyof typeof moodCounts]++;
      for (const t of n.tags) {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      }
    }

    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => `${TAG_LABELS[tag] || tag}: ${count} marta`);

    const notesText = notes
      .map((n) => {
        const date = new Date(n.call.callDate).toLocaleDateString('uz-UZ');
        const tagsStr = n.tags.map((t) => TAG_LABELS[t] || t).join(', ');
        return `- ${n.student.fullName}: [${MOOD_LABELS[n.mood]}] ${n.note}${tagsStr ? ' | Teglar: ' + tagsStr : ''} (${date})`;
      })
      .join('\n');

    const prompt = `Siz o'quv markazlarini rivojlantirish bo'yicha 10 yillik tajribaga ega bo'lgan EdTech mutaxassisisiz. Quyidagi guruh monitoring ma'lumotlarini tahlil qilib, amaliy xulosalar bering.

GURUH: ${group.name}
O'QITUVCHI: ${group.teacher?.fullName || 'Belgilanmagan'}
JAMI O'QUVCHILAR: ${sIds.length} ta
TAHLIL DAVRI: Oxirgi 30 kun

MOOD STATISTIKASI:
- 😊 Yaxshi: ${moodCounts.yaxshi} ta
- 😐 Oddiy: ${moodCounts.oddiy} ta
- 😟 Yomon: ${moodCounts.yomon} ta
- 📵 Javob bermadi: ${moodCounts.javob_bermadi} ta

ENG KO'P UCHRAYDIGAN MUAMMOLAR:
${topTags.length > 0 ? topTags.join('\n') : "Maxsus teglar kiritilmagan"}

BARCHA FIKRLAR RO'YXATI:
${notesText}

=== O'QUV MARKAZI KONTEKSTI ===
${centerContext || "O'quv markazi haqida ma'lumot kiritilmagan."}
===

QAT'IY QOIDALAR:
1. HECH QANDAY MARKDOWN BELGILARINI (*, **, #, \`\`\`) ISHLATMANG! Yulduzcha va xesh belgisi umuman bo'lmasin.
2. Sarlavhalarni faqat bosh harflar va emoji bilan yozing.
3. Fikrlar ro'yxatini yuqorida qaytadan sanab bermang.

Quyidagi bo'limlar bo'yicha tahlil yozing:

🔴 XAVFLI O'QUVCHILAR
(Ketib qolish xavfi yuqori bo'lganlar, ularning ismlari va sabablari)

👨‍🏫 O'QITUVCHI SAMARADORLIGI
(Monitoring ma'lumotlari asosida o'qituvchiga baho, kuchli va zaif tomonlar)

⚡ TEZKOR CHORALAR (Kelgusi 7 kun)
(Darhol amalga oshirish kerak bo'lgan 3-5 ta aniq qadam)

📈 IJOBIY TOMONLAR
(Guruhda yaxshi ketayotgan narsalar)

💡 UZOQ MUDDATLI TAVSIYALAR
(1-3 oylik rivojlanish yo'nalishi)

Barcha matnni o'zbek tilida, tushunarli va amaliy uslubda yozing.

MUHIM CHEKLOV: Har bir bo'lim uchun 3-5 ta aniq gap yeting. Javob tugal va to'liq bo'lsin.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 65536 },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('Gemini monitoring error:', err);
      throw new Error('GEMINI_API_ERROR');
    }

    const data: any = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    let text = parts.map((p: any) => p.text).join('') || '';

    // Markdown tozalash
    text = text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/##+ /g, '').replace(/`/g, '');

    return text.trim();
  }

  /**
   * O'qituvchi bo'yicha AI tahlil (barcha guruhlari bo'yicha)
   */
  async analyzeTeacherWithAI(teacherId: string): Promise<string> {
    const { apiKey, model, centerContext } = this.getSettings();
    if (!apiKey) throw new Error('API_KEY_NOT_SET');

    const teacher = await prisma.user.findUnique({
      where: { id: teacherId },
      select: { fullName: true },
    });
    if (!teacher) throw new Error('TEACHER_NOT_FOUND');

    const groups = await prisma.group.findMany({
      where: { teacherId, isActive: true },
      include: {
        groupStudents: { select: { studentId: true } },
      },
    });

    if (groups.length === 0) throw new Error('NO_DATA');

    const allStudentIds = groups.flatMap((g) => g.groupStudents.map((gs) => gs.studentId));
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const notes = await prisma.monitoringNote.findMany({
      where: {
        studentId: { in: allStudentIds },
        createdAt: { gte: since },
      },
      include: {
        student: { select: { fullName: true } },
        call: {
          select: {
            callDate: true,
            group: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 150,
    });

    if (notes.length === 0) throw new Error('NO_DATA');

    const moodCounts = { yaxshi: 0, oddiy: 0, yomon: 0, javob_bermadi: 0 };
    const tagCounts: Record<string, number> = {};
    for (const n of notes) {
      moodCounts[n.mood as keyof typeof moodCounts]++;
      for (const t of n.tags) tagCounts[t] = (tagCounts[t] || 0) + 1;
    }

    const notesText = notes
      .slice(0, 60)
      .map((n) => {
        const date = new Date(n.call.callDate).toLocaleDateString('uz-UZ');
        const tagsStr = n.tags.map((t) => TAG_LABELS[t] || t).join(', ');
        return `- [${n.call.group.name}] ${n.student.fullName}: [${MOOD_LABELS[n.mood]}] ${n.note}${tagsStr ? ' | ' + tagsStr : ''} (${date})`;
      })
      .join('\n');

    const prompt = `Siz o'quv markazi HR mutaxassisisiz. Quyidagi o'qituvchi haqidagi monitoring ma'lumotlarini tahlil qiling.

O'QITUVCHI: ${teacher.fullName}
GURUHLARI: ${groups.map((g) => g.name).join(', ')}
JAMI O'QUVCHILAR: ${allStudentIds.length} ta
DAVR: Oxirgi 30 kun

MOOD: 😊 ${moodCounts.yaxshi} | 😐 ${moodCounts.oddiy} | 😟 ${moodCounts.yomon} | 📵 ${moodCounts.javob_bermadi}

FIKRLAR:
${notesText}

=== O'QUV MARKAZI KONTEKSTI ===
${centerContext || "Ma'lumot kiritilmagan."}
===

QAT'IY QOIDALAR:
1. HECH QANDAY MARKDOWN BELGILARINI (*, **, #) ISHLATMANG!
2. Sarlavhalarni faqat bosh harflar va emoji bilan yozing.

Quyidagilar bo'yicha tahlil bering:

👨‍🏫 O'QITUVCHI UMUMIY BAHOSI
(O'quvchilar fikridan kelib chiqib 10 balldan baho va asoslama)

💪 KUCHLI TOMONLARI
(O'quvchilar ijobiy qayd etgan jihatlari)

⚠️ YAXSHILASH KERAK BO'LGAN TOMONLAR
(Muammo bo'lgan sohalar va aniq tavsiyalar)

🔴 E'TIBOR BERILISHI KERAK BO'LGAN O'QUVCHILAR
(Qaysi o'quvchilar maxsus e'tiborga muhtoj)

📋 HR TAVSIYALARI
(Ushbu o'qituvchi bilan ishlash bo'yicha amaliy qadamlar)

O'zbek tilida yozing.

MUHIM CHEKLOV: Har bir bo'lim uchun 3-5 ta aniq gap yeting. Javob tugal va to'liq bo'lsin.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
        }),
      }
    );

    if (!response.ok) throw new Error('GEMINI_API_ERROR');

    const data: any = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    let text = parts.map((p: any) => p.text).join('') || '';
    text = text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/##+ /g, '').replace(/`/g, '');
    return text.trim();
  }
}

export const MOOD_LABELS_EXPORT = MOOD_LABELS;
export const TAG_LABELS_EXPORT = TAG_LABELS;
export default new MonitoringService();
