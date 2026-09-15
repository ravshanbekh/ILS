/**
 * 3D asset versiyasi — kesh buzuvchi.
 *
 * NEGA KERAK
 * Assetlar `public/` da turadi, ya'ni fayl nomi Vite tomonidan hashlanmaydi
 * (`student.webp` har doim `student.webp`). Sayt Cloudflare orqali
 * xizmat qiladi va u rasmni chekkada keshlab qo'yadi. Natijada faylni
 * yangilasak ham foydalanuvchi ESKISINI ko'rib turaveradi.
 *
 * Buni amalda ko'rdik: yengilroq rasmlar deploy bo'ldi, lekin
 * production 47988 bayt (eski) qaytarardi; `?v=<vaqt>` qo'shilganda
 * darhol 24256 bayt (yangi) keldi.
 *
 * Yana bir tuzoq: mavjud bo'lmagan rasm so'ralganda nginx SPA fallback
 * sifatida index.html qaytarardi (200, text/html). Cloudflare o'sha
 * "muvaffaqiyatli" javobni ham keshlab qo'yishi mumkin edi — keyin
 * haqiqiy fayl qo'yilsa ham eski HTML kelaverardi. nginx.conf da
 * /illustrations/ va /brand/ uchun `try_files $uri =404` qo'shildi.
 *
 * QOIDA: assetlar yangilanganda shu raqamni oshiring.
 */
export const ASSET_VERSION = 3;

/** Asset yo'liga versiya qo'shadi: /illustrations/x.webp -> ...?v=2 */
export function versioned(path: string): string {
  return `${path}?v=${ASSET_VERSION}`;
}
