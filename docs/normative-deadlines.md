# Normativ deadline'lari

Har bir guruh o'quvchisi **haftasiga 2 ta normativ** topshiradi. Muddat — haftaning
**oxirgi dars kuni, dars soatigacha**. Ulgurmasa **+2 kun** qo'shimcha imkon beriladi,
undan keyin ham topshirmasa — **qizil**.

Tizim yoqilmaguncha hech kim (o'qituvchi ham, o'quvchi ham) hech narsa ko'rmaydi.
Normativlar yangilanib, e'lon qilingandan keyin admin **"Hammaga start"** beradi.

## Guruh jadvali

Guruh formasi (Jamoa → Guruhlar → tahrirlash) va guruh sahifasining tepasida:

| Maydon | Ma'nosi |
|---|---|
| Boshlanish sanasi | kurs boshlangan kun (demo day/imtihon jadvali ham shundan) |
| Dars kunlari | **Toq** = Du · Chor · Ju, **Juft** = Se · Pay · Sha, **Har kuni** |
| Dars boshlanishi / tugashi | masalan 14:00–16:00 (30 daqiqa qadam) |

Haftaning muddati shu ma'lumotdan **har safar qayta hisoblanadi**. Dars soati
o'zgarsa, hamma haftalarning muddati ham o'zgaradi.
- Juft guruh, 14:00 → shanba 14:00, qo'shimcha muddat dushanba 14:00 gacha.
- Dars soati kiritilmagan → oxirgi dars kuni 23:59.
- Dars kunlari ham kiritilmagan → yakshanba 23:59 (panelda ogohlantirish chiqadi).

## Holatlar

| Belgi | Holat | Hisob |
|---|---|---|
| ✔ yashil | o'z vaqtida topshirdi | topshirildi |
| ✔ och yashil | qo'shimcha muddatda topshirdi | topshirildi |
| ✔ qizil chiziqli | qo'shimcha muddatdan keyin topshirdi | topshirildi, lekin kech |
| · kulrang | muddat hali kelmagan | topshirilmagan (kutilmoqda) |
| ⏳ sariq | muddat o'tdi, qo'shimcha muddat ketyapti | topshirilmagan |
| ✘ **qizil** | qo'shimcha muddat ham o'tdi | **qizil** |
| – | guruhga muddatdan keyin qo'shilgan | hisobga olinmaydi |

"Topshirdi" = video yuborilgan (natija qizil/ko'k bo'lsa ham). Vaqt sifatida
**birinchi topshirish** olinadi (`Submission.firstSubmittedAt`), shuning uchun
qayta topshirish muddatni buzmaydi.

## Reja

- Reja guruhga biriktirilgan **faol** normativlardan quriladi: `taskNumber` tartibida,
  har haftaga 2 tadan. Start haftasidan boshlanadi; guruh keyinroq boshlansa —
  uning boshlanish haftasidan.
- Guruhga keyin normativ qo'shilsa, u rejaning oxiriga qo'shiladi. Eng erta —
  **keyingi hafta**, shunda hafta o'rtasida kutilmagan muddat chiqmaydi.
- Guruhdan olingan normativ rejadan ham olinadi.
- **Diqqat:** o'quvchini boshqa guruhga o'tkazish uning topshirgan normativlarini
  yangi guruhga ham biriktiradi (mavjud tartib). Ular rejaning oxiriga tushishi
  mumkin. Kerak bo'lmasa — "Rejadan chiqarish".

### Rejani boshqarish (guruh sahifasi, faqat boshqaruvchi)

- Normativlarni belgilab, **boshqa haftaga ko'chirish** (dushanba sanasi tanlanadi).
- **Rejadan chiqarish / qaytarish.** Chiqarilgan normativ hisobga olinmaydi.
- **Shu haftadan qayta qurish.** Chiqarilmagan hamma normativlar tanlangan haftadan
  boshlab haftasiga 2 tadan qayta joylanadi.

Kurs o'rtasidagi guruh uchun: o'tib bo'lingan normativlarni chiqaring, keyin
keyingi haftadan qayta quring.

## Start, pauza, tozalash

Normativlar → **Deadline'lar** sahifasi:

1. **Rejani ko'rib chiqish** — har guruh bo'yicha: nechta normativ, necha hafta,
   1-haftaning normativlari, birinchi muddat va ogohlantirishlar (jadval yoki
   normativ yo'q, ustoz yo'q). Bazaga hech narsa yozilmaydi.
2. **Hammaga start** — reja quriladi, tizim yoqiladi. Boshlanish — dushanba,
   o'tgan hafta mumkin emas.
