/**
 * Normativ deadline'lari — uchdan-uchgacha sinov (LOKAL baza).
 *
 *  0) toza qoidalar: hafta, dars kuni + soatigacha muddat, qo'shimcha muddat, holatlar;
 *     demo day/imtihon nomzodlari endi hafta kuni bo'yicha (milestones tuzatishi)
 *  1) kirish: tokensiz 401, o'quvchi/ruxsatsiz xodim 403, start'gacha hech kim ko'rmaydi
 *  2) ko'rib chiqish (preview) — hech narsa yozmaydi
 *  3) start: sana tekshiruvi, reja haftasiga 2 tadan
 *  4) holatlar vaqt bo'yicha: open → grace → missed, grace_done, late_done, na
 *  5) ko'lam: o'qituvchi — o'z guruhi (boshqasi 404), ruxsat — hammasi, o'quvchi /me
 *  6) sinxronlash: yangi normativ oxiriga, olingani rejadan chiqadi
 *  7) boshqaruv: ko'chirish, rejadan chiqarish, qayta qurish, pauza, tozalash
 *  8) firstSubmittedAt — qayta topshirish birinchi vaqtni o'zgartirmaydi
 *
 * Vaqtga bog'liq holatlar service funksiyalariga `now` berib tekshiriladi.
 * Sinov oxirida sozlama asl holiga qaytadi va yaratilgan reja/fixture o'chiriladi.
 *
 * Ishlatish (backend papkasidan):  npm run e2e:normative-deadlines
 */
import http from 'http';
import * as R from '../src/modules/normative-deadlines/deadline.rules';
import { lessonDaysInMonth } from '../src/modules/milestones/milestones.schedule';

const PORT = Number(process.env.ND_E2E_PORT || 5097);
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
const H = 3_600_000;
const D = 24 * H;
const at = (d: Date, hoursUtc: number) => new Date(d.getTime() + hoursUtc * H);

