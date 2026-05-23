import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const hrChecklists = [
  {
    role: "hr_rahbari" as const,
    order: 1,
    score: 1,
    section: "1. ISHGA TAYYORGARLIK",
    category: "Shaxsiy ko'rinish",
    description: "Uniforma toza · Bejik taqilgan · Sochlar tartibli · Makiyaj me'yorida"
  },
  {
    role: "hr_rahbari" as const,
    order: 2,
    score: 1,
    section: "1. ISHGA TAYYORGARLIK",
    category: "Ish joyi va atmosfera",
    description: "Stol toza · Sumka/ovqat ko'rinmaydi · Kompyuter yoniq · Pol toza · Axlat bo'shatilgan · Chang yo'q · Hujjatlar tartibda"
  },
  {
    role: "hr_rahbari" as const,
    order: 3,
    score: 1,
    section: "2. ISH JARAYONI — ERTALAB",
    category: "Nazoratchidan ro'yhat olish",
    description: "Nazoratchi cheklistidan bugungi intizom holatini qabul qilish"
  },
  {
    role: "hr_rahbari" as const,
    order: 4,
    score: 1,
    section: "2. ISH JARAYONI — ERTALAB",
    category: "Kechikkanlar bilan ishlash",
    description: "Sababsiz kechikkan xodimlarga bog'lanish - Sababi o'rganish"
  },
  {
    role: "hr_rahbari" as const,
    order: 5,
    score: 1,
    section: "2. ISH JARAYONI — ERTALAB",
    category: "Kunduzgi aylanma (Skaner nigoh)",
    description: "Ofis va xonalarni aylanib chiqish - Xodimlar kayfiyatini o'rganish - Muammo bo'lsa yechim qilish"
  },
  {
    role: "hr_rahbari" as const,
    order: 6,
    score: 1,
    section: "2. ISH JARAYONI — ERTALAB",
    category: "Recruiting jarayonini davom ettirish(agar bo'lsa)",
    description: "OLX - HH - Telegram kanallar - Rezyumalar bazasidan yangi nomzodlarni saralash"
  },
  {
    role: "hr_rahbari" as const,
    order: 7,
    score: 1,
    section: "3. ISH JARAYONI — TUSHLIKDAN KEYIN",
    category: "Intizom va ish faoliyati kuzatuvi",
    description: "Ichki tartib-qoidalarga rioya qilinishi"
  },
  {
    role: "hr_rahbari" as const,
    order: 8,
    score: 1,
    section: "3. ISH JARAYONI — TUSHLIKDAN KEYIN",
    category: "Xodimlar kayfiyati monitoringi",
    description: "Jamoadagi ruhiy muhitni o'lchash - eNPS bu (xodimlarning kompaniyaga bo'lgan sodiqligi) darajasini aniqlash"
  },
  {
    role: "hr_rahbari" as const,
    order: 9,
    score: 1,
    section: "3. ISH JARAYONI — TUSHLIKDAN KEYIN",
    category: "Xodim murojaatlari bilan ishlash",
    description: "Har bir murojaatga aniq javob berish - Hal qilib bo'lmasa mas'ullarga yo'naltirish"
  },
  {
    role: "hr_rahbari" as const,
    order: 10,
    score: 1,
    section: "3. ISH JARAYONI — TUSHLIKDAN KEYIN",
    category: "Kamida 1 ta individual suhbat",
    description: "Rejalashtirilgan savollar asosida ishonchli muloqot - Maqsad: xodim holati, muammolar, taklif"
  },
  {
    role: "hr_rahbari" as const,
    order: 11,
    score: 1,
    section: "3. ISH JARAYONI — TUSHLIKDAN KEYIN",
    category: "EJM bilan ishlash",
    description: "EJMga kirish - Bosqich bo'yicha harakatlanish - Yangi ma'lumotlar kiritildi"
  },
  {
    role: "hr_rahbari" as const,
    order: 12,
    score: 1,
    section: "4. KUN YAKUNI",
    category: "Ertangi ish rejasini tuzish",
    description: "Kechikkanlar ro'yhati - Nomzodlar oqimi - \"Yopilmagan\" nomzodlarga qayta aloqa - Sinov muddatidagi xodim bilan muloqot - 1 ta 45 daqiqalik yuzma-yuz suhbat rejasi"
  },
  {
    role: "hr_rahbari" as const,
    order: 13,
    score: 1,
    section: "4. KUN YAKUNI",
    category: "Rahbarga hisobot (Telegram)",
    description: "Intizom va davomat - Recruiting holati - Adaptatsiya va jamoa kayfiyati - Hujjatlar va reja (bayram,tadbirlar tashkillashtirish)"
  }
];

async function main() {
  console.log('Starting seed for HR Menejeri (hr_rahbari)...');
  
  // Optionally, clear existing hr_rahbari items to avoid duplicates
  await prisma.checklistItem.deleteMany({
    where: { role: 'hr_rahbari' }
  });

  let added = 0;
  for (const item of hrChecklists) {
    await prisma.checklistItem.create({
      data: item
    });
    added++;
  }
  console.log(`Seed finished. Added ${added} items for HR Menejeri.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
