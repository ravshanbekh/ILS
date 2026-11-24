/**
 * Kurator moduli — uchdan-uchgacha sinov (LOKAL baza).
 * Kirish va ko'lam (kurator — o'ziniki, nazorat ruxsati — hammasi, boshqalar 403),
 * demo'dan keyin o'quvchi yaratish, dastur, asosiy guruh ko'rsatkichlari,
 * 30 daqiqalik jadval, onlayn yozilish (sig'im 8, kuniga 1), davomat → dastur,
 * qo'lda belgilash, profil kartasi, biriktirish, muddat tugashi.
 * Fixture'lar "cue2e" belgisi bilan, oxirida o'chiriladi (dastur o'chirilmaydi).
 *
 * Ishlatish (backend papkasidan):  npm run e2e:curator
 */
import http from 'http';
import {
  addMonthsUtc,
  formatCuratorSlot,
  parseDateOnly,
  programTimeline,
  toDateOnlyString,
  todayInCenter,
} from '../src/shared/constants/curator';

const PORT = Number(process.env.CU_E2E_PORT || 5096);
const BASE = `http://127.0.0.1:${PORT}`;
let pass = 0;
let failed = 0;
function check(name: string, cond: unknown, extra = '') {
  if (cond) {
    pass++;
    console.log(`  OK   ${name}${extra ? ' — ' + extra : ''}`);
  } else {
    failed++;
    console.log(`  XATO ${name}${extra ? ' — ' + extra : ''}`);
  }
}

/** Ertangi ish kuni (yakshanba bo'lsa — dushanba) */
function nextWorkDay(): string {
  const d = parseDateOnly(todayInCenter())!;
  d.setUTCDate(d.getUTCDate() + 1);
  if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
  return toDateOnlyString(d);
}
function nextSunday(): string {
  const d = parseDateOnly(todayInCenter())!;
  do d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() !== 0);
  return toDateOnlyString(d);
}

