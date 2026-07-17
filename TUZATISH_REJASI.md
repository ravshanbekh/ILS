# 🛠 TUZATISH REJASI — itlivescore.uz

> **Tahlil sanasi:** 2026-07-17
> **Holat:** Loyiha production'da ishlab turibdi. Ushbu reja **ma'lumotlarni buzmasdan**, bosqichma-bosqich tuzatish uchun yozilgan.
>
> **Oltin qoidalar (har bir bosqichdan oldin):**
> 1. Har qanday deploy'dan oldin backup oling: `docker exec tizim_db pg_dump -U root normativ_tizim > backup_$(date +%F_%H%M).sql`
> 2. O'zgarishlarni avval **demo muhitda** (demo.itlivescore.uz) sinab ko'ring, keyin asosiy tizimga chiqaring.
> 3. Har bir bosqich alohida commit — muammo chiqsa faqat o'sha bosqichni qaytarish oson bo'ladi.
> 4. Deploy'ni darslar bo'lmagan vaqtga (kechqurun/dam olish kuni) rejalashtiring.
> 5. `prisma migrate` ishlatiladi, `prisma db push --force-reset` **HECH QACHON** ishlatilmaydi.

---

## 📋 Umumiy ko'rinish

| Bosqich | Mavzu | Xavf darajasi | Ma'lumotga ta'siri | Taxminiy vaqt |
|---|---|---|---|---|
| 1 | Shoshilinch xavfsizlik (kod) | 🔴 Kritik | Yo'q | 2-3 soat |
| 2 | Infratuzilma sirlari (Docker/env) | 🔴 Kritik | Yo'q (restart kerak) | 1 soat |
| 3 | Socket.io autentifikatsiyasi | 🔴 Kritik | Yo'q | 3-4 soat |
| 4 | Fayl yuklash xavfsizligi | 🟠 Yuqori | Yo'q | 1-2 soat |
| 5 | DB indekslari | 🟠 Yuqori | Yo'q (faqat qo'shiladi) | 1-2 soat |
| 6 | N+1 so'rovlarni optimallashtirish | 🟠 Yuqori | Yo'q (faqat o'qish) | 1-2 kun |
| 7 | Token/sessiya mustahkamlash | 🟡 O'rta | Yangi jadval qo'shiladi | 1 kun |
| 8 | Algoritmik tuzatishlar | 🟡 O'rta | Yo'q | 2-3 soat |
| 9 | Kutubxona va bundle tozalash | 🟢 Past | Yo'q | Yarim kun |

Har bir bosqich mustaqil — tartib bo'yicha ketish tavsiya etiladi, lekin shart emas (faqat 7-bosqich 1-bosqichdan keyin bo'lsin).

---

## 1-BOSQICH: Shoshilinch xavfsizlik tuzatishlari (faqat kod, DB'ga tegilmaydi)

Bu bosqichdagi 5 ta tuzatish bitta deploy'da chiqarilishi mumkin. Hech biri ma'lumotga tegmaydi.

### 1.1. `trust proxy` yoqish — rate limit to'g'ri ishlashi uchun

**Muammo:** Backend nginx orqasida, lekin `trust proxy` yo'q. Hamma foydalanuvchi nginx'ning bitta IP'si sifatida ko'rinadi — 100 so'rov/daqiqa limiti butun saytga umumiy bo'lib qolgan.

**Fayl:** `backend/src/app.ts`

```ts
const app = express();
app.set('trust proxy', 1); // nginx orqasida turgani uchun — SHU QATORNI QO'SHISH
```

**Tekshirish:** Deploy'dan keyin `req.ip` real foydalanuvchi IP'sini ko'rsatishi kerak (health endpointga vaqtincha log qo'yib tekshirsa bo'ladi). Ikki xil qurilmadan kirib, biri limitga tushganda ikkinchisi ishlashda davom etishi kerak.

### 1.2. JWT secret fail-fast

**Muammo:** `.env`da `JWT_SECRET` bo'lmasa server jimgina `'dev-secret'` bilan ishlaydi — har kim o'ziga token yasay oladi.

