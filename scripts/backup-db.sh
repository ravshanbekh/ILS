#!/usr/bin/env bash
#
# ILS — kunlik baza zaxirasi
# ============================================================================
# Serverda cron orqali har kuni ishlaydi. Uch bosqich:
#
#   1. pg_dump  — bazaning TO'LIQ nusxasi (48 ta jadval, sxema + ma'lumot)
#   2. rotatsiya — oxirgi 14 kunlik + 12 oylik nusxa saqlanadi
#   3. tashqi nusxa — shifrlangan holda yopiq GitHub repoga (ixtiyoriy)
#
# NEGA pg_dump, ilovadagi JSON emas:
# JSON eksport Prisma orqali ishlaydi va faqat ma'lumot qatorlarini oladi.
# pg_dump esa sxema, indeks, ketma-ketlik va cheklovlarni ham oladi —
# ya'ni serverdan ayrilib qolsak, noldan tiklash uchun aynan shu kerak.
#
# XAVFSIZLIK:
# Bazada 600+ o'quvchining (ko'pi voyaga yetmagan) shaxsiy ma'lumoti bor.
# Shuning uchun tashqariga chiqadigan nusxa MAJBURIY shifrlanadi. Parol
# bo'lmasa, skript tashqi nusxani umuman yubormaydi — shifrlanmagan
# ma'lumot hech qachon serverdan chiqmaydi.
#
# SOZLASH: /root/ILS/.backup.env (chmod 600) faylini yarating:
#   BACKUP_PASSPHRASE="uzun-va-tasodifiy-parol"
#   BACKUP_REPO="https://<TOKEN>@github.com/<user>/ils-backups.git"
# Fayl bo'lmasa skript faqat serverda saqlaydi — xato bermaydi.
# ============================================================================

set -euo pipefail

DB_CONTAINER="${DB_CONTAINER:-tizim_db}"
DB_USER="${DB_USER:-root}"
DB_NAME="${DB_NAME:-normativ_tizim}"
BACKUP_DIR="${BACKUP_DIR:-/root/ils-backups}"
ENV_FILE="${ENV_FILE:-/root/ILS/.backup.env}"

KEEP_DAILY=14
KEEP_MONTHLY=12

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
die() { log "XATO: $*"; exit 1; }

# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && . "$ENV_FILE"

mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/monthly"

STAMP=$(date '+%Y-%m-%d')
DUMP="$BACKUP_DIR/daily/ils-$STAMP.sql.gz"

# ── 1. Dump ─────────────────────────────────────────────────────────────────
log "pg_dump boshlandi: $DB_NAME"

docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER" \
  || die "'$DB_CONTAINER' konteyneri ishlamayapti"

# --no-owner / --no-acl: nusxani boshqa serverda ham tiklash mumkin bo'lsin
# --clean --if-exists: tiklashda eski obyektlar avval tozalanadi
TMP="$DUMP.part"
docker exec "$DB_CONTAINER" pg_dump \
  -U "$DB_USER" -d "$DB_NAME" \
  --no-owner --no-acl --clean --if-exists \
  | gzip -9 > "$TMP"

# Bo'sh yoki juda kichik fayl — dump muvaffaqiyatsiz bo'lgan
SIZE=$(stat -c%s "$TMP" 2>/dev/null || echo 0)
[ "$SIZE" -gt 10240 ] || { rm -f "$TMP"; die "dump juda kichik ($SIZE bayt) — saqlanmadi"; }

# Butunligini tekshiramiz: gzip buzuq bo'lsa hozir bilamiz, tiklash paytida emas
gzip -t "$TMP" || { rm -f "$TMP"; die "gzip butunligi buzilgan"; }

mv "$TMP" "$DUMP"
log "tayyor: $DUMP ($(numfmt --to=iec "$SIZE" 2>/dev/null || echo "$SIZE bayt"))"

# Oyning birinchi kuni — oylik arxivga ham nusxa
if [ "$(date '+%d')" = "01" ]; then
  cp "$DUMP" "$BACKUP_DIR/monthly/ils-$(date '+%Y-%m').sql.gz"
  log "oylik nusxa saqlandi"
