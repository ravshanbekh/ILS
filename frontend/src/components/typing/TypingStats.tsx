/** Shaxsiy statistika: rekordlar, jang reytingi, oxirgi natijalar */
import { Loader2, AlertTriangle } from 'lucide-react';
import { MODE_LABEL, variantLabel, fmtDate, medal } from './typingUi';

export interface TypingStatsData {
  totalTests: number;
  battles: number;
  avgWpm: number;
  avgAccuracy: number;
  bestCombo: number;
  bestTextByDuration: Record<string, number>;
  bestCode: { wpm: number; variant: string; accuracy: number } | null;
  rating: { rating: number; wins: number; losses: number; draws: number; matches: number };
  recent: {
    id: string; mode: string; contentType: string; variant: string; durationSec: number; wpm: number;
    accuracy: number; errors: number; place: number | null; flagged: boolean; createdAt: string;
  }[];
}

export default function TypingStats({ data, loading }: { data: TypingStatsData | null; loading?: boolean }) {
  if (loading || !data) return <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-zinc-500" /></div>;
  const best = (d: number) => data.bestTextByDuration[String(d)] ?? '—';
  const cards: [string | number, string][] = [
    [data.totalTests, 'jami test'],
    [data.avgWpm, "o'rtacha wpm"],
    [`${data.avgAccuracy}%`, "o'rtacha aniqlik"],
    [data.bestCombo, 'eng uzun combo'],
    [data.bestCode ? `${data.bestCode.wpm}` : '—', `kod rekordi${data.bestCode ? ` (${data.bestCode.variant})` : ''}`],
    [data.rating.rating, `jang reytingi · ${data.rating.wins}G ${data.rating.losses}M ${data.rating.draws}D`],
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map(([v, l], i) => (
          <div key={l} className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5">
            <div className={`text-2xl font-black tabular-nums ${i === 5 ? 'text-orange-400' : 'text-zinc-100'}`}>{v}</div>
            <div className="text-[11px] text-zinc-500">{l}</div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="mb-2 text-sm font-semibold text-zinc-100">Matn rekordlari (mashq)</div>
        <div className="grid grid-cols-4 gap-2">
          {[15, 30, 60, 120].map((d) => (
            <div key={d} className="rounded-xl bg-zinc-950 px-3 py-2 text-center">
              <div className="text-xl font-black tabular-nums text-orange-400">{best(d)}</div>
              <div className="text-[11px] text-zinc-500">{d} s · wpm</div>
            </div>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-left text-xs text-zinc-500">
            <tr>
              <th className="px-3 py-2">Sana</th>
              <th className="px-3 py-2">Rejim</th>
              <th className="px-3 py-2">Turi</th>
              <th className="px-3 py-2">WPM</th>
              <th className="px-3 py-2">Aniqlik</th>
              <th className="px-3 py-2">O'rin</th>
            </tr>
          </thead>
          <tbody>
            {data.recent.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-zinc-500">Hozircha natija yo'q</td></tr>
            )}
            {data.recent.map((r) => (
              <tr key={r.id} className="border-t border-zinc-800">
                <td className="px-3 py-2 whitespace-nowrap text-xs text-zinc-400">{fmtDate(r.createdAt)}</td>
                <td className="px-3 py-2 text-zinc-200">{MODE_LABEL[r.mode] ?? r.mode}</td>
                <td className="px-3 py-2 text-xs text-zinc-400">{variantLabel(r.contentType, r.variant)}{r.contentType === 'text' && r.mode === 'solo' ? ` · ${r.durationSec} s` : ''}</td>
                <td className="px-3 py-2 font-bold tabular-nums text-orange-400">
                  {r.wpm}
                  {r.flagged && <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-red-400" aria-label="Shubhali" />}
                </td>
                <td className="px-3 py-2 tabular-nums text-zinc-300">{r.accuracy}%</td>
                <td className="px-3 py-2">{r.mode === 'solo' ? '—' : medal(r.place)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
