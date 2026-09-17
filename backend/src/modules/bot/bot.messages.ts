import { StudentStats, NotifyCheckPayload } from './bot.types';
import {
  lessonVerdict,
  lessonAdvice,
  lessonClosing,
  trendSuffix,
  normativeVerdict,
  normativeClosing,
  type LessonContext,
} from './bot.tone';

// Helper to escape Markdown special characters
export function esc(text: string | null | undefined): string {
  if (!text) return '';
  return String(text).replace(/([*_`\[])/g, '\\$1');
}

// ============ TELEGRAM XABAR SHABLONLARI ============

/** Salomlashish xabari */
export function welcomeMessage(): string {
  return (
    `🎓 *IT Live Normativ Tizimi*\n\n` +
    `Assalomu alaykum! Bu bot orqali farzandingizning o'qish natijalari, reytingi va normativlar holati haqida ma'lumot olishingiz mumkin.\n\n` +
    `*Botni ishlatish uchun:*\n` +
    `🔑 /login — O'quvchi logini va paroli orqali bog'lanish`
  );
}

/** Login so'rash */
export function askLoginMessage(): string {
  return `🔑 *Bog'lanish*\n\nFarzandingizning *login* ini kiriting (o'quv markazidan berilgan):\n\nMisol: alisher\\_abdusalomov`;
}

/** Parol so'rash */
export function askPasswordMessage(login: string): string {
  return `🔒 Login: *${esc(login)}*\n\nEndi *parolni* kiriting:`;
}

/** Muvaffaqiyatli bog'lanish */
export function linkedSuccessMessage(
  studentName: string,
  groupName?: string,
  parentCount?: number
): string {
  return (
    `✅ *Muvaffaqiyatli bog'landingiz!*\n\n` +
    `👤 O'quvchi: *${esc(studentName)}*\n` +
    (groupName ? `📚 Guruh: *${esc(groupName)}*\n` : '') +
    (parentCount && parentCount > 1
      ? `\n👨‍👩‍👦 Bu farzandni endi *${parentCount} ta* ota-ona kuzatyapti — xabarlar barchangizga boradi.\n`
      : '') +
    `\nYana bir farzandingiz bo'lsa, /login buyrug'ini qayta yuborib uni ham ulashingiz mumkin.\n\n` +
    `Quyidagi tugmalardan foydalaning:`
  );
}

/** Bu farzandga ulanish chegarasi to'lgan (masalan, ota va ona allaqachon ulangan) */
export function parentLimitReachedMessage(limit: number): string {
  return (
    `⛔ *Bu o'quvchiga allaqachon ${limit} ta Telegram akkaunt ulangan.*\n\n` +
    `Bitta farzandni eng ko'pi bilan ${limit} kishi (masalan, ota va ona) kuzatishi mumkin. ` +
    `Joy bo'shatish kerak bo'lsa, ulangan akkauntlardan biri /unlink buyrug'ini yuborsin.`
  );
}

/** Login xato */
export function wrongCredentialsMessage(): string {
  return `❌ *Login yoki parol noto'g'ri!*\n\nQayta urinib ko'ring yoki o'quv markaz administratoriga murojaat qiling.`;
}

/** Foydalanuvchi student emas */
export function notStudentMessage(): string {
  return `⚠️ *Ushbu login student emas!*\n\nFaqat o'quvchilarning logini va paroli bilan bog'lanish mumkin.`;
}

/** O'quvchi natijalari xabari */
export function studentResultsMessage(stats: StudentStats): string {
  const { student, totalScore, pending, groups, submissions } = stats;

  const groupInfo = groups[0];
  const checkedSubs = submissions.filter((s) => s.status === 'checked');

  const greenCount = checkedSubs.filter((s) => s.result === 'green').length;
  const blueCount = checkedSubs.filter((s) => s.result === 'blue').length;
  const redCount = checkedSubs.filter((s) => s.result === 'red').length;

  // Oxirgi 3 ta — ilgari 10 ta edi va telefon ekranida raqamlar devori
  // bo'lib ko'rinardi. Qolganini "To'liq ma'lumot" tugmasi beradi.
  const lastResults = checkedSubs.slice(0, 3).map((s) => {
    const icon = s.result === 'green' ? '✅' : s.result === 'blue' ? '☑️' : '❌';
    const max = (s.normative as { maxScore?: number }).maxScore;
    const score = max != null ? `${s.score}/${max}` : `${s.score}`;
    return `${icon} *#${s.normative.taskNumber}* ${esc(s.normative.title)} — ${score} ball`;
  });

  // Umumiy holatga bitta izoh: ota-ona raqamlardan o'zi xulosa chiqarishi
  // shart emas.
  const total = greenCount + blueCount + redCount;
  let verdict = "📋 Hozircha tekshirilgan natija yo'q";
  if (total > 0) {
    const greenShare = greenCount / total;
    const okShare = (greenCount + blueCount) / total;
    if (greenShare >= 0.7) verdict = "🌟 Natijalar a'lo darajada";
    else if (okShare >= 0.7) verdict = '👍 Natijalar yaxshi';
    else if (redCount > greenCount + blueCount) verdict = '❗️ Natijalarni yaxshilash kerak';
    else verdict = "🟡 Natijalar o'rtacha — yaxshilash imkoni bor";
  }

  return (
    `📊 *NATIJALAR*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `*${verdict}*\n\n` +
    `👤 *${esc(student.fullName)}*\n` +
    (groupInfo
      ? `📚 ${esc(groupInfo.group.name)} | *${groupInfo.rank}-o'rin* (${groupInfo.totalInGroup} o'quvchidan)\n`
      : '') +
    `🏆 Jami ball: *${totalScore}*\n` +
    `\n` +
    `✅ A'lo: ${greenCount} · ☑️ Yaxshi: ${blueCount} · ❌ Qayta ishlash: ${redCount}` +
    (pending > 0 ? ` · ⏳ Tekshiruvda: ${pending}` : '') +
    `\n` +
    (lastResults.length > 0 ? `\n📋 *So'nggi natijalar:*\n` + lastResults.join('\n') : '') +
    (checkedSubs.length > 3
      ? `\n\n_Barchasini ko'rish uchun "📋 To'liq ma'lumot" tugmasini bosing_`
      : '')
  );
}