async function main() {
  // ── 0) toza qoidalar ──
  console.log('\n0) Qoidalar');
  const mon = R.utcDay('2026-11-23'); // dushanba
  check('mondayOf(yakshanba 29-noy) = 23-noy', R.dayStr(R.mondayOf(R.utcDay('2026-11-29'))) === '2026-11-23');
  check('mondayOf(dushanba) = o\'zi', R.dayStr(R.mondayOf(mon)) === '2026-11-23');
  check(
    'centerToday: 23:30Z (Toshkentda ertasi 04:30) → ertangi sana',
    R.dayStr(R.centerToday(new Date('2026-11-24T23:30:00Z'))) === '2026-11-25'
  );
  // Muddat — har hafta YAKSHANBA 23:59 Toshkent (Promptokrat, 2026-11-24), guruh jadvalidan qat'i nazar
  const dJuft = R.dueAtFor(mon, { lessonDayType: 'juft', lessonStartMinute: 14 * 60 });
  check('juft + 14:00 → yakshanba 23:59:59 (18:59:59Z)', dJuft.toISOString() === '2026-11-29T18:59:59.000Z', dJuft.toISOString());
  const dToq = R.dueAtFor(mon, { lessonDayType: 'toq', lessonStartMinute: 9 * 60 + 30 });
  check('toq → ham yakshanba 23:59:59', dToq.toISOString() === '2026-11-29T18:59:59.000Z', dToq.toISOString());
  const dNone = R.dueAtFor(mon, { lessonDayType: null, lessonStartMinute: null });
  check('jadvalsiz → yakshanba 23:59:59', dNone.toISOString() === '2026-11-29T18:59:59.000Z', dNone.toISOString());
  check("qo'shimcha muddat +2 kun → seshanba 23:59:59", R.graceEndFor(dJuft, 2).toISOString() === '2026-12-01T18:59:59.000Z');
  const st = (sub: string | null, now: string, joined = '2026-01-01T00:00:00Z') =>
    R.stateOf({ dueAt: dJuft, graceEnd: R.graceEndFor(dJuft, 2), submittedAt: sub ? new Date(sub) : null, joinedAt: new Date(joined), now: new Date(now) });
  check('holat: muddatgacha topshirmagan → open', st(null, '2026-11-29T10:00:00Z') === 'open');
  check("holat: muddat o'tdi → grace", st(null, '2026-11-30T10:00:00Z') === 'grace');
  check("holat: qo'shimcha ham o'tdi → missed (qizil)", st(null, '2026-12-01T19:00:00Z') === 'missed');
  check("holat: o'z vaqtida (yakshanba kechqurun) → done", st('2026-11-29T18:30:00Z', '2026-12-05T00:00:00Z') === 'done');
  check("holat: qo'shimcha muddatda → grace_done", st('2026-11-30T10:00:00Z', '2026-12-05T00:00:00Z') === 'grace_done');
  check('holat: kech → late_done', st('2026-12-02T10:00:00Z', '2026-12-05T00:00:00Z') === 'late_done');
  check('holat: kelajakdagi topshiriq hisobga olinmaydi', st('2026-11-27T10:00:00Z', '2026-11-26T10:00:00Z') === 'open');
  check("holat: muddatdan keyin qo'shilgan → na", st(null, '2026-12-05T00:00:00Z', '2026-11-30T00:00:00Z') === 'na');
  const lay = R.layOut(['a', 'b', 'c', 'd', 'e'], mon, 2, new Map([['2026-11-23', 1]]));
  check(
    'layOut: band joy hisobga olinadi (1+1, 2, 1)',
    lay.map((x) => R.dayStr(x.weekStart)).join(',') === '2026-11-23,2026-11-30,2026-11-30,2026-12-07,2026-12-07'
  );
  const nov = lessonDaysInMonth(2026, 10, 'juft');
  check(
    'milestones: juft = Se/Pay/Sha (oy sanasi emas)',
    nov.length > 0 && nov.every((d) => [2, 4, 6].includes(d.getUTCDay())),
    nov.slice(0, 4).map(R.dayStr).join(' ')
  );
  check('milestones: toq = Du/Chor/Ju', lessonDaysInMonth(2026, 10, 'toq').every((d) => [1, 3, 5].includes(d.getUTCDay())));

  const { default: express } = await import('express');
  const jwt = (await import('jsonwebtoken')).default;
  const { default: prisma } = await import('../src/config/database');
  const { env } = await import('../src/config/env');
  const { default: routes } = await import('../src/modules/normative-deadlines/normative-deadlines.routes');
  const { errorHandler } = await import('../src/shared/middleware/errorHandler');
  const svc = await import('../src/modules/normative-deadlines/normative-deadlines.service');
  const { default: submissionsService } = await import('../src/modules/submissions/submissions.service');

  const app = express();
  app.use(express.json());
  app.use('/api/normative-deadlines', routes);
  app.use(errorHandler);
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(PORT, r));

  const tag = `nde2e${Date.now().toString(36)}`;
  const ids = { users: [] as string[], groups: [] as string[], norms: [] as string[], cats: [] as string[] };
  const tokenOf = (u: { id: string; role: string; login: string }) =>
    jwt.sign({ userId: u.id, role: u.role, login: u.login, tv: 0 }, env.JWT_SECRET);
  const mk = async (role: any, name: string) => {
    const u = await prisma.user.create({
      data: { fullName: `${name} ${tag}`, login: `${tag}_${name.toLowerCase().replace(/\W+/g, '')}`, passwordHash: 'x', role },
    });
    ids.users.push(u.id);
    return { ...u, token: tokenOf(u) };
  };
  const call = async (token: string | null, method: string, path: string, body?: unknown) => {
    const r = await fetch(`${BASE}/api/normative-deadlines${path}`, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, json: (await r.json().catch(() => null)) as any };
  };

  // Lokal sozlama va mavjud reja — oxirida aynan shu holatga qaytariladi
  const savedSetting = await prisma.appSetting.findUnique({ where: { key: 'normative_deadlines' } });
  const savedRowIds = new Set((await prisma.normativeDeadline.findMany({ select: { id: true } })).map((r) => r.id));
  if (savedSetting) await prisma.appSetting.delete({ where: { key: 'normative_deadlines' } });
  if (savedRowIds.size) {
    console.log(`\n(lokal bazada ${savedRowIds.size} ta reja bandi bor — sinov ularsiz ishlaydi, oxirida qaytariladi)`);
  }
  const backupRows = savedRowIds.size ? await prisma.normativeDeadline.findMany() : [];
  if (backupRows.length) await prisma.normativeDeadline.deleteMany({});

  // Sinov haftasi: real "bugun"dan keyingi dushanba — start validatsiyasi real vaqt bilan ham o'tadi
  const realMonday = R.mondayOf(R.centerToday(new Date()));
  const M = R.addDays(realMonday, 7);
  const Ms = R.dayStr(M);
  const now0 = at(R.addDays(M, -3), 6); // oldingi juma

  try {
    const admin = await mk('admin', 'Admin');
    const t1 = await mk('teacher', 'Ustoz Bir');
    const t2 = await mk('teacher', 'Ustoz Ikki');
    const viewer = await mk('nazoratchi', 'Nazoratchi');
    const manager = await mk('assistant', 'Menejer');
    const asst = await mk('assistant', 'Assistent');
    const s1 = await mk('student', 'Oquvchi Bir');
    const s2 = await mk('student', 'Oquvchi Ikki');
    const s3 = await mk('student', 'Kech Qoshilgan');
    const s4 = await mk('student', 'Boshqa Guruh');
    await prisma.userPermission.createMany({
      data: [
        { userId: viewer.id, permission: 'normative_deadlines_all' },
        { userId: manager.id, permission: 'normative_deadlines_manage' },
      ],
    });

    const cat = await prisma.category.create({ data: { name: `ND ${tag}` } });
    ids.cats.push(cat.id);
    const norms = [];
    for (let i = 1; i <= 6; i++) {
      const n = await prisma.normative.create({ data: { taskNumber: 9000 + i, title: `N${i} ${tag}`, categoryId: cat.id } });
      ids.norms.push(n.id);
      norms.push(n);
    }
    const [N1, N2, N3, N4, N5, N6] = norms;
    const g1 = await prisma.group.create({
      data: { name: `G1 ${tag}`.slice(0, 50), teacherId: t1.id, lessonDayType: 'juft', lessonStartMinute: 14 * 60, lessonEndMinute: 16 * 60 },
    });
    const g2 = await prisma.group.create({ data: { name: `G2 ${tag}`.slice(0, 50), teacherId: t2.id } });
    ids.groups.push(g1.id, g2.id);
    await prisma.groupNormative.createMany({
      data: [N1, N2, N3, N4, N5].map((n) => ({ groupId: g1.id, normativeId: n.id })).concat([N1, N2].map((n) => ({ groupId: g2.id, normativeId: n.id }))),
    });
    const old = new Date('2026-01-01T00:00:00Z');
    await prisma.groupStudent.createMany({
      data: [
        { groupId: g1.id, studentId: s1.id, joinedAt: old },
        { groupId: g1.id, studentId: s2.id, joinedAt: old },
        { groupId: g1.id, studentId: s3.id, joinedAt: at(M, 24 * 7) }, // dushanba — 1-hafta muddatidan keyin
        { groupId: g2.id, studentId: s4.id, joinedAt: old },
      ],
    });

    // ── guruh jadvali ──
    console.log('\nG) Guruh jadvali');
    const { default: groupsService } = await import('../src/modules/groups/groups.service');
    const list: any = await groupsService.getAll({ page: 1, limit: 50, skip: 0 }, { search: tag });
    const lg1 = list.data.find((g: any) => g.id === g1.id);
    check(
      "guruhlar ro'yxati jadvalni qaytaradi (tahrir formasi uni o'chirib yubormasin)",
      lg1?.lessonDayType === 'juft' && lg1?.lessonStartMinute === 840 && lg1?.lessonEndMinute === 960 && lg1?.teacherId === t1.id && 'startDate' in lg1 && 'durationMonths' in lg1,
      JSON.stringify(lg1)
    );
    const { updateGroupSchema } = await import('../src/modules/groups/groups.validation');
    check('tugash < boshlanish → rad', !updateGroupSchema.safeParse({ lessonStartMinute: 900, lessonEndMinute: 840 }).success);
    check('dars soati 05:00 → rad', !updateGroupSchema.safeParse({ lessonStartMinute: 300 }).success);
    check('to\'g\'ri soat → qabul', updateGroupSchema.safeParse({ lessonStartMinute: 840, lessonEndMinute: 960 }).success);

    // ── 1) kirish ──
    console.log('\n1) Kirish');
    check('tokensiz → 401', (await call(null, 'GET', '/overview')).status === 401);
    check("o'quvchi → overview 403", (await call(s1.token, 'GET', '/overview')).status === 403);
    check('ruxsatsiz assistent → 403', (await call(asst.token, 'GET', '/overview')).status === 403);
    check('xodim → /me 403 (faqat o\'quvchi)', (await call(t1.token, 'GET', '/me')).status === 403);
    const pre = await call(t1.token, 'GET', '/overview');
    check("start'gacha: o'qituvchi 'ishlamayapti' ko'radi", pre.status === 200 && pre.json.data.enabled === false);
    check("start'gacha: o'quvchi /me → enabled:false", (await call(s1.token, 'GET', '/me')).json.data.enabled === false);
    check("o'qituvchi start bera olmaydi → 403", (await call(t1.token, 'POST', '/start', { startDate: Ms })).status === 403);
    check("nazoratchi (faqat ko'rish) start bera olmaydi → 403", (await call(viewer.token, 'POST', '/start', { startDate: Ms })).status === 403);
    check("o'qituvchi preview qila olmaydi → 403", (await call(t1.token, 'POST', '/preview', { startDate: Ms })).status === 403);
    check('xato javobida stack yo\'q', !JSON.stringify((await call(t1.token, 'POST', '/start', { startDate: Ms })).json).includes('at '));

    // ── 2) preview ──
    console.log("\n2) Ko'rib chiqish");
    const pv = await call(manager.token, 'POST', '/preview', { startDate: Ms, perWeek: 2 });
    const pg1 = pv.json?.data?.groups?.find((g: any) => g.id === g1.id);
    const pg2 = pv.json?.data?.groups?.find((g: any) => g.id === g2.id);
    check('menejer preview → 200', pv.status === 200);
    check('G1: 5 normativ → 3 hafta, 1-hafta N1+N2', pg1?.normatives === 5 && pg1?.weeks === 3 && pg1?.firstWeekItems.map((x: any) => x.id).join() === [N1.id, N2.id].join());
    check('G1 birinchi muddat — yakshanba 23:59', pg1?.firstDueAt === R.dueAtFor(M, { lessonDayType: 'juft', lessonStartMinute: 840 }).toISOString());
    check("G2 ogohlantirish: boshlanish sanasi yo'q", pg2?.warnings.some((w: string) => w.includes('boshlanish sanasi')));
    check('preview hech narsa yozmaydi', (await prisma.normativeDeadline.count()) === 0);
    check('preview: dushanba emas → 400', (await call(manager.token, 'POST', '/preview', { startDate: R.dayStr(R.addDays(M, 1)) })).status === 400);

    // ── 3) start ──
    console.log('\n3) Start');
    const pastMon = R.dayStr(R.addDays(realMonday, -7));
    check("o'tgan haftadan start → 400", (await call(admin.token, 'POST', '/start', { startDate: pastMon })).status === 400);
    check('noto\'g\'ri haftalik son → 400', (await call(admin.token, 'POST', '/start', { startDate: Ms, perWeek: 0 })).status === 400);
    const started = await svc.start({ userId: manager.id, role: manager.role }, { startDate: Ms, perWeek: 2, graceDays: 2 }, now0);
    check('menejer start berdi (reja quriladi)', started.config.enabled && started.created >= 7, `created=${started.created}`);
    const plan1 = await prisma.normativeDeadline.findMany({ where: { groupId: g1.id }, orderBy: { seq: 'asc' } });
    check(
      'G1 reja: N1,N2 → 1-hafta; N3,N4 → 2-hafta; N5 → 3-hafta',
      plan1.map((r) => `${r.normativeId === N1.id ? 1 : r.normativeId === N2.id ? 2 : r.normativeId === N3.id ? 3 : r.normativeId === N4.id ? 4 : 5}@${R.dayStr(r.weekStart)}`).join() ===
        [`1@${Ms}`, `2@${Ms}`, `3@${R.dayStr(R.addDays(M, 7))}`, `4@${R.dayStr(R.addDays(M, 7))}`, `5@${R.dayStr(R.addDays(M, 14))}`].join()
    );
    check('qayta start → 409', (await call(admin.token, 'POST', '/start', { startDate: Ms })).status === 409);
    check('start audit jurnalida', !!(await prisma.auditLog.findFirst({ where: { userId: manager.id, action: 'NORMATIVE_DEADLINES_START' } })));

    // ── 4) holatlar ──
    console.log('\n4) Holatlar (vaqt bo\'yicha)');
    const due1 = R.dueAtFor(M, { lessonDayType: 'juft', lessonStartMinute: 840 }); // yakshanba 18:59:59Z
    const subAt = async (studentId: string, normativeId: string, when: Date) =>
      prisma.submission.create({
        data: { studentId, normativeId, groupId: g1.id, youtubeUrl: 'https://youtu.be/x', submittedAt: when, firstSubmittedAt: when },
      });
    await subAt(s1.id, N1.id, at(M, 24 + 6)); // seshanba — o'z vaqtida
    await subAt(s1.id, N2.id, at(M, 24 * 7 + 2)); // dushanba — qo'shimcha muddatda
    await subAt(s2.id, N1.id, at(M, 24 * 9 + 1)); // chorshanba — qo'shimcha muddatdan keyin (kech)
    const A = { userId: admin.id, role: 'admin' };
    svc.resetSyncThrottle();
    const ov = async (now: Date, week = Ms) => {
      const d: any = await svc.overview(A, week, now);
      return { d, g: d.groups.find((x: any) => x.id === g1.id) };
    };
    let o = await ov(at(M, 24 * 3 + 6)); // payshanba
    check('payshanba: G1 bu hafta 2 ta normativ, 4 ta deadline (s3 hisobda yo\'q)', o.g.week.items.length === 2 && o.g.week.due === 4, JSON.stringify(o.g.week));
    check('payshanba: 1 topshirildi, 3 kutilmoqda, 0 qizil', o.g.week.done === 1 && o.g.week.open === 3 && o.g.missed === 0);
    check('hafta muddati javobda — yakshanba 23:59', o.g.week.items[0].dueAt === due1.toISOString());
    o = await ov(at(M, 24 * 7 + 6)); // dushanba 11:00 Toshkent
    check("dushanba: s1 N2 qo'shimcha muddatda topshirdi, s2 ikkalasi qo'shimcha muddatda", o.g.week.graceDone === 1 && o.g.week.grace === 2 && o.g.week.missed === 0, JSON.stringify(o.g.week));
    o = await ov(at(M, 24 * 9 + 6)); // chorshanba — qo'shimcha muddat ham o'tgan
    check('qo\'shimcha muddatdan keyin: s2 N2 QIZIL, s2 N1 kech topshirgan', o.g.week.missed === 1 && o.g.week.lateDone === 1 && o.g.missed === 1 && o.g.studentsWithMissed === 1, JSON.stringify(o.g.week));
    check('jami: qizil o\'quvchilar soni', o.d.totals.studentsWithMissed >= 1 && o.d.totals.missed >= 1);
    const wk2 = await ov(at(M, 24 * 9 + 6), R.dayStr(R.addDays(M, 7)));
    check('2-hafta tanlanganda: N3, N4', wk2.g.week.items.map((x: any) => x.normativeId).join() === [N3.id, N4.id].join() && wk2.d.week.start === R.dayStr(R.addDays(M, 7)));
    const g2ov = o.d.groups.find((x: any) => x.id === g2.id);
    check('G2 muddati ham yakshanba 23:59', g2ov.week.items[0]?.dueAt === R.dueAtFor(M, { lessonDayType: null, lessonStartMinute: null }).toISOString());

    const det: any = await svc.groupDetail(A, g1.id, at(M, 24 * 9 + 6));
    const rowN2 = det.weeks[0].items.find((x: any) => x.normativeId === N2.id).id;
    const rowN1 = det.weeks[0].items.find((x: any) => x.normativeId === N1.id).id;
    const cell = (sid: string, row: string) => det.students.find((s: any) => s.id === sid).cells[row][0];
    check('matritsa: s1 N1 done, s1 N2 grace_done', cell(s1.id, rowN1) === 'done' && cell(s1.id, rowN2) === 'grace_done');
    check('matritsa: s2 N1 late_done, s2 N2 missed', cell(s2.id, rowN1) === 'late_done' && cell(s2.id, rowN2) === 'missed');
    check("matritsa: s3 (kech qo'shilgan) 1-haftada na", cell(s3.id, rowN1) === 'na');
    check('matritsa: isbot havolasi', det.students.find((s: any) => s.id === s1.id).cells[rowN1][2] === 'https://youtu.be/x');

    // ── 5) ko'lam ──
    console.log("\n5) Ko'lam");
    const t1ov = await call(t1.token, 'GET', `/overview?week=${Ms}`);
    check("o'qituvchi faqat o'z guruhini ko'radi", t1ov.status === 200 && t1ov.json.data.groups.every((g: any) => g.teacher?.id === t1.id) && t1ov.json.data.groups.some((g: any) => g.id === g1.id));
    check("o'qituvchi o'z guruhi matritsasi → 200", (await call(t1.token, 'GET', `/groups/${g1.id}`)).status === 200);
    check("boshqa o'qituvchi G1 → 404 (IDOR)", (await call(t2.token, 'GET', `/groups/${g1.id}`)).status === 404);
    check("noto'g'ri ID → 400", (await call(t1.token, 'GET', '/groups/abc')).status === 400);
    const vov = await call(viewer.token, 'GET', `/overview?week=${Ms}`);
    check('nazoratchi (ruxsat) hammasini ko\'radi', vov.json.data.groups.some((g: any) => g.id === g1.id) && vov.json.data.groups.some((g: any) => g.id === g2.id));
    check("o'qituvchi canManage=false", t1ov.json.data.canManage === false && vov.json.data.canManage === false);
    const me: any = await svc.studentMe(s2.id, at(M, 24 * 9 + 6));
    check("o'quvchi /me: qizil N2 + shu haftaning 2 tasi", me.enabled && me.items.some((x: any) => x.normativeId === N2.id && x.state === 'missed') && me.items.filter((x: any) => x.when === 'this').length === 2, JSON.stringify(me.counts));
    check("o'quvchi /me: o'z vaqtida topshirilgan eski band ko'rinmaydi", !me.items.some((x: any) => x.when === 'past' && x.state === 'late_done'));
    const me4 = await call(s4.token, 'GET', '/me');
    check("o'quvchi /me (HTTP) faqat o'z guruhi", me4.status === 200 && me4.json.data.items.every((x: any) => x.groupId === g2.id));

    // ── 6) sinxronlash ──
    console.log('\n6) Sinxronlash');
    await prisma.groupNormative.create({ data: { groupId: g1.id, normativeId: N6.id } });
    await prisma.groupNormative.deleteMany({ where: { groupId: g1.id, normativeId: N3.id } });
    await svc.groupDetail(A, g1.id, at(M, 24 * 3)); // payshanba — sinxronlash
    const plan2 = await prisma.normativeDeadline.findMany({ where: { groupId: g1.id } });
    const w = (nid: string) => { const r = plan2.find((x) => x.normativeId === nid); return r ? R.dayStr(r.weekStart) : null; };
    check('olingan normativ (N3) rejadan chiqdi', w(N3.id) === null);
    check("yangi normativ (N6) oxirgi haftaga (bo'sh joy bor)", w(N6.id) === R.dayStr(R.addDays(M, 14)), String(w(N6.id)));

    // ── 7) boshqaruv ──
    console.log('\n7) Boshqaruv');
    const rowOf = (nid: string) => plan2.find((x) => x.normativeId === nid)!.id;
    check("o'qituvchi rejani o'zgartira olmaydi → 403", (await call(t1.token, 'PATCH', `/groups/${g1.id}/items`, { ids: [rowOf(N5.id)], excluded: true })).status === 403);
    check("boshqa guruh bandi → 404", (await call(admin.token, 'PATCH', `/groups/${g2.id}/items`, { ids: [rowOf(N5.id)], excluded: true })).status === 404);
    check('dushanba bo\'lmagan hafta → 400', (await call(admin.token, 'PATCH', `/groups/${g1.id}/items`, { ids: [rowOf(N5.id)], weekStart: R.dayStr(R.addDays(M, 2)) })).status === 400);
    const mv = await call(admin.token, 'PATCH', `/groups/${g1.id}/items`, { ids: [rowOf(N5.id)], weekStart: R.dayStr(R.addDays(M, 21)) });
    check('N5 → 4-haftaga ko\'chirildi', mv.status === 200 && R.dayStr((await prisma.normativeDeadline.findUnique({ where: { id: rowOf(N5.id) } }))!.weekStart) === R.dayStr(R.addDays(M, 21)));
    const ex = await call(manager.token, 'PATCH', `/groups/${g1.id}/items`, { ids: [rowOf(N4.id)], excluded: true });
    check('N4 rejadan chiqarildi', ex.status === 200 && (await prisma.normativeDeadline.findUnique({ where: { id: rowOf(N4.id) } }))!.excluded);
    o = await ov(at(M, 24 * 9 + 6), R.dayStr(R.addDays(M, 7)));
    check("chiqarilgan band hisobga olinmaydi (2-haftada faqat 0 ta)", o.g.week.items.length === 0, JSON.stringify(o.g.week.items.map((x: any) => x.title)));
    const rb = await call(manager.token, 'POST', `/groups/${g1.id}/rebuild`, { fromWeek: R.dayStr(R.addDays(M, 7)) });
    const plan3 = await prisma.normativeDeadline.findMany({ where: { groupId: g1.id, excluded: false }, orderBy: { seq: 'asc' } });
    check(
      'qayta qurish 2-haftadan: N1,N2 → 2-hafta; N5,N6 → 3-hafta',
      rb.status === 200 && plan3.map((r) => R.dayStr(r.weekStart)).join() === [7, 7, 14, 14].map((k) => R.dayStr(R.addDays(M, k))).join(),
      plan3.map((r) => R.dayStr(r.weekStart)).join()
    );
    check('tozalash ishlab turganda → 409', (await call(admin.token, 'DELETE', '/plan')).status === 409);
    check('pauza → 200', (await call(manager.token, 'POST', '/pause')).status === 200);
    check("pauzada o'qituvchi ko'rmaydi", (await call(t1.token, 'GET', '/overview')).json.data.enabled === false);
    check("pauzada o'quvchi ko'rmaydi", (await call(s1.token, 'GET', '/me')).json.data.enabled === false);
    check('boshqa sanadan davom → 400', (await call(manager.token, 'POST', '/start', { startDate: R.dayStr(R.addDays(M, 7)) })).status === 400);
    const resumed = await call(manager.token, 'POST', '/start', { startDate: Ms });
    check('o\'sha sanadan davom → 200, reja saqlangan', resumed.status === 200 && (await prisma.normativeDeadline.count({ where: { groupId: g1.id } })) === 5);
    check('sozlama: qo\'shimcha kun 3 → 200', (await call(manager.token, 'PATCH', '/config', { graceDays: 3 })).status === 200 && (await svc.getConfig()).graceDays === 3);
    check('sozlama: 8 kun → 400', (await call(manager.token, 'PATCH', '/config', { graceDays: 8 })).status === 400);
    await call(manager.token, 'POST', '/pause');
    const reset = await call(manager.token, 'DELETE', '/plan');
    check('tozalash (pauzada) → reja yo\'q, sozlama boshlang\'ich', reset.status === 200 && (await prisma.normativeDeadline.count()) === 0 && (await svc.getConfig()).startDate === null);

    // ── 8) firstSubmittedAt ──
    console.log('\n8) Birinchi topshirish vaqti');
    const first = await submissionsService.create(s4.id, { normativeId: N1.id, youtubeUrl: 'https://youtu.be/a', groupId: g2.id } as any);
    check('yangi topshiriqda firstSubmittedAt bor', !!(first as any).firstSubmittedAt);
    const f0 = (first as any).firstSubmittedAt as Date;
    await prisma.submission.update({ where: { id: first.id }, data: { status: 'checked', result: 'red', canResubmit: true } });
    await new Promise((r) => setTimeout(r, 20));
    const again = await submissionsService.create(s4.id, { normativeId: N1.id, youtubeUrl: 'https://youtu.be/b', groupId: g2.id } as any);
    check('qayta topshirish: submittedAt yangilandi, firstSubmittedAt o\'zgarmadi', (again as any).submittedAt > f0 && +(again as any).firstSubmittedAt === +f0);
    const legacy = await prisma.submission.create({
      data: { studentId: s4.id, normativeId: N2.id, groupId: g2.id, youtubeUrl: 'https://youtu.be/c', status: 'checked', result: 'red', canResubmit: true, submittedAt: new Date('2026-03-01T10:00:00Z') },
    });
    const re = await submissionsService.create(s4.id, { normativeId: N2.id, youtubeUrl: 'https://youtu.be/d', groupId: g2.id } as any);
    check('eski yozuv (firstSubmittedAt yo\'q) qayta topshirilsa — asl vaqt saqlanadi', +(re as any).firstSubmittedAt === +legacy.submittedAt);
  } finally {
    const created = await prisma.user.findMany({ where: { login: { startsWith: tag } }, select: { id: true } });
    const all = [...new Set([...ids.users, ...created.map((u) => u.id)])];
    // Sinov paytida qurilgan barcha reja bandlari (lokal guruhlarniki ham) — o'chiriladi, eskisi qaytariladi
    await prisma.normativeDeadline.deleteMany({});
    if (backupRows.length) await prisma.normativeDeadline.createMany({ data: backupRows });
    await prisma.appSetting.deleteMany({ where: { key: 'normative_deadlines' } });
    if (savedSetting) await prisma.appSetting.create({ data: { key: savedSetting.key, value: savedSetting.value as any, updatedById: savedSetting.updatedById } });
    await prisma.notification.deleteMany({ where: { userId: { in: all } } });
    await prisma.submission.deleteMany({ where: { studentId: { in: all } } });
    await prisma.groupNormative.deleteMany({ where: { groupId: { in: ids.groups } } });
    await prisma.groupStudent.deleteMany({ where: { groupId: { in: ids.groups } } });
    await prisma.groupMilestone.deleteMany({ where: { groupId: { in: ids.groups } } });
    await prisma.group.deleteMany({ where: { id: { in: ids.groups } } });
    await prisma.normative.deleteMany({ where: { id: { in: ids.norms } } });
    await prisma.category.deleteMany({ where: { id: { in: ids.cats } } });
    await prisma.auditLog.deleteMany({ where: { OR: [{ userId: { in: all } }, { targetId: { in: [...all, ...ids.groups] } }] } });
    await prisma.userPermission.deleteMany({ where: { userId: { in: all } } });
    await prisma.user.deleteMany({ where: { id: { in: all } } });
    console.log(`\nTozalash: qolgan fixture = ${await prisma.user.count({ where: { login: { startsWith: tag } } })}, reja bandlari = ${await prisma.normativeDeadline.count()} (asl: ${backupRows.length})`);
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
