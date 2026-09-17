/**
 * Ota-onaga ketadigan xabarlarning MA'NO qismi.
 *
 * Nega alohida fayl: ilgari xabarlar faqat raqam berardi ("5 ball", "4.2
 * o'rtacha") va ota-ona uchta savolga javob topolmasdi — yaxshimi, oldingiga
 * nisbatan qanday, men nima qilay. Bu yerda o'sha uchtasi hisoblanadi.
 *
 * Ataylab AI EMAS, qat'iy mantiq: AI har safar boshqacha yozadi va noto'g'ri
 * narsa aytib qo'yishi mumkin. Ota-onaga ketadigan xabar bashoratli
 * bo'lishi kerak.
 */

export type HomeworkGrade = 'toliq' | 'qisman' | 'bajarmagan' | 'kelmadi' | null | undefined;

export interface LessonContext {
  homework: HomeworkGrade;
  activityScore: number | null;
  /** Shu darsga umuman vazifa berilganmi */
  hasAssignment?: boolean;
  /** Oldingi darsdagi baho — ketma-ket muammoni aniqlash uchun */
  prevHomework?: HomeworkGrade;
  /** Oldingi darsdagi faollik — pasayishni aniqlash uchun */
  prevActivityScore?: number | null;
}

/**
 * Ism (familiya emas).
 *
 * O'zbekcha tartib: "Quvondiqov Umidjon" — familiya oldin, ism keyin.
 * Ota-onaga "Umidjonni maqtang" deyish "Quvondiqovni maqtang" dan tabiiyroq.
 */
export function firstName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fullName;
  return parts[parts.length - 1];
}

/**
 * Sarlavhadan keyingi BIRINCHI qator — holatni bitta jumlada aytadi.
 *
 * Xabarning eng tepasida turadi: ota-ona telefonda birinchi ikki qatorni
 * o'qiydi, raqamlar devorini emas.
 */
export function lessonVerdict(c: LessonContext): string {
  const active = c.activityScore ?? null;

  switch (c.homework) {
    case 'toliq':
      return active !== null && active >= 4
        ? "🌟 Bugun a'lo ishladi"
        : "✅ Uy vazifasi to'liq bajarilgan";

    case 'qisman':
      return active !== null && active >= 4
        ? '🟡 Vazifa qisman, lekin darsda faol edi'
        : '🟡 Uy vazifasi qisman bajarilgan';

    case 'bajarmagan':
      return "❗️ Bugun uy vazifasi bajarilmagan";

    case 'kelmadi':
      // hasAssignment=false bo'lsa 🚫 ning sababi kelmaganlik EMAS bo'lishi
      // mumkin — vazifa umuman berilmagan. Ayblab qo'ymaymiz.
      return c.hasAssignment
        ? '🚫 Bugun darsga kelmadi'
        : "ℹ️ Bu darsga uy vazifasi berilmagan";

    default:
      return '📋 Dars natijasi';
  }
}

/**
 * Tavsiya — FAQAT kerak bo'lganda. Hammasi joyida bo'lsa `null`.
 *
 * Ataylab kamdan-kam: agar har xabarda "shunday qiling" yozilsa, ota-ona
 * ularni o'qimay qo'yadi va haqiqatan muhim tavsiya kelganda ham e'tibor
 * bermaydi. Kamdan-kam bo'lsa — og'irligi saqlanadi.
 */
export function lessonAdvice(c: LessonContext): string | null {
  const prev = c.prevHomework;

  if (c.homework === 'bajarmagan') {
    if (prev === 'bajarmagan' || prev === 'qisman') {
      return "Ketma-ket ikkinchi dars vazifa to'liq emas. Bugun kechqurun 20 daqiqa birga o'tirib ko'ring — odatda shu yetadi.";
    }
    return "Bugun vazifani birga bajarib qo'ying — ertangi darsga tayyor kelsin.";
  }

  if (c.homework === 'qisman' && prev === 'qisman') {
    return "Ikki darsdan beri vazifa yarim qolyapti. Nimasi qiyinligini so'rab ko'ring.";
  }

  // Faollik sezilarli pasaygan bo'lsa — bu vazifadan alohida signal
  if (
    c.activityScore !== null &&
    c.activityScore !== undefined &&
    c.prevActivityScore !== null &&
    c.prevActivityScore !== undefined &&
    c.prevActivityScore - c.activityScore >= 2
  ) {
    return "Darsdagi faolligi pasaydi. Charchaganmi yoki mavzu qiyinmi — so'rab ko'ring.";
  }

  return null;
}

