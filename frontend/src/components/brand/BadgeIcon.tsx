import { useState } from 'react';
import { versioned } from './assetVersion';

/**
 * Yutuq (badge) 3D ikonkasi.
 *
 * Backend har bir badge nomini emoji bilan boshlaydi ("🐉 Ajdarho").
 * Shuning uchun fallback tayyor: asset topilmasa o'sha emoji chiziladi —
 * ya'ni fayllar kelmaguncha ham sahifa avvalgidek to'liq ishlaydi.
 *
 * Fayl yo'li: /illustrations/badges/<badgeId>.webp
 * Ro'yxat va promptlar: design/it-live-score/ASSET-PROMPTS.md
 */

interface BadgeIconProps {
  /** Backenddagi badge id si: first_green, dragon, rocket ... */
  badgeId: string;
  /** Nomdan ajratilgan emoji — asset bo'lmasa shu ko'rsatiladi */
  emoji?: string;
  size?: number;
  className?: string;
}

export default function BadgeIcon({ badgeId, emoji, size = 72, className = '' }: BadgeIconProps) {
  const [failed, setFailed] = useState(false);

  if (failed || !badgeId) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center leading-none ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.72 }}
        aria-hidden="true"
      >
        {emoji || '🏅'}
      </span>
    );
  }

  return (
    <img
      src={versioned(`/illustrations/badges/${badgeId}.webp`)}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`block shrink-0 object-contain ${className}`}
      onError={() => setFailed(true)}
      loading="lazy"
      decoding="async"
      /* Yutuq nomi va izohi yonida matn bilan yozilgan — takrorlanmaydi */
      alt=""
      aria-hidden="true"
    />
  );
}
