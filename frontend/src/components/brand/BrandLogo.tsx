import BrandMark from './BrandMark';

/**
 * iTLive Score logotipi — DESIGN-GUIDE 3-bo'lim ("Logo shartnomasi").
 *
 * Ilgari bu yerda vaqtinchalik tipografik lockup turardi, chunki repoda
 * original wordmark yo'q edi. Endi Ravshan bergan haqiqiy vektor
 * ishlatiladi (`BrandMark`), ya'ni logo fontdan qayta terilmaydi —
 * qo'llanma aynan buni talab qilgan edi.
 *
 * "Score" — wordmark ostidagi MUSTAQIL matn, logotipning ichki qismi emas.
 * Shuning uchun u alohida element va o'z rangini theme'dan oladi.
 */

interface BrandLogoProps {
  /** Wordmark kengligi (px). Sidebar referensida ≈128px */
  width?: number;
  /** "Score" pastki yozuvini ko'rsatish */
  showScore?: boolean;
  className?: string;
}

export default function BrandLogo({ width = 128, showScore = true, className = '' }: BrandLogoProps) {
  return (
    <span className={`inline-flex flex-col items-start ${className}`}>
      <BrandMark width={width} />

      {showScore && (
        <span
          className="mt-1 font-normal leading-none"
          style={{ fontSize: Math.max(14, width * 0.172), color: 'var(--foreground)' }}
        >
          Score
        </span>
      )}

      {/* Ekran o'quvchi uchun yagona nom */}
      <span className="sr-only">IT Live Score</span>
    </span>
  );
}
