import { Link } from 'react-router-dom';
import TrendBadge from './TrendBadge';
import MiniBarChart from './MiniBarChart';
import type { SeriesPoint } from './MiniBarChart';
import Illustration from '@/components/brand/Illustration';
import type { IllustrationKey } from '@/components/brand/Illustration';
import { computeDelta, formatNumber } from '@/utils/delta';
import type { MetricPolarity } from '@/utils/delta';

export type StatCardState = 'loading' | 'ready' | 'empty' | 'error';

export interface StatCardProps {
  title: string;
  value: number | null;
  /** Tayyor formatlangan qiymat (foiz, pul va h.k.); berilmasa value formatlanadi */
  formattedValue?: string;
  /** Oldingi davr qiymati; null bo'lsa trend "mavjud emas" holatida chiqadi */
  previousValue?: number | null;
  /** Metrikaning yo'nalishi — "Kutilmoqda" uchun lower-is-better */
  polarity?: MetricPolarity;
  comparisonLabel?: string;
  series?: SeriesPoint[] | null;
  illustration: IllustrationKey;
  state?: StatCardState;
  /** Faqat HAQIQIY detail route bo'lsa beriladi */
  href?: string;
  /** Ikkinchi qatordagi kengroq kartalar uchun */
  size?: 'default' | 'wide';
  errorMessage?: string;
  onRetry?: () => void;
}

/**
 * KPI kartasi — DESIGN-GUIDE 7-bo'lim.
 *
 * Anatomiya: sarlavha → qiymat → taqqoslash izohi → trend badge;
 * o'ngda 3D illustratsiya; pastda mini-grafik.
 *
 * Karta o'zi tugma EMAS. `href` berilsa butun karta havolaga aylanadi va
 * ichiga boshqa bosiladigan element qo'yilmaydi (nested interactive).
 */
export default function StatCard({
  title,
  value,
  formattedValue,
  previousValue = null,
  polarity = 'higher-is-better',
  comparisonLabel = "O'tgan oyga nisbatan",
  series = null,
  illustration,
  state = 'ready',
  href,
  size = 'default',
  errorMessage,
  onRetry,
}: StatCardProps) {
  const isWide = size === 'wide';
  // Toraygan kartada rasm matnni siqib qo'ymasligi uchun suyuq o'lcham.
  // Ilgari qat'iy 140px edi va sarlavha "O'quvchil / ar" bo'lib bo'linardi.
  const illustrationSize = isWide
    ? 'clamp(84px, 11vw, 168px)'
    : 'clamp(72px, 8.5vw, 140px)';
  const delta = computeDelta(value, previousValue, polarity, comparisonLabel.toLowerCase());

  const shell =
    'relative min-w-0 rounded-[20px] border p-6 transition-shadow duration-150 ' +
    (isWide ? 'min-h-[284px] ' : 'min-h-[264px] ');

  const shellStyle = {
    background: 'var(--card-fill)',
    borderColor: 'var(--border)',
    boxShadow: 'var(--shadow-card)',
  } as const;

  // ── Yuklanmoqda: joy rezerv qilinadi, son o'rniga yolg'on 0 chizilmaydi ──
  if (state === 'loading') {
    return (
      <div className={shell} style={shellStyle} aria-busy="true" aria-label={`${title} yuklanmoqda`}>
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-2/3 rounded-lg" style={{ background: 'var(--surface-muted)' }} />
          <div className="h-14 w-1/2 rounded-lg" style={{ background: 'var(--surface-muted)' }} />
          <div className="h-10 w-2/5 rounded-xl" style={{ background: 'var(--surface-muted)' }} />
          <div className="h-14 w-full rounded-lg" style={{ background: 'var(--surface-muted)' }} />
        </div>
      </div>
    );
  }

  // ── Xato: sabab + qayta urinish. Bo'sh holat bilan aralashtirilmaydi ──
  if (state === 'error') {
    return (
      <div className={shell} style={shellStyle} role="alert">
        <h3 className="text-[clamp(1.05rem,1.5vw,1.375rem)] leading-tight font-semibold">{title}</h3>
        <p className="mt-3 text-sm" style={{ color: 'var(--danger-fg)' }}>
          {errorMessage || "Ma'lumot yuklanmadi"}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex min-h-11 items-center rounded-xl px-4 font-semibold"
            style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}
          >
            Qayta urinish
          </button>
        )}
      </div>
    );
  }

  const body = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-[clamp(1.05rem,1.5vw,1.375rem)] leading-tight font-semibold [hyphens:none] [overflow-wrap:normal]">{title}</h3>
          <p
            className="mt-2 font-bold tabular tracking-[-0.02em] text-[clamp(2rem,4.2vw,3.25rem)] leading-[1.12]"
            style={{ color: 'var(--foreground)' }}
          >
            {state === 'empty' ? '—' : (formattedValue ?? formatNumber(value))}
          </p>
        </div>

        {/* Illustratsiya matnning o'ng tomonida; ustma-ust kelmaydi */}
        <Illustration name={illustration} size={illustrationSize} className="mt-1" />
      </div>

      {state === 'empty' ? (
        <p className="mt-3 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Hozircha ma'lumot yo'q
        </p>
      ) : (
        <TrendBadge delta={delta} caption={comparisonLabel} className="mt-4" />
      )}

      <MiniBarChart
        series={series}
        direction={delta.direction}
        className="mt-5"
        height={isWide ? 60 : 52}
      />
    </>
  );

  if (href) {
    return (
      <Link
        to={href}
        className={`${shell} block hover:shadow-lg focus-visible:outline-2`}
        style={shellStyle}
      >
        {body}
      </Link>
    );
  }

  return (
    <div className={shell} style={shellStyle}>
      {body}
    </div>
  );
}
