# 3D assetlar — tayyor promptlar va joylashtirish yo'riqnomasi

DESIGN-GUIDE 10-bo'limidagi art-direction asosida. Har bir prompt shu
qo'llanmadagi yoritish, material va rakurs qoidalarini takrorlaydi —
shuning uchun 8 ta rasm bitta oilaga o'xshab chiqadi.

## Qayerga qo'yiladi

```
frontend/public/illustrations/student.webp
frontend/public/illustrations/teacher.webp
frontend/public/illustrations/groups.webp
frontend/public/illustrations/standards.webp
frontend/public/illustrations/assignments.webp
frontend/public/illustrations/checked.webp
frontend/public/illustrations/pending.webp
frontend/public/illustrations/hero-education.webp
frontend/public/brand/itlive-logo.svg
```

Nomlar AYNAN shunday bo'lishi kerak. Kod o'zgartirilmaydi — fayl paydo
bo'lishi bilan vaqtinchalik belgi o'rniga haqiqiy rasm chiqadi
(`src/components/brand/Illustration.tsx`).

**O'lchamlar:** KPI assetlari 512×512, hero ≈1000×600.
**Format:** shaffof fonli WebP (yoki PNG → keyin WebP'ga o'girish).
**Budjet:** har KPI asseti ≤150KB, hero ≤300KB.

## Barcha promptlarga qo'shiladigan umumiy qism

Quyidagi matnni HAR BIR promptning oxiriga qo'shing:

```
3D render, soft rounded bevels, smooth glossy ceramic-plastic material,
gentle specular highlight, large softbox light from upper left, soft
contact shadow falling to the lower right, three-quarter view seen from
about 15 degrees above, palette limited to pure white, vivid red #FF2B00
and warm gold #FFB800, completely transparent background, centred in
frame, no text, no letters, no logo, no ground plane, product-shot
lighting, high detail, 512x512
```

## 8 ta asset

### 1. `student.webp` — O'quvchilar
```
A friendly stylised 3D student character, upper body only, wearing a red
sweater, holding a gold hardcover book against the chest, warm neutral
skin tone, simple rounded hair, no facial detail beyond a calm expression
```

### 2. `teacher.webp` — O'qituvchilar
```
A friendly stylised 3D teacher character, upper body only, wearing dark
glasses and a dark suit with a red tie, standing beside a small white
whiteboard with a gold frame
```

### 3. `groups.webp` — Guruhlar
```
Three simplified 3D human figures standing together in a small group,
one red, one gold, one white, no faces, smooth rounded capsule shapes
```

### 4. `standards.webp` — Normativlar
```
A single white sheet of paper with three rounded red content lines on it,
a gold award medal with a red ribbon overlapping its lower right corner
```

### 5. `assignments.webp` — Jami topshiriqlar
```
A neat stack of four white paper sheets slightly fanned out, each with
short red content lines, a gold circular badge with a white checkmark
resting on the front lower right corner
```

### 6. `checked.webp` — Tekshirilgan
```
A white clipboard or checklist sheet with three rows, each row showing a
small gold checkmark, one large gold circular badge with a white
checkmark in the lower right
```

### 7. `pending.webp` — Kutilmoqda
```
An hourglass with red rounded caps top and bottom, transparent glass
body, gold sand falling through the narrow middle
```

### 8. `hero-education.webp` — Banner (1000×600)
```
A composition of three stacked hardcover books, the top one red and open,
the ones beneath gold and white, standing next to a small potted green
plant in a white ceramic pot, arranged as a desk still life
```
Bunga umumiy qismni qo'shganda `512x512` ni `1000x600` ga almashtiring.
O'simlik yashili — palitradagi yagona ruxsat etilgan istisno.

## Qayerdan olish mumkin

| Yo'l | Narx | Brendga mosligi | Izoh |
|---|---|---|---|
| **AI generatsiya** (yuqoridagi promptlar) | tekin–arzon | ★★★ eng yaxshi | Referens rasmlar ham shunday yaratilgan |
| **3dicons.co** | tekin (CC0) | ★★ | Tayyor 3D ikonkalar, rangi brendga to'liq mos emas |
| **Microsoft Fluent Emoji** (GitHub, MIT) | tekin | ★★ | 🎓 📚 ⏳ ✅ 3D uslubda, litsenziyasi toza |
| **Iconscout / Craftwork 3D** | $20–50 | ★★★ | Sifati yuqori, rangini o'zgartirish mumkin |

**Tavsiya:** AI generatsiya. Sabab — referens rasmlardagi aynan o'sha
uslub va aynan brend ranglari chiqadi. Tayyor to'plamlarda ranglar mos
kelmaydi va 8 ta ikonka bir-biriga o'xshamay qolishi mumkin.

## Sifat tekshiruvi

