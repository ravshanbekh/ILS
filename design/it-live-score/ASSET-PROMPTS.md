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
