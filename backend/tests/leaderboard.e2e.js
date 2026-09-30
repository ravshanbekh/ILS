/**
 * Leaderboard bug'i uchun regressiya sinovi.
 *
 * Holat: o'quvchi A guruhda normativ topshiradi va tasdiqlanadi, keyin
 * B guruhga ko'chiriladi. `transferStudent` submission.groupId ni
 * yangilamaydi, shuning uchun eski kod B guruh leaderboardida uning
 * balini 0 deb ko'rsatardi.
 *
 * Ishlatish: node e2e-leaderboard.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['error'] });

let pass = 0;
let fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  OK   ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; console.log(`  XATO ${name}${extra ? ' — ' + extra : ''}`); }
}

const TAG = 'E2E-LB-' + Date.now();

(async () => {
  console.log('\n=== Sinov ma\'lumotini tayyorlash ===');

  const teacher = await prisma.user.findFirst({ where: { role: 'admin' }, select: { id: true } });

  const student = await prisma.user.create({
    data: {
      fullName: TAG + ' Oquvchi',
      login: TAG.toLowerCase(),
      passwordHash: 'x'.repeat(60),
      role: 'student',
      isActive: true,
    },
  });

  const groupA = await prisma.group.create({
    data: { name: TAG + ' A', teacherId: teacher.id },
  });
  const groupB = await prisma.group.create({
    data: { name: TAG + ' B', teacherId: teacher.id },
  });

  const normative = await prisma.normative.create({
    data: {
      taskNumber: 9000 + (Date.now() % 900),
      title: TAG + ' normativ',
      description: 'sinov',
      maxScore: 10,
      isActive: true,
    },
  });

  // O'quvchi avval A guruhda
  await prisma.groupStudent.create({ data: { groupId: groupA.id, studentId: student.id } });
  await prisma.groupNormative.create({ data: { groupId: groupA.id, normativeId: normative.id } });

  // A guruhda topshiradi va tasdiqlanadi
  await prisma.submission.create({
    data: {
      studentId: student.id,
      normativeId: normative.id,
      groupId: groupA.id,          // <- topshirilgan paytdagi guruh
      youtubeUrl: 'https://example.com/v',
      status: 'checked',
      result: 'green',
      score: 8,
      checkedById: teacher.id,
      checkedAt: new Date(),
    },
  });
  console.log('  Tayyor: o\'quvchi A guruhda 8 ball to\'plagan');



  console.log('\n=== 1. A guruh leaderboardi (ko\'chirishdan oldin) ===');
  let lb = await leaderboard(groupA.id);
  let me = lb.find((r) => r.studentId === student.id);
  ok('A guruhda ball ko\'rinadi', me && me.score === 8, `score=${me && me.score}`);

  console.log('\n=== 2. O\'quvchini B guruhga ko\'chiramiz ===');
  // transferStudent aynan shunday qiladi: a'zolikni ko'chiradi, submission'ga tegmaydi
  await prisma.groupStudent.deleteMany({ where: { studentId: student.id, groupId: groupA.id } });
  await prisma.groupStudent.create({ data: { groupId: groupB.id, studentId: student.id } });
  await prisma.groupNormative.create({ data: { groupId: groupB.id, normativeId: normative.id } });
  console.log('  Ko\'chirildi. submission.groupId hali ham A guruhga ishora qiladi');

  console.log('\n=== 3. B guruh leaderboardi (ko\'chirishdan keyin) ===');
  lb = await leaderboard(groupB.id);
  me = lb.find((r) => r.studentId === student.id);
  ok('B guruhda ball saqlandi', me && me.score === 8, `score=${me && me.score}`);
  ok('o\'rin berilgan', me && me.rank >= 1, `rank=${me && me.rank}`);

  console.log('\n=== 4. Dense ranking: teng ballga teng o\'rin ===');
  const peer = await prisma.user.create({
    data: {
      fullName: TAG + ' Tengdosh',
      login: TAG.toLowerCase() + '-2',
      passwordHash: 'x'.repeat(60),
      role: 'student',
      isActive: true,
    },
  });
  await prisma.groupStudent.create({ data: { groupId: groupB.id, studentId: peer.id } });
  await prisma.submission.create({
    data: {
      studentId: peer.id,
      normativeId: normative.id,
      groupId: groupB.id,
      youtubeUrl: 'https://example.com/v2',
      status: 'checked',
      result: 'green',
      score: 8,
      checkedById: teacher.id,
      checkedAt: new Date(),
    },
  });
  lb = await leaderboard(groupB.id);
  const both = lb.filter((r) => r.score === 8);
  ok('teng ballda teng o\'rin', both.length === 2 && both[0].rank === both[1].rank,
     `ranks=${both.map((b) => b.rank).join(',')}`);

  console.log('\n=== 5. Tozalash ===');
  await prisma.submission.deleteMany({ where: { normativeId: normative.id } });
  await prisma.groupNormative.deleteMany({ where: { normativeId: normative.id } });
  await prisma.groupStudent.deleteMany({ where: { studentId: { in: [student.id, peer.id] } } });
  await prisma.normative.delete({ where: { id: normative.id } });
  await prisma.group.deleteMany({ where: { id: { in: [groupA.id, groupB.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [student.id, peer.id] } } });
  console.log('  Sinov ma\'lumoti o\'chirildi');

  console.log(`\n${'='.repeat(50)}`);
  console.log(`NATIJA: ${pass} ta o'tdi, ${fail} ta xato`);
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
})().catch(async (e) => {
  console.error('KUTILMAGAN XATO:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});

/**
 * bot.service.ts dagi getGroupLeaderboard mantiqining aynan nusxasi.
 * TS modulni to'g'ridan-to'g'ri chaqirib bo'lmagani uchun shu yerda takrorlanadi —
 * agar asl kod o'zgarsa, bu sinov ham yangilanishi kerak.
 */
async function leaderboard(groupId) {
  const groupStudents = await prisma.groupStudent.findMany({
    where: { groupId },
    include: { student: { select: { id: true, fullName: true } } },
  });

  const groupNormatives = await prisma.groupNormative.findMany({
    where: { groupId },
    select: { normativeId: true },
  });
  const normativeIds = groupNormatives.map((gn) => gn.normativeId);

  const studentIds = groupStudents.map((gs) => gs.studentId);
  const grouped = studentIds.length
    ? await prisma.submission.groupBy({
        by: ['studentId'],
        where: {
          studentId: { in: studentIds },
          status: 'checked',
          ...(normativeIds.length > 0 ? { normativeId: { in: normativeIds } } : {}),
        },
        _sum: { score: true },
      })
    : [];
  const scoreByStudent = new Map(grouped.map((row) => [row.studentId, row._sum.score || 0]));

  const scores = groupStudents.map((gs) => ({
    name: gs.student.fullName,
    studentId: gs.studentId,
    score: scoreByStudent.get(gs.studentId) || 0,
  }));

  scores.sort((a, b) => b.score - a.score);

  let rank = 0;
  let prevScore = null;
  return scores.map((s, i) => {
    if (prevScore === null || s.score < prevScore) rank = i + 1;
    prevScore = s.score;
    return { ...s, rank };
  });
}