Fayllarni qo'yganingizdan keyin:

1. Shaffof chetlarida **oq halo** bo'lmasin — light va dark fon ustida
   100% zoomda tekshiring.
2. Rasmda **tayyor soya** bo'lsa, CSS'da qo'shimcha soya qo'shilmaydi
   (kodda ham qo'shilmagan).
3. Sakkiztasi **bir xil yorug'lik va masshtabda** ko'rinsin — yonma-yon
   qo'yib solishtiring.
4. `/__design` sahifasini oching — hammasi bir oilaga o'xshasa tayyor.

## Logo haqida alohida

`itlive-logo.svg` ni **fontdan qayta terib yasash mumkin emas**
(DESIGN-GUIDE 3-bo'lim). Uni `references/IT-identity.pdf` dan vektor
sifatida eksport qilish kerak:

- Illustrator/Inkscape'da PDF'ni oching → logo obyektini tanlang →
  "Save as SVG"
- Yoki dizaynerdan original SVG faylini so'rang

Hozir vaqtinchalik tipografik lockup turibdi — u yakuniy emas.

---

# 2-to'plam — O'quvchi kabineti (15 ta asset)

Bu qism o'quvchi paneli uchun. Mockupdagi ko'rinishga mos.

## Qayerga qo'yiladi

```
frontend/public/illustrations/student-hero.webp    (800x600)
frontend/public/illustrations/coins.webp           (512x512)
frontend/public/illustrations/badges/<id>.webp     (512x512, 13 ta)
```

Tekshirish: `/__design` sahifasini oching — "Asset tekshiruvi" bo'limida
har bir fayl o'z uyasida ko'rinadi. Uzuq-chiziqli kvadrat yoki emoji
chiqsa, o'sha fayl hali qo'yilmagan.

## Umumiy qism — YUTUQ ikonkalari uchun

Har bir badge promptining oxiriga qo'shing:

```
3D icon, soft rounded bevels, glossy ceramic-plastic material, bright
specular highlight, large softbox light from upper left, soft contact
shadow to the lower right, viewed straight on with a slight tilt from
about 10 degrees above, palette limited to pure white, vivid red #FF2B00
and warm gold #FFB800, completely transparent background, single object
centred in frame, no text, no background, playful and celebratory,
high detail, 512x512
```

Istisno: ba'zi yutuqlarda yashil yoki ko'p rangli element bor — ular
prompt ichida alohida aytilgan, umumiy qoidadan ustun turadi.

## 13 ta yutuq ikonkasi

### `badges/first_green.webp` — Ilk G'alaba
```
A single faceted emerald green gemstone, cut like a jewel with visible
facets, glowing softly from within
```
(Yashil bu yerda ataylab — yutuq "yashil natija" haqida.)

### `badges/perfect_10.webp` — A'lochi
```
A gold circular medal with a white five-pointed star in the centre,
hanging from a short red and white striped ribbon
```

### `badges/century.webp` — Yuzlik
```
The numerals 100 in bold rounded red three-dimensional lettering with a
short double underline beneath, styled like a celebratory score stamp
```

### `badges/double_century.webp` — 200 lik Klub
```
A gold two-handled trophy cup with a white star on its front bowl,
standing on a short gold base
```

### `badges/triple_century.webp` — Spartalik
```
A gold five-point crown with three red teardrop gemstones set across
the front band
```

### `badges/dragon.webp` — Ajdarho
```
A small friendly cartoon dragon in green with a pink-red belly and
crest, curled in a compact S shape, big kind eyes
```
(Yashil-pushti — mockupdagi kabi, umumiy palitradan istisno.)

### `badges/multitasker.webp` — Ko'p qirrali
```
A black graduation cap with a gold tassel hanging from its right corner,
resting at a slight angle
```

### `badges/night_owl.webp` — Tungi boyo'g'li
```
A small round owl with white and warm grey feathers, large amber eyes,
sitting upright, a tiny gold crescent moon beside it
```

### `badges/rainbow.webp` — Kamalak
```
A short arched rainbow with clearly separated glossy bands in red,
gold, green and blue, a small white cloud at each end
```
(Ko'p rangli — bu yutuqning ma'nosi aynan uch xil natija haqida.)

### `badges/sniper.webp` — Snayper
```
A red and white concentric target board seen slightly from the side with
a single dart struck exactly in the gold centre ring
```

### `badges/comeback.webp` — O'likdan tirilgan
```
A white heart with a red pulse line running across it, and a small gold
upward arrow rising from behind the heart
```

### `badges/rocket.webp` — Raketa
```
A white rocket with a red nose cone and red fins, tilted upward to the
right, with a short gold flame at its base
```

### `badges/streak_5.webp` — Olovli
```
A stylised flame with a red outer layer and a gold inner core, rounded
and glossy, leaning slightly to the right
```

## 2 ta katta asset

### `student-hero.webp` — Profil hero (800x600)
```
A composition of two stacked hardcover books, the lower one gold and the
upper one red with a small white iT monogram embossed on its cover, a
black graduation cap with a gold tassel resting on top of them, and a
white ceramic cup holding red and gold pencils standing to the right
```
Umumiy qismni qo'shing, lekin `512x512` o'rniga `800x600` yozing va
`single object centred in frame` o'rniga `objects arranged as a desk
still life` deb yozing.

### `coins.webp` — Coin balansi (512x512)
```
A small pile of gold coins, three or four stacked flat and one large coin
standing upright in front of them, the upright coin showing the letters
CO embossed in its centre
```

## Sifat tekshiruvi

1. `/__design` ni oching — "Asset tekshiruvi" bo'limi
2. Hamma uyalar to'lganini ko'ring
3. Yutuq ikonkalari **bir xil masshtabda** bo'lsin — biri katta, biri
   kichik ko'rinmasin
4. Yorug'lik yo'nalishi hammasida bir xil (chap yuqoridan)
5. Light va dark fonda oq halo yo'qligini tekshiring

---

# 3-to'plam — Navigatsiya ikonkalari

## ⚠️ Avval o'qing — tavsiya

`DESIGN-GUIDE.md` 2-bo'limi menyuda **outline** ikonka ishlatishni aytadi,
3D uslub esa KPI va bannerga tegishli. Yangi mockup bundan chetga chiqadi.
Buni qilish mumkin, lekin uchta haqiqiy narx bor:

1. **Og'irlik.** 45 ta ikonka × ~35KB ≈ **1.6MB**. Menyu HAR sahifada
   turadi, ya'ni bu og'irlik doim yuklanadi. Qo'llanmadagi butun sahifa
   uchun budjet ~1.5MB edi.
2. **Detal yo'qoladi.** Menyuda ikonka 18–22px chiqadi. Mockupda ular
   kattaroq ko'rsatilgan. Shu o'lchamda 3D yaltirashlar loyqaga aylanadi,
   outline ikonka esa tiniq qoladi.
3. **Xizmat ko'rsatish.** Menyuga yangi bo'lim qo'shilsa, har safar yangi
   3D ikonka buyurtma qilish kerak bo'ladi.

**Tavsiyam — bosqichma-bosqich:**

| Bosqich | Nechta | Nima |
|---|---|---|
| **1** | **9 ta** | Dashboard + 8 ta bo'lim sarlavhasi |
| **2** | 36 ta | Ichki havolalar |

1-bosqich butun tashqi ko'rinishning katta qismini beradi (bo'lim
sarlavhalari kattaroq va ko'zga tashlanadi), og'irligi esa ~350KB.
Keyin qarab turasiz: yetarli bo'lsa 2-bosqich shart emas.

**Kod ikkalasiga ham tayyor.** `NavIcon` har bir ikonkani alohida
qidiradi va topmasa hozirgi outline ikonkani chizadi. Ya'ni **istalgan
qismini** qo'ysangiz bo'ladi — hammasini birdan yaratish shart emas va
yarim holatda ham menyu buzilmaydi.

## Qayerga qo'yiladi

```
frontend/public/illustrations/nav/<nom>.webp     (128x128)
```

128px yetarli: ekranda 18–22px chiqadi, retina uchun zaxira bilan kifoya.
512 qilib katta fayl yasash shart emas.

## Umumiy qism — HAR BIR menyu ikonkasiga

```
3D icon, simple and bold, soft rounded bevels, glossy ceramic material,
gentle highlight from upper left, minimal soft shadow, viewed straight
on, palette limited to pure white, vivid red #FF2B00 and warm gold
#FFB800, completely transparent background, single centred object,
no text, readable at small size, chunky shapes and thick forms,
128x128
```

`chunky shapes and thick forms` — bu juda muhim. Ingichka chiziqli ikonka
20px da ko'rinmay ketadi.

## 1-BOSQICH — 9 ta (tavsiya etilgan)

| Fayl | Menyu bandi | Prompt qismi |
|---|---|---|
| `dashboard.webp` | Dashboard | four rounded squares arranged in a two by two grid, two of them red and two gold |
| `group-users_groups.webp` | Jamoa | two overlapping person silhouettes shown from the shoulders up, the front one red and the back one white |
| `group-education_exams.webp` | Ta'lim | an open book with white pages and a red cover, lying flat |
| `group-normatives_results.webp` | Normativlar | a clipboard with a white sheet showing three short red lines and a gold clip at the top |
| `group-monitoring_analysis.webp` | Monitoring | a round radar screen with a red sweep line and a small gold blip |
| `group-checklist_system.webp` | Cheklistlar | a white sheet with three rows, each row marked with a gold checkmark |
| `group-gamification.webp` | Gamifikatsiya | a game controller with a red body, white buttons and a gold directional pad |
| `group-settings_backup.webp` | Sozlamalar | a thick cogwheel with wide teeth, red body and a gold centre hole |
| `group-normatives_student.webp` | Normativlar (o'quvchi) | a clipboard with a white sheet and a gold star in its centre |

## 2-BOSQICH — 36 ta ichki havola

| Fayl | Menyu bandi | Prompt qismi |
|---|---|---|
| `users.webp` | Foydalanuvchilar | a single person silhouette from the shoulders up, white body with a red head |
| `groups.webp` | Guruhlar | three small person silhouettes side by side in red, gold and white |
| `permissions.webp` | Ruxsatlar | a shield with a white body, red border and a gold checkmark in the centre |
| `trash.webp` | Korzinka (Savat) | a waste bin with a red body, white vertical stripes and a gold lid |
| `lessons.webp` | Darsliklar | a stack of three closed books, red on top, gold and white beneath |
| `exams.webp` | Imtihonlar | a white document sheet with red lines and a gold pencil lying across it |
| `live-quiz.webp` | Live Quiz | a thick lightning bolt in gold with a red outline |
| `homework-bank.webp` | Uyga vazifa bankasi | a simple house with a red roof and white walls, a gold door |
| `normatives.webp` | Normativlar | a white sheet with a red numbered list of three items |
| `submissions.webp` | Topshiriqlar | a white sheet with a large gold checkbox ticked in its centre |
| `stats.webp` | Statistika | three vertical bars of increasing height in gold, red and gold |
| `rankings.webp` | O'quvchilar reytingi | a gold trophy cup with two handles and a white star |
| `student-categories.webp` | Natija kategoriyalari | four rounded squares in a grid, coloured green, gold, red and white |
| `lesson-control.webp` | Dars nazorati | a round alarm clock with a red case, white face and two gold bells on top |
| `parents.webp` | Ota-onalar bazasi | a plump rounded heart in bright red with a white highlight |
| `appeals.webp` | Murojaatlar | a rounded speech bubble in white with a red outline and three gold dots inside |
| `event-feedback.webp` | Demo Day fikrlari | a megaphone with a red cone and a white handle, gold sound lines |
| `frozen-students.webp` | Muzlatilganlar | a six-pointed snowflake in white with pale blue edges |
| `teacher-rating.webp` | O'qituvchi reytingi | a five-pointed star in bright red with a gold outline |
| `monitoring.webp` | Monitoring | a red heartbeat pulse line with a sharp peak in the centre |
| `predictions.webp` | AI Prognozlar | three rising bars in gold with a red arrow curving upward above them |
| `support-hours.webp` | Assistent soatlari | a round clock face in white with a red rim and gold hands |
| `checklist-stats.webp` | Cheklist Hisobot | a white sheet with a small gold bar chart drawn on it |
| `checklist-manage.webp` | Cheklist Boshqaruv | a clipboard with a gold pencil writing on its white sheet |
| `shop-items.webp` | Do'kon boshqaruvi | a small shop front with a red and white striped awning and a gold door |
| `shop-orders.webp` | Buyurtmalar | a closed cardboard box in warm white with red tape across the top |
| `coin-oversight.webp` | Coin nazorati | three gold coins stacked with one standing upright in front |
| `export.webp` | Eksport / Zaxira | a gold downward arrow pointing into an open white tray |
| `settings.webp` | Sozlamalar | a thick cogwheel with wide teeth in white with a red centre |
| `history.webp` | Topshiriqlarim | a white sheet with a gold checkmark and a small red clock in the corner |
| `homework.webp` | Uyga vazifalar | a red notebook with a gold pencil resting on it |
| `results.webp` | Natijalarim | a gold medal with a red ribbon and a white star |
| `ranking.webp` | Reyting | a podium with three steps, the tallest in gold and the others white and red |
| `shop.webp` | Do'kon | a gift box in red with a gold ribbon and bow |
| `my-normatives.webp` | Qoidalar va Ko'rsatmalar | an open book with a gold bookmark ribbon hanging from it |
| `pending.webp` | Tekshirish | an hourglass with red caps and gold sand |

⚠️ `pending.webp` KPI to'plamida ham bor, lekin u boshqa papkada
(`illustrations/pending.webp`). Menyu varianti `illustrations/nav/`
ichida turadi va kichikroq bo'ladi — ikkalasi to'qnashmaydi.

## Tekshirish

`/__design` sahifasini oching yoki shunchaki menyuga qarang: ikonka 3D
chiqsa tayyor, outline qolsa hali qo'yilmagan. Yarim holat normal.
