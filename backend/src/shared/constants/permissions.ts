/**
 * Qo'lda beriladigan ruxsatlar katalogi.
 *
 * Tizimda asosiy tekshiruv baribir ROL bo'yicha (roleGuard) — bu ruxsatlar
 * shu rolning ustiga qo'yiladigan qo'shimcha qatlam: admin har bir odamga
 * alohida berib/olib qo'ya oladi (Telegramdagi admin huquqlari kabi).
 *
 * Muhim: 'admin' roli har doim hamma narsaga ruxsatli — u uchun bu jadval
 * umuman tekshirilmaydi (o'zini tasodifan qulflab qo'ymasligi uchun).
 *
 * Yangi ruxsat qo'shish: shu ro'yxatga bitta qator qo'shiladi va kerakli
 * route'ga permissionGuard('<kalit>') ulanadi — boshqa hech narsa kerak emas.
 */

export interface PermissionMeta {
  /** Foydalanuvchiga ko'rinadigan nom */
  label: string;
  /** Qisqacha izoh — ruxsat aynan nimaga imkon berishini tushuntiradi */
  description: string;
  /** Admin panelda guruhlab ko'rsatish uchun */
  category: string;
  /**
   * Shu ruxsat hozirda (ruxsatlar tizimi kiritilgunga qadar) qaysi rollarda
   * avtomatik ochiq bo'lgan. initPermissions birinchi ishga tushganda aynan
   * shu rollardagi mavjud odamlarga ruxsat berib chiqadi — hech kimning ishi
   * buzilmasligi uchun. Bo'sh massiv = hech kimda yo'q edi (yangi imkoniyat).
   */
  legacyRoles: string[];
}

