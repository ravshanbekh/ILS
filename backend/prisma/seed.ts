import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ============ ADMIN yaratish ============
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { login: 'admin' },
    update: {},
    create: {
      fullName: 'Super Admin',
      login: 'admin',
      passwordHash: adminPassword,
      role: 'admin',
    },
  });
  console.log(`✅ Admin yaratildi: ${admin.login}`);

  // ============ O'QITUVCHILAR yaratish ============
  const teacherPassword = await bcrypt.hash('teacher123', 12);

  const teacher1 = await prisma.user.upsert({
    where: { login: 'teacher1' },
    update: {},
    create: {
      fullName: 'Abdullayev Jamshid',
      login: 'teacher1',
      passwordHash: teacherPassword,
      role: 'teacher',
    },
  });

  const teacher2 = await prisma.user.upsert({
    where: { login: 'teacher2' },
    update: {},
    create: {
      fullName: 'Karimova Nilufar',
      login: 'teacher2',
      passwordHash: teacherPassword,
      role: 'teacher',
    },
  });
  console.log(`✅ O'qituvchilar yaratildi: ${teacher1.login}, ${teacher2.login}`);

  // ============ O'QUVCHILAR yaratish ============
  const studentPassword = await bcrypt.hash('student123', 12);
  const studentNames = [
    'Alisher Abdusalomov',
    'Bobur Mamatov',
    'Dilnoza Rahimova',
    'Eldor Toshmatov',
    'Farida Yusupova',
    'Gulnora Azimova',
    'Husan Normatov',
    'Iroda Karimova',
    'Jasur Sobirov',
    'Kamola Umarova',
  ];

  const students = [];
  for (let i = 0; i < studentNames.length; i++) {
    const student = await prisma.user.upsert({
      where: { login: `student${i + 1}` },
      update: {},
      create: {
        fullName: studentNames[i],
        login: `student${i + 1}`,
        passwordHash: studentPassword,
        role: 'student',
      },
    });
    students.push(student);
  }
  console.log(`✅ ${students.length} ta o'quvchi yaratildi`);

  // ============ GURUHLAR yaratish ============
  const group1 = await prisma.group.create({
    data: {
      name: 'E6',
      teacherId: teacher1.id,
    },
  });

  const group2 = await prisma.group.create({
    data: {
      name: 'RF10',
      teacherId: teacher1.id,
    },
  });

  const group3 = await prisma.group.create({
    data: {
      name: 'G1',
      teacherId: teacher2.id,
    },
  });
  console.log(`✅ Guruhlar yaratildi: E6, RF10, G1`);

  // ============ O'QUVCHILARNI GURUHLARGA QO'SHISH ============
  // E6 guruhiga 5 ta o'quvchi
  for (let i = 0; i < 5; i++) {
    await prisma.groupStudent.create({
      data: {
        groupId: group1.id,
        studentId: students[i].id,
      },
    });
  }

  // RF10 guruhiga 3 ta o'quvchi
  for (let i = 3; i < 6; i++) {
    await prisma.groupStudent.create({
      data: {
        groupId: group2.id,
        studentId: students[i].id,
      },
    });
  }

  // G1 guruhiga 4 ta o'quvchi
  for (let i = 6; i < 10; i++) {
    await prisma.groupStudent.create({
      data: {
        groupId: group3.id,
        studentId: students[i].id,
      },
    });
  }
  console.log(`✅ O'quvchilar guruhlarga qo'shildi`);

  // ============ NORMATIVLAR yaratish ============
  const normativeData = [
    { taskNumber: 55, title: 'Header komponent', description: 'Responsive header yaratish', timeLimit: 30, maxScore: 40 },
    { taskNumber: 56, title: 'Pricing card', description: 'Pricing kartochkasi yaratish', timeLimit: 25, maxScore: 24 },
    { taskNumber: 57, title: 'Pricing section', description: 'To\'liq pricing section', timeLimit: 40, maxScore: 40 },
    { taskNumber: 58, title: 'Footer section', description: 'Footer komponent yaratish', timeLimit: 20, maxScore: 16 },
    { taskNumber: 59, title: 'Hero section', description: 'Landing page hero qismi', timeLimit: 35, maxScore: 40 },
    { taskNumber: 60, title: 'Testimonials', description: 'Mijozlar fikrlari seksiyasi', timeLimit: 30, maxScore: 32 },
    { taskNumber: 61, title: 'Contact form', description: 'Bog\'lanish formasi', timeLimit: 25, maxScore: 24 },
    { taskNumber: 62, title: 'Navigation menu', description: 'Responsive navigatsiya', timeLimit: 20, maxScore: 20 },
  ];

  const normatives = [];
  for (const data of normativeData) {
    const normative = await prisma.normative.create({ data });
    normatives.push(normative);
  }
  console.log(`✅ ${normatives.length} ta normativ yaratildi`);

  // ============ GURUH-NORMATIV BOG'LASH ============
  // Barcha normativlarni barcha guruhlarga biriktirish
  for (const group of [group1, group2, group3]) {
    for (const normative of normatives) {
      await prisma.groupNormative.create({
        data: {
          groupId: group.id,
          normativeId: normative.id,
        },
      });
    }
  }
  console.log(`✅ Normativlar guruhlarga biriktirildi`);

  // ============ NAMUNA TOPSHIRIQLAR ============
  // E6 guruhidagi o'quvchilar uchun bir nechta submission
  const sampleSubmissions = [
    { studentIdx: 0, normativeIdx: 0, result: 'green' as const },
    { studentIdx: 0, normativeIdx: 1, result: 'blue' as const },
    { studentIdx: 0, normativeIdx: 2, result: 'red' as const },
    { studentIdx: 1, normativeIdx: 0, result: 'green' as const },
    { studentIdx: 1, normativeIdx: 1, result: 'green' as const },
    { studentIdx: 2, normativeIdx: 0, result: 'blue' as const },
    { studentIdx: 3, normativeIdx: 0, result: 'green' as const },
    { studentIdx: 4, normativeIdx: 0, result: 'green' as const },
  ];

  for (const sub of sampleSubmissions) {
    const maxScore = normatives[sub.normativeIdx].maxScore;
    const score = sub.result === 'green' ? maxScore : sub.result === 'blue' ? Math.floor(maxScore / 2) : 0;

    await prisma.submission.create({
      data: {
        studentId: students[sub.studentIdx].id,
        normativeId: normatives[sub.normativeIdx].id,
        groupId: group1.id,
        youtubeUrl: `https://youtube.com/watch?v=example${sub.studentIdx}${sub.normativeIdx}`,
        status: 'checked',
        result: sub.result,
        score,
        checkedById: teacher1.id,
        checkedAt: new Date(),
      },
    });
  }

  // Bir nechta pending submission
  await prisma.submission.create({
    data: {
      studentId: students[0].id,
      normativeId: normatives[3].id,
      groupId: group1.id,
      youtubeUrl: 'https://youtube.com/watch?v=pendingExample1',
      status: 'pending',
    },
  });

  await prisma.submission.create({
    data: {
      studentId: students[1].id,
      normativeId: normatives[2].id,
      groupId: group1.id,
      youtubeUrl: 'https://youtube.com/watch?v=pendingExample2',
      status: 'pending',
    },
  });

  console.log(`✅ Namuna topshiriqlar yaratildi`);

  console.log('\n🎉 Seeding tugadi! Login ma\'lumotlari:');
  console.log('  Admin:     admin / admin123');
  console.log('  Teacher1:  teacher1 / teacher123');
  console.log('  Teacher2:  teacher2 / teacher123');
  console.log('  Students:  student1-10 / student123');
}

main()
  .catch((e) => {
    console.error('❌ Seed xatosi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
