# IT Live Score — frontend dizayn qo‘llanmasi
Versiya: 1.0 · 12-sentabr 2026 · Yo‘nalish: tanlangan 3-variant, Light + Dark

## 1. Qanday ishlatish kerak
Frontendchi avval ushbu hujjatni va `references/light.png`, `references/dark.png` fayllarini ko‘rsin. `tokens.css` rang, o‘lcham va theme tokenlarining koddagi manbasi. `theme.js` brauzer uchun light/dark/system yordamchisi. `CLAUDE-CODE-PROMPT.md` tayyor topshiriq. Hammasini birga loyiha ichiga, masalan `design/it-live-score/` papkasiga joylashtiring.

Ushbu paket dizaynning implementatsiya shartnomasidir; ishlayotgan sayt yoki undan chiqarilgan original CSS emas. Avvalgi rasmlar AI orqali generatsiya qilingan. Ularning dastlabki DOM, CSS, Figma komponentlari va alohida 3D fayllari mavjud emas. Quyidagi raqamlar aniq manba va implementatsiya uchun standartlashtirilgan qarorlarga ajratilgan.

**Manbalar ustuvorligi:**
1. Foydalanuvchi tanlagan ushbu ikki screenshot — kompozitsiya va ko‘rinish.
2. `references/IT-identity.pdf` — original logo, Roboto va brend palitrasi.
3. `tokens.css` — ishlab chiqishda bir xil ishlatiladigan qiymatlar.
4. Hujjatdagi responsive va qo‘shimcha komponent qoidalari — rasmda ko‘rsatilmagan holatlar uchun taklif qilingan kengaytma.

Screenshotlarda ko‘rsatilmagan interaksiyalar, mobil layout, jadval va formalar original maketdan olingan fakt emas; ushbu shablonga mos implementatsiya qarorlaridir.

## 2. Vizual yo‘nalish va qat’iy chegaralar
Uslub: yumshoq 3D ta’lim illustratsiyalari bilan toza admin interfeys. Katta raqam, qisqa sarlavha, bitta semantik ikonka va ixcham grafik asosiy iyerarxiyani yaratadi. Sirtlar silliq, burchaklar yumaloq, soyalar tarqoq.

Light va dark bitta komponent daraxtidan foydalanadi. Theme almashganda ustunlar, kartalar tartibi, matn, qiymat, ikonka, rasm, bo‘shliq va o‘lcham bir xil qoladi. Rang, border va soya tokenlari o‘zgaradi. Faqat tasdiqlangan logo versiyasi light/dark uchun almashtiriladi.

Tanlangan dashboard tuzilishi:
- Chapda doimiy sidebar; yuqorida logo va uning tagida Score.
- O‘ng yuqorida qidiruv, bildirishnoma, foydalanuvchi menyusi.
- Kontentning birinchi qatorida chapda sahifa nomi, o‘ngda kitob va o‘simlikli banner.
- Birinchi KPI qatorda 4 karta; ikkinchi qatorda 3 karta.
- Kartalarda 3D rasmlar o‘ng tomonda; ma’lumotlar chapda, mini-grafik pastda.
- Sidebar tagida xira brand pattern va “Bilim odamlarni yaqinlashtiradi” matni.

Yangi ko‘k hero-panel, neon glow, kosmik fon, glassmorphism blur, perspektivada egilgan kartalar, juda katta dekor, emoji ikonka va yangi logo kiritilmaydi. Navigatsiya shu screenshotlardagi kabi sodda outline ikonkalardan foydalanadi; 3D uslub KPI va banner illustratsiyalariga tegishli.

## 3. Brendning tekshirilgan qiymatlari
PDFning 2-betida Roboto, 3-betida quyidagi besh asosiy rang ko‘rsatilgan.

| Primitive | HEX | Vazifasi |
|---|---|---|
| Brand red | #FF2B00 | Logo, asosiy brand urg‘usi, dekor |
| Gold | #FFB800 | Grafik, mukofot, trend urg‘usi |
| Tech navy | #0F1B2D | Dark identy, matn va sirtlar oilasi |
| Coral | #FF8050 | Iliq yordamchi urg‘u, illustratsiya |
| Cream | #F5F1EE | Neytral iliq brend foni |
| White | #FFFFFF | PDFdagi neytral palitra, light asos |

PDFning pastki qismidagi qizil tuslar ustunida turli swatchlarga bir xil #FF2B00 yozilgan. Shuning uchun u yerdagi barcha shade kodlari aynan to‘g‘ri deb olinmadi. Ushbu paketdagi qo‘shimcha tuslar alohida UI tokenlari sifatida belgilangan.

