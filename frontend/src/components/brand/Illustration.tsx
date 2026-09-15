import { useState } from 'react';
import {
  GraduationCap, Presentation, Users, Award, Files, ListChecks, Hourglass, BookOpen,
  Coins, Star, Target,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * 3D illustratsiya uyasi — DESIGN-GUIDE 10-bo'lim.
 *
 * MUHIM: paketda transparent 3D asset fayllari BERILMAGAN (qo'llanmaning
 * o'zi ham buni yozgan). Shuning uchun bu komponent:
 *   1. `/illustrations/<key>.webp` ni yuklashga uradi;
 *   2. fayl yo'q bo'lsa — O'LCHAMI REZERVLANGAN vaqtinchalik belgi chizadi.
 *
 * Fallback ataylab outline ikonka: u yakuniy asset emasligi ko'rinib tursin.
 * Fayllar `public/illustrations/` ga qo'yilishi bilan kod o'zgarmasdan
 * haqiqiy 3D rasmlar chiqadi.
 */

export type IllustrationKey =
  | 'student' | 'teacher' | 'groups' | 'standards'
  | 'assignments' | 'checked' | 'pending' | 'hero-education'
  // O'quvchi kabineti
  | 'student-hero' | 'coins' | 'my-score' | 'my-done' | 'my-pending';

const FALLBACK_ICON: Record<IllustrationKey, LucideIcon> = {
  student: GraduationCap,
  teacher: Presentation,
  groups: Users,
  standards: Award,
  assignments: Files,
  checked: ListChecks,
  pending: Hourglass,
  'hero-education': BookOpen,
  'student-hero': BookOpen,
  coins: Coins,
  'my-score': Star,
  'my-done': Target,
  'my-pending': Hourglass,
};

interface IllustrationProps {
  name: IllustrationKey;
  /**
   * Kvadrat uyaning tomoni. Raqam — piksel; satr — istalgan CSS qiymati
   * (masalan `clamp(76px, 9vw, 150px)`), toraygan kartada matnni siqib
   * qo'ymasligi uchun.
   */
  size?: number | string;
  /**
   * Birinchi ekranda ko'rinadigan rasm (KPI kartalari, banner).
   * DESIGN-GUIDE 10-bo'lim: pastdagilarga lazy, birinchi ekrandagilarga
   * odatiy yuklash. Lazy qo'yilganda kartalar bir lahza bo'sh turardi.
   */
  priority?: boolean;
  className?: string;
}

export default function Illustration({ name, size = 140, priority = false, className = '' }: IllustrationProps) {
  const [failed, setFailed] = useState(false);
  const Icon = FALLBACK_ICON[name];

  // Joy har doim rezerv qilinadi — asset kelganda layout siljimasin
  const box = { width: size, height: size };
  const isNumeric = typeof size === 'number';

  if (failed) {
    return (
      <div
        className={`shrink-0 flex items-center justify-center rounded-2xl ${className}`}
        style={{
          ...box,
          background: 'var(--surface-muted)',
          border: '1px dashed var(--border)',
        }}
        aria-hidden="true"
        title="3D asset hali yuklanmagan"
      >
        <Icon
          style={{
            width: isNumeric ? (size as number) * 0.42 : '42%',
            height: isNumeric ? (size as number) * 0.42 : '42%',
            color: 'var(--muted-foreground)',
          }}
          strokeWidth={1.5}
        />
      </div>
    );
  }

  return (
    <img
      src={`/illustrations/${name}.webp`}
      width={isNumeric ? (size as number) : undefined}
      height={isNumeric ? (size as number) : undefined}
      style={box}
      className={`shrink-0 block object-contain ${className}`}
      onError={() => setFailed(true)}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding={priority ? 'sync' : 'async'}
      /* Karta matni mazmunni to'liq takrorlaydi — DESIGN-GUIDE 10-bo'lim */
      alt=""
      aria-hidden="true"
    />
  );
}