/** Reyting xabari */
export function rankingMessage(stats: StudentStats): string {
  const { student, totalScore, completed, groups } = stats;

  const groupLines = groups
    .map((g) => `📚 *${esc(g.group.name)}*: ${g.rank}-o'rin (${g.totalInGroup} o'quvchidan)`)
    .join('\n');

  // Progress bar OLIB TASHLANDI.
  //
  // Ilgari `const maxBall = 500` qo'lda yozilgan edi va bar shunga nisbatan
  // chizilardi. 500 hech qayerdan olinmagan son — ya'ni ota-ona SOXTA
  // maqsadni ko'rardi ("76% bajardi" degan taassurot). Haqiqiy maksimal
  // o'quvchiga biriktirilgan normativlarga bog'liq va bu yerda mavjud emas.
  // Yo'q maqsad — soxta maqsaddan yaxshiroq.
  const best = groups.length > 0 ? groups.reduce((a, b) => (a.rank <= b.rank ? a : b)) : null;
  let verdict = "📋 Guruh ma'lumoti yo'q";
  if (best) {
    if (best.rank === 1) verdict = "🥇 Guruhda birinchi o'rinda";
    else if (best.rank <= 3) verdict = '🏅 Guruhda oldingi uchlikda';
    else if (best.rank <= Math.ceil(best.totalInGroup / 2)) verdict = "👍 Guruhning yuqori yarmida";
    else verdict = "💪 Yuqoriga ko'tarilish imkoni bor";
  }

  return (
    `📈 *REYTING*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `*${verdict}*\n\n` +
    `👤 *${esc(student.fullName)}*\n` +
    `🏆 Jami ball: *${totalScore}*\n` +
    `📌 Bajarilgan normativlar: *${completed}* ta\n` +
    `\n` +
    `🎯 *Guruhdagi o'rni:*\n` +
    (groupLines || '_Guruhga biriktirilmagan_')
  );
}

/** To'liq ma'lumot xabari */
export function fullInfoMessage(stats: StudentStats): string {
  const { student, totalScore, completed, pending, badges } = stats;

  const groupInfo = stats.groups[0];
  const badgeLines = badges.map((b) => b.name).join(' | ');

  // LOGIN OLIB TASHLANDI: o'quvchi hisobining logini Telegram tarixida
  // abadiy qolib ketardi. Ota-onaga u kerak emas — natija kerak.
  return (
    `📋 *TO'LIQ MA'LUMOT*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *${esc(student.fullName)}*\n` +
    (groupInfo
      ? `📚 ${esc(groupInfo.group.name)} | *${groupInfo.rank}-o'rin* (${groupInfo.totalInGroup} o'quvchidan)\n`
      : '') +
    `\n` +
    `🏆 Jami ball: *${totalScore}*\n` +
    `✅ Bajarilgan: *${completed}* ta normativ\n` +
    (pending > 0 ? `⏳ Tekshiruvda: *${pending}* ta\n` : '') +
    (badgeLines ? `\n🎖 *Yutuqlar:*\n${esc(badgeLines)}\n` : '')
  );
}

