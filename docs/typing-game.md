# O'yinlar → Tez yozish

[CodeType](https://github.com/itxona40-rgb/codetyping) asosida yaratilgan, Monkeytype uslubidagi matn va kod yozish o'yini. Asl loyiha bitta sahifali bo'lib, natijalarni faqat `localStorage`'da saqlardi. ILS'da u server tomoni, bellashuvlar, reyting va admin ko'rinishi bilan kengaytirildi.

## O'quvchi (`/student/game` → `/student/game/typing`)

| Tab | Imkoniyatlar |
| --- | --- |
| Mashq | Matn (15/30/60/120 s; English / O'zbek / Dasturlash; belgilar, raqamlar) yoki kod (15 til). Combo, xato xaritasi, tezlik grafigi, rekord, 5 xil ovoz, ekran klaviaturasi |
| Bellashuv | **Duel** (2), **4 kishilik**, **Jamoaviy** (A va B, 8 kishigacha). Xona kod bilan yoki ochiq ro'yxatdan, *Tezkor o'yin*, yopiq xona. Jonli trek va natija podiumi (ELO o'zgarishi bilan) |
| Reyting | Matn tezligi · Kod yozish · Jang reytingi (ELO). Hafta, oy yoki hammasi |
| Natijalarim | Rekordlar (15/30/60/120 s, kod), o'rtacha ko'rsatkichlar, jang reytingi, oxirgi 30 natija |

## Admin (`/admin/games`, Gamifikatsiya → Tez yozish o'yini)

- **Ko'rsatkichlar:** testlar soni (24 soat / 7 kun), faol o'quvchilar, bellashuvlar, o'rtacha WPM va aniqlik, shubhali natijalar, bugungi eng tez o'quvchi.
- **Tablar:**
  - Reyting — guruh filtri bilan.
  - O'yinlar — har bellashuvning tarkibi, o'rinlar va reyting o'zgarishi.
  - Natijalar — o'quvchi, rejim, tur, sana va "shubhali" filtrlari.
  - Jonli xonalar.
- Natijalar jadvalida o'quvchi nomi bosilsa, uning to'liq statistikasi ochiladi.

## Halollik — natijani server hisoblaydi

- **Matnni server beradi:** mashq uchun `POST /api/typing/solo/start`, bellashuvda xona.
- **WPM server tomonida hisoblanadi.** Formula: `to'g'ri belgi / 5 / daqiqa`. Mashqda vaqt server oynasidan, bellashuvda server soatidan olinadi.
- **Bellashuvda yozish qat'iy rejimda bo'ladi:** xato harf kursorni siljitmaydi. O'yinchi faqat `pos` ni yuboradi va server uni tekshiradi:
  - `pos` faqat oldinga o'sadi va matn uzunligidan oshmaydi;
  - u ≈ 25 belgi/soniyadan tez o'sa olmaydi.

  Tugatish faqat `pos = matn uzunligi` bo'lganda qabul qilinadi.
- **Shubhali natijalar:** odamdan tez (> 220 wpm) yoki imkonsiz sanoqli natija `flagged` deb belgilanadi. U saqlanadi va admin ko'radi, lekin reytingga kirmaydi. Bellashuvda shubhali o'yinchi bo'lsa, ELO hech kimga hisoblanmaydi.
- **Matn reytingi** shartlari: aniqlik ≥ 85%, faqat faol o'quvchilar.

## ELO

Boshlang'ich reyting — 1000.

| Rejim | Hisob |
| --- | --- |
| Duel | K = 32 |
| 4 kishilik | Har juftlik alohida hisoblanadi, K = 32/(n−1) |
| Jamoaviy | Har o'yinchi o'z reytingi bilan raqib jamoaning o'rtacha reytingiga qarshi, K = 24. G'olib jamoa — o'rtacha WPM'i yuqori jamoa |

Chiqib ketgan o'yinchi oxirgi o'rin hisoblanadi.

## Texnik

| Qism | Fayl |
| --- | --- |
| Kontent (so'zlar, 15 tilda snippetlar) | `backend/src/modules/typing/typing.content.ts` |
| Mashq, reyting, admin so'rovlari | `typing.service.ts`, `typing.routes.ts` (`/api/typing`) |
| Bellashuv xonalari (Socket.IO `/typing`, faqat o'quvchi tokeni) | `typing.rooms.ts` |
| ELO | `typing.elo.ts` |
| Jadvallar | `typing_results`, `typing_matches`, `typing_match_players`, `typing_ratings` |
| Frontend | `frontend/src/components/typing/*`, `pages/student/game/*`, `pages/admin/TypingGamesPage.tsx` |

Xona holati server xotirasida turadi va bitta backend konteyneri uchun mo'ljallangan. Server qayta ishga tushsa, davom etayotgan bellashuv yo'qoladi, saqlangan natijalar esa joyida qoladi.

## Sinov

```bash
cd backend && npm run e2e:typing
```

Sinov lokal bazada va haqiqiy socketlar bilan o'tadi (51 tekshiruv):

- mashq va shubhali natijalar;
- kirish qoidalari;
- duel, 4 kishilik va jamoaviy o'yin parallel;
- firibgar o'yinchi;
- ELO, reytinglar va admin marshrutlari.

Dev rejimida `vite.config.ts` `/socket.io` ni backend'ga proxy qiladi.
