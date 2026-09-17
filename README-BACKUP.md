# Zaxira (backup) tizimi

## Ikki xil zaxira bor — ular bir xil emas

| | Ilovadagi JSON | Serverdagi pg_dump |
|---|---|---|
| Qayerda | Sozlamalar → Backup tugmasi | `scripts/backup-db.sh`, cron |
| Nimani oladi | 48 ta jadvalning ma'lumoti | **butun baza**: sxema, indeks, ketma-ketlik, ma'lumot |
| Qachon ishlatiladi | ko'chirish, tekshirish | **server yo'qolganda noldan tiklash** |
| Avtomatikmi | yo'q, qo'lda | **ha, har kuni 03:30** |

Haqiqiy himoya — ikkinchisi. Birinchisi qulaylik uchun.

---

## Serverdagi kunlik zaxira

Deploy paytida o'z-o'zidan o'rnatiladi. Qo'lda hech narsa qilish shart emas.

```
/root/ils-backups/daily/     oxirgi 14 kun
/root/ils-backups/monthly/   oxirgi 12 oy (har oyning 1-sanasi)
/var/log/ils-backup.log      jurnal
```

Tekshirish:

```bash
crontab -l | grep backup-db
ls -lh /root/ils-backups/daily/
tail -30 /var/log/ils-backup.log
```

Qo'lda ishga tushirish:

```bash
bash /root/ILS/scripts/backup-db.sh
```

---

## Tashqi nusxa — nega kerak

Server yo'qolsa (disk buzildi, akkaunt bloklandi, provayder o'chirdi),
serverdagi zaxira ham birga yo'qoladi. Shuning uchun nusxa **boshqa joyda**
turishi kerak.

### Sozlash (bir marta)

**1-qadam. Yopiq repo yarating**

GitHub → New repository → nomi `ils-backups` → **Private** (majburiy).

**2-qadam. Token oling**

GitHub → Settings → Developer settings → Personal access tokens →
Fine-grained tokens → faqat `ils-backups` repo uchun, `Contents: Read and write`.

**3-qadam. Serverda sozlama faylini yarating**

```bash
nano /root/ILS/.backup.env
```

Ichiga:

```bash
BACKUP_PASSPHRASE="bu-yerga-uzun-tasodifiy-parol"
BACKUP_REPO="https://TOKEN@github.com/FOYDALANUVCHI/ils-backups.git"
```

Keyin huquqni cheklang:

```bash
chmod 600 /root/ILS/.backup.env
```

**4-qadam. Sinab ko'ring**

```bash
bash /root/ILS/scripts/backup-db.sh
```

GitHub'dagi repoda `dumps/ils-YYYY-MM-DD.sql.gz.enc` paydo bo'lishi kerak.

> ⚠️ **Parolni yo'qotmang.** Uni alohida joyda (parol menejerida) saqlang.
> Parolsiz zaxirani ochib bo'lmaydi — bu ataylab shunday.

---

## Nega shifrlash majburiy

Bazada 600+ o'quvchining shaxsiy ma'lumoti bor va ularning ko'pi voyaga
yetmagan: ism, login, telefon, ota-ona Telegram ID si, baholar.

Shifrlanmagan holda uchinchi tomon serveriga (GitHub) yuklash — bu
ma'lumotni himoyasiz joyga qo'yish demakdir. Repo yopiq bo'lsa ham:
akkaunt buzilishi, token sizib chiqishi yoki xodim xatosi mumkin.

Shuning uchun skript qat'iy qoidaga amal qiladi:

> `BACKUP_PASSPHRASE` yo'q bo'lsa — tashqi nusxa **umuman yuborilmaydi**.

Shifrlanmagan shaxsiy ma'lumot hech qachon serverdan chiqmaydi.

---

## Nega repo shishib ketmaydi

Gzip fayllarni git delta qila olmaydi. Oddiy commit qilinsa, repo har kuni
to'liq dump hajmicha o'sardi va bir yilda gigabaytlarga chiqardi.

Shuning uchun skript **har safar tarixni yangidan yozadi** (orphan branch +
force push). Repo doim faqat oxirgi 14 kunlik nusxa hajmida qoladi.

Bunda eski commitlar saqlanmaydi — lekin bu muammo emas, chunki fayllarning
o'zi sanasi bilan saqlanadi.

---

## Tiklash

### Tekshirish (hech narsa o'zgarmaydi)

```bash
bash /root/ILS/scripts/restore-db.sh --check /root/ils-backups/daily/ils-2026-09-17.sql.gz
```

Fayl butunligini va jadvallar sonini aytadi. **Oyda bir marta shuni
ishlating** — sinalmagan zaxira zaxira emas.

### Haqiqiy tiklash

```bash
bash /root/ILS/scripts/restore-db.sh /root/ils-backups/daily/ils-2026-09-17.sql.gz
```

Skript `TIKLASH` deb yozishni so'raydi va **tiklashdan oldin hozirgi
holatning nusxasini oladi** — xato qilinsa qaytish mumkin.

### Shifrlangan fayldan

```bash
bash /root/ILS/scripts/restore-db.sh dumps/ils-2026-09-17.sql.gz.enc
```

Parolni `.backup.env` dan o'zi oladi.

### Noldan, boshqa serverda

```bash
# 1. Reponi klonlang, docker-compose ni ko'taring
# 2. Shifrni oching
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -in ils-2026-09-17.sql.gz.enc -out ils.sql.gz -pass pass:'PAROL'
# 3. Tiklang
gunzip -c ils.sql.gz | docker exec -i tizim_db psql -U root -d normativ_tizim
```

---

## Ilovadagi JSON tugmasi haqida

`Sozlamalar → Tizimni Saqlash va Tiklash` bo'limi.

**2026-09-17 da tuzatilgan jiddiy xato:** eski kod 48 ta jadvaldan faqat
8 tasini olardi, tiklashda esa `user.deleteMany()` qilardi. Sxemada 47 ta
`onDelete: Cascade` bog'lanish bor — ya'ni tiklash imtihonlar, uyga
vazifalar, darsliklar, baholar, coinlar, Telegram ulanishlari va yana
30+ jadvalni **butunlay o'chirib yuborardi**. Ularning hech biri zaxirada
yo'q edi.

Endi:

- jadvallar ro'yxati Prisma sxemasidan **avtomatik** olinadi (qo'lda
  yozilgan ro'yxat sxemadan orqada qolib ketishi muqarrar edi — asosiy
  xato aynan shundan chiqqan);
- tiklashdan oldin `/api/backup/inspect` faylni tekshiradi;
- bazada ma'lumot bor, lekin faylda yo'q jadval topilsa — tiklash
  **boshlanmaydi**.

---

## Nima hali qilinmagan

- Zaxira muvaffaqiyatsiz bo'lsa Telegramga xabar yuborish (hozir faqat
  logga yoziladi)
- Yuklangan fayllar (avatar, do'kon rasmlari) zaxirasi — hozir faqat baza
- Tiklashni haqiqiy sinovdan o'tkazish (bo'sh bazaga tiklab ko'rish)
