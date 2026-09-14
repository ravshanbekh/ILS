import { useState } from 'react';

/**
 * iTLive Score logotipi — DESIGN-GUIDE 3-bo'lim ("Logo shartnomasi").
 *
 * ⚠️ OCHIQ MASALA
 * Qo'llanma logoni fontdan qayta terishni TAQIQLAYDI va original SVG'dan
 * foydalanishni talab qiladi. Ammo repoda iTLive wordmark'ining toza SVG
 * fayli YO'Q:
 *   - public/icon.svg  — logo emas, boshqa grafik
 *   - public/favicon.svg — binafsha rangli begona belgi
 * Original faqat design/it-live-score/references/IT-identity.pdf ichida.
 *
 * Shu sabab bu komponent avval haqiqiy faylni yuklashga uradi, topilmasa
 * VAQTINCHALIK tipografik lockup chizadi. PDF'dan SVG eksport qilib
 * `public/brand/itlive-logo-light.svg` va `...-dark.svg` nomi bilan
 * qo'yilsa, kodga tegmasdan haqiqiy logo chiqadi.
 *
 * "Score" — wordmark ostidagi MUSTAQIL matn, logotipning ichki qismi emas.
 */

interface BrandLogoProps {
  /** Wordmark kengligi (px). Sidebar referensida ≈128px */
  width?: number;
  /** "Score" pastki yozuvini ko'rsatish */
  showScore?: boolean;
  className?: string;
}

export default function BrandLogo({ width = 128, showScore = true, className = '' }: BrandLogoProps) {
  const [failed, setFailed] = useState(false);

  return (
    <span className={`inline-flex flex-col items-start ${className}`}>
      {failed ? (
        // ── Vaqtinchalik lockup (original SVG kelguncha) ──
        <span
          className="font-bold leading-none tracking-[-0.02em]"
          style={{ fontSize: width * 0.28 }}
          aria-hidden="true"
        >
          <span style={{ color: 'var(--brand-red)' }}>iT</span>
          <span style={{ color: 'var(--foreground)' }}>Live</span>
          <span
            className="ml-[2px] inline-block align-super rounded-[2px]"
            style={{ width: width * 0.045, height: width * 0.045, background: 'var(--brand-red)' }}
          />
        </span>
      ) : (
        <img
          src="/brand/itlive-logo.svg"
          width={width}
          style={{ width }}
          className="block h-auto"
          onError={() => setFailed(true)}
          alt="IT Live Score"
        />
      )}

      {showScore && (
        <span
          className="mt-1 font-normal leading-none"
          style={{ fontSize: Math.max(14, width * 0.172), color: 'var(--foreground)' }}
        >
          Score
        </span>
      )}

      {/* Ekran o'quvchi uchun yagona nom — fallbackda ham, rasmda ham */}
      <span className="sr-only">IT Live Score</span>
    </span>
  );
}
