# 📚 O'quv Markaz Normativ Tizimi — To'liq Web Arxitektura

> **Maqsad:** O'quvchilar normativlarini kuzatish, baholash va statistika chiqarish uchun yaxlit web platforma.

---

## 1. TIZIM UMUMIY KO'RINISHI

```
┌─────────────────────────────────────────────────────────────────┐
│                    NORMATIV PLATFORM                            │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │  O'qituvchi  │    │  O'quvchi    │    │     Admin        │   │
│  │   Panel      │    │   Kabinet    │    │     Panel        │   │
│  └──────┬───────┘    └──────┬───────┘    └────────┬─────────┘   │
│         │                  │                      │             │
│  ┌──────▼──────────────────▼──────────────────────▼──────────┐  │
│  │                    REST API (Node.js/Express)             │  │
│  └─────────────────────────┬─────────────────────────────────┘  │
│                             │                                   │
│  ┌──────────────────────────▼──────────────────────────────┐    │
│  │                PostgreSQL Database                      │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. ROL TIZIMI

| Rol | Imkoniyatlar |
|-----|-------------|
| **Super Admin** | Hamma narsa: o'qituvchi qo'shish, guruh yaratish, tizim sozlamalari |
| **O'qituvchi** | Guruh boshqaruv, o'quvchi qo'shish, normativ tekshirish, ball qo'yish |
| **O'quvchi** | Normativlarni topshirish (YouTube link), o'z statistikasini ko'rish |

---

## 3. MA'LUMOTLAR BAZASI ARXITEKTURASI

### 3.1 Jadvallar (Tables)

```sql
-- FOYDALANUVCHILAR
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     VARCHAR(100) NOT NULL,
  login         VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          ENUM('admin', 'teacher', 'student') NOT NULL,
  avatar_url    TEXT,
  created_at    TIMESTAMP DEFAULT NOW(),
  is_active     BOOLEAN DEFAULT TRUE
);

-- GURUHLAR
CREATE TABLE groups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(50) NOT NULL,       -- E6, RF10, G1 kabi
  teacher_id    UUID REFERENCES users(id),
  created_at    TIMESTAMP DEFAULT NOW(),
  is_active     BOOLEAN DEFAULT TRUE
);

-- GURUH-O'QUVCHI BOG'LIQLIK
CREATE TABLE group_students (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      UUID REFERENCES groups(id) ON DELETE CASCADE,
  student_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at     TIMESTAMP DEFAULT NOW(),
  UNIQUE(group_id, student_id)
);

-- NORMATIVLAR (Funksiya/Vazifalar)
CREATE TABLE normatives (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_number   INTEGER NOT NULL,           -- N ustuni: 55, 56, 57...
  title         TEXT NOT NULL,              -- Qaysi funksiya
  description   TEXT,                       -- Nima qila olsin
  time_limit    INTEGER,                    -- Vaqti (daqiqa)
  url           TEXT,                       -- Namuna URL
  max_score     INTEGER DEFAULT 40,         -- Foiz/Ball (20, 40, 300...)
  created_at    TIMESTAMP DEFAULT NOW(),
  is_active     BOOLEAN DEFAULT TRUE
);

-- GURUH-NORMATIV BOG'LIQLIK (qaysi guruhga qaysi normativ tegishli)
CREATE TABLE group_normatives (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      UUID REFERENCES groups(id) ON DELETE CASCADE,
  normative_id  UUID REFERENCES normatives(id) ON DELETE CASCADE,
  assigned_at   TIMESTAMP DEFAULT NOW(),
  UNIQUE(group_id, normative_id)
);

-- O'QUVCHI TOPSHIRIQLARI (submissions)
CREATE TABLE submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  normative_id    UUID REFERENCES normatives(id) ON DELETE CASCADE,
  group_id        UUID REFERENCES groups(id),
  youtube_url     TEXT NOT NULL,
  submitted_at    TIMESTAMP DEFAULT NOW(),
  status          ENUM('pending', 'checked') DEFAULT 'pending',
  
  -- O'qituvchi tekshirgandan so'ng:
  checked_by      UUID REFERENCES users(id),
  checked_at      TIMESTAMP,
  result          ENUM('green', 'blue', 'red'),  -- yashil/ko'k/x
  score           INTEGER DEFAULT 0,             -- green=max_score, blue=max_score/2, red=0
  comment         TEXT,
  
  UNIQUE(student_id, normative_id, group_id)
);

