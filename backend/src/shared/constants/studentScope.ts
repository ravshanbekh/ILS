import { Prisma } from '@prisma/client';

/**
 * STATISTIKAGA KIRADIGAN O'QUVCHI — yagona ta'rif.
 *
 * Qoida (Ravshan, 2026-09-28): "guruhdan chiqarilgan, ya'ni guruhsiz
 * o'quvchilar tizimning hech qaysi statistikasida ko'rinmasin. Bizga faqat
 * aktiv va guruhdagi o'quvchilar statistikasi kerak."
 *
 * Ta'rif:
 *   - role = student
 *   - isActive = true
 *   - kamida bitta FAOL guruhda a'zo (group.isActive = true)
 *
 * Nega "faol guruh": guruh bitirilganda (graduatedAt) isActive=false bo'ladi.
 * Faqat bitirgan guruhda qolgan o'quvchi ham amalda "guruhsiz" — u hozir
 * hech qayerda o'qimayapti.
 *
 * NEGA BITTA JOYDA: ilgari har bir statistika o'z filtrini qo'lda yozgan
 * edi (`{ role: 'student', isActive: true }`) va guruh sharti faqat
 * foydalanuvchi guruh/o'qituvchi tanlaganda qo'shilardi. Filtr tanlanmasa,
 * guruhsizlar jimgina hisobga kirib ketardi. Qo'lda takrorlangan qoidalar
 * vaqt o'tib bir-biridan ajraladi — bu loyihada zaxira tizimidagi xato ham
 * aynan shundan chiqqan edi.
 *
 * QACHON ISHLATILMAYDI (ataylab):
 *   - "Guruhsiz o'quvchilar" ro'yxati (users.getUngrouped) — uning vazifasi
 *     aynan guruhsizlarni topib, guruhga qo'shish.
 *   - O'quvchini guruhga qo'shish tekshiruvi (groups.service).
 *   - Bitta o'quvchining o'z kabineti/profili.
 *   - Xodim mehnati statistikasi (kim nechta tekshirdi, assistent necha soat
 *     ishladi) — bu tarixiy fakt, o'quvchi keyin ketgani uni o'zgartirmaydi.
 */

/**
 * Prisma `UserWhereInput` — statistikaga kiradigan o'quvchilar.
 *
 * @param groupScope Qo'shimcha guruh sharti. Masalan `{ id: groupId }` yoki
 *   `{ teacherId }`. U "faol guruh" sharti bilan BITTA `some` ichida
 *   birlashadi, ya'ni ma'nosi: "shu shartga mos FAOL guruhda a'zo".
 *   Ilgari bu ikki shart alohida yozilib, biri ikkinchisini ustidan
 *   yozib yuborardi.
 */
export function enrolledStudentWhere(groupScope?: Prisma.GroupWhereInput): Prisma.UserWhereInput {
  return {
    role: 'student',
    isActive: true,
    groupStudents: {
      some: { group: { isActive: true, ...(groupScope ?? {}) } },
    },
  };
}

/**
 * Filtr obyektidan guruh shartini yasaydi — ko'p joyda bir xil naqsh:
 * groupId tanlangan bo'lsa shu guruh, aks holda o'qituvchi.
 */
export function groupScopeFrom(filters?: {
  groupId?: string;
  teacherId?: string;
}): Prisma.GroupWhereInput | undefined {
  if (filters?.groupId) return { id: filters.groupId };
  if (filters?.teacherId) return { teacherId: filters.teacherId };
  return undefined;
}

/**
 * Raw SQL uchun xuddi shu ta'rif.
 *
 * @param studentIdColumn o'quvchi id si turgan ustun, masalan `users.id`
 *   yoki `submissions.student_id`. Foydalanuvchi kiritmasi EMAS — kod ichida
 *   qotirilgan ustun nomi, shuning uchun Prisma.raw xavfsiz.
 */
export function enrolledStudentSql(studentIdColumn: string): Prisma.Sql {
  return Prisma.sql`EXISTS (
    SELECT 1
    FROM users es_u
    JOIN group_students es_gs ON es_gs.student_id = es_u.id
    JOIN groups es_g ON es_g.id = es_gs.group_id
    WHERE es_u.id = ${Prisma.raw(studentIdColumn)}
      AND es_u.role = 'student'
      AND es_u.is_active = true
      AND es_g.is_active = true
  )`;
}
