# Tadbir (chempionat) coini — dars sessiyasisiz

Demo-mentor (kurator) haftada bir marta butun yangi oqim (5–20 bola) bilan **"Chempionat
kuni"** o'tkazadi: Live Quiz va tez yozishdagi "Sinf musobaqasi". Har haftada uchta nominatsiya
bor: **G'olib**, **Shaxsiy rekord**, **Jamoa ruhi**.

Oddiy coin faqat guruh darsi sessiyasi ichida beriladi (`adjustLessonCoin`). Chempionat esa
dars sessiyasidan tashqarida va bolalar mentorning guruhida emas. Shu sababli alohida yo'l bor.

## Ruxsatni qanday berish kerak

Kalit: **`event_coins`** — "Tadbir uchun coin berish (chempionat)", Gamifikatsiya toifasida.

Bu kalit **hech kimga avtomatik berilmaydi** (`legacyRoles: []`). Admin qo'lda beradi:

1. Admin panel → **Jamoa → Ruxsatlar** (`/admin/permissions`).
2. Demo-mentorni (rol: Kurator) qidirib toping.
3. "Gamifikatsiya" bo'limida **"Tadbir uchun coin berish (chempionat)"** belgisini yoqing.
4. Mentor sahifani yangilaydi va menyuda **"Tadbir coini"** paydo bo'ladi (`/viewer/kurator/event-coins`).

Admin ruxsatsiz ham har doim bera oladi: Gamifikatsiya → **Tadbir coini** (`/admin/event-coins`).

## Kim kimga bera oladi (doira)

| Kim | Kimga |
|---|---|
| admin | istalgan **faol** o'quvchi |
| `event_coins` + `coin_oversight` | istalgan faol o'quvchi (qidiruv orqali) |
| `event_coins` (masalan kurator) | faqat **o'ziga biriktirilgan, holati "faol"** kurator o'quvchilari |

ILS'da o'quvchi va guruhlarda filial maydoni yo'q (filial faqat xodim kartasida). Shuning uchun
doira filial bo'yicha emas, **kurator biriktirmasi** (`CuratorStudent`) bo'yicha belgilangan.
Bu Promptokrat bilan kelishilgan (2026-11-24).

Ro'yxatda bitta bo'lsa ham doiradan tashqari o'quvchi bo'lsa (boshqa kuratorniki, to'xtatilgan,
nofaol, o'quvchi emas yoki mavjud emas), **hech kimga berilmaydi** va 403 qaytadi. Javobda
begona o'quvchining nomi aytilmaydi.

## Cheklovlar

- Miqdor: bitta o'quvchiga 1–100 (butun son).
- Bir martada 50 tagacha o'quvchi; takror ID bitta hisoblanadi.
- Sabab yoki tadbir nomi majburiy (3–200 belgi). Ledgerda `Tadbir: <sabab>` ko'rinishida saqlanadi.

## Kunlik chegara

Yozuvda `teacherId` = bergan xodim. Shuning uchun tadbir coini mavjud kunlik yig'indiga
(`checkTeacherLimit`: bugungi barcha musbat yozuvlar) avtomatik kiradi.

Chegaradan oshsa, coin baribir beriladi (dars coini bilan bir xil xatti-harakat). Lekin
admin va kassirga ilova ichida va Telegram bot orqali xabar boradi (kuniga bir marta).

Mentor sahifasida "bugun: X → Y / chegara" ko'rinadi va oshish oldindan ogohlantiriladi.

## Ledger va nazorat

- `CoinTransaction`: `lessonSessionId = null`, `shopOrderId = null`, `reason = "Tadbir: …"`.
  Bitta topshiriqdagi barcha yozuvlar bir xil `createdAt` oladi.
- **Coin nazorati → Tadbir coinlari** (`coin_oversight`): har bir tadbir bitta qatorda ko'rinadi:
  vaqt, kim bergan (rol bilan), sabab, `miqdor × bolalar`, jami. Qator ochilsa bolalar ro'yxati chiqadi.
- **Coin nazorati → O'qituvchilar** endi davr ichida coin bergan boshqa xodimlarni ham ko'rsatadi
  (masalan kurator). Ilgari faqat `teacher` roli chiqar edi.
- Har bir topshiriq audit jurnaliga `EVENT_COIN_AWARD` bo'lib yoziladi.
- O'quvchining coin tarixida sabab ko'rinadi.

## API — `/api/coins`

| Metod | Yo'l | Himoya |
|---|---|---|
| GET | `/event-award/context` | xodim roli → `event_coins` |
| GET | `/event-award/students?q=` | xodim roli → `event_coins` |
| POST | `/event-award` `{ studentIds[], amount, reason }` | xodim roli → `event_coins` |
| GET | `/event-awards?period=today\|week\|month\|all` | `coin_oversight` |

Himoya tartibi: `authenticate` → `roleGuard(<student'dan boshqa barcha rollar>)` →
`permissionGuard('event_coins')`. Admin har doim o'tadi. Doira servisda tekshiriladi.

## Xavfsizlik tekshiruvi

- **IDOR:** o'quvchi ID'lari faqat serverdagi doira so'rovi orqali o'tadi.
- **user.id / userId:** hamma joyda `req.user.userId`.
- **Coin ACL:** berish `event_coins`, ko'rish `coin_oversight`. O'quvchi `roleGuard`'dan o'tmaydi.
- **BigInt:** javoblarda faqat aniq tanlangan maydonlar bor (`telegramId`/`chatId` yo'q).
- **Stack trace:** xatolar umumiy `errorHandler` orqali chiqadi, stack faqat `DEBUG_ERRORS=true` bo'lsa ko'rinadi.

## Testlar

```bash
cd backend && npm run e2e:event-coins   # 42 tekshiruv
```

Testlar quyidagini isbotlaydi:
- ruxsatli foydalanuvchi coin bera oladi;
- coin kunlik yig'indiga qo'shiladi, Coin nazoratida ko'rinadi va chegara oshganda adminga bildirishnoma ketadi;
- ruxsatsiz foydalanuvchi 403 oladi;
- doiradan tashqaridagi o'quvchiga coin berib bo'lmaydi;
- xato javoblarida stack trace va BigInt maydonlari yo'q.

Telegram bot sinovda ishga tushmaydi, real xabar ketmaydi.
