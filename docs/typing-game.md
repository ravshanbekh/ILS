# O'yinlar → Tez yozish

[CodeType](https://github.com/itxona40-rgb/codetyping) asosida yaratilgan, Monkeytype uslubidagi matn va kod yozish o'yini. Asl loyiha bitta sahifali bo'lib, natijalarni faqat `localStorage`'da saqlardi. ILS'da u server tomoni, bellashuvlar, reyting va admin ko'rinishi bilan kengaytirildi.

## O'quvchi (`/student/game` → `/student/game/typing`)

| Tab | Imkoniyatlar |
| --- | --- |
| Mashq | Matn (15/30/60/120 s; English / O'zbek / Dasturlash; belgilar, raqamlar) yoki kod (15 til). Combo, xato xaritasi, tezlik grafigi, rekord, 5 xil ovoz, ekran klaviaturasi |
| Bellashuv | **Duel** (2), **4 kishilik**, **Jamoaviy** (A va B, 8 × 8 — 16 kishigacha), **Sinf musobaqasi** (mentor bergan kod bilan). Xona kod bilan yoki ochiq ro'yxatdan, *Tezkor o'yin*, yopiq xona. Jonli trek va natija podiumi (ELO o'zgarishi bilan) |
| Reyting | Matn tezligi · Kod yozish · Jang reytingi (ELO). Hafta, oy yoki hammasi |
| Natijalarim | Rekordlar (15/30/60/120 s, kod), o'rtacha ko'rsatkichlar, jang reytingi, oxirgi 30 natija |

## Sinf musobaqasi — mentor (`/teacher/typing-contest`, `/admin/typing-contest`)

Ta'lim → **Tez yozish musobaqasi** (adminda: Gamifikatsiya). Faqat o'qituvchi yoki admin ochadi, o'zi o'ynamaydi.

1. **Ochish:** nomi (ixtiyoriy), matn (O'zbek / English / Dasturlash) yoki kod (15 til), hajmi:

   | Hajm | Matn | Kod |
   | --- | --- | --- |
   | Qisqa | ~25 so'z | ~140 belgi |
   | O'rta | ~40 so'z | ~300 belgi |
   | Uzun | ~80 so'z | ~600 belgi |

   Vaqt chegarasi avtomatik hisoblanadi (60–480 s).
2. **Kod:** ekranda katta 5 belgili kod chiqadi, uni proyektorga yoki chatga qo'yasiz. O'quvchi O'yinlar → Tez yozish → Bellashuv → «Sinf musobaqasi» ga kirib, kodni kiritadi. Bir musobaqada 200 tagacha o'quvchi qatnashadi. Mentor lobby'da o'quvchini chiqara oladi.
3. **Boshlash:** 3 soniyalik sanoqdan keyin hamma bir xil matnni yozadi. Mentor jonli o'rinlarni, qolgan vaqtni va nechta o'quvchi tugatganini ko'radi. **Yakunlash** bosilsa, kim qayergacha yozgan bo'lsa, shu natija hisoblanadi.
4. **Natija:** shohsupa (1–3) va to'liq jadval chiqadi, mentor **Excel**ni yuklab oladi. Excel 2 varaqdan iborat: «Natijalar» (kartochkalar, medal ranglari, WPM data bar) va «Matn». O'quvchi o'z o'rnini «N kishidan» ko'rinishida ko'radi.
5. **Tarix:** o'qituvchi faqat o'zi o'tkazgan musobaqalarni ko'radi, admin esa hammasini. Har birida natija oynasi va Excel bor.

O'rinlar oddiy bellashuvdagidek belgilanadi: avval tugatganlar vaqt bo'yicha, keyin yozgan uzunligi bo'yicha, chiqib ketganlar esa oxirida.

**Reyting:** sinf musobaqasi jang reytingiga (ELO) ta'sir qilmaydi, natijalar tezlik reytingi va tarixga yoziladi.

**Mentor sahifadan chiqsa yoki ulanish uzilsa** musobaqa to'xtamaydi, qaytganda server holatni o'zi qayta yuboradi.

**Bitta mentorda bir vaqtda bitta musobaqa bo'ladi.** Yangisi ochilsa, lobby'dagi eskisi yopiladi. Musobaqa davom etayotgan bo'lsa, avval uni yakunlash kerak.

**Muddatlar:**
- Lobby 90 daqiqa harakatsiz qolsa yopiladi.
- Yakunlangan musobaqa xotirada 30 daqiqa saqlanadi, bazada esa doimiy qoladi.

API: `GET /api/typing/class/matches`, `/class/matches/:id`, `/class/matches/:id/excel` (o'qituvchi yoki admin).

Socket hodisalari (mentor): `room:create {mode:'class', title, contentType, variant, size}`, `room:start`, `room:kick`, `room:finish`, `room:close`.

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
| Sinf musobaqasi | Hisoblanmaydi |

Chiqib ketgan o'yinchi oxirgi o'rin hisoblanadi.

## Texnik

| Qism | Fayl |
| --- | --- |
| Kontent (so'zlar, 15 tilda snippetlar) | `backend/src/modules/typing/typing.content.ts` |
| Mashq, reyting, admin so'rovlari | `typing.service.ts`, `typing.routes.ts` (`/api/typing`) |
| Bellashuv xonalari (Socket.IO `/typing`: o'quvchi o'ynaydi, o'qituvchi/admin faqat sinf musobaqasini boshqaradi) | `typing.rooms.ts` |
| Sinf musobaqasi Excel'i (exceljs) | `typing.excel.ts` |
| ELO | `typing.elo.ts` |
| Jadvallar | `typing_results`, `typing_matches`, `typing_match_players`, `typing_ratings` |
| Frontend | `frontend/src/components/typing/*` (mentor: `ClassHost.tsx`, umumiy taxta: `ClassBoard.tsx`, socket/tiplar: `typingRoom.ts`), `pages/student/game/*`, `pages/shared/TypingContestPage.tsx`, `pages/admin/TypingGamesPage.tsx` |

Xona holati server xotirasida turadi va bitta backend konteyneri uchun mo'ljallangan. Server qayta ishga tushsa, davom etayotgan bellashuv yo'qoladi, saqlangan natijalar esa joyida qoladi.

## Sinov

```bash
cd backend && npm run e2e:typing
```

Sinov lokal bazada va haqiqiy socketlar bilan o'tadi (92 tekshiruv):

- mashq va shubhali natijalar;
- kirish qoidalari;
- duel, 4 kishilik va jamoaviy o'yin parallel;
- firibgar o'yinchi;
- ELO, reytinglar va admin marshrutlari;
- jamoaviy 8 × 8 sig'imi;
- sinf musobaqasi: kim ocha oladi, 20 o'quvchi, chiqarish, kech kelgan, erta yakunlash, reytingsiz natija, tarix va Excel, boshqa mentor ko'ra olmasligi, mentor qayta ulanishi, lobby'ni yopish.

Dev rejimida `vite.config.ts` `/socket.io` ni backend'ga proxy qiladi.
