# IT Live Score — MCP connector (Claude)

Claude (claude.ai, Claude Desktop, Claude Code) shu connector orqali IT Live Score ma'lumotlarini
**tahlil qiladi** va admin ruxsat bersa **boshqaradi**: guruh ochish, o'quvchini o'tkazish,
normativ biriktirish va h.k. Oddiy **Pro** tarif yetarli, chunki custom connector'lar Pro'da bor.

```
claude.ai ──HTTPS──▶ Cloudflare ──▶ server nginx ──▶ frontend nginx ──▶ backend :5000
                                                     (/mcp, /.well-known/oauth-*)   │
   OAuth 2.1 (PKCE + DCR)  ◀── login/rozilik sahifasi (admin login + parol) ────────┤
   POST /mcp (Bearer)      ──▶ McpServer (har so'rovga yangi, token egasi nomidan) ─┤
                                 ├─ o'qish amallari (ils:read)  → Prisma            │
                                 ├─ SQL tahlil (READ ONLY tx)   → Postgres          │
                                 └─ boshqarish (ils:write)      → panel servislari  │
                                                                 → audit_logs ──────┘
```

## Ulash (admin, bir marta)

1. **claude.ai → Settings → Connectors → Add custom connector**
   - Name: `IT Live Score`
   - URL: `https://itlivescore.uz/mcp`. Bu manzil panelda ham bor: **Sozlamalar → Claude (MCP connector)**.
   - *Advanced settings* bo'sh qoladi, chunki Claude o'zini avtomatik ro'yxatdan o'tkazadi.
2. **Connect** ni bosing. IT Live Score sahifasi ochiladi: admin login va parolini kiriting, keyin huquqni tanlang:
   - **To'liq boshqaruv** (`ils:read ils:write`): standart tanlov, 45 amal.
   - **Faqat o'qish va tahlil** (`ils:read`).

   Huquqni mijoz emas, admin tanlaydi. claude.ai ulanishda ham, token yangilanishida ham faqat `ils:read` so'raydi, lekin admin bergan huquq saqlanib qoladi.
3. Chatda **"Search and tools"** menyusidan IT Live Score'ni yoqing.

Boshqa mijozlar:
- **Claude Desktop:** Settings → Connectors (yuqoridagi bilan bir xil).
- **Claude Code:**
  ```bash
  claude mcp add --transport http it-live-score https://itlivescore.uz/mcp
  ```
  Keyin `/mcp` buyrug'i bilan login qiling.
