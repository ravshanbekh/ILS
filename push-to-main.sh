#!/bin/bash
# =============================================================
#  LOKAL SKRIPT: startup -> main merge + GitHub push
#  Ishlatish: bash push-to-main.sh
#  Keyin serverda: bash server-deploy.sh
# =============================================================

set -e

MAIN_BRANCH="main"
STARTUP_BRANCH="startup"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${CYAN}================================================${NC}"
echo -e "${CYAN}   Lokal: startup -> main -> GitHub push        ${NC}"
echo -e "${CYAN}================================================${NC}"
echo ""

# 1. Uncommitted ozgarishlar tekshirish
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo -e "${YELLOW}[!] Saqlashmagan ozgarishlar bor:${NC}"
    git status --short
    echo ""
    read -p "    Davom etish? (ha/yo'q): " CONFIRM
    if [[ "$CONFIRM" != "ha" && "$CONFIRM" != "y" ]]; then
        echo -e "${RED}[X] Bekor qilindi.${NC}"
        exit 1
    fi
fi

# 2. Remote yangilanishlarni olish
echo -e "${BLUE}--> Remote yangilanishlar olinmoqda...${NC}"
git fetch origin
echo -e "   ${GREEN}[OK] git fetch tugadi${NC}"
echo ""

# 3. startup branchga o'tib pull qilish
echo -e "${BLUE}--> startup branch yangilanmoqda...${NC}"
git checkout ${STARTUP_BRANCH}
git pull origin ${STARTUP_BRANCH}
echo -e "   ${GREEN}[OK] startup tayyor${NC}"
echo ""
echo "   So'nggi commitlar (startup):"
git log --oneline -3
echo ""

# 4. main ga o'tib pull qilish
echo -e "${BLUE}--> main branchga o'tilmoqda...${NC}"
git checkout ${MAIN_BRANCH}
git pull origin ${MAIN_BRANCH}
echo -e "   ${GREEN}[OK] main yangilandi${NC}"
echo ""

# 5. startup -> main merge
echo -e "${BLUE}--> Merge: startup -> main${NC}"
if git merge ${STARTUP_BRANCH} --no-edit; then
    echo -e "   ${GREEN}[OK] Merge muvaffaqiyatli!${NC}"
else
    echo ""
    echo -e "${RED}[X] MERGE KONFLIKTI! Quyidagi fayllarni hal qiling:${NC}"
    git diff --name-only --diff-filter=U
    echo ""
    echo "   Keyin:"
    echo "   git add .  &&  git commit  &&  bash push-to-main.sh"
    exit 1
fi
echo ""

# 6. GitHub main ga push
echo -e "${BLUE}--> GitHub main ga push qilinmoqda...${NC}"
git push origin ${MAIN_BRANCH}
echo -e "   ${GREEN}[OK] GitHub yangilandi!${NC}"
echo ""

# Yakuniy
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}   GitHub ga push MUVAFFAQIYATLI!               ${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "   So'nggi commitlar (main):"
git log --oneline -5
echo ""
echo -e "${YELLOW}   Keyingi qadam — serverda ishlatish:${NC}"
echo "   ssh root@itlivescore.uz"
echo "   cd ~/ILS && bash server-deploy.sh"
echo ""
