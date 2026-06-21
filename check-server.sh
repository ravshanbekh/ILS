#!/bin/bash
# ============================================================
#  SERVER DIAGNOSTIKA SKRIPTI
#  Serverda ishlatish: bash check-server.sh
#  Natija: server holati to'liq ko'rinadi
# ============================================================

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║        SERVER DIAGNOSTIKA — itlivescore.uz          ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ─── 1. NGINX ───
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 NGINX HOLATI:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if command -v nginx &>/dev/null; then
    echo "  ✅ Nginx o'rnatilgan: $(nginx -v 2>&1)"
    echo "  📊 Holati: $(systemctl is-active nginx 2>/dev/null || service nginx status 2>/dev/null | head -1)"
    echo ""
    echo "  📁 Konfiguratsiya fayllari:"
    ls /etc/nginx/sites-enabled/ 2>/dev/null | while read f; do
        echo "     → /etc/nginx/sites-enabled/$f"
    done
    echo ""
    echo "  📋 Nginx server_name lar:"
    grep -r "server_name" /etc/nginx/sites-enabled/ 2>/dev/null | grep -v "#" | sed 's/.*server_name/     →/' | sed 's/;//'
else
    echo "  ❌ Nginx topilmadi!"
fi
echo ""

# ─── 2. DOCKER ───
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🐳 DOCKER KONTEYNERLAR:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker ps --format "  → {{.Names}}\t[{{.Status}}]\t{{.Ports}}" 2>/dev/null || echo "  ❌ Docker ishlamayapti yoki ruxsat yo'q"
echo ""

# ─── 3. BAND PORTLAR ───
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔌 TASHQARIGA OCHIQ PORTLAR (0.0.0.0):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ss -tlnp 2>/dev/null | grep "0.0.0.0\|:::" | awk '{print $4}' | grep -oP '\d+$' | sort -n | uniq | while read p; do
    PROC=$(ss -tlnp 2>/dev/null | grep ":$p " | grep -oP 'users:\(\("([^"]+)"' | grep -oP '"[^"]+' | tr -d '"' | head -1)
    echo "  → Port $p  ($PROC)"
done
echo ""

# ─── 4. PORT 7080 TEKSHIRISH ───
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 DEMO PORT (7080) TEKSHIRISH:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if ss -tlnp 2>/dev/null | grep -q ":7080"; then
    echo "  ⚠️  Port 7080 BAND! Boshqa port kerak."
    echo "  Bo'sh portlar (7000-9000):"
    for p in 7081 7082 7083 7090 7100 7200 7300 8088 8089 8090 8091 8092 9090; do
        if ! ss -tlnp 2>/dev/null | grep -q ":$p"; then
            echo "    ✅ $p — bo'sh"
        fi
    done
else
    echo "  ✅ Port 7080 BO'SH — demo uchun ishlatsa bo'ladi!"
fi
echo ""

# ─── 5. DOCKER VOLUMES ───
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💾 DOCKER VOLUMES:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker volume ls 2>/dev/null | grep -v "DRIVER" | while read d v; do
    echo "  → $v"
done
echo ""

# ─── 6. DOCKER NETWORKS ───
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔗 DOCKER NETWORKS:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker network ls 2>/dev/null | grep -v "NETWORK ID" | while read id name driver scope; do
    echo "  → $name ($driver)"
done
echo ""

# ─── 7. DISK JOY ───
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💿 DISK HOLATI:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
df -h / 2>/dev/null | tail -1 | awk '{print "  Jami: "$2"  |  Ishlatilgan: "$3"  |  Bo'"'"'sh: "$4"  |  "$5" to'"'"'lgan"}'
echo ""

# ─── 8. SERVER IP ───
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌍 SERVER IP:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s ifconfig.me 2>/dev/null && echo "" || curl -s icanhazip.com 2>/dev/null && echo ""
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Diagnostika tugadi. Natijani ko'chiring va yuboring."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