### Logo shartnomasi
Original iTLive wordmark faylidan foydalaning. Matn bilan qayta terish, boshqa fontdan logo yig‘ish yoki yangi belgi chizish mumkin emas. PDF logosi final identy manbasi; screenshotdagi generatsiya artefaktlarini nusxalamang.

Light: original qizil iT + navy Live + qizil belgi. Dark: PDFdagi qizil iT + oq Live ko‘rinishi. Shakl va proporsiya bir xil. Score — wordmark ostida mustaqil, chapga tekislangan matn; logotipning ichki qismi emas. Score: 22px/26px, 400, asosiy matn rangi; logo bilan oralig‘i 4px. Wordmark taxminan 128px kenglikda; SVGning original aspect ratio qiymati saqlanadi. Sidebar lockup blokining chap cheti taxminan 40px, tepa cheti 28px. Minimal bo‘sh zona uchun boshlang‘ich qiymat 16px; bu PDFdan o‘lchangan rasmiy clear-space normasi emas.

## 4. Light mode — alohida rang shartnomasi
Bu qiymatlar screenshotni izchil CSSga aylantirish uchun normallashtirilgan UI ranglari. Brendning raw ranglari yuqoridagi jadvalda o‘zgarmas qoladi.

| Semantic CSS token | HEX | Qayerda |
|---|---|---|
| --background | #FFFFFF | Sahifa foni |
| --sidebar | #FFFFFF | Chap navigatsiya |
| --header | #FFFFFF | Yuqori panel |
| --surface | #FFFFFF | Jadval, modal, umumiy panel |
| --surface-soft | #FFF6F1 | KPIning iliq asosiy sirti |
| --surface-hover | #FFF0E9 | Interaktiv sirt hover |
| --surface-muted | #F4F4F5 | Qidiruv, ikkilamchi sirt |
| --foreground | #0B1020 | Sarlavha, raqam |
| --muted-foreground | #586981 | Izoh, sana, yordamchi matn |
| --border | #F0E7E2 | Dekorativ separator |
| --control-border | #7A8797 | Input chegarasi kabi zarur ajratish |
| --nav-active-bg | #FFF0EB | Tanlangan sidebar bandi |
| --nav-active-fg | #C92300 | Tanlangan kichik matn/ikonka |
| --trend-up-bg | #FFF2C7 | O‘sish badge sirti |
| --trend-up-fg | #8A4B00 | O‘sish badge matni |
| --trend-down-bg | #FFE4DF | Pasayish badge sirti |
| --trend-down-fg | #C92300 | Pasayish badge matni |
| --chart-up | #FFB800 | Mini bar/line |
| --chart-up-soft | #FFD878 | Barning och tuslari |
| --chart-down | #FF8050 | Pasayish mini-grafigi |
| --chart-down-soft | #FFC4A8 | Pasayish grafik tusi |
| --primary | #C92300 | Oq matnli asosiy tugma |
| --primary-hover | #AD1E00 | Tugma hover |
| --on-primary | #FFFFFF | Tugma matni |
| --focus-ring | #C92300 | Klaviatura fokus |
| --success-bg / --success-fg | #E9F7EF / #166534 | Muvaffaqiyat holati |
| --warning-bg / --warning-fg | #FFF2C7 / #8A4B00 | E’tibor holati |
| --danger-bg / --danger-fg | #FFE4DF / #C92300 | Xato holati |
| --info-bg / --info-fg | #E8EEF5 / #1E3A5C | Axborot holati |

KPI fon: `linear-gradient(135deg, #FFF8F4, #FFF4EE)`. Banner fon: `linear-gradient(110deg, #FFF4EF, #FFF0E9)`. Dekor pattern opacity: 0.05–0.07. Yorqin markaziy glow qo‘shilmaydi.

## 5. Dark mode — alohida rang shartnomasi
Dark ko‘rinish sof #000 emas: screenshotga yaqin juda chuqur navy-qora. Lightdagi geometriya aynan shu holda ishlatiladi.

