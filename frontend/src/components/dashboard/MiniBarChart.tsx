export interface SeriesPoint {
  /** ISO sana yoki davr nomi — tooltipda ko'rsatiladi */
  date: string;
  value: number;
}

interface MiniBarChartProps {
  series: SeriesPoint[] | null | undefined;
  /** Pasayish trendida boshqa rang oilasi ishlatiladi */
  direction?: 'up' | 'down' | 'flat' | 'unavailable';
  height?: number;
  className?: string;
}

/**
 * KPI kartasidagi ixcham trend grafigi — DESIGN-GUIDE 7-bo'lim.
 *
 * Muhim qoidalar:
 *  - Ma'lumot bo'lmasa BO'SH holat ko'rsatiladi, yolg'on 0 chizilmaydi.
 *  - Har kartaning o'z lokal masshtabi bor; kartalararo taqqoslash uchun
 *    emas — shuning uchun o'q va raqam yo'q, faqat tooltip.
 *  - Bu dekorativ trend: asosiy ma'no karta matni va qiymatida takrorlangan,
 *    shuning uchun grafik aria-hidden.
 */
export default function MiniBarChart({
  series,
  direction = 'up',
  height = 56,
  className = '',
}: MiniBarChartProps) {
  const points = (series ?? []).filter((p) => Number.isFinite(p.value));

  if (points.length === 0) {
    return (
      <div
        className={`flex items-end ${className}`}
        style={{ height }}
        aria-hidden="true"
      >
        {/* Bo'sh holat — joy rezerv qilinadi, karta balandligi sakramaydi */}
        <div
          className="w-full rounded"
          style={{
            height: 2,
            background: 'var(--border)',
          }}
        />
      </div>
    );
  }

  const max = Math.max(...points.map((p) => p.value), 0);
  const min = Math.min(...points.map((p) => p.value), 0);
  const span = max - min || 1;

  const strong = direction === 'down' ? 'var(--chart-down)' : 'var(--chart-up)';
  const soft = direction === 'down' ? 'var(--chart-down-soft)' : 'var(--chart-up-soft)';

  return (
    <div className={`flex items-end gap-[6px] ${className}`} style={{ height }}>
      {points.map((p, i) => {
        const ratio = (p.value - min) / span;
        // Eng kichik ustun ham ko'rinib tursin
        const barHeight = Math.max(4, Math.round(ratio * height));
        // Oxirgi ustunlar to'yingan, oldingilari xira — trend yo'nalishini beradi
        const isRecent = i >= points.length - 3;
        return (
          <div
            key={`${p.date}-${i}`}
            className="flex-1 rounded-sm min-w-[6px]"
            style={{ height: barHeight, background: isRecent ? strong : soft }}
            title={`${p.date}: ${p.value}`}
          />
        );
      })}
    </div>
  );
}
