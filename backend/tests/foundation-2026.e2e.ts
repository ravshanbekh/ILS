/**
 * Foundation 2026 ga o'tish + arxiv + boshlanish sanasi — uchdan-uchgacha sinov (LOKAL baza).
 *
 *  1) reja (preview): yaratiladigan / eskisi bilan bir xil / arxivlanadigan / guruh tavsiyasi
 *  2) qo'llash: yangi to'plam, bir xillar natijasi bilan saqlanadi, eskilari arxivda, 50+ WPM, rasm havolasi
 *  3) idempotentlik: qayta qo'llash hech narsani takrorlamaydi
 *  4) arxiv: topshirish yopiq, deadline rejasiga kirmaydi, natijalar joyida, faqat admin arxivlaydi
 *  5) normativlar ro'yxati 100 dan ko'p qaytaradi
 *  6) boshlanish sanasi: o'qituvchi o'z guruhiga bir marta, boshqasiga 404, admin istalgan payt
 *
 * Bazada "Foundation" yoki "Foundation 2026" yo'nalishi bo'lsa — sinov ishga tushmaydi (haqiqiy ma'lumotga tegmaslik uchun).
 * Ishlatish (backend papkasidan):  npm run e2e:foundation-2026
 */
import http from 'http';

const PORT = Number(process.env.F26_E2E_PORT || 5098);
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
  const { default: normativesRoutes } = await import('../src/modules/normatives/normatives.routes');
  const { default: groupsRoutes } = await import('../src/modules/groups/groups.routes');
  const { default: submissionsService } = await import('../src/modules/submissions/submissions.service');
  const nd = await import('../src/modules/normative-deadlines/normative-deadlines.service');
  const seed = (await import('../src/modules/normatives/foundation-2026.seed.json')).default;

  const clash = await prisma.category.findMany({ where: { name: { in: ['Foundation', 'Foundation 2026'], mode: 'insensitive' } } });
  if (clash.length) {
    console.log(`To'xtatildi: lokal bazada ${clash.map((c) => c.name).join(', ')} yo'nalishi bor — haqiqiy ma'lumotga tegmaslik uchun sinov ishlamaydi.`);
    process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }

  const app = express();
  app.use(express.json());
  app.use('/api/normatives', normativesRoutes);
  app.use('/api/groups', groupsRoutes);
  app.use(errorHandler);
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(PORT, r));

  const tag = `f26e2e${Date.now().toString(36)}`;
  const ids = { users: [] as string[], groups: [] as string[], cats: [] as string[] };
  const tokenOf = (u: { id: string; role: string; login: string }) => jwt.sign({ userId: u.id, role: u.role, login: u.login, tv: 0 }, env.JWT_SECRET);
  const mk = async (role: any, name: string) => {
    const u = await prisma.user.create({ data: { fullName: `${name} ${tag}`, login: `${tag}_${name.toLowerCase().replace(/\W+/g, '')}`, passwordHash: 'x', role } });
    ids.users.push(u.id);
    return { ...u, token: tokenOf(u) };
  };
  const call = async (token: string | null, method: string, path: string, body?: unknown) => {
    const r = await fetch(`${BASE}/api${path}`, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, json: (await r.json().catch(() => null)) as any };
  };

  try {
    const admin = await mk('admin', 'Admin');
    const t1 = await mk('teacher', 'Ustoz Bir');
    const t2 = await mk('teacher', 'Ustoz Ikki');
    const s1 = await mk('student', 'Oquvchi Bir');
    const s2 = await mk('student', 'Oquvchi Ikki');

    // Eski "Foundation" (2026-10-08 eksportidagi kabi): №1, №4, №11 (Demo day 1), №31 (nofaol), №33 (Demo day 2)
    const oldCat = await prisma.category.create({ data: { name: 'Foundation' } });
    const feCat = await prisma.category.create({ data: { name: `Frontend ${tag}` } });
    ids.cats.push(oldCat.id, feCat.id);
    const mkN = (taskNumber: number, title: string, categoryId: string, isActive = true) =>
      prisma.normative.create({ data: { taskNumber, title, categoryId, isActive, maxScore: 20 } });
    const o1 = await mkN(1, 'Tez yozish', oldCat.id);
    const o4 = await mkN(4, 'Texnologiya: Word', oldCat.id);
    const o11 = await mkN(11, 'Demo day  -  1', oldCat.id);
    const o31 = await mkN(31, 'SQL (nofaol)', oldCat.id, false);
    const o33 = await mkN(33, 'Demo day - 2', oldCat.id);
    const fe34 = await mkN(34, 'D: diskdan resurslar', feCat.id);

    const gF = await prisma.group.create({ data: { name: `GF ${tag}`.slice(0, 50), teacherId: t1.id } });
    const gFE = await prisma.group.create({ data: { name: `GFE ${tag}`.slice(0, 50), teacherId: t2.id, startDate: new Date('2026-09-01T00:00:00Z') } });
    const gN = await prisma.group.create({ data: { name: `GN ${tag}`.slice(0, 50), teacherId: t2.id } });
    ids.groups.push(gF.id, gFE.id, gN.id);
    await prisma.groupNormative.createMany({
      data: [o1, o4, o11, o33].map((n) => ({ groupId: gF.id, normativeId: n.id })).concat([o1, fe34].map((n) => ({ groupId: gFE.id, normativeId: n.id }))),
    });
    await prisma.groupStudent.createMany({ data: [{ groupId: gF.id, studentId: s1.id }, { groupId: gF.id, studentId: s2.id }] });
    const subOld1 = await prisma.submission.create({ data: { studentId: s1.id, normativeId: o1.id, groupId: gF.id, youtubeUrl: 'https://youtu.be/a', status: 'checked', result: 'green', score: 20 } });
    const subOld11 = await prisma.submission.create({ data: { studentId: s1.id, normativeId: o11.id, groupId: gF.id, youtubeUrl: 'https://youtu.be/b', status: 'checked', result: 'blue', score: 15 } });

    // ── 1) reja ──
    console.log('\n1) Reja (oldindan ko\'rish)');
    check('tokensiz → 401', (await call(null, 'GET', '/normatives/foundation-2026/plan')).status === 401);
    check("o'qituvchi → 403", (await call(t1.token, 'GET', '/normatives/foundation-2026/plan')).status === 403);
    const pl = await call(admin.token, 'GET', '/normatives/foundation-2026/plan');
    const p = pl.json?.data;
    check('admin → 200', pl.status === 200);
    check('33 ta yangi yaratiladi (35 − 2 ta bir xil)', p?.create.length === 33, String(p?.create.length));
    check('bir xillar: 13 ← eski №11, 35 ← eski №33', p?.keep.length === 2 && p.keep.every((k: any) => k.old) && p.keep.find((k: any) => k.taskNumber === 13)?.old.taskNumber === 11);
    check('arxivga: №1 va №4 (nofaol №31 va bir xillar emas)', p?.archive.map((a: any) => a.taskNumber).sort().join() === '1,4', JSON.stringify(p?.archive.map((a: any) => a.taskNumber)));
    const gRow = (id: string) => p?.groups.find((g: any) => g.id === id);
    check('tavsiya: GF (faqat Foundation) — ha', gRow(gF.id)?.suggested === true);
    check("tavsiya: GFE (Frontend ham bor) — yo'q", gRow(gFE.id)?.suggested === false && gRow(gFE.id)?.otherCategories.length === 1);
    check("tavsiya: GN (normativsiz) — yo'q", gRow(gN.id)?.suggested === false);
    check("reja bazaga yozmaydi", (await prisma.category.count({ where: { name: 'Foundation 2026' } })) === 0);

    // ── 2) qo'llash ──
    console.log("\n2) Qo'llash");
    check("noto'g'ri guruh ID → 400", (await call(admin.token, 'POST', '/normatives/foundation-2026/apply', { groupIds: ['abc'] })).status === 400);
    check("o'qituvchi qo'llay olmaydi → 403", (await call(t1.token, 'POST', '/normatives/foundation-2026/apply', { groupIds: [gF.id] })).status === 403);
    const ap = await call(admin.token, 'POST', '/normatives/foundation-2026/apply', { groupIds: [gF.id] });
    const sm = ap.json?.data;
    check('qo\'llandi: 33 yaratildi, 2 saqlandi, 2 arxivlandi', ap.status === 200 && sm.created === 33 && sm.kept === 2 && sm.archived === 2, JSON.stringify(sm));
    const newCat = await prisma.category.findUnique({ where: { name: 'Foundation 2026' } });
    if (newCat) ids.cats.push(newCat.id);
    const set = await prisma.normative.findMany({ where: { categoryId: newCat!.id }, orderBy: { taskNumber: 'asc' } });
    check("yangi to'plam 35 ta, raqamlar 1–35", set.length === 35 && set.map((n) => n.taskNumber).join() === Array.from({ length: 35 }, (_, i) => i + 1).join());
    const k13 = set.find((n) => n.taskNumber === 13)!;
    check('№13 = eski Demo day 1 (o\'sha yozuv, nomi tegilmagan)', k13.id === o11.id && k13.title === o11.title);
    check("eski Demo day 1 natijasi joyida (ball 15)", (await prisma.submission.findUnique({ where: { id: subOld11.id } }))?.score === 15);
    check('№35 = eski Demo day 2', set.find((n) => n.taskNumber === 35)?.id === o33.id);
    const f2 = set.find((n) => n.taskNumber === 2)!;
    check('2-normativ: 50+ WPM (45 emas)', f2.description!.includes('50+ WPM') && !f2.description!.includes('45+ WPM'));
    const f6 = set.find((n) => n.taskNumber === 6)!;
    check('6-normativ: eski Word namunasi GitHub rasmi', f6.url === 'https://github.com/ITLivementor/Foundation/blob/main/normative-4/normative-4.jpg' && f6.description!.includes('normative-6'));
    const a1 = await prisma.normative.findUnique({ where: { id: o1.id } });
    check("eski №1 arxivda, faol (o'chirilmagan), natijasi joyida", !!a1?.archivedAt && a1.isActive && (await prisma.submission.findUnique({ where: { id: subOld1.id } }))?.score === 20);
    check('nofaol №31 arxivlanmadi (o\'chirilgan holicha)', !(await prisma.normative.findUnique({ where: { id: o31.id } }))?.archivedAt);
    check("Frontend normativiga tegilmadi", !(await prisma.normative.findUnique({ where: { id: fe34.id } }))?.archivedAt);
    const gfSet = await prisma.groupNormative.findMany({ where: { groupId: gF.id }, select: { normativeId: true } });
    check("GF: 35 yangi + 2 eski arxiv biriktirishi (eskisi o'chmagan)", gfSet.length === 37, String(gfSet.length));
    check('GFE ga biriktirilmadi', (await prisma.groupNormative.count({ where: { groupId: gFE.id } })) === 2);
    check('audit jurnalida', !!(await prisma.auditLog.findFirst({ where: { userId: admin.id, action: 'FOUNDATION_2026_MIGRATION' } })));

    // ── 3) idempotent ──
    console.log('\n3) Qayta qo\'llash');
    const p2 = (await call(admin.token, 'GET', '/normatives/foundation-2026/plan')).json.data;
    check("reja endi bo'sh: yaratish 0, arxiv 0, bir xillar ko'chirilgan", p2.create.length === 0 && p2.archive.length === 0 && p2.keep.length === 0 && !!p2.applied);
    const ap2 = (await call(admin.token, 'POST', '/normatives/foundation-2026/apply', { groupIds: [gF.id] })).json.data;
    check('qayta qo\'llash: 0 yaratildi, 0 arxivlandi, 0 biriktirildi', ap2.created === 0 && ap2.archived === 0 && ap2.assigned === 0, JSON.stringify(ap2));
    check("normativlar soni o'zgarmadi", (await prisma.normative.count({ where: { categoryId: newCat!.id } })) === 35);

    // ── 4) arxiv ──
    console.log('\n4) Arxiv');
    let blocked = '';
    try {
      await submissionsService.create(s2.id, { normativeId: o4.id, youtubeUrl: 'https://youtu.be/c' } as any);
    } catch (e: any) {
      blocked = e.message;
    }
    check('arxivdagi normativga topshirish yopiq', blocked.includes('arxivlangan'), blocked);
    const okSub = await submissionsService.create(s2.id, { normativeId: f2.id, youtubeUrl: 'https://youtu.be/d' } as any);
    check('yangi normativga topshirish ishlaydi', !!okSub?.id);
    const pv: any = await nd.preview({ userId: admin.id, role: 'admin' }, (() => {
      const d = new Date();
      const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 14));
      const wd = t.getUTCDay();
      t.setUTCDate(t.getUTCDate() + (wd === 0 ? -6 : 1 - wd));
      return t.toISOString().slice(0, 10);
    })(), 2);
    const pvF = pv.groups.find((g: any) => g.id === gF.id);
    check("deadline rejasi: arxivdagilar kirmaydi (GF da 35 ta)", pvF?.normatives === 35, String(pvF?.normatives));
    check("GF ogohlantirishi: boshlanish sanasi yo'q", pvF?.warnings.some((w: string) => w.includes('boshlanish sanasi')));
    check("o'qituvchi arxivlay olmaydi → 403", (await call(t1.token, 'PUT', `/normatives/${o4.id}`, { archived: false })).status === 403);
    const un = await call(admin.token, 'PUT', `/normatives/${o4.id}`, { archived: false });
    check('admin arxivdan chiqaradi', un.status === 200 && !(await prisma.normative.findUnique({ where: { id: o4.id } }))?.archivedAt);
    const re = await call(admin.token, 'PUT', `/normatives/${o4.id}`, { archived: true });
    check('admin qayta arxivlaydi', re.status === 200 && !!(await prisma.normative.findUnique({ where: { id: o4.id } }))?.archivedAt);
    const list = await call(s1.token, 'GET', '/normatives?page=1&limit=500');
    const listed = list.json?.data?.find((n: any) => n.id === o1.id);
    check("ro'yxatda arxivdagi normativ archivedAt bilan keladi (o'quvchi sahifasi xira ko'rsatadi)", !!listed?.archivedAt);

    // ── 5) ro'yxat chegarasi ──
    console.log("\n5) Normativlar ro'yxati");
    check("limit=500 so'ralsa 100 ga kesilmaydi", list.json?.meta?.limit === 500 || list.json?.pagination?.limit === 500, JSON.stringify(list.json?.meta ?? list.json?.pagination));

    // ── 6) boshlanish sanasi ──
    console.log('\n6) Boshlanish sanasi');
    const miss1 = await call(t1.token, 'GET', '/groups/start-date/missing');
    check("o'qituvchi: faqat o'z guruhi (GF)", miss1.status === 200 && miss1.json.data.map((g: any) => g.id).join() === gF.id, JSON.stringify(miss1.json?.data));
    const miss2 = await call(t2.token, 'GET', '/groups/start-date/missing');
    check("ikkinchi o'qituvchi: GN (GFE da sana bor)", miss2.json.data.map((g: any) => g.id).join() === gN.id);
    check("o'quvchi → 403", (await call(s1.token, 'GET', '/groups/start-date/missing')).status === 403);
    check("boshqa o'qituvchi guruhi → 404 (IDOR)", (await call(t2.token, 'PATCH', `/groups/${gF.id}/start-date`, { startDate: '2026-10-01' })).status === 404);
    check("noto'g'ri sana → 400", (await call(t1.token, 'PATCH', `/groups/${gF.id}/start-date`, { startDate: '2026-02-31' })).status === 400);
    const set1 = await call(t1.token, 'PATCH', `/groups/${gF.id}/start-date`, { startDate: '2026-10-01' });
    check("o'qituvchi o'z guruhiga kiritdi", set1.status === 200 && (await prisma.group.findUnique({ where: { id: gF.id } }))?.startDate?.toISOString().slice(0, 10) === '2026-10-01');
    check('kiritilgach bildirishnoma ro\'yxatidan chiqdi', (await call(t1.token, 'GET', '/groups/start-date/missing')).json.data.length === 0);
    check("o'qituvchi ikkinchi marta o'zgartira olmaydi → 403", (await call(t1.token, 'PATCH', `/groups/${gF.id}/start-date`, { startDate: '2026-10-05' })).status === 403);
    check('admin istalgan payt o\'zgartiradi', (await call(admin.token, 'PATCH', `/groups/${gF.id}/start-date`, { startDate: '2026-10-05' })).status === 200);
    check('audit jurnalida', (await prisma.auditLog.count({ where: { action: 'SET_GROUP_START_DATE', targetId: gF.id } })) === 2);
    check('xato javobida stack yo\'q', !JSON.stringify((await call(t1.token, 'PATCH', `/groups/${gF.id}/start-date`, { startDate: '2026-10-05' })).json).includes('    at '));
    check('seed: versiya va 35 ta', seed.normatives.length === 35);

    console.log('\n7) Guruh bitirdi');
    check("boshqa o'qituvchi guruhini bitirgan qila olmaydi → 404", (await call(t2.token, 'POST', `/groups/${gF.id}/graduate`)).status === 404);
    check("o'quvchi → 403", (await call(s1.token, 'POST', `/groups/${gN.id}/graduate`)).status === 403);
    const gr = await call(t2.token, 'POST', `/groups/${gN.id}/graduate`);
    const gNa = await prisma.group.findUnique({ where: { id: gN.id } });
    check("o'qituvchi o'z guruhini 'bitirdi' deb belgiladi (arxiv, nofaol)", gr.status === 200 && !!gNa?.graduatedAt && gNa.isActive === false);
    check('bitirgan guruh bildirishnomadan chiqdi', (await call(t2.token, 'GET', '/groups/start-date/missing')).json.data.length === 0);
    check("o'qituvchi arxivdan qaytara olmaydi → 403", (await call(t2.token, 'POST', `/groups/${gN.id}/ungraduate`)).status === 403);
    check('admin qaytaradi', (await call(admin.token, 'POST', `/groups/${gN.id}/ungraduate`)).status === 200);
  } finally {
    const created = await prisma.user.findMany({ where: { login: { startsWith: tag } }, select: { id: true } });
    const all = [...new Set([...ids.users, ...created.map((u) => u.id)])];
    const cats = await prisma.category.findMany({ where: { OR: [{ id: { in: ids.cats } }, { name: { in: ['Foundation', 'Foundation 2026'] } }] }, select: { id: true } });
    const catIds = cats.map((c) => c.id);
    const normIds = (await prisma.normative.findMany({ where: { categoryId: { in: catIds } }, select: { id: true } })).map((n) => n.id);
    await prisma.notification.deleteMany({ where: { userId: { in: all } } });
    await prisma.submission.deleteMany({ where: { OR: [{ studentId: { in: all } }, { normativeId: { in: normIds } }] } });
    await prisma.normativeDeadline.deleteMany({ where: { OR: [{ groupId: { in: ids.groups } }, { normativeId: { in: normIds } }] } });
    await prisma.groupNormative.deleteMany({ where: { OR: [{ groupId: { in: ids.groups } }, { normativeId: { in: normIds } }] } });
    await prisma.groupStudent.deleteMany({ where: { groupId: { in: ids.groups } } });
    await prisma.groupMilestone.deleteMany({ where: { groupId: { in: ids.groups } } });
    await prisma.group.deleteMany({ where: { id: { in: ids.groups } } });
    await prisma.normative.deleteMany({ where: { id: { in: normIds } } });
    await prisma.category.deleteMany({ where: { id: { in: catIds } } });
    await prisma.appSetting.deleteMany({ where: { key: 'foundation_2026_migration' } });
    await prisma.auditLog.deleteMany({ where: { OR: [{ userId: { in: all } }, { targetId: { in: [...all, ...ids.groups] } }] } });
    await prisma.userPermission.deleteMany({ where: { userId: { in: all } } });
    await prisma.user.deleteMany({ where: { id: { in: all } } });
    console.log(`\nTozalash: qolgan fixture = ${await prisma.user.count({ where: { login: { startsWith: tag } } })}, Foundation yo'nalishlari = ${await prisma.category.count({ where: { name: { in: ['Foundation', 'Foundation 2026'] } } })}`);
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