| Semantic CSS token | HEX | Qayerda |
|---|---|---|
| --background | #091120 | Sahifa foni |
| --sidebar | #0B1828 | Chap navigatsiya |
| --header | #0D1525 | Yuqori panel |
| --surface | #101925 | Jadval, modal, panel |
| --surface-soft | #101925 | KPIning asosiy sirti |
| --surface-hover | #172536 | Interaktiv sirt hover |
| --surface-muted | #172333 | Qidiruv, ikkilamchi sirt |
| --foreground | #F5F7FA | Sarlavha, raqam |
| --muted-foreground | #AEC0D5 | Izoh va yordamchi matn |
| --border | #243647 | Dekorativ separator |
| --control-border | #64768C | Input chegarasi |
| --nav-active-bg | #3C2323 | Tanlangan sidebar bandi |
| --nav-active-fg | #FF8066 | Tanlangan kichik matn/ikonka |
| --trend-up-bg | #3D341B | O‘sish badge sirti |
| --trend-up-fg | #FFD36A | O‘sish badge matni |
| --trend-down-bg | #3E252B | Pasayish badge sirti |
| --trend-down-fg | #FF8066 | Pasayish badge matni |
| --chart-up | #FFB800 | Mini bar/line |
| --chart-up-soft | #FFD36A | Grafik och tusi |
| --chart-down | #FF6848 | Pasayish grafigi |
| --chart-down-soft | #FFAD81 | Grafik och tusi |
| --primary | #FF2B00 | Asosiy tugma |
| --primary-hover | #FF5733 | Tugma hover |
| --on-primary | #0B1020 | Tugma matni |
| --focus-ring | #FFB800 | Klaviatura fokus |
| --success-bg / --success-fg | #143326 / #8DE0B0 | Muvaffaqiyat holati |
| --warning-bg / --warning-fg | #3D341B / #FFD36A | E’tibor holati |
| --danger-bg / --danger-fg | #3E252B / #FF8066 | Xato holati |
| --info-bg / --info-fg | #182D43 / #B8D7F4 | Axborot holati |

KPI fon: `linear-gradient(135deg, #0F1825, #101925)`. Banner shu oilada. Border 1px, ko‘zga zo‘rg‘a tashlanadigan. Pattern opacity: 0.09–0.12. 3D illustratsiya ranglari light bilan bir xil; butun rasmga invert, grayscale yoki brightness filter qo‘llanmaydi.

### Kontrast uchun ongli moslashuv
#FF2B00 va oq orasidagi hisoblangan kontrast 3.75:1. Shu sabab kichik qizil matn va oq yozuvli tugmada light uchun #C92300 qo‘llanadi. Bu brend rangini almashtirish emas, semantik accessible tus. Logo va katta dekor asli #FF2B00 bo‘lib qoladi. Darkdagi qizil tugmada to‘q yozuv ishlatiladi. Screenshot bilan kichik rang farqi ataylab hujjatlashtirilgan.

Tekshirilgan token juftliklari: light secondary text/card 5.25:1; light positive badge 6.08:1; light negative badge 4.68:1; dark primary text/card 16.47:1; dark secondary/card 9.51:1; dark negative badge 5.67:1. Bu hisob tokenlar uchun; tayyor sayt accessibility auditidan o‘tdi degani emas.

## 6. O‘lcham, grid va tipografika
Ikkala reference 1672 × 941px. Quyidagi screenshot koordinatalari taxminiy raster o‘lchov; brauzer CSS piksellari uchun boshlang‘ich mo‘ljal, original Figma o‘lchovi emas.

| Element | Reference mo‘ljali | Standart |
|---|---|---|
| Sidebar | x 0–260 | 260px |
| Header | y 0–85 | 86px |
| Kontent chap cheti | x ≈286 | Sidebar + 24px |
| Kontent o‘ng oralig‘i | ≈24px | 24px |
| Intro/banner | y ≈108–295 | min-height 188px |
| Banner chap cheti | x ≈835 | Intro ustunlari 2fr / 3fr |
| Birinchi KPI qator | y ≈310–573 | min-height 264px |
| Ikkinchi KPI qator | y ≈581–866 | min-height 284px |
| Card padding | ≈26px | 24px |
| Card radius | ≈20px | 20px |
| Card gap | ≈8–16px | 12px |
| Section gap | ≈16px | 16px |
| Header search | ≈518 × 50px | max-width 520px; height 50px |
| Nav item | ≈224 × 50px | 50px height; 12px radius |
| Avatar | ≈48px | 48px |

4+3 kartaga alohida takrorlangan layout o‘rniga 12 ustunli CSS grid: birinchi 4 karta span 3, keyingi 3 karta span 4. Teng ustunlar rasm generatsiyasidagi mayda notekisliklarni standartlashtiradi. Sahifa min-height: 100dvh; pastgi kontent ko‘paysa oddiy vertikal scroll.

**Font:** Roboto, undan keyin system sans-serif. Loyiha ichidagi rasmiy WOFF2 assetni ulang; logo alohida SVG. Screenshotdagi fontni piksel bo‘yicha aniq aniqlab bo‘lmaydi, Roboto tanlovi PDFga asoslangan.

| Rol | Desktop size / line-height | Weight | Mobile |
|---|---|---|---|
| Page title | 42 / 50px | 700 | 28 / 34px |
| Banner title | 30 / 36px | 700 | 24 / 30px |
| KPI value | 52 / 58px | 700 | 40 / 46px |
| Card title | 22 / 28px | 600 | 20 / 26px |
| Page subtitle | 18 / 25px | 400 | 16 / 24px |
| Body/nav | 16 / 24px | 400–500 | 16 / 24px |
| Card helper | 14 / 20px | 400 | 14 / 20px |
| Badge | 18 / 24px | 600 | 16 / 22px |
| Table/field | 14 / 20px | 400–500 | 14 / 20px |

