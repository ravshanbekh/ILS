/**
 * Reyting — 3 kategoriya:
 *   text   — Matn tezligi (eng yaxshi WPM, aniqlik ≥ 85%)
 *   code   — Kod yozish (eng yaxshi WPM)
 *   battle — Jang reytingi (ELO, bellashuvlardan)
 * Shubhali (flagged) natijalar reytingga kirmaydi.
 */
import { useEffect, useState } from 'react';
import { Loader2, Type, Code2, Swords } from 'lucide-react';
import { typingApi, groupsApi, type TypingCategory, type TypingPeriod, type TypingLeaderRow } from '@/api';
import { SRC_LABEL, medal } from './typingUi';

const CATS: { key: TypingCategory; label: string; icon: any; unit: string }[] = [
  { key: 'text', label: 'Matn tezligi', icon: Type, unit: 'wpm' },
  { key: 'code', label: 'Kod yozish', icon: Code2, unit: 'wpm' },
  { key: 'battle', label: 'Jang reytingi', icon: Swords, unit: 'ball' },
];
const PERIODS: [TypingPeriod, string][] = [
  ['week', 'Hafta'],
  ['month', 'Oy'],
  ['all', 'Hammasi'],
];

export default function TypingLeaderboard({ showGroupFilter = false, refreshKey }: { showGroupFilter?: boolean; refreshKey?: number }) {
  const [cat, setCat] = useState<TypingCategory>('text');
  const [period, setPeriod] = useState<TypingPeriod>('all');
  const [groupId, setGroupId] = useState('');
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [data, setData] = useState<{ total: number; top: TypingLeaderRow[]; me: TypingLeaderRow | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!showGroupFilter) return;
    groupsApi
      .getAll(1, 300)
      .then((r) => setGroups((r.data?.data?.data ?? r.data?.data ?? []).map((g: any) => ({ id: g.id, name: g.name }))))
      .catch(() => setGroups([]));
  }, [showGroupFilter]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    typingApi
      .leaderboard({ category: cat, period, groupId: groupId || undefined, limit: 100 })
      .then((r) => setData(r.data.data))
      .catch(() => setError('Reytingni yuklab bo\'lmadi'))
      .finally(() => setLoading(false));
  }, [cat, period, groupId, refreshKey]);

  const unit = CATS.find((c) => c.key === cat)!.unit;
  const row = (r: TypingLeaderRow, highlight = false) => (
    <tr key={r.userId} className={`border-t border-zinc-800 ${highlight ? 'bg-orange-500/10' : ''}`}>
      <td className="px-3 py-2 text-lg tabular-nums">{medal(r.rank)}</td>
      <td className="px-3 py-2">
        <div className="font-semibold text-zinc-100">{r.fullName}</div>
        {r.groups.length > 0 && <div className="text-[11px] text-zinc-500">{r.groups.join(', ')}</div>}
      </td>
      <td className="px-3 py-2 font-black tabular-nums text-orange-400">
        {r.value} <span className="text-[11px] font-normal text-zinc-500">{unit}</span>
      </td>
      <td className="px-3 py-2 text-xs text-zinc-400">
        {cat === 'battle'
          ? `${r.detail} · ${r.extra} o'yin`
          : `${r.accuracy}% · ${cat === 'text' ? `${SRC_LABEL[r.detail ?? ''] ?? r.detail} · ${r.extra} s` : r.detail}`}
      </td>
    </tr>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {CATS.map((c) => (
          <button
            key={c.key}
            onClick={() => setCat(c.key)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold ${cat === c.key ? 'bg-orange-500 text-white' : 'border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-100'}`}
          >
            <c.icon className="h-4 w-4" /> {c.label}
          </button>
        ))}
        {cat !== 'battle' && (
          <div className="ml-auto flex gap-1">
            {PERIODS.map(([k, l]) => (
              <button key={k} onClick={() => setPeriod(k)} className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${period === k ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-900 text-zinc-400 border border-zinc-800'}`}>
                {l}
              </button>
            ))}
          </div>
        )}
        {showGroupFilter && (
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={`rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-200 ${cat === 'battle' ? 'ml-auto' : ''}`} aria-label="Guruh">
            <option value="">Barcha guruhlar</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        )}
      </div>
      <p className="text-xs text-zinc-500">
        {cat === 'battle'
          ? 'Duel, 4 kishilik va jamoaviy bellashuvlardagi ELO reyting (boshlanishi 1000). Yutsangiz oshadi, yutqazsangiz kamayadi.'
          : `Har o'quvchining eng yaxshi natijasi. Aniqlik kamida 85% bo'lishi kerak; shubhali natijalar hisobga olinmaydi.`}
      </p>

      {loading ? (
        <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-zinc-500" /></div>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : !data || data.top.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-800 py-8 text-center text-sm text-zinc-500">Hozircha natija yo'q — birinchi bo'ling!</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-left text-xs text-zinc-500">
              <tr>
                <th className="w-16 px-3 py-2">O'rin</th>
                <th className="px-3 py-2">O'quvchi</th>
                <th className="px-3 py-2">Natija</th>
                <th className="px-3 py-2">Tafsilot</th>
              </tr>
            </thead>
            <tbody>
              {data.top.map((r) => row(r, r.userId === data.me?.userId))}
              {data.me && !data.top.some((r) => r.userId === data.me!.userId) && (
                <>
                  <tr><td colSpan={4} className="px-3 py-1 text-center text-xs text-zinc-600">…</td></tr>
                  {row(data.me, true)}
                </>
              )}
            </tbody>
          </table>
          <div className="border-t border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-500">Jami {data.total} o'quvchi</div>
        </div>
      )}
    </div>
  );
}
