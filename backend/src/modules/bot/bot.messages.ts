import { StudentStats, NotifyCheckPayload } from './bot.types';

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
export function linkedSuccessMessage(studentName: string, groupName?: string): string {
  return (
    `✅ *Muvaffaqiyatli bog'landingiz!*\n\n` +
    `👤 O'quvchi: *${esc(studentName)}*\n` +
    (groupName ? `📚 Guruh: *${esc(groupName)}*\n` : '') +
    `\nYana bir farzandingiz bo'lsa, /login buyrug'ini qayta yuborib uni ham ulashingiz mumkin.\n\n` +
    `Quyidagi tugmalardan foydalaning:`
  );
}

/** Bu farzandga boshqa Telegram akkaunt allaqachon ulangan */
export function alreadyLinkedElsewhereMessage(): string {
  return (
    `⛔ *Bu o'quvchiga allaqachon boshqa Telegram akkaunt ulangan.*\n\n` +
    `Bir vaqtning o'zida faqat bitta kishi kuzatishi mumkin. Agar ulanish sizga tegishli bo'lmasa yoki almashtirmoqchi bo'lsangiz, avval eskisi /unlink buyrug'i orqali uzishi kerak.`
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
  const { student, totalScore, completed, pending, groups, submissions } = stats;

  const groupInfo = groups[0];
  const groupLine = groupInfo
    ? `📚 Guruh: *${esc(groupInfo.group.name)}* | O'rin: *#${groupInfo.rank}/${groupInfo.totalInGroup}*`
    : '';

  // Normativlarni holat bo'yicha ajratish
  const checkedSubs = submissions.filter((s) => s.status === 'checked');
  const pendingSubs = submissions.filter((s) => s.status === 'pending');
  
  // Oxirgi 10 ta natija
  const lastResults = checkedSubs.slice(0, 10).map((s) => {
    const icon = s.result === 'green' ? '✅' : s.result === 'blue' ? '☑️' : '❌';
    return `${icon} *#${s.normative.taskNumber}* ${esc(s.normative.title)} — ${s.score} ball`;
  });

  const greenCount = checkedSubs.filter((s) => s.result === 'green').length;
  const blueCount = checkedSubs.filter((s) => s.result === 'blue').length;
  const redCount = checkedSubs.filter((s) => s.result === 'red').length;

  return (
    `📊 *O'QUVCHI NATIJALARI*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *${esc(student.fullName)}*\n` +
    `${groupLine}\n` +
    `🏆 Jami ball: *${totalScore}* | Daraja: ⭐${stats.level}\n` +
    `\n` +
    `📈 *Natijalar taqsimoti:*\n` +
    `✅ Yashil: ${greenCount} ta\n` +
    `☑️ Ko'k: ${blueCount} ta\n` +
    `❌ Qizil: ${redCount} ta\n` +
    `⏳ Tekshirilmoqda: ${pending} ta\n` +
    `\n` +
    `📋 *So'nggi natijalar:*\n` +
    (lastResults.length > 0 ? lastResults.join('\n') : '_Hozircha natija yo\'q_') +
    (checkedSubs.length > 10 ? `\n\n_...va yana ${checkedSubs.length - 10} ta_` : '')
  );
}

/** Reyting xabari */
export function rankingMessage(stats: StudentStats): string {
  const { student, totalScore, completed, groups } = stats;

  const groupLines = groups
    .map((g) => `📚 *${esc(g.group.name)}*: #${g.rank} (${g.totalInGroup} ta o'quvchi ichida)`)
    .join('\n');

  // Progress bar
  const maxBall = 500;
  const progress = Math.min(Math.round((totalScore / maxBall) * 10), 10);
  const progressBar = '█'.repeat(progress) + '░'.repeat(10 - progress);

  return (
    `📈 *REYTING MA'LUMOTI*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *${esc(student.fullName)}*\n` +
    `🏆 Jami ball: *${totalScore}*\n` +
    `⭐ Daraja: *${stats.level}* (${stats.level * 50} → ${(stats.level + 1) * 50})\n` +
    `\n` +
    `📊 Progress:\n` +
    `[${progressBar}] ${totalScore} ball\n` +
    `\n` +
    `🎯 *Guruhlar bo'yicha o'rin:*\n` +
    (groupLines || '_Guruhga biriktirilmagan_') +
    `\n\n` +
    `📌 Bajarilgan: *${completed}* ta normativ`
  );
}

/** To'liq ma'lumot xabari */
export function fullInfoMessage(stats: StudentStats): string {
  const { student, totalScore, completed, pending, badges } = stats;

  const groupInfo = stats.groups[0];
  const badgeLines = badges.map((b) => b.name).join(' | ');

  return (
    `📋 *TO'LIQ MA'LUMOT*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *${esc(student.fullName)}*\n` +
    `🔑 Login: \`${esc(student.login)}\`\n` +
    (groupInfo
      ? `📚 Guruh: *${esc(groupInfo.group.name)}* | O'rin: #${groupInfo.rank}/${groupInfo.totalInGroup}\n`
      : '') +
    `\n` +
    `🏆 *Ball:* ${totalScore}\n` +
    `⭐ *Daraja:* ${stats.level}\n` +
    `✅ *Bajarilgan:* ${completed} ta\n` +
    `⏳ *Tekshirilmoqda:* ${pending} ta\n` +
    `\n` +
    (badgeLines ? `🎖 *Badgelar:*\n${esc(badgeLines)}\n` : '') +
    `\n_Barcha ma'lumotlar real vaqtda yangilanadi_`
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
  const icon = payload.result === 'green' ? '✅' : payload.result === 'blue' ? '☑️' : '❌';
  const resultText = payload.result === 'green' ? 'Yashil' : payload.result === 'blue' ? "Ko'k" : 'Qizil';

  return (
    `📬 *Yangi natija keldi!*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📋 #${payload.normativeTaskNumber}: ${esc(payload.normativeTitle)}\n` +
    `${icon} Natija: *${resultText}* — ${payload.score} ball\n` +
    (payload.comment ? `💬 Izoh: ${esc(payload.comment)}\n` : '') +
    (payload.totalScore !== undefined ? `\n🏆 Umumiy ball: *${payload.totalScore}*` : '')
  );
}

/** Faolsizlik eslatmasi */
export function inactivityMessage(studentName: string, days: number, completed: number, total: number): string {
  return (
    `⚠️ *Faolsizlik eslatmasi*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *${esc(studentName)}* ${days} kundan beri yangi normativ topshirmagan.\n\n` +
    `📊 Hozirgi holat: *${completed}* ta bajarilgan\n\n` +
    `_Farzandingizni rag'batlantirish vaqti keldi! 💪_`
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
export function lessonGradeParentMessage(data: {
  studentName: string;
  groupName: string;
  date: string;
  homework: 'toliq' | 'qisman' | 'bajarmagan' | 'kelmadi' | null;
  homeworkScore: number | null;
  activityScore: number | null;
  weeklyAvgHomework?: number | null;
  teacherComment?: string | null;
}): string {
  const hwLabel =
    data.homework === 'toliq' ? '✅ To\'liq bajardi'
    : data.homework === 'qisman' ? '🟡 Qisman bajardi'
    : data.homework === 'bajarmagan' ? '❌ Bajarmadi'
    : data.homework === 'kelmadi' ? '🚫 Darsga kelmadi'
    : '—';

  return (
    `📚 *DARS NATIJASI*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *${esc(data.studentName)}*\n` +
    `📆 ${data.date} | 📖 ${esc(data.groupName)}\n\n` +
    `📝 Uy vazifasi: ${hwLabel}` + (data.homeworkScore !== null ? ` — *${data.homeworkScore} ball*` : '') + `\n` +
    (data.activityScore !== null ? `⭐ Faollik: *${data.activityScore}/5*\n` : '') +
    (data.weeklyAvgHomework != null ? `\n📊 Haftalik o'rtacha: *${data.weeklyAvgHomework.toFixed(1)} ball*\n` : '') +
    (data.teacherComment ? `\n💬 O'qituvchi izohi: ${esc(data.teacherComment)}` : '')
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

const HOMEWORK_LABEL: Record<string, string> = {
  toliq: "✅ To'liq bajardi",
  qisman: '🟡 Qisman bajardi',
  bajarmagan: '❌ Bajarmadi',
  kelmadi: '🚫 Darsga kelmadi',
};

/** "📅 Bugun" tugmasi */
export function todayLessonMessage(
  grade: {
    homework: string | null;
    homeworkScore: number | null;
    activityScore: number | null;
    comment: string | null;
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
  return (
    `📅 *BUGUNGI DARS*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📖 ${esc(grade.session.group.name)} | 🗓 ${date}\n\n` +
    `📝 Uy vazifasi: ${grade.homework ? HOMEWORK_LABEL[grade.homework] : '—'}` +
    (grade.homeworkScore !== null ? ` — *${grade.homeworkScore} ball*` : '') +
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
  return (
    `📊 *${title}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    (extra?.studentName ? `👤 *${esc(extra.studentName)}*\n\n` : '') +
    `*Darslar:* ${lesson.totalSessions} ta baholangan\n` +
    `✅ To'liq: ${lesson.full} · 🟡 Qisman: ${lesson.partial} · ❌ Bajarmagan: ${lesson.none} · 🚫 Kelmagan: ${lesson.absent}\n` +
    (lesson.avgHomework !== null ? `📝 Uy vazifasi o'rtachasi: *${lesson.avgHomework.toFixed(1)} ball*\n` : '') +
    (lesson.avgActivity !== null ? `⭐ Faollik o'rtachasi: *${lesson.avgActivity.toFixed(1)}/5*\n` : '') +
    `\n*Normativlar:*\n` +
    `📤 Topshirilgan: *${normative.newSubmissions}* ta\n` +
    `✅ Yashil: ${normative.greenCount} · ☑️ Ko'k: ${normative.blueCount} · ❌ Qizil: ${normative.redCount}\n` +
    `🏆 Qo'shilgan ball: *+${normative.gainedScore}*` +
    (extra?.aiSummary ? `\n\n🤖 *AI Tahlil:*\n${esc(extra.aiSummary)}` : '')
  );
}

/** "🏅 Imtihonlar" tugmasi */
export function examResultsMessage(
  results: Array<{ title: string; maxScore: number; totalScore: number | null; graded: boolean }>
): string {
  if (results.length === 0) {
    return `🏅 *IMTIHON NATIJALARI*\n━━━━━━━━━━━━━━━━━━━━\n_Hozircha rasmiy imtihon natijalari yo'q._`;
  }
  const lines = results.map((r) =>
    r.graded
      ? `📋 *${esc(r.title)}* — ${r.totalScore}/${r.maxScore} ball`
      : `📋 *${esc(r.title)}* — _tekshirilmoqda_`
  );
  return `🏅 *IMTIHON NATIJALARI*\n━━━━━━━━━━━━━━━━━━━━\n${lines.join('\n')}`;
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