Katta sarlavhada letter-spacing -0.02em; qiymatlarda -0.02em va tabular-nums. Oddiy matnda normal. Font yuzasi joylashmaguncha screenshot solishtirish boshlanmaydi.

Spacing shkalasi: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px.
Radius: 8px kichik boshqaruv; 12px badge/nav/input; 16px panel; 20px KPI/banner; 24px modal; 999px search/avatar.
Light card shadow: 0 8px 24px rgba(107,70,42,0.04).
Dark card shadow: 0 8px 24px rgba(0,0,0,0.14).
Popover/modal soyasi kattaroq; oddiy kartalar hoverda sakramaydi.
Motion: 120ms kichik state, 180ms panel, 240ms drawer; ease-out. prefers-reduced-motion da animatsiya o‘chadi.
Z-index: content 0, sticky table 10, header 30, desktop sidebar 40, dropdown 50, overlay 80, modal/drawer 90, toast 100.

## 7. Asosiy komponentlar shartnomasi

### AppShell / Sidebar / Topbar
AppShell barcha autentifikatsiyalangan sahifalarning yagona qobig‘i. Sidebar kengligi va header balandligi route bo‘yicha o‘zgarmaydi. Header sticky, sidebar alohida vertikal scroll oladi. Pastdagi pattern matn ustiga chiqmaydi; dekor aria-hidden.

Sidebar tartibi: Dashboard, Jamoa, Ta’lim, Darsliklar, Imtihonlar, Live Quiz, Uyga vazifa bankasi, Normativlar, Monitoring, Cheklistlar, Gamifikatsiya, Sozlamalar. Amaldagi loyihaning route va permissionlari bu tartibga moslanadi; mavjud bo‘lmagan funksiya ishlayotgandek yaratilmaydi. Jamoa/Ta’lim ota kategoriya bo‘lsa semantik accordion va aria-expanded ishlatiladi.

Outline navigatsiya ikonka: 22–24px, bir oiladan, 1.75–2px stroke, bir xil burchak/uchlar. Active bandda fon va accent; aria-current="page". Hover xira sirt; focus-visible 2px ring, offset 3px. Icon-only tugmada accessible nom, tooltip esa qo‘shimcha.

Search placeholder: “Qidirish...”. Global qidiruv bo‘lsa mavjud qidiruv kontraktiga ulanadi; ishlamaydigan dekorativ input bo‘lmaydi. Mobileda kengayuvchi qidiruv. Notification “3” soni screenshot namunasi, productionda real unread count. Avatar va “Admin” ham real profilga ulanadi.

### PageIntro / EducationBanner
Intro: H1 “Admin Dashboard”; tagida “iTLive Score platformasi bo‘yicha umumiy statistika va faollik ko‘rsatkichlari”. Banner matni HTMLda:
“Katta natijalar” + brand urg‘u bilan “birgalikda yaratiladi”.
Yordamchi matn: “Ta’lim yangi imkoniyatlar eshigini ochadi”.
Kitob/o‘simlik rasmi alohida transparent asset. Matn rasmga bake qilinmaydi. Banner kitob va o‘simlikdan iborat bitta kompozitsiya; yirik 3D rasm bilan matn ustma-ust kelmasin. Tablet va mobileda banner intro ostiga tushadi. Rasm uchun o‘lcham rezerv qilinadi.

### StatCard
Anatomiya: title → value → comparison label → trend badge; o‘ngda 3D illustration; pastda mini-chart.
Props/kontrakt:
- id, title, value: number | null, formattedValue;
- currentPeriod, previousPeriod, previousValue;
- deltaDirection: up | down | flat | unavailable;
- impact: favorable | unfavorable | neutral | unknown;
- deltaPercent: number | null;
- illustration: asset key; series: date/value nuqtalari;
- state: loading | ready | empty | error;
- href? faqat real detail route bo‘lsa.

Illustration desktopda taxminan 132–160px; wide cardda 160–190px. object-fit: contain. Matnning o‘ng tomonida rasmga yetarli joy; uzun sarlavha 2 qatorga o‘tadi. Qiymatga joy yetmasa font nazoratli kichrayadi yoki rasm keyingi qatorga o‘tadi; raqam ustidan illustratsiya chizilmaydi. Informatsion karta button emas. Link karta ichiga nested button qo‘yilmaydi.

