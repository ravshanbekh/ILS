/** "Tez yozish" uchun umumiy kichik UI bo'laklari va yorliqlar */

export const MODE_LABEL: Record<string, string> = {
  solo: 'Mashq',
  duel: 'Duel',
  ffa: '4 kishilik',
  team: 'Jamoaviy',
};
export const SRC_LABEL: Record<string, string> = { en: 'English', uz: "O'zbek", tech: 'Dasturlash' };
export const variantLabel = (contentType: string, variant: string) =>
  contentType === 'text' ? `Matn · ${SRC_LABEL[variant] ?? variant}` : `Kod · ${variant}`;

export function errMsg(e: any, fallback: string) {
  const err = e?.response?.data?.error;
  return typeof err === 'string' ? err : err?.message ?? fallback;
}

/** Tezlik grafigi (har soniyadagi wpm) — CodeType chart() */
export function SpeedChart({ samples }: { samples: number[] }) {
  if (samples.length < 2) return null;
  const mx = Math.max(...samples, 10);
  const W = 600;
  const H = 110;
  const pts = samples.map((v, i) => `${((i / (samples.length - 1)) * W).toFixed(1)},${(H - (v / mx) * H * 0.9 - 5).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="110" role="img" aria-label="Tezlik grafigi" className="rounded-xl border border-zinc-800 bg-zinc-950">
      <polyline points={pts} fill="none" stroke="currentColor" className="text-orange-400" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}

export const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export const medal = (place: number | null | undefined) => (place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : place ? `${place}` : '—');
