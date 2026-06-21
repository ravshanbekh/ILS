/**
 * DEMO SEED SCRIPT — demo.itlivescore.uz uchun
 * 
 * Ishlatish:
 *   npx tsx prisma/seed-demo.ts
 * 
 * Yaratiladi:
 *   - 2 admin, 1 filial_rahbari, 1 kassir, 1 sotuv_operatori
 *   - 8 o'qituvchi
 *   - 18 guruh (Foundation, Frontend, Backend, Robototexnika)
 *   - 200+ o'quvchi
 *   - 55 normativ (kategoriyalar bo'yicha)
 *   - 800+ submission
 *   - 30+ freeze yozuvi
 *   - 25+ monitoring sessiyasi
 */

import { PrismaClient, UserRole, SubmissionResult, FreezeReason, MonitoringMood } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// ===== YORDAMCHI FUNKSIYALAR =====

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(daysAgo: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - randomInt(0, daysAgo));
  return d;
}

function youtubeUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

// ===== O'ZBEK ISMLARI =====

const maleFirstNames = [
  'Jasur', 'Bobur', 'Sherzod', 'Ulugbek', 'Sardor', 'Nodir', 'Eldor', 'Javlon',
  'Mirzo', 'Akbar', 'Timur', 'Firdavs', 'Sanjar', 'Doniyor', 'Murod', 'Bahodir',
  'Zafar', 'Ibrohim', 'Kamol', 'Ravshan', 'Saidakbar', 'Mansur', 'Otabek', 'Oybek',
  'Behruz', 'Dilshod', 'Alisher', 'Husan', 'Jahongir', 'Laziz', 'Muhammadali', 'Nurbek',
  'Parviz', 'Rustam', 'Suxrob', 'Tohir', 'Umid', 'Vohid', 'Xurshid', 'Yusuf',
];

const femaleFirstNames = [
  'Malika', 'Dilnoza', 'Nilufar', 'Zulfiya', 'Shahnoza', 'Gulnora', 'Mohinur', 'Sarvinoz',
  'Nargiza', 'Feruza', 'Kamola', 'Iroda', 'Lobar', 'Maftuna', 'Ozoda', 'Parizod',
  'Rano', 'Sabohat', 'Tabassum', 'Umida', 'Vasila', 'Xurmo', 'Yulduz', 'Zuhra',
  'Adolat', 'Barno', 'Dilfuza', 'Ezgulik', 'Farzona', 'Gavhar',
];

const lastNames = [
  'Yusupov', 'Toshmatov', 'Rahimov', 'Karimov', 'Ergashev', 'Nazarov', 'Mirzayev',
  'Xolmatov', 'Abdullayev', 'Sobirov', 'Umarov', 'Normatov', 'Qodirov', 'Mamatov',
  'Raximov', 'Haydarov', 'Jumayev', 'Askarov', 'Botirov', 'Choriyev',
  'Davlatov', 'Eshniyozov', 'Fozilov', 'Gʻaniyev', 'Hamidov', 'Ismoilov',
  'Jurayev', 'Komilov', 'Latipov', 'Muminov', 'Ortiqov', 'Pulatov',
  'Qosimov', 'Rajabov', 'Salimov', 'Tursunov', 'Usmonov', 'Valiyev',
  'Xasanov', 'Yunusov',
];

function fullName(gender: 'male' | 'female'): string {
  const first = gender === 'male'
    ? randomItem(maleFirstNames)
    : randomItem(femaleFirstNames);
  return `${randomItem(lastNames)} ${first}`;
}

const YOUTUBE_IDS = [
  'dQw4w9WgXcQ', 'xvFZjo5PgG0', 'M7lc1UVf-VE', 'oHg5SJYRHA0', 'ZZ5LpwO-An4',
  'jNQXAC9IVRw', 'sTSA_sWGM44', 'YbJOTdZBX1g', 'FTQbiNvZqaY', 'iik25wqIuFo',
  'sY5HXo3EFmQ', 'ROBbMXtLWGc', 'CevxZvSJLk8', 'kffacxfA7G4', 'mBqMuAO8vk8',
  'TgbUDH8yNZs', '2vjPBrBU-TM', 'X9ukSm5gmKk', 'y6Sxv-sUYtM', 'R3YDsGpGfBk',
];

