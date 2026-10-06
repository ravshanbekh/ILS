/**
 * Soniyalarni o'qishga qulay ko'rinishga keltiradi (normativ vaqti va h.k.).
 *
 *   30   -> "30 sek"
 *   60   -> "1 daq"
 *   180  -> "3 daq"
 *   90   -> "1 daq 30 sek"
 *   3600 -> "60 daq"
 *
 * Ilgari hamma joyda "420 sek" yozilardi — katta raqamni ko'z bilan daqiqaga
 * aylantirish kerak edi. Aniq soniya kerak bo'lsa `title` sifatida
 * `formatSecondsExact` ishlatiladi.
 */
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds) || totalSeconds <= 0) return '—';
  const s = Math.round(totalSeconds);
  if (s < 60) return `${s} sek`;
  const min = Math.floor(s / 60);
  const rest = s % 60;
  return rest === 0 ? `${min} daq` : `${min} daq ${rest} sek`;
}

/** Tooltip uchun aniq qiymat: "420 soniya" */
export function formatSecondsExact(totalSeconds: number): string {
  return `${Math.round(totalSeconds)} soniya`;
}
