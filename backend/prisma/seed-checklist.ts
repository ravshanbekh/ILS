import prisma from '../src/config/database';

// ============================================================
// CALL OPERATORI — 12 ta vazifa, 3 ta bo'lim
// ============================================================
const callOperatoriChecklist = [
  // SECTION 1
  { order: 1, score: 7, section: 'ISHGA TAYYORGARLIK (08:00 — 08:30)', category: "Shaxsiy ko'rinish", description: "Uniforma toza · Bejik taqqilgan · Sochlar tartibli · Maktiyaj me'yorida" },
  { order: 2, score: 6, section: 'ISHGA TAYYORGARLIK (08:00 — 08:30)', category: 'Ish joyi tartibi', description: "Stol usti toza · Ortiqcha buyumlar yo'q · Hujjatlar tartibda" },
  { order: 3, score: 8, section: 'ISHGA TAYYORGARLIK (08:00 — 08:30)', category: 'Texnik nazorat', description: "Kompyuter yoniq · Garnitura ishlayapti · IP-telefoniya aktiv · amoCRM ochiq" },
  { order: 4, score: 8, section: 'ISHGA TAYYORGARLIK (08:00 — 08:30)', category: "Ma'lumot nazorati", description: "Yangi guruhlar · Kurs narxlari · Skriptlar — barchasi ko'zdan kechirildi" },
  // SECTION 2
  { order: 5, score: 10, section: 'ISH JARAYONI VA SOTUV (08:30 — 16:30)', category: 'Yangi Lidlar bilan ishlash', description: "Lid tushganidan so'ng 5 daqiqa ichida qo'ng'iroq qilish · Kechikish = 0" },
  { order: 6, score: 9, section: 'ISH JARAYONI VA SOTUV (08:30 — 16:30)', category: 'Tashriflarni eslatish va tasdiqlash', description: "Bugungi tashriflarni tasdiqlash · Kelishini ta'minlash · Vaqtini eslatish" },
  { order: 7, score: 9, section: 'ISH JARAYONI VA SOTUV (08:30 — 16:30)', category: "Voronka bo'yicha ish (amoCRM)", description: "CRMdagi mijozlarni bosqichma-bosqich harakatlantirish · Har bir bosqich yangilandi" },
  { order: 8, score: 9, section: 'ISH JARAYONI VA SOTUV (08:30 — 16:30)', category: "Guruh to'ldirish", description: "Ochilishi yaqin guruhlarga maqsadli qo'ng'iroqlar · Reja: 50+ qo'ng'iroq/kun" },
  { order: 9, score: 9, section: 'ISH JARAYONI VA SOTUV (08:30 — 16:30)', category: 'CRM intizomi', description: "Har bir suhbat natijasini bazaga kiritish · Izohlar to'liq yozildi" },
  // SECTION 3
  { order: 10, score: 9, section: 'KUN YAKUNI VA HISOBOT (16:30 — 18:00)', category: 'Kunlik statistika', description: "Jami qo'ng'iroqlar (Reja: 50+) · Tashriflar soni" },
  { order: 11, score: 9, section: 'KUN YAKUNI VA HISOBOT (16:30 — 18:00)', category: 'Kunlik hisobot (Telegram)', description: "Rahbarga: Qo'ng'iroqlar · Tashriflar · CRM holati · Muammolar" },
  { order: 12, score: 6, section: 'KUN YAKUNI VA HISOBOT (16:30 — 18:00)', category: 'Xavfsizlik va kun yopilishi', description: "Elektr jihozlar o'chirildi · Ish telefon va Laptoplar joyida · Ish joyi tartiblanidi" },
];

// ============================================================
// FARROSH — 15 ta vazifa, 5 ta bo'lim
// ============================================================
const farroshChecklist = [
  { order: 1, score: 7, section: 'TONGGI TAYYORGARLIK (08:30 — 09:00)', category: "Shaxsiy ko'rinish", description: 'Kiyim toza, tartibli' },
  { order: 2, score: 7, section: 'TONGGI TAYYORGARLIK (08:30 — 09:00)', category: 'Ish anjomlari', description: "Paqir, latta, vositalar tayyor" },
  { order: 3, score: 7, section: 'TONGGI TAYYORGARLIK (08:30 — 09:00)', category: 'Xonalarni tekshirish', description: "Chiqindi yo'q" },
  { order: 4, score: 8, section: 'TOZALASH JARAYONI (Kun davomida)', category: 'Polni artish', description: 'Toza holat' },
  { order: 5, score: 7, section: 'TOZALASH JARAYONI (Kun davomida)', category: 'Podokonnik', description: "Chang yo'q" },
  { order: 6, score: 8, section: 'TOZALASH JARAYONI (Kun davomida)', category: 'Chiqindilar', description: 'Tashlab yuborilgan' },
  { order: 7, score: 7, section: 'TOZALASH JARAYONI (Kun davomida)', category: 'Kuller', description: 'Toza' },
  { order: 8, score: 7, section: 'TARTIB VA NAZORAT (11:00 / 14:00 / 17:00)', category: 'Xonalar', description: 'Toza' },
  { order: 9, score: 7, section: 'TARTIB VA NAZORAT (11:00 / 14:00 / 17:00)', category: 'Derazalar', description: "Dog' yo'q" },
  { order: 10, score: 7, section: 'TARTIB VA NAZORAT (11:00 / 14:00 / 17:00)', category: 'Jihozlar', description: 'Toza' },
  { order: 11, score: 6, section: 'HAFTALIK VAZIFALAR', category: 'Chorshamba — Parta/stul oyoqlari', description: 'Toza' },
  { order: 12, score: 6, section: 'HAFTALIK VAZIFALAR', category: 'Shanba — Parta/stul oyoqlari', description: 'Toza' },
  { order: 13, score: 6, section: 'HAFTALIK VAZIFALAR', category: "Har 4 kunda — Oynalar", description: "Dog'siz" },
  { order: 14, score: 8, section: 'KUN YAKUNI (17:30)', category: 'Yakuniy tekshiruv', description: 'Hammasi toza' },
  { order: 15, score: 8, section: 'KUN YAKUNI (17:30)', category: 'Oyna va eshiklar', description: 'Yopilgan' },
];

