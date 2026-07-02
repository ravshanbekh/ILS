#!/bin/bash
# =============================================================
#  STARTUP > MAIN MERGE VA QAYTA DEPLOY SKRIPTI
#  Serverda ishlatish: bash update-and-deploy.sh
#
#  Bu skript:
#  1. startup branchdagi ozgarishlarni main ga merge qiladi
#  2. Docker imidjlarini qayta build qiladi
#  3. Konteynerlarni qayta ishga tushiradi (downtime minimal)
#  4. Health check otkazadi
# =============================================================

set -e

PROJECT_DIR=$(pwd)
MAIN_BRANCH="main"
STARTUP_BRANCH="startup"
COMPOSE_PROD="docker-compose.yml"
COMPOSE_DEMO="docker-compose.demo.yml"

# RANGLAR
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${CYAN}======================================================${NC}"
echo -e "${CYAN}   IT Live Score — Startup -> Main Merge & Redeploy   ${NC}"
echo -e "${CYAN}======================================================${NC}"
echo ""

# 0. GIT HOLATI TEKSHIRISH
echo -e "${BLUE}==> QADAM 1: Git holati tekshirilmoqda...${NC}"
echo ""

if ! git diff --quiet || ! git diff --cached --quiet; then
    echo -e "${YELLOW}[!] Uncommitted ozgarishlar mavjud!${NC}"
    git status --short
    echo ""
    read -p "Davom etish? (ha/yo'q): " CONFIRM
    if [[ "$CONFIRM" != "ha" && "$CONFIRM" != "y" && "$CONFIRM" != "yes" ]]; then
        echo -e "${RED}[X] Bekor qilindi.${NC}"
        exit 1
    fi
fi

CURRENT_BRANCH=$(git branch --show-current)
echo -e "   Joriy branch: ${GREEN}$CURRENT_BRANCH${NC}"
echo ""

# 1. STARTUP BRANCHNI YANGILASH
echo -e "${BLUE}==> QADAM 2: Startup branchni remote dan yangilash...${NC}"
echo ""

git fetch origin
echo -e "   ${GREEN}[OK] Remote ozgarishlar olindi${NC}"

if ! git show-ref --verify --quiet refs/remotes/origin/${STARTUP_BRANCH}; then
    echo -e "${RED}[X] Remote da '${STARTUP_BRANCH}' branchi topilmadi!${NC}"
    echo "   Mavjud branchlar:"
    git branch -a
    exit 1
fi

git checkout ${STARTUP_BRANCH}
git pull origin ${STARTUP_BRANCH}
echo -e "   ${GREEN}[OK] Startup branch yangilandi${NC}"

echo ""
echo "   So'nggi 5 commit (startup):"
git log --oneline -5
echo ""

# 2. MAIN BRANCHGA MERGE
echo -e "${BLUE}==> QADAM 3: Main branchga merge qilinmoqda...${NC}"
echo ""

git checkout ${MAIN_BRANCH}
git pull origin ${MAIN_BRANCH}
echo -e "   ${GREEN}[OK] Main branch oxirgi holatga yangilandi${NC}"

echo ""
echo "   Merge: ${STARTUP_BRANCH} -> ${MAIN_BRANCH}"
if git merge ${STARTUP_BRANCH} --no-edit; then
    echo -e "   ${GREEN}[OK] Merge muvaffaqiyatli!${NC}"
else
    echo -e "${RED}[X] MERGE KONFLIKTI mavjud!${NC}"
    echo ""
    echo "   Konflikt fayllar:"
    git diff --name-only --diff-filter=U
    echo ""
    echo "   Hal qilish:"
    echo "   1. Fayllarni tahrirlang"
    echo "   2. git add <fayl>"
    echo "   3. git commit"
    echo "   4. Skriptni qayta ishga tushiring"
    exit 1
fi

echo ""
echo "   Remote main ga push qilinmoqda..."
git push origin ${MAIN_BRANCH}
echo -e "   ${GREEN}[OK] Remote main yangilandi${NC}"

echo ""
echo "   Merge natijalari (so'nggi 5 commit):"
git log --oneline -5
echo ""

# 3. DOCKER REBUILD VA REDEPLOY
echo -e "${BLUE}==> QADAM 4: Docker rebuild va redeploy...${NC}"
echo ""

