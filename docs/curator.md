# Kurator (demo-mentor) moduli

Kurator — yangi kelgan bola bilan **20 daqiqalik demo dars** o'tadigan xodim. Demodan
keyin u bolani ILS'ga qo'shadi (guruhsiz), administrator bolani asosiy guruhga
qo'shadi, kurator esa **2 oy** davomida o'z dasturi (24 mashg'ulot) bo'yicha u bilan
shug'ullanadi va asosiy darslari qanday ketayotganini kuzatadi. Asosiy guruhda
asosiy o'qituvchi avvalgidek dars beradi.

## Rol va kirish

| Kim | Nima qila oladi |
|---|---|
| `kurator` roli | faqat **o'z** o'quvchilari: ro'yxat, karta, dasturni belgilash, o'z jadvali |
| admin, `curator_oversight` ruxsati | barcha kuratorlar: ro'yxat, jadval (kuratorni tanlab), mavjud o'quvchini biriktirish, kuratorni almashtirish |
| `curator_program` ruxsati (va admin) | 2 oylik dasturni tahrirlash/qo'shish |
| o'quvchi | o'z kuratori, 2 oylik holati, kuratorning bo'sh vaqtiga onlayn yozilish |
| o'qituvchi | o'z guruhidagi bolaning profilida "Kurator" kartasi |

`curator_oversight` yangi kalit sifatida birinchi deployda administrator, filial
rahbari va nazoratchilarga avtomatik beriladi (`seededPermissionKeys`).
`curator_program` hech kimga avtomatik berilmaydi — admin Sozlamalar → Ruxsatlar
sahifasida qo'lda beradi.

Kurator akkaunti: Jamoa → Foydalanuvchilar → yangi foydalanuvchi, rol **Kurator (demo-mentor)**.

## Oqim

1. **Demo** (20 daq) → kurator: O'quvchilarim → **Demo'dan keyin qo'shish**. Ism, login
   (avtomatik taklif), parol (avtomatik, 8 belgi), demo sanasi, izoh. Parol faqat shu
   oynada bir marta ko'rsatiladi. 2 oylik muddat demo kunidan hisoblanadi.
2. **Asosiy guruh** → administrator mavjud guruh oynalari orqali qo'shadi
   (kartada "Asosiy guruhga hali qo'shilmagan" qizil yozuvi, "Faqat guruhsizlar" filtri).
3. **2 oy** → kurator jadvalida vaqt ochadi, o'quvchi yoziladi, kurator "keldi/kelmadi"
   belgilaydi. Vaqtga dastur mashg'uloti biriktirilgan bo'lsa, "keldi" uni o'quvchi
   xaritasiga o'zi yozadi. Jadvalsiz o'tilgan mashg'ulotni kartada qo'lda belgilash mumkin
   (o'tildi/kelmadi, mini-vazifa: bajardi/qisman/bajarmadi, izoh).
4. Muddat tugagach yozuv avtomatik **"2 oy tugadi"** holatiga o'tadi (demo sanasi
   tuzatilsa — qayta faol). "To'xtatilgan" — qo'lda.

## Jadval qoidalari

- 30 daqiqalik oraliq (mashg'ulot 20 daqiqa), 08:00–20:00, yakshanba dam olish.
- Bitta vaqtga **8 tagacha** o'quvchi (sig'im 1–8).
- O'quvchi faqat **o'z kuratorining** vaqtiga, bir kunda bittasiga yoziladi.
- Sig'im Serializable tranzaksiyada tekshiriladi (oxirgi joyga ikki bola bir vaqtda bossa ham 9-chi yozilmaydi).
- O'quvchi yozilgan vaqt o'chirilmaydi — faqat yopiladi; o'tgan vaqtlarga tegilmaydi.
- Kurator o'z o'quvchisini vaqtga o'zi ham qo'sha oladi.

## Kurator nimani ko'radi

Har bir bola kartasida:
- 2 oylik muddat: nechanchi kun / jami, qancha qoldi;
- dastur: o'tilgan / 24, kelmaganlar, **rejaga nisbatan** ("4 ta orqada" — 2 oyga teng
  taqsimlangan reja bo'yicha), keyingi mashg'ulot va hafta;
- asosiy guruh: guruh, ustoz, davomat %, uy vazifa o'rtachasi, normativ bajarilishi;
- to'liq kartada: 8 haftalik xarita, so'nggi 15 dars (davomat, uy vazifa, faollik),
  normativlar (✔ yashil / ✔ ko'k / ✘ / ⏳, belgi bosilsa isbot videosi), yozilishlar tarixi.

Asosiy guruh ko'rsatkichlari faqat bola guruhga **qo'shilgan kundan keyingi** darslardan hisoblanadi.

## Dastur

Boshlang'ich 24 mashg'ulot (8 hafta × 3, A — asosiy, ★ — qo'shimcha) "Demo-mentor
qo'llanmasi — 2 oylik to'garak" dan olingan: `backend/src/modules/curator/curator-program.seed.json`.
Server ishga tushganda jadval **bo'sh bo'lsa** bir marta to'ldiriladi — keyingi
tahrirlar qayta yozilmaydi.

## Sahifalar

| Rol | Yo'l |
|---|---|
| kurator | `/viewer/kurator` (bosh sahifa = o'quvchilarim), `/viewer/kurator/curators/:id`, `/viewer/kurator/curator-schedule`, `/viewer/kurator/curator-program`, `/viewer/kurator/profile` |
| admin | Jamoa → Kuratorlar `/admin/curators`, Kurator jadvali, Kurator dasturi |
| ruxsatli xodim | `/viewer/:role/curators` va h.k. (menyuda "Kuratorlar") |
| o'quvchi | menyuda **Kuratorim** `/student/curator` (faqat kuratori bo'lsa), bosh sahifada kurator kartasi |

## API — `/api/curator`

| Metod | Yo'l | Kim |
|---|---|---|
| GET | `/me`, `/available?from=` | o'quvchi |
| POST | `/bookings {slotId}` | o'quvchi |
| DELETE | `/bookings/:id` | o'quvchi (boshlanmasdan oldin) / kurator / nazorat |
| GET | `/summary/:studentId` | xodim (admin, nazorat, o'sha kurator, o'sha ustoz, `view_student_profile`) |
| GET | `/curators`, `/program`, `/students`, `/students/:id`, `/students/suggest-login` | kurator / nazorat |
| POST | `/students`, `/students/:id/progress`; PATCH `/students/:id`; DELETE `/progress/:id` | kurator (o'ziniki) / nazorat |
| POST | `/students/assign`; GET `/students/unassigned?q=` | nazorat |
| GET/PUT | `/slots/day`, GET `/slots/week`; PATCH/DELETE `/slots/:id`; POST `/slots/:id/bookings` | kurator / nazorat (`curatorId` bilan) |
| PATCH | `/bookings/:id/attendance {status}` | kurator / nazorat |
| POST/PATCH | `/program`, `/program/:id` | `curator_program` |

## Ma'lumotlar modeli

`CuratorStudent` (studentId unique — bitta bolaning bitta kuratori), `CuratorLesson`
(dastur), `CuratorProgress` (bola × mashg'ulot, unique), `CuratorSlot` (`startMinute`
— kun boshidan daqiqa), `CuratorBooking` (`SupportBookingStatus` enumi). Rol `kurator`
`UserRole` ga qo'shilgan. Sxema `prisma db push` bilan.

## Testlar

```bash
cd backend && npm run e2e:curator   # 86 tekshiruv
```

Qamrov: kirish/ko'lam (IDOR), yaratish va tranzaksiya, dastur tahriri, asosiy guruh
ko'rsatkichlari, jadval qoidalari (qadam, ish vaqti, sig'im, yakshanba), yozilish
(sig'im, kuniga bitta, boshqa kurator), davomat → dastur, qo'lda belgilash, profil
kartasi, biriktirish, muddat tugashi.
