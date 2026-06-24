import prisma from '../../config/database';
import { notifyOperatorsOnFreeze } from '../bot/bot.notifications';
import { generateText, getAISettings } from '../../shared/utils/ai';

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

    // Telegram orqali operatorlarga xabar yuborish
    notifyOperatorsOnFreeze({
      id: freeze.id,
      studentName: freeze.studentName,
      teacherName: freeze.teacherName,
      groupName: freeze.groupName,
      reason: FREEZE_REASON_LABELS[freeze.reason] || freeze.reason,
      phone: freeze.phone,
    }).catch(() => {});

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
   * O'quvchi uchun operator gaplashish scriptini yaratish
   */
  async generateOperatorScript(id: string): Promise<string> {
    const { apiKey, centerContext } = getAISettings();
    if (!apiKey) throw new Error('API_KEY_NOT_SET');

    // Freeze ma'lumotlarini olish
    const freeze = await prisma.studentFreeze.findUnique({
      where: { id },
    });

    if (!freeze) throw new Error('FREEZE_NOT_FOUND');

    const startStr = freeze.startDate ? new Date(freeze.startDate).toLocaleDateString('uz-UZ') : 'Noma\'lum';
    const freezeStr = new Date(freeze.frozenAt).toLocaleDateString('uz-UZ');
    const reasonLabel = FREEZE_REASON_LABELS[freeze.reason] || freeze.reason;

    const prompt = `Siz o'quv markazida ketgan yoki muzlatilgan o'quvchilarni qaytarish bo'yicha 10 yillik tajribaga ega bo'lgan professional aloqa/sotuv operatorisiz. O'quvchini yoki uning ota-onasini o'quv markaziga qaytarish uchun telefonda gaplashish ssenariysini (muloqot skriptini) so'zma-so'z tuzing.

Tizimdagi o'quvchi ma'lumotlari:
- O'quvchi ismi: ${freeze.studentName || 'Noma\'lum'}
- Telefon: ${freeze.phone || 'Noma\'lum'}
- Guruh: ${freeze.groupName || 'Noma\'lum'}
- O'qituvchi: ${freeze.teacherName || 'Noma\'lum'}
- Filial: ${freeze.filial || 'Bosh filial'}
- O'qish davri: ${startStr} dan ${freezeStr} gacha
- Ketish/Muzlatish sababi: ${reasonLabel}
- Admin izohi: ${freeze.detailedNote || 'Izoh yozilmagan'}

=== O'QUV MARKAZI HAQIDA MA'LUMOTLAR VA QO'SHIMCHA KONTEKST ===
${centerContext || 'O\'quv markazi haqida ma\'lumotlar kiritilmagan.'}
==========================================================

QAT'IY QOIDALAR (Bularga rioya qilmaslik javobni buzadi va xato keltirib chiqaradi):
1. MATNDA MUTLAQO HECH QANDAY MARKDOWN BELGILARINI (*, **, #, \`\`\`, _) ISHLATMANG! Yulduzchalarni umuman yozmang. Sarlavhalarni shunchaki bosh harflar va emojilar bilan oddiy matnda yozing. Matn faqatgina toza plain text (oddiy matn) bo'lishi shart.
2. O'quvchi ma'lumotlarini (ismi, guruhi, o'qituvchisi, o'qish davri va hk.) javob boshida qaytadan ro'yxat shaklida yoki tavsif shaklida yozmang. Bu ma'lumotlarni operator jadvalda ko'rib turibdi, ularni takrorlash Google xavfsizlik va nusxalash cheklovlarini (recitation check) ishga tushirib, javobingizni to'xtatib qo'yadi.
3. Javobingizni hech qanday kirish, salomlashish yoki tushuntirish so'zlari bilan boshlamang. To'g'ridan-to'g'ri "SALOMLASHISH VA KIRISH" sarlavhasidan boshlab, faqat operator gapiradigan gaplarni yozing.
4. "Operator uchun tayyorgarlik va tavsiyalar" degan bo'limlarni yozmang. Bizga faqat to'liq va tayyor muloqot skriptining o'zi kerak.

Quyidagi bo'limlar bo'yicha to'liq, batafsil, so'zma-so'z gaplarni o'zbek tilida yozing:

SALOMLASHISH VA KIRISH
(Operator telefonda aynan nima deyishi kerak - so'zma-so'z gaplar)

MUAMMONI ANIQLASH VA HAMDARDLIK
(O'quvchini yoki ota-onani samimiy tinglash, uning ketish sababini (${reasonLabel}) hisobga olgan holda u bilan gaplashish gaplari)

YECHIM VA KAFOLATLAR TAQDIM ETISH
(Mijozning muammosiga mos yechim, o'quv markazimiz imkoniyatlaridan va kontekstdan kelib chiqib beriladigan takliflar - masalan, chegirmalar, darslarni moslashtirish, yoki boshqa darslar/IELTS)

E'TIROZLAR BILAN ISHLASH
(Mijoz rad etmoqchi bo'lganida yoki boshqa bahona aytganida operator qanday javob berishi kerakligi bo'yicha tayyor gaplar)

KELISHUV VA YAKUNLASH
(Mijozni qayta darsga yoki uchrashuvga jalb qilish, keyingi qadamlar va xayrlashuv)

Har bir bo'limda operator tilidan tayyor so'zma-so'z gaplarni yozing.`;
    return generateText(prompt, 65536);
  }

  /**
   * Gemini AI bilan tahlil
   */
  async analyzeWithAI(month: number, year: number): Promise<string> {
    const { apiKey } = getAISettings();
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

    const rawFreezesText = reportData.rawList
      .map((f: any, i: number) => {
        const startStr = f.startDate ? new Date(f.startDate).toLocaleDateString('uz-UZ') : 'Noma\'lum';
        const freezeStr = new Date(f.frozenAt).toLocaleDateString('uz-UZ');
        const reasonLabel = FREEZE_REASON_LABELS[f.reason] || f.reason;
        return `${i + 1}. O'quvchi: ${f.studentName || 'Noma\'lum'}
   - Guruh: ${f.groupName || 'Noma\'lum'} | O'qituvchi: ${f.teacherName || 'Noma\'lum'}
   - Filial: ${f.filial || 'Bosh filial'}
   - O'qish davri: ${startStr} dan ${freezeStr} gacha
   - Ketish sababi: ${reasonLabel}
   - Batafsil izoh: ${f.detailedNote || 'Izoh yozilmagan'}`;
      })
      .join('\n\n');

    const prompt = `Siz o'quv markazlarini rivojlantirish va biznesini optimallashtirish bo'yicha 10 yillik tajribaga ega bo'lgan professional biznes-konsultant (EdTech eksperti) ekansiz. Quyidagi oylik muzlatilgan (tizimdan ketgan) o'quvchilar ma'lumotlari asosida chuqur tahlil qiling va faoliyatimizni yaxshilash uchun aniq takliflar bering.

Murojaat va hisobotni "Hurmatli IT Live jamoasi va rahbariyati," deb boshlang. ("Hurmatli Sen" yoki boshqa har qanday generic murojaat mutlaqo ishlatilmasin).

=== ${monthNames[month]} ${year} OYLIK HISOBOTI MA'LUMOTLARI ===

UMUMIY STATISTIKA:
- Jami muzlatilgan (ketgan) o'quvchilar soni: ${reportData.total} ta
- O'rtacha o'qigan muddat: ${reportData.avgDuration} oy
- Eng uzoq o'qigan: ${reportData.maxDuration} oy | Eng qisqa: ${reportData.minDuration} oy

KETISH SABABLARI TAQSIMOTI:
${reasonsText}

O'QITUVCHILAR BO'YICHA KETISH KO'RSATKICHLARI:
${teachersText}

MUDDATLAR TAQSIMOTI:
${durationText}

KETGAN O'QUVCHILARNING TO'LIQ VA BATAFSIL RO'YXATI (IZOHLARI BILAN):
${rawFreezesText}

===

Quyidagi tuzilish bo'yicha juda chuqur, tanqidiy va professional tahlil tayyorlang:

1. KIRISH
(Salamlashish va umumiy oylik holatga biznes ko'zi bilan baho berish)

2. 🔍 YASHIRIN MUAMMOLAR (Biz ko'rmayotgan jihatlar)
- Ro'yxatdagi izohlarni, o'qituvchilarni, guruhlarni va muddatlarni solishtirib, tizimli qanday muammolar borligini ochib bering.
- Har bir ketish ortidagi haqiqiy sabablarni tahlil qiling (masalan, onboarding xatolari, o'quv dasturi murakkabligi, moliyaviy muammolarga yondashuv sustligi, o'qituvchining metodikasi va hk).

3. 👨‍🏫 O'QITUVCHILAR VA GURUHLAR TAHLILI
- Qaysi o'qituvchidan eng ko'p ketish bo'lyapti va buning sababi nimada bo'lishi mumkin (izohlarga tayanib)?
- O'qituvchilarning o'quvchini ushlab qolish mahoratiga baho bering.

4. ⚡ TEZKOR BIZNES YECHIMLAR (Kelgusi 30 kun uchun)
- Ushbu ketishlarni to'xtatish va yo'qotilgan daromadni tiklash uchun darhol amalga oshirish kerak bo'lgan 3-5 ta chora-tadbir.
- O'quvchilarni qaytarish (retention) bo'yicha amaliy skriptlar yoki g'oyalar.

5. 📋 UZOQ MUDDATLI TIZIMLI TAVSIYALAR (3-6 oy)
- IT Live o'quv markazini yanada kuchaytirish, mijozlar sodiqligini (LTV) oshirish uchun biznes jarayonlarni (LMS, KPI, o'qituvchilarni nazorat qilish, sifat nazorati) qanday o'zgartirish kerak?

6. 📈 BIZNES PROGNOZI
- Agar bu muammolar hal etilmasa, kelgusi oylarda o'quv markazi daromadi va brend obro'siga ta'siri qanday bo'ladi?

Javobni o'zbek tilida, juda chiroyli, tushunarli, professional va biznes tilida yozing. Bo'limlar orasida bo'sh satr qoldiring.
HECH QANDAY MARKDOWN BELGILARINI (*, **, #) ISHLATMANG! Sarlavhalarni faqat bosh harflar va emoji bilan yozing.
MUHIM CHEKLOV: Har bir bo'lim uchun 3-5 ta aniq gap yeting. Javob tugal va to'liq bo'lsin.`;

    return generateText(prompt, 65536, 0.7, false);
  }
}

export default new FreezesService();
