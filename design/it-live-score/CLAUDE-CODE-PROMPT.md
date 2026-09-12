# Claude Code uchun tayyor topshiriq
Quyidagi topshiriqni mavjud web loyiha ichida bajaring. Ushbu paketni loyiha ichidagi `design/it-live-score/` papkasiga qo‘ying yoki yo‘lni haqiqiy joylashuviga moslang.

---

IT Live Score web ilovasining frontendini foydalanuvchi tanlagan 3-variant shabloni asosida bir xil Light va Dark dizayn tizimiga o‘tkaz.

## Avval o‘qiladigan material
- `design/it-live-score/DESIGN-GUIDE.md` — to‘liq dizayn shartnomasi.
- `design/it-live-score/tokens.css` — primitive/semantic rang va o‘lcham tokenlari.
- `design/it-live-score/theme.js` — theme yordamchisi; frameworkga moslashtirish mumkin.
- `design/it-live-score/references/light.png` va `dark.png` — vizual manbalar.
- `design/it-live-score/references/IT-identity.pdf` — original logo va brend.

Screenshotlar layoutning ustuvor manbasi. Qo‘llanma ranglar, accessible tuslar, responsive va screenshotda yo‘q sahifalar qoidalarini aniqlaydi. Quyidagi ishni yangi layout o‘ylab topish emas, tasdiqlangan dizaynni butun frontendga joriy qilish sifatida bajar.

## Ish chegarasi
Mavjud framework, router, backend API, autentifikatsiya, role/permission, business logic va foydalanuvchi ma’lumotlarini saqla. UI refaktori uchun zarur bo‘lmagan framework almashish, backend migratsiya, yangi mahsulot funksiyasi yoki deployment qilma. Repositorydagi foydalanuvchi o‘zgarishlarini saqla.

Repositoryni maqsadli tekshir: package manifest, amaldagi global styles/theme, shell, router, sahifalar, qayta ishlatiladigan komponentlar va assets. Haqiqiy route inventarini tuz; faqat dashboard bilan cheklanma. Mavjud bo‘lmagan sahifani to‘liq ishlayotgan mahsulot deb ko‘rsatma. API maydonlari yoki endpointlarni taxmin qilib o‘zgartirma.

## Natijaga olib boruvchi ish
1. Yagona semantic tokens va Light/Dark/System theme boshqaruvini joriy qil.
2. PDF/repo ichidagi original iTLive logo assetlarini ishlat. Score alohida pastda. Logo harflarini font bilan qayta yig‘ma.
3. AppShell, Sidebar, Topbarni screenshotdagi o‘lcham va tartibga mosla.
4. Dashboard intro + o‘ng banner + 4 KPI + 3 KPI tarkibini reference bilan mosla.
5. StatCard, TrendBadge, mini-chart, illustration va banner komponentlarini qayta ishlatiladigan qil.
6. Table, FilterBar, Button, Field, Select, Tabs, Dialog, Drawer, Toast, Empty/Error/Loading state oilasini shu tokenlarga o‘tkaz.
7. Haqiqiy mavjud modullarni shu shablonga mosla: Jamoa, Ta’lim, Darsliklar, Imtihonlar, Live Quiz, Uyga vazifa bankasi, Normativlar, Monitoring, Cheklistlar, Gamifikatsiya, Sozlamalar. Qo‘llanmadagi sahifa andozalaridan foydalan.
8. Responsive, keyboard, theme persistence, real API mapping va muhim oqimlarni tekshir.

## Qat’iy vizual talablar
- Light va dark uchun bir xil DOM/komponent/layout, faqat semantic rang, border va soyalar o‘zgaradi.
- Screenshotdagi tanlangan 3D assetlar va kompozitsiya asos bo‘ladi.
- Chap navigatsiya outline ikonkalarda; KPI va banner yumshoq 3D illustratsiyalarda.
- Light: oq canvas, iliq shaftoli KPI kartalar. Dark: #091120 canvas, #101925 oilasidagi kartalar.
- Brend primitive ranglar: #FF2B00, #FFB800, #0F1B2D, #FF8050, #F5F1EE. Aniq semantic qo‘llanish tokens.cssda.
- Roboto, katta qiymatlar, 20px karta radius, ixcham 12px grid gap.
- Yangi ko‘k hero-panel, neon, boshqa logo, umumiy SaaS dashboard layouti, screenshotni bitta rasm qilib joylashtirish yo‘q.
- Mockupdagi matn/sonlar production APIga yozilmaydi; solishtirish fixture sifatida alohida ishlatiladi.
- Yetishmayotgan 3D/SVG fayllarni mavjuddek ko‘rsatma. Avval mavjud assetni qidir; topilmasa mos o‘lcham rezerv qil va asset ro‘yxatini ochiq hisobotga yoz. Boshqa mustaqil UI ishlarini davom ettir. Screenshot bo‘lagi yoki emoji final 3D asset o‘rnini bosmaydi.

## Hisoblash va interaksiya
Delta yo‘nalishi va biznes natijasi alohida: Kutilmoqda -28% foydali bo‘lishi mumkin. previous=0/null, empty chart, total=0 progress holatlarini ko‘r. Productionda trendlar haqiqiy davrlar bo‘yicha. Tema toggleda layout siljimasin, logo va chartlar themega mos yangilansin. Toast, portal, modal, date/select popoverlar ham tokenlarni meros olsin.

## Qabul tekshiruvi
1672×941 da Light va Dark screenshot ol va reference bilan yonma-yon tekshir; 4+3 grid, intro/banner va asset joylashuvi muhim. 320/390/768/1024/1280 kenglik, 200% zoom, uzun o‘zbekcha matn, keyboard, focus, contrast va empty/error/loading holatlarini tekshir. Mavjud build/lint va vazifaga tegishli funksional testlarni ishga tushir. Theme yordamchisini server muhitida window bilan buzma; SSR/CSPni loyihaning mavjud usulida hal qil.

Yakuniy javobda amalga oshirilgan modullar, o‘zgargan asosiy fayllar, bajarilgan tekshiruvlar va ochiq qolgan konkret asset/API cheklovlarini ber. Faqat reja yoki kod parchasi bilan to‘xtama: repositorydagi ruxsat etilgan frontend ishini yakunla.