-- REYTING SNAPSHOTLAR (kunlik hisoblash uchun kesh)
CREATE TABLE ranking_cache (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID REFERENCES users(id),
  group_id      UUID REFERENCES groups(id),
  total_score   INTEGER DEFAULT 0,
  completed     INTEGER DEFAULT 0,     -- bajarilgan normativlar soni
  pending       INTEGER DEFAULT 0,     -- tekshirilmagan
  rank_in_group INTEGER,
  rank_overall  INTEGER,
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- AUDIT LOG (kim nima qildi)
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  action      VARCHAR(100),
  target_type VARCHAR(50),
  target_id   UUID,
  details     JSONB,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- XABARNOMALAR
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(50),   -- 'submission_checked', 'new_normative', 'rank_changed'
  title       TEXT,
  body        TEXT,
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT NOW()
);
```

### 3.2 Ball Hisoblash Mantiq

```
Yashil (✅) = normativ.max_score ball
Ko'k   (☑) = normativ.max_score / 2 ball (yoki belgilangan foiz)
X      (❌) = 0 ball
```

---

## 4. BACKEND ARXITEKTURA

### 4.1 Texnologiya Stack

```
Runtime:     Node.js 20 LTS
Framework:   Express.js + TypeScript
ORM:         Prisma
DB:          PostgreSQL 15
Auth:        JWT (access 15min + refresh 7d)
Cache:       Redis (reyting, session)
File/Video:  YouTube URL saqlash (upload yo'q)
Excel:       ExcelJS (eksport)
Validation:  Zod
Logging:     Winston
Testing:     Jest + Supertest
```

### 4.2 Papka Tuzilmasi

```
backend/
├── src/
│   ├── config/
│   │   ├── database.ts
│   │   ├── redis.ts
│   │   └── env.ts
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.routes.ts
│   │   │   └── auth.middleware.ts
│   │   │
│   │   ├── users/
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   └── users.routes.ts
│   │   │
│   │   ├── groups/
│   │   │   ├── groups.controller.ts
│   │   │   ├── groups.service.ts
│   │   │   └── groups.routes.ts
│   │   │
│   │   ├── normatives/
│   │   │   ├── normatives.controller.ts
│   │   │   ├── normatives.service.ts
│   │   │   └── normatives.routes.ts
│   │   │
│   │   ├── submissions/
│   │   │   ├── submissions.controller.ts
│   │   │   ├── submissions.service.ts
│   │   │   └── submissions.routes.ts
│   │   │
│   │   ├── statistics/
│   │   │   ├── statistics.controller.ts
│   │   │   ├── statistics.service.ts
│   │   │   └── statistics.routes.ts
│   │   │
│   │   ├── rankings/
│   │   │   ├── rankings.controller.ts
│   │   │   ├── rankings.service.ts
│   │   │   └── rankings.routes.ts
│   │   │
│   │   └── export/
│   │       ├── export.controller.ts
│   │       ├── export.service.ts        -- Excel, PDF eksport
│   │       └── export.routes.ts
│   │
│   ├── shared/
│   │   ├── middleware/
│   │   │   ├── errorHandler.ts
│   │   │   ├── rateLimiter.ts
│   │   │   └── roleGuard.ts
│   │   ├── utils/
│   │   │   ├── pagination.ts
│   │   │   ├── scoreCalculator.ts
│   │   │   └── youtubeValidator.ts
│   │   └── types/
│   │
│   └── app.ts
├── prisma/
│   └── schema.prisma
└── package.json
```

### 4.3 API Endpoints

```
AUTH
  POST   /api/auth/login              -- Login (barcha rollar)
  POST   /api/auth/refresh            -- Token yangilash
  POST   /api/auth/logout             -- Chiqish

USERS (Admin/Teacher)
  GET    /api/users                   -- Barcha foydalanuvchilar (admin)
  POST   /api/users                   -- Yangi foydalanuvchi (admin)
  GET    /api/users/:id               -- Profil
  PUT    /api/users/:id               -- Tahrirlash
  DELETE /api/users/:id               -- O'chirish
  POST   /api/users/bulk              -- Ko'plab import (Excel)

GROUPS (Teacher/Admin)
  GET    /api/groups                  -- Barcha guruhlar
  POST   /api/groups                  -- Guruh yaratish
  GET    /api/groups/:id              -- Guruh ma'lumoti
  PUT    /api/groups/:id              -- Tahrirlash
  POST   /api/groups/:id/students     -- O'quvchi qo'shish
  DELETE /api/groups/:id/students/:sid-- O'quvchini chiqarish
  GET    /api/groups/:id/stats        -- Guruh statistikasi
  GET    /api/groups/:id/ranking      -- Guruh reytingi

NORMATIVES
  GET    /api/normatives              -- Barcha normativlar
  POST   /api/normatives              -- Yangi normativ (admin/teacher)
  GET    /api/normatives/:id          -- Bitta normativ
  PUT    /api/normatives/:id          -- Tahrirlash
  POST   /api/groups/:id/normatives   -- Guruhga normativ biriktirish

SUBMISSIONS
  GET    /api/submissions             -- Tekshirilmagan list (teacher)
  POST   /api/submissions             -- Topshirish (student)
  GET    /api/submissions/:id         -- Bitta submission
  PATCH  /api/submissions/:id/check   -- Baholash: green/blue/red (teacher)
  GET    /api/submissions/student/:id -- O'quvchi topshiriqlari

STATISTICS
  GET    /api/stats/overview          -- Umumiy (admin)
  GET    /api/stats/teacher           -- O'qituvchi statistikasi
  GET    /api/stats/group/:id         -- Guruh statistikasi
  GET    /api/stats/student/:id       -- O'quvchi statistikasi

RANKINGS
  GET    /api/rankings/overall        -- Umumiy reyting
  GET    /api/rankings/group/:id      -- Guruh reytingi

EXPORT
  GET    /api/export/group/:id        -- Excel (guruh natijalari)
  GET    /api/export/overview         -- Excel (umumiy hisobot)
  GET    /api/export/student/:id      -- Excel (bitta o'quvchi)

NOTIFICATIONS
  GET    /api/notifications           -- Xabarnomalar
  PATCH  /api/notifications/:id/read  -- O'qildi deb belgilash
```

---

## 5. FRONTEND ARXITEKTURA

### 5.1 Texnologiya Stack

```
Framework:    React 18 + TypeScript + Vite
State:        Zustand (global) + React Query (server state)
UI Library:   shadcn/ui + Tailwind CSS
Charts:       Recharts
Tables:       TanStack Table
Form:         React Hook Form + Zod
HTTP:         Axios + interceptors
Icons:        Lucide React
Excel:        SheetJS (eksport preview)
```

### 5.2 Papka Tuzilmasi

```
frontend/
├── src/
│   ├── pages/
│   │   ├── auth/
│   │   │   └── LoginPage.tsx
│   │   │
│   │   ├── admin/
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── UsersPage.tsx
│   │   │   ├── GroupsPage.tsx
│   │   │   └── NormativesPage.tsx
│   │   │
│   │   ├── teacher/
│   │   │   ├── DashboardPage.tsx       -- Umumiy statistika
│   │   │   ├── GroupsPage.tsx          -- Guruhlar ro'yxati
│   │   │   ├── GroupDetailPage.tsx     -- Guruh ichidagi o'quvchilar
│   │   │   ├── PendingPage.tsx         -- Tekshirilmagan topshiriqlar
│   │   │   ├── StudentProfilePage.tsx  -- O'quvchi profili
│   │   │   └── ExportPage.tsx          -- Excel eksport
│   │   │
│   │   └── student/
│   │       ├── DashboardPage.tsx       -- Profil + reyting
│   │       ├── NormativesPage.tsx      -- Normativlar ro'yxati
│   │       ├── SubmitPage.tsx          -- YouTube link topshirish
│   │       └── HistoryPage.tsx         -- Topshirilgan ishlar
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── AppLayout.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   ├── StatsCard.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   ├── ScoreChart.tsx          -- Recharts
│   │   │   └── ActivityFeed.tsx
│   │   │
│   │   ├── groups/
│   │   │   ├── GroupCard.tsx
│   │   │   ├── GroupTable.tsx
│   │   │   └── StudentRankTable.tsx
│   │   │
│   │   ├── normatives/
│   │   │   ├── NormativeCard.tsx
│   │   │   ├── NormativeList.tsx
│   │   │   └── SubmitModal.tsx         -- YouTube link modal
│   │   │
│   │   ├── submissions/
│   │   │   ├── PendingCard.tsx         -- O'qituvchi tekshirish UI
│   │   │   ├── YoutubeEmbed.tsx        -- Preview
│   │   │   └── CheckButtons.tsx        -- Yashil/Ko'k/X tugmalar
│   │   │
│   │   ├── rankings/
│   │   │   ├── RankBadge.tsx           -- 🥇🥈🥉
│   │   │   └── LeaderBoard.tsx
│   │   │
│   │   └── shared/
│   │       ├── ScoreBadge.tsx          -- yashil/ko'k/qizil rang
│   │       ├── ExportButton.tsx
│   │       ├── NotificationBell.tsx
│   │       └── ConfirmModal.tsx
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useGroups.ts
│   │   ├── useSubmissions.ts
│   │   ├── useRanking.ts
│   │   └── useNotifications.ts
│   │
│   ├── stores/
│   │   ├── authStore.ts
│   │   └── notificationStore.ts
│   │
│   ├── api/
│   │   ├── client.ts                   -- Axios instance
│   │   ├── auth.api.ts
│   │   ├── groups.api.ts
│   │   ├── normatives.api.ts
│   │   ├── submissions.api.ts
│   │   ├── statistics.api.ts
│   │   └── export.api.ts
│   │
│   └── utils/
│       ├── scoreUtils.ts
│       └── formatters.ts
└── package.json
```

---

## 6. SAHIFALAR VA FUNKSIYALAR (BATAFSIL)

### 6.1 O'QITUVCHI PANELI

#### `/teacher/dashboard` — Bosh Sahifa
```
┌─────────────────────────────────────────────────────┐
│  Umumiy Ko'rsatkichlar                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ Guruhlar │ │O'quvchil.│ │Topshirilg│ │Tekshir-│ │
│  │    8     │ │   120    │ │   450    │ │magan 23│ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│                                                     │
│  Guruhlar bo'yicha statistika (Bar Chart)           │
│  ┌─────────────────────────────────────────────┐   │
│  │  E6 ████████████ 78%                        │   │
│  │  RF10 ██████████ 65%                        │   │
│  │  G1 ████████ 52%                            │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  So'nggi faoliyat (topshiriqlar, tekshirishlar)     │
└─────────────────────────────────────────────────────┘
```

#### `/teacher/groups/:id` — Guruh Sahifasi
```
┌─────────────────────────────────────────────────────┐
│  E6 Guruhi  [Excel Eksport ↓]  [O'quvchi Qo'sh +]  │
│                                                     │
│  Guruh statistikasi:                                │
│  O'rtacha ball: 187 | Eng yaxshi: Alisher 340       │
│  Bajarilgan normativlar: 24/30                      │
│                                                     │
│  ┌─────┬───────────────┬────────┬────────┬───────┐  │
│  │ # │ O'quvchi      │ Ball   │Bajaril.│ O'rin │  │
│  ├─────┼───────────────┼────────┼────────┼───────┤  │
│  │ 🥇 │ Alisher A.   │  340   │  28/30 │   1   │  │
│  │ 🥈 │ Bobur M.     │  285   │  24/30 │   2   │  │
│  │    │ ...           │  ...   │   ...  │  ...  │  │
│  └─────┴───────────────┴────────┴────────┴───────┘  │
│                                                     │
│  [O'quvchiga bosing → uning profili ochiladi]       │
└─────────────────────────────────────────────────────┘
```

#### `/teacher/pending` — Tekshirilmagan Topshiriqlar
```
┌─────────────────────────────────────────────────────┐
│  Tekshirilmagan: 23 ta  [Guruh bo'yicha filter ▼]  │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 👤 Alisher Abdusalomov • E6 guruhi           │   │
│  │ 📋 Normativ #55: Header komponent            │   │
│  │ 🕐 30 daqiqa • Topshirildi: 2 soat oldin    │   │
│  │                                             │   │
│  │ ▶ [YouTube Preview thumbnailі]              │   │
│  │   youtube.com/watch?v=xxxxx                 │   │
│  │                                             │   │
│  │  [✅ Yashil]  [☑ Ko'k]  [❌ X]  [💬 Izoh]  │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  [Keyingi karta...]                                 │
└─────────────────────────────────────────────────────┘
```

#### `/teacher/student/:id` — O'quvchi Profili (O'qituvchi ko'radi)
```
┌─────────────────────────────────────────────────────┐
│  👤 Alisher Abdusalomov                             │
│  📊 Umumiy o'rin: #3 | E6 guruhida: #1             │
│  🏆 Jami ball: 340 | Bajarilgan: 28/30             │
│                                                     │
│  Progress: ████████████████░░░ 93%                 │
│                                                     │
│  Normativlar natijalari:                            │
│  ┌────┬──────────────────────────┬───────┬───────┐  │
│  │ N  │ Normativ                 │ Ball  │Natija │  │
│  ├────┼──────────────────────────┼───────┼───────┤  │
│  │ 55 │ Header komponent        │  40   │  🟢   │  │
│  │ 56 │ Pricing card            │  12   │  🔵   │  │
│  │ 57 │ Pricing section         │  ...  │  ❌   │  │
│  └────┴──────────────────────────┴───────┴───────┘  │
└─────────────────────────────────────────────────────┘
```

---

### 6.2 O'QUVCHI KABINETI

#### `/student/dashboard` — O'quvchi Bosh Sahifasi
```
┌─────────────────────────────────────────────────────┐
│  Salom, Alisher! 👋                                 │
│                                                     │
│  ┌────────────────┐    ┌────────────────────────┐   │
│  │ Umumiy o'rin   │    │  Guruhda (E6) o'rin    │   │
│  │      #3        │    │          #1            │   │
│  │  120 nafar     │    │   24 nafar ichida       │   │
│  │  orasida       │    │                        │   │
│  └────────────────┘    └────────────────────────┘   │
│                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │  Jami    │ │Bajarilg. │ │Kutilmoq. │            │
│  │ 340 ball │ │  28/30   │ │    2     │            │
│  └──────────┘ └──────────┘ └──────────┘            │
│                                                     │
│  Ball dinamikasi (chiziqli grafik, oxirgi 30 kun)   │
│                                                     │
│  Guruh Reytingi (Top 5)                             │
│  1. 🥇 Men (340)                                   │
│  2. Bobur (285)                                     │
│  3. ...                                             │
└─────────────────────────────────────────────────────┘
```

#### `/student/normatives` — Normativlar Ro'yxati
```
┌─────────────────────────────────────────────────────┐
│  Mening Normativlarim  [Holat ▼] [Qidiruv 🔍]      │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ ✅ #55 — Header komponent           [40 b]  │   │
│  │    Topshirildi | Tekshirildi | Yashil       │   │
│  │    [Natijani ko'r →]                        │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 🔵 #56 — Pricing card               [12 b]  │   │
│  │    Topshirildi | Tekshirildi | Ko'k         │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ ⏳ #57 — Pricing section            [?? b]  │   │
│  │    Topshirildi | Tekshirilmoqda...          │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 📋 #58 — Footer section             [16 b]  │   │
│  │    Topshirilmagan                           │   │
│  │    [Topshirish →]                           │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

#### Topshirish Modal (YouTube link)
```
┌─────────────────────────────────────────────────────┐
│  📤 #58 — Footer section ni topshirish             │
│                                                     │
│  YouTube havola:                                    │
│  ┌───────────────────────────────────────────────┐ │
│  │ https://youtube.com/watch?v=...               │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  Preview:  [YouTube thumbnail ko'rsatiladi]         │
│                                                     │
│  ⚠️ Diqqat: Topshirganingizdan so'ng o'qituvchi    │
│  tekshiradi. Natija 24 soat ichida keladi.         │
│                                                     │
│  [Bekor qilish]              [✅ Topshirish]        │
└─────────────────────────────────────────────────────┘
```

---

### 6.3 ADMIN PANELI

#### `/admin/dashboard`
- Barcha o'qituvchilar statistikasi
- Barcha guruhlar ko'rsatkichi
- Platforma faolligi (topshiriqlar grafigi)
- Oxirgi 7/30 kun filteri

#### `/admin/normatives`
- Normativlar CRUD
- Guruhlarga mass biriktirish
- Normativ nusxalash (yangi guruhga)
- Import/Export (Excel orqali)

---

## 7. EXCEL EKSPORT TUZILMASI

### Guruh natijalari (`.xlsx`)

**Sheet 1: Umumiy ko'rinish**
| O'quvchi | Jami ball | Bajarilgan | Kutilmoqda | O'rin |
|----------|-----------|------------|------------|-------|
| Alisher  | 340       | 28         | 0          | 1     |

**Sheet 2: Normativlar bo'yicha (har bir o'quvchi)**
| O'quvchi | N55 | N56 | N57 | ... | Jami |
|----------|-----|-----|-----|-----|------|
| Alisher  | 🟢  | 🔵  | ❌  |     | 340  |

**Sheet 3: Topshiriq tarixi**
| Sana | O'quvchi | Normativ | Natija | Ball | O'qituvchi |
|------|----------|----------|--------|------|------------|

---

## 8. REAL-TIME XUSUSIYATLAR (WebSocket)

```javascript
// Socket.io orqali:
socket.on('submission:new', (data) => {
  // O'qituvchiga yangi topshiriq tushdi xabari
  showNotification(`${data.studentName} - ${data.normativTitle}`)
})

socket.on('submission:checked', (data) => {
  // O'quvchiga natija keldi
  showResult(data.result, data.score)
  updateDashboard()
})

socket.on('ranking:updated', (data) => {
  // Reyting o'zgarganda barcha guruh a'zolariga
  refreshLeaderboard()
})
```

---

## 9. DEPLOYMENT ARXITEKTURA

```
Production:
├── Frontend       → Vercel / Netlify
├── Backend API    → Railway / Render / VPS
├── Database       → Supabase PostgreSQL / Neon
├── Redis Cache    → Upstash Redis
└── File Storage   → (kerak emas, faqat YouTube URL)

Development:
└── Docker Compose (postgres + redis + api + frontend)
```

---

## 10. XAVFSIZLIK

```
✅ JWT + Refresh Token rotation
✅ Rate limiting (login: 5/min, API: 100/min)
✅ Role-based access control (RBAC)
✅ YouTube URL validation (faqat haqiqiy YouTube linki)
✅ SQL injection → Prisma ORM
✅ XSS → React (avtomatik escape)
✅ CORS konfiguratsiya
✅ Password hashing (bcrypt, salt rounds: 12)
✅ Audit log (kim nima qildi)
```

---

## 11. QOSHIMCHA FUNKSIYALAR (Tavsiya etiladi)

| Funksiya | Tavsif |
|----------|--------|
| 📱 **PWA** | Mobil qurilmada ham ishlaydi |
| 🔔 **Push Notification** | Browser push (natija kelganda) |
| 📊 **Progress Chart** | O'quvchi vaqt bo'yicha o'sishi |
| 🎯 **Milestone** | 100, 200, 300 ballga yetganda badge |
| 📅 **Deadline** | Normativga muddat belgilash |
| 💬 **Izoh** | O'qituvchi tekshirganda izoh qoldirishi |
| 🔄 **Qayta topshirish** | Ko'k/qizil olganda qayta urinish imkoni |
| 📈 **Guruh tendensiyasi** | Haftalik/oylik o'sish grafigi |
| 🏆 **Leaderboard** | Umumiy reyting (o'quv markaz bo'yicha) |
| 📥 **Bulk Import** | Excel orqali o'quvchilarni import qilish |

---

## 12. BOSQICHLI ISHLAB CHIQISH REJASI

```
BOSQICH 1 — Asos (2-3 hafta)
  ✓ DB schema va migration
  ✓ Auth tizimi (login/register)
  ✓ Guruhlar va o'quvchilar CRUD
  ✓ Normativlar CRUD

BOSQICH 2 — Core funksiya (2-3 hafta)
  ✓ Topshirish (YouTube link)
  ✓ Tekshirish (green/blue/red)
  ✓ Ball hisoblash
  ✓ O'quvchi kabineti

BOSQICH 3 — Statistika va UI (1-2 hafta)
  ✓ Statistika sahifalari
  ✓ Reyting tizimi
  ✓ Grafik va chartlar

BOSQICH 4 — Export va qo'shimcha (1 hafta)
  ✓ Excel eksport
  ✓ Xabarnomalar
  ✓ Real-time (WebSocket)
  ✓ PWA

BOSQICH 5 — Test va deployment
  ✓ Unit + Integration testlar
  ✓ Production deployment
  ✓ Monitoring
```

---

## 13. TEXNOLOGIYA TANLOV ASOSLASH

| Tanlov | Alternativ | Sabab |
|--------|-----------|-------|
| React | Vue, Svelte | Katta ekosistema, team-da ko'p tanish |
| PostgreSQL | MongoDB | Munosabatli ma'lumotlar (guruh-o'quvchi-normativ) |
| Prisma | TypeORM | Type-safety, migration qulay |
| Zustand | Redux | Oddiy, boilerplate kam |
| React Query | SWR | Caching, refetch, background sync |
| ExcelJS | xlsx | Server-side Excel, ko'p funksiya |
| Socket.io | SSE | Ikki tomonlama real-time |

---

*Arxitektura: O'quv Markaz Normativ Tizimi v1.0*
*Tayyorlangan: 2025*