/** Leaderboard xabari */
export function leaderboardMessage(
  groupName: string,
  students: Array<{ rank: number; name: string; score: number; isSelf: boolean }>
): string {
  const medals = ['🥇', '🥈', '🥉'];
  const lines = students.map((s, i) => {
    const medal = i < 3 ? medals[i] : `${i + 1}.`;
    const mark = s.isSelf ? ' ← Siz' : '';
    return `${medal} *${esc(s.name)}* — ${s.score} ball${mark}`;
  });

  return (
    `🏆 *${esc(groupName)} — TOP REYTING*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    lines.join('\n')
  );
}

/** Feedback so'rash */
export function askFeedbackMessage(teacherName?: string): string {
  return (
    `💬 *Fikr bildirish*\n\n` +
    (teacherName ? `O'qituvchi: *${esc(teacherName)}*\n\n` : '') +
    `O'qituvchiga yozmoqchi bo'lgan fikringizni yozing:\n\n` +
    `_Misol: "Farzandim darsda ko'proq e'tibor talab qiladi..."_`
  );
}

/** Feedback yuborildi */
export function feedbackSentMessage(): string {
  return `✅ *Fikringiz o'qituvchiga yuborildi!*\n\nTez orada e'tiborga olinadi.`;
}

/** Sozlamalar xabari */
export function settingsMessage(): string {
  return `⚙️ *BILDIRISHNOMA SOZLAMALARI*\n\nQaysi bildirishnomalarni olishni xohlashingizni tanlang:`;
}

/** Bog'lanish uzildi */
export function unlinkedMessage(hasOtherChildren: boolean = false): string {
  return (
    `🔗 *Bog'lanish uzildi.*\n\n` +
    (hasOtherChildren
      ? `Boshqa farzandlaringiz hali ulangan — "🔀 Farzandlar" tugmasi orqali ko'ring.`
      : `Qayta bog'lanish uchun /login buyrug'ini yuboring.`)
  );
}

// ============ FARZAND ALMASHTIRISH ============

/** "🔀 Farzandlar" tugmasi — bir nechta farzand bo'lsa tanlash, bitta bo'lsa xabar */
export function childSwitcherMessage(count: number): string {
  if (count <= 1) return `👶 Sizda hozircha faqat bitta ulangan farzand bor.`;
  return `👨‍👩‍👧‍👦 *Farzandingizni tanlang:*`;
}

/** Farzand almashtirildi */
export function childSwitchedMessage(studentName: string): string {
  return `✅ Endi *${esc(studentName)}* natijalari ko'rsatilyapti.`;
}

// ============ PROAKTIV XABARLAR ============

/** Topshiriq tekshirilganda ota-onaga */
export function checkNotificationMessage(payload: NotifyCheckPayload): string {
  const resultText =
    payload.result === 'green' ? 'Yashil' : payload.result === 'blue' ? "Ko'k" : 'Qizil';

  // Shkala: ilgari faqat "20 ball" edi va nechtadan ekani ma'lum emasdi.
  const scoreText =
    payload.maxScore != null
      ? `*${payload.score}/${payload.maxScore} ball*`
      : `*${payload.score} ball*`;

  const closing = payload.studentName
    ? normativeClosing(payload.result, payload.studentName)
    : '';

  return (
    `📬 *Yangi natija keldi*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `*${normativeVerdict(payload.result)}*\n\n` +
    `📋 #${payload.normativeTaskNumber}: ${esc(payload.normativeTitle)}\n` +
    `📊 ${resultText} — ${scoreText}\n` +
    (payload.comment ? `\n💬 O'qituvchi izohi: ${esc(payload.comment)}\n` : '') +
    (payload.totalScore !== undefined ? `\n🏆 Jami to'plangan ball: *${payload.totalScore}*` : '') +
    (closing ? `\n\n_${closing}_` : '')
  );
}

/**
 * Faolsizlik eslatmasi.
 *
 * Ilgari bu yerda bitta matn bor edi va u barcha normativini tugatgan
 * o'quvchining ota-onasiga ham "normativ topshirmagan" deb ketardi. Endi qolgan
 * normativ soniga qarab matn tanlanadi; hammasi tugagan holat esa bu yerga
 * umuman kelmaydi — allNormativesDoneMessage ishlatiladi.
 */
