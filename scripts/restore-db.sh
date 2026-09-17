#!/usr/bin/env bash
#
# ILS — zaxiradan tiklash
# ============================================================================
# Sinalmagan zaxira — zaxira emas. Shuning uchun tiklash ham skript bo'lishi
# kerak: favqulodda paytda buyruqlarni eslab o'tirmaslik uchun.
#
# Ishlatish:
#   ./restore-db.sh /root/ils-backups/daily/ils-2026-09-17.sql.gz
#   ./restore-db.sh dumps/ils-2026-09-17.sql.gz.enc        # shifrlangan
#   ./restore-db.sh --check /root/ils-backups/daily/...    # faqat tekshirish
#
# --check: hech narsani o'zgartirmaydi, faqat fayl butunligini va ichida
# nechta jadval borligini aytadi. Zaxirani muntazam shu bilan sinab turing.
# ============================================================================

set -euo pipefail

DB_CONTAINER="${DB_CONTAINER:-tizim_db}"
DB_USER="${DB_USER:-root}"
DB_NAME="${DB_NAME:-normativ_tizim}"
ENV_FILE="${ENV_FILE:-/root/ILS/.backup.env}"

log() { echo "[$(date '+%H:%M:%S')] $*"; }
die() { echo "XATO: $*" >&2; exit 1; }

CHECK_ONLY=false
if [ "${1:-}" = "--check" ]; then CHECK_ONLY=true; shift; fi

FILE="${1:-}"
[ -n "$FILE" ] || die "Fayl ko'rsatilmagan. Misol: $0 /root/ils-backups/daily/ils-2026-09-17.sql.gz"
[ -f "$FILE" ] || die "Fayl topilmadi: $FILE"

# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && . "$ENV_FILE"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

WORK="$FILE"

# ── Shifr ochish ────────────────────────────────────────────────────────────
if [[ "$FILE" == *.enc ]]; then
  [ -n "${BACKUP_PASSPHRASE:-}" ] || die "Shifrlangan fayl uchun BACKUP_PASSPHRASE kerak ($ENV_FILE)"
  log "shifr ochilmoqda..."
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
    -in "$FILE" -out "$TMPDIR/dump.sql.gz" -pass pass:"$BACKUP_PASSPHRASE" \
    || die "shifr ochilmadi — parol noto'g'ri bo'lishi mumkin"
  WORK="$TMPDIR/dump.sql.gz"
fi

# ── Butunlik ────────────────────────────────────────────────────────────────
log "fayl butunligi tekshirilmoqda..."
gzip -t "$WORK" || die "gzip buzuq — bu fayldan tiklab bo'lmaydi"

TABLES=$(gunzip -c "$WORK" | grep -c '^CREATE TABLE' || true)
COPIES=$(gunzip -c "$WORK" | grep -c '^COPY ' || true)
SIZE=$(stat -c%s "$WORK")

echo
echo "  Fayl      : $FILE"
echo "  Hajm      : $(numfmt --to=iec "$SIZE" 2>/dev/null || echo "$SIZE bayt")"
echo "  Jadvallar : $TABLES ta CREATE TABLE"
echo "  Ma'lumot  : $COPIES ta COPY bloki"
echo

[ "$TABLES" -ge 40 ] || die "Jadvallar soni juda kam ($TABLES). Sxemada 48 ta bo'lishi kerak — bu to'liq zaxira emas."

if [ "$CHECK_ONLY" = true ]; then
  log "TEKSHIRUV TUGADI — fayl yaroqli. Hech narsa o'zgartirilmadi."
  exit 0
fi

# ── Tiklash ─────────────────────────────────────────────────────────────────
docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER" \
  || die "'$DB_CONTAINER' konteyneri ishlamayapti"

echo "!!! DIQQAT !!!"
echo "Hozirgi '$DB_NAME' bazasi butunlay almashtiriladi."
echo "Davom etish uchun 'TIKLASH' deb yozing:"
read -r CONFIRM
[ "$CONFIRM" = "TIKLASH" ] || die "bekor qilindi"

# Tiklashdan OLDIN hozirgi holatning nusxasi — xato qilinsa qaytish uchun
SAFETY="/root/ils-backups/before-restore-$(date '+%Y%m%d-%H%M%S').sql.gz"
mkdir -p "$(dirname "$SAFETY")"
log "ehtiyot nusxa olinmoqda: $SAFETY"
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" \
  --no-owner --no-acl --clean --if-exists | gzip -9 > "$SAFETY"

log "tiklanmoqda..."
gunzip -c "$WORK" | docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=0

log "backend qayta ishga tushirilmoqda..."
docker restart tizim_backend >/dev/null 2>&1 || true

echo
log "TIKLANDI. Xato bo'lsa, qaytish uchun: $0 $SAFETY"