async function main() {
  // ── sof funksiyalar ──
  console.log('\n0) Yordamchi funksiyalar');
  check('formatCuratorSlot(630) = 10:30–11:00', formatCuratorSlot(630) === '10:30–11:00');
  check('addMonthsUtc: 31-dek + 2 oy = 28-fev', toDateOnlyString(addMonthsUtc(parseDateOnly('2026-12-31')!, 2)) === '2027-02-28');
  const tl = programTimeline(parseDateOnly('2026-01-01')!, parseDateOnly('2026-03-01')!, 24, '2026-01-31');
  check('programTimeline: 31-kun, reja bo\'yicha ~12 mashg\'ulot', tl.day === 31 && tl.totalDays === 59 && tl.expectedLessons === 12, JSON.stringify(tl));

  const { default: express } = await import('express');
  const jwt = (await import('jsonwebtoken')).default;
  const { default: prisma } = await import('../src/config/database');
  const { env } = await import('../src/config/env');
  const { default: routes } = await import('../src/modules/curator/curator.routes');
  const { errorHandler } = await import('../src/shared/middleware/errorHandler');
  const { ensureProgram } = await import('../src/modules/curator/curator.service');

  const app = express();
  app.use(express.json());
  app.use('/api/curator', routes);
  app.use(errorHandler);
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(PORT, r));

  const tag = `cue2e${Date.now().toString(36)}`;
  const ids = { users: [] as string[], groups: [] as string[], norms: [] as string[] };
  const tokenOf = (u: { id: string; role: string; login: string }) => jwt.sign({ userId: u.id, role: u.role, login: u.login, tv: 0 }, env.JWT_SECRET);
  const mk = async (role: any, name: string) => {
    const u = await prisma.user.create({ data: { fullName: name, login: `${tag}_${name.toLowerCase().replace(/\W+/g, '')}`, passwordHash: 'x', role } });
    ids.users.push(u.id);
    return { ...u, token: tokenOf(u) };
  };
  const call = async (token: string | null, method: string, path: string, body?: unknown) => {
    const r = await fetch(`${BASE}/api/curator${path}`, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, json: (await r.json().catch(() => null)) as any };
  };
  const today = todayInCenter();
  const tomorrow = nextWorkDay();

  let lessonTitleBackup: { id: string; title: string } | null = null;
  try {
    await ensureProgram();
    const admin = await mk('admin', 'Admin');
    const k1 = await mk('kurator', 'Kurator Bir');
    const k2 = await mk('kurator', 'Kurator Ikki');
    const admr = await mk('administrator', 'Resepshn');
    const asst = await mk('assistant', 'Assistent');
    const teacher = await mk('teacher', 'Asosiy Ustoz');
    const teacher2 = await mk('teacher', 'Boshqa Ustoz');
    const loner = await mk('student', 'Kuratorsiz Bola');
    await prisma.userPermission.create({ data: { userId: admr.id, permission: 'curator_oversight' } });

    console.log('\n1) Kirish');
    check('tokensiz → 401', (await call(null, 'GET', '/students')).status === 401);
    check("o'quvchi → 403", (await call(loner.token, 'GET', '/students')).status === 403);
    check('o\'qituvchi → 403', (await call(teacher.token, 'GET', '/students')).status === 403);
    check('ruxsatsiz assistent → 403', (await call(asst.token, 'GET', '/students')).status === 403);
    const kl = await call(k1.token, 'GET', '/students');
    check('kurator → 200, ko\'lam "own"', kl.status === 200 && kl.json.data.scope === 'own');
    const al = await call(admr.token, 'GET', '/students');
    check('curator_oversight ruxsatli administrator → "all"', al.status === 200 && al.json.data.scope === 'all');

    console.log('\n2) Dastur');
    const prog = await call(k1.token, 'GET', '/program');
    const lessons = prog.json.data.lessons;
    check("24 mashg'ulot, 8 hafta, kurator tahrirlay olmaydi", lessons.length >= 24 && lessons[0].n === 1 && prog.json.data.canEdit === false, `${lessons.length}`);
    check("mashg'ulot mazmuni (qadamlar, vazifa, vosita)", Array.isArray(lessons[0].content.steps) && lessons[0].content.steps.length > 0 && !!lessons[0].content.homework && lessons[0].content.tools.length > 0);
    check('kurator PATCH /program → 403', (await call(k1.token, 'PATCH', `/program/${lessons[0].id}`, { title: 'x' })).status === 403);
    lessonTitleBackup = { id: lessons[0].id, title: lessons[0].title };
    const pa = await call(admin.token, 'PATCH', `/program/${lessons[0].id}`, { title: `${lessons[0].title} (tahrir)` });
    check('admin dasturni tahrirlaydi', pa.status === 200 && pa.json.data.title.endsWith('(tahrir)'));
    check('takroriy raqam → 409', (await call(admin.token, 'PATCH', `/program/${lessons[1].id}`, { n: 1 })).status === 409);
    const [L1, L2, L3] = lessons;

    console.log("\n3) Demo'dan keyin o'quvchi qo'shish");
    const sug = await call(k1.token, 'GET', '/students/suggest-login');
    check('login taklifi: student + 4 raqam, parol 8 belgi', /^student\d{4}$/.test(sug.json.data.login) && sug.json.data.password.length === 8);
    const create = (token: string, name: string, extra: any = {}) =>
      call(token, 'POST', '/students', { fullName: name, login: `${tag}_${name.toLowerCase().replace(/\W+/g, '')}`, password: 'parol123', demoDate: today, demoNote: 'Robototexnikaga qiziqadi', ...extra });
    const c1 = await create(k1.token, 'Demo Bola Bir', { curatorId: k2.id }); // kurator boshqa kuratorni yozsa ham — o'ziniki bo'ladi
    check("kurator o'quvchi yaratadi, parol bir marta qaytadi", c1.status === 200 && c1.json.data.credentials.password === 'parol123', String(c1.status));
    const s1 = { id: c1.json.data.student.id as string, login: c1.json.data.student.login as string, role: 'student' };
    ids.users.push(s1.id);
    const e1 = c1.json.data.id as string;
    const row1 = await prisma.curatorStudent.findUnique({ where: { id: e1 } });
    check("yozuv: o'z kuratori, muddat +2 oy", row1?.curatorId === k1.id && toDateOnlyString(row1!.endDate) === toDateOnlyString(addMonthsUtc(parseDateOnly(today)!, 2)));
    const u1 = await prisma.user.findUnique({ where: { id: s1.id }, include: { groupStudents: true } });
    check("o'quvchi roli, guruhsiz, parol hash", u1?.role === 'student' && u1.groupStudents.length === 0 && u1.passwordHash !== 'parol123');
    check('band login → 409', (await create(k1.token, 'Demo Bola Bir')).status === 409);
    check('kelajakdagi demo sanasi → 400', (await create(k1.token, 'Kelajak Bola', { demoDate: tomorrow })).status === 400);
    check('qisqa parol → 400', (await create(k1.token, 'Qisqa Parol', { password: '123' })).status === 400);
    const c2 = await create(k1.token, 'Demo Bola Ikki');
    const c3 = await create(k1.token, 'Demo Bola Uch');
    const c4 = await create(k2.token, 'Boshqa Kurator Bolasi');
    const s2 = { id: c2.json.data.student.id, login: c2.json.data.student.login, role: 'student' };
    const s3 = { id: c3.json.data.student.id, login: c3.json.data.student.login, role: 'student' };
    const s4 = { id: c4.json.data.student.id, login: c4.json.data.student.login, role: 'student' };
    ids.users.push(s2.id, s3.id, s4.id);
    const [t1, t2, t3, t4] = [s1, s2, s3, s4].map(tokenOf);
    const e2 = c2.json.data.id, e3 = c3.json.data.id, e4 = c4.json.data.id;

    console.log("\n4) Ko'lam");
    const k1list = (await call(k1.token, 'GET', '/students')).json.data.items;
    check('kurator faqat o\'z 3 o\'quvchisini ko\'radi', k1list.length === 3 && k1list.every((x: any) => x.curator.id === k1.id));
    check("boshqa kuratorning o'quvchisi → 403", (await call(k2.token, 'GET', `/students/${e1}`)).status === 403);
    check("boshqa kurator PATCH → 403", (await call(k2.token, 'PATCH', `/students/${e1}`, { status: 'toxtatildi' })).status === 403);
    const allL = (await call(admr.token, 'GET', `/students?curatorId=${k2.id}`)).json.data.items;
    check('nazoratchi kurator filtri bilan', allL.length === 1 && allL[0].id === e4);
    check("guruhsizlar filtri: 3 ta", (await call(k1.token, 'GET', '/students?ungrouped=1')).json.data.items.length === 3);
    check("kurator boshqa kuratorni o'zgartira olmaydi", (await call(k1.token, 'PATCH', `/students/${e1}`, { curatorId: k2.id })).status === 403);

    console.log('\n5) Asosiy guruh ko\'rsatkichlari');
    const g = await prisma.group.create({ data: { name: `${tag}-F1`, teacherId: teacher.id } });
    ids.groups.push(g.id);
    await prisma.groupStudent.create({ data: { groupId: g.id, studentId: s1.id } });
    const d0 = parseDateOnly(today)!;
    const dPrev = new Date(d0);
    dPrev.setUTCDate(dPrev.getUTCDate() - 1);
    const sesA = await prisma.lessonSession.create({ data: { groupId: g.id, teacherId: teacher.id, date: d0, deadlineAt: new Date(), topic: 'Klaviatura' } });
    const sesOld = await prisma.lessonSession.create({ data: { groupId: g.id, teacherId: teacher.id, date: dPrev, deadlineAt: new Date(), topic: "Qo'shilishdan oldin" } });
    await prisma.lessonGrade.create({ data: { sessionId: sesA.id, studentId: s1.id, homework: 'toliq', homeworkScore: 5, activityScore: 4 } });
    await prisma.lessonGrade.create({ data: { sessionId: sesOld.id, studentId: s1.id, homework: 'kelmadi' } });
    const nm = await prisma.normative.create({ data: { taskNumber: 9601, title: `${tag} Tez yozish` } });
    ids.norms.push(nm.id);
    await prisma.groupNormative.create({ data: { groupId: g.id, normativeId: nm.id } });
    await prisma.submission.create({ data: { studentId: s1.id, normativeId: nm.id, youtubeUrl: 'https://youtu.be/isbot', status: 'checked', result: 'green', score: 40 } });
    const det = (await call(k1.token, 'GET', `/students/${e1}`)).json.data;
    check('asosiy guruh va ustozi', det.main.groups[0]?.name === g.name && det.main.groups[0]?.teacherName === 'Asosiy Ustoz');
    check("qo'shilishdan oldingi dars hisoblanmaydi; davomat 100%, uy vazifasi 5, faollik 4", det.main.lessons.total === 1 && det.main.lessons.attendancePct === 100 && det.main.lessons.avgHomework === 5 && det.main.lessons.avgActivity === 4, JSON.stringify(det.main.lessons));
    check('normativ: 1/1 qo\'lladi, isbot havolasi', det.main.normatives.g === 1 && det.main.normatives.donePct === 100 && det.main.normativeList[0]?.url === 'https://youtu.be/isbot');
    check("so'nggi darslar ro'yxati", det.main.recentLessons.length === 1 && det.main.recentLessons[0].topic === 'Klaviatura' && det.main.recentLessons[0].homeworkScore === 5);
    check("guruhsizlar filtri endi 2 ta", (await call(k1.token, 'GET', '/students?ungrouped=1')).json.data.items.length === 2);

    console.log('\n6) Jadval (30 daqiqa, 8 kishi)');
    check("15 daqiqalik qadam → 400", (await call(k1.token, 'PUT', '/slots/day', { date: tomorrow, minutes: [615] })).status === 400);
    check("ish vaqtidan tashqari (07:30) → 400", (await call(k1.token, 'PUT', '/slots/day', { date: tomorrow, minutes: [450] })).status === 400);
    check("sig'im 9 → 400", (await call(k1.token, 'PUT', '/slots/day', { date: tomorrow, minutes: [600], capacity: 9 })).status === 400);
    check('yakshanba → 400', (await call(k1.token, 'PUT', '/slots/day', { date: nextSunday(), minutes: [600] })).status === 400);
    const day = await call(k1.token, 'PUT', '/slots/day', { date: tomorrow, minutes: [600, 630, 660], lessonId: L3.id });
    check("3 ta vaqt ochildi, sig'im 8, mashg'ulot biriktirilgan", day.status === 200 && day.json.data.slots.length === 3 && day.json.data.slots[0].capacity === 8 && day.json.data.slots[0].lesson?.id === L3.id && day.json.data.slots[1].time === '10:30–11:00');
    const [sl600, sl630, sl660] = day.json.data.slots;
    check('boshqa kurator vaqtini o\'zgartira olmaydi → 403', (await call(k2.token, 'PATCH', `/slots/${sl600.id}`, { isOpen: false })).status === 403);
    check('nazoratchi curatorId siz → 400', (await call(admr.token, 'GET', `/slots/day?date=${tomorrow}`)).status === 400);
    check('nazoratchi kurator jadvalini ko\'radi', (await call(admr.token, 'GET', `/slots/day?date=${tomorrow}&curatorId=${k1.id}`)).json.data.slots.length === 3);

    console.log('\n7) Onlayn yozilish');
    const me = (await call(t1, 'GET', '/me')).json.data.enrollment;
    check("o'quvchi o'z kuratori va 2 oylik dasturini ko'radi", me?.curator?.fullName === 'Kurator Bir' && me.program.length === lessons.length && me.timeline.day === 1);
    check("kuratorsiz o'quvchi: enrollment null", (await call(loner.token, 'GET', '/me')).json.data.enrollment === null);
    const av = (await call(t1, 'GET', '/available')).json.data.slots.filter((s: any) => s.date === tomorrow);
    check('3 ta vaqt, hammasiga yozilsa bo\'ladi', av.length === 3 && av.every((s: any) => s.canBook));
    const b1 = await call(t1, 'POST', '/bookings', { slotId: sl600.id });
    check('yozildi', b1.status === 200 && b1.json.data.time === '10:00–10:30');
    check('shu kuni ikkinchi vaqt → 400', (await call(t1, 'POST', '/bookings', { slotId: sl630.id })).status === 400);
    check("boshqa kuratorning o'quvchisi → 403", (await call(t4, 'POST', '/bookings', { slotId: sl600.id })).status === 403);
    check("kuratorsiz o'quvchi → 403", (await call(loner.token, 'POST', '/bookings', { slotId: sl600.id })).status === 403);
    check('xodim /bookings POST → 403', (await call(k1.token, 'POST', '/bookings', { slotId: sl600.id })).status === 403);
    await call(k1.token, 'PATCH', `/slots/${sl630.id}`, { capacity: 1 });
    check('s2 → 10:30 (oxirgi joy)', (await call(t2, 'POST', '/bookings', { slotId: sl630.id })).status === 200);
    const full = await call(t3, 'POST', '/bookings', { slotId: sl630.id });
    check("to'lgan vaqt → 400", full.status === 400 && /to'lib/.test(full.json?.error?.message ?? ''), full.json?.error?.message);
    check("yozilganlardan kam sig'im → 400", (await call(k1.token, 'PATCH', `/slots/${sl600.id}`, { capacity: 0 })).status === 400);
    check("o'zganing yozuvini bekor qilib bo'lmaydi → 403", (await call(t2, 'DELETE', `/bookings/${b1.json.data.id}`)).status === 403);
    check("o'zinikini bekor qiladi", (await call(t1, 'DELETE', `/bookings/${b1.json.data.id}`)).status === 200);
    check('qayta yozilish (eski yozuv tiklanadi)', (await call(t1, 'POST', '/bookings', { slotId: sl600.id })).status === 200);
    check("yozuvli vaqtni o'chirib bo'lmaydi → 400", (await call(k1.token, 'DELETE', `/slots/${sl600.id}`)).status === 400);
    check("bo'sh vaqtni o'chirish", (await call(k1.token, 'DELETE', `/slots/${sl660.id}`)).status === 200);
    check("kurator o'z o'quvchisini qo'shadi (s3 → 10:00)", (await call(k1.token, 'POST', `/slots/${sl600.id}/bookings`, { studentId: s3.id })).status === 200);
    check("boshqa kurator o'quvchisini qo'sha olmaydi → 403", (await call(k1.token, 'POST', `/slots/${sl600.id}/bookings`, { studentId: s4.id })).status === 403);
    check("boshqa kurator vaqtiga qo'sha olmaydi → 403", (await call(k2.token, 'POST', `/slots/${sl600.id}/bookings`, { studentId: s4.id })).status === 403);
    const tomorrowBooking = await prisma.curatorBooking.findFirst({ where: { slotId: sl600.id, studentId: s1.id } });
    check("bo'lmagan mashg'ulotni belgilab bo'lmaydi → 400", (await call(k1.token, 'PATCH', `/bookings/${tomorrowBooking!.id}/attendance`, { status: 'keldi' })).status === 400);
    const lst = (await call(k1.token, 'GET', '/students')).json.data.items.find((x: any) => x.id === e1);
    check("ro'yxatda keyingi yozilish ko'rinadi", lst.nextBooking?.date === tomorrow && lst.nextBooking?.time === '10:00–10:30');

    console.log("\n8) Davomat → dastur");
    // Bugungi (o'tgan) vaqtni bazaga to'g'ridan-to'g'ri qo'yamiz — API o'tgan vaqtni ochmaydi
    const past = await prisma.curatorSlot.create({ data: { curatorId: k1.id, date: d0, startMinute: 0, lessonId: L1.id } });
    const pb1 = await prisma.curatorBooking.create({ data: { slotId: past.id, studentId: s1.id } });
    const pb2 = await prisma.curatorBooking.create({ data: { slotId: past.id, studentId: s2.id } });
    check('boshqa kurator belgilay olmaydi → 403', (await call(k2.token, 'PATCH', `/bookings/${pb1.id}/attendance`, { status: 'keldi' })).status === 403);
    const at = await call(k1.token, 'PATCH', `/bookings/${pb1.id}/attendance`, { status: 'keldi' });
    check("keldi → 1-mashg'ulot dasturga yozildi", at.status === 200 && at.json.data.progressLesson === L1.id);
    await call(k1.token, 'PATCH', `/bookings/${pb2.id}/attendance`, { status: 'kelmadi' });
    let d1 = (await call(k1.token, 'GET', `/students/${e1}`)).json.data;
    check("s1: 1 ta o'tildi, keyingisi 2-mashg'ulot", d1.progress.done === 1 && d1.progress.next?.n === L2.n && d1.program[0].state === 'otildi');
    const d2 = (await call(k1.token, 'GET', `/students/${e2}`)).json.data;
    check("s2: kelmadi — o'tilmagan, keyingisi hali 1-mashg'ulot", d2.progress.done === 0 && d2.progress.missed === 1 && d2.program[0].state === 'kelmadi');

    console.log("\n9) Qo'lda belgilash");
    check('kelajak sanasi → 400', (await call(k1.token, 'POST', `/students/${e1}/progress`, { lessonId: L2.id, attended: true, date: tomorrow })).status === 400);
    const mp = await call(k1.token, 'POST', `/students/${e1}/progress`, { lessonId: L2.id, attended: true, homework: 'qisman', note: 'Yaxshi', date: today });
    check("2-mashg'ulot qo'lda belgilandi", mp.status === 200);
    d1 = (await call(k1.token, 'GET', `/students/${e1}`)).json.data;
    check("endi 2 ta o'tildi, vazifa 'qisman'", d1.progress.done === 2 && d1.program[1].homework === 'qisman' && d1.progress.next?.n === L3.n);
    check("boshqa kurator o'chira olmaydi → 403", (await call(k2.token, 'DELETE', `/progress/${mp.json.data.id}`)).status === 403);
    check("o'chirish", (await call(k1.token, 'DELETE', `/progress/${mp.json.data.id}`)).status === 200);
    const meAfter = (await call(t1, 'GET', '/me')).json.data.enrollment;
    check("o'quvchi o'z holatini ko'radi: 1 o'tildi, yozilish bekor qilsa bo'ladi", meAfter.progress.done === 1 && meAfter.bookings.some((b: any) => b.date === tomorrow && b.canCancel));

    console.log("\n10) O'quvchi profilidagi karta");
    const sm = await call(teacher.token, 'GET', `/summary/${s1.id}`);
    check("o'sha guruh ustozi kurator kartasini ko'radi", sm.status === 200 && sm.json.data.curator.fullName === 'Kurator Bir' && sm.json.data.progress.done === 1);
    check('boshqa ustoz → 403', (await call(teacher2.token, 'GET', `/summary/${s1.id}`)).status === 403);
    check("o'quvchi → 403", (await call(t1, 'GET', `/summary/${s1.id}`)).status === 403);
    check("kuratorsiz o'quvchi: null", (await call(admin.token, 'GET', `/summary/${loner.id}`)).json.data === null);

    console.log("\n11) Mavjud o'quvchini biriktirish");
    const un = (await call(admr.token, 'GET', '/students/unassigned?q=Kuratorsiz')).json.data;
    check("qidiruv: kuratorsiz o'quvchi topiladi", un.some((x: any) => x.id === loner.id));
    check('kurator biriktira olmaydi → 403', (await call(k1.token, 'POST', '/students/assign', { studentId: loner.id, curatorId: k1.id, demoDate: today })).status === 403);
    check('nazoratchi biriktiradi', (await call(admr.token, 'POST', '/students/assign', { studentId: loner.id, curatorId: k2.id, demoDate: today })).status === 200);
    check('ikkinchi marta → 409', (await call(admr.token, 'POST', '/students/assign', { studentId: loner.id, curatorId: k1.id, demoDate: today })).status === 409);
    check("endi qidiruvda yo'q", !(await call(admr.token, 'GET', '/students/unassigned?q=Kuratorsiz')).json.data.some((x: any) => x.id === loner.id));
    const curs = (await call(admr.token, 'GET', '/curators')).json.data;
    const ck1 = curs.find((c: any) => c.id === k1.id);
    check("kuratorlar ro'yxati: Kurator Bir — 3 faol, 2 guruhsiz, 1 vaqt (7 kun)", ck1?.active === 3 && ck1?.ungrouped === 2 && ck1?.slotsThisWeek >= 2, JSON.stringify(ck1));
    check('kurator /curators da faqat o\'zini ko\'radi', (await call(k1.token, 'GET', '/curators')).json.data.length === 1);

    console.log('\n12) Holat va muddat');
    await call(k1.token, 'PATCH', `/students/${e3}`, { status: 'toxtatildi' });
    const stopped = await call(t3, 'POST', '/bookings', { slotId: sl600.id });
    check("to'xtatilgan o'quvchi yozila olmaydi → 400", stopped.status === 400);
    const old = toDateOnlyString(addMonthsUtc(parseDateOnly(today)!, -3));
    await call(k1.token, 'PATCH', `/students/${e2}`, { demoDate: old });
    const faol = (await call(k1.token, 'GET', '/students?status=faol')).json.data.items.map((x: any) => x.id);
    const ended = await prisma.curatorStudent.findUnique({ where: { id: e2 } });
    check("3 oy oldingi demo → avtomatik 'tugadi', faol ro'yxatda yo'q", ended?.status === 'tugadi' && !faol.includes(e2) && faol.includes(e1));
    await call(k1.token, 'PATCH', `/students/${e2}`, { demoDate: today });
    check("demo sanasi tuzatilsa — qayta 'faol'", (await prisma.curatorStudent.findUnique({ where: { id: e2 } }))?.status === 'faol');
    check("nazoratchi kuratorni almashtiradi", (await call(admr.token, 'PATCH', `/students/${e4}`, { curatorId: k1.id })).status === 200);
  } finally {
    if (lessonTitleBackup) await prisma.curatorLesson.update({ where: { id: lessonTitleBackup.id }, data: { title: lessonTitleBackup.title } });
    const created = await prisma.user.findMany({ where: { login: { startsWith: tag } }, select: { id: true } });
    const all = [...new Set([...ids.users, ...created.map((u) => u.id)])];
    await prisma.curatorBooking.deleteMany({ where: { studentId: { in: all } } });
    await prisma.curatorSlot.deleteMany({ where: { curatorId: { in: all } } });
    await prisma.curatorStudent.deleteMany({ where: { studentId: { in: all } } });
    await prisma.submission.deleteMany({ where: { studentId: { in: all } } });
    await prisma.lessonGrade.deleteMany({ where: { studentId: { in: all } } });
    await prisma.lessonSession.deleteMany({ where: { groupId: { in: ids.groups } } });
    await prisma.groupNormative.deleteMany({ where: { groupId: { in: ids.groups } } });
    await prisma.groupStudent.deleteMany({ where: { groupId: { in: ids.groups } } });
    await prisma.group.deleteMany({ where: { id: { in: ids.groups } } });
    await prisma.normative.deleteMany({ where: { id: { in: ids.norms } } });
    await prisma.auditLog.deleteMany({ where: { OR: [{ userId: { in: all } }, { targetId: { in: all } }] } });
    await prisma.userPermission.deleteMany({ where: { userId: { in: all } } });
    await prisma.user.deleteMany({ where: { id: { in: all } } });
    console.log(`\nTozalash: qolgan fixture = ${await prisma.user.count({ where: { login: { startsWith: tag } } })}`);
    server.close();
    await prisma.$disconnect();
  }
  console.log(`\nNatija: ${pass} OK, ${failed} XATO`);
  process.exitCode = failed ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
