import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * Navigatsiya ikonkasi — 3D asset, topilmasa outline ikonka.
 *
 * Yo'l: /illustrations/nav/<name>.webp
 *
 * Fallback ataylab MAVJUD lucide ikonkasi: fayllar bo'lmasa ham menyu
 * hozirgidek to'liq ishlaydi va bittalab qo'shib borish mumkin —
 * hammasini birdan yaratish shart emas.
 *
 * Kalit qanday olinadi (Sidebar.tsx da):
 *   bo'lim sarlavhasi -> `group-<group.id>`   (masalan group-users_groups)
 *   ichki havola      -> route'ning oxirgi bo'lagi (/admin/users -> users)
 * Oxirgi bo'lak tanlangani bejiz emas: bitta sahifa rolga qarab
 * /admin/users yoki /viewer/kassir/users bo'lishi mumkin, lekin ikonka
 * bitta bo'lishi kerak.
 */

interface NavIconProps {
  /** Asset nomi (kengaytmasiz) */
  name: string;
  /** Asset topilmaganda chiziladigan outline ikonka */
  fallback: LucideIcon;
  size?: number;
  className?: string;
}

export default function NavIcon({ name, fallback: Fallback, size = 20, className = '' }: NavIconProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <Fallback
        className={`shrink-0 ${className}`}
        style={{ width: size, height: size }}
        strokeWidth={1.9}
        aria-hidden="true"
      />
    );
  }

  return (
    <img
      src={`/illustrations/nav/${name}.webp`}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`block shrink-0 object-contain ${className}`}
      onError={() => setFailed(true)}
      loading="lazy"
      decoding="async"
      /* Yonida havola matni bor — ikonka dekorativ */
      alt=""
      aria-hidden="true"
    />
  );
}