**Fayl:** `backend/src/config/env.ts` — fayl oxiriga:

```ts
if (env.isProd) {
  if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
    throw new Error('PRODUCTION XATO: JWT_SECRET va JWT_REFRESH_SECRET .env da majburiy!');
  }
  if (env.JWT_SECRET === 'dev-secret' || env.JWT_SECRET.length < 32) {
    throw new Error('PRODUCTION XATO: JWT_SECRET juda qisqa yoki default qiymatda!');
  }
}
```

**Diqqat:** Deploy'dan OLDIN serverdagi `.env`da ikkala secret ham bor va 32+ belgi ekanini tekshiring, aks holda server ko'tarilmay qoladi. Secretlarni **almashtirmang** — almashtirsangiz hamma foydalanuvchi logout bo'ladi (bu ma'lumotni buzmaydi, lekin noqulaylik).

### 1.3. Imtihon login endpointiga brute-force himoya

**Muammo:** `POST /api/exam/join/:code/start` parol tekshiradi, lekin `loginLimiter` faqat `/api/auth/login`da.

**Fayl:** `backend/src/modules/exam/exam.routes.ts`

```ts
import { loginLimiter } from '../../shared/middleware/rateLimiter';
// ...
router.post('/join/:code/start', loginLimiter, examController.startExam);
```

Shu bilan birga `exam.controller.ts` dagi `startExam` ichida `isActive` tekshiruvi qo'shilsin:

```ts
const student = await prisma.user.findFirst({ where: { login } });
if (!student || !student.isActive || !(await bcrypt.default.compare(password, student.passwordHash))) {
  return res.status(401).json({ error: "Login yoki parol noto'g'ri" });
}
```

### 1.4. Xato xabarlari oqishini to'xtatish