Reference demo:
| Title | Value | Delta | Asset |
|---|---:|---:|---|
| O‘quvchilar | 623 | +12% | student |
| O‘qituvchilar | 14 | +8% | teacher |
| Guruhlar | 49 | +20% | groups |
| Normativlar | 43 | -4% | standards |
| Jami topshiriqlar | 6404 | +16% | assignments |
| Tekshirilgan | 6314 | +14% | checked |
| Kutilmoqda | 90 | -28% | pending |

Bu demo qiymatlari; APIga yozilmaydi. Aynan reference solishtirishda ishlatiladi, real sahifada backend natijalari ko‘rsatiladi.

### TrendBadge va ma’lumot ma’nosi
Screenshotga mos yo‘nalish ko‘rinishi: o‘sish — oltin, pasayish — qizil/coral; arrow + foiz + izoh. Lekin “pasaydi” doim yomon emas: Kutilmoqda -28% navbat kamayganini bildirishi mumkin. deltaDirection va impact alohida saqlanadi. Rangni “yomon” degan yagona signal sifatida ishlatmang; tooltipda “Kutilayotgan topshiriqlar 28% kamaydi” kabi kontekst yozing.

Hisob: ((current - previous) / previous) × 100. previous=0 va current>0 bo‘lsa “Yangi”, foiz null; ikkisi 0 bo‘lsa 0% va flat. previous mavjud bo‘lmasa “Taqqoslash mavjud emas”; Infinity/NaN ko‘rsatilmaydi. Manfiy bazali metrikaga foiz formulasi faqat mahsulot qoidasi bilan qo‘llanadi. Davrlar bir xil uzunlik yoki mos elapsed davr bo‘lishi kerak; timezone va rounding bir joyda aniqlanadi.

### MiniBarChart / Progress
Grafik DOM/SVG yoki loyihadagi mavjud chart komponentida real sonlardan quriladi; screenshotdan kesib ishlatilmaydi. KPI spark-bar uchun odatda 8–10 nuqta, 48–60px balandlik, 8–12px bar, 6–8px gap, 2px radius. Aynan nuqta soni backend qatoriga bog‘liq. Bazasi 0, manfiy qiymat bo‘lsa alohida baseline; ma’lumot yo‘q bo‘lsa bo‘sh state. Har bir kartaning lokal scale qiymati boshqa kartalar bilan taqqoslanadigan o‘lchov emas; tooltipda qiymat va davr bor.

Reference mini-bars dekorativ trend sifatida ishlashi mumkin: shu holda mazmun label yoki jadvalda matn bilan takrorlanadi. Muhim grafikda rangning o‘zi yetarli emas; dark/lightda ma’lumot chizig‘i ko‘rinadigan bo‘lsin, zarur bo‘lsa outline/label qo‘shing. Oltin va oq kontrasti pastligi sabab yagona informatsiya manbasi bo‘lgan chartga aynan och oltin barlarni tekshiruvsiz ko‘chirmang.

Bajarilish foizi tanlangan reference kartalarida yo‘q; boshqa sahifalar uchun qo‘shimcha komponent. completed / total × 100; total=0 bo‘lsa “Ma’lumot yo‘q”. Track 8px, fill brand gold, label + son, aria-valuenow. 0–100 oralig‘ida render; noto‘g‘ri backend qiymati xato sifatida qayd qilinadi. Theme almashganda chart qayta tartiblanmaydi.

## 8. Qolgan sahifalarga qo‘llash
Barcha sahifalarda AppShell, PageHeader, filter toolbar, content surface va state komponentlari umumiy. Har bir sahifaga katta illustratsiya yoki dashboardning 7 kartasini takrorlash shart emas. Ishchi content zichligini o‘qishga qulay saqlang.

| Modul | Shu uslubdagi sahifa andozasi |
|---|---|
| Jamoa / O‘quvchilar / O‘qituvchilar | 2–4 ixcham KPI + qidiruv/filter + jadval + profil drawer |
| Guruhlar | Guruh kartalari yoki jadval; o‘qituvchi, o‘quvchi soni, holat; detailda tablar |
| Ta’lim / Darsliklar | Qidiruv, kategoriya, lesson/resource kartalari; detailda kontent va progress |
| Imtihonlar | Holat filterlari, jadval, sana, natija; detailda savollar va baholash |
| Live Quiz | Mavjud quiz sessiyasi UI; asosiy status/vaqt aniq; bezak minimal |
| Uyga vazifa bankasi | Kategoriya/daraja filteri, vazifa ro‘yxati, preview panel |
| Normativlar | Kategoriya, mezon, ball/holat jadvali; tahrirlash formasi |
| Monitoring | Sana oralig‘i, trendlar, alertlar, activity timeline |
| Cheklistlar | Progress summary, guruhlangan checkboxlar, deadline/mas’ul |
| Gamifikatsiya | Oltin trophy/badge assetlari, reyting jadvali, daraja progressi |
| Sozlamalar | Chap ichki tab/nav, bo‘limli formalar, Save/Cancel, theme preference |

