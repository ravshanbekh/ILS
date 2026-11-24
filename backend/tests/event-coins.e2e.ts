/**
 * Tadbir (chempionat) coini — uchdan-uchgacha sinov (LOKAL baza).
 * Isbotlaydi:
 *   - ruxsati bor foydalanuvchi coin bera oladi (ledger: lessonSessionId = null, sabab saqlanadi);
 *   - berilgan coin kunlik chegaraga qo'shiladi (bugungi yig'indi, Coin nazorati, chegara oshganda xabar);
 *   - ruxsati yo'q foydalanuvchi 403 oladi (o'quvchi, ruxsatsiz kurator/o'qituvchi);
 *   - doiradan tashqaridagi o'quvchiga berib bo'lmaydi (boshqa kurator, to'xtatilgan, nofaol,
 *     o'quvchi bo'lmagan) va bunda hech kimga berilmaydi (hammasi yoki hech narsa);
 *   - javoblarda stack trace va BigInt yo'q.
 * Fixture'lar "ece2e" belgisi bilan, oxirida o'chiriladi. Telegram bot sinovda ishga
 * tushmaydi (botInstance = null) — real xabar ketmaydi.
 *
 * Ishlatish (backend papkasidan):  npm run e2e:event-coins
 */
import http from 'http';