3. **To'xtatish** — hech kim ko'rmaydi, reja saqlanadi. "Davom ettirish" bilan qayta yoqiladi.
4. **Rejani tozalash** — faqat to'xtatilgan holatda. Hamma rejalar o'chadi
   (topshiriqlar va ballar **tegilmaydi**), keyin yangi sanadan start berish mumkin.
5. **Sozlama** — qo'shimcha muddat kunlari (0–7). Darhol barcha haftalarga qo'llanadi.

Holat bazada saqlanadi (`app_settings`, kalit `normative_deadlines`), `settings.json` faylida emas.

## Kim nimani ko'radi

| Kim | Ko'radi | Boshqaradi |
|---|---|---|
| admin | hamma guruh | ha |
| `normative_deadlines_manage` ruxsati | hamma guruh | ha |
| `normative_deadlines_all` ruxsati | hamma guruh | yo'q |
| o'qituvchi | faqat o'z guruhlari (boshqa guruh → 404) | yo'q |
| o'quvchi | bosh sahifada "Normativ muddatlari" kartasi: qizillar, qo'shimcha muddatdagilar, shu va keyingi hafta | — |

### Ruxsatni berish

Jamoa → **Ruxsatlar** → xodimni tanlang → "Hisobot" bo'limi:
- **"Normativ deadline'lari — barcha guruhlar"** — faqat ko'rish. Birinchi deployda
  administrator, filial rahbari, nazoratchi va HR rahbariga avtomatik beriladi
  (normativ natijalari paneli bilan bir xil).
- **"Normativ deadline'larini boshqarish"** — start, to'xtatish, rejani tahrirlash.
  **Hech kimga avtomatik berilmaydi**, admin qo'lda beradi.

Har bir start, pauza, tozalash va reja tahriri audit jurnaliga yoziladi
(`NORMATIVE_DEADLINES_*`). Ota-onalarga hech qanday xabar yuborilmaydi.

## API — `/api/normative-deadlines`

| Metod | Yo'l | Kim |
|---|---|---|
| GET | `/me` | o'quvchi (faqat o'zi) |
| GET | `/overview?week=YYYY-MM-DD` | xodim (ko'lam bo'yicha) |
| GET | `/groups/:groupId` | xodim (o'qituvchi — o'z guruhi) |
| POST | `/preview {startDate, perWeek}` | boshqaruv |
| POST | `/start {startDate, perWeek?, graceDays?}` | boshqaruv |
| POST | `/pause` | boshqaruv |
| DELETE | `/plan` | boshqaruv (to'xtatilganda) |
| PATCH | `/config {perWeek?, graceDays?}` | boshqaruv |
| PATCH | `/groups/:groupId/items {ids, weekStart?, excluded?}` | boshqaruv |
| POST | `/groups/:groupId/rebuild {fromWeek}` | boshqaruv |

Model: `NormativeDeadline` (guruh × normativ, `weekStart` dushanba, `seq`, `excluded`).
Guruhda: `lessonStartMinute`, `lessonEndMinute`. Sxema faqat `prisma db push` bilan.

## Shu ish bilan tuzatilgan eski xatolar

- **Guruhni tahrirlash jadvalni o'chirardi.** Guruhlar ro'yxati API'si boshlanish
  sanasi, kurs muddati va dars kunlarini qaytarmasdi. Tahrir formasi bo'sh ochilib,
  "Saqlash" ularni `null` qilib yuborardi, demo day va imtihon jadvali ham
  "sozlanmagan" bo'lib qolardi. Endi ro'yxat bu maydonlarni qaytaradi.
- **Demo day va imtihon nomzod sanalari.** Ular juft/toq ni oyning sanasi bo'yicha
  hisoblardi (12-noyabr = "juft"). Dars sessiyalari esa hafta kuni bo'yicha
  ishlaydi (Se/Pay/Sha). Endi ikkalasi bitta qoidada: hafta kuni. Allaqachon
  qurilgan bosqichlar o'zgarmaydi, faqat yangilari shu qoida bilan quriladi.

## Testlar

```bash
cd backend && npm run e2e:normative-deadlines   # 87 tekshiruv
```

Qamrov:
- qoidalar: muddat, qo'shimcha muddat, holatlar, hafta kuni;
- kirish va ko'lam: 401/403/404 (IDOR), stack yo'q;
- preview hech narsa yozmasligi; start validatsiyasi;
- vaqt bo'yicha holatlar: open → grace → missed, grace_done, late_done, na;
- sinxronlash; ko'chirish, chiqarish, qayta qurish; pauza, davom, tozalash;
- `firstSubmittedAt`; guruhlar ro'yxati jadvalni qaytarishi.

Test lokal sozlamani oxirida asl holiga qaytaradi.
