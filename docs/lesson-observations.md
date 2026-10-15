# Dars kuzatuvi baholashi

Manba: **Darsni kuzatish varag'i — A4.pdf**. Forma 5 bo'limdagi 19 mezondan iborat. Har mezon 1–5 ball; maksimal ball **95**. `backend/src/modules/lesson-observations/lesson-observations.criteria.ts` mezonlarning yagona manbasi bo'lib, admin formasi ham shu API javobidan quriladi.

## Ishlash tartibi

1. Admin **Monitoring → Dars baholash** sahifasida ustoz va guruhni tanlaydi, mavzu va qatnashganlar sonini kiritadi, 19 mezonni baholaydi hamda izohlarni yozadi.
2. **Bahoni saqlash** serverda jami ballni hisoblaydi. Kuzatuv vaqti brauzerdan olinmaydi; `created_at` ma'lumotlar bazasida avtomatik belgilanadi.
3. Admin **Baholar tarixi** sahifasida ustoz va Toshkent vaqti bo'yicha sana oralig'ini filtrlab, har bir kuzatuvning 19 ta bahosi va izohlarini ko'radi.
4. **Dars reytingi** tanlangan davrdagi kuzatuvlarning o'rtacha balli bo'yicha tartiblanadi. Kuzatuvlar soni va so'nggi kuzatuv vaqti ham ko'rsatiladi. Bu reyting mavjud KPI asosidagi **O'qituvchi reytingi**dan alohida.
5. Mentor **Mening profilim** sahifasida faqat o'z kuzatuvlarini va tarixini ko'radi.

## Saqlash va ruxsat

- `lesson_observations` jadvali barcha yozuvlarni saqlaydi. Baholarni o'chirish yoki tahrirlash endpointi yo'q. Ustoz, kuzatuvchi va guruh nomlari snapshot sifatida saqlanadi; ularning hisoblari keyin o'zgarsa ham tarix o'qiladi.
- `POST /api/lesson-observations`, `GET /form`, `GET /`, `GET /ranking` faqat `admin` uchun.
- `GET /api/lesson-observations/me` faqat `teacher` va `robototexnika_ustoz` uchun; server `teacherId`ni tokendan oladi va mijoz yuborgan IDni hisobga olmaydi.
- Server ustozning faol ekanini, tanlangan guruh unga tegishli ekanini, qatnashganlar sonini hamda barcha 19 ballning 1–5 oralig'ida ekanini tekshiradi. Jami ball mijozdan qabul qilinmaydi.
- Tarix 20 tadan sahifalanadi; sana filtrlari `Asia/Tashkent` kun chegaralari bilan ishlaydi.

## Tekshirish

```sh
cd backend
npm run build
npx tsx --test tests/lesson-observations.*.test.ts
cd ../frontend
npm run build
```

Sxema `backend/prisma/schema.prisma` va `backend/prisma/migrations/20261015000000_add_lesson_observations/migration.sql`da. Hozirgi deploy oqimi backend qayta qurilgach `prisma db push` ishlatadi; deploy logida sxema muvaffaqiyatli qo'llanganini tekshiring.