export function inactivityMessage(
  studentName: string,
  days: number,
  submitted: number,
  assigned: number,
  checked: number
): string {
  const remaining = Math.max(assigned - submitted, 0);
  const sinceText =
    days < 0
      ? 'hali birorta ham normativ topshirmagan'
      : `${days} kundan beri yangi normativ topshirmagan`;

  const progressLine =
    `📊 Bajarildi: *${submitted}* / *${assigned}* ta` +
    (checked < submitted ? ` (tekshirilgani: ${checked} ta)` : '') +
    `\n`;

  // Finishga ozgina qoldi — bu ogohlantirish emas, turtki
  if (remaining > 0 && remaining <= 2) {
    return (
      `⏳ *Finishgacha ozgina qoldi!*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 *${esc(studentName)}*\n\n` +
      progressLine +
      `🎯 Qolgani: atigi *${remaining}* ta normativ\n\n` +
      `_Bir-ikki kunlik harakat qoldi — farzandingizni qo'llab-quvvatlang! 💪_`
    );
  }

  return (
    `⚠️ *Faolsizlik eslatmasi*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *${esc(studentName)}* ${sinceText}.\n\n` +
    progressLine +
    `🎯 Qolgani: *${remaining}* ta normativ\n\n` +
    `_Farzandingizni rag'batlantirish vaqti keldi! 💪_`
  );
}

/**
 * Barcha normativni topshirib bo'lgan o'quvchi — eslatma emas, tabrik.
 * Har kuni takrorlanmasligi uchun bitta bog'lanishga bir marta yuboriladi.
 */
export function allNormativesDoneMessage(
  studentName: string,
  assigned: number,
  checked: number,
  totalScore?: number
): string {
  return (
    `🎉 *Tabriklaymiz!*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *${esc(studentName)}* o'ziga biriktirilgan *${assigned} ta normativning hammasini* topshirib bo'ldi! 🏁\n\n` +
    `✅ Bajarildi: *${assigned}* / *${assigned}* ta\n` +
    (checked < assigned ? `🔍 Tekshiruvda: *${assigned - checked}* ta\n` : '') +
    (totalScore !== undefined ? `🏆 Umumiy ball: *${totalScore}*\n` : '') +
    `\n_Bu bosqich to'liq yakunlandi. Farzandingizni tabriklashni unutmang! 👏_\n` +
    `_Yangi normativ qo'shilsa, sizga darhol xabar beramiz._`
  );
}


/** Admin sifatida kirish so'rash */
export function adminAskLoginMessage(): string {
  return `🔐 *Admin / Rahbar rejimi*\n\nKunlik AI ta'lim hisobotlarini Telegram orqali olish uchun tizim *loginingizni* kiriting:`;
}

/** Admin sifatida kirish — parol so'rash */
export function adminAskPasswordMessage(login: string): string {
  return `🔒 Login: *${esc(login)}*\n\nAdmin *parolini* kiriting:`;
}

/** Admin — ruxsat yo'q */
export function adminUnauthorizedMessage(): string {
  return `⛔ *Ruxsat yo'q!*\n\nFaqat Admin, Filial rahbari yoki Nazoratchi roli bilan kirish mumkin.`;
}

/** Admin — muvaffaqiyatli kirish */
export function adminLinkedMessage(name: string): string {
  return (
    `✅ *Admin sifatida bog'landingiz!*\n\n` +
    `👤 *${esc(name)}*\n\n` +
    `Endi har kuni 13:00 va 17:00 da batafsil AI ta'lim hisobotlarini olasiz.\n\n` +
    `Qo'lda hisobot olish: /report\n` +
    `Uzish: /unlink`
  );
}

// ============ GURUH CHATI ULASH ============

/** /ulash muvaffaqiyatli — guruh chatiga */
export function chatLinkedMessage(groupName: string): string {
  return (
    `✅ *Ulanish muvaffaqiyatli!*\n\n` +
    `Bu chat *"${esc(groupName)}"* guruhiga bog'landi.\n\n` +
    `Endi har dars kuni soat 20:00 da shu yerga guruhning umumiy natijasi (ismlarsiz) yuboriladi.`
  );
}

/** /ulash — kod noto'g'ri yoki muddati o'tgan */
export function chatLinkInvalidMessage(): string {
  return (
    `❌ *Kod noto'g'ri yoki muddati o'tgan.*\n\n` +
    `Saytda guruh sahifasida yangi kod so'rang va qayta urinib ko'ring:\n` +
    `\`/ulash 123456\``
  );
}

// ============ DARS BAHOLASH XABARLARI ============