**Muammo:** `exam.controller.ts` (va ba'zi boshqa controllerlar) `catch (e) { res.status(500).json({ error: e.message }) }` qiladi — Prisma'ning ichki xato matnlari mijozga chiqadi.

**Qilinadigan ish:** `exam.controller.ts` dagi barcha `res.status(500).json({ error: e.message })` joylarini `next(error)` ga almashtirish (funksiya imzosiga `next: NextFunction` qo'shib) — markaziy `errorHandler` o'zi to'g'ri javob beradi. Boshqa modullarda ham `grep -rn "e.message" src/modules` qilib tekshirib chiqish.

### 1.5. Body limitni to'g'rilash

**Muammo:** `express.json({ limit: '50mb' })` global — istalgan anonim so'rov 50MB yuborib RAM yeyishi mumkin.

**Fayl:** `backend/src/app.ts`

```ts
// Global — kichik limit
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));
```

Katta limit faqat backup restore'ga kerak — `backup.routes.ts` ichida:

```ts
router.post('/restore', express.json({ limit: '100mb' }), backupController.restoreBackup);
```

**Diqqat:** Deploy'dan oldin frontendda 2MB dan katta JSON yuboradigan joy bor-yo'qligini tekshiring (masalan Excel import bulk endpointlari — `checklist`, `exam questions bulk`). Bor bo'lsa, o'sha route'larga ham alohida `express.json({ limit: '20mb' })` qo'ying. Fayl yuklash (multer) bunga kirmaydi — u alohida ishlaydi.

### 1.6. Helmet qo'shish

```bash
cd backend && npm i helmet
```

```ts
import helmet from 'helmet';
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } })); // uploads rasmlari uchun
```

**✅ 1-bosqich deploy tekshiruvi:**
- [ ] Login ishlaydi, refresh ishlaydi
- [ ] Imtihonga kirish (o'quvchi) ishlaydi
- [ ] Excel importlar ishlaydi (body limit!)
- [ ] Rasm yuklash ishlaydi
- [ ] Backup download/restore ishlaydi (admin)

---

## 2-BOSQICH: Infratuzilma sirlari (Docker / env / git)

**Ma'lumotga ta'siri:** yo'q, lekin konteynerlar restart bo'ladi — 1-2 daqiqa downtime. `postgres_data` volume'ga tegilmaydi, DB ma'lumotlari joyida qoladi.

### 2.1. Postgres portini tashqaridan yopish

**Fayl:** `docker-compose.yml`

```yaml
  db:
    ports:
      - "127.0.0.1:5440:5432"   # avval "5440:5432" edi — endi faqat localhost
```

Backend konteyner ichki docker tarmog'i orqali ulanadi, unga bu o'zgarish ta'sir qilmaydi. Serverda UFW bo'lsa qo'shimcha: `sudo ufw deny 5440`.

### 2.2. DB parolini kuchaytirish

**Diqqat — bu eng ehtiyotkorlik talab qiladigan qadam.** Parol o'zgartirilganda volume'dagi eski parol bilan mos kelmay qolishi mumkin, chunki Postgres parolni birinchi ishga tushishda o'rnatadi. **To'g'ri usul — parolni SQL orqali almashtirish:**

```bash
# 1. Backup
docker exec tizim_db pg_dump -U root normativ_tizim > backup_parol_almashtirish.sql

# 2. Yangi parol o'rnatish (ishlab turgan bazada, ma'lumotga tegmaydi)
docker exec -it tizim_db psql -U root -d normativ_tizim -c "ALTER USER root WITH PASSWORD 'YANGI_KUCHLI_PAROL';"

# 3. backend/.env da DATABASE_URL ni yangi parol bilan yangilash
# 4. docker-compose.yml dagi POSTGRES_PASSWORD ni ham yangilash (hujjat sifatida)
# 5. Faqat backendni restart qilish
docker-compose up -d --no-deps backend
```

Parolni `docker-compose.yml`ga ochiq yozmaslik uchun `.env` faylga chiqaring:

```yaml
  db:
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
```

va loyiha ildizida `.env` (gitga qo'shilmaydigan) faylda `DB_PASSWORD=...` saqlang.

### 2.3. Git'dagi sirlarni tozalash

- `backend/.env.demo` git'da turibdi (JWT secretlar + `Demo@2026!` admin paroli bilan). Qilinadigan ish:
  1. `.env.demo` dagi JWT secretlarni va demo admin parolini **yangi qiymatlarga almashtiring** (eski qiymatlar git tarixida qoladi, shuning uchun almashtirish shart).
  2. Faylni gitdan chiqaring: `git rm --cached backend/.env.demo` va `.gitignore`ga `*.env.demo` qo'shing. `.env.example` shablonga demo o'zgaruvchilarini placeholder bilan qo'shib qo'ying.
- `.gitignore`da `backend/.env` borligini tasdiqlang (hozir commit qilinmagan — shu holatda qolsin).

### 2.4. Nginx'ga xavfsizlik headerlari + HTTPS

**Fayl:** serverdagi `/etc/nginx/sites-available/itlivescore` (repo'da `nginx-server.conf`)

```nginx
# server blok ichiga:
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
# HTTPS yoqilgandan keyin:
# add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

Agar hali HTTPS yoqilmagan bo'lsa: `sudo certbot --nginx -d itlivescore.uz -d www.itlivescore.uz -d demo.itlivescore.uz`. Login/parollar hozir HTTP orqali ochiq ketayotgan bo'lsa, bu 2-bosqichning eng muhim qismi.

**✅ 2-bosqich tekshiruvi:**
- [ ] `psql` tashqi IP'dan ulanib bo'lmasligi: `psql -h SERVER_IP -p 5440` → connection refused
- [ ] Sayt ochiladi, login ishlaydi
- [ ] `curl -I https://itlivescore.uz` headerlarni ko'rsatadi

---

## 3-BOSQICH: Socket.io autentifikatsiyasi

**Muammo:** Socketga istalgan odam ulanib, (a) boshqa foydalanuvchi xonasiga kirib uning bildirishnomalarini olishi, (b) live-quizda o'qituvchi eventlarini soxtalashi mumkin.

**Ma'lumotga ta'siri:** yo'q. Lekin frontend va backend **birga** deploy qilinishi kerak, aks holda socket ulanishlar uziladi (sayt ishlashda davom etadi, faqat real-time qism to'xtaydi).

### 3.1. Backend: handshake'da JWT tekshirish

**Fayl:** `backend/src/shared/utils/socket.ts`

```ts
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { JwtPayload } from '../middleware/auth.middleware';

export const initSocket = (server: HttpServer) => {
  io = new SocketIOServer(server, { cors: { /* mavjud sozlar */ } });

  // Autentifikatsiya middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      // Live-quiz o'quvchilari login qilmagan bo'lishi mumkin — ularga "guest" ruxsat
      socket.data.user = null;
      return next();
    }
    try {
      socket.data.user = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      next();
    } catch {
      next(new Error('Yaroqsiz token'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('join', (userId: string) => {
      // FAQAT o'z xonasiga qo'shilishi mumkin
      if (socket.data.user && socket.data.user.userId === userId) {
        socket.join(userId);
      }
    });
    // ...
  });
};
```

### 3.2. Backend: live-quiz teacher eventlarini himoyalash

**Fayl:** `backend/src/modules/live-quiz/live-quiz.gateway.ts`

```ts
socket.on('teacher:next-question', ({ code, questionData }) => {
  const user = socket.data.user;
  if (!user || !['admin', 'teacher'].includes(user.role)) return; // rol tekshiruvi
  socket.to(`quiz-${code}`).emit('quiz:question', questionData);
});
```

`player:answered` uchun: playerId'ni socket'ka birinchi `join-room`da bog'lab qo'yilgan (`socketToPlayerMap`) qiymatdan olish — mijoz yuborgan `playerId`ga ishonmaslik:

```ts
socket.on('player:answered', ({ code, fullName, isCorrect }) => {
  const p = socketToPlayerMap.get(socket.id);
  if (!p || p.code !== code) return;
  socket.to(`quiz-${code}`).emit('quiz:answer-received', { playerId: p.playerId, fullName, isCorrect });
});
```

### 3.3. Frontend: socket ulanishga token berish

Socket yaratiladigan joyda (odatda `socket.io-client` chaqirilgan fayl):

```ts
const socket = io(URL, {
  auth: { token: localStorage.getItem('accessToken') },
});
```

Token refresh bo'lganda socketni qayta ulash ham kerak (`socket.auth = {...}; socket.disconnect().connect()`).

**✅ 3-bosqich tekshiruvi:**
- [ ] Login qilingan foydalanuvchi real-time bildirishnoma oladi
- [ ] Brauzer konsolidan qo'lda `socket.emit('join', 'BOSHQA_USER_ID')` qilinsa xonaga qo'shilmaydi
- [ ] Live-quiz: o'qituvchi savol o'tkaza oladi, o'quvchi (guest socket) `teacher:next-question` emit qilsa hech narsa bo'lmaydi
- [ ] Live-quiz to'liq sikli: yaratish → qo'shilish → o'ynash → natija

---

## 4-BOSQICH: Fayl yuklash xavfsizligi

**Muammo:** `fileFilter` faqat mijoz yuborgan `mimetype`ni tekshiradi, kengaytma `originalname`dan olinadi → soxta mimetype bilan `.html` yuklab, `/uploads`dan serve qildirish (stored XSS) mumkin.

**Ma'lumotga ta'siri:** yo'q. Eski yuklangan fayllar joyida qoladi.

### 4.1. Kengaytma whitelist (barcha multer joylarida)

Fayllar: `exam.routes.ts`, `live-quiz.routes.ts` (rasm + musiqa), va boshqa multer ishlatilgan joylar (`grep -rn "multer" src/modules`).

```ts
const ALLOWED_IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_IMAGE_EXT.has(ext)) return cb(new Error('Ruxsat etilmagan fayl turi'), '');
    cb(null, `exam-q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (/image\/(jpeg|jpg|png|webp)/.test(file.mimetype) && ALLOWED_IMAGE_EXT.has(ext)) cb(null, true);
    else cb(new Error('Faqat JPG/PNG/WEBP rasm yuklanadi'));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});
```

(Musiqa uchun xuddi shu tamoyil: `.mp3/.wav/.ogg` whitelist.)

Fayl nomiga random suffix qo'shildi — `Date.now()` yolg'iz bo'lsa nom taxmin qilinishi va bir vaqtda ikki yuklashda to'qnashuv bo'lishi mumkin.

### 4.2. `/uploads` uchun xavfsiz serve

**Fayl:** `backend/src/app.ts`

```ts
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
  },
}));
```

Bu — allaqachon yuklangan zararli fayl bo'lsa ham brauzer uni bajarmasligi uchun.

### 4.3. Eski fayllarni audit qilish (bir martalik)

```bash
# uploads ichida rasm/musiqadan boshqa narsa bor-yo'qligini ko'rish:
find backend/uploads -type f ! \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" -o -iname "*.webp" -o -iname "*.mp3" -o -iname "*.wav" -o -iname "*.ogg" \)
```

Topilgan shubhali fayllarni ko'rib chiqib, keraksizlarini o'chirish (avval ro'yxatni saqlab qo'ying).

**✅ 4-bosqich tekshiruvi:**
- [ ] Oddiy rasm yuklash ishlaydi (imtihon savoli, quiz, avatar)
- [ ] `.html` faylni `image/png` mimetype bilan yuborish rad etiladi (curl bilan test)
- [ ] Eski yuklangan rasmlar ochiladi

---

## 5-BOSQICH: DB indekslari (tezlik uchun eng katta yutuq)

**Muammo:** Schemada bitta ham `@@index` yo'q — submissions, notifications, audit_logs bo'yicha barcha filtrlar seq scan.

**Ma'lumotga ta'siri:** YO'Q — indeks qo'shish ma'lumotni o'zgartirmaydi. Faqat yozish paytida bir necha soniya jadval band bo'lishi mumkin, shuning uchun kam yuklama vaqtida qilinadi.

### 5.1. Schema'ga indekslar qo'shish

**Fayl:** `backend/prisma/schema.prisma` — tegishli modellarga:

```prisma
model Submission {
  // ... mavjud maydonlar ...
  @@unique([studentId, normativeId])   // mavjud
  @@index([groupId, status])           // yangi — teacher pending ro'yxati
  @@index([status])                    // yangi — statistika countlari
  @@index([normativeId])               // yangi
}

