#!/bin/bash
# =============================================================
#  LOKAL SKRIPT: main ga to'g'ridan-to'g'ri commit + push
#  Ishlatish: bash push-to-main.sh  yoki  npm run push
# =============================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${CYAN}================================${NC}"
echo -e "${CYAN}   main -> GitHub push          ${NC}"
echo -e "${CYAN}================================${NC}"
echo ""

# 1. main branchga o'tish
git checkout main

# 2. O'zgarishlar borligini tekshirish
if git diff --quiet && git diff --cached --quiet; then
    echo -e "${YELLOW}[!] Hech qanday o'zgarish yo'q.${NC}"
    exit 0
fi

echo "   O'zgargan fayllar:"
git status --short
echo ""

# 3. Commit xabarini so'rash
read -p "   Commit xabari: " MSG
if [ -z "$MSG" ]; then
    MSG="chore: update $(date '+%Y-%m-%d %H:%M')"
fi

# 4. Add + commit + push
git add .
git commit -m "$MSG"

echo ""
echo -e "${BLUE}--> GitHub main ga push qilinmoqda...${NC}"
git push origin main

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}   PUSH MUVAFFAQIYATLI! [OK]    ${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "   GitHub Actions avtomatik deploy boshlaydi."
echo "   Tekshirish: https://github.com/ravshanbekh/ILS/actions"
echo ""