### Table / FilterBar / Pagination
Table oq yoki dark --surface ustida; KPI shaftoli gradientini katta jadvalga yoymang. Header 44px, row min-height 56px, cell padding 12–16px, yozuv 14px. Harakatlar 44px target. Hover --surface-hover; selected --nav-active-bg. Sort button aria-sort bilan ustun sarlavhasiga moslanadi. Sonlar o‘ngga tekislanadi. Pagination real total/page bilan; loading payti sakramaydi. Mobileda kritik ustunlar saqlanadi, qolganlari detail yoki jadval ichidagi horizontal scrollda.

FilterBar: qidiruv, selectlar, sana oralig‘i, reset, asosiy action. 12px gap; mobileda wrap. Filter almashganda mavjud ma’lumot yuklanish holati va error aniq.

### Button / Input / Select / Checkbox / Tabs
Tugma: sm 36px (touch wrapper min 44), md 44px, lg 48px; radius 12px; horizontal padding 16px. Primary --primary/--on-primary; secondary --surface/--foreground + --control-border; ghost transparent + hover sirt. Danger faqat destructive action.

Input/select min-height 44px, 14–16px matn, label doim ko‘rinadi, helper/error id bilan aria-describedby. Placeholder label o‘rnini bosmaydi. Error border --danger-fg, aria-invalid. Checkbox 20px glyph va 44px bosish maydoni. Tab active accent underline + matn weight; rang yagona signal emas. Custom tabs ishlatilsa standart keyboard roving focus; oddiy route tablari link bo‘ladi.

### Modal / Drawer / Toast
Modal desktop max-width 560px yoki katta formaga 800px; width calc(100% - 32px), max-height calc(100dvh - 32px); ichki scroll. Radius 24px, padding 24px. Overlay black 55%/65%. Focus trap, Escape, close accessible nom, yopilganda fokus chaqirgan tugmaga. Drawer 420px yoki mobile to‘liq kenglik; z-index 90. Toast matn + status ikonka + dismiss; aria-live polite, muhim xatoda alert. Xabar faqat vaqtinchalik toastda qolib ketmasin, forma xatosi inline ham ko‘rsatiladi.

### Holatlar matritsasi
| Holat | Qoida |
|---|---|
| Default | Semantic sirt, normal border, yetarli kontrast |
| Hover | Sirt yoki border o‘zgaradi; layout joyidan siljimaydi |
| Focus-visible | 2px ring, 3px offset; clipped bo‘lmaydi |
| Active/pressed | Biroz chuqurroq sirt; aria-pressed kerak bo‘lsa |
| Selected/current | Xira accent fon + ikonka/matn + semantik atribut |
| Disabled | disabled yoki to‘g‘ri aria-disabled; click yo‘q; sabab tushunarli |
| Loading | Skeleton/spinner; joy rezerv, aria-busy, son o‘rniga yolg‘on 0 emas |
| Empty | “Hozircha ma’lumot yo‘q”; mos CTA; error bilan aralashtirilmaydi |
| Error | Sababning foydali qisqa matni, Qayta urinish; eski data bo‘lsa belgilash |
| Read-only | Qiymat ko‘rinadi, tahrirlash boshqaruvi yo‘q |

Barcha state har bir komponentga mantiqan mos bo‘lgandagina ishlatiladi. Masalan oddiy stat-cardda pressed state shart emas.

## 9. Responsive shartnoma
| Viewport | Sidebar/header | KPI grid | Intro |
|---|---|---|---|
| ≥1280px | 260px sidebar; 86px header | 4+3, 12 column | 2fr / 3fr |
| 1024–1279px | 232px sidebar; 76px header | 2 ustun; oxirgi wide | Banner keyingi qator |
| 768–1023px | Overlay drawer; 72px header | 2 ustun; oxirgi wide | Bir ustun |
| <768px | Overlay drawer; 64px header | 1 ustun | Bir ustun |
| ≤390px | Drawer max 320px/90vw | Rasm va matn ichki stack bo‘lishi mumkin | Dekor qisqaradi |

Kontent padding desktop 24px, tablet 20px, mobile 16px. 320px kenglikda sahifa horizontal overflow qilmaydi. 200% zoomda matn qirqilmaydi. Fixed card height o‘rniga min-height, zarur bo‘lsa o‘sadi. Mobileda 3D rasm 96–120px; yuqori label va qiymat ustiga chiqmaydi. Drawer ochilganda fon scroll bloklanadi va fokus boshqariladi. Max-content kengligi 1920px; undan kattada kontent markazlashadi, sidebar chetda qoladi.

