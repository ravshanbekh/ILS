# Normativ natijalari paneli (umumiy matritsa)

Barcha mentorlar, guruhlar va o'quvchilarning normativ natijalari **bitta jadvalda**.
Qatorlar — normativlar, ustunlar — mentor → guruh → o'quvchi. Jadval ikki tomonga
aylanadi (pastga va yonga), sarlavhalar va chap ustunlar qotirilgan.

## Qayerda

| Rol | Yo'l | Menyu |
|---|---|---|
| Admin / ruxsatli xodim | `/admin/normative-matrix` | Normativlar → **Normativ natijalari** |
| O'qituvchi (mentor) | `/teacher/normative-matrix` | Normativlar → **Normativ natijalari** |
| Kuzatuvchi rollar | `/viewer/:role/normative-matrix` | Sidebar (ruxsat bo'lsa) |

## Kim nimani ko'radi

- **admin** va `normative_matrix_all` ruxsati bor xodim — barcha guruhlar
  (standart: administrator, filial_rahbari, nazoratchi, hr_rahbari).
- **teacher** ruxsatsiz — faqat o'z guruhlari (`group.teacherId = o'zi`).
  Boshqa mentor/guruh filtri yuborilsa ham natija o'z guruhlari bilan cheklanadi.
- O'quvchi, assistent va boshqalar — `403`.

Ruxsatni Sozlamalar → Ruxsatlar bo'limida istalgan foydalanuvchiga berish mumkin.

## Jadval tuzilishi

- **1-qator:** mentor ismi (o'z ustunlari ustidan cho'zilgan; aylantirganda ko'rinib turadi).
- **2-qator:** qizil guruh ustuni (bosilsa guruh sahifasi) + o'quvchi ismlari vertikal
  (bosilsa o'quvchi profili).
- **Chap ustunlar:** N, Normativ (havola bilan), Vaqti, Foiz.
  Mobil ekranda Vaqti/Foiz yashiriladi — ular normativ nomi tooltip'ida.
- **Pastki qator:** har bir o'quvchining bajarish foizi.

| Katak | Ma'nosi | Bazadagi qiymat |
|---|---|---|
| ✔ yashil | qo'lladi | `result = green` |
| ✔ ko'k | biladi | `result = blue` |
| ✘ qizil | bilmaydi | `result = red` |
| ⏳ | tekshirilmoqda | `status = pending` |
| bo'sh | topshirmagan | submission yo'q |
| chiziqli | guruhga biriktirilmagan normativ | — |

**Foiz** = (qo'lladi + biladi) / biriktirilgan normativlar soni.

## Filtrlar

Mentor (faqat to'liq ko'rinishda), guruh, holat (Faol / Tamomlagan / Hammasi),
yo'nalish (kategoriya), o'quvchi qidiruvi (faqat ekranda, serverga yuborilmaydi).
O'chirilgan (savatdagi) guruhlar hech qachon ko'rsatilmaydi.

## API

Hammasi `authenticate + staffOnly`, ko'rinish doirasi serverda hisoblanadi.

| Metod | Yo'l | Tavsif |
|---|---|---|
| GET | `/api/normative-matrix/options` | filtr ro'yxatlari (mentorlar, guruhlar, kategoriyalar) |
| GET | `/api/normative-matrix?teacherId=&groupId=&status=&categoryId=` | matritsa |
| GET | `/api/normative-matrix/excel?…` | xuddi shu filtrlar bilan `.xlsx` |

`teacherId=none` — ustozsiz guruhlar. `status`: `active` (standart) | `graduated` | `all`.

Javob shakli (`data`):

```json
{
  "generatedAt": "…",
  "scope": "all | own",
  "normatives": [{ "id", "taskNumber", "title", "description", "timeLimit", "url", "maxScore", "category" }],
  "teachers": [{ "id", "fullName", "groups": [{ "id", "name", "graduated", "normativeIds": [], "students": [{ "id", "fullName", "login" }] }] }],
  "cells": { "<studentId>": { "<normativeId>": ["g|b|r|p", score] } }
}
```

Kataklar ixcham kodlangan (90 o'quvchi × 11 normativ ≈ 1 000 katak bir necha KB).

**Muhim:** natijalar `submission.groupId` bo'yicha EMAS, o'quvchining hozirgi guruhi
bo'yicha joylanadi — o'quvchi boshqa guruhga o'tkazilganda eski `groupId` eskirib qoladi.

## Excel

"Normativ natijalari" varag'i: 5 ustun va 2 qator qotirilgan, mentor ismi birlashtirilgan
katakda, o'quvchi ismlari 90° burilgan, normativ nomi havola, oxirgi qatorda o'quvchi
foizi. "Izoh" varag'ida belgilar tushuntirilgan.

## Testlar

```bash
cd backend && npm run e2e:normative-matrix   # 29 tekshiruv: ruxsat, doira, filtrlar, kataklar, Excel
```