const PORT = Number(process.env.EC_E2E_PORT || 5097);
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
  const { default: routes } = await import('../src/modules/coins/coins.routes');
  const { errorHandler } = await import('../src/shared/middleware/errorHandler');
  const { default: settingsService } = await import('../src/modules/settings/settings.service');

  const app = express();
  app.use(express.json());
  app.use('/api/coins', routes);
  app.use(errorHandler);
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(PORT, r));

  const tag = `ece2e${Date.now().toString(36)}`;
  const startedAt = new Date();
  const ids: string[] = [];
  const mk = async (role: any, name: string, extra: any = {}) => {
    const u = await prisma.user.create({ data: { fullName: `${name} ${tag}`, login: `${tag}_${name.toLowerCase().replace(/\W+/g, '')}`, passwordHash: 'x', role, ...extra } });
    ids.push(u.id);
    return { ...u, token: jwt.sign({ userId: u.id, role, login: u.login, tv: 0 }, env.JWT_SECRET) };
  };
  const enroll = (curatorId: string, studentId: string, status: any = 'faol') =>
    prisma.curatorStudent.create({ data: { curatorId, studentId, demoDate: new Date(), endDate: new Date(Date.now() + 60 * 86400000), status } });
  const call = async (token: string | null, method: string, path: string, body?: unknown) => {
    const r = await fetch(`${BASE}/api/coins${path}`, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    return { status: r.status, text, json: (() => { try { return JSON.parse(text); } catch { return null; } })() as any };
  };
  const ledger = (studentIds: string[]) => prisma.coinTransaction.findMany({ where: { studentId: { in: studentIds } }, orderBy: { createdAt: 'asc' } });

  try {
    const admin = await mk('admin', 'Admin');
    const k1 = await mk('kurator', 'Kurator Bir');
    const k2 = await mk('kurator', 'Kurator Ikki');
    const teacher = await mk('teacher', 'Ustoz');
    const admr = await mk('administrator', 'Resepshn');
    const { coinDailyLimitPerTeacher: limit } = await settingsService.getCoinSettings();
    // Chegarani oshirish uchun yetarli o'z o'quvchilar: (n × 100) > limit + oldingi berilganlar
    const need = Math.min(48, Math.max(3, Math.ceil((limit + 50) / 100) + 1));
    const own: any[] = [];
    for (let i = 0; i < need; i++) {
      const s = await mk('student', `Oquvchi${i}`);
      await enroll(k1.id, s.id);
      own.push(s);
    }
    const foreign = await mk('student', 'Begona');
    await enroll(k2.id, foreign.id);
    const stopped = await mk('student', 'Toxtagan');
    await enroll(k1.id, stopped.id, 'toxtatildi');
    const inactive = await mk('student', 'Nofaol', { isActive: false });
    await enroll(k1.id, inactive.id);
    const loner = await mk('student', 'Kuratorsiz');

    const body = (studentIds: string[], amount = 5, reason = "Chempionat №1 — G'olib") => ({ studentIds, amount, reason });

    console.log('\n1) Ruxsatsiz → 401/403');
    check('tokensiz → 401', (await call(null, 'POST', '/event-award', body([own[0].id]))).status === 401);
    const st = await call(own[0].token, 'POST', '/event-award', body([own[0].id]));
    check("o'quvchi → 403 (roleGuard)", st.status === 403);
    const noPerm = await call(k1.token, 'POST', '/event-award', body([own[0].id]));
    check('ruxsatsiz kurator → 403 (permissionGuard)', noPerm.status === 403 && /ruxsati yo'q/.test(noPerm.json?.error?.message ?? ''), noPerm.json?.error?.message);
    check('ruxsatsiz o\'qituvchi → 403', (await call(teacher.token, 'POST', '/event-award', body([own[0].id]))).status === 403);
    check('ruxsatsiz: context va students ham 403', (await call(k1.token, 'GET', '/event-award/context')).status === 403 && (await call(k1.token, 'GET', '/event-award/students')).status === 403);
    check('xatoda stack trace yo\'q', !noPerm.text.includes('"stack"') && !/\.ts:\d+/.test(noPerm.text));
    check("hech qanday yozuv yaratilmadi", (await ledger([own[0].id])).length === 0);

    await prisma.userPermission.createMany({ data: [{ userId: k1.id, permission: 'event_coins' }, { userId: k2.id, permission: 'event_coins' }, { userId: admr.id, permission: 'event_coins' }, { userId: admr.id, permission: 'coin_oversight' }] });

    console.log('\n2) Ruxsat bilan — kurator o\'z o\'quvchilariga');
    const ctx0 = (await call(k1.token, 'GET', '/event-award/context')).json.data;
    check("kurator doirasi 'own', bugun 0", ctx0.scope === 'own' && ctx0.givenToday === 0 && ctx0.dailyLimit === limit, JSON.stringify(ctx0));
    const list = (await call(k1.token, 'GET', '/event-award/students')).json.data.students.map((s: any) => s.id);
    check("tanlash ro'yxati: faqat o'z faol o'quvchilari", list.length === own.length && own.every((s) => list.includes(s.id)) && !list.includes(foreign.id) && !list.includes(stopped.id) && !list.includes(inactive.id));
    const sres = await call(k1.token, 'GET', '/event-award/students');
    check("ro'yxatda telegram/BigInt maydonlari yo'q", !/telegram|chatId/i.test(sres.text));
    const a1 = await call(k1.token, 'POST', '/event-award', body([own[0].id, own[1].id, own[0].id]));
    check('2 o\'quvchiga 5 coin (takror ID bitta hisoblanadi)', a1.status === 200 && a1.json.data.awarded === 2 && a1.json.data.total === 10, a1.text.slice(0, 200));
    const rows = await ledger([own[0].id, own[1].id]);
    check("ledger: lessonSessionId = null, shopOrderId = null, sabab saqlandi, beruvchi = kurator", rows.length === 2 && rows.every((r) => r.lessonSessionId === null && r.shopOrderId === null && r.reason === "Tadbir: Chempionat №1 — G'olib" && r.teacherId === k1.id && r.amount === 5));
    check('bir tadbir — bir xil vaqt belgisi', rows[0].createdAt.getTime() === rows[1].createdAt.getTime());
    check('javobda balans', a1.json.data.students.every((s: any) => s.balance === 5));
    const audit = await prisma.auditLog.findFirst({ where: { userId: k1.id, action: 'EVENT_COIN_AWARD' } });
    check('audit jurnaliga yozildi', !!audit);

    console.log("\n3) Kunlik chegaraga qo'shiladi");
    const ctx1 = (await call(k1.token, 'GET', '/event-award/context')).json.data;
    check("bugungi yig'indi +10", ctx1.givenToday === 10, String(ctx1.givenToday));
    const ts = (await call(admin.token, 'GET', '/teacher-stats?period=today')).json.data;
    const k1row = ts.teachers.find((t: any) => t.teacherId === k1.id);
    check("Coin nazorati: kurator ham ro'yxatda, bugun 10", k1row?.total === 10 && k1row?.role === 'kurator', JSON.stringify(k1row));
    const big = await call(k1.token, 'POST', '/event-award', body(own.map((s) => s.id), 100, 'Chempionat — Shaxsiy rekord'));
    check('katta tadbir ham beriladi va chegaradan oshgani qaytadi', big.status === 200 && big.json.data.overLimit === true && big.json.data.givenToday === 10 + own.length * 100, big.text.slice(0, 160));
    let notified = false;
    for (let i = 0; i < 20 && !notified; i++) {
      notified = !!(await prisma.notification.findFirst({ where: { userId: admin.id, type: 'coin_limit_exceeded', body: { contains: tag } } }));
      if (!notified) await new Promise((r) => setTimeout(r, 150));
    }
    check('chegara oshganda adminga bildirishnoma (checkTeacherLimit)', notified);

    console.log('\n4) Doiradan tashqari — hech kimga berilmaydi');
    const before = (await ledger([own[2].id])).length;
    const f1 = await call(k1.token, 'POST', '/event-award', body([own[2].id, foreign.id]));
    check("boshqa kuratorning o'quvchisi → 403", f1.status === 403, f1.json?.error?.message);
    check("hammasi yoki hech narsa: o'z o'quvchisiga ham berilmadi", (await ledger([own[2].id])).length === before);
    check("begona o'quvchiga yozuv yo'q", (await ledger([foreign.id])).length === 0);
    check("to'xtatilgan o'quvchi → 403", (await call(k1.token, 'POST', '/event-award', body([stopped.id]))).status === 403);
    check('nofaol o\'quvchi → 403', (await call(k1.token, 'POST', '/event-award', body([inactive.id]))).status === 403);
    check("kuratorsiz o'quvchi → 403", (await call(k1.token, 'POST', '/event-award', body([loner.id]))).status === 403);
    check("o'quvchi bo'lmagan ID (o'qituvchi) → 403", (await call(k1.token, 'POST', '/event-award', body([teacher.id]))).status === 403);
    check('k2 ham k1 o\'quvchisiga bera olmaydi → 403', (await call(k2.token, 'POST', '/event-award', body([own[0].id]))).status === 403);

    console.log('\n5) Tekshiruvlar (400)');
    check('sababsiz → 400', (await call(k1.token, 'POST', '/event-award', body([own[0].id], 5, '  '))).status === 400);
    check('miqdor 0 → 400', (await call(k1.token, 'POST', '/event-award', body([own[0].id], 0))).status === 400);
    check('miqdor 101 → 400', (await call(k1.token, 'POST', '/event-award', body([own[0].id], 101))).status === 400);
    check('kasr miqdor → 400', (await call(k1.token, 'POST', '/event-award', body([own[0].id], 2.5))).status === 400);
    check("bo'sh ro'yxat → 400", (await call(k1.token, 'POST', '/event-award', body([]))).status === 400);
    check("noto'g'ri ID → 400", (await call(k1.token, 'POST', '/event-award', body(['abc']))).status === 400);

    console.log("\n6) Admin va 'Coin nazorati' egasi — istalgan faol o'quvchi");
    const ad = await call(admin.token, 'POST', '/event-award', body([loner.id, foreign.id], 3, 'Jamoa ruhi'));
    check('admin (ruxsatsiz ham) istalgan faol o\'quvchiga beradi', ad.status === 200 && ad.json.data.awarded === 2);
    check('admin ham nofaolga bera olmaydi → 403', (await call(admin.token, 'POST', '/event-award', body([inactive.id]))).status === 403);
    const adm = await call(admr.token, 'GET', '/event-award/context');
    check("event_coins + coin_oversight → doira 'all'", adm.json.data.scope === 'all');
    check('qidiruv: kamida 2 harf', (await call(admr.token, 'GET', '/event-award/students?q=a')).json.data.students.length === 0);
    const found = (await call(admr.token, 'GET', `/event-award/students?q=${tag}`)).json.data.students.map((s: any) => s.id);
    check("qidiruv: faqat faol o'quvchilar", found.includes(loner.id) && found.includes(foreign.id) && !found.includes(inactive.id) && !found.includes(teacher.id));
    check('administrator beradi', (await call(admr.token, 'POST', '/event-award', body([loner.id], 2, 'Live Quiz g\'olibi'))).status === 200);

    console.log('\n7) Coin nazorati — sababi bilan');
    check("kurator (coin_oversight siz) ro'yxatni ko'ra olmaydi → 403", (await call(k1.token, 'GET', '/event-awards')).status === 403);
    const ev = (await call(admin.token, 'GET', '/event-awards?period=today')).json.data;
    const mine = ev.awards.filter((a: any) => [k1.id, admin.id, admr.id].includes(a.giverId));
    const champ = mine.find((a: any) => a.reason === "Chempionat №1 — G'olib");
    check("tadbirlar sabab bilan guruhlangan", mine.length === 4 && champ?.students.length === 2 && champ?.total === 10 && champ?.giverRole === 'kurator', JSON.stringify(mine.map((a: any) => [a.reason, a.students.length])));
    check("o'quvchi tarixida sabab ko'rinadi", (await prisma.coinTransaction.findFirst({ where: { studentId: own[0].id, reason: { startsWith: 'Tadbir:' } } }))?.reason?.includes('Chempionat'));
  } finally {
    await prisma.notification.deleteMany({ where: { type: 'coin_limit_exceeded', createdAt: { gte: startedAt }, body: { contains: tag } } });
    await prisma.coinTransaction.deleteMany({ where: { OR: [{ studentId: { in: ids } }, { teacherId: { in: ids } }] } });
    await prisma.curatorStudent.deleteMany({ where: { OR: [{ studentId: { in: ids } }, { curatorId: { in: ids } }] } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: ids } } });
    await prisma.userPermission.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
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