/**
 * Yakuniy iliq qator. Ohang mazmunga MOS bo'ladi.
 *
 * Yomon xabarni yumshatib yubormaydi: yuqoridagi verdict aniq turadi, bu
 * qator faqat ota-onani ayblamasdan oldinga qaratadi.
 */
export function lessonClosing(c: LessonContext, studentFullName: string): string {
  const name = firstName(studentFullName);
  const active = c.activityScore ?? null;

  switch (c.homework) {
    case 'toliq':
      return active !== null && active >= 4
        ? `${name}ni bugun maqtab qo'ying — buni eshitishga arziydi. 👏`
        : `Shu tartibda davom etsa, natija o'zidan ko'rinadi. 👍`;

    case 'qisman':
      return `Kichik qadamlar ham natija — ${name}ni qo'llab turing. 💪`;

    case 'bajarmagan':
      return `Bu tuzatsa bo'ladigan narsa. Ertaga yangi kun. 🌱`;

    case 'kelmadi':
      return c.hasAssignment
        ? `Keyingi darsni o'tkazib yubormasin — mavzu ketma-ket boradi.`
        : `Keyingi darsda ko'rishamiz.`;

    default:
      return `Savollar bo'lsa, o'qituvchiga murojaat qiling.`;
  }
}

/**
 * O'rtacha ballni o'tgan hafta bilan solishtirish.
 *
 * Ota-ona aslida "bolam yaxshilanyaptimi?" degan savolga javob qidiradi.
 * Yolg'iz o'rtacha son bu savolga javob bermaydi.
 *
 * 0.3 chegara ataylab: undan kichik farq o'lchov shovqini, uni "o'smoqda"
 * deb ko'rsatish ota-onani aldash bo'lardi.
 */
export function trendSuffix(now: number | null, prev: number | null): string {
  if (now === null || prev === null) return '';
  const diff = now - prev;
  const prevText = prev.toFixed(1);
  if (diff >= 0.3) return ` _(o'tgan hafta ${prevText} — o'smoqda 📈)_`;
  if (diff <= -0.3) return ` _(o'tgan hafta ${prevText} — pasaymoqda 📉)_`;
  return ` _(o'tgan hafta ${prevText} — barqaror ➡️)_`;
}

/**
 * Normativ natijasiga izoh.
 *
 * Ilgari faqat "Yashil — 20 ball" edi: ota-ona 20 nechtadan ekanini ham,
 * bu yaxshimi yoki yomonmi ham bilmasdi.
 */
export function normativeVerdict(result: 'green' | 'blue' | 'red' | string | null): string {
  switch (result) {
    case 'green':
      return "🌟 A'lo bajarilgan";
    case 'blue':
      return '👍 Yaxshi bajarilgan';
    case 'red':
      return '❗️ Qayta ishlash kerak';
    default:
      return '📋 Natija';
  }
}

/** Normativ natijasiga yakuniy qator */
export function normativeClosing(
  result: 'green' | 'blue' | 'red' | string | null,
  studentFullName: string
): string {
  const name = firstName(studentFullName);
  switch (result) {
    case 'green':
      return `${name}ni tabriklang — bu bosqich a'lo o'tdi. 🎉`;
    case 'blue':
      return `Yaxshi natija. Biroz ko'proq harakat bilan a'lo bo'ladi. 💪`;
    case 'red':
      return `Xafa bo'lmang — qayta topshirish imkoni bor. O'qituvchi izohiga e'tibor bering. 🌱`;
    default:
      return '';
  }
}