Theme switch uchun “Light / Dark / System” control profil menyusida yoki Sozlamalarda joylashadi. Headerdagi tasdiqlangan kompozitsiyani ortiqcha tugmalar bilan kengaytirmang.

## 10. Assetlar va 3D art-direction
Paketda screenshot va PDF bor; alohida transparent 3D original assetlar hamda toza logo SVG hali berilmagan. Bularni mavjud brend/repo assetlaridan topish yoki alohida eksport qilish kerak. Screenshotdagi butun kartani rasm sifatida ishlatish sayt implementatsiyasi hisoblanmaydi. Yetishmayotgan asset uchun o‘lchami rezervlangan vaqtinchalik fallback mumkin, lekin final vizual acceptance ochiq qoladi.

| Kutilgan asset key | Mazmun | Tavsiya etilgan eksport |
|---|---|---|
| logo-light / logo-dark | PDFdagi original wordmark | Original SVG; raster bo‘lsa 2x+ |
| brand-pattern | PDFdagi original chevron modul | SVG yoki takrorlanuvchi transparent rasm |
| hero-education | Qizil/oltin kitoblar + yashil o‘simlik | Transparent WebP/PNG, ≈1000×600 |
| student | Qizil kiyimli o‘quvchi + oltin kitob | Transparent WebP/PNG, 512×512 |
| teacher | Ko‘zoynakli ustoz + doska | 512×512 |
| groups | Qizil/oltin/oq uch kishi | 512×512 |
| standards | Oq mezon varag‘i + oltin medal | 512×512 |
| assignments | Oq varaqlar to‘plami + check medal | 512×512 |
| checked | Oq ro‘yxat + oltin check | 512×512 |
| pending | Qizil qopqoqli qumsoat | 512×512 |

Art direction: yumaloq bevel, silliq keramika/plastik material, yumshoq specular highlight, yuqori chapdan katta softbox, pastga/o‘ngga yumshoq contact shadow, 3/4 ko‘rinish, taxminan 10–20° yuqoridan qarash. Taxminiy kamera/yoritish qoidasidir; original 3D scene parametri ma’lum emas. Oq, qizil, oltin asosiy; o‘simlik yashili dekorativ istisno. Har bir asset bir xil yorug‘lik va masshtab oilasida.

PNG/WebP shaffof chetlarida oq halo bo‘lmasin. Har ikkala fon ustida 100% zoomda tekshiring. Rasmda tayyor soya bo‘lsa qo‘shimcha CSS drop-shadow takrorlanmasin. CSS bilan WebGL sahna yaratish shart emas. KPI illustratsiyalar alt="" va aria-hidden bo‘lishi mumkin, chunki karta matni mazmunni takrorlaydi. Logo linkining accessible nomi “IT Live Score — bosh sahifa”.

Tavsiya budjet: har KPI asset ≤150KB, hero ≤300KB; ko‘rinadigan jami grafik assetlar ≈1.5MBdan kichik. Bu sifatni tekshirib optimallashtirish maqsadi, mavjud fayllar haqida da’vo emas. width/height rezerv qiling; pastdagi rasmlarga lazy loading, birinchi ekrandagilarga odatiy loading.

## 11. Kodga integratsiya
Repository berilmagani uchun framework/version tekshirilmadi. Amaldagi framework, router, chart/icon kutubxonasi va styling usuli saqlanadi. Ushbu hujjat React yoki Tailwindni majbur qilmaydi. Hech qaysi kutubxona avvalgi raster rasmlarni yaratishda ishlatilgan deb da’vo qilinmaydi.

Tavsiya etilgan mantiqiy joylashuv; real stackga moslang:
```text
src/styles/tokens.css
src/theme/theme.[js|ts]
src/components/layout/{AppShell,Sidebar,Topbar}
src/components/ui/{Button,Field,Select,Dialog,Drawer,Table,Toast}
src/components/dashboard/{EducationBanner,StatCard,TrendBadge,MiniBarChart}
src/pages/... mavjud route modullari
public/brand/... original logo va pattern
public/illustrations/... transparent 3D assetlar
design/it-live-score/... ushbu paket va reference
```

Raw HEX faqat tokens faylida yoki brand assetning o‘zida. Komponent ichida --surface, --foreground, --border kabi semantic tokenlar. Component token faqat qayta ishlatiladigan komponentga haqiqatan kerak bo‘lsa qo‘shiladi. Chartlar theme o‘zgarishini ham olishlari kerak; JS color cache yoki portal eski rangda qolmasin.

