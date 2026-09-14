/**
 * Davrlararo o'zgarishni hisoblash — DESIGN-GUIDE 7-bo'lim (TrendBadge).
 *
 * Ikkita tushuncha ATAYLAB ajratilgan:
 *   direction — son ko'paydimi yoki kamaydimi (matematik fakt)
 *   impact    — bu biznes uchun yaxshimi yoki yomonmi (mahsulot qoidasi)
 *
 * Sabab: "Kutilmoqda -28%" — tekshirilmagan topshiriqlar navbati qisqargani,
 * ya'ni YAXSHI natija. Rangni yagona signal sifatida ishlatib bo'lmaydi.
 */

export type DeltaDirection = 'up' | 'down' | 'flat' | 'unavailable';
export type DeltaImpact = 'favorable' | 'unfavorable' | 'neutral' | 'unknown';

/** Metrika o'sgani yaxshimi yoki kamaygani yaxshimi. */
export type MetricPolarity = 'higher-is-better' | 'lower-is-better' | 'neutral';

export interface DeltaResult {
  direction: DeltaDirection;
  impact: DeltaImpact;
  /** null — foiz ko'rsatib bo'lmaydi (baza yo'q yoki 0 dan o'sgan) */
  percent: number | null;
  /** Badge ichidagi qisqa yozuv */
  label: string;
  /** Tooltip uchun to'liq izoh */
  description: string;
}

function impactOf(direction: DeltaDirection, polarity: MetricPolarity): DeltaImpact {
  if (direction === 'unavailable') return 'unknown';
  if (direction === 'flat' || polarity === 'neutral') return 'neutral';
  const good = polarity === 'higher-is-better' ? 'up' : 'down';
  return direction === good ? 'favorable' : 'unfavorable';
}

/**
 * @param current      hozirgi davr qiymati
 * @param previous     oldingi davr qiymati; null/undefined — taqqoslash yo'q
 * @param polarity     metrikaning yo'nalishi
 * @param periodLabel  tooltipda ko'rsatiladigan davr nomi
 */
export function computeDelta(
  current: number | null | undefined,
  previous: number | null | undefined,
  polarity: MetricPolarity = 'higher-is-better',
  periodLabel = "o'tgan oyga nisbatan",
): DeltaResult {
  // Taqqoslash uchun baza yo'q — foiz o'ylab topilmaydi
  if (current == null || previous == null || !Number.isFinite(current) || !Number.isFinite(previous)) {
    return {
      direction: 'unavailable',
      impact: 'unknown',
      percent: null,
      label: 'Taqqoslash mavjud emas',
      description: "Oldingi davr ma'lumoti yo'q, shuning uchun o'zgarish hisoblanmadi",
    };
  }

  if (previous === 0) {
    if (current === 0) {
      return {
        direction: 'flat',
        impact: 'neutral',
        percent: 0,
        label: `0% ${periodLabel}`,
        description: `O'zgarish yo'q (${periodLabel})`,
      };
    }
    // 0 dan o'sish — foiz matematik jihatdan cheksiz, shuning uchun ko'rsatilmaydi
    return {
      direction: 'up',
      impact: impactOf('up', polarity),
      percent: null,
      label: 'Yangi',
      description: `Oldingi davrda 0 edi, hozir ${current} (${periodLabel})`,
    };
  }

  // Manfiy bazada foiz formulasi chalg'itadi — faqat yo'nalish ko'rsatiladi
  if (previous < 0) {
    const dir: DeltaDirection = current > previous ? 'up' : current < previous ? 'down' : 'flat';
    return {
      direction: dir,
      impact: impactOf(dir, polarity),
      percent: null,
      label: `${previous} → ${current}`,
      description: `Manfiy bazada foiz hisoblanmaydi (${periodLabel})`,
    };
  }

  const raw = ((current - previous) / previous) * 100;
  const percent = Math.round(raw * 10) / 10;
  const direction: DeltaDirection = percent > 0 ? 'up' : percent < 0 ? 'down' : 'flat';
  const sign = percent > 0 ? '+' : '';

  return {
    direction,
    impact: impactOf(direction, polarity),
    percent,
    label: `${sign}${percent}%`,
    description: `${previous} → ${current} (${sign}${percent}%, ${periodLabel})`,
  };
}

/**
 * Katta sonlarni o'zbekcha ajratkich bilan yozadi: 6404 -> 6 404
 *
 * Intl'ning uz-UZ lokali brauzerga qarab vergul qo'yib yuboradi ("6,404"),
 * bu esa o'zbek tilida o'nlik ajratkich sifatida o'qiladi. Shuning uchun
 * guruhlash qo'lda, uzilmas probel (U+00A0) bilan qilinadi.
 */
export function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const negative = value < 0;
  const [intPart, frac] = Math.abs(value).toString().split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${negative ? '−' : ''}${grouped}${frac ? ',' + frac : ''}`;
}