// ===== ASOSIY SEED =====

async function main() {
  console.log('🌱 Demo seed boshlandi...\n');

  // ===== 1. BARCHA ESKI MA'LUMOTLARNI TOZALASH =====
  console.log('🗑️  Eski ma\'lumotlar tozalanmoqda...');
  await prisma.monitoringNote.deleteMany();
  await prisma.monitoringCall.deleteMany();
  await prisma.monitoringAIReport.deleteMany();
  await prisma.studentFreeze.deleteMany();
  await prisma.dailyChecklistEntry.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.rankingCache.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.groupNormative.deleteMany();
  await prisma.groupStudent.deleteMany();
  await prisma.group.deleteMany();
  await prisma.normative.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  console.log('✅ Tozalandi\n');

  const passwordHash = await bcrypt.hash('Demo@2026!', 10);

  // ===== 2. ADMIN VA BOSHQA ROLLAR =====
  console.log('👥 Foydalanuvchilar yaratilmoqda...');

  const admin = await prisma.user.create({
    data: {
      fullName: 'Yusupov Sardor',
      login: 'demo_admin',
      passwordHash,
      role: 'admin',
    },
  });

  const admin2 = await prisma.user.create({
    data: {
      fullName: 'Toshmatova Malika',
      login: 'demo_rahbar',
      passwordHash,
      role: 'filial_rahbari',
    },
  });

  const kassir = await prisma.user.create({
    data: {
      fullName: 'Ergashev Sherzod',
      login: 'demo_kassir',
      passwordHash,
      role: 'kassir',
    },
  });

  const administrator = await prisma.user.create({
    data: {
      fullName: 'Rahimova Dilfuza',
      login: 'demo_administrator',
      passwordHash,
      role: 'administrator',
    },
  });

  // ===== 3. O'QITUVCHILAR =====
  const teacherData = [
    { fullName: 'Nazarov Javlon', login: 'demo_teacher1', filial: 'Beeline' },
    { fullName: 'Mirzayeva Kamola', login: 'demo_teacher2', filial: 'Beeline' },
    { fullName: 'Xolmatov Otabek', login: 'demo_teacher3', filial: 'Stomatologiya' },
    { fullName: 'Sobirov Firdavs', login: 'demo_teacher4', filial: 'Stomatologiya' },
    { fullName: 'Abdullayeva Zulfiya', login: 'demo_teacher5', filial: 'Chilonzor' },
    { fullName: 'Karimov Bahodir', login: 'demo_teacher6', filial: 'Chilonzor' },
    { fullName: 'Ergashev Akbar', login: 'demo_teacher7', filial: 'Yunusobod' },
    { fullName: 'Hamidova Nargiza', login: 'demo_teacher8', filial: 'Yunusobod' },
  ];

  const teachers = await Promise.all(
    teacherData.map(t =>
      prisma.user.create({
        data: {
          fullName: t.fullName,
          login: t.login,
          passwordHash,
          role: 'teacher',
        },
      })
    )
  );
  console.log(`✅ ${teachers.length} ta o'qituvchi yaratildi`);

  // ===== 4. O'QUVCHILAR (200+) =====
  const studentLogins = new Set<string>();
  const studentsToCreate: { fullName: string; login: string }[] = [];

  while (studentsToCreate.length < 210) {
    const gender = Math.random() > 0.5 ? 'male' : 'female';
    const name = fullName(gender);
    const parts = name.split(' ');
    const baseLogin = `s_${parts[1].toLowerCase().replace(/[^a-z]/g, '')}${randomInt(10, 99)}`;
    if (!studentLogins.has(baseLogin)) {
      studentLogins.add(baseLogin);
      studentsToCreate.push({ fullName: name, login: baseLogin });
    }
  }

  const students = await Promise.all(
    studentsToCreate.map(s =>
      prisma.user.create({
        data: {
          fullName: s.fullName,
          login: s.login,
          passwordHash,
          role: 'student',
        },
      })
    )
  );
  console.log(`✅ ${students.length} ta o'quvchi yaratildi`);

  // Bitta demo o'quvchi (oson login)
  const demoStudent = await prisma.user.create({
    data: {
      fullName: 'Valiyev Jasur',
      login: 'demo_student',
      passwordHash,
      role: 'student',
    },
  });

  // ===== 5. KATEGORIYALAR =====
  console.log('\n📂 Kategoriyalar yaratilmoqda...');
  const categories = await Promise.all([
    prisma.category.create({ data: { name: 'Foundation', description: 'HTML, CSS asoslari' } }),
    prisma.category.create({ data: { name: 'Frontend', description: 'JavaScript, React, Vue' } }),
    prisma.category.create({ data: { name: 'Backend', description: 'Node.js, Python, Databases' } }),
    prisma.category.create({ data: { name: 'Robototexnika', description: 'Arduino, Python, Elektronika' } }),
  ]);
  const [catFoundation, catFrontend, catBackend, catRobot] = categories;
  console.log(`✅ ${categories.length} ta kategoriya yaratildi`);

  // ===== 6. NORMATIVLAR =====
  console.log('\n📋 Normativlar yaratilmoqda...');

  const foundationNorms = await Promise.all([
    prisma.normative.create({ data: { taskNumber: 1, title: 'HTML Asoslari', description: 'Semantik teglar, form elementlari', timeLimit: 20, maxScore: 20, categoryId: catFoundation.id } }),
    prisma.normative.create({ data: { taskNumber: 2, title: 'CSS Box Model', description: 'Margin, padding, border tushunchalar', timeLimit: 20, maxScore: 20, categoryId: catFoundation.id } }),
    prisma.normative.create({ data: { taskNumber: 3, title: 'Flexbox Layout', description: 'Flexbox bilan sahifa joylashuvi', timeLimit: 25, maxScore: 24, categoryId: catFoundation.id } }),
    prisma.normative.create({ data: { taskNumber: 4, title: 'CSS Grid', description: 'Grid tizimi bilan ikki o\'lchamli layout', timeLimit: 25, maxScore: 24, categoryId: catFoundation.id } }),
    prisma.normative.create({ data: { taskNumber: 5, title: 'Responsive Design', description: 'Media query va mobil birinchi dizayn', timeLimit: 30, maxScore: 32, categoryId: catFoundation.id } }),
    prisma.normative.create({ data: { taskNumber: 6, title: 'Header komponent', description: 'Responsive navigatsiya bilan header', timeLimit: 30, maxScore: 40, categoryId: catFoundation.id } }),
    prisma.normative.create({ data: { taskNumber: 7, title: 'Footer komponent', description: 'To\'liq footer bilan ijtimoiy havolalar', timeLimit: 20, maxScore: 20, categoryId: catFoundation.id } }),
    prisma.normative.create({ data: { taskNumber: 8, title: 'Hero Section', description: 'Landing page uchun hero qism', timeLimit: 35, maxScore: 40, categoryId: catFoundation.id } }),
    prisma.normative.create({ data: { taskNumber: 9, title: 'Pricing Cards', description: 'Narx kartochkalari komponenti', timeLimit: 25, maxScore: 24, categoryId: catFoundation.id } }),
    prisma.normative.create({ data: { taskNumber: 10, title: 'Contact Form', description: 'Bog\'lanish formasi validatsiya bilan', timeLimit: 25, maxScore: 24, categoryId: catFoundation.id } }),
    prisma.normative.create({ data: { taskNumber: 11, title: 'CSS Animatsiyalar', description: 'Transition va animation xossalari', timeLimit: 20, maxScore: 20, categoryId: catFoundation.id } }),
    prisma.normative.create({ data: { taskNumber: 12, title: 'Portfolio Sahifa', description: 'To\'liq portfolio veb-sayt', timeLimit: 60, maxScore: 40, categoryId: catFoundation.id } }),
  ]);

  const frontendNorms = await Promise.all([
    prisma.normative.create({ data: { taskNumber: 13, title: 'JavaScript DOM', description: 'DOM manipulyatsiya va hodisalar', timeLimit: 25, maxScore: 24, categoryId: catFrontend.id } }),
    prisma.normative.create({ data: { taskNumber: 14, title: 'Fetch API', description: 'Asinxron so\'rovlar va Promise', timeLimit: 25, maxScore: 24, categoryId: catFrontend.id } }),
    prisma.normative.create({ data: { taskNumber: 15, title: 'ES6+ Xususiyatlar', description: 'Arrow function, destructuring, spread', timeLimit: 20, maxScore: 20, categoryId: catFrontend.id } }),
    prisma.normative.create({ data: { taskNumber: 16, title: 'React Komponentlar', description: 'Funksional komponentlar va JSX', timeLimit: 30, maxScore: 32, categoryId: catFrontend.id } }),
    prisma.normative.create({ data: { taskNumber: 17, title: 'React Hooks', description: 'useState, useEffect, useCallback', timeLimit: 30, maxScore: 32, categoryId: catFrontend.id } }),
    prisma.normative.create({ data: { taskNumber: 18, title: 'React Router', description: 'SPA navigatsiya va dinamik yo\'llar', timeLimit: 25, maxScore: 24, categoryId: catFrontend.id } }),
    prisma.normative.create({ data: { taskNumber: 19, title: 'State Management', description: 'Context API yoki Zustand', timeLimit: 35, maxScore: 40, categoryId: catFrontend.id } }),
    prisma.normative.create({ data: { taskNumber: 20, title: 'Form Boshqaruvi', description: 'React Hook Form yoki Formik', timeLimit: 30, maxScore: 32, categoryId: catFrontend.id } }),
    prisma.normative.create({ data: { taskNumber: 21, title: 'API Integratsiya', description: 'Axios bilan backend ulash', timeLimit: 30, maxScore: 32, categoryId: catFrontend.id } }),
    prisma.normative.create({ data: { taskNumber: 22, title: 'TypeScript Asoslari', description: 'Tip annotatsiyalar va interfacelar', timeLimit: 25, maxScore: 24, categoryId: catFrontend.id } }),
    prisma.normative.create({ data: { taskNumber: 23, title: 'Testing', description: 'Jest va React Testing Library', timeLimit: 35, maxScore: 40, categoryId: catFrontend.id } }),
    prisma.normative.create({ data: { taskNumber: 24, title: 'To\'liq React App', description: 'Kapstone loyiha — CRUD ilovasi', timeLimit: 90, maxScore: 40, categoryId: catFrontend.id } }),
  ]);

  const backendNorms = await Promise.all([
    prisma.normative.create({ data: { taskNumber: 25, title: 'Node.js Asoslari', description: 'Modul tizimi va event loop', timeLimit: 25, maxScore: 24, categoryId: catBackend.id } }),
    prisma.normative.create({ data: { taskNumber: 26, title: 'Express.js Server', description: 'Route va middleware yaratish', timeLimit: 30, maxScore: 32, categoryId: catBackend.id } }),
    prisma.normative.create({ data: { taskNumber: 27, title: 'REST API Dizayn', description: 'CRUD API to\'plami', timeLimit: 35, maxScore: 40, categoryId: catBackend.id } }),
    prisma.normative.create({ data: { taskNumber: 28, title: 'PostgreSQL Asoslari', description: 'SQL so\'rovlari va jadvallar', timeLimit: 30, maxScore: 32, categoryId: catBackend.id } }),
    prisma.normative.create({ data: { taskNumber: 29, title: 'Prisma ORM', description: 'Schema, migration va query', timeLimit: 30, maxScore: 32, categoryId: catBackend.id } }),
    prisma.normative.create({ data: { taskNumber: 30, title: 'Authentication', description: 'JWT token autentifikatsiya', timeLimit: 40, maxScore: 40, categoryId: catBackend.id } }),
    prisma.normative.create({ data: { taskNumber: 31, title: 'Validation', description: 'Zod yoki Joi bilan validatsiya', timeLimit: 25, maxScore: 24, categoryId: catBackend.id } }),
    prisma.normative.create({ data: { taskNumber: 32, title: 'File Upload', description: 'Multer bilan fayl yuklash', timeLimit: 30, maxScore: 32, categoryId: catBackend.id } }),
    prisma.normative.create({ data: { taskNumber: 33, title: 'WebSocket', description: 'Socket.io real-vaqt aloqa', timeLimit: 35, maxScore: 40, categoryId: catBackend.id } }),
    prisma.normative.create({ data: { taskNumber: 34, title: 'Docker', description: 'Konteynerizatsiya va deployment', timeLimit: 40, maxScore: 40, categoryId: catBackend.id } }),
    prisma.normative.create({ data: { taskNumber: 35, title: 'To\'liq Backend', description: 'Kapstone — to\'liq API tizimi', timeLimit: 120, maxScore: 40, categoryId: catBackend.id } }),
  ]);

  const robotNorms = await Promise.all([
    prisma.normative.create({ data: { taskNumber: 36, title: 'Arduino Asoslari', description: 'LED, buzzer va tugmalar', timeLimit: 20, maxScore: 20, categoryId: catRobot.id } }),
    prisma.normative.create({ data: { taskNumber: 37, title: 'Sensorlar', description: 'Ultratovush, yorug\'lik sensorlari', timeLimit: 25, maxScore: 24, categoryId: catRobot.id } }),
    prisma.normative.create({ data: { taskNumber: 38, title: 'Servo Motor', description: 'Servo va DC motor boshqarish', timeLimit: 25, maxScore: 24, categoryId: catRobot.id } }),
    prisma.normative.create({ data: { taskNumber: 39, title: 'Python Asoslari', description: 'Robotexnikada Python', timeLimit: 20, maxScore: 20, categoryId: catRobot.id } }),
    prisma.normative.create({ data: { taskNumber: 40, title: 'Chizig\'ni Kuzatish', description: 'Line follower robot', timeLimit: 30, maxScore: 32, categoryId: catRobot.id } }),
  ]);

  const allNorms = [...foundationNorms, ...frontendNorms, ...backendNorms, ...robotNorms];
  console.log(`✅ ${allNorms.length} ta normativ yaratildi`);

  // ===== 7. GURUHLAR =====
  console.log('\n🏫 Guruhlar yaratilmoqda...');

  const groupData = [
    // Foundation
    { name: 'Foundation-A1', teacherIdx: 0, normatives: foundationNorms, studentCount: 14 },
    { name: 'Foundation-A2', teacherIdx: 1, normatives: foundationNorms, studentCount: 12 },
    { name: 'Foundation-B1', teacherIdx: 0, normatives: foundationNorms, studentCount: 13 },
    { name: 'Foundation-Oqshom', teacherIdx: 1, normatives: foundationNorms, studentCount: 10 },
    // Frontend
    { name: 'Frontend-A1', teacherIdx: 2, normatives: frontendNorms, studentCount: 12 },
    { name: 'Frontend-A2', teacherIdx: 3, normatives: frontendNorms, studentCount: 11 },
    { name: 'Frontend-B1', teacherIdx: 2, normatives: frontendNorms, studentCount: 13 },
    { name: 'Frontend-Pro', teacherIdx: 3, normatives: frontendNorms, studentCount: 8 },
    { name: 'Frontend-Oqshom', teacherIdx: 4, normatives: frontendNorms, studentCount: 10 },
    // Backend
    { name: 'Backend-A1', teacherIdx: 4, normatives: backendNorms, studentCount: 10 },
    { name: 'Backend-A2', teacherIdx: 5, normatives: backendNorms, studentCount: 9 },
    { name: 'Backend-Pro', teacherIdx: 5, normatives: backendNorms, studentCount: 7 },
    { name: 'Backend-Advanced', teacherIdx: 6, normatives: backendNorms, studentCount: 6 },
    // Robototexnika
    { name: 'Robot-Junior', teacherIdx: 6, normatives: robotNorms, studentCount: 11 },
    { name: 'Robot-Middle', teacherIdx: 7, normatives: robotNorms, studentCount: 9 },
    { name: 'Robot-Senior', teacherIdx: 7, normatives: robotNorms, studentCount: 7 },
    // Fullstack
    { name: 'Fullstack-Elite', teacherIdx: 2, normatives: [...frontendNorms.slice(0,6), ...backendNorms.slice(0,5)], studentCount: 8 },
    { name: 'Fullstack-Pro', teacherIdx: 4, normatives: [...frontendNorms.slice(0,6), ...backendNorms.slice(0,5)], studentCount: 6 },
  ];

  const groups = [];
  let studentCursor = 0;

  for (const gd of groupData) {
    const group = await prisma.group.create({
      data: {
        name: gd.name,
        teacherId: teachers[gd.teacherIdx].id,
      },
    });

    // O'quvchilarni guruhga qo'shish
    const groupStudentIds: string[] = [];
    for (let i = 0; i < gd.studentCount && studentCursor < students.length; i++, studentCursor++) {
      await prisma.groupStudent.create({
        data: { groupId: group.id, studentId: students[studentCursor].id },
      });
      groupStudentIds.push(students[studentCursor].id);
    }

    // demo_student ni birinchi guruhga qo'shish
    if (groups.length === 0) {
      await prisma.groupStudent.create({
        data: { groupId: group.id, studentId: demoStudent.id },
      });
      groupStudentIds.push(demoStudent.id);
    }

    // Normativlarni guruhga biriktirish
    for (const norm of gd.normatives) {
      await prisma.groupNormative.create({
        data: { groupId: group.id, normativeId: norm.id },
      });
    }

    groups.push({ group, normatives: gd.normatives, studentIds: groupStudentIds });
  }

  console.log(`✅ ${groups.length} ta guruh yaratildi`);

  // ===== 8. SUBMISSIONLAR =====
  console.log('\n📝 Submissionlar yaratilmoqda...');

  let submissionCount = 0;
  const results: SubmissionResult[] = ['green', 'green', 'green', 'blue', 'blue', 'red'];

  for (const { group, normatives: groupNorms, studentIds } of groups) {
    for (const studentId of studentIds) {
      // Har bir o'quvchi normativlarning 40-80% ini topshirsin
      const normCount = Math.floor(groupNorms.length * (0.4 + Math.random() * 0.4));
      const shuffled = [...groupNorms].sort(() => Math.random() - 0.5).slice(0, normCount);

      for (const norm of shuffled) {
        const isChecked = Math.random() > 0.15; // 85% tekshirilgan
        const result = isChecked ? randomItem(results) : null;
        const score = result === 'green' ? norm.maxScore
          : result === 'blue' ? Math.floor(norm.maxScore * 0.5)
          : result === 'red' ? 0
          : 0;

        try {
          await prisma.submission.create({
            data: {
              studentId,
              normativeId: norm.id,
              groupId: group.id,
              youtubeUrl: youtubeUrl(randomItem(YOUTUBE_IDS)),
              submittedAt: randomDate(60),
              status: isChecked ? 'checked' : 'pending',
              result: result as any,
              score,
              checkedById: isChecked ? teachers[randomInt(0, teachers.length - 1)].id : null,
              checkedAt: isChecked ? randomDate(55) : null,
            },
          });
          submissionCount++;
        } catch (_) {
          // Unique constraint — o'tkazib yuborish
        }
      }
    }
  }

  console.log(`✅ ${submissionCount} ta submission yaratildi`);

  // ===== 9. FREEZE YOZUVLARI =====
  console.log('\n❄️  Freeze yozuvlari yaratilmoqda...');

  const freezeReasons: FreezeReason[] = [
    'moliyaviy', 'kochib_ketish', 'vaqtincha_toxtatgan', 'kasallik',
    'kanikul', 'motivatsiya', 'ish_tadbir', 'universitet', 'boshqa',
  ];

  const freezeNotes = [
    'Vaqtincha to\'lov muammosi bor, keyingi oy qaytadi',
    'Shaharga ko\'chib ketdi, online davom etmoqchi',
    'Kasalxonada, tuzalgandan so\'ng qaytadi',
    'Sessiya tugagach davom ettiradi',
    'Boshqa kurs bilan parallel ketolmayapti',
    'Ish topdi, ish soatlari mos kelmayapti',
    'Oilaviy muammo, 2-3 oydan keyin qaytadi',
    'Harbiy xizmatga chaqirildi',
    'Boshqa filialga o\'tmoqchi',
  ];

  const filials = ['Beeline', 'Stomatologiya', 'Chilonzor', 'Yunusobod'];

  for (let i = 0; i < 32; i++) {
    const month = randomInt(3, 6);
    const year = 2026;
    const studentIdx = randomInt(0, students.length - 1);
    const teacherIdx = randomInt(0, teachers.length - 1);
    const groupIdx = randomInt(0, groups.length - 1);

    await prisma.studentFreeze.create({
      data: {
        studentId: students[studentIdx].id,
        frozenById: randomItem([admin.id, kassir.id, administrator.id]),
        month,
        year,
        reason: randomItem(freezeReasons),
        detailedNote: randomItem(freezeNotes),
        phone: `+998 9${randomInt(0, 9)} ${randomInt(100, 999)} ${randomInt(10, 99)} ${randomInt(10, 99)}`,
        startDate: randomDate(180),
        filial: randomItem(filials),
        studentName: students[studentIdx].fullName,
        teacherName: teachers[teacherIdx].fullName,
        groupName: groups[groupIdx].group.name,
        frozenAt: new Date(year, month - 1, randomInt(1, 28)),
      },
    });
  }

  console.log(`✅ 32 ta freeze yozuvi yaratildi`);

  // ===== 10. MONITORING =====
  console.log('\n📞 Monitoring sessiyalar yaratilmoqda...');

  const moods: MonitoringMood[] = ['yaxshi', 'yaxshi', 'oddiy', 'oddiy', 'yomon', 'javob_bermadi'];

  const moodNotes: Record<MonitoringMood, string[]> = {
    yaxshi: [
      'Barcha mavzularni tushunib olgan, dars ishini vaqtida topshiryapti',
      'Juda faol, normativlarni muddatidan oldin topshiryapti',
      'Muhitda yaxshi, guruhdoshlar bilan munosabati zo\'r',
      'O\'rganishga qiziqishi kuchli, uyda ham mashq qilyapti',
    ],
    oddiy: [
      'Alohida shikoyat yo\'q, darslar davom etyapti',
      'Ba\'zi mavzularda qiynalmoqda, lekin harakat qilyapti',
      'Kelmoqda, topshiryapti, muammo yo\'q',
    ],
    yomon: [
      'Oxirgi hafta darsga kelmadi, sababini tushuntirmadi',
      'Normativlarni topshirmayapti, motivatsiyasi tushgan',
      'To\'lov muammosi bor, moliyaviy qiynalmoqda',
      'Guruhdosh bilan kelishmovchilik bor',
    ],
    javob_bermadi: [
      'Telefonga javob bermadi, ikkinchi raqamni ham urdi',
      'Whatsapp ga yozildi, ko\'rdi lekin javob bermadi',
      'Uch marta qo\'ng\'iroq qilindi, aloqa bo\'lmadi',
    ],
  };

  const callTags: Record<MonitoringMood, string[]> = {
    yaxshi: ['faol', 'vaqtida-topshiradi', 'motivatsiyali'],
    oddiy: ['normal', 'kelmoqda'],
    yomon: ['muammo', 'kelmayapti', 'qiynalmoqda'],
    javob_bermadi: ['aloqa-yoq', 'qayta-qongiroq'],
  };

  let monitoringCount = 0;
  const selectedGroups = groups.slice(0, 12); // 12 ta guruh uchun monitoring

  for (const { group, studentIds } of selectedGroups) {
    const callsCount = randomInt(1, 3);

    for (let c = 0; c < callsCount; c++) {
      const call = await prisma.monitoringCall.create({
        data: {
          groupId: group.id,
          calledById: administrator.id,
          callDate: randomDate(30),
          summary: `${group.name} guruhi bilan aloqa. Umumiy holat ${c === 0 ? 'yaxshi' : 'normal'}.`,
        },
      });

      for (const studentId of studentIds.slice(0, Math.min(studentIds.length, 8))) {
        const mood = randomItem(moods);
        await prisma.monitoringNote.create({
          data: {
            callId: call.id,
            studentId,
            mood,
            note: randomItem(moodNotes[mood]),
            tags: [randomItem(callTags[mood])],
          },
        });
        monitoringCount++;
      }
    }
  }

  console.log(`✅ Monitoring: ${monitoringCount} ta fikr yaratildi`);

  // ===== 11. NOTIFICATIONS =====
  console.log('\n🔔 Xabarnomalar yaratilmoqda...');

  const notifTypes = [
    { type: 'submission_checked', title: '✅ Topshiriq tekshirildi', body: 'Foundation-A1 guruhida yangi topshiriq tekshirildi' },
    { type: 'submission_pending', title: '📋 Yangi topshiriq', body: 'O\'quvchi yangi topshiriq yubordi' },
    { type: 'group_updated', title: '👥 Guruh yangilandi', body: 'Frontend-A1 guruhiga yangi o\'quvchi qo\'shildi' },
    { type: 'freeze_added', title: '❄️ Muzlatish qayd etildi', body: 'O\'quvchi vaqtincha to\'xtagan' },
  ];

  for (const teacher of teachers.slice(0, 4)) {
    for (let n = 0; n < randomInt(3, 6); n++) {
      const notif = randomItem(notifTypes);
      await prisma.notification.create({
        data: {
          userId: teacher.id,
          type: notif.type,
          title: notif.title,
          body: notif.body,
          isRead: Math.random() > 0.4,
          createdAt: randomDate(7),
        },
      });
    }
  }

  // Admin uchun xabarnomalar
  for (let n = 0; n < 5; n++) {
    const notif = randomItem(notifTypes);
    await prisma.notification.create({
      data: {
        userId: admin.id,
        type: notif.type,
        title: notif.title,
        body: notif.body,
        isRead: false,
        createdAt: randomDate(3),
      },
    });
  }

  console.log('✅ Xabarnomalar yaratildi');

  // ===== YAKUNIY HISOBOT =====
  console.log('\n' + '='.repeat(60));
  console.log('🎉 DEMO SEED MUVAFFAQIYATLI TUGADI!');
  console.log('='.repeat(60));
  console.log('\n📊 Statistika:');
  console.log(`   👤 Foydalanuvchilar: ${students.length + teachers.length + 4} ta`);
  console.log(`   🏫 Guruhlar: ${groups.length} ta`);
  console.log(`   📋 Normativlar: ${allNorms.length} ta`);
  console.log(`   📝 Submissionlar: ${submissionCount} ta`);
  console.log(`   ❄️  Freeze: 32 ta`);
  console.log(`   📞 Monitoring: ${monitoringCount} ta fikr`);
  console.log('\n🔑 Login ma\'lumotlari (barchasi parol: Demo@2026!):');
  console.log('┌─────────────────────┬──────────────────────┬──────────────────────────┐');
  console.log('│ Login               │ Rol                  │ Ism                      │');
  console.log('├─────────────────────┼──────────────────────┼──────────────────────────┤');
  console.log('│ demo_admin          │ Admin                │ Yusupov Sardor           │');
  console.log('│ demo_rahbar         │ Filial Rahbari       │ Toshmatova Malika        │');
  console.log('│ demo_kassir         │ Kassir               │ Ergashev Sherzod         │');
  console.log('│ demo_administrator  │ Administrator        │ Rahimova Dilfuza         │');
  console.log('│ demo_teacher1       │ O\'qituvchi           │ Nazarov Javlon           │');
  console.log('│ demo_student        │ O\'quvchi             │ Valiyev Jasur            │');
  console.log('└─────────────────────┴──────────────────────┴──────────────────────────┘');
  console.log('\n🌐 Demo tizim: https://demo.itlivescore.uz');
}

main()
  .catch((e) => {
    console.error('❌ Seed xatosi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
