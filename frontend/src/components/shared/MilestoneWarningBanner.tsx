import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { milestonesApi } from '../../api';
import { useAuthStore } from '../../stores/authStore';

interface WarningItem {
  id: string;
  type: 'demo_day' | 'imtihon';
  groupId: string;
  groupName: string;
  teacherName: string;
  daysLate: number;
}

interface Warnings {
  total: number;
  demoDay: number;
  exam: number;
  items: WarningItem[];
}

/**
 * Kechikkan demo day va imtihonlar haqida ekran tepasidagi ogohlantirish.
 *
 * Bot orqali xabar yuborilmaydi — Ravshan aynan ekrandagi bannerni tanladi.
 * Backend javobni rolga qarab filtrlaydi: admin hammasini, o'qituvchi faqat
 * o'z guruhlarini ko'radi. Ya'ni bu yerda qo'shimcha tekshiruv shart emas.
 *
 * Yopish faqat SHU sessiyaga: sessionStorage'da saqlanadi, brauzer yopilsa
 * qaytadan chiqadi. localStorage bo'lsa bir marta yopgan odam buni boshqa
 * hech qachon ko'rmasdi — ogohlantirishning ma'nosi yo'qolardi.
 */
export default function MilestoneWarningBanner() {
  const { isAuthenticated, user } = useAuthStore();
  const [data, setData] = useState<Warnings | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem('ils:milestone-banner-hidden') === '1');
    } catch {
      /* sessionStorage bloklangan bo'lishi mumkin — bannerni ko'rsataveramiz */
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    let alive = true;

    const load = async () => {
      try {
        const res = await milestonesApi.warnings();
        if (alive) setData(res.data?.data ?? null);
      } catch {
        /* jim: banner ikkinchi darajali, xatosi sahifani buzmasin */
      }
    };

    load();
    // Har 10 daqiqada yangilanadi — cron 06:00 da holatni o'zgartiradi,
    // kun davomida ochiq turgan sahifa eskirib qolmasin.
    const t = setInterval(load, 10 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [isAuthenticated, user]);

  if (!data || data.total === 0 || dismissed) return null;

  const hide = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem('ils:milestone-banner-hidden', '1');
    } catch {
      /* muhim emas */
    }
  };

  const parts: string[] = [];
  if (data.demoDay > 0) parts.push(`${data.demoDay} ta demo day`);
  if (data.exam > 0) parts.push(`${data.exam} ta imtihon`);

  return (
    <div className="border-b border-red-500/30 bg-red-500/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />

          <div className="flex-1 min-w-0">
            <p className="text-red-400 font-bold text-base sm:text-lg leading-tight">
              {parts.join(' va ')} kechikdi
            </p>

            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-red-400/80 hover:text-red-300 underline underline-offset-2 mt-1"
            >
              {expanded ? 'Yashirish' : "Ro'yxatni ko'rish"}
            </button>

            {expanded && (
              <ul className="mt-3 space-y-1.5">
                {data.items.map((it) => (
                  <li key={it.id} className="text-sm text-zinc-300 flex flex-wrap gap-x-2">
                    <span className="font-semibold text-white">{it.groupName}</span>
                    <span className="text-zinc-500">·</span>
                    <span>{it.type === 'demo_day' ? 'Demo day' : 'Imtihon'}</span>
                    <span className="text-zinc-500">·</span>
                    <span className="text-zinc-400">{it.teacherName}</span>
                    <span className="text-red-400 font-semibold">{it.daysLate} kun</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={hide}
            aria-label="Yopish"
            className="p-1 rounded text-red-400/60 hover:text-red-300 hover:bg-red-500/10 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