/** Ota-onaga — bugungi dars natijasi (yakunlanishdan 1 soat keyin) */
/**
 * Uy vazifasi bahosining ota-onaga ko'rinadigan matni.
 *
 * `kelmadi` ikki xil holatda qo'yiladi: o'quvchi darsga kelmagan bo'lsa YOKI
 * o'sha darsga umuman vazifa berilmagan bo'lsa. Ota-onaga ikkalasini ham
 * "Darsga kelmadi" deb ko'rsatish — noto'g'ri ayblash.
 *
 * `hasAssignment` bizga aniq aytadi: vazifa berilgan bo'lsa, 🚫 ning yagona
 * sababi kelmaganlik. Berilmagan bo'lsa ajrata olmaymiz va shuni ochiq
 * yozamiz — taxminni fakt sifatida ko'rsatgandan ko'ra halolroq.
 */
export function homeworkLabel(
  homework: string | null | undefined,
  hasAssignment?: boolean
): string {
  switch (homework) {
    case 'toliq': return "✅ To'liq bajardi";
    case 'qisman': return '🟡 Qisman bajardi';
    case 'bajarmagan': return '❌ Bajarmadi';
    case 'kelmadi':
      return hasAssignment
        ? '🚫 Darsga kelmadi'
        : "🚫 Darsga kelmadi yoki o'qituvchi vazifa bermagan";
    default: return '—';
  }
}

export function lessonGradeParentMessage(data: {
  studentName: string;
  groupName: string;
  date: string;
  homework: 'toliq' | 'qisman' | 'bajarmagan' | 'kelmadi' | null;
  homeworkScore: number | null;
  activityScore: number | null;
  weeklyAvgHomework?: number | null;
  teacherComment?: string | null;
  /** Shu darsga umuman vazifa berilganmi (LessonGrade.assignmentId mavjudmi) */
  hasAssignment?: boolean;
  /** Qaysi vazifaga baho qo'yilgani — ota-ona buni so'ragan edi */
  homeworkTitle?: string | null;
  /** Dars mavzusi (LessonSession.topic) */
  topic?: string | null;
  /** Trend uchun — o'tgan hafta o'rtachasi */
  prevWeekAvgHomework?: number | null;
  /** Ketma-ket muammoni aniqlash uchun — oldingi dars bahosi */
  prevHomework?: 'toliq' | 'qisman' | 'bajarmagan' | 'kelmadi' | null;
  prevActivityScore?: number | null;
}): string {
  const ctx: LessonContext = {
    homework: data.homework,
    activityScore: data.activityScore,
    hasAssignment: data.hasAssignment,
    prevHomework: data.prevHomework,
    prevActivityScore: data.prevActivityScore,
  };

  const hwLabel = homeworkLabel(data.homework, data.hasAssignment);
  const advice = lessonAdvice(ctx);

  // Mavzu: ilgari ota-ona "5 ball" ni ko'rardi-yu, qaysi vazifa uchun
  // ekanini bilmasdi.
  const topicLine =
    (data.homeworkTitle ? `📖 Vazifa: ${esc(data.homeworkTitle)}\n` : '') +
    (data.topic ? `📘 Mavzu: ${esc(data.topic)}\n` : '');

  return (
    `📚 *DARS NATIJASI*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    // MA'NO tepada, raqamlar pastda: ota-ona telefonda birinchi ikki
    // qatorni o'qiydi, raqamlar devorini emas.
    `*${lessonVerdict(ctx)}*\n\n` +
    `👤 *${esc(data.studentName)}*\n` +
    `📆 ${data.date} | 📚 ${esc(data.groupName)}\n` +
    topicLine +
    `\n` +
    // Ballga SHKALA qo'shildi: ilgari "5 ball" edi va nechtadan ekani
    // hech qayerda aytilmasdi.
    `📝 Uy vazifasi: ${hwLabel}` +
    (data.homeworkScore !== null ? ` — *${data.homeworkScore}/5 ball*` : '') +
    `\n` +
    (data.activityScore !== null ? `⭐ Faollik: *${data.activityScore}/5*\n` : '') +
    (data.weeklyAvgHomework != null
      ? `📊 Haftalik o'rtacha: *${data.weeklyAvgHomework.toFixed(1)}/5*` +
        trendSuffix(data.weeklyAvgHomework, data.prevWeekAvgHomework ?? null) +
        `\n`
      : '') +
    (data.teacherComment ? `\n💬 O'qituvchi izohi: ${esc(data.teacherComment)}\n` : '') +
    (advice ? `\n💡 ${advice}\n` : '') +
    `\n_${lessonClosing(ctx, data.studentName)}_`
  );
}