`tokens.css`dagi .ils-* layout classlari boshlang‘ich scaffold; loyiha reset/styling bilan moslashtiring. Bu fayl butun tayyor component library emas. `theme.js` data-theme atributini htmlga qo‘yadi, localStorage preference va system o‘zgarishini boshqaradi. SSR loyihada boshlang‘ich theme paintdan oldin, uning CSP/nonces va server cookie usuliga mos ulanadi. Client scriptni serverda import qilib windowga murojaat qilmang.

Theme preference light/dark/system; resolved theme faqat light/dark. Preference yo‘q bo‘lsa system. LocalStorage bloklansa sessiyada ishlash davom etadi. localStoragega token yoki shaxsiy ma’lumot yozilmaydi.

## 12. Accessibility va hisoblash qoidalari
Oddiy matn uchun kamida 4.5:1, katta matn uchun 3:1; zarur UI shakl/chegaralari uchun 3:1 kontrast maqsad qilinadi. Juda xira card border dekorativ bo‘lishi mumkin, ammo inputning tanib olinishi unga bog‘liq bo‘lsa --control-border ishlatiladi. [W3C matn kontrasti](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [W3C non-text kontrasti](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

Tab tartibi, ko‘rinadigan fokus, skip-link, semantik heading, form label, modal fokus va ikonka accessible nomlari tekshiriladi. Statuslar text + icon bilan. Muhim matn 12pxga tushirilmaydi. Loading/error/empty farqlanadi. Productiondagi API bo‘sh javobi 0 deb talqin qilinmaydi.

Foizlar screenshotdan hardcode qilinmaydi. Foiz o‘sishi, umumiy bajarilish foizi va foiz punktlari turli o‘lchovlar: 60%dan 70%ga chiqish +10 foiz punkt yoki +16.7% nisbiy o‘sish. Qaysi biri ekanini label aniqlashtiradi.

## 13. Bosqichma-bosqich joriy qilish
1. Mavjud route, role/permission, API, component, asset va theme imkoniyatlarini inventar qiling.
2. Shu paket tokenlarini mavjud style bilan ulab, global theme va fontni sozlang.
3. Original logo/3D asset mavjudligini tekshiring; asset manifestni haqiqiy fayllarga ulang.
4. AppShell va tanlangan dashboardni aynan reference kompozitsiyasida yarating.
5. StatCard, trend, banner va chartni umumiy komponentga ajrating.
6. Button/field/table/dialog holatlarini light/darkda tugating.
7. Modullarni yuqoridagi sahifa andozalari bilan bittadan ko‘chiring.
8. Har ikkala theme va responsive holatlarni tekshiring; mavjud business logic regressiyasini tekshiring.

Refaktor dizayn scope ichida. API kontrakti, autentifikatsiya, access control, hisoblash va mavjud foydalanuvchi ma’lumotlari saqlanadi. Backend migratsiyasi yoki yangi mahsulot funksiyasi bu topshiriqqa avtomatik kirmaydi.

## 14. Qabul qilish mezonlari
- 1672×941 viewportda ikkala reference yonma-yon solishtirildi; font yuklangan.
- Sidebar, header, intro/banner, 4+3 KPI tartibi va 3D asset joylari mos.
- Theme toggle payti elementlarning bounding boxlari o‘zgarmaydi.
- Logo original fayldan, Score alohida pastda; yangi mark yaratilmagan.
- Light sirtlar iliq, dark sirtlar navy; begona dominant palitra yo‘q.
- Karta matni, qiymati va illustratsiyasi ustma-ust kelmaydi; uzun o‘zbekcha matn sinovdan o‘tdi.
- 320, 390, 768, 1024, 1280, 1672px va 200% zoom tekshirildi.
- Table/filter/form/modal/drawer barcha kerakli state va ikkala theme bilan ishlaydi.
- Klaviatura, focus, label, error/empty/loading va kontrast tekshirildi.
- Delta previous=0/null; chart empty; progress total=0 holatlari to‘g‘ri.
- Screenshotdagi demo ma’lumot production manbasi sifatida ishlatilmagan.
- Mavjud API/route/permission va muhim foydalanuvchi oqimlari saqlangan.
- Yakuniy hisobotda o‘zgargan fayllar, tekshirilgan sahifalar va yetishmayotgan assetlar aniq.

## 15. O‘lchov izohi
Rasterdan olingan yakka pixel namunalari: light (325,325) #FDF6F2, (320,485) #FDF1C6, (1370,485) #FEE3DF; dark o‘sha joylarda #0F1825, #3D371D, #3E252B. Fon dark (800,920) #091120. Soya, gradient va antialiasing sabab har bir piksel turlicha. Shu bois butun cardga bitta sample rangni ko‘r-ko‘rona yoyish o‘rniga yuqoridagi normallashtirilgan tokenlar ishlatiladi.

