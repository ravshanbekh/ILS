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