/** Guruh chatiga — ismsiz yig'ma xabar (20:00) */
export function groupDailySummaryMessage(data: {
  total: number;
  full: number;
  partial: number;
  none: number;
  avgActivity: number | null;
  botLink?: string;
}): string {
  return (
    `📚 *Bugungi dars natijasi*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `${data.total} o'quvchidan: ✅ ${data.full} ta to'liq bajardi · 🟡 ${data.partial} ta qisman · ❌ ${data.none} ta bajarmadi\n` +
    (data.avgActivity !== null ? `Faollik o'rtachasi: *${data.avgActivity.toFixed(1)} / 5*\n\n` : '\n') +
    `👉 Farzandingiz natijasi qiziqmi? Botga /start bosing — barcha natijalar, hisobotlar va o'qituvchi izohlari shu yerda` +
    (data.botLink ? `: ${data.botLink}` : '.')
  );
}

/** Ravshanga — kuniga 20:00 nazorat hisoboti (kim baholamadi) */
export function adminUngradedReportMessage(report: {
  notOpened: Array<{ groupName: string; teacherName: string }>;
  notFinalized: Array<{ groupName: string; teacherName: string }>;
  notConfigured: Array<{ groupName: string }>;
}): string {
  const lines: string[] = [`⚠️ *KUNLIK NAZORAT HISOBOTI*`, `━━━━━━━━━━━━━━━━━━━━`];

  if (report.notOpened.length > 0) {
    lines.push(`\n🔴 *Ochilmagan guruhlar (${report.notOpened.length}):*`);
    for (const g of report.notOpened) lines.push(`• ${esc(g.groupName)} — ${esc(g.teacherName)}`);
  }

  if (report.notFinalized.length > 0) {
    lines.push(`\n🟠 *Yakunlanmagan (vaqt tugab avto-yopilgan) (${report.notFinalized.length}):*`);
    for (const g of report.notFinalized) lines.push(`• ${esc(g.groupName)} — ${esc(g.teacherName)}`);
  }

  if (report.notConfigured.length > 0) {
    lines.push(`\n⚪ *Dars kuni belgilanmagan guruhlar (${report.notConfigured.length}):*`);
    for (const g of report.notConfigured) lines.push(`• ${esc(g.groupName)}`);
  }

  return lines.join('\n');
}

// ============ OTA-ONA BOTI: BUGUN / HAFTA / OY / IMTIHONLAR ============

/** "📅 Bugun" tugmasi */
export function todayLessonMessage(
  grade: {
    homework: string | null;
    homeworkScore: number | null;
    activityScore: number | null;
    comment: string | null;
    assignmentId?: string | null;
    session: { date: Date; group: { name: string } };
  } | null
): string {
  if (!grade) {
    return (
      `📅 *BUGUNGI DARS*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Bugun uchun hali baholash yakunlanmagan.\n\n` +
      `_Dars tugagach, natija shu yerda ko'rinadi._`
    );
  }
  const date = new Date(grade.session.date).toLocaleDateString('uz-UZ');
  const ctx: LessonContext = {
    homework: grade.homework as LessonContext['homework'],
    activityScore: grade.activityScore,
    hasAssignment: grade.assignmentId != null,
  };

  return (
    `📅 *BUGUNGI DARS*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `*${lessonVerdict(ctx)}*\n\n` +
    `📚 ${esc(grade.session.group.name)} | 🗓 ${date}\n\n` +
    `📝 Uy vazifasi: ${homeworkLabel(grade.homework, grade.assignmentId != null)}` +
    (grade.homeworkScore !== null ? ` — *${grade.homeworkScore}/5 ball*` : '') +
    `\n` +
    (grade.activityScore !== null ? `⭐ Faollik: *${grade.activityScore}/5*\n` : '') +
    (grade.comment ? `\n💬 O'qituvchi izohi: ${esc(grade.comment)}` : '')
  );
}