// ============================================================
// NAZORATCHI — 12 ta vazifa, 3 ta bo'lim
// ============================================================
const nazoratchiChecklist = [
  { order: 1, score: 9, section: 'ERTALAB NAZORATI (08:00 — 09:00)', category: 'Xodimlar punktualligi', description: "Admin, mentor, sotuv bo'limi kelish vaqtini qayd et · kaldi-ketti daftariga imzo olish" },
  { order: 2, score: 8, section: 'ERTALAB NAZORATI (08:00 — 09:00)', category: 'Dress-code va etika', description: "Kiyim-mezonga mos · Tashqi ko'rinish" },
  { order: 3, score: 8, section: 'ERTALAB NAZORATI (08:00 — 09:00)', category: 'Admin cheklistini auditi (tanlanma)', description: "Xonalar tozaligi real bajarilganmi · Choy/kofe zaxirasi · Kassa ochilishi" },
  { order: 4, score: 9, section: 'ERTALAB NAZORATI (08:00 — 09:00)', category: 'Kamera orqali monitoring', description: "Filial kamera tasviri ko'rib chiqildi · G'ayriodatiy holat yo'q" },
  { order: 5, score: 8, section: 'KUNDUZGI NAZORAT (09:00 — 16:00)', category: 'Dars jadvali', description: "Dars jadvali vs. xonadagi mentor borligini solishtir · Kechikish qayd etildi" },
  { order: 6, score: 9, section: 'KUNDUZGI NAZORAT (09:00 — 16:00)', category: 'Rahbar xodimlar cheklistini online nazorat', description: "Telegram guruhida suratlar bor · Cheklist pozitsiyalariga mos · Chora ko'rish" },
  { order: 7, score: 8, section: 'KUNDUZGI NAZORAT (09:00 — 16:00)', category: 'Trello topshiriqlari nazorati', description: "Yangi topshiriqlar bor · Muddati o'tganlar yo'q · Xodimga ogohlantirish yuborildi" },
  { order: 8, score: 8, section: 'KUNDUZGI NAZORAT (09:00 — 16:00)', category: 'Shovqin va ish muhiti', description: "Bekorchi suhbatlar yo'q · Ish samaradorligiga xalakit beruvchi omil aniqlanmadi" },
  { order: 9, score: 9, section: 'KUNDUZGI NAZORAT (09:00 — 16:00)', category: 'Mijoz xizmat sifatini kuzatish (Mystery shopper)', description: "Servis standarti · Kutish vaqti · Admin reaktsiyasi baholandi" },
  { order: 10, score: 9, section: 'KECHQURUN YAKUNLASH (16:00 — 17:30)', category: 'Qoidabuzarlik dalolatnomasi (Akt) tayyorlash', description: "Faktlar yozilgan · Sana/vaqt · Xodim imzosi (yoki rad etganligi qayd)" },
  { order: 11, score: 9, section: 'KECHQURUN YAKUNLASH (16:00 — 17:30)', category: 'Kunlik nazorat hisobotini filial rahbarga yuborish', description: "Qoidabuzarliklar · Topilgan xatolar · Tavsiyalar · Telegram yoki email" },
  { order: 12, score: 8, section: 'KECHQURUN YAKUNLASH (16:00 — 17:30)', category: 'Ertangi reja', description: "Bugungi tekshiruvlar natijasiga asoslanib tuzilgan" },
];

async function seedRole(role: string, items: any[]) {
  console.log(`\n🌱 ${role} seed boshlandi...`);
  await prisma.checklistItem.deleteMany({ where: { role: role as any } });
  for (const item of items) {
    await prisma.checklistItem.create({ data: { role: role as any, ...item } });
  }
  console.log(`✅ ${role}: ${items.length} ta element qo'shildi`);
}

async function main() {
  await seedRole('call_operatori', callOperatoriChecklist);
  await seedRole('farrosh', farroshChecklist);
  await seedRole('nazoratchi', nazoratchiChecklist);
  console.log('\n🎉 Hammasi tayyor!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
