import type { ReactNode } from 'react';
import Illustration from '@/components/brand/Illustration';

interface PageIntroProps {
  title: string;
  subtitle?: string;
  /** O'ngdagi banner. Berilmasa sarlavha butun kenglikni oladi. */
  banner?: ReactNode;
  /** Sarlavha yonidagi harakatlar (filtr, tugma) */
  actions?: ReactNode;
}

/**
 * Sahifa sarlavhasi + o'ngdagi banner — DESIGN-GUIDE 7-bo'lim.
 * Ustunlar 2fr / 3fr; 1279px dan pastda banner keyingi qatorga tushadi.
 */
export default function PageIntro({ title, subtitle, banner, actions }: PageIntroProps) {
  return (
    <section
      className={`mb-4 grid items-center gap-4 ${
        banner ? 'grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]' : 'grid-cols-1'
      }`}
    >
      <div className="min-w-0">
        <h1 className="m-0 font-bold tracking-[-0.02em] text-[clamp(1.75rem,3.4vw,2.625rem)] leading-[1.19]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-base sm:text-lg leading-[1.4]" style={{ color: 'var(--muted-foreground)' }}>
            {subtitle}
          </p>
        )}
        {actions && <div className="mt-4 flex flex-wrap gap-3">{actions}</div>}
      </div>

      {banner}
    </section>
  );
}

/**
 * Dashboardning o'ng bannerи — kitob va o'simlik kompozitsiyasi.
 * Matn HTMLda turadi, rasmga "bake" qilinmaydi (DESIGN-GUIDE 7-bo'lim).
 */
export function EducationBanner() {
  return (
    <div
      className="relative min-w-0 overflow-hidden rounded-[20px] border px-6 py-6 sm:px-8"
      style={{
        background: 'var(--banner-fill)',
        borderColor: 'var(--border)',
        minHeight: 188,
      }}
    >
      {/* Brend chevron naqshi — dekorativ */}
      <div
        className="ils-pattern pointer-events-none absolute inset-y-0 right-0 w-2/3"
        aria-hidden="true"
        style={{
          backgroundImage:
            'repeating-linear-gradient(115deg, var(--brand-red) 0 2px, transparent 2px 22px)',
        }}
      />

      <div className="relative flex items-center gap-5">
        <div className="min-w-0 flex-1">
          <p className="text-[clamp(1.25rem,2.4vw,1.875rem)] font-bold leading-[1.2]">
            Katta natijalar
          </p>
          <p
            className="text-[clamp(1.25rem,2.4vw,1.875rem)] font-bold leading-[1.2]"
            style={{ color: 'var(--primary)' }}
          >
            birgalikda yaratiladi
          </p>
        </div>

        <Illustration name="hero-education" size={150} />

        <p
          className="hidden lg:block w-[136px] shrink-0 text-sm leading-5"
          style={{ color: 'var(--muted-foreground)' }}
        >
          Ta'lim yangi imkoniyatlar eshigini ochadi
          <span
            className="mt-3 block h-[3px] w-8 rounded"
            style={{ background: 'var(--primary)' }}
            aria-hidden="true"
          />
        </p>
      </div>
    </div>
  );
}
