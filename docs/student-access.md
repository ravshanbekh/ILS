# O'quvchi kirishini yopish va ochish

To'lovni o'z vaqtida qilmagan o'quvchining tizimga kirishini mentor **bitta tugma** bilan yopadi. To'lov qilinsa yoki sababli bo'lsa, xuddi shu tugma bilan qayta ochadi. To'lov boshqa platformada tekshiriladi, shuning uchun ILS uni bilishi shart emas: bu yerda faqat "kira oladi / kira olmaydi" holati saqlanadi.

## Mentor uchun

1. Guruh sahifasini oching, **O'quvchilar ro'yxati**ni toping.
2. Kerakli qatorga sichqonchani olib boring. **Amallar** yonida 🔓 qulf tugmasi chiqadi.
3. Tugmani bosing va sababni tanlang: **To'lov** yoki **Boshqa sabab**. Izoh ixtiyoriy, masalan "noyabr oyi".
4. **Kirishni yopish** ni bosing.
   - O'quvchining ismi yonida kichik 🔒 qulf paydo bo'ladi.
   - Qulf tugmasi to'q sariq rangda doim ko'rinib turadi.
5. Kirishni qayta ochish uchun 🔒 tugmasini bosing. Oynada kim, qachon va qaysi sabab bilan yopgani yoziladi. **Kirishni ochish** ni bosing.

Belgilar ataylab kichik va jim qilingan: ekran proyektorga chiqarilgan bo'lsa ham sinfdoshlar e'tibor bermaydi. Sabab va izoh faqat oynacha ichida ko'rinadi.

## Yopilganda nima bo'ladi

| | |
| --- | --- |
| Kirish | Parol to'g'ri bo'lsa ham kira olmaydi |
| Ochiq sessiyalar | Darhol tugaydi: telefon, kompyuter, "Tez yozish" o'yini |
| O'quvchiga ko'rinadigan xabar | "Hisobingizga kirish vaqtincha cheklangan. Mentoringiz yoki o'quv markaz administratori bilan bog'laning." **To'lov haqida hech narsa yozilmaydi.** |
| Parol noto'g'ri bo'lsa | Oddiy "Login yoki parol noto'g'ri". Bunda begona odam yopiq holatni bila olmaydi |
| Guruh, reyting, baholar, davomat | **O'zgarmaydi.** O'quvchi hamma joyda o'z o'rnida qoladi, boshqalarga hech narsa sezilmaydi |
| Ota-onaga | Hech qanday xabar ketmaydi |

Bu **muzlatish** ham, **nofaol qilish** ham emas:
- Nofaol (`isActive`) o'quvchi guruhdan va reytingdan butunlay yo'qoladi.
- Muzlatish hisobot va ustoz reytingiga ta'sir qiladi.

## Kim qila oladi

Bu ruxsat: **"O'quvchi kirishini yopish/ochish"** (`student_access_block`). Ruxsatlar sahifasida "Guruh" bo'limida turadi.

- **O'qituvchilar** — standart ravishda bor, lekin **faqat o'z guruhidagi** o'quvchiga qo'llay oladi.
- **Admin** — istalgan o'quvchiga.
- **Boshqa xodimlar** (administrator, kassir va hokazo) — admin qo'lda bersa, istalgan o'quvchiga.
- Muayyan o'qituvchidan bu imkoniyatni olib qo'yish ham shu ruxsatlar sahifasida qilinadi.

Har yopish va ochish auditga yoziladi: `STUDENT_ACCESS_BLOCKED` va `STUDENT_ACCESS_UNBLOCKED`, kim qilgani, sabab va izoh bilan.

Claude, MCP yoki tashqi agent orqali ham qilsa bo'ladi: `ils_set_student_access` amali.

## Texnik

| Qism | Joy |
| --- | --- |
| Maydonlar | `users.access_blocked_at`, `access_blocked_by_id`, `access_block_reason` (`payment` / `other`), `access_block_note` |
| API (faqat xodim + ruxsat) | `GET /api/student-access/blocked`, `GET /api/student-access/group/:groupId`, `POST /api/student-access/:studentId/block`, `POST /api/student-access/:studentId/unblock` |
| Kirishni to'sish | `auth.service` (login va refresh), `auth.middleware` (har so'rov), `typing.rooms` (socket). Yopishda `tokenVersion` oshadi |
| UI | `frontend/src/components/shared/StudentAccessToggle.tsx`, guruh sahifasi |
| Sinov | `cd backend && npm run e2e:student-access` — 28 tekshiruv |

Holat ataylab `GET /groups/:id` javobiga qo'shilmagan: bu yo'lni o'quvchilar ham chaqiradi, shuning uchun u yerda bo'lsa, sinfdoshlar kim yopilganini ko'rib qolardi. Guruh sahifasi holatni alohida, faqat xodimlarga ochiq so'rov bilan oladi.
