import { StudentStats, FreezeItem, NotifyCheckPayload } from './bot.types';

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
    `🔑 /login — O'quvchi logini va paroli orqali bog'lanish\n\n` +
    `*Operator uchun:*\n` +
    `👨‍💼 /operator — Operator sifatida kirish`
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
    `\nQuyidagi tugmalardan foydalaning:`
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
export function unlinkedMessage(): string {
  return `🔗 *Bog'lanish uzildi.*\n\nQayta bog'lanish uchun /login buyrug'ini yuboring.`;
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

/** Haftalik AI hisobot */
export function weeklyReportMessage(
  studentName: string,
  weekStats: { newSubmissions: number; greenCount: number; blueCount: number; redCount: number; gainedScore: number },
  aiSummary: string
): string {
  return (
    `📋 *HAFTALIK HISOBOT*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *${esc(studentName)}*\n\n` +
    `Bu hafta:\n` +
    `📤 Topshirilgan: *${weekStats.newSubmissions}* ta\n` +
    `✅ Yashil: ${weekStats.greenCount} | ☑️ Ko'k: ${weekStats.blueCount} | ❌ Qizil: ${weekStats.redCount}\n` +
    `🏆 Qo'shilgan ball: *+${weekStats.gainedScore}*\n\n` +
    `🤖 *AI Tahlil:*\n${esc(aiSummary)}`
  );
}

/** Yangi muzlatilgan — operator uchun */
export function newFreezeNotificationMessage(freeze: {
  studentName: string;
  groupName: string | null;
  reason: string;
  phone: string | null;
}): string {
  return (
    `❄️ *Yangi muzlatilgan o'quvchi!*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *${esc(freeze.studentName)}*\n` +
    (freeze.groupName ? `📚 Guruh: ${esc(freeze.groupName)}\n` : '') +
    `📌 Sabab: ${esc(freeze.reason)}\n` +
    (freeze.phone ? `📞 Telefon: ${esc(freeze.phone)}\n` : '') +
    `\n_Script olish uchun "❄️ Muzlatilganlar ro'yxati" ni oching_`
  );
}

/** Muzlatilganlar ro'yxati — operator uchun */
export function freezeListMessage(freezes: FreezeItem[], page: number, total: number): string {
  if (freezes.length === 0) {
    return `❄️ *Bu oy muzlatilgan o'quvchilar yo'q.*`;
  }

  const pageSize = 5;
  const start = page * pageSize;
  const items = freezes.slice(start, start + pageSize);

  const lines = items.map((f, i) => {
    const date = new Date(f.frozenAt).toLocaleDateString('uz-UZ');
    return (
      `${start + i + 1}. *${esc(f.studentName)}*\n` +
      `   📚 ${esc(f.groupName || '—')} | 📌 ${esc(f.reason)}\n` +
      `   📞 ${esc(f.phone || 'Telefon yo\'q')} | 🗓 ${date}\n` +
      `   ID: \`${f.id.substring(0, 8)}...\``
    );
  });

  return (
    `❄️ *MUZLATILGANLAR RO'YXATI*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Jami: *${total}* ta\n\n` +
    lines.join('\n\n')
  );
}

/** Operator sifatida kirish so'rash */
export function operatorAskLoginMessage(): string {
  return `👨‍💼 *Operator rejimi*\n\nSizning tizim *loginingizni* kiriting:`;
}

/** Operator sifatida kirish — parol so'rash */
export function operatorAskPasswordMessage(login: string): string {
  return `🔒 Login: *${esc(login)}*\n\nOperator *parolini* kiriting:`;
}

/** Operator — ruxsat yo'q */
export function operatorUnauthorizedMessage(): string {
  return `⛔ *Ruxsat yo'q!*\n\nFaqat Call Operator yoki Admin roli bilan kirish mumkin.`;
}

/** Operator — muvaffaqiyatli kirish */
export function operatorLinkedMessage(name: string): string {
  return (
    `✅ *Operator sifatida kirdingiz!*\n\n` +
    `👤 *${esc(name)}*\n\n` +
    `Quyidagi tugmalardan foydalaning:`
  );
}