model Notification {
  @@index([userId, isRead])            // yangi
}

model AuditLog {
  @@index([userId])                    // yangi
  @@index([createdAt])                 // yangi
}

model GroupStudent {
  @@index([studentId])                 // yangi (unique [groupId, studentId] faqat groupId ni qoplaydi)
}

model ExamParticipant {
  @@index([examId, status])            // yangi
}

model DailyChecklistEntry {
  @@index([date])                      // yangi
}
```

(Maydon nomlari schemadagi realiga moslab tekshirilsin — masalan `isRead` nomi boshqacha bo'lsa.)

### 5.2. Xavfsiz qo'llash tartibi

```bash
# 1. Lokal/demo muhitda migratsiya yaratish:
cd backend
npx prisma migrate dev --name add_performance_indexes
# Hosil bo'lgan SQL faylni OCHIB KO'RING — unda faqat CREATE INDEX bo'lishi kerak.
# Agar Prisma boshqa narsa (DROP, ALTER COLUMN) qo'shgan bo'lsa — TO'XTANG, schema drift bor,
# avval `npx prisma migrate diff` bilan farqni aniqlang.

# 2. Serverda (backup'dan keyin):
npx prisma migrate deploy
```

> **Muhim:** agar loyiha hozirgacha `prisma db push` bilan yuritilgan bo'lsa (migrations papkasi bo'sh/eskirgan bo'lsa), birinchi migratsiyani `npx prisma migrate diff` + `prisma migrate resolve` bilan "baseline" qilish kerak — aks holda `migrate deploy` mavjud jadvallarni qayta yaratmoqchi bo'ladi. Bu holatda eng xavfsiz yo'l:
> ```bash
> npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script > indexes.sql
> # indexes.sql ni ko'zdan kechiring (faqat CREATE INDEX qolsin), keyin:
> docker exec -i tizim_db psql -U root -d normativ_tizim < indexes.sql
> ```
> Katta jadvallarda downtime'siz qo'shish uchun SQL'da `CREATE INDEX CONCURRENTLY` ishlatsa bo'ladi.

**✅ 5-bosqich tekshiruvi:**
- [ ] `\di` (psql) — yangi indekslar ro'yxatda
- [ ] Dashboard/statistika sahifalari ochilish vaqti sezilarli kamaygan
- [ ] Hech qanday ma'lumot yo'qolmagan (submissions soni deploy oldi/keyin bir xil)

---

## 6-BOSQICH: N+1 so'rovlarni optimallashtirish

**Muammo:** `rankings.service.ts` va `statistics.service.ts` har bir student/teacher uchun alohida query yuboradi — 1000 o'quvchida bitta reyting sahifasi 1000+ query.

**Ma'lumotga ta'siri:** yo'q — bular faqat o'qish (SELECT) funksiyalari. Eng xavfsiz optimallashtirish turi: natija bir xil chiqsa bo'ldi.

**Ish tartibi (har bir funksiya uchun alohida, birma-bir):**

### 6.1. `getOverallRanking` (rankings.service.ts)

Hozir: barcha studentlar → har biriga alohida submissions query → xotirada sort → xotirada pagination.

Yangi yondashuv — bitta `groupBy`:

```ts
const scores = await prisma.submission.groupBy({
  by: ['studentId'],
  where: { status: 'checked', ...(targetNormativeIds ? { normativeId: { in: targetNormativeIds } } : {}) },
  _sum: { score: true },
  _count: true,
});
// scores ni Map'ga olib, students ro'yxatiga biriktirish, sort, pagination — xotirada (bu qismi mayli)
```

Natija taqqoslash sharti (regression test): eski va yangi funksiya bir xil ma'lumotda bir xil reyting qaytarishi kerak. Deploy'dan oldin demo bazada ikkala variantni yonma-yon chaqirib JSON'larni solishtiring.

### 6.2. `getTeachersRanking` (statistics.service.ts)

Har o'qituvchi uchun 4-5 query o'rniga: bitta so'rovda barcha guruhlar (teacher bilan), bitta `groupBy` submissions bo'yicha, keyin xotirada yig'ish. Andoza 6.1 bilan bir xil.

### 6.3. `getStudentStats` guruh ichidagi o'rin (statistics.service.ts)

Guruhdagi har bir o'quvchiga alohida query o'rniga guruh bo'yicha bitta `groupBy` (`by: ['studentId']`, where: guruh normativlari) — keyin sort va o'rin topish xotirada.

### 6.4. Reyting keshi (ixtiyoriy, lekin tavsiya etiladi)

Schemada `RankingCache` modeli bor lekin ishlatilmayapti. Oddiy variant — servisda 5 daqiqalik in-memory kesh:

```ts
let cache: { data: any; expires: number; key: string } | null = null;
// getOverallRanking boshida: agar cache mavjud va muddati o'tmagan va key mos bo'lsa — qaytarish
```

Submission tekshirilganda (`checked` bo'lganda) keshni tozalash shart emas — 5 daqiqa kechikish reyting uchun normal.

**✅ 6-bosqich tekshiruvi:**
- [ ] Reyting sahifasi eski natija bilan **bir xil** raqamlarni ko'rsatadi (bir necha o'quvchini qo'lda solishtirish)
- [ ] O'qituvchilar reytingi bir xil
- [ ] Sahifa ochilish vaqti kamaygan (brauzer Network tabida)

---

## 7-BOSQICH: Token va sessiya mustahkamlash

**Ma'lumotga ta'siri:** bitta YANGI jadval qo'shiladi (`refresh_tokens`) — mavjud jadvallarga tegilmaydi. Deploy paytida barcha foydalanuvchilar sessiyasi saqlanib qoladi (eski refresh tokenlar bir muddat parallel qabul qilinadi — quyida).

### 7.1. Refresh tokenlarni DB'da saqlash (revoke imkoniyati)

Yangi model:

```prisma
model RefreshToken {
  id        String   @id @default(uuid())
  userId    String
  tokenHash String   @unique          // token emas, SHA-256 hash saqlanadi
  expiresAt DateTime
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
  @@map("refresh_tokens")
}
```

`auth.service.ts` o'zgarishlari:
- `login`: refresh token yaratilganda hash'i DB'ga yoziladi.
- `refreshToken`: kelgan token hash'i DB'da bormi tekshiriladi; bor bo'lsa — eski yozuv o'chirilib yangisi yoziladi (rotation).
- Yangi `logout` endpoint: joriy refresh token yozuvini o'chirish.
- Parol almashtirilganda: o'sha userning barcha refresh tokenlarini o'chirish.

**Silliq o'tish (foydalanuvchilarni logout qilmaslik uchun):** birinchi 7 kun davomida "DB'da yo'q, lekin imzosi to'g'ri" refresh tokenlarni ham qabul qilib, shu zahoti DB'ga yozib qo'yish (grace period). 7 kundan keyin bu yo'lni yopish — shu vaqtga kelib hamma token DB'dan o'tgan bo'ladi.

### 7.2. Audit logda real IP

`auth.service.ts` login funksiyasiga `ip` parametri berilsin (controllerdan `req.ip` — 1.1-bosqichdagi trust proxy tufayli endi to'g'ri qiymat keladi) va `details: { ip }` yozilsin (hozir `'logged'` degan placeholder).

### 7.3. Settings API'da AI kalitlarini maskalash

`settings` GET endpointi Gemini/Groq kalitlarini to'liq qaytarmasin — faqat `sk-...****1234` ko'rinishida. Saqlashda: frontend bo'sh yubormasa yangilanadi, `****` bilan kelsa eski qiymat saqlanadi.

**✅ 7-bosqich tekshiruvi:**
- [ ] Login → refresh → so'rovlar ishlaydi
- [ ] Logout'dan keyin eski refresh token bilan yangi access olib bo'lmaydi
- [ ] Parol almashtirilganda boshqa qurilmadagi sessiya keyingi refresh'da uziladi
- [ ] Eski (deploy'dan oldingi) sessiyalar grace period ichida ishlashda davom etadi

---

## 8-BOSQICH: Algoritmik tuzatishlar

**Ma'lumotga ta'siri:** yo'q — hammasi hisoblash mantig'i.

### 8.1. Fisher–Yates shuffle (`exam.controller.ts` → `getRandomQuestions`)

`arr.sort(() => Math.random() - 0.5)` xolis aralashtirmaydi. O'rniga:

```ts
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// savollar: shuffle(all).slice(0, count)
// variantlar: shuffle(opts)
```

Xuddi shu pattern boshqa joylarda ham bo'lsa (`grep -rn "Math.random() - 0.5" src`), hammasini almashtirish.

### 8.2. Rank helper (kod takrori)

"1224" uslubidagi rank berish mantiqí 3 joyda takrorlangan (teachers ranking, group stats, student stats). Bitta helper:

```ts
// shared/utils/ranking.ts
export function assignRanks<T>(sorted: T[], score: (x: T) => number): (T & { rank: number })[] {
  let rank = 1, prev: number | null = null;
  return sorted.map((item, i) => {
    const s = score(item);
    if (prev !== null && s < prev) rank = i + 1; // yoki rank++ — hozirgi xatti-harakat saqlansin
    prev = s;
    return { ...item, rank };
  });
}
```

> Eslatma: hozirgi kod `rank++` (dense ranking — 1,2,2,3), standart "1224" esa `rank = i + 1`. Qaysi biri kerakligini mahsulot nuqtai nazaridan tanlang va **uchala joyda bir xil** qiling.

### 8.3. O'rtacha ball formulasini birxillashtirish

- `getTeachersRanking`: `totalScore / checkedCount` (topshiriq boshiga)
- `getTeacherStats`: `totalScore / studentsCount` (o'quvchi boshiga)

Ikki sahifa bir xil "avg" uchun har xil raqam ko'rsatadi. Bittasini tanlab (tavsiya: topshiriq boshiga), ikkinchisini moslashtirish. Bu **ko'rinadigan raqamlarni o'zgartiradi** — o'qituvchilarga oldindan aytib qo'yish kerak (ma'lumot buzilmaydi, faqat hisoblash to'g'irlanadi).

### 8.4. Mayda buglar

- `statistics.service.ts` Snayper badge: `doc:` → `desc:` (typo — badge tavsifi bo'sh chiqyapti).
- Badge/streak hisoblari bitta pass'da yig'ilsa yaxshi, lekin bu shoshilinch emas.

---

## 9-BOSQICH: Kutubxona va bundle tozalash

### 9.1. `xlsx` paketidan voz kechish

`xlsx@0.18.5` (backend + frontend) — npm versiyasida ma'lum ReDoS / prototype-pollution zaifliklari bor va npm'da patch chiqmaydi. Backendda `exceljs` allaqachon bor.

- **Backend:** `grep -rn "from 'xlsx'" src` — topilgan joylarni `exceljs`ga ko'chirish, keyin `npm uninstall xlsx`.
- **Frontend:** export/import qilinadigan joylarni `exceljs` (browser build) yoki serverdagi mavjud export endpointiga ko'chirish.

Har ko'chirishdan keyin Excel import/export'ni real fayl bilan sinash (ustunlar, sana formatlari!).

### 9.2. Frontend bundle

- Route'larni `React.lazy` + `Suspense` bilan bo'lish (ayniqsa admin panel, exam, live-quiz sahifalari).
- `npx vite-bundle-visualizer` bilan eng katta chunklarni ko'rish; `recharts` va Excel kutubxonasi lazy chunk'ga tushsin.

### 9.3. `/uploads`ni nginx orqali serve qilish (ixtiyoriy)

Express o'rniga nginx static serve qilsa backend yengillashadi. Docker setupda buning uchun uploads volume'ni frontend (nginx) konteyneriga ham ulash kerak — bu ixtiyoriy optimallashtirish, shoshilinch emas.

---

## 📅 Tavsiya etilgan jadval

| Hafta | Ishlar |
|---|---|
| 1-hafta | 1-bosqich (kod) + 2-bosqich (infra) — eng katta xavflar yopiladi |
| 2-hafta | 3-bosqich (socket) + 4-bosqich (upload) |
| 3-hafta | 5-bosqich (indekslar) + 6-bosqich (N+1) — tezlik keskin yaxshilanadi |
| 4-hafta | 7-bosqich (tokenlar) + 8-bosqich (algoritmlar) |
| Keyin | 9-bosqich (kutubxonalar) — shoshilmasdan |

## 🔄 Har deploy uchun standart protsedura

```bash
# 1. Backup
docker exec tizim_db pg_dump -U root normativ_tizim > backups/backup_$(date +%F_%H%M).sql

