#!/bin/bash
# =============================================================
#  DEMO TIZIM DEPLOYMENT SKRIPTI
#  Serverda ishlatish: bash deploy-demo.sh
#
#  Bu skript:
#  1. Portlarni tekshiradi
#  2. Demo tizimni build qiladi
#  3. Demo tizimni ishga tushiradi
#  4. Server Nginx konfiguratsiyasini yangilaydi
#  5. SSL sertifikat oladi (ixtiyoriy)
# =============================================================

set -e

DEMO_PORT=7080
PROJECT_DIR=$(pwd)
NGINX_CONF="/etc/nginx/sites-available/itlivescore-demo"
NGINX_ENABLED="/etc/nginx/sites-enabled/itlivescore-demo"

echo "╔══════════════════════════════════════════════╗"
echo "║   IT Live Score — Demo Tizim Deployment      ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ─── 1. PORT TEKSHIRISH ───
echo "🔍 Portlar tekshirilmoqda..."
echo ""

# Barcha band portlarni ko'rsatish
echo "📋 Hozir band bo'lgan portlar:"
ss -tlnp 2>/dev/null | grep LISTEN | awk '{print $4}' | grep -oP '\d+$' | sort -n | uniq | while read port; do
    echo "   → $port"
done
echo ""

# Demo port band bo'lgan-bo'lmaganini tekshirish
if ss -tlnp 2>/dev/null | grep -q ":${DEMO_PORT}"; then
    echo "⚠️  Port $DEMO_PORT band! Boshqa port tanlash kerak."
    echo "   Quyidagi portlardan birini .env fayliga yozing:"
    
    # Bo'sh portlarni topish (7000-9000 oralig'ida)
    for p in 7080 7081 7082 7083 7084 7085 7090 7100 7200 8090 8091 8092 9090; do
        if ! ss -tlnp 2>/dev/null | grep -q ":${p}"; then
            echo "   ✅ $p (bo'sh)"
        fi
    done
    echo ""
    read -p "   Qaysi portdan foydalanish kerak? " DEMO_PORT
else
    echo "✅ Port $DEMO_PORT bo'sh — ishlatish mumkin"
fi

echo ""

# ─── 2. DOCKER TEKSHIRISH ───
echo "🐳 Docker holati:"
echo "   Hozir ishlaётgan konteynerlar:"
docker ps --format "   → {{.Names}} ({{.Ports}})" 2>/dev/null || echo "   Docker ishlayapti"
echo ""

# ─── 3. DEMO TIZIM BUILD ───
echo "🏗️  Demo tizim build qilinmoqda..."
echo "   (Bu 3-10 daqiqa olishi mumkin...)"
echo ""

# docker-compose.demo.yml dagi portni yangilash
sed -i "s/\"7080:80\"/\"${DEMO_PORT}:80\"/" "${PROJECT_DIR}/docker-compose.demo.yml"
echo "✅ docker-compose.demo.yml → port: $DEMO_PORT"

docker-compose -f "${PROJECT_DIR}/docker-compose.demo.yml" build --no-cache

echo ""
echo "🚀 Demo tizim ishga tushirilmoqda..."
docker-compose -f "${PROJECT_DIR}/docker-compose.demo.yml" up -d

echo ""
echo "⏳ Demo konteynerlar tayyor bo'lishi uchun 45 soniya kutilmoqda..."
sleep 45

# ─── 4. SERVER NGINX KONFIGURATSIYA ───
echo ""
echo "🌐 Server Nginx konfiguratsiyasi o'rnatilmoqda..."

# Nginx o'rnatilganligini tekshirish
if ! command -v nginx &> /dev/null; then
    echo "⚠️  Nginx topilmadi. O'rnatilmoqda..."
    apt-get update -qq && apt-get install -y nginx
fi

# Nginx konfiguratsiyasi yozish
cat > "${NGINX_CONF}" << EOF
# Demo tizim — demo.itlivescore.uz
# Avtomatik yaratildi: $(date)

server {
    listen 80;
    listen [::]:80;
    server_name demo.itlivescore.uz;

    add_header X-Demo-Environment "true" always;

    location / {
        proxy_pass http://127.0.0.1:${DEMO_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

# Sites-enabled ga ulanish
ln -sf "${NGINX_CONF}" "${NGINX_ENABLED}" 2>/dev/null || true

# Nginx tekshirish va qayta yuklash
if nginx -t 2>/dev/null; then
    systemctl reload nginx
    echo "✅ Nginx konfiguratsiyasi yangilandi"
else
    echo "❌ Nginx konfiguratsiyasida xato! Tekshiring:"
    nginx -t
    exit 1
fi

# ─── 5. DEMO MA'LUMOTLAR YUKLASH ───
echo ""
echo "🌱 Demo ma'lumotlar yuklanmoqda..."
echo "   (200+ o'quvchi, 18 guruh, 800+ submission...)"
echo ""

docker exec tizim_backend_demo npx tsx prisma/seed-demo.ts

# ─── 6. TEKSHIRISH ───
echo ""
echo "🔍 Tekshirish..."
echo ""

# Local tekshirish
HEALTH=$(curl -s "http://127.0.0.1:${DEMO_PORT}/api/health" 2>/dev/null)
if echo "$HEALTH" | grep -q "ishlayapti"; then
    echo "✅ Demo API ishlayapti (port $DEMO_PORT)"
else
    echo "⚠️  API hali tayyor emas, qayta tekshiring:"
    echo "   curl http://127.0.0.1:${DEMO_PORT}/api/health"
fi

# ─── YAKUNIY HISOBOT ───
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    DEPLOYMENT TUGADI! 🎉                    ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║                                                              ║"
echo "║  🌐 Demo tizim:    http://demo.itlivescore.uz               ║"
echo "║  🔌 Internal port: $DEMO_PORT (faqat server ichida)               ║"
echo "║                                                              ║"
echo "║  🔑 Login ma'lumotlari (parol: Demo@2026!):                 ║"
echo "║     Admin:       demo_admin                                  ║"
echo "║     O'qituvchi:  demo_teacher1                               ║"
echo "║     O'quvchi:    demo_student                                ║"
echo "║                                                              ║"
echo "║  📋 Foydali buyruqlar:                                       ║"
echo "║     Loglar:    docker logs tizim_backend_demo -f             ║"
echo "║     To'xtatish: docker-compose -f docker-compose.demo.yml down║"
echo "║     Qayta seed: npm run demo:seed                            ║"
echo "║                                                              ║"
echo "║  ⚠️  SSL uchun:                                              ║"
echo "║     certbot --nginx -d demo.itlivescore.uz                   ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
