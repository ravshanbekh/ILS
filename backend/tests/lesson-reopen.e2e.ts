/**
 * Dars baholashini qayta ochish — uchdan-uchgacha sinov (LOKAL baza).
 *
 *  1) o'qituvchi "Yakunlash"ni adashib bosadi (1/3 baholangan) → 2 ta avto-0
 *  2) admin ro'yxatida "yakunlangan, 2 ta avto-0" ko'rinadi
 *  3) admin qayta ochadi: avto-0 tozalanadi, qo'yilgan baho saqlanadi, ota-ona xabari bekor
 *  4) o'qituvchi tugatib, qayta yakunlaydi → avto-0 yo'q, xabar vaqti qayta qo'yiladi
 *  5) ota-onaga xabar ketgan bo'lsa — qayta ochish uni qayta yubormaydi
 *  6) o'tgan kun darsi qayta ochilsa — o'qituvchi panelida (today) chiqadi
 *  7) kirish: o'qituvchi admin endpointlariga 403; ochiq darsni qayta ochib bo'lmaydi
 *
 * Ishlatish (backend papkasidan):  npm run e2e:lesson-reopen
 */
import http from 'http';

const PORT = Number(process.env.LR_E2E_PORT || 5099);
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

async function main() {
  const { default: express } = await import('express');
  const jwt = (await import('jsonwebtoken')).default;
  const { default: prisma } = await import('../src/config/database');
  const { env } = await import('../src/config/env');
  const { errorHandler } = await import('../src/shared/middleware/errorHandler');
  const { default: routes } = await import('../src/modules/lesson-sessions/lesson-sessions.routes');
  const { default: svc } = await import('../src/modules/lesson-sessions/lesson-sessions.service');

  const app = express();
  app.use(express.json());
  app.use('/api/lesson-sessions', routes);
  app.use(errorHandler);
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(PORT, r));

  const tag = `lre2e${Date.now().toString(36)}`;
  const ids = { users: [] as string[], groups: [] as string[] };
  const mk = async (role: any, name: string) => {
    const u = await prisma.user.create({ data: { fullName: `${name} ${tag}`, login: `${tag}_${name.toLowerCase().replace(/\W+/g, '')}`, passwordHash: 'x', role } });
    ids.users.push(u.id);
    return { ...u, token: jwt.sign({ userId: u.id, role: u.role, login: u.login, tv: 0 }, env.JWT_SECRET) };
  };
  const call = async (token: string, method: string, path: string, body?: unknown) => {
    const r = await fetch(`${BASE}/api/lesson-sessions${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, json: (await r.json().catch(() => null)) as any };
  };

  try {
    const admin = await mk('admin', 'Admin');
    const teacher = await mk('teacher', 'Ustoz');
    const st = [await mk('student', 'Bir'), await mk('student', 'Ikki'), await mk('student', 'Uch')];
    const g = await prisma.group.create({ data: { name: `LR ${tag}`.slice(0, 50), teacherId: teacher.id, lessonDayType: 'har_kuni' } });
    ids.groups.push(g.id);
    await prisma.groupStudent.createMany({ data: st.map((s) => ({ groupId: g.id, studentId: s.id })) });

    // ── 1) adashib yakunlash ──
    console.log('\n1) Adashib yakunlash');
    const open = await call(admin.token, 'POST', '/admin/unlock', { groupId: g.id, note: 'sinov: dars ochish' });
    const sid = open.json?.data?.id;
    check('bugungi dars ochildi', open.status === 200 && open.json.data.status === 'ochiq');
    const hw = await call(teacher.token, 'PATCH', `/${sid}/homework`, { studentId: st[0].id, homework: 'toliq' });
    check("o'qituvchi 1-o'quvchini baholadi", hw.status === 200, String(hw.status));
    const fin = await call(teacher.token, 'POST', `/${sid}/finalize`);
    check("o'qituvchi 'Yakunlash'ni bosdi", fin.status === 200 && fin.json.data.status === 'yakunlandi');
    let grades = await prisma.lessonGrade.findMany({ where: { sessionId: sid } });
    check('baholanmagan 2 tasiga avto-0', grades.filter((x) => x.autoZero).length === 2);
    check("ota-ona xabari 1 soatdan keyinga rejalandi", !!(await prisma.lessonSession.findUnique({ where: { id: sid } }))?.parentNotifyAt);
    check("o'qituvchi yakunlangan darsni o'zi baholay olmaydi", (await call(teacher.token, 'PATCH', `/${sid}/homework`, { studentId: st[1].id, homework: 'toliq' })).status === 400);

    // ── 2) ro'yxat ──
    console.log("\n2) Admin ro'yxati");
    const cl = await call(admin.token, 'GET', '/admin/closed?days=7');
    const row = cl.json?.data?.find((x: any) => x.sessionId === sid);
    check("yakunlangan dars ro'yxatda: status, 2 ta avto-0, xabar hali ketmagan", row?.status === 'yakunlandi' && row.autoZeroCount === 2 && !row.parentNotifiedAt && !!row.parentNotifyAt, JSON.stringify(row));
    check("o'qituvchi ro'yxatni ko'ra olmaydi → 403", (await call(teacher.token, 'GET', '/admin/closed')).status === 403);

    // ── 3) qayta ochish ──
    console.log('\n3) Qayta ochish');
    check("o'qituvchi qayta ocha olmaydi → 403", (await call(teacher.token, 'POST', '/admin/unlock', { groupId: g.id, note: 'x' })).status === 403);
    check('sababsiz → 400', (await call(admin.token, 'POST', '/admin/unlock', { groupId: g.id, note: '' })).status === 400);
    const re = await call(admin.token, 'POST', '/admin/unlock', { groupId: g.id, note: "o'qituvchi adashib yakunlagan" });
    check('admin qayta ochdi', re.status === 200 && re.json.data.status === 'ochiq' && re.json.data.reopen?.from === 'yakunlandi' && re.json.data.reopen.clearedAutoZero === 2, JSON.stringify(re.json?.data?.reopen));
    grades = await prisma.lessonGrade.findMany({ where: { sessionId: sid } });
    check("avto-0 tozalandi, qo'yilgan 'to'liq' saqlandi", grades.filter((x) => x.autoZero).length === 0 && grades.find((x) => x.studentId === st[0].id)?.homework === 'toliq' && grades.filter((x) => x.homework === null).length === 2);
    const s3 = await prisma.lessonSession.findUnique({ where: { id: sid } });
    check('yakunlash va xabar vaqti bekor qilindi, sabab yozildi', !s3?.finalizedAt && !s3?.parentNotifyAt && s3?.unlockNote === "o'qituvchi adashib yakunlagan");
    check('audit jurnalida', !!(await prisma.auditLog.findFirst({ where: { action: 'LESSON_SESSION_REOPEN', targetId: sid } })));
    check("ochiq darsni yana ochib bo'lmaydi → 400", (await call(admin.token, 'POST', '/admin/unlock', { groupId: g.id, note: 'yana' })).status === 400);

    // ── 4) tugatish ──
    console.log('\n4) Tugatish');
    for (const s of st.slice(1)) await call(teacher.token, 'PATCH', `/${sid}/homework`, { studentId: s.id, homework: 'qisman' });
    const fin2 = await call(teacher.token, 'POST', `/${sid}/finalize`);
    grades = await prisma.lessonGrade.findMany({ where: { sessionId: sid } });
    const s4 = await prisma.lessonSession.findUnique({ where: { id: sid } });
    check("qayta yakunlandi, avto-0 yo'q, hammasi baholangan", fin2.status === 200 && grades.every((x) => !x.autoZero && x.homework) && s4?.status === 'yakunlandi');
    check("ota-ona xabari qayta rejalandi (to'g'ri baholar bilan ketadi)", !!s4?.parentNotifyAt && !s4?.parentNotifiedAt);

    // ── 5) xabar ketgan bo'lsa ──
    console.log("\n5) Xabar allaqachon ketgan");
    await prisma.lessonSession.update({ where: { id: sid }, data: { parentNotifiedAt: new Date() } });
    const re2 = await call(admin.token, 'POST', '/admin/unlock', { groupId: g.id, note: 'ikkinchi marta' });
    check("qayta ochildi, 'xabar ketgan' deb aytildi", re2.status === 200 && re2.json.data.reopen?.parentsAlreadyNotified === true);
    await call(teacher.token, 'POST', `/${sid}/finalize`);
    const due = await svc.getSessionsDueForParentNotify();
    check('ota-onaga ikkinchi xabar navbatga tushmaydi', !due.some((x: any) => x.id === sid));

    // ── 6) o'tgan kun ──
    console.log("\n6) O'tgan kun darsi");
    const y = new Date(Date.now() - 86_400_000);
    const yIso = new Date(Date.UTC(y.getUTCFullYear(), y.getUTCMonth(), y.getUTCDate())).toISOString();
    const past = await prisma.lessonSession.create({
      data: {
        groupId: g.id,
        teacherId: teacher.id,
        date: new Date(yIso),
        status: 'avto_yopildi',
        deadlineAt: new Date(Date.now() - 3600_000),
        grades: { create: st.map((s) => ({ studentId: s.id, homework: 'bajarmagan', homeworkScore: 0, autoZero: true })) },
      },
    });
    const todayBefore = await call(teacher.token, 'GET', `/today?groupId=${g.id}`);
    check("qayta ochilmagan kechagi dars panelda chiqmaydi (bugungisi ko'rinadi)", todayBefore.json?.data?.session?.id === sid && !todayBefore.json.data.pastDate, JSON.stringify({ s: todayBefore.json?.data?.session?.id, p: todayBefore.json?.data?.pastDate }));
    const rp = await call(admin.token, 'POST', '/admin/unlock', { groupId: g.id, note: 'kechagi dars', date: yIso });
    check('admin kechagi darsni qayta ochdi', rp.status === 200 && rp.json.data.id === past.id && rp.json.data.status === 'ochiq');
    const todayAfter = await call(teacher.token, 'GET', `/today?groupId=${g.id}`);
    check("o'qituvchi panelida kechagi qayta ochilgan dars chiqadi (sana bilan)", todayAfter.json?.data?.session?.id === past.id && !!todayAfter.json.data.pastDate);
    check("o'qituvchi kechagi darsni baholay oladi", (await call(teacher.token, 'PATCH', `/${past.id}/homework`, { studentId: st[0].id, homework: 'toliq' })).status === 200);
    check('xato javobida stack yo\'q', !JSON.stringify((await call(admin.token, 'POST', '/admin/unlock', { groupId: g.id, note: 'x', date: yIso })).json).includes('    at '));
  } finally {
    const all = ids.users;
    const sessions = (await prisma.lessonSession.findMany({ where: { groupId: { in: ids.groups } }, select: { id: true } })).map((s) => s.id);
    await prisma.coinTransaction.deleteMany({ where: { lessonSessionId: { in: sessions } } });
    await prisma.lessonGrade.deleteMany({ where: { sessionId: { in: sessions } } });
    await prisma.homeworkAssignment.deleteMany({ where: { sessionId: { in: sessions } } }).catch(() => {});
    await prisma.lessonSession.deleteMany({ where: { id: { in: sessions } } });
    await prisma.groupStudent.deleteMany({ where: { groupId: { in: ids.groups } } });
    await prisma.groupMilestone.deleteMany({ where: { groupId: { in: ids.groups } } });
    await prisma.group.deleteMany({ where: { id: { in: ids.groups } } });
    await prisma.notification.deleteMany({ where: { userId: { in: all } } });
    await prisma.auditLog.deleteMany({ where: { OR: [{ userId: { in: all } }, { targetId: { in: [...sessions, ...ids.groups] } }] } });
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
