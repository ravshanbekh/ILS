/**
 * O'quvchi kirishini yopish/ochish — uchdan-uchgacha sinov (lokal baza).
 *
 * Haqiqiy login, token yangilash va authenticate bilan: mentor yopadi →
 * ochiq sessiya darhol tugaydi, qayta kirib bo'lmaydi (sabab aytilmaydi),
 * o'quvchi guruhda qoladi; ochilgach yana kira oladi. Egalik (o'z guruhi),
 * ruxsat, o'quvchiga yopiqligi, audit.
 * Fixture'lar "sae2e" belgisi bilan yaratiladi va oxirida o'chiriladi.
 *
 * Ishlatish (backend papkasidan, LOKAL baza bilan):  npm run e2e:student-access
 */
import http from 'http';

const PORT = Number(process.env.SA_E2E_PORT || 5096);
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
  const bcrypt = (await import('bcryptjs')).default;
  const jwt = (await import('jsonwebtoken')).default;
  const { default: prisma } = await import('../src/config/database');
  const { env } = await import('../src/config/env');
  const { default: authRoutes } = await import('../src/modules/auth/auth.routes');
  const { default: studentAccessRoutes } = await import('../src/modules/student-access/student-access.routes');
  const { authenticate } = await import('../src/shared/middleware/auth.middleware');
  const { errorHandler } = await import('../src/shared/middleware/errorHandler');
  const { STUDENT_ACCESS_BLOCKED_MESSAGE } = await import('../src/shared/constants/studentAccess');

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/student-access', studentAccessRoutes);
  app.get('/api/probe', authenticate, (_req, res) => res.json({ success: true })); // istalgan himoyalangan yo'l
  app.use(errorHandler);
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(PORT, r));

  const tag = `sae2e${Date.now().toString(36)}`;
  const PWD = 'Sinov-parol-42';
  const hash = await bcrypt.hash(PWD, 4);
  const ids: string[] = [];
  const groupIds: string[] = [];
  const mk = async (role: any, name: string) => {
    const u = await prisma.user.create({ data: { fullName: name, login: `${tag}_${name.toLowerCase().replace(/\W+/g, '')}`, passwordHash: hash, role } });
    ids.push(u.id);
    return { ...u, token: jwt.sign({ userId: u.id, role, login: u.login, tv: 0 }, env.JWT_SECRET) };
  };
  const call = async (method: string, path: string, token?: string, body?: unknown) => {
    const r = await fetch(`${BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, json: (await r.json().catch(() => null)) as any };
  };

  try {
    const admin = await mk('admin', 'Admin');
    const t1 = await mk('teacher', 'Ustoz Bir');
    const t2 = await mk('teacher', 'Ustoz Ikki');
    const noPerm = await mk('teacher', 'Ustoz Ruxsatsiz');
    const admr = await mk('administrator', 'Resepshn');
    const s1 = await mk('student', 'Oquvchi Bir');
    const s2 = await mk('student', 'Oquvchi Ikki');
    const s3 = await mk('student', 'Oquvchi Uch');
    const gA = await prisma.group.create({ data: { name: `${tag}-A`, teacherId: t1.id } });
    const gB = await prisma.group.create({ data: { name: `${tag}-B`, teacherId: t2.id } });
    groupIds.push(gA.id, gB.id);
    await prisma.groupStudent.createMany({ data: [{ groupId: gA.id, studentId: s1.id }, { groupId: gA.id, studentId: s2.id }, { groupId: gB.id, studentId: s3.id }] });
    // Ruxsat: o'qituvchilarda standart (legacyRoles) — bu yerda qo'lda; administratorga ham qo'lda
    await prisma.userPermission.createMany({
      data: [t1, t2, admr].map((u) => ({ userId: u.id, permission: 'student_access_block', grantedById: admin.id } as any)),
    });

    console.log('\n1) Boshlang\'ich holat');
    const login1 = await call('POST', '/api/auth/login', undefined, { login: s1.login, password: PWD });
    check('o\'quvchi kira oladi', login1.status === 200 && !!login1.json?.data?.accessToken, login1.json?.error?.message);
    const sAccess = login1.json?.data?.accessToken as string;
    const sRefresh = login1.json?.data?.refreshToken as string;
    check('token bilan so\'rov ishlaydi', (await call('GET', '/api/probe', sAccess)).status === 200);

    console.log('\n2) Kim yopa oladi');
    check('o\'quvchi bu yo\'lga kira olmaydi', (await call('GET', '/api/student-access/blocked', s2.token)).status === 403);
    check('ruxsatsiz o\'qituvchi yopa olmaydi', (await call('POST', `/api/student-access/${s1.id}/block`, noPerm.token, { reason: 'payment' })).status === 403);
    const foreign = await call('POST', `/api/student-access/${s3.id}/block`, t1.token, { reason: 'payment' });
    check('o\'qituvchi boshqa guruh o\'quvchisini yopa olmaydi', foreign.status === 403 && /guruhingizda emas/.test(foreign.json?.error?.message ?? ''));
    check('o\'qituvchi boshqa guruh holatini ko\'ra olmaydi', (await call('GET', `/api/student-access/group/${gB.id}`, t1.token)).status === 403);
    check('o\'quvchi bo\'lmagan odamni yopib bo\'lmaydi', (await call('POST', `/api/student-access/${t2.id}/block`, admin.token, { reason: 'other' })).status === 404);
    check('noto\'g\'ri sabab → 400', (await call('POST', `/api/student-access/${s1.id}/block`, t1.token, { reason: 'qarz' })).status === 400);
    check('noto\'g\'ri ID → 400', (await call('POST', '/api/student-access/emas-uuid/block', t1.token, {})).status === 400);

    console.log('\n3) Yopish');
    const tvBefore = (await prisma.user.findUnique({ where: { id: s1.id } }))!.tokenVersion;
    const b = await call('POST', `/api/student-access/${s1.id}/block`, t1.token, { reason: 'payment', note: '  noyabr   oyi ' });
    check('mentor o\'z o\'quvchisini yopdi', b.status === 200 && b.json?.data?.blocked === true && b.json.data.reason === 'payment' && b.json.data.note === 'noyabr oyi', JSON.stringify(b.json?.data));
    check('kim yopgani ko\'rinadi', b.json?.data?.blockedBy?.fullName === 'Ustoz Bir');
    check('ochiq sessiya darhol tugadi', (await call('GET', '/api/probe', sAccess)).status === 401);
    const ref = await call('POST', '/api/auth/refresh', undefined, { refreshToken: sRefresh });
    check('token yangilab bo\'lmaydi', ref.status === 401);
    const relog = await call('POST', '/api/auth/login', undefined, { login: s1.login, password: PWD });
    check('to\'g\'ri parol bilan ham kira olmaydi (403)', relog.status === 403 && relog.json?.error?.message === STUDENT_ACCESS_BLOCKED_MESSAGE, relog.json?.error?.message);
    check('xabarda sabab ("to\'lov") aytilmaydi', !/to.?lov|pul|qarz/i.test(relog.json?.error?.message ?? ''));
    const wrong = await call('POST', '/api/auth/login', undefined, { login: s1.login, password: 'notogri-parol' });
    check('noto\'g\'ri parolda holat oshkor bo\'lmaydi (oddiy 401)', wrong.status === 401 && !/cheklangan/.test(wrong.json?.error?.message ?? ''));
    const fresh = jwt.sign({ userId: s1.id, role: 'student', login: s1.login, tv: tvBefore + 1 }, env.JWT_SECRET);
    check('yangi versiyali token ham rad etiladi (ikkinchi qatlam)', (await call('GET', '/api/probe', fresh)).status === 401);
    const inGroup = await prisma.groupStudent.findFirst({ where: { groupId: gA.id, studentId: s1.id } });
    const s1row = await prisma.user.findUnique({ where: { id: s1.id } });
    check('o\'quvchi guruhda qoladi va isActive o\'zgarmaydi', !!inGroup && s1row?.isActive === true);
    check('boshqa o\'quvchi bemalol ishlaydi', (await call('GET', '/api/probe', s2.token)).status === 200);

    const again = await call('POST', `/api/student-access/${s1.id}/block`, t1.token, { reason: 'other' });
    const s1after = await prisma.user.findUnique({ where: { id: s1.id } });
    check('qayta yopish: vaqt saqlanadi, sabab yangilanadi, token versiyasi qayta oshmaydi', again.status === 200 && s1after?.accessBlockReason === 'other' && s1after.tokenVersion === tvBefore + 1 && +s1after.accessBlockedAt! === +s1row!.accessBlockedAt!);

    console.log('\n4) Ko\'rish');
    const gs = await call('GET', `/api/student-access/group/${gA.id}`, t1.token);
    check('guruh holati: faqat yopilgan o\'quvchi', gs.status === 200 && gs.json?.data?.[s1.id]?.blocked === true && !gs.json.data[s2.id], JSON.stringify(gs.json?.data).slice(0, 120));
    await call('POST', `/api/student-access/${s3.id}/block`, t2.token, { reason: 'payment' });
    const l1 = await call('GET', '/api/student-access/blocked', t1.token);
    check('o\'qituvchi ro\'yxati — faqat o\'z guruhlari', l1.json?.data?.some((x: any) => x.id === s1.id) && !l1.json.data.some((x: any) => x.id === s3.id));
    const la = await call('GET', '/api/student-access/blocked', admin.token);
    check('admin — hammasi (guruh nomi bilan)', [s1.id, s3.id].every((id) => la.json?.data?.some((x: any) => x.id === id)) && la.json.data.find((x: any) => x.id === s1.id)?.groups?.[0]?.name === `${tag}-A`);
    check('ruxsat berilgan administrator istalgan o\'quvchini ocha oladi', (await call('POST', `/api/student-access/${s3.id}/unblock`, admr.token)).status === 200);

    console.log('\n5) Ochish');
    const u = await call('POST', `/api/student-access/${s1.id}/unblock`, t1.token);
    check('mentor ochdi', u.status === 200 && u.json?.data?.blocked === false);
    const back = await call('POST', '/api/auth/login', undefined, { login: s1.login, password: PWD });
    check('o\'quvchi yana kira oladi', back.status === 200 && (await call('GET', '/api/probe', back.json?.data?.accessToken)).status === 200, back.json?.error?.message);
    check('ochiq o\'quvchini ochish — xatosiz', (await call('POST', `/api/student-access/${s1.id}/unblock`, t1.token)).status === 200);
    const audits = await prisma.auditLog.findMany({ where: { targetId: s1.id, action: { in: ['STUDENT_ACCESS_BLOCKED', 'STUDENT_ACCESS_UNBLOCKED'] } } });
    check('audit: 2 ta yopish, 1 ta ochish (bo\'sh ochish yozilmaydi)', audits.filter((a) => a.action === 'STUDENT_ACCESS_BLOCKED').length === 2 && audits.filter((a) => a.action === 'STUDENT_ACCESS_UNBLOCKED').length === 1);
  } finally {
    await prisma.auditLog.deleteMany({ where: { OR: [{ userId: { in: ids } }, { targetId: { in: ids } }] } });
    await prisma.userPermission.deleteMany({ where: { userId: { in: ids } } });
    await prisma.groupStudent.deleteMany({ where: { groupId: { in: groupIds } } });
    await prisma.group.deleteMany({ where: { id: { in: groupIds } } });
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
