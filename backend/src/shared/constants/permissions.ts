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
