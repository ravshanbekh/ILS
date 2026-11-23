/**
 * Normativ natijalari paneli — uchdan-uchgacha sinov (lokal baza).
 * Ko'lam (admin/ruxsat — hammasi, o'qituvchi — o'ziniki, boshqalar — 403),
 * tuzilma (mentor → guruh → o'quvchi, normativlar birlashmasi), kataklar,
 * filtrlar (holat, mentor, guruh, yo'nalish), savatdagi guruh yashirilishi,
 * Excel. Fixture'lar "nme2e" belgisi bilan, oxirida o'chiriladi.
 *
 * Ishlatish (backend papkasidan, LOKAL baza bilan):  npm run e2e:normative-matrix
 */
import http from 'http';
import { formatDuration } from '../src/modules/normative-matrix/normative-matrix.excel';

const PORT = Number(process.env.NM_E2E_PORT || 5095);
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
  const ExcelJS = (await import('exceljs')).default;
  const { default: prisma } = await import('../src/config/database');
  const { env } = await import('../src/config/env');
  const { default: routes } = await import('../src/modules/normative-matrix/normative-matrix.routes');
  const { errorHandler } = await import('../src/shared/middleware/errorHandler');

  const app = express();
  app.use(express.json());
  app.use('/api/normative-matrix', routes);
  app.use(errorHandler);
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(PORT, r));

  const tag = `nme2e${Date.now().toString(36)}`;
  const ids = { users: [] as string[], groups: [] as string[], norms: [] as string[], cats: [] as string[] };
  const mk = async (role: any, name: string) => {
    const u = await prisma.user.create({ data: { fullName: name, login: `${tag}_${name.toLowerCase().replace(/\W+/g, '')}`, passwordHash: 'x', role } });
    ids.users.push(u.id);
    return { ...u, token: jwt.sign({ userId: u.id, role, login: u.login, tv: 0 }, env.JWT_SECRET) };
  };
  const get = async (token: string, q = '', path = '') => {
    const r = await fetch(`${BASE}/api/normative-matrix${path}${q ? `?${q}` : ''}`, { headers: { Authorization: `Bearer ${token}` } });
    return { status: r.status, json: (await r.json().catch(() => null)) as any, r };
  };

  try {
    const admin = await mk('admin', 'Admin');
    const t1 = await mk('teacher', 'Bobur Mentor');
    const t2 = await mk('teacher', 'Aziz Mentor');
    const admr = await mk('administrator', 'Resepshn');
    const asst = await mk('assistant', 'Assistent');
    const [s1, s2, s3, s4] = [await mk('student', 'Oquvchi A1'), await mk('student', 'Oquvchi A2'), await mk('student', 'Oquvchi B1'), await mk('student', 'Oquvchi C1')];
    const cat = await prisma.category.create({ data: { name: `${tag}-Frontend` } });
    ids.cats.push(cat.id);
    const N = await Promise.all(
      [9301, 9302, 9303].map((n, i) => prisma.normative.create({ data: { taskNumber: n, title: `${tag} N${i + 1}`, timeLimit: 2 + i, categoryId: i === 2 ? cat.id : null } }))
    );
    ids.norms.push(...N.map((n) => n.id));
    const gA = await prisma.group.create({ data: { name: `${tag}-A`, teacherId: t1.id } });
    const gB = await prisma.group.create({ data: { name: `${tag}-B`, teacherId: t2.id } });
    const gC = await prisma.group.create({ data: { name: `${tag}-C`, teacherId: t1.id, isActive: false, graduatedAt: new Date() } });
    const gD = await prisma.group.create({ data: { name: `${tag}-D`, teacherId: t1.id, isActive: false } }); // savatda
    ids.groups.push(gA.id, gB.id, gC.id, gD.id);
    await prisma.groupStudent.createMany({
      data: [
        { groupId: gA.id, studentId: s1.id }, { groupId: gA.id, studentId: s2.id },
        { groupId: gB.id, studentId: s3.id }, { groupId: gC.id, studentId: s4.id }, { groupId: gD.id, studentId: s4.id },
      ],
    });
    await prisma.groupNormative.createMany({
      data: [
        { groupId: gA.id, normativeId: N[0].id }, { groupId: gA.id, normativeId: N[1].id },
        { groupId: gB.id, normativeId: N[1].id }, { groupId: gB.id, normativeId: N[2].id },
        { groupId: gC.id, normativeId: N[0].id },
      ],
    });
    const sub = (studentId: string, normativeId: string, result: any, score: number, groupId: string | null = null, youtubeUrl = 'https://youtu.be/x') =>
      prisma.submission.create({ data: { studentId, normativeId, groupId, youtubeUrl, status: result ? 'checked' : 'pending', result, score } });
    await sub(s1.id, N[0].id, 'green', 40, gB.id); // eskirgan groupId — o'quvchi bo'yicha olinishi kerak
    await sub(s1.id, N[1].id, 'blue', 30);
    await sub(s2.id, N[0].id, 'red', 5, null, 'javascript:alert(1)'); // xavfli havola — o'tkazilmasligi kerak
    await sub(s2.id, N[1].id, null, 0);
    await sub(s3.id, N[1].id, 'green', 40);
    await prisma.userPermission.create({ data: { userId: admr.id, permission: 'normative_matrix_all' } });

    console.log('\n1) Kirish');
    check('o\'quvchi → 403', (await get(s1.token)).status === 403);
    check('ruxsatsiz assistent → 403', (await get(asst.token)).status === 403);
    check('ruxsatli administrator → 200', (await get(admr.token)).status === 200);
    check('noto\'g\'ri filtr → 400', (await get(admin.token, 'status=hammasi')).status === 400);

    console.log('\n2) Tuzilma (admin, faol guruhlar)');
    const a = (await get(admin.token)).json?.data;
    const mine = (d: any) => ({ ...d, teachers: d.teachers.filter((t: any) => t.groups.some((g: any) => g.name.startsWith(tag))) });
    const A = mine(a);
    check('mentorlar nomi bo\'yicha: Aziz, Bobur', A.teachers.map((t: any) => t.fullName).join(',') === 'Aziz Mentor,Bobur Mentor', A.teachers.map((t: any) => t.fullName).join(','));
    const tB = A.teachers.find((t: any) => t.fullName === 'Bobur Mentor');
    check('faol filtrda faqat A guruh (tamomlagan va savatdagi yo\'q)', tB.groups.length === 1 && tB.groups[0].id === gA.id);
    check('o\'quvchilar ism bo\'yicha', tB.groups[0].students.map((s: any) => s.id).join() === [s1.id, s2.id].join());
    const myNorms = a.normatives.filter((n: any) => ids.norms.includes(n.id));
    check('normativlar: birlashma, raqam bo\'yicha', myNorms.map((n: any) => n.taskNumber).join() === '9301,9302,9303');
    check('guruh normativlari (biriktirilgan)', A.teachers.find((t: any) => t.fullName === 'Aziz Mentor').groups[0].normativeIds.sort().join() === [N[1].id, N[2].id].sort().join());
    check('katak: qo\'lladi (eskirgan groupId bo\'lsa ham)', a.cells[s1.id]?.[N[0].id]?.join() === 'g,40,https://youtu.be/x');
    check('isbot havolasi: javascript: sxemasi bo\'sh qatorga aylanadi', a.cells[s2.id]?.[N[0].id]?.[2] === '');
    check('vaqt soniyada: 2 → 2 sek, 150 → 2 daq 30 sek, 180 → 3 daq', formatDuration(2) === '2 sek' && formatDuration(150) === '2 daq 30 sek' && formatDuration(180) === '3 daq');
    check('katak: biladi / bilmaydi / tekshirilmoqda', a.cells[s1.id]?.[N[1].id]?.[0] === 'b' && a.cells[s2.id]?.[N[0].id]?.[0] === 'r' && a.cells[s2.id]?.[N[1].id]?.[0] === 'p');
    check('topshirmagan — katak yo\'q', !a.cells[s3.id]?.[N[2].id]);

    console.log('\n3) Filtrlar');
    const g = mine((await get(admin.token, 'status=graduated')).json.data);
    check('tamomlagan: faqat C', g.teachers.length === 1 && g.teachers[0].groups.map((x: any) => x.id).join() === gC.id);
    const all = mine((await get(admin.token, 'status=all')).json.data);
    check('hammasi: A, B, C — savatdagi D hech qachon', all.teachers.flatMap((t: any) => t.groups.map((x: any) => x.id)).sort().join() === [gA.id, gB.id, gC.id].sort().join());
    const byT = (await get(admin.token, `teacherId=${t2.id}`)).json.data;
    check('mentor filtri', byT.teachers.length === 1 && byT.teachers[0].groups[0].id === gB.id);
    const byG = (await get(admin.token, `groupId=${gA.id}`)).json.data;
    check('guruh filtri + normativlar faqat shu guruhniki', byG.teachers[0].groups.length === 1 && byG.normatives.map((n: any) => n.id).sort().join() === [N[0].id, N[1].id].sort().join());
    const byC = (await get(admin.token, `categoryId=${cat.id}`)).json.data;
    check('yo\'nalish filtri: faqat N3', byC.normatives.length === 1 && byC.normatives[0].id === N[2].id);

    console.log('\n4) O\'qituvchi ko\'lami');
    const t = (await get(t1.token)).json.data;
    check('o\'qituvchi faqat o\'z guruhlari', t.scope === 'own' && t.teachers.length === 1 && t.teachers[0].groups.every((x: any) => [gA.id].includes(x.id)));
    check('boshqa mentor filtri bilan — bo\'sh (oqish yo\'q)', (await get(t1.token, `teacherId=${t2.id}`)).json.data.teachers.length === 0);
    check('boshqa guruh ID bilan — bo\'sh', (await get(t1.token, `groupId=${gB.id}`)).json.data.teachers.length === 0);
    check('boshqa guruh o\'quvchisi kataklari yo\'q', !(await get(t1.token)).json.data.cells[s3.id]);
    const o1 = (await get(t1.token, '', '/options')).json.data;
    check('options: o\'qituvchi faqat o\'z guruhlari', o1.scope === 'own' && o1.groups.every((x: any) => x.teacherId === t1.id) && o1.groups.some((x: any) => x.id === gC.id) && !o1.groups.some((x: any) => x.id === gD.id));
    const oa = (await get(admin.token, '', '/options')).json.data;
    check('options: admin — mentorlar va yo\'nalishlar', oa.scope === 'all' && oa.teachers.some((x: any) => x.id === t2.id) && oa.categories.some((c: any) => c.id === cat.id));

    console.log('\n5) Excel');
    const x = await get(admin.token, `teacherId=${t1.id}&status=all`, '/excel');
    const buf = Buffer.from(await (await fetch(`${BASE}/api/normative-matrix/excel?teacherId=${t1.id}&status=all`, { headers: { Authorization: `Bearer ${admin.token}` } })).arrayBuffer());
    check('Excel 200 + xlsx', x.status === 200 && buf.subarray(0, 2).toString() === 'PK', `${buf.length} B`);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as any);
    const ws = wb.getWorksheet('Normativ natijalari')!;
    check('1-qator: mentor nomi', ws.getCell(1, 6).value === 'Bobur Mentor');
    check('2-qator: guruh ustuni va o\'quvchi ismi', String(ws.getCell(2, 6).value).startsWith(`${tag}-A`) && ws.getCell(2, 7).value === 'Oquvchi A1');
    const row = (task: number) => { for (let r = 3; r <= ws.rowCount; r++) if (ws.getCell(r, 1).value === task) return r; return -1; };
    const r1 = row(9301);
    const v7: any = ws.getCell(r1, 7).value;
    check('katak belgilari: A1 ✔ video havolasi bilan, A2 ✘ (xavfli havola — oddiy matn)', v7?.text === '✔' && v7?.hyperlink === 'https://youtu.be/x' && ws.getCell(r1, 8).value === '✘');
    check('Vaqti ustuni soniyada: 2 sek', ws.getCell(r1, 4).value === '2 sek', String(ws.getCell(r1, 4).value));
    check('foiz: N1 — 1/2 (A) + 0/1 (C) = 33%', Math.abs(Number(ws.getCell(r1, 5).value) - 1 / 3) < 0.001, String(ws.getCell(r1, 5).value));
    check('qotirilgan ustun/qator', (ws.views[0] as any)?.xSplit === 5 && (ws.views[0] as any)?.ySplit === 2);
  } finally {
    await prisma.submission.deleteMany({ where: { studentId: { in: ids.users } } });
    await prisma.userPermission.deleteMany({ where: { userId: { in: ids.users } } });
    await prisma.groupNormative.deleteMany({ where: { groupId: { in: ids.groups } } });
    await prisma.groupStudent.deleteMany({ where: { groupId: { in: ids.groups } } });
    await prisma.group.deleteMany({ where: { id: { in: ids.groups } } });
    await prisma.normative.deleteMany({ where: { id: { in: ids.norms } } });
    await prisma.category.deleteMany({ where: { id: { in: ids.cats } } });
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
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
