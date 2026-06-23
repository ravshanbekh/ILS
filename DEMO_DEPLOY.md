# 🚀 Demo Tizim — Server Deployment Qo'llanmasi

## Arxitektura

```
Internet
    │
    ▼
Server Nginx (host'da)
    ├── itlivescore.uz      → localhost:8050 (haqiqiy tizim)
    └── demo.itlivescore.uz → localhost:8051 (demo tizim)
                                   │
                    ┌──────────────┴───────────────┐
                    │                              │
            docker-compose.yml          docker-compose.demo.yml
            ├── tizim_db (5440)         ├── tizim_db_demo (5441)
            ├── tizim_backend (5050)    ├── tizim_backend_demo (5051)
            └── tizim_frontend (8050)   └── tizim_frontend_demo (8051)
```

---

## 1-QADAM: DNS Sozlash

Domain provayderingizda (namecheap, godaddy yoki boshqa):

```
A Record:  demo.itlivescore.uz  →  [Server IP manzili]
```

> Masalan: `demo  A  185.xxx.xxx.xxx`

DNS tarqalishi 5-30 daqiqa oladi.

---

## 2-QADAM: Kodni Serverga Yuklash

```bash
# Serverga SSH orqali kirish
ssh root@itlivescore.uz

# Loyiha papkasiga o'tish
cd /path/to/tizim-it-live

# Yangi fayllarni git orqali yuklash
git pull origin main
```

Yoki SCP bilan yangi fayllarni yuklash:
```bash
# Lokaldан serverga (kerak bo'lgan fayllar)
scp docker-compose.demo.yml root@itlivescore.uz:/path/to/project/
scp backend/.env.demo root@itlivescore.uz:/path/to/project/backend/
scp frontend/Dockerfile.demo root@itlivescore.uz:/path/to/project/frontend/
scp frontend/nginx.demo.conf root@itlivescore.uz:/path/to/project/frontend/
scp backend/prisma/seed-demo.ts root@itlivescore.uz:/path/to/project/backend/prisma/
scp backend/src/shared/middleware/demoGuard.ts root@itlivescore.uz:/path/to/project/backend/src/shared/middleware/
```

---

## 3-QADAM: Server Nginx Sozlash

```bash
# Nginx konfiguratsiyasini o'rnatish
sudo nano /etc/nginx/sites-available/itlivescore

# (nginx-server.conf ichidagi konfiguratsiyani joylashtirish)

# Sites-enabled ga ulanish
sudo ln -sf /etc/nginx/sites-available/itlivescore /etc/nginx/sites-enabled/

# Nginx konfiguratsiyasini tekshirish
sudo nginx -t

# Nginx qayta ishga tushirish
sudo systemctl reload nginx
```

---

## 4-QADAM: SSL Sertifikat (HTTPS)

```bash
# Certbot o'rnatilmagan bo'lsa:
sudo apt install certbot python3-certbot-nginx

# SSL olish (barcha domenlar uchun birdan)
sudo certbot --nginx -d itlivescore.uz -d www.itlivescore.uz -d demo.itlivescore.uz

# Avtomatik yangilanishni tekshirish
sudo certbot renew --dry-run
```

---

## 5-QADAM: Demo Docker Tizimini Ishga Tushirish

```bash
# Demo tizimni build qilish (birinchi marta yoki o'zgarish bo'lganda)
npm run demo:build

# Demo tizimni ishga tushirish
npm run demo:up

# Konteynerlar ishga tushishini kutish (30-60 soniya)
sleep 60

# Demo ma'lumotlarni yuklash
npm run demo:seed
```

---

## 6-QADAM: Tekshirish

```bash
# Konteynerlar holatini tekshirish
docker ps | grep demo

# Demo backend health check
curl http://localhost:5051/api/health

# Demo frontend
curl -I http://localhost:8051

# Tashqi tekshirish
curl https://demo.itlivescore.uz/api/health
```

---

## Foydali Buyruqlar

```bash
# Demo loglarni ko'rish
npm run demo:logs

# Faqat backend loglar
docker logs tizim_backend_demo -f

# Demo tizimni to'xtatish (haqiqiy tizim ishlayveradi!)
npm run demo:down

# Demo ma'lumotlarni qayta yuklash (yangi seed)
npm run demo:reset
sleep 60
npm run demo:seed

# Haqiqiy tizim holatini tekshirish
docker ps | grep -v demo
curl https://itlivescore.uz/api/health
```

---

## Taqdimot Uchun Login Ma'lumotlari

| Rol | Login | Parol |
|-----|-------|-------|
| **Admin** | `demo_admin` | `Demo@2026!` |
| **Filial Rahbari** | `demo_rahbar` | `Demo@2026!` |
| **Kassir** | `demo_kassir` | `Demo@2026!` |
| **Administrator** | `demo_administrator` | `Demo@2026!` |
| **O'qituvchi 1** | `demo_teacher1` | `Demo@2026!` |
| **O'qituvchi 2** | `demo_teacher2` | `Demo@2026!` |
| **O'quvchi** | `demo_student` | `Demo@2026!` |

---

## Taqdimot Qadamlari (Tavsiya)

1. **Admin sifatida kirish** → `demo_admin` → Dashboard ko'rsatish
2. **Statistika** → O'quvchilar soni, guruhlar, normativlar
3. **Guruhlar** → Foundation-A1 guruhini ochish → O'quvchilar ro'yxati
4. **O'qituvchi** sifatida kirish → `demo_teacher1` → Topshiriqlarni tekshirish
5. **Rankings** → Umumiy reyting ko'rsatish
6. **Monitoring** → Guruh monitoring dashboard
7. **Freeze hisoboti** → Freeze statistikasi

---

## Muammolar va Yechimlar

### Demo konteyner ishlamayapti
```bash
docker logs tizim_backend_demo --tail 50
```

### Port band
```bash
# Qaysi jarayon porti band qilgan
sudo netstat -tlnp | grep 8051
```

### Seed ishlamayapti
```bash
# Konteyner ichiga kirish va manual seed
docker exec -it tizim_backend_demo sh
npx tsx prisma/seed-demo.ts
```

### Nginx xato
```bash
sudo nginx -t
sudo journalctl -u nginx --tail 20
```
