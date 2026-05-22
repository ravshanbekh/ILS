import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const checklists = [
  {
    "id": "626ecec1-0496-4dfa-9165-3b5ead50f0b9",
    "role": "teacher",
    "order": 1,
    "score": 5,
    "section": "DARSDAN OLDIN TAYYORGARLIK (45-60 daqiqa)",
    "category": "Auditoriyani tekshirish",
    "description": "Doska toza, marker ishchi, proyektor ishchi, stullar tartibda",
    "isActive": true,
    "createdAt": "2026-05-21T12:11:17.971Z"
  },
  {
    "id": "020add1d-a472-4436-9792-47f04ebdc07a",
    "role": "teacher",
    "order": 2,
    "score": 5,
    "section": "DARSDAN OLDIN TAYYORGARLIK (45-60 daqiqa)",
    "category": "O'quvchilarning kompyuter/laptop-larini tekshirish",
    "description": "Barcha o'quvchining qurilmasi ishchi holatda ekanligini tekshirish",
    "isActive": true,
    "createdAt": "2026-05-21T12:11:17.974Z"
  },
  {
    "id": "b7620a40-b028-4fe6-9320-1899ee78ef96",
    "role": "teacher",
    "order": 3,
    "score": 5,
    "section": "DARSDAN OLDIN TAYYORGARLIK (45-60 daqiqa)",
    "category": "Dars skripti (lesson plan) o'qib chiqish",
    "description": "Bugungi dars mavzusi, maqsadi, rejasi bilan tanishish",
    "isActive": true,
    "createdAt": "2026-05-21T12:11:17.975Z"
  },
  {
    "id": "add61460-c2d1-4b42-9dca-1bac37a235e2",
    "role": "teacher",
    "order": 4,
    "score": 5,
    "section": "DARSDAN OLDIN TAYYORGARLIK (45-60 daqiqa)",
    "category": "O'quvchilarning muammolarini o'rganish",
    "description": "Kim o'qib tushunmadi, kim qiyin deb hisoblayotganini aniqlash va unga to'g'ri tushuncha berish",
    "isActive": true,
    "createdAt": "2026-05-21T12:11:17.976Z"
  },
  {
    "id": "2546158c-49fa-4d04-ac78-8a2e8a12c93c",
    "role": "teacher",
    "order": 5,
    "score": 8,
    "section": "DARS BOSHLANISHIDA",
    "category": "Darsni o'z vaqtida boshlash",
    "description": "Darsni kechiktirish o'quvchilar vaqtiga xiyonat",
    "isActive": true,
    "createdAt": "2026-05-21T12:11:17.976Z"
  },
  {
    "id": "5a4a3fd9-e0b6-4e69-80cb-8e35e4d18ad2",
    "role": "teacher",
    "order": 6,
    "score": 7,
    "section": "DARS BOSHLANISHIDA",
    "category": "Dars maqsadi va rejasini aytib berish",
    "description": "Bugun biz nima o'rganamiz, maqsad nima' deb tushuntirish",
    "isActive": true,
    "createdAt": "2026-05-21T12:11:17.977Z"
  },
  {
    "id": "d670fa37-df1b-4212-a95d-c04dbcb5c3d4",
    "role": "teacher",
    "order": 7,
    "score": 7,
    "section": "DARS BOSHLANISHIDA",
    "category": "Dars vaqtini boshqarish",
    "description": "Dars scripti bo'yicha vaqtga rioya qilish, (1.45 minut)",
    "isActive": true,
    "createdAt": "2026-05-21T12:11:17.978Z"
  },
  {
    "id": "0021e806-2410-4d02-8760-33ff4cc5d723",
    "role": "teacher",
    "order": 8,
    "score": 9,
    "section": "DARS DAVOMIDA (ASOSIY FAOLIYAT)",
    "category": "Kuchli o'quvchini kuchsiziga sherik qilish",
    "description": "Yaxshi o'quvchi yomon o'quvchiga yordam beradigan qilib o'rnatish",
    "isActive": true,
    "createdAt": "2026-05-21T12:11:17.978Z"
  },
  {
    "id": "3d726336-33c9-41c1-966f-6097d6f56939",
    "role": "teacher",
    "order": 9,
    "score": 8,
    "section": "DARS OXIRIDA (YAKUNLASH - 5-10 daqiqa)",
    "category": "Uyga vazifani aniq berish",
    "description": "Keyingi darsga qanday uy ishi kerakligini aniq aytish, yozib berish",
    "isActive": true,
    "createdAt": "2026-05-21T12:11:17.979Z"
  },
  {
    "id": "ee5d99f7-37ee-4a13-80ac-ed252befcc42",
    "role": "teacher",
    "order": 10,
    "score": 5,
    "section": "DARS OXIRIDA (YAKUNLASH - 5-10 daqiqa)",
    "category": "Texnikani o'chirish",
    "description": "Proyektor, speaker, kompyuterni o'chirish, tartibli holda qoldirish",
    "isActive": true,
    "createdAt": "2026-05-21T12:11:17.980Z"
  },
  {
    "id": "4bc1df8f-5754-4d68-810c-67f472f3c1cc",
    "role": "teacher",
    "order": 11,
    "score": 6,
    "section": "DARSDAN KEYIN",
    "category": "Auditoriyani tozalash, Stullarni joylashtirib ketish",
    "description": "Doska o'chirish, tozalikga rioya qilish, keyingi dars jarayoni uchun tartibli bo'lishi zarur, Stullarni tartibda joylashtirib ketish",
    "isActive": true,
    "createdAt": "2026-05-21T12:11:17.980Z"
  },
  {
    "id": "5e82c67b-d07d-444c-ba05-4af5ff45bd3b",
    "role": "filial_rahbari",
    "order": 1,
    "score": 8,
    "section": "Kunlik vazifalar",
    "category": "Xodimlar intizomi",
    "description": "Hammasi o'z vaqtida keldi · Dress-code to'g'ri · Ish holati qulay",
    "isActive": true,
    "createdAt": "2026-05-21T11:53:07.274Z"
  },
  {
    "id": "42567e04-ea8b-410b-910d-e496a3dc6566",
    "role": "filial_rahbari",
    "order": 2,
    "score": 8,
    "section": "Kunlik vazifalar",
    "category": "Luchka (5 min)",
    "description": "Sotuv, Akademik, Admin bo'lim boshliqlar bilan kun rejasi",
    "isActive": true,
    "createdAt": "2026-05-21T11:53:07.276Z"
  },
  {
    "id": "be9b6061-88a8-41d4-80a1-31dfa63ac198",
    "role": "filial_rahbari",
    "order": 3,
    "score": 9,
    "section": "Kunlik vazifalar",
    "category": "Markaz holati",
    "description": "Binoning tozaligi · Texnik jihozlar sozlimi · Muhit qulay",
    "isActive": true,
    "createdAt": "2026-05-21T11:53:07.277Z"
  },
  {
    "id": "3e29fdcd-e408-464a-b871-1061892ac4e1",
    "role": "filial_rahbari",
    "order": 4,
    "score": 5,
    "section": "Kunlik vazifalar",
    "category": "Guruhlar to'lishi",
    "description": "Ochilayotgan guruhlar · Demo darsga kelish %",
    "isActive": true,
    "createdAt": "2026-05-21T11:53:07.278Z"
  },
  {
    "id": "fde27419-0e63-4968-967c-22c05d94d4c4",
    "role": "filial_rahbari",
    "order": 5,
    "score": 7,
    "section": "Kunlik vazifalar",
    "category": "Dars monitoringi",
    "description": "2-3 ta auditoriyada: o'qituvchi metodikasi · O'quvchi jalb darajasi",
    "isActive": true,
    "createdAt": "2026-05-21T11:53:07.279Z"
  },
  {
    "id": "c4524448-f505-4118-8f26-05bad4c32ac2",
    "role": "filial_rahbari",
    "order": 6,
    "score": 6,
    "section": "Kunlik vazifalar",
    "category": "NPS (O'quvchi fikri)",
    "description": "Suhbatlashib teskari aloqa · Shikoyatlar yo'q",
    "isActive": true,
    "createdAt": "2026-05-21T11:53:07.279Z"
  },
  {
    "id": "f051bd63-84a7-45bb-b67d-f3494d02d371",
    "role": "filial_rahbari",
    "order": 7,
    "score": 6,
    "section": "Kunlik vazifalar",
    "category": "HR va Jamoaviy holat",
    "description": "Xodimlar ruh-aholi · Ichki nizolar · EJM taraqqiyoti",
    "isActive": true,
    "createdAt": "2026-05-21T11:53:07.280Z"
  },
  {
    "id": "155d7ea1-b368-4476-b794-30c859631e96",
    "role": "filial_rahbari",
    "order": 8,
    "score": 1,
    "section": "Kunlik vazifalar",
    "category": "KPI tahlili",
    "description": "Savdo hajmi (plan vs. fakt) · Yangi o'quvchilar · Churn rate",
    "isActive": true,
    "createdAt": "2026-05-21T11:53:07.281Z"
  },
  {
    "id": "a0727cef-9d6f-4970-bcc0-0704c986cd3f",
    "role": "filial_rahbari",
    "order": 9,
    "score": 1,
    "section": "Kunlik vazifalar",
    "category": "Ertangi reja",
    "description": "Bugungi muammolarni bartaraf qilish tasklari · Mas'ullar belgilandi",
    "isActive": true,
    "createdAt": "2026-05-21T11:53:07.281Z"
  },
  {
    "id": "917c1de2-9ba2-4818-bbf3-69c65270578e",
    "role": "filial_rahbari",
    "order": 10,
    "score": 1,
    "section": "Kunlik vazifalar",
    "category": "Yakuniy Hisobot",
    "description": "Filial holati · Moliya natijalari · Founder'ga yuborish",
    "isActive": true,
    "createdAt": "2026-05-21T11:53:07.282Z"
  },
  {
    "id": "0cadf090-286c-43dc-83b2-8a45b1efe283",
    "role": "robototexnika_ustoz",
    "order": 1,
    "score": 7,
    "section": "Dars boshlanishidan 30-45 daqiqa oldin tayyorlash",
    "category": "Auditoriyani tekshirish",
    "description": "Doska toza, marker ishchi, proyektor ishchi, stullar tartibda",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.264Z"
  },
  {
    "id": "c4c82094-b2be-454c-b8af-b5ba56708b6f",
    "role": "robototexnika_ustoz",
    "order": 2,
    "score": 9,
    "section": "Dars boshlanishidan 30-45 daqiqa oldin tayyorlash",
    "category": "Robototexnika to'plamlarini tekshirish",
    "description": "LEGOni hech qaysi to'plam yo'qolmaganligini tekshirish · Barcha batareya yetarli bo'lganini tekshirish · zaryadlovchining ishlayotgani sinab ko'rish",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.269Z"
  },
  {
    "id": "4090c863-7954-4281-a9c2-c27d4489079a",
    "role": "robototexnika_ustoz",
    "order": 3,
    "score": 8,
    "section": "Dars boshlanishidan 30-45 daqiqa oldin tayyorlash",
    "category": "Dars plani tekshirish",
    "description": "Bugungi dars rejasi, maqsadi va qaysi mavzuni ko'rsatamiz deb tekshirish",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.270Z"
  },
  {
    "id": "e67db55e-db66-4323-ba61-5b742041b89d",
    "role": "robototexnika_ustoz",
    "order": 4,
    "score": 7,
    "section": "Dars boshlanishidan 30-45 daqiqa oldin tayyorlash",
    "category": "Baholash mezonlari tayyor",
    "description": "O'quvchilarni necha ball bilan baholash (1-5 ball coin) mezonlarini yozib olish",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.271Z"
  },
  {
    "id": "15e191b2-92f5-483f-be73-abb2b67f39e1",
    "role": "robototexnika_ustoz",
    "order": 5,
    "score": 6,
    "section": "Dars boshlanishidan 30-45 daqiqa oldin tayyorlash",
    "category": "O'quvchilar ro'yxatini o'qish",
    "description": "Bugungi o'quvchilar kelishi davomati",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.271Z"
  },
  {
    "id": "1cf5066d-9d80-437d-a319-cf36eefe57c0",
    "role": "robototexnika_ustoz",
    "order": 6,
    "score": 8,
    "section": "FASL 2 — DARS BOSHLANISHI",
    "category": "Dars qoidalarini tushuntirish",
    "description": "Bir-biriga hurmat, xavfsizlik, savol berish masalasi, bir-biriga yordam berishni tushuntirish",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.272Z"
  },
  {
    "id": "bde692a1-ca8b-4614-833b-07d1baeffa11",
    "role": "robototexnika_ustoz",
    "order": 7,
    "score": 8,
    "section": "FASL 3 — ASOSIY DARS",
    "category": "Darsni kichik bo'laklarga bo'lish",
    "description": "1 ta darsda 2 dasturni o'rganishni ta'minlash",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.273Z"
  },
  {
    "id": "277d871e-020f-412e-99d8-fe772f3aa3ad",
    "role": "robototexnika_ustoz",
    "order": 8,
    "score": 9,
    "section": "FASL 3 — ASOSIY DARS",
    "category": "Kod yozish namunasi",
    "description": "Kompyutorda yoki skratch kod yozib, har bir qatorning ma'nosi nima ekanligini tushuntirish",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.274Z"
  },
  {
    "id": "8175491b-048b-4554-a581-a8aae14bbf61",
    "role": "robototexnika_ustoz",
    "order": 9,
    "score": 9,
    "section": "FASL 4 — AMALIY ISH",
    "category": "Savol-javob usuli (Socratic)",
    "description": "Javob berib turmaslik, \"Nega?\", \"Agar o'zgartarsak?\", \"Qaysi qator?\" deb savol berish",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.274Z"
  },
  {
    "id": "d7cfaa2e-524a-4580-8474-4c3cbae6c716",
    "role": "robototexnika_ustoz",
    "order": 10,
    "score": 8,
    "section": "FASL 4 — AMALIY ISH",
    "category": "O'quvchilar o'zaro yordam",
    "description": "Agar birov qiyinchilik cheksa: \"Boshqasidan so'ra, birga yechish\" deb aytish. Kuchli o'quvchini kuchsiz o'quvchiga biriktirish",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.275Z"
  },
  {
    "id": "38556971-6e91-4c15-b19f-a692fe507993",
    "role": "robototexnika_ustoz",
    "order": 11,
    "score": 8,
    "section": "FASL 4 — AMALIY ISH",
    "category": "Xatoliklarni tuzatish",
    "description": "Kod ishlamasa, qaysi qatorda xato bo'lganini birga topib, qo'llab tuzatish",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.276Z"
  },
  {
    "id": "83857406-1b43-4eef-a18e-c6b909bf01d9",
    "role": "robototexnika_ustoz",
    "order": 12,
    "score": 6,
    "section": "FASL 7 — DARSDAN KEYIN",
    "category": "Auditoriyani tozalash, Stullarni joylashtirib ketish",
    "description": "Doska o'chirish, tozalikga rioya qilish, keyingi dars uchun tartibli bo'lishi zarur, Stullarni tartibda joylashtirib ketish",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.276Z"
  },
  {
    "id": "bdafee6c-b735-44f0-869d-76f0e62d1bb8",
    "role": "assistant",
    "order": 1,
    "score": 8,
    "section": "DARSDAN OLDIN TAYYORGARLIK (30-45 daqiqa)",
    "category": "Mentor bilan jarayon-yondashuv",
    "description": "Mentor nima qilishini bilsin, qanday yordam berish kerakligini bilsin",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.277Z"
  },
  {
    "id": "97d50cdc-30d5-41de-b4a8-e0bd6145a377",
    "role": "assistant",
    "order": 2,
    "score": 7,
    "section": "DARSDAN OLDIN TAYYORGARLIK (30-45 daqiqa)",
    "category": "Auditoriyani tayyorlash",
    "description": "Stullar tartibda, doskalar toza, proyektor ishchi holatda, Wi-Fi tekshirish",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.278Z"
  },
  {
    "id": "6aa5299d-6991-49c7-bfaa-88c462edc3a9",
    "role": "assistant",
    "order": 3,
    "score": 7,
    "section": "DARSDAN OLDIN TAYYORGARLIK (30-45 daqiqa)",
    "category": "O'quvchilar qurilmalarini tekshirish",
    "description": "Kompyuter/laptop-larini ishchi holatda ekanligini tekshirish",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.278Z"
  },
  {
    "id": "b902dd90-c512-48b5-b7aa-5de4162c12b0",
    "role": "assistant",
    "order": 4,
    "score": 8,
    "section": "DARSDAN OLDIN TAYYORGARLIK (30-45 daqiqa)",
    "category": "Uyga vazifalarini tekshirish uchun tayyorlash",
    "description": "Oldingi dars uy ishi materiallarini yig'ish, mentor uchun tayyorlash",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.279Z"
  },
  {
    "id": "daf01375-4132-4091-8fd8-ff22453fe5b4",
    "role": "assistant",
    "order": 5,
    "score": 7,
    "section": "DARSDAN OLDIN TAYYORGARLIK (30-45 daqiqa)",
    "category": "O'quvchi feedback-larini qayd qilish",
    "description": "Oldingi darsdan o'quvchi muammolari, savollarini yozish",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.280Z"
  },
  {
    "id": "f9399efc-67c1-4009-870e-b3251227859e",
    "role": "assistant",
    "order": 6,
    "score": 8,
    "section": "DARS DAVOMIDA (45-60 daqiqa)",
    "category": "Mentor uchun yordamchi vazifalar",
    "description": "Proyektor kontrollash, video ijro qilish, audio sozlash",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.280Z"
  },
  {
    "id": "32bb7c1b-e4ac-4c87-9798-ffa3e6bfd1d8",
    "role": "farrosh",
    "order": 13,
    "score": 6,
    "section": "HAFTALIK VAZIFALAR",
    "category": "Har 4 kunda — Oynalar",
    "description": "Dog'siz",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.139Z"
  },
  {
    "id": "5fc234ab-58e3-4e39-bf06-338d1a3567ad",
    "role": "assistant",
    "order": 7,
    "score": 7,
    "section": "DARS OXIRIDA",
    "category": "Yangi kelgan O'quvchiga yordam berish",
    "description": "O'quvchining dars haqida fikri, nima qiyin bo'ldi",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.281Z"
  },
  {
    "id": "d504a91c-35de-49f0-921d-d0292eae5065",
    "role": "assistant",
    "order": 8,
    "score": 5,
    "section": "DARSDAN KEYIN",
    "category": "Auditoriyani tozalash",
    "description": "Doskani o'chirish, stullarni tartibda qo'yish",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.282Z"
  },
  {
    "id": "0239d832-7172-4e53-821a-d79e15a8ba67",
    "role": "assistant",
    "order": 9,
    "score": 5,
    "section": "DARSDAN KEYIN",
    "category": "Qurollarni yig'ish va saqlash",
    "description": "Proyektor, speaker, markerlarni bir chetga olib yig'ish · Laptoplarni va quvvatlagichlarni joy-joyiga qo'yish",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.282Z"
  },
  {
    "id": "0d417f20-e9c4-43b9-9782-5bbfee080b7d",
    "role": "assistant",
    "order": 10,
    "score": 7,
    "section": "DARSDAN KEYIN",
    "category": "Keyingi dars uchun tayyorlash",
    "description": "Keyingi dars materiallari, plan-ni mentor bilan ko'rish",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.283Z"
  },
  {
    "id": "3958528f-61b1-45a2-966b-06038057701c",
    "role": "assistant",
    "order": 11,
    "score": 8,
    "section": "KOWORKING VA QO'SHIMCHA VAZIFALAR",
    "category": "Koworking-da o'quvchilarga 24/7 yordam",
    "description": "Online/offline o'quvchilarni mentordan qidiruv qilsa, javob berish",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.283Z"
  },
  {
    "id": "4bc308f5-caad-457d-8f19-f3b6a5c72139",
    "role": "assistant",
    "order": 12,
    "score": 7,
    "section": "KOWORKING VA QO'SHIMCHA VAZIFALAR",
    "category": "Kelmagan va ortda qolgan o'quvchilarni ko'maklashish",
    "description": "Kimsa kelmasa, replay yoki additional session o'tkazish",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.284Z"
  },
  {
    "id": "83d0ada0-b4e1-415e-9dde-c555bd665cc1",
    "role": "assistant",
    "order": 13,
    "score": 7,
    "section": "KOWORKING VA QO'SHIMCHA VAZIFALAR",
    "category": "O'quvchilar muammolariga yechim berish",
    "description": "muammolaga yechim berishga harakat qilish",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.284Z"
  },
  {
    "id": "14df7ad3-e350-4618-908b-297d96be534a",
    "role": "assistant",
    "order": 14,
    "score": 7,
    "section": "KOWORKING VA QO'SHIMCHA VAZIFALAR",
    "category": "Demo day tayyorlashda yordam",
    "description": "O'quvchilarni Demo day da hayajonini yengish uchun yordam berish",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.285Z"
  },
  {
    "id": "eef2c2b3-9a02-40ab-9e67-8499b0bd2eff",
    "role": "assistant",
    "order": 15,
    "score": 8,
    "section": "KOWORKING VA QO'SHIMCHA VAZIFALAR",
    "category": "Dars materiallarini yangilash va mentorga yordam berish",
    "description": "Har hafta/oylik dars larda nimalarni o'rganganini mentorga hisobot berish",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.286Z"
  },
  {
    "id": "3a17856e-19be-4e66-81ce-8bb886722c85",
    "role": "moliya_rahbari",
    "order": 1,
    "score": 9,
    "section": "ERTALAB TAYYORGARLIK",
    "category": "Kassa qoldig'ini tekshirish",
    "description": "Kechagi kassa qoldig'i va bugungi boshlang'ich saldo mosligini tekshirish",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.286Z"
  },
  {
    "id": "902ee0c5-0ac5-4dfc-a88a-1df1f9ae8f97",
    "role": "moliya_rahbari",
    "order": 2,
    "score": 8,
    "section": "ERTALAB TAYYORGARLIK",
    "category": "Bank hisoblarini tekshirish",
    "description": "Barcha hisoblardagi balans va kutilayotgan to'lovlarni ko'rish",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.287Z"
  },
  {
    "id": "02d111e2-3750-4eb9-8501-0b4640ee3397",
    "role": "moliya_rahbari",
    "order": 3,
    "score": 8,
    "section": "ERTALAB TAYYORGARLIK",
    "category": "Bugungi to'lovlar jadvalini ko'rib chiqish",
    "description": "Kirim va chiqim to'lovlar ro'yxatini tayyorlash",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.287Z"
  },
  {
    "id": "5494a57c-2f0d-4799-a398-f5c809b65334",
    "role": "moliya_rahbari",
    "order": 4,
    "score": 9,
    "section": "KUN DAVOMIDA",
    "category": "Kirim-chiqimlarni qayd etish",
    "description": "Har bir to'lov va xarajat bazaga kiritildi",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.288Z"
  },
  {
    "id": "0b829304-6ece-4b34-8831-06a4c11b7c11",
    "role": "moliya_rahbari",
    "order": 5,
    "score": 8,
    "section": "KUN DAVOMIDA",
    "category": "Kassirdan hisobot qabul qilish",
    "description": "Kunlik kassa hisobotini tekshirish va tasdiqlash",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.288Z"
  },
  {
    "id": "c3c42a4d-3fab-45e1-8bdf-37185c53404d",
    "role": "moliya_rahbari",
    "order": 6,
    "score": 8,
    "section": "KUN DAVOMIDA",
    "category": "Qarzdorlar ro'yxatini yangilash",
    "description": "Muddati o'tgan to'lovlar va eslatmalar yuborish",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.289Z"
  },
  {
    "id": "788970f8-900a-42f8-8a39-96626a1b2545",
    "role": "moliya_rahbari",
    "order": 7,
    "score": 7,
    "section": "KUN DAVOMIDA",
    "category": "Xarajatlarni tasdiqlash va nazorat qilish",
    "description": "Kerakli xarajatlar tasdiqlandi, hujjatlar saqlandi",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.289Z"
  },
  {
    "id": "3c4d618c-c303-4c70-b435-fcd1adc57bea",
    "role": "moliya_rahbari",
    "order": 8,
    "score": 9,
    "section": "KUN DAVOMIDA",
    "category": "Moliyaviy ko'rsatkichlarni kuzatish",
    "description": "Plan vs fakt tahlili, og'ish sabablarini aniqlash",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.290Z"
  },
  {
    "id": "8f185b39-4849-4802-b0d1-2e26dd3ca032",
    "role": "moliya_rahbari",
    "order": 9,
    "score": 9,
    "section": "KUN YAKUNI",
    "category": "Kunlik moliyaviy hisobot tuzish",
    "description": "Jami kirim, xarajat, sof foyda hisoblandi",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.291Z"
  },
  {
    "id": "a9ee0b1f-0a13-48c4-957c-aa9238b603f2",
    "role": "moliya_rahbari",
    "order": 10,
    "score": 9,
    "section": "KUN YAKUNI",
    "category": "Hisobotni rahbarga yuborish",
    "description": "Telegram/email orqali to'liq hisobot yuborildi",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.291Z"
  },
  {
    "id": "68008fb9-0060-4e0e-b210-14f1408279e6",
    "role": "moliya_rahbari",
    "order": 11,
    "score": 8,
    "section": "KUN YAKUNI",
    "category": "Seyf va hujjatlarni berkitish",
    "description": "Naqd pul seyfda, barcha hujjatlar o'z joyida",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.292Z"
  },
  {
    "id": "facdb310-2ed6-4a3a-a274-c4f0291a5fe3",
    "role": "sotuv_operatori",
    "order": 1,
    "score": 7,
    "section": "ERTALAB BLOKI (08:00 — 09:30)",
    "category": "Ish formasiga rioya qiling",
    "description": "Klassik kiyim · Toza va dazmollangan · Neytral hid",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.293Z"
  },
  {
    "id": "841bf170-eeec-44c6-9468-a7b864ac74d0",
    "role": "sotuv_operatori",
    "order": 2,
    "score": 9,
    "section": "ERTALAB BLOKI (08:00 — 09:30)",
    "category": "Ishga o'z vaqtida keling",
    "description": "Ish joyiga o'z vaqtida yetib keling, kechikish = 0",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.293Z"
  },
  {
    "id": "1559cf3f-2fda-415c-9aa4-276feb172661",
    "role": "sotuv_operatori",
    "order": 3,
    "score": 6,
    "section": "ERTALAB BLOKI (08:00 — 09:30)",
    "category": "Jihozlar va tozalikni ko'zdan kechiring",
    "description": "Oynalar · Eshiklar · Qabul stoli · Mijoz stoli · Xonalar",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.294Z"
  },
  {
    "id": "7f20f20d-f289-4e2f-975a-c172ab74d22d",
    "role": "sotuv_operatori",
    "order": 4,
    "score": 5,
    "section": "ERTALAB BLOKI (08:00 — 09:30)",
    "category": "Havo aylanishini tekshiring",
    "description": "Xonalar dim emaski · Konditsioner/ventilyatsiya ishlayapmi",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.295Z"
  },
  {
    "id": "a5e42c79-9864-49a5-bda4-3dc859b4ad7e",
    "role": "sotuv_operatori",
    "order": 5,
    "score": 7,
    "section": "ERTALAB BLOKI (08:00 — 09:30)",
    "category": "Telegram guruhini tekshiring",
    "description": "Yangi xabarlar · Rahbar topshiriqlari · Javobsiz murojaatlar",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.295Z"
  },
  {
    "id": "f88691b4-a23c-4de3-bc7a-05593f198d1d",
    "role": "sotuv_operatori",
    "order": 6,
    "score": 9,
    "section": "ASOSIY ISH VAQTI (08:30 — 16:00)",
    "category": "Kelgan mijozlarni kutib oling",
    "description": "O'rningizdan turing · Tabassum · Xushmuomila · Korporativ forma",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.296Z"
  },
  {
    "id": "62a2474d-8d36-48b3-978e-9a755395498f",
    "role": "sotuv_operatori",
    "order": 7,
    "score": 7,
    "section": "ASOSIY ISH VAQTI (08:30 — 16:00)",
    "category": "Kelgan mehmon/Rahbarga ichimlik taklif qiling",
    "description": "Agar Kompaniyaga Mehmon alohida tashrif bilan kelsa, yoki rahbarga ichimlik taklif qilish",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.296Z"
  },
  {
    "id": "dcbbac2f-736c-47df-a180-b63844b5c82f",
    "role": "sotuv_operatori",
    "order": 8,
    "score": 9,
    "section": "ASOSIY ISH VAQTI (08:30 — 16:00)",
    "category": "Yangi mijozlarga taqdim qiling va shartnoma tuzing",
    "description": "Prezentatsiya uchun slaydlar tayyor holda · Shartnoma to'ldirilgan · Imzo va muhri bor · Nusxa mijozga",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.297Z"
  },
  {
    "id": "563b2323-a617-4102-9c03-924cbe1ab941",
    "role": "sotuv_operatori",
    "order": 9,
    "score": 8,
    "section": "ASOSIY ISH VAQTI (08:30 — 16:00)",
    "category": "To'lovlar bazasini yangilang",
    "description": "To'g'ri yozing · Hisobotni Telegram guruhiga yuboring",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.297Z"
  },
  {
    "id": "a5a8f67e-d8f4-42a2-b330-cb25ad736d9b",
    "role": "sotuv_operatori",
    "order": 10,
    "score": 9,
    "section": "ASOSIY ISH VAQTI (08:30 — 16:00)",
    "category": "O'quvchilardan o'z vaqtida to'lov undiring",
    "description": "Muddati yetganlarni aniqlash · Qo'ng'iroq · Eslatma yuborish",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.298Z"
  },
  {
    "id": "5268386e-2775-4f1b-8226-663c33e5471d",
    "role": "sotuv_operatori",
    "order": 11,
    "score": 8,
    "section": "ASOSIY ISH VAQTI (08:30 — 16:00)",
    "category": "PROFTEST orqali yangi mijoz natijasini aniqlang",
    "description": "Test o'tkazildi · Natija bazaga kiritildi · Fan va guruh belgilandi",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.299Z"
  },
  {
    "id": "f6424676-dadf-40d2-9a33-b33fa4c4454d",
    "role": "sotuv_operatori",
    "order": 12,
    "score": 8,
    "section": "ASOSIY ISH VAQTI (08:30 — 16:00)",
    "category": "Guruhlar to'lib ochilishini nazorat qiling",
    "description": "Minimal/maksimal o'quvchi soni · Bo'sh o'rinlar hisobi",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.299Z"
  },
  {
    "id": "927c0b17-6510-4bc7-b606-5a5c4365479c",
    "role": "sotuv_operatori",
    "order": 13,
    "score": 7,
    "section": "ASOSIY ISH VAQTI (08:30 — 16:00)",
    "category": "Bog'lanib bo'lmagan raqamlar bilan qayta aloqa",
    "description": "Band bo'lganlar · Telefonni ko'tarmaganlar · o'sha kuni qayta qo'ng'iroq",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.300Z"
  },
  {
    "id": "28fc426d-2d73-4f3d-b6ee-84350469c3fa",
    "role": "sotuv_operatori",
    "order": 14,
    "score": 8,
    "section": "ASOSIY ISH VAQTI (08:30 — 16:00)",
    "category": "Qarzdorlarni eslatib chiqing",
    "description": "Ro'yxat bor · Qo'ng'iroq qilindi · Natija bazaga yozildi",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.300Z"
  },
  {
    "id": "e87353e6-2475-422f-bdf5-77ed29896024",
    "role": "sotuv_operatori",
    "order": 15,
    "score": 8,
    "section": "ASOSIY ISH VAQTI (08:30 — 16:00)",
    "category": "Yangi o'quvchilarning darslarga kirishini ta'minlang",
    "description": "Fan · Guruh · Vaqt aniq ko'rsatilgan · O'quvchi xabardor",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.301Z"
  },
  {
    "id": "3d4e0263-9d0e-45ea-a649-85f87b34c156",
    "role": "sotuv_operatori",
    "order": 16,
    "score": 9,
    "section": "KUN YOPILISHI",
    "category": "Kunlik hisobotni rahbarga yuboring",
    "description": "To'lovlar · Yangi o'quvchilar · Muammolar · Telegram orqali",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.301Z"
  },
  {
    "id": "a6368d3f-fd20-4fdf-8da8-9f7b54b0afe2",
    "role": "sotuv_operatori",
    "order": 17,
    "score": 6,
    "section": "KUN YOPILISHI",
    "category": "Barcha jihozlarni o'chiring",
    "description": "Kompyuter · Printer · Kuler · Konditsioner · Isitgich",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.302Z"
  },
  {
    "id": "f0e51ee2-b68e-4a9a-bfd1-03699d1e17d3",
    "role": "sotuv_operatori",
    "order": 18,
    "score": 7,
    "section": "KUN YOPILISHI",
    "category": "Eshiklar va xonalarni ko'zdan kechiring",
    "description": "Barcha xonalar berkitilgan · Kalit mas'ulga topshirilgan",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.302Z"
  },
  {
    "id": "230d5d9d-f3d3-4846-a311-8af49982c61a",
    "role": "kassir",
    "order": 1,
    "score": 7,
    "section": "ISHGA TAYYORGARLIK (08:30 — 09:00)",
    "category": "Shaxsiy ko'rinish",
    "description": "Korporativ forma · Bejik · Sochlar tartibli · Toza",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.303Z"
  },
  {
    "id": "f600f21e-901e-4d7e-bd51-9d6625cc1d26",
    "role": "kassir",
    "order": 2,
    "score": 8,
    "section": "ISHGA TAYYORGARLIK (08:30 — 09:00)",
    "category": "Ish joyini tekshiring",
    "description": "Kassa stoli · CRM (Modme) ochiq · Printer tayyor",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.304Z"
  },
  {
    "id": "cc9c1de5-5702-476a-9d58-94049e47ef22",
    "role": "kassir",
    "order": 3,
    "score": 8,
    "section": "ISHGA TAYYORGARLIK (08:30 — 09:00)",
    "category": "Kompyuter va dasturlarni ishga tushiring",
    "description": "Kompyuter yoqiq · Modme (CRM) ochiq · Excel tayyor · Telefon zaryadda",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.304Z"
  },
  {
    "id": "0147e602-8884-4b22-b26d-5a54fa76eded",
    "role": "kassir",
    "order": 4,
    "score": 5,
    "section": "ISHGA TAYYORGARLIK (08:30 — 09:00)",
    "category": "Servis burchagi zaxirasini tekshiring",
    "description": "Kofe · Choy · Suv · Shakar · Salfetka · Konfetlar",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.305Z"
  },
  {
    "id": "f42c6d93-fff3-456b-9bb9-0eca92ff97f5",
    "role": "kassir",
    "order": 5,
    "score": 5,
    "section": "ISHGA TAYYORGARLIK (08:30 — 09:00)",
    "category": "Ta'minot zaxirasini tekshiring",
    "description": "Marker · Qog'oz (A4) · Printer · Skotch · Tozalik vositalari",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.306Z"
  },
  {
    "id": "ebf4b677-5e19-451a-b529-c20b617fdd65",
    "role": "kassir",
    "order": 6,
    "score": 9,
    "section": "YANGI O'QUVCHILAR (0 DAN KELGANLAR)",
    "category": "Mijoz kelsa — O'RNINGIZDAN TURIB kutib oling",
    "description": "Tabassum · Korporativ forma",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.306Z"
  },
  {
    "id": "cbee81f8-0d8a-4046-860f-9e97736f2333",
    "role": "kassir",
    "order": 7,
    "score": 9,
    "section": "YANGI O'QUVCHILAR (0 DAN KELGANLAR)",
    "category": "Modmega to'liq ro'yxatdan o'tkazing",
    "description": "Ism · Tel · Fan · Maqsad · Manbai — barcha kiritildi",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.307Z"
  },
  {
    "id": "792b8a4d-348a-4f00-81d1-f93d53ed380a",
    "role": "kassir",
    "order": 8,
    "score": 9,
    "section": "YANGI O'QUVCHILAR (0 DAN KELGANLAR)",
    "category": "Shartnoma tuzing",
    "description": "Shartnoma to'liq to'ldirildi · Imzo olindi · Nusxa mijozga",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.308Z"
  },
  {
    "id": "cb23b3e9-63e1-45f3-b96b-313a98533ae3",
    "role": "kassir",
    "order": 9,
    "score": 9,
    "section": "ESKI O'QUVCHILAR — TO'LOV QABUL (Tushlik 12:30-13:40)",
    "category": "To'lovlarni qabul qiling va Modmega kiriting",
    "description": "Summa to'g'ri · Modmega kiritildi · Chek",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.308Z"
  },
  {
    "id": "d16889cd-4179-4c85-9c13-1ba084860e17",
    "role": "kassir",
    "order": 10,
    "score": 8,
    "section": "ESKI O'QUVCHILAR — TO'LOV QABUL (Tushlik 12:30-13:40)",
    "category": "To'lov qilmaganlar ro'yxatini yangilang",
    "description": "Ro'yxat tuzildi",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.309Z"
  },
  {
    "id": "7ec1e0ac-3af2-4094-a445-18cd98746928",
    "role": "kassir",
    "order": 11,
    "score": 8,
    "section": "ESKI O'QUVCHILAR — TO'LOV QABUL (Tushlik 12:30-13:40)",
    "category": "Qarzdorlarga qo'ng'iroq qiling",
    "description": "Muddatni bilib, necha marta to'lov eniqlang · Modmega natija yozildi",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.309Z"
  },
  {
    "id": "904f86eb-24f0-4507-9db6-c11203edc144",
    "role": "kassir",
    "order": 12,
    "score": 8,
    "section": "ESKI O'QUVCHILAR — TO'LOV QABUL (Tushlik 12:30-13:40)",
    "category": "Darsga kelmayotgan o'quvchilarning ota-onasiga xabar bering",
    "description": "2 dars ketma-ket kelmagan · SMS/Qo'ng'iroq · Sababi aniqlandi",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.310Z"
  },
  {
    "id": "632f5f0a-d39d-4135-8c57-4e600737b853",
    "role": "kassir",
    "order": 13,
    "score": 8,
    "section": "GAMIFIKATSIYA (COIN TIZIMI)",
    "category": "Vaqtida to'lov qilganlarga Coin bering",
    "description": "FAQAT to'lov qilganlarga · To'lamaganlarga ASLO qo'ymang · Barcha kiritildi",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.310Z"
  },
  {
    "id": "7aa5febd-2ff1-43e5-b906-13f9c0a4cb26",
    "role": "kassir",
    "order": 14,
    "score": 7,
    "section": "GAMIFIKATSIYA (COIN TIZIMI)",
    "category": "Sog'liklarni o'z vaqtida topshiring",
    "description": "Yig'ilgan coin tekshirildi · Zaxiradan so'ngi",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.311Z"
  },
  {
    "id": "d67bac4f-e5d5-4b81-8104-ee444af2a111",
    "role": "kassir",
    "order": 15,
    "score": 7,
    "section": "GAMIFIKATSIYA (COIN TIZIMI)",
    "category": "Sog'lar zaxirasini tekshiring",
    "description": "Zaxira ro'yxati ko'rildi · Rahbarga SMS yoborildi",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.312Z"
  },
  {
    "id": "905d2c54-03e7-4c1e-bf92-4af6c21812d8",
    "role": "kassir",
    "order": 16,
    "score": 9,
    "section": "MOLIYAVIY VA XIZMAT NAZORATI",
    "category": "Har kelgan to'lovni DARHOL Modmega kiriting",
    "description": "Summa to'g'ri · Sana to'g'ri · Fan va guruh belgilandi",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.312Z"
  },
  {
    "id": "531301d0-2c37-4e37-b8b8-1207ec690c57",
    "role": "kassir",
    "order": 17,
    "score": 6,
    "section": "MOLIYAVIY VA XIZMAT NAZORATI",
    "category": "Ofis ta'minot zaxirasini nazorat qiling",
    "description": "Printer · Qog'oz · Marker · jihozlar soni",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.313Z"
  },
  {
    "id": "1fc90dfb-2e20-4cb7-8a6a-af08d7979335",
    "role": "kassir",
    "order": 18,
    "score": 7,
    "section": "MOLIYAVIY VA XIZMAT NAZORATI",
    "category": "Ertangi kun uchun to'lovlarni aniqla",
    "description": "Wi-Fi · Modme · SMS xizmati · 1 kun oldindan eslatish",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.313Z"
  },
  {
    "id": "6fd912b5-f788-44c7-9dad-87895332463f",
    "role": "kassir",
    "order": 19,
    "score": 9,
    "section": "KUN YAKUNI VA HISOBOT (17:30 — 19:00)",
    "category": "Kunlik moliyaviy statistikani yig'ing",
    "description": "Jami tushum (naqd+karta) · Xarajatlar",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.314Z"
  },
  {
    "id": "96518091-45d8-4b68-bbce-ddc70ee308a3",
    "role": "kassir",
    "order": 20,
    "score": 8,
    "section": "KUN YAKUNI VA HISOBOT (17:30 — 19:00)",
    "category": "Ketib qolgan mijozlarni qayd eting",
    "description": "Sababi (naqd/qabul/boshqa) · Modmega yozildi",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.314Z"
  },
  {
    "id": "73c0b7e0-aafd-4308-8e65-efe023de6896",
    "role": "kassir",
    "order": 21,
    "score": 9,
    "section": "KUN YAKUNI VA HISOBOT (17:30 — 19:00)",
    "category": "Kunlik hisobotni rahbarga yuboring (Telegram)",
    "description": "To'lovlar · Yangi o'quvchilar · Muammolar · Xarajatlar · Gamifikatsiya",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.315Z"
  },
  {
    "id": "33a9ba0f-1f21-4f5b-8c77-0d9bbd2b837b",
    "role": "kassir",
    "order": 22,
    "score": 9,
    "section": "KUN YAKUNI VA HISOBOT (17:30 — 19:00)",
    "category": "Seyfni quflang",
    "description": "Naqd pul seyfda · Seyf quflandi · Kalit mas'ulga topshirildi",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.321Z"
  },
  {
    "id": "3a567551-60d4-4b74-be18-77537dc94ae5",
    "role": "kassir",
    "order": 23,
    "score": 7,
    "section": "KUN YAKUNI VA HISOBOT (17:30 — 19:00)",
    "category": "Barcha jihozlarni o'chiring",
    "description": "Kompyuter · Printer · Kuler · Konditsioner",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.321Z"
  },
  {
    "id": "0456147b-781b-4658-a27f-8711b70e5355",
    "role": "kassir",
    "order": 24,
    "score": 6,
    "section": "KUN YAKUNI VA HISOBOT (17:30 — 19:00)",
    "category": "Ish joyini yakuniy tartibga keltiring",
    "description": "Kassa stoli toza · Hujjatlar joylida · Ortiqcha narsalar yo'q",
    "isActive": true,
    "createdAt": "2026-05-21T12:37:27.322Z"
  },
  {
    "id": "fbc6ff50-409c-4da1-9e5c-c1639976d0e6",
    "role": "call_operatori",
    "order": 1,
    "score": 7,
    "section": "ISHGA TAYYORGARLIK (08:00 — 08:30)",
    "category": "Shaxsiy ko'rinish",
    "description": "Uniforma toza · Bejik taqqilgan · Sochlar tartibli · Maktiyaj me'yorida",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.115Z"
  },
  {
    "id": "775faf80-7472-4bba-bea6-64564c856aff",
    "role": "call_operatori",
    "order": 2,
    "score": 6,
    "section": "ISHGA TAYYORGARLIK (08:00 — 08:30)",
    "category": "Ish joyi tartibi",
    "description": "Stol usti toza · Ortiqcha buyumlar yo'q · Hujjatlar tartibda",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.125Z"
  },
  {
    "id": "6af51474-e1fc-4b50-817b-412ba4bf577b",
    "role": "call_operatori",
    "order": 3,
    "score": 8,
    "section": "ISHGA TAYYORGARLIK (08:00 — 08:30)",
    "category": "Texnik nazorat",
    "description": "Kompyuter yoniq · Garnitura ishlayapti · IP-telefoniya aktiv · amoCRM ochiq",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.125Z"
  },
  {
    "id": "11897c2c-ec0a-4173-9130-708c1e3a41ea",
    "role": "call_operatori",
    "order": 4,
    "score": 8,
    "section": "ISHGA TAYYORGARLIK (08:00 — 08:30)",
    "category": "Ma'lumot nazorati",
    "description": "Yangi guruhlar · Kurs narxlari · Skriptlar — barchasi ko'zdan kechirildi",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.126Z"
  },
  {
    "id": "afe3cc1d-7247-44c6-bb12-04ecf6782852",
    "role": "call_operatori",
    "order": 5,
    "score": 10,
    "section": "ISH JARAYONI VA SOTUV (08:30 — 16:30)",
    "category": "Yangi Lidlar bilan ishlash",
    "description": "Lid tushganidan so'ng 5 daqiqa ichida qo'ng'iroq qilish · Kechikish = 0",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.127Z"
  },
  {
    "id": "66a2dd74-4b7c-4600-b0e2-eefbe2029f82",
    "role": "call_operatori",
    "order": 6,
    "score": 9,
    "section": "ISH JARAYONI VA SOTUV (08:30 — 16:30)",
    "category": "Tashriflarni eslatish va tasdiqlash",
    "description": "Bugungi tashriflarni tasdiqlash · Kelishini ta'minlash · Vaqtini eslatish",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.127Z"
  },
  {
    "id": "87a113ee-2f99-4d40-9f10-da9c57149320",
    "role": "call_operatori",
    "order": 7,
    "score": 9,
    "section": "ISH JARAYONI VA SOTUV (08:30 — 16:30)",
    "category": "Voronka bo'yicha ish (amoCRM)",
    "description": "CRMdagi mijozlarni bosqichma-bosqich harakatlantirish · Har bir bosqich yangilandi",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.128Z"
  },
  {
    "id": "e2355a30-bdf9-4f75-b1d8-a5a495250d61",
    "role": "call_operatori",
    "order": 8,
    "score": 9,
    "section": "ISH JARAYONI VA SOTUV (08:30 — 16:30)",
    "category": "Guruh to'ldirish",
    "description": "Ochilishi yaqin guruhlarga maqsadli qo'ng'iroqlar · Reja: 50+ qo'ng'iroq/kun",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.129Z"
  },
  {
    "id": "6ba985d1-73f5-436b-b955-f391863f0b18",
    "role": "call_operatori",
    "order": 9,
    "score": 9,
    "section": "ISH JARAYONI VA SOTUV (08:30 — 16:30)",
    "category": "CRM intizomi",
    "description": "Har bir suhbat natijasini bazaga kiritish · Izohlar to'liq yozildi",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.130Z"
  },
  {
    "id": "049809e6-592e-4a47-9469-a793e3409727",
    "role": "call_operatori",
    "order": 10,
    "score": 9,
    "section": "KUN YAKUNI VA HISOBOT (16:30 — 18:00)",
    "category": "Kunlik statistika",
    "description": "Jami qo'ng'iroqlar (Reja: 50+) · Tashriflar soni",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.130Z"
  },
  {
    "id": "dc0fa070-d702-4583-b927-654171b24c77",
    "role": "call_operatori",
    "order": 11,
    "score": 9,
    "section": "KUN YAKUNI VA HISOBOT (16:30 — 18:00)",
    "category": "Kunlik hisobot (Telegram)",
    "description": "Rahbarga: Qo'ng'iroqlar · Tashriflar · CRM holati · Muammolar",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.131Z"
  },
  {
    "id": "fe74469b-055d-46bd-83cb-6b8e515647b8",
    "role": "call_operatori",
    "order": 12,
    "score": 6,
    "section": "KUN YAKUNI VA HISOBOT (16:30 — 18:00)",
    "category": "Xavfsizlik va kun yopilishi",
    "description": "Elektr jihozlar o'chirildi · Ish telefon va Laptoplar joyida · Ish joyi tartiblanidi",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.131Z"
  },
  {
    "id": "e4af950a-8ba6-4245-bb4b-a286ab30a137",
    "role": "farrosh",
    "order": 1,
    "score": 7,
    "section": "TONGGI TAYYORGARLIK (08:30 — 09:00)",
    "category": "Shaxsiy ko'rinish",
    "description": "Kiyim toza, tartibli",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.132Z"
  },
  {
    "id": "e5b4e0ed-8a84-4599-8f4c-c18668649096",
    "role": "farrosh",
    "order": 2,
    "score": 7,
    "section": "TONGGI TAYYORGARLIK (08:30 — 09:00)",
    "category": "Ish anjomlari",
    "description": "Paqir, latta, vositalar tayyor",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.133Z"
  },
  {
    "id": "7f9463ea-d791-4104-9b0e-96f6e4f1f8fd",
    "role": "farrosh",
    "order": 3,
    "score": 7,
    "section": "TONGGI TAYYORGARLIK (08:30 — 09:00)",
    "category": "Xonalarni tekshirish",
    "description": "Chiqindi yo'q",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.133Z"
  },
  {
    "id": "3519fff3-91ea-48c5-a1a8-57abf72b3ef3",
    "role": "farrosh",
    "order": 4,
    "score": 8,
    "section": "TOZALASH JARAYONI (Kun davomida)",
    "category": "Polni artish",
    "description": "Toza holat",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.134Z"
  },
  {
    "id": "5290a0f1-2eb0-41bb-8dab-b3012f7667eb",
    "role": "farrosh",
    "order": 5,
    "score": 7,
    "section": "TOZALASH JARAYONI (Kun davomida)",
    "category": "Podokonnik",
    "description": "Chang yo'q",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.135Z"
  },
  {
    "id": "88629262-2e9e-4336-aa11-ea7320914c61",
    "role": "farrosh",
    "order": 6,
    "score": 8,
    "section": "TOZALASH JARAYONI (Kun davomida)",
    "category": "Chiqindilar",
    "description": "Tashlab yuborilgan",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.135Z"
  },
  {
    "id": "318c0206-1a96-44cb-bcd6-9d717a483def",
    "role": "farrosh",
    "order": 7,
    "score": 7,
    "section": "TOZALASH JARAYONI (Kun davomida)",
    "category": "Kuller",
    "description": "Toza",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.136Z"
  },
  {
    "id": "27300dde-630e-4ff5-8f7a-81ab6631ccdd",
    "role": "farrosh",
    "order": 8,
    "score": 7,
    "section": "TARTIB VA NAZORAT (11:00 / 14:00 / 17:00)",
    "category": "Xonalar",
    "description": "Toza",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.136Z"
  },
  {
    "id": "534c5750-679e-47fa-829e-0afcfc3bb5ad",
    "role": "farrosh",
    "order": 9,
    "score": 7,
    "section": "TARTIB VA NAZORAT (11:00 / 14:00 / 17:00)",
    "category": "Derazalar",
    "description": "Dog' yo'q",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.137Z"
  },
  {
    "id": "bf5b2ff1-991a-460b-8853-b8a76c1ae0a1",
    "role": "farrosh",
    "order": 10,
    "score": 7,
    "section": "TARTIB VA NAZORAT (11:00 / 14:00 / 17:00)",
    "category": "Jihozlar",
    "description": "Toza",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.137Z"
  },
  {
    "id": "2c796ea5-83a9-40bf-a137-95f9b59b9669",
    "role": "farrosh",
    "order": 11,
    "score": 6,
    "section": "HAFTALIK VAZIFALAR",
    "category": "Chorshamba — Parta/stul oyoqlari",
    "description": "Toza",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.138Z"
  },
  {
    "id": "a436f2ce-b3e7-47f8-be19-d1359a189e78",
    "role": "farrosh",
    "order": 12,
    "score": 6,
    "section": "HAFTALIK VAZIFALAR",
    "category": "Shanba — Parta/stul oyoqlari",
    "description": "Toza",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.138Z"
  },
  {
    "id": "25609d44-e19f-4376-8ef9-7db5e1d9dd3d",
    "role": "farrosh",
    "order": 14,
    "score": 8,
    "section": "KUN YAKUNI (17:30)",
    "category": "Yakuniy tekshiruv",
    "description": "Hammasi toza",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.139Z"
  },
  {
    "id": "2d26d420-0bcc-48ee-9901-4d33453c1f3f",
    "role": "farrosh",
    "order": 15,
    "score": 8,
    "section": "KUN YAKUNI (17:30)",
    "category": "Oyna va eshiklar",
    "description": "Yopilgan",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.140Z"
  },
  {
    "id": "391fe551-bbea-40ed-8aa0-2cda87f127a3",
    "role": "nazoratchi",
    "order": 1,
    "score": 9,
    "section": "ERTALAB NAZORATI (08:00 — 09:00)",
    "category": "Xodimlar punktualligi",
    "description": "Admin, mentor, sotuv bo'limi kelish vaqtini qayd et · kaldi-ketti daftariga imzo olish",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.141Z"
  },
  {
    "id": "0f877221-f7ac-457e-a8e3-d71db6db447d",
    "role": "nazoratchi",
    "order": 2,
    "score": 8,
    "section": "ERTALAB NAZORATI (08:00 — 09:00)",
    "category": "Dress-code va etika",
    "description": "Kiyim-mezonga mos · Tashqi ko'rinish",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.142Z"
  },
  {
    "id": "548a511e-b6e4-4692-8cb1-6da0e036eaaa",
    "role": "nazoratchi",
    "order": 3,
    "score": 8,
    "section": "ERTALAB NAZORATI (08:00 — 09:00)",
    "category": "Admin cheklistini auditi (tanlanma)",
    "description": "Xonalar tozaligi real bajarilganmi · Choy/kofe zaxirasi · Kassa ochilishi",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.142Z"
  },
  {
    "id": "1f9216a5-db38-4bd9-8a45-7f6b0728cf9a",
    "role": "nazoratchi",
    "order": 4,
    "score": 9,
    "section": "ERTALAB NAZORATI (08:00 — 09:00)",
    "category": "Kamera orqali monitoring",
    "description": "Filial kamera tasviri ko'rib chiqildi · G'ayriodatiy holat yo'q",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.143Z"
  },
  {
    "id": "ab694ea1-c9d7-43a4-a7bb-170df4733e27",
    "role": "nazoratchi",
    "order": 5,
    "score": 8,
    "section": "KUNDUZGI NAZORAT (09:00 — 16:00)",
    "category": "Dars jadvali",
    "description": "Dars jadvali vs. xonadagi mentor borligini solishtir · Kechikish qayd etildi",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.143Z"
  },
  {
    "id": "6ad1e3fd-a573-4539-8667-6649cc2d781f",
    "role": "nazoratchi",
    "order": 6,
    "score": 9,
    "section": "KUNDUZGI NAZORAT (09:00 — 16:00)",
    "category": "Rahbar xodimlar cheklistini online nazorat",
    "description": "Telegram guruhida suratlar bor · Cheklist pozitsiyalariga mos · Chora ko'rish",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.144Z"
  },
  {
    "id": "642b7d48-486a-4c4b-a893-d4775cca8a0d",
    "role": "nazoratchi",
    "order": 7,
    "score": 8,
    "section": "KUNDUZGI NAZORAT (09:00 — 16:00)",
    "category": "Trello topshiriqlari nazorati",
    "description": "Yangi topshiriqlar bor · Muddati o'tganlar yo'q · Xodimga ogohlantirish yuborildi",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.144Z"
  },
  {
    "id": "460c3b8c-665f-48ef-b80f-c7aaa8bad32e",
    "role": "nazoratchi",
    "order": 8,
    "score": 8,
    "section": "KUNDUZGI NAZORAT (09:00 — 16:00)",
    "category": "Shovqin va ish muhiti",
    "description": "Bekorchi suhbatlar yo'q · Ish samaradorligiga xalakit beruvchi omil aniqlanmadi",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.145Z"
  },
  {
    "id": "ea0b5a2e-2ddb-4f14-9ef3-b0603c56fd99",
    "role": "nazoratchi",
    "order": 9,
    "score": 9,
    "section": "KUNDUZGI NAZORAT (09:00 — 16:00)",
    "category": "Mijoz xizmat sifatini kuzatish (Mystery shopper)",
    "description": "Servis standarti · Kutish vaqti · Admin reaktsiyasi baholandi",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.145Z"
  },
  {
    "id": "23bc390c-43cc-4dbc-88af-ab641199da4f",
    "role": "nazoratchi",
    "order": 10,
    "score": 9,
    "section": "KECHQURUN YAKUNLASH (16:00 — 17:30)",
    "category": "Qoidabuzarlik dalolatnomasi (Akt) tayyorlash",
    "description": "Faktlar yozilgan · Sana/vaqt · Xodim imzosi (yoki rad etganligi qayd)",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.146Z"
  },
  {
    "id": "46b0084e-8700-4110-91d5-614200a0cc10",
    "role": "nazoratchi",
    "order": 11,
    "score": 9,
    "section": "KECHQURUN YAKUNLASH (16:00 — 17:30)",
    "category": "Kunlik nazorat hisobotini filial rahbarga yuborish",
    "description": "Qoidabuzarliklar · Topilgan xatolar · Tavsiyalar · Telegram yoki email",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.146Z"
  },
  {
    "id": "0ccdacdf-4c48-47ed-90e2-d9e722b614bb",
    "role": "nazoratchi",
    "order": 12,
    "score": 8,
    "section": "KECHQURUN YAKUNLASH (16:00 — 17:30)",
    "category": "Ertangi reja",
    "description": "Bugungi tekshiruvlar natijasiga asoslanib tuzilgan",
    "isActive": true,
    "createdAt": "2026-05-21T13:54:03.147Z"
  }
];

async function main() {
  console.log('Starting seed...');
  let added = 0;
  for (const item of checklists) {
    const exists = await prisma.checklistItem.findFirst({
      where: {
        role: item.role,
        order: item.order,
        category: item.category,
        description: item.description
      }
    });

    if (!exists) {
      await prisma.checklistItem.create({
        data: {
          role: item.role,
          order: item.order,
          score: item.score,
          section: item.section,
          category: item.category,
          description: item.description,
          isActive: item.isActive
        }
      });
      added++;
    }
  }
  console.log(`Seed finished. Added ${added} new items.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