- **Lokal stdio** (faqat o'qish, bazaga to'g'ridan-to'g'ri): pastda yozilgan.

Huquqni o'zgartirish uchun connector'ni uzing (Disconnect) va qayta ulang.

## Amallar

### O'qish va tahlil (`ils:read`)

| Amal | Nima beradi |
| --- | --- |
| `ils_whoami` | Kim ulangan, huquqlar, server vaqti (Toshkent) |
| `ils_overview` | KPI: guruh, o'quvchi, ustoz soni, guruhsizlar, tekshirilmagan normativlar (3 kundan eskilari bilan), 7 va 30 kunlik dinamika, kechikkan va yaqin bosqichlar, muzlatishlar, murojaatlar, imtihonlar |
| `ils_list_groups` | Guruhlar: ustoz, faol o'quvchilar, normativlar, tekshirilmaganlar, jadval, eng yaqin bosqich |
| `ils_group_report` | Bitta guruh: har o'quvchining normativ natijasi (yashil/ko'k/qizil/kutilmoqda/topshirmagan, bajarish %), davomat va baholar, bosqichlar, imtihonlar |
| `ils_find_users` | Ism yoki login bo'yicha qidiruv, rol va faollik filtri, guruhsiz o'quvchilar |
| `ils_student_report` | O'quvchi: normativlar, dars baholari, davomat, imtihonlar, coin, muzlatishlar, murojaatlar, reyting |
| `ils_teacher_report` | Ustoz: guruhlari, tekshirish navbati va tezligi (o'rtacha va median, soatda), darslari, kechikkan bosqichlar, o'quvchilar bahosi |
| `ils_list_normatives` | Normativlar va natijalar taqsimoti (yashil %) |
| `ils_list_submissions` | Topshiriqlar: holat, rang, guruh, normativ, o'quvchi, sana oralig'i bo'yicha filtr |
| `ils_milestones` | Demo day va imtihon bosqichlari: kechikkan, yaqin, ochiq yoki hammasi |
| `ils_exams` | Imtihonlar, qatnashchilar, o'rtacha ballar |
| `ils_audit_log` | Kim, qachon, nima qilgan (MCP amallari `mcp.` bilan boshlanadi) |
| `ils_db_schema` | Jadval va ustunlar (haqiqiy snake_case nomlar), FK, enum'lar |
| `ils_sql_query` | Bitta `SELECT`/`WITH` so'rovi, faqat o'qish rejimida: 8 soniya, ko'pi bilan 1000 qator |
| `ils_get_record` | Istalgan jadvaldan bitta yozuv, barcha ustunlari bilan (maxfiylar yashirilgan) |
| `ils_get_permissions` | Xodim ruxsatlari katalogi va xodimning hozirgi ruxsatlari |

### Boshqarish (`ils:write`) — 29 amal

Bu amallar faqat yozish huquqi bilan ulanganda ko'rinadi. Hammasi panel servislari orqali ishlaydi.

| Soha | Amallar |
| --- | --- |
| Guruhlar | `ils_create_group`, `ils_update_group`, `ils_group_lifecycle` ⚠️ (graduate / ungraduate / archive / restore) |
| O'quvchi ↔ guruh | `ils_add_students_to_group`, `ils_remove_student_from_group` ⚠️, `ils_transfer_student` ⚠️ |
| Foydalanuvchilar | `ils_create_user` (vaqtinchalik parol bilan, guruhga qo'shish mumkin), `ils_update_user` (ism, login, rol, filial), `ils_reset_password` ⚠️, `ils_set_user_active` ⚠️, `ils_restore_user` |
| Ruxsatlar | `ils_set_permissions` ⚠️ (xodimning to'liq ruxsatlar ro'yxati) |
| Normativlar | `ils_create_normative`, `ils_update_normative`, `ils_assign_normatives`, `ils_check_submission` 📨, `ils_allow_resubmit` |
| Darslar | `ils_grade_lesson` (uy vazifasi, faollik, coin; muddatdan keyin ham), `ils_unlock_lesson` |
| Bosqichlar | `ils_set_milestone_date`, `ils_mark_milestone_held` |
| Muzlatish | `ils_freeze_student`, `ils_unfreeze` ⚠️ |
| Murojaatlar | `ils_reply_appeal` 📨, `ils_set_appeal_status` |
| Do'kon | `ils_shop_order` (fulfill / cancel — bekor qilinsa coin qaytadi) |
| Xabar | `ils_send_notification` (panel ichida: foydalanuvchilar, guruh yoki rol) |
| **Qo'lda tuzatish** | `ils_record_change` ⚠️ (istalgan jadval: update / create / delete), `ils_undo_change` ⚠️ |

Belgilar:
- ⚠️ — `destructiveHint`: Claude bajarishdan oldin alohida tasdiq so'raydi.
- 📨 — tashqariga xabar ketadi: ota-onaga Telegram (`ils_check_submission` da o'quvchiga panel bildirishnomasi ham).

#### Qo'lda tuzatish (`ils_record_change`) qanday ishlaydi

Bu maxsus amal yo'q tuzatishlar uchun, masalan noto'g'ri yozilgan ball, sana yoki izoh.

1. **Ko'rinish.** `confirmToken` siz chaqiriladi va **"oldin → keyin"** jadvali hamda `confirmToken` qaytadi. Bu bosqichda baza o'zgarmaydi. Claude buni sizga ko'rsatadi.
2. **Qo'llash.** Xuddi shu argumentlar `confirmToken` bilan qayta yuboriladi.
   - Kod 10 daqiqa amal qiladi.
   - Kod faqat aynan shu admin, jadval, yozuv va o'zgarish uchun yaroqli.
   - Ko'rinishdan keyin yozuv panelda o'zgargan bo'lsa, rad etiladi.
3. **Qaytarish.** Natijada `auditId` bo'ladi. `ils_undo_change` uni audit jurnalidagi "oldin" holatiga qaytaradi:
   - update → eski qiymatlar;
   - create → o'chirish;
   - delete → aynan o'sha ID bilan qayta tiklash.

   Yozuv keyin yana o'zgargan bo'lsa yoki allaqachon qaytarilgan bo'lsa, undo to'xtaydi.

Cheklovlar (imtiyoz oshirish va ko'rinmas yo'qotishga qarshi):
- **Yopiq jadvallar:** `mcp_oauth_*`, `audit_logs` (o'zgarmas), `user_permissions` (o'rniga `ils_set_permissions`).
- **Yopiq ustunlar:** parol, token, xesh, `id` va `created_at`. `users` jadvalida faqat ism, login, bio, filial, avatar, faollik va rol o'zgaradi.
- **Admin:** admin akkauntini tahrirlab bo'lmaydi, hech kimni admin qilib bo'lmaydi, o'z akkauntingizni ham o'zgartirib bo'lmaydi. Bu barcha amallarga tegishli.
- **O'chirish** faqat bog'liq yozuvlari yo'q ("barg") jadvallarda ishlaydi. Guruh kabi jadvallar uchun `ils_group_lifecycle archive` ishlatiladi.
- **Biznes izchilligi:** guruhning jadval maydonlari o'zgarsa, bosqichlar avtomatik qayta quriladi.

Yozish amallari haqida:
- Argumentlar panelning o'z zod sxemalari bilan qayta tekshiriladi.
- Har bir chaqiruv, muvaffaqiyatsizi ham, `audit_logs` ga `mcp.<amal>` sifatida yoziladi. Qo'lda tuzatishlarda to'liq "oldin/keyin" ham saqlanadi.
- **Vaqtinchalik parollar** (`ils_create_user`, `ils_reset_password`) faqat bitta javobda chiqadi. Ular foydalanuvchiga yetkaziladi, u kirgach parolni almashtirishi kerak.
- Ataylab **yo'q:** foydalanuvchini butunlay o'chirish (faqat nofaol qilish) va savatni bo'shatish.

## Xavfsizlik modeli

**Kim ulana oladi**
- Faqat `admin` roli (`mcpConfig.allowedRoles`).
- Parol faqat bizning sahifada tekshiriladi, Claude'ga u hech qachon berilmaydi.

**OAuth 2.1**
- PKCE (S256) majburiy.
- Avtorizatsiya kodi 5 daqiqa yashaydi va faqat bir marta ishlatiladi. Qayta ishlatilsa, shu kod bilan berilgan tokenlar bekor qilinadi.
- Access token 1 soat, refresh token 30 kun amal qiladi.
- Refresh har ishlatilganda almashadi (rotation). Bekor qilingan refresh qayta kelsa, mijoz va foydalanuvchining barcha tokenlari yopiladi (o'g'irlik belgisi).

**Redirect allowlist**
- Ochiq DCR bo'lgani uchun `redirect_uri` faqat `claude.ai`, `claude.com` va loopback (`localhost`, `127.0.0.1`) bo'lishi mumkin. Aks holda begona sayt adminni bizning haqiqiy login sahifamizga yuborib, kodni o'ziga olib qo'yishi mumkin edi.
- Qo'shimcha hostlar `MCP_ALLOWED_REDIRECT_HOSTS` orqali beriladi.

**Bazada saqlash**
- Kod va tokenlarning faqat **SHA-256 xeshi** saqlanadi.
- Har so'rovda tekshiriladi: foydalanuvchi faolmi, hali adminmi va `users.token_version` mos keladimi.
- Shuning uchun admin parolini almashtirish yoki uni nofaol qilish uning barcha Claude ulanishlarini darhol to'xtatadi.

**Rozilik sahifasi**
- So'rov parametrlari HMAC bilan imzolanadi. Kalit `JWT_SECRET` dan *hosil qilinadi*, shuning uchun imzo API tokeni sifatida o'tmaydi.
- `client_name` escape qilinadi.
- CSP: skript yo'q, `frame-ancestors 'none'`.
- Login urinishlari: bir IP'dan 10 daqiqada 10 ta.

**SQL amali**

Himoya bir necha qatlamdan iborat:
1. So'rov `SELECT * FROM (<sql>) q LIMIT n` ichiga o'raladi.
2. `SET TRANSACTION READ ONLY`.
3. `statement_timeout` 8 soniya.
4. Fayl o'qish, `query_to_xml` va `set_config` kabi xavfli funksiyalar ro'yxat bo'yicha rad etiladi.
5. `mcp_oauth_*` jadvallari yopiq.
6. Natijada parol xeshi va tokenlar **ustun nomi bo'yicha ham, qiymat ichida ham** yashiriladi (`row::text` kabi aylanma yo'llar uchun).
7. Har bir so'rov audit jurnaliga yoziladi.

**Prompt-injection**
- O'quvchi izohi yoki ota-ona murojaati ichidagi matn buyruq emas. Bu server ko'rsatmalarida va har bir yozish amali tavsifida aytilgan.
- Yozish amallari `readOnlyHint: false` bilan belgilangan, shuning uchun Claude ularni foydalanuvchi tasdig'isiz bajarmaydi.

**Ma'lumot oqimi**
- Claude'ga yuborilgan javoblar Anthropic serverlarida qayta ishlanadi.
- Amallar kerakli maydonlarni qaytaradi: telefon va Telegram ID yo'q. Shunga qaramay, shaxsiy ma'lumotlarni kerakidan ortiq so'ramang.

### Kuchaytirish: faqat o'qish huquqli Postgres foydalanuvchisi (tavsiya)

SQL amali alohida, faqat o'qish huquqli rol orqali ishlashi uchun serverda bir marta bajariladi.
Parolni o'zingiz yarating va uni hech qayerga yozmang (chatga ham):

```sql
CREATE ROLE ils_mcp_ro LOGIN PASSWORD '<kuchli-parol>';
GRANT CONNECT ON DATABASE normativ_tizim TO ils_mcp_ro;
GRANT USAGE ON SCHEMA public TO ils_mcp_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ils_mcp_ro;
REVOKE SELECT ON mcp_oauth_clients, mcp_oauth_codes, mcp_oauth_tokens FROM ils_mcp_ro;
REVOKE SELECT (password_hash) ON users FROM ils_mcp_ro;  -- ustun darajasida
```

> Ustun darajasidagi `REVOKE` jadval darajasidagi `GRANT` ni bekor qilmaydi. To'liq yopish uchun
> `users` jadvalini `GRANT SELECT (id, full_name, login, role, ...) ON users` bilan alohida bering.

Keyin `backend/.env` ga quyidagini qo'shing (u faqat SQL amali uchun ishlatiladi):

```
MCP_SQL_DATABASE_URL=postgresql://ils_mcp_ro:<parol>@db:5432/normativ_tizim
```

## Muhit o'zgaruvchilari

| O'zgaruvchi | Standart | Vazifa |
| --- | --- | --- |
| `MCP_ENABLED` | `true` | `false` bo'lsa, barcha MCP yo'llari 404 qaytaradi (favqulodda o'chirish) |
| `MCP_PUBLIC_URL` | prod: `https://itlivescore.uz` | Tashqi manzil (issuer va resource shundan quriladi) |
| `MCP_ALLOWED_REDIRECT_HOSTS` | — | Qo'shimcha redirect hostlari, vergul bilan |
| `MCP_SQL_DATABASE_URL` | — | SQL amali uchun faqat o'qish huquqli ulanish |
| `ITLIVE_MCP_DATABASE_URL` | — | Lokal stdio rejimi uchun alohida ulanish |

## Boshqaruv

- **Ulanishlar:** panel → **Sozlamalar → Claude (MCP connector)**. Bu yerda kim, qaysi huquq bilan ulangani va oxirgi faolligi ko'rinadi, **Uzish** va **Hammasini uzish** tugmalari bor.
- **API (admin):**
  - `GET /api/mcp/connections`
  - `DELETE /api/mcp/connections/:clientId:userId`
  - `DELETE /api/mcp/connections`
- **Audit:** `ils_audit_log` amali yoki `audit_logs` jadvalida `action LIKE 'mcp.%'`.

## Lokal stdio rejimi (ixtiyoriy)

Claude Desktop yoki Claude Code o'z kompyuteringizdagi bazaga to'g'ridan-to'g'ri ulanadi.
Bu rejimda faqat o'qish va SQL amallari bor, yozish amallari yo'q.

```bash
cd backend && npm run build
claude mcp add it-live-local -- node "<to'liq yo'l>/backend/dist/mcp/main.js"
```

- Bu rejimda stdout faqat protokolga ajratilgan, barcha loglar stderr'ga yo'naltiriladi.
- Ulanish `backend/.env` dagi `DATABASE_URL` yoki `ITLIVE_MCP_DATABASE_URL` orqali bo'ladi.

## Testlar

```bash
cd backend
npm run test:mcp   # build + unit: SQL validator, redaction, redirect allowlist, imzo, huquq bo'yicha amallar
npm run smoke:mcp  # stdio jarayoni: amallar ro'yxati + jonli so'rov (lokal baza)
npm run e2e:mcp    # to'liq OAuth oqimi + 45 amal + qo'lda tuzatish/undo + SQL himoyasi + rotation + uzish (143 tekshiruv)
```

`e2e:mcp` lokal bazada `mcpe2e-` belgili fixture'lar yaratadi va oxirida o'chiradi. Uni prod bazaga qarshi **ishga tushirmang**.

## Muammolar

| Belgi | Sabab va yechim |
| --- | --- |
| Claude: "couldn't connect" / 403 | Cloudflare **Bot Fight Mode** yoki WAF Anthropic serverlarini to'symoqda. Cloudflare'da `/mcp*` va `/.well-known/oauth-*` uchun skip qoidasi qo'shing |
| Login'dan keyin qaytadan login so'raladi | Admin paroli yoki roli o'zgargan (`token_version`). Qayta ulaning |
| "Bu ulanishga faqat o'qish huquqi berilgan" | Uzing va "O'qish va boshqarish" bilan qayta ulaning |
| `redirect_uri ruxsat etilmagan` | Mijoz claude.ai/claude.com/localhost emas. Kerak bo'lsa `MCP_ALLOWED_REDIRECT_HOSTS` |
| Hammasi 404 | `MCP_ENABLED=false` yoki frontend nginx'da `/mcp` bloki yo'q (`frontend/nginx.conf`) |

## Fayllar

```
backend/src/mcp/
  config.ts              manzillar, TTL, scope, redirect allowlist
  context.ts             McpActor, javob/xato formati, audit, redaction, sana
  server.ts              McpServer + ko'rsatmalar; amallar huquqqa qarab ro'yxatga olinadi
  tools/read.ts          tahlil amallari
  tools/sql.ts           ils_db_schema + ils_sql_query
  tools/write.ts         boshqarish 1: guruh, o'quvchi, normativ, bosqich (+ guarded qobig'i)
  tools/manage.ts        boshqarish 2: baholash, foydalanuvchi/parol, ruxsat, dars, muzlatish, murojaat, do'kon, xabar
  tools/records.ts       qo'lda tuzatish (ikki bosqichli) + undo + ils_get_record
  oauth/provider.ts      OAuth provayderi (DCR, kod, token, rotation, revoke)
  oauth/pages.ts         login/rozilik sahifasi, imzo
  http.ts                Express router: metadata, OAuth, /mcp
  connections.routes.ts  /api/mcp/connections (panel)
  main.ts                lokal stdio kirish nuqtasi
frontend/src/components/admin/McpConnectorSection.tsx   Sozlamalar bo'limi
```