fi

# ── 2. Rotatsiya ────────────────────────────────────────────────────────────
# `ls -t` emas, `find -printf` — fayl nomida bo'sh joy bo'lsa ham ishonchli
prune() {
  local dir="$1" keep="$2"
  local n
  n=$(find "$dir" -maxdepth 1 -name 'ils-*.sql.gz' | wc -l)
  if [ "$n" -gt "$keep" ]; then
    find "$dir" -maxdepth 1 -name 'ils-*.sql.gz' -printf '%T@ %p\n' \
      | sort -n | head -n "$((n - keep))" | cut -d' ' -f2- \
      | while read -r f; do rm -f "$f"; log "eski nusxa o'chirildi: $(basename "$f")"; done
  fi
}
prune "$BACKUP_DIR/daily" "$KEEP_DAILY"
prune "$BACKUP_DIR/monthly" "$KEEP_MONTHLY"

# ── 3. Tashqi nusxa (ixtiyoriy) ─────────────────────────────────────────────
if [ -z "${BACKUP_REPO:-}" ]; then
  log "BACKUP_REPO sozlanmagan — tashqi nusxa yuborilmadi (faqat serverda)"
  exit 0
fi

if [ -z "${BACKUP_PASSPHRASE:-}" ]; then
  log "DIQQAT: BACKUP_PASSPHRASE yo'q. Shifrlanmagan shaxsiy ma'lumotni"
  log "tashqariga yubormaymiz. Tashqi nusxa O'TKAZIB YUBORILDI."
  exit 0
fi

WORK="$BACKUP_DIR/.repo"

if [ ! -d "$WORK/.git" ]; then
  log "zaxira repo klonlanmoqda..."
  rm -rf "$WORK"
  git clone --depth 1 "$BACKUP_REPO" "$WORK" 2>/dev/null || {
    mkdir -p "$WORK" && cd "$WORK" && git init -q && git remote add origin "$BACKUP_REPO"
  }
fi

cd "$WORK"
git config user.email "backup@itlivescore.uz"
git config user.name "ILS Backup"

mkdir -p dumps
# AES-256, PBKDF2 — openssl hamma joyda bor, qo'shimcha o'rnatish shart emas
openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
  -in "$DUMP" -out "dumps/ils-$STAMP.sql.gz.enc" \
  -pass pass:"$BACKUP_PASSPHRASE"

# Repoda ham faqat oxirgi 14 kun qoladi
ls -1 dumps/*.sql.gz.enc 2>/dev/null | sort | head -n -"$KEEP_DAILY" | xargs -r rm -f

cat > README.md <<README
# ILS baza zaxirasi

Bu repo avtomatik to'ldiriladi. Har kuni 03:30 da serverdagi
\`scripts/backup-db.sh\` yangi nusxa yuboradi.

Fayllar **AES-256 bilan shifrlangan**. Parolsiz ochib bo'lmaydi.

## Ochish

\`\`\`bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \\
  -in dumps/ils-YYYY-MM-DD.sql.gz.enc \\
  -out ils.sql.gz -pass pass:'PAROL'
gunzip ils.sql.gz
\`\`\`

## Tiklash

\`\`\`bash
cat ils.sql | docker exec -i tizim_db psql -U root -d normativ_tizim
\`\`\`

Oxirgi yangilanish: $(date '+%Y-%m-%d %H:%M')
Saqlanadigan nusxalar: oxirgi $KEEP_DAILY kun
README

# Tarix o'smasligi uchun HAR SAFAR bitta commit.
# Oddiy commit qilinsa, gzip fayllar delta bo'lmagani uchun repo har kuni
# to'liq dump hajmicha o'sardi va bir yilda gigabaytlarga chiqardi.
git checkout --orphan tmp -q 2>/dev/null || git checkout -q --orphan tmp
git add -A
git commit -q -m "Zaxira: $STAMP" || true
git branch -M tmp main
git push -f origin main -q && log "tashqi nusxa yuborildi (shifrlangan)" \
  || log "XATO: tashqi nusxa yuborilmadi — repo yoki token tekshiring"
