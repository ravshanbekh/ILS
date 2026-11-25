# Dars baholashini qayta ochish

Admin → Monitoring → **Dars nazorati** (`/admin/lesson-control`).

## Qachon kerak
- O'qituvchi **"Yakunlash"ni adashib**, baholashni oxiriga yetkazmay bosgan bo'lsa.
  Yakunlashda baholanmagan o'quvchilarga avtomatik **0** qo'yiladi va 1 soatdan keyin
  ota-onalarga xabar ketadi.
- Dars vaqti (2 soat) tugab **avtomatik yopilgan** bo'lsa.
- Bugun dars ochilmagan bo'lsa ("Ruxsat berish").

## Sahifada
"So'nggi 7 kunda yopilgan darslar — qayta ochish" bo'limida uchta filtr va guruh yoki
o'qituvchi bo'yicha qidiruv bor:
- **Adashib yakunlangan bo'lishi mumkin** — o'qituvchi yakunlagan, lekin kimdir baholanmay avtomatik 0 olgan;
- **Barcha yakunlanganlar**;
- **Avto-yopilgan**.

Har bir qatorda ko'rinadi:
- nechta o'quvchi baholanmay 0 olgani;
- nechtasiga faollik qo'yilmagani;
- ota-onaga xabar ketgan yoki qachon ketishi.

Ilgari kun yaxshi o'tgan bo'lsa ("bugun barcha guruhlar baholandi"), bu ro'yxat umuman
chiqmasdi. Endi u doim ko'rinadi.

## Qayta ochganda nima bo'ladi
- Sabab majburiy (audit jurnalida `LESSON_SESSION_REOPEN`).
- Dars 2 soatga ochiladi.
- Avtomatik qo'yilgan 0 lar olib tashlanadi. O'qituvchi qo'ygan baholar va coinlar saqlanadi.
- Ota-onaga xabar **hali ketmagan** bo'lsa, u bekor qilinadi. Dars qayta yakunlangach
  to'g'ri baholar bilan ketadi.
- Xabar **allaqachon ketgan** bo'lsa, qayta yuborilmaydi (ota-onaga ikkinchi xabar bormaydi).
- **O'tgan kun** darsi qayta ochilsa, o'qituvchi uni odatdagi baholash panelida ko'radi.
  Panelda "dd.mm.yyyy kungi dars — administrator qayta ochgan" yozuvi chiqadi. Ilgari panel
  faqat bugungi darsni qidirardi va qayta ochilgan kechagi dars o'qituvchiga ko'rinmasdi.

Qayta ochish faqat admin uchun. Ochiq turgan darsni qayta ochib bo'lmaydi.

## API
- `GET /api/lesson-sessions/admin/closed?days=7` — `status`, `autoZeroCount`,
  `activityMissing`, `parentNotifyAt`, `parentNotifiedAt`.
- `POST /api/lesson-sessions/admin/unlock {groupId, note, date?}` — javobda
  `reopen: {from, clearedAutoZero, parentsAlreadyNotified}`.
- `GET /api/lesson-sessions/today?groupId=` — qayta ochilgan o'tgan kun darsi bo'lsa,
  `pastDate` bilan o'shani qaytaradi.

## Test
```bash
cd backend && npm run e2e:lesson-reopen   # 24 tekshiruv
```
