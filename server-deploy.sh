#!/bin/bash
# =============================================================
#  SERVER SKRIPT: GitHub dan pull + Docker rebuild
#  Serverda ishlatish: cd ~/ILS && bash server-deploy.sh
#
#  Siz avval ishlatgan buyruqlarning to'liq versiyasi:
#    cd ~/ILS
#    git pull origin main
#    docker-compose up -d --build tizim_backend
# =============================================================

set -e

PROJECT_DIR=$(pwd)
COMPOSE_FILE="docker-compose.yml"
COMPOSE_DEMO="docker-compose.demo.yml"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${CYAN}================================================${NC}"
echo -e "${CYAN}   Server Deploy: GitHub pull + Docker rebuild  ${NC}"
echo -e "${CYAN}================================================${NC}"
echo ""

# 1. GitHub dan so'nggi kodni olish
echo -e "${BLUE}--> git pull origin main${NC}"
git pull origin main

echo ""
echo "   So'nggi o'zgarishlar:"
git log --oneline -3
echo ""

# 2. Qaysi konteynerlarni qayta build qilish kerak?
echo "   Qaysi konteynerlarni rebuild qilish kerak?"
echo "   1) Faqat backend          (tizim_backend)"
echo "   2) Backend + frontend     (production)"
echo "   3) Demo backend           (tizim_backend_demo)"
echo "   4) Demo backend + frontend (demo tizim)"
echo "   5) Hammasini              (production + demo)"
echo ""
read -p "   Tanlovingiz (1-5): " TARGET
echo ""

# --- PRODUCTION BACKEND ---
rebuild_prod_backend() {
    echo -e "${BLUE}--> docker-compose up -d --build tizim_backend${NC}"
    docker-compose -f "${COMPOSE_FILE}" up -d --build tizim_backend
    echo -e "   ${GREEN}[OK] Backend yangilandi${NC}"

    echo ""
    echo "   15 soniya kutilmoqda..."
    sleep 15

    echo "   Health check..."
    HEALTH=$(curl -s "http://127.0.0.1:5050/api/health" 2>/dev/null || echo "")
    if echo "$HEALTH" | grep -q "ishlayapti"; then
        echo -e "   ${GREEN}[OK] Backend API ishlayapti${NC}"
    else
        echo -e "   ${YELLOW}[!] Backend javob bermayapti. Loglar:${NC}"
        echo "       docker logs tizim_backend --tail 30"
    fi
}

# --- PRODUCTION FULL ---
rebuild_prod_full() {
    echo -e "${BLUE}--> Production: backend + frontend rebuild${NC}"
    docker-compose -f "${COMPOSE_FILE}" up -d --build
    echo -e "   ${GREEN}[OK] Production yangilandi${NC}"

    echo ""
    echo "   20 soniya kutilmoqda..."
    sleep 20

    echo "   Health check..."
    HEALTH=$(curl -s "http://127.0.0.1:5050/api/health" 2>/dev/null || echo "")
    if echo "$HEALTH" | grep -q "ishlayapti"; then
        echo -e "   ${GREEN}[OK] Production API ishlayapti${NC}"
    else
        echo -e "   ${YELLOW}[!] Javob bermayapti: docker logs tizim_backend --tail 30${NC}"
    fi
}

# --- DEMO BACKEND ---
rebuild_demo_backend() {
    echo -e "${BLUE}--> docker-compose -f demo up -d --build tizim_backend_demo${NC}"
    docker-compose -f "${COMPOSE_DEMO}" up -d --build tizim_backend_demo
    echo -e "   ${GREEN}[OK] Demo backend yangilandi${NC}"

    echo ""
    echo "   15 soniya kutilmoqda..."
    sleep 15

    echo "   Health check (demo)..."
    HEALTH=$(curl -s "http://127.0.0.1:5051/api/health" 2>/dev/null || echo "")
    if echo "$HEALTH" | grep -q "ishlayapti"; then
        echo -e "   ${GREEN}[OK] Demo API ishlayapti${NC}"
    else
        echo -e "   ${YELLOW}[!] Demo javob bermayapti: docker logs tizim_backend_demo --tail 30${NC}"
    fi
}

# --- DEMO FULL ---
rebuild_demo_full() {
    echo -e "${BLUE}--> Demo: backend + frontend rebuild${NC}"
    docker-compose -f "${COMPOSE_DEMO}" up -d --build
    echo -e "   ${GREEN}[OK] Demo yangilandi${NC}"

    echo ""
    echo "   20 soniya kutilmoqda..."
    sleep 20

    HEALTH=$(curl -s "http://127.0.0.1:5051/api/health" 2>/dev/null || echo "")
    if echo "$HEALTH" | grep -q "ishlayapti"; then
        echo -e "   ${GREEN}[OK] Demo API ishlayapti${NC}"
    else
        echo -e "   ${YELLOW}[!] Javob bermayapti: docker logs tizim_backend_demo --tail 30${NC}"
    fi
}

# Tanlova qarab bajarish
case "$TARGET" in
    1) rebuild_prod_backend ;;
    2) rebuild_prod_full ;;
    3) rebuild_demo_backend ;;
    4) rebuild_demo_full ;;
    5)
        rebuild_prod_full
        echo ""
        rebuild_demo_full
        ;;
    *)
        echo -e "${RED}[X] Notogri tanlov!${NC}"
        exit 1
        ;;
esac

# Yakuniy hisobot
echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}   DEPLOY TUGADI!                               ${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "   Ishlaayotgan konteynerlar:"
docker ps --format "   -> {{.Names}} | {{.Status}}"
echo ""
echo "   Foydali buyruqlar:"
echo "   Prod loglar:  docker-compose logs -f backend"
echo "   Demo loglar:  docker-compose -f docker-compose.demo.yml logs -f tizim_backend_demo"
echo ""