export const PERMISSIONS = {
  transfer_student: {
    label: "O'quvchini boshqa guruhga o'tkazish",
    description: "Guruhdagi o'quvchini boshqa guruhga ko'chirish (ball va natijalari saqlanadi)",
    category: 'Guruh',
    legacyRoles: ['teacher', 'administrator', 'sotuv_operatori'],
  },
  remove_student: {
    label: "O'quvchini guruhdan chiqarish",
    description: "O'quvchini guruh tarkibidan olib tashlash",
    category: 'Guruh',
    legacyRoles: ['teacher'],
  },
  create_group: {
    label: 'Yangi guruh yaratish',
    description: "Yangi o'quv guruhini ochish",
    category: 'Guruh',
    legacyRoles: ['teacher'],
  },
  edit_group: {
    label: 'Guruhni tahrirlash',
    description: "Guruh nomi, o'qituvchisi va sozlamalarini o'zgartirish",
    category: 'Guruh',
    legacyRoles: ['teacher'],
  },
  create_student: {
    label: "Yangi o'quvchi qo'shish",
    description: "Tizimga yangi o'quvchi hisobini yaratish",
    category: 'Foydalanuvchi',
    legacyRoles: ['teacher'],
  },
  bulk_import_students: {
    label: "Exceldan ommaviy yuklash",
    description: "Bir vaqtda ko'p o'quvchini Excel orqali qo'shish",
    category: 'Foydalanuvchi',
    legacyRoles: ['teacher'],
  },
  export_data: {
    label: "Ma'lumotlarni eksport qilish",
    description: "Guruh va o'quvchi natijalarini Excel faylga yuklab olish",
    category: 'Hisobot',
    legacyRoles: ['teacher'],
  },
  freeze_student: {
    label: "O'quvchini muzlatish",
    description: "O'quvchini muzlatish va muzlatishdan chiqarish. O'qituvchilarda avval yo'q edi — qo'lda berilsa ochiladi",
    category: 'Monitoring',
    // Hozir bu amal shu rollarda ochiq edi — ular huquqini yo'qotmasligi uchun
    // saqlanadi. 'teacher' ro'yxatda yo'q: unga faqat qo'lda beriladi.
    legacyRoles: ['administrator', 'sotuv_operatori', 'kassir'],
  },

  // ── Gamifikatsiya (coin va do'kon) ──
  shop_orders: {
    label: "Do'kon buyurtmalarini ko'rish va berish",
    description: "O'quvchilar so'ragan sovg'alar ro'yxati; sovg'ani berildi deb belgilash yoki bekor qilish",
    category: 'Gamifikatsiya',
    legacyRoles: ['kassir', 'moliya_rahbari'],
  },
  shop_manage: {
    label: "Do'konga mahsulot qo'shish",
    description: "Sovg'a/tovar qo'shish, narxini va rasmini o'zgartirish, yashirish",
    category: 'Gamifikatsiya',
    legacyRoles: ['kassir', 'moliya_rahbari'],
  },
  coin_oversight: {
    label: 'Coin nazorati',
    description: "Qaysi o'qituvchi qancha coin berayotgani va qaysi o'quvchi qancha coin to'plagani",
    category: 'Gamifikatsiya',
    legacyRoles: ['kassir', 'moliya_rahbari'],
  },
  homework_manage: {
    label: "Uyga vazifa bankasini boshqarish",
    description:
      "Darsliklarga uyga vazifa yozish, tahrirlash va yashirish. O'qituvchi bankdan tanlab guruhiga beradi",
    category: "Ta'lim",
    legacyRoles: [], // faqat admin, kerak bo'lsa qo'lda beriladi
  },
  support_oversight: {
    label: 'Assistent qabul soatlari nazorati',
    description:
      "Qaysi assistent qaysi soatlarni ochgani, kim yozilgani va kim kelgani \u2014 kunlik nazorat",
    category: 'Nazorat',
    legacyRoles: ['filial_rahbari', 'nazoratchi', 'administrator', 'hr_rahbari'],
  },
  coin_settings: {
    label: "Coin kunlik chegarasini o'zgartirish",
    description: "Bitta o'qituvchi bir kunda necha coin bera olishini belgilash",
    category: 'Gamifikatsiya',
    legacyRoles: [], // faqat admin, kerak bo'lsa qo'lda beriladi
  },

  // ── Guruh: begona guruhga aralashish ──
  transfer_cross_teacher: {
    label: "Boshqa o'qituvchi guruhiga o'tkazish",
    description:
      "O'quvchini BOSHQA o'qituvchining guruhidan olish yoki unga berish. Bunsiz o'tkazish faqat o'z guruhlari orasida ishlaydi",
    category: 'Guruh',
    // Ilgari transferStudent da egalik tekshiruvi UMUMAN yo'q edi — ya'ni
    // transfer_student ruxsati bor har kim istalgan guruhga aralasha olardi.
    // Endi bu alohida ruxsat; legacyRoles bo'sh, ya'ni faqat qo'lda beriladi.
    legacyRoles: [],
  },
  delete_group: {
    label: "Guruhni o'chirish",
    description: "Guruhni savatga yuborish. O'quvchilar guruhsiz qoladi",
    category: 'Guruh',
    legacyRoles: [], // ilgari faqat admin
  },

  // ── Ko'rish huquqlari ──
  view_student_profile: {
    label: "O'quvchi profili va statistikasini ko'rish",
    description:
      "Istalgan o'quvchining to'liq natijalari, tahlili va tarixini ochish. Bunsiz faqat o'z guruhlaridagi o'quvchilar ko'rinadi",
    category: 'Hisobot',
    // Bu yo'l ilgari HIMOYASIZ edi: tizimga kirgan har kim, jumladan
    // o'quvchining o'zi, boshqa o'quvchi statistikasini o'qiy olardi.
    // Hozir kirish huquqi bor rollar ro'yxati — hech kimning ishi buzilmasin.
    legacyRoles: ['administrator', 'filial_rahbari', 'nazoratchi', 'hr_rahbari', 'sotuv_operatori'],
  },
  view_rankings: {
    label: "Barcha guruhlar reytingini ko'rish",
    description: "O'z guruhlaridan tashqari guruhlarning reytingini ham ko'rish",
    category: 'Hisobot',
    legacyRoles: [
      'administrator',
      'filial_rahbari',
      'nazoratchi',
      'hr_rahbari',
      'sotuv_operatori',
      'kassir',
      'moliya_rahbari',
    ],
  },

  // ── Dars va baholash ──
  grade_after_deadline: {
    label: "Muddat o'tgach baholash",
    description:
      "Dars yakunlangandan yoki 2 soatlik muddat tugagandan keyin ham bahoni qo'yish va tuzatish. Adashib bosilgan bahoni admindan so'ramasdan tuzatish uchun",
    category: "Ta'lim",
    legacyRoles: [], // ilgari faqat admin unlock qila olardi
  },

  // ── Nazorat ──
  milestone_oversight: {
    label: 'Demo day va imtihon nazorati',
    description:
      "Qaysi guruh demo day va imtihonni o'tkazdi, kim kechikdi — nazorat paneli va oylik statistika",
    category: 'Nazorat',
    legacyRoles: ['administrator', 'filial_rahbari', 'nazoratchi'],
  },

  // ── Xavfli amallar ──
  restore_trash: {
    label: 'Savatni boshqarish',
    description:
      "O'chirilgan guruh va foydalanuvchilarni tiklash yoki butunlay o'chirish. Butunlay o'chirish QAYTARIB BO'LMAYDI",
    category: 'Xavfli',
    legacyRoles: ['administrator', 'filial_rahbari'],
  },
  force_logout: {
    label: 'Barcha qurilmalardan chiqarish',
    description:
      "Foydalanuvchining barcha ochiq sessiyalarini bekor qilish. Paroli o'g'irlangan deb gumon qilinganda ishlatiladi",
    category: 'Xavfli',
    legacyRoles: [], // ilgari faqat admin
  },
} as const satisfies Record<string, PermissionMeta>;

export type PermissionKey = keyof typeof PERMISSIONS;

export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as PermissionKey[];

export function isValidPermission(key: string): key is PermissionKey {
  return PERMISSION_KEYS.includes(key as PermissionKey);
}

/** Admin panelga yuboriladigan ko'rinish (kalit + meta) */
export function getPermissionCatalog() {
  return PERMISSION_KEYS.map((key) => ({ key, ...PERMISSIONS[key] }));
}