/** "🗓 Hafta" / "📆 Oy" tugmalari — dars baholari + normativ statistikasi birga */
export function lessonPeriodSummaryMessage(
  period: 'hafta' | 'oy',
  lesson: {
    totalSessions: number;
    avgHomework: number | null;
    avgActivity: number | null;
    full: number;
    partial: number;
    none: number;
    absent: number;
  },
  normative: { newSubmissions: number; greenCount: number; blueCount: number; redCount: number; gainedScore: number },
  extra?: { studentName?: string; aiSummary?: string }
): string {
  const title = period === 'hafta' ? 'HAFTALIK HISOBOT' : 'OYLIK HISOBOT';

  // Bitta jumlalik xulosa — raqamlardan OLDIN.
  // Ilgari yagona izoh AI tahlili edi va u eng pastda, 14 ta raqamdan
  // keyin turardi. Ota-ona uni ko'rmasdan xabarni yopardi.
  const done = lesson.full + lesson.partial + lesson.none + lesson.absent;
  let verdict = "📋 Bu davrda baholangan dars yo'q";
  if (done > 0) {
    const fullShare = lesson.full / done;
    if (fullShare >= 0.8) verdict = "🌟 Davr a'lo o'tdi";
    else if (fullShare >= 0.5) verdict = "👍 Davr yaxshi o'tdi";
    else if (lesson.none + lesson.absent > lesson.full) verdict = "❗️ Uy vazifalariga e'tibor kerak";
    else verdict = "🟡 O'rtacha — yaxshilash imkoni bor";
  }

  return (
    `📊 *${title}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `*${verdict}*\n` +
    (extra?.studentName ? `👤 *${esc(extra.studentName)}*\n` : '') +
    // AI tahlili TEPADA — raqamlardan oldin
    (extra?.aiSummary ? `\n🤖 ${esc(extra.aiSummary)}\n` : '') +
    `\n*Darslar:* ${lesson.totalSessions} ta baholangan\n` +
    `✅ To'liq: ${lesson.full} · 🟡 Qisman: ${lesson.partial} · ❌ Bajarmagan: ${lesson.none} · 🚫 Kelmagan: ${lesson.absent}\n` +
    (lesson.avgHomework !== null ? `📝 Uy vazifasi o'rtachasi: *${lesson.avgHomework.toFixed(1)}/5*\n` : '') +
    (lesson.avgActivity !== null ? `⭐ Faollik o'rtachasi: *${lesson.avgActivity.toFixed(1)}/5*\n` : '') +
    `\n*Normativlar:*\n` +
    `📤 Topshirilgan: *${normative.newSubmissions}* ta\n` +
    `✅ A'lo: ${normative.greenCount} · ☑️ Yaxshi: ${normative.blueCount} · ❌ Qayta ishlash: ${normative.redCount}\n` +
    `🏆 Qo'shilgan ball: *+${normative.gainedScore}*`
  );
}

/** "🏅 Imtihonlar" tugmasi */
export function examResultsMessage(
  results: Array<{ title: string; maxScore: number; totalScore: number | null; graded: boolean }>
): string {
  if (results.length === 0) {
    return `🏅 *IMTIHON NATIJALARI*\n━━━━━━━━━━━━━━━━━━━━\n_Hozircha rasmiy imtihon natijalari yo'q._`;
  }
  const rows = results.map((r) => {
    if (!r.graded || r.totalScore === null) {
      return `📋 *${esc(r.title)}* — _tekshirilmoqda_`;
    }
    // Foiz qo'shildi: "20/40" ni ota-ona o'zi baholay olishi uchun
    const pct = r.maxScore > 0 ? Math.round((r.totalScore / r.maxScore) * 100) : 0;
    const mark = pct >= 85 ? '🌟' : pct >= 60 ? '👍' : '❗️';
    return `${mark} *${esc(r.title)}* — ${r.totalScore}/${r.maxScore} ball (${pct}%)`;
  });
  return (
    `🏅 *IMTIHON NATIJALARI*\n━━━━━━━━━━━━━━━━━━━━\n` +
    rows.join('\n') +
    `\n\n_85% dan yuqori — a'lo, 60% dan yuqori — yaxshi._`
  );
}

// ============ DEMO DAY ============

/** Yangi tadbir taklifnomasi */
export function eventInvitationMessage(event: {
  groupName: string;
  title: string;
  eventAt: Date;
  place: string | null;
  description: string | null;
}): string {
  const date = new Date(event.eventAt).toLocaleString('uz-UZ', { dateStyle: 'long', timeStyle: 'short' });
  return (
    `🎉 *TAKLIFNOMA — ${esc(event.title)}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📖 Guruh: ${esc(event.groupName)}\n` +
    `🗓 Sana: *${date}*\n` +
    (event.place ? `📍 Manzil: ${esc(event.place)}\n` : '') +
    (event.description ? `\n${esc(event.description)}\n` : '') +
    `\nFarzandingizning yutuqlarini birga nishonlaymiz! Ishtirok etasizmi?`
  );
}