# 2. Demo muhitda sinash (demo.itlivescore.uz)

# 3. Asosiy tizimga deploy
git pull && docker-compose build backend frontend && docker-compose up -d

# 4. Smoke test: login, dashboard, submission yuborish/tekshirish, imtihon, live-quiz

# 5. Muammo bo'lsa — rollback:
git checkout OLDINGI_COMMIT && docker-compose build && docker-compose up -d
# (DB migratsiyalari faqat qo'shimcha bo'lgani uchun eski kod ham ishlayveradi)
```

## ✅ Yakuniy nazorat ro'yxati (hammasi tugagach)

- [ ] `trust proxy` yoqilgan, rate limit har IP uchun alohida ishlaydi
- [ ] Production'da JWT secretsiz server ko'tarilmaydi
- [ ] Socket ulanishlar JWT bilan, teacher eventlari rol bilan himoyalangan
- [ ] Fayl yuklash kengaytma whitelist bilan, `/uploads` nosniff bilan
- [ ] Postgres tashqaridan yopiq, parol kuchli, sirlar gitda yo'q
- [ ] HTTPS + security headerlar yoqilgan
- [ ] Asosiy jadvallarda indekslar bor
- [ ] Reyting/statistika sahifalari N+1'siz, sekundlar emas millisekundlarda
- [ ] Refresh tokenlar revoke qilinadi, logout haqiqiy ishlaydi
- [ ] Shuffle Fisher–Yates, avg formula birxil, badge typo tuzatilgan
- [ ] `xlsx` paketi olib tashlangan