echo "   Qaysi tizimni qayta deploy qilish kerak?"
echo "   1) Faqat PRODUCTION  (itlivescore.uz)"
echo "   2) Faqat DEMO        (demo.itlivescore.uz)"
echo "   3) IKKALASI ham"
echo ""
read -p "   Tanlovingiz (1/2/3): " DEPLOY_TARGET
echo ""

deploy_production() {
    echo -e "${CYAN}-- Production tizim yangilanmoqda...${NC}"
    echo ""
    echo "   Build qilinmoqda (cache siz)..."
    docker-compose -f "${COMPOSE_PROD}" build --no-cache

    echo ""
    echo "   Backend qayta ishga tushirilmoqda..."
    docker-compose -f "${COMPOSE_PROD}" up -d --no-deps backend
    sleep 10

    echo "   Frontend qayta ishga tushirilmoqda..."
    docker-compose -f "${COMPOSE_PROD}" up -d --no-deps frontend
    sleep 5

    echo ""
    echo "   30 soniya kutilmoqda..."
    sleep 30

    echo ""
    echo "   Health check (production)..."
    PROD_HEALTH=$(curl -s "http://127.0.0.1:5050/api/health" 2>/dev/null || echo "")
    if echo "$PROD_HEALTH" | grep -q "ishlayapti"; then
        echo -e "   ${GREEN}[OK] Production API ishlayapti${NC}"
    else
        echo -e "   ${YELLOW}[!] Production API javob bermayapti:${NC}"
        echo "       curl http://127.0.0.1:5050/api/health"
        echo "       docker logs tizim_backend --tail 20"
    fi
    echo -e "   ${GREEN}[OK] Production deploy tugadi!${NC}"
}

deploy_demo() {
    echo -e "${CYAN}-- Demo tizim yangilanmoqda...${NC}"
    echo ""
    echo "   Demo build qilinmoqda (cache siz)..."
    docker-compose -f "${COMPOSE_DEMO}" build --no-cache

    echo ""
    echo "   Demo backend qayta ishga tushirilmoqda..."
    docker-compose -f "${COMPOSE_DEMO}" up -d --no-deps tizim_backend_demo
    sleep 10

    echo "   Demo frontend qayta ishga tushirilmoqda..."
    docker-compose -f "${COMPOSE_DEMO}" up -d --no-deps tizim_frontend_demo
    sleep 5

    echo ""
    echo "   30 soniya kutilmoqda..."
    sleep 30

    echo ""
    echo "   Health check (demo)..."
    DEMO_HEALTH=$(curl -s "http://127.0.0.1:5051/api/health" 2>/dev/null || echo "")
    if echo "$DEMO_HEALTH" | grep -q "ishlayapti"; then
        echo -e "   ${GREEN}[OK] Demo API ishlayapti${NC}"
    else
        echo -e "   ${YELLOW}[!] Demo API javob bermayapti:${NC}"
        echo "       curl http://127.0.0.1:5051/api/health"
        echo "       docker logs tizim_backend_demo --tail 20"
    fi
    echo -e "   ${GREEN}[OK] Demo deploy tugadi!${NC}"
}

case "$DEPLOY_TARGET" in
    1) deploy_production ;;
    2) deploy_demo ;;
    3) deploy_production; echo ""; deploy_demo ;;
    *)
        echo -e "${RED}[X] Notogri tanlov! 1, 2 yoki 3 kiriting.${NC}"
        exit 1
        ;;
esac

# YAKUNIY HISOBOT
echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}         MERGE VA REDEPLOY MUVAFFAQIYATLI!                  ${NC}"
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  Branch:     startup -> main  (merge + push qilindi)       ${NC}"
echo -e "${GREEN}  Production: https://itlivescore.uz                        ${NC}"
echo -e "${GREEN}  Demo:       https://demo.itlivescore.uz                   ${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""

echo "   Ishlaayotgan konteynerlar:"
docker ps --format "   -> {{.Names}} | {{.Status}} | {{.Ports}}"
echo ""
echo "   Foydali buyruqlar:"
echo "   Prod loglar:  docker-compose logs -f backend"
echo "   Demo loglar:  docker-compose -f docker-compose.demo.yml logs -f"
echo "   Hammasi:      docker ps"
echo ""