/** Eslatma (7 kun / 1 kun / 2 soat oldin) */
export function eventReminderMessage(
  event: { groupName: string; title: string; eventAt: Date; place: string | null },
  stage: '7d' | '1d' | '2h'
): string {
  const date = new Date(event.eventAt).toLocaleString('uz-UZ', { dateStyle: 'long', timeStyle: 'short' });
  const when = stage === '7d' ? "1 hafta qoldi" : stage === '1d' ? "ertaga" : "2 soatdan keyin";
  return (
    `⏰ *ESLATMA — ${esc(event.title)}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `${esc(event.groupName)} guruhi tadbirigacha *${when}* qoldi!\n` +
    `🗓 ${date}` +
    (event.place ? `\n📍 ${esc(event.place)}` : '') +
    (stage === '2h'
      ? `\n\n👉 Tadbirda farzandingizning login-parolini bilsangiz, shu yerdan (/login) botga ulaning — barcha natijalar va hisobotlar bir joyda bo'ladi.`
      : '')
  );
}

/** RSVP javobidan keyingi tasdiq */
export function rsvpConfirmedMessage(answer: 'boraman' | 'yoq' | 'aniq_emas'): string {
  if (answer === 'boraman') return '✅ Rahmat! Kelishingizni kutamiz.';
  if (answer === 'yoq') return '📝 Tushunarli, xabar bergani uchun rahmat.';
  return "👌 Yaxshi, keyinroq aniqlashtirasiz.";
}

// ============ MUROJAATLAR ============

const APPEAL_TYPE_LABELS: Record<string, string> = {
  shikoyat: '⚠️ Shikoyat',
  taklif: '💡 Taklif',
  etiroz: "❗ E'tiroz",
  minnatdorchilik: '🙏 Minnatdorchilik',
};

/** Murojaat turi tanlangandan keyin matn so'rash */
export function askAppealMessage(type: string): string {
  return (
    `${APPEAL_TYPE_LABELS[type] || type}\n\n` +
    `Murojaatingiz matnini yozing. Iloji boricha aniq va batafsil yozsangiz, tezroq ko'rib chiqamiz:`
  );
}

/** Murojaat qabul qilingandan keyin — AI javobi bilan */
export function appealReceivedMessage(code: string, aiReply: string | null): string {
  return (
    `✅ *Murojaatingiz qabul qilindi!*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Murojaat raqami: *#${code}*\n\n` +
    (aiReply ? `${esc(aiReply)}\n\n` : '') +
    `_Tez orada rahbariyat tomonidan ko'rib chiqiladi._`
  );
}

/** Rahbarga — shoshilinch murojaat haqida darhol xabar */
export function urgentAppealAdminMessage(data: {
  code: string;
  type: string;
  studentName: string;
  groupName: string | null;
  teacherName: string | null;
  message: string;
  urgency: number;
}): string {
  return (
    `🚨 *SHOSHILINCH MUROJAAT (${data.urgency}/5)*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `#${data.code} | ${APPEAL_TYPE_LABELS[data.type] || data.type}\n` +
    `👤 ${esc(data.studentName)} | 📖 ${esc(data.groupName || '—')} | 👨‍🏫 ${esc(data.teacherName || '—')}\n\n` +
    `💬 ${esc(data.message)}`
  );
}

// ============ GAMIFIKATSIYA — COIN NAZORATI ============

/** O'qituvchi kunlik coin chegarasidan oshganda admin/kassirga bot orqali ogohlantirish */
export function coinLimitExceededMessage(data: {
  teacherName: string;
  todayTotal: number;
  limit: number;
}): string {
  return (
    `⚠️ *COIN CHEGARASI OSHIB KETDI*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👨‍🏫 ${esc(data.teacherName)}\n` +
    `🪙 Bugun berdi: *${data.todayTotal}* (chegara: ${data.limit})\n\n` +
    `Admin panelda "Coin nazorati" bo'limidan tekshiring.`
  );
}

// ============ DEMO DAY FIKR-MULOHAZASI ============

/** Tadbir tugagach — baho so'rash */
export function eventFeedbackRequestMessage(eventTitle: string, groupName: string): string {
  return (
    `🎉 *${esc(eventTitle)}* tugadi!\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `${esc(groupName)} guruhi tadbiridan ko'nglingiz to'ldimi?\n\n` +
    `Fikringiz biz uchun juda muhim — keyingi tadbirni yanada yaxshiroq o'tkazishga yordam beradi.`
  );
}

/** Baho bergandan keyin — izoh so'rash */
export function eventFeedbackAskCommentMessage(): string {
  return `Rahmat! 🙏\n\nQo'shimcha fikr yoki taklifingiz bo'lsa, yozib qoldiring (ixtiyoriy):`;
}

/** Izoh yozilgandan keyin yakuniy tashakkur */
export function eventFeedbackThanksMessage(): string {
  return `✅ Fikringiz uchun rahmat! Buni albatta hisobga olamiz.`;
}

