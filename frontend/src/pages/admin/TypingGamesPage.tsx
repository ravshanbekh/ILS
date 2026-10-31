/**
 * Admin — "Tez yozish" o'yini (/admin/games).
 * Ko'rsatkichlar · Reyting (3 kategoriya, guruh) · O'yinlar · Natijalar · Jonli xonalar
 */
import { useEffect, useState } from 'react';
import { Loader2, Trophy, Swords, ListChecks, Radio, AlertTriangle, X, ChevronDown, RefreshCw } from 'lucide-react';
import Header from '@/components/layout/Header';
import { typingApi } from '@/api';
import TypingLeaderboard from '@/components/typing/TypingLeaderboard';
import TypingStats, { type TypingStatsData } from '@/components/typing/TypingStats';
import { MODE_LABEL, variantLabel, fmtDate, medal } from '@/components/typing/typingUi';
import DateInput from '@/components/shared/DateInput';

type Tab = 'rating' | 'matches' | 'results' | 'live';
const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: 'rating', label: 'Reyting', icon: Trophy },
  { key: 'matches', label: "O'yinlar", icon: Swords },
  { key: 'results', label: 'Natijalar', icon: ListChecks },
  { key: 'live', label: 'Jonli', icon: Radio },
];

export default function TypingGamesPage() {
  const [tab, setTab] = useState<Tab>('rating');
  const [ov, setOv] = useState<any>(null);
  const [student, setStudent] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    typingApi.adminOverview().then((r) => setOv(r.data.data)).catch(() => setOv(null));
  }, []);

  const kpis: [string | number, string][] = ov
    ? [
        [ov.testsLast24h, 'test (24 soat)'],
        [ov.testsLast7d, 'test (7 kun)'],
        [ov.activePlayers7d, "faol o'quvchi (7 kun)"],
        [Object.values(ov.matches7d ?? {}).reduce((a: number, b: any) => a + Number(b), 0) as number, 'bellashuv (7 kun)'],
        [`${ov.avgWpm7d} / ${ov.avgAccuracy7d}%`, "o'rtacha wpm / aniqlik"],
        [ov.flagged7d, 'shubhali natija (7 kun)'],
      ]
    : [];

  return (
    <div>
      <Header title="Tez yozish" subtitle="O'quvchilar o'yini: reyting, bellashuvlar va barcha natijalar" />
      <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {ov
            ? kpis.map(([v, l], i) => (
                <div key={l} className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5">
                  <div className={`text-2xl font-black tabular-nums ${i === 5 && Number(v) > 0 ? 'text-red-400' : 'text-zinc-100'}`}>{v}</div>
                  <div className="text-[11px] text-zinc-500">{l}</div>
                </div>
              ))
            : <div className="col-span-full flex h-16 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-zinc-500" /></div>}
        </div>
        {ov?.topToday && (
          <p className="text-sm text-zinc-400">
            Bugungi eng tez: <b className="text-zinc-100">{ov.topToday.fullName}</b> — <b className="text-orange-400">{ov.topToday.wpm} wpm</b> ({ov.topToday.accuracy}%, {ov.topToday.contentType === 'code' ? 'kod' : 'matn'})
          </p>
        )}

        <div className="flex gap-1 overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold ${tab === t.key ? 'bg-orange-500 text-white' : 'text-zinc-400 hover:text-zinc-100'}`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>

        {tab === 'rating' && <TypingLeaderboard showGroupFilter />}
        {tab === 'matches' && <Matches onStudent={setStudent} />}
        {tab === 'results' && <Results onStudent={setStudent} />}
        {tab === 'live' && <Live />}
      </div>
      {student && <StudentModal student={student} onClose={() => setStudent(null)} />}
    </div>
  );
}

function Matches({ onStudent }: { onStudent: (s: { id: string; name: string }) => void }) {
  const [mode, setMode] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    setData(null);
    typingApi.adminMatches({ mode: mode || undefined, page, limit: 20 }).then((r) => setData(r.data.data)).catch(() => setData({ items: [], total: 0 }));
  }, [mode, page]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {[['', 'Hammasi'], ['duel', 'Duel'], ['ffa', '4 kishilik'], ['team', 'Jamoaviy'], ['class', 'Sinf musobaqasi']].map(([k, l]) => (
          <button key={k} onClick={() => { setMode(k); setPage(1); }} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${mode === k ? 'bg-zinc-100 text-zinc-900' : 'border border-zinc-800 bg-zinc-900 text-zinc-400'}`}>{l}</button>
        ))}
      </div>
      {!data ? (
        <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-zinc-500" /></div>
      ) : data.items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-800 py-8 text-center text-sm text-zinc-500">Hozircha bellashuv yo'q</p>
      ) : (
        <ul className="space-y-2">
          {data.items.map((m: any) => {
            const winner = m.mode === 'team' ? (m.winnerTeam === 'draw' ? 'Durang' : `Jamoa ${m.winnerTeam}`) : m.players.find((p: any) => p.place === 1)?.user.fullName;
            return (
              <li key={m.id} className="rounded-2xl border border-zinc-800 bg-zinc-900">
                <button onClick={() => setOpen(open === m.id ? null : m.id)} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left">
                  <span className="rounded-lg bg-zinc-950 px-2 py-1 text-xs font-bold text-orange-400">{MODE_LABEL[m.mode]}</span>
                  {m.mode === 'class' && <span className="text-sm font-semibold text-zinc-100">{m.title || m.code}</span>}
                  <span className="text-sm text-zinc-300">{variantLabel(m.contentType, m.variant)}</span>
                  <span className="text-xs text-zinc-500">{m.players.length} o'yinchi · {fmtDate(m.startedAt)}{m.mode === 'class' && m.host?.fullName ? ` · Mentor: ${m.host.fullName}` : ''}</span>
                  <span className="ml-auto text-sm text-zinc-200">🏆 {winner ?? '—'}</span>
                  <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform ${open === m.id ? 'rotate-180' : ''}`} />
                </button>
                {open === m.id && (
                  <div className="overflow-x-auto border-t border-zinc-800">
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs text-zinc-500">
                        <tr>
                          <th className="px-4 py-2">O'rin</th><th className="px-4 py-2">O'quvchi</th>
                          {m.mode === 'team' && <th className="px-4 py-2">Jamoa</th>}
                          <th className="px-4 py-2">WPM</th><th className="px-4 py-2">Aniqlik</th><th className="px-4 py-2">Holat</th><th className="px-4 py-2">Reyting</th>
                        </tr>
                      </thead>
                      <tbody>
                        {m.players.map((p: any) => (
                          <tr key={p.user.id} className="border-t border-zinc-800">
                            <td className="px-4 py-2">{medal(p.place)}</td>
                            <td className="px-4 py-2"><button onClick={() => onStudent({ id: p.user.id, name: p.user.fullName })} className="font-semibold text-zinc-100 hover:text-orange-400">{p.user.fullName}</button></td>
                            {m.mode === 'team' && <td className={`px-4 py-2 font-bold ${p.team === 'A' ? 'text-orange-400' : 'text-sky-400'}`}>{p.team}</td>}
                            <td className="px-4 py-2 font-bold tabular-nums text-orange-400">{p.wpm}</td>
                            <td className="px-4 py-2 tabular-nums">{p.accuracy}%</td>
                            <td className="px-4 py-2 text-xs text-zinc-400">{p.outcome === 'finished' ? 'tugatdi' : p.outcome === 'timeout' ? 'vaqt tugadi' : 'chiqib ketdi'}</td>
                            <td className="px-4 py-2 tabular-nums text-xs">
                              {p.ratingBefore != null ? <span className={p.ratingAfter >= p.ratingBefore ? 'text-emerald-400' : 'text-red-400'}>{p.ratingBefore} → {p.ratingAfter}</span> : <span className="text-zinc-500">hisoblanmadi</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {data && data.total > 20 && <Pager page={page} total={data.total} limit={20} onPage={setPage} />}
    </div>
  );
}

function Results({ onStudent }: { onStudent: (s: { id: string; name: string }) => void }) {
  const [f, setF] = useState({ search: '', mode: '', contentType: '', flagged: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    setData(null);
    const t = setTimeout(() => {
      const params: Record<string, string | number | undefined> = { page, limit: 50 };
      for (const [k, v] of Object.entries(f)) if (v) params[k] = v;
      typingApi.adminResults(params).then((r) => setData(r.data.data)).catch(() => setData({ items: [], total: 0 }));
    }, 250);
    return () => clearTimeout(t);
  }, [f, page]);
  const set = (k: keyof typeof f, v: string) => { setF((p) => ({ ...p, [k]: v })); setPage(1); };
  const sel = 'rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-200';
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input value={f.search} onChange={(e) => set('search', e.target.value)} placeholder="O'quvchi ismi" className={`${sel} w-44`} aria-label="Qidiruv" />
        <select value={f.mode} onChange={(e) => set('mode', e.target.value)} className={sel} aria-label="Rejim">
          <option value="">Barcha rejimlar</option><option value="solo">Mashq</option><option value="duel">Duel</option><option value="ffa">4 kishilik</option><option value="team">Jamoaviy</option><option value="class">Sinf musobaqasi</option>
        </select>
        <select value={f.contentType} onChange={(e) => set('contentType', e.target.value)} className={sel} aria-label="Turi">
          <option value="">Matn va kod</option><option value="text">Matn</option><option value="code">Kod</option>
        </select>
        <select value={f.flagged} onChange={(e) => set('flagged', e.target.value)} className={sel} aria-label="Tekshiruv">
          <option value="">Hammasi</option><option value="true">Faqat shubhali</option><option value="false">Tekshiruvdan o'tgan</option>
        </select>
        <DateInput value={f.from} onChange={(e) => set('from', e.target.value)} className={sel} aria-label="Dan" />
        <DateInput value={f.to} onChange={(e) => set('to', e.target.value)} className={sel} aria-label="Gacha" />
      </div>
      {!data ? (
        <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-zinc-500" /></div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-left text-xs text-zinc-500">
              <tr>
                <th className="px-3 py-2">Sana</th><th className="px-3 py-2">O'quvchi</th><th className="px-3 py-2">Rejim</th><th className="px-3 py-2">Turi</th>
                <th className="px-3 py-2">WPM</th><th className="px-3 py-2">Aniqlik</th><th className="px-3 py-2">Xato</th><th className="px-3 py-2">O'rin</th><th className="px-3 py-2">Tekshiruv</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-center text-zinc-500">Natija topilmadi</td></tr>}
              {data.items.map((r: any) => (
                <tr key={r.id} className="border-t border-zinc-800">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-400">{fmtDate(r.createdAt)}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => onStudent({ id: r.user.id, name: r.user.fullName })} className="font-semibold text-zinc-100 hover:text-orange-400">{r.user.fullName}</button>
                    {r.groups.length > 0 && <div className="text-[11px] text-zinc-500">{r.groups.join(', ')}</div>}
                  </td>
                  <td className="px-3 py-2 text-zinc-300">{MODE_LABEL[r.mode]}</td>
                  <td className="px-3 py-2 text-xs text-zinc-400">{variantLabel(r.contentType, r.variant)} · {r.durationSec} s</td>
                  <td className="px-3 py-2 font-bold tabular-nums text-orange-400">{r.wpm}</td>
                  <td className="px-3 py-2 tabular-nums">{r.accuracy}%</td>
                  <td className="px-3 py-2 tabular-nums text-zinc-400">{r.errors}</td>
                  <td className="px-3 py-2">{r.mode === 'solo' ? '—' : medal(r.place)}</td>
                  <td className="px-3 py-2 text-xs">
                    {r.flagged ? <span className="inline-flex items-center gap-1 text-red-400" title={r.flagReason ?? ''}><AlertTriangle className="h-3.5 w-3.5" /> {r.flagReason}</span> : <span className="text-emerald-400">✓</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-500">Jami {data.total} ta natija</div>
        </div>
      )}
      {data && data.total > 50 && <Pager page={page} total={data.total} limit={50} onPage={setPage} />}
    </div>
  );
}

function Live() {
  const [rooms, setRooms] = useState<any[] | null>(null);
  const load = () => typingApi.adminLive().then((r) => setRooms(r.data.data)).catch(() => setRooms([]));
  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);
  const ST: Record<string, string> = { lobby: 'kutilmoqda', countdown: 'sanoq', running: 'davom etmoqda', finished: 'tugadi' };
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-xs text-zinc-500"><RefreshCw className="h-3.5 w-3.5" /> Har 5 soniyada yangilanadi</p>
      {!rooms ? (
        <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-zinc-500" /></div>
      ) : rooms.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-800 py-8 text-center text-sm text-zinc-500">Hozir ochiq xona yo'q</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rooms.map((r) => (
            <div key={r.code} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="font-mono font-black tracking-widest text-zinc-100">{r.code}</span>
                <span className="min-w-0 truncate text-xs text-zinc-400">{r.mode === 'class' ? `${r.title || MODE_LABEL.class} · ${r.host}` : MODE_LABEL[r.mode]} · {variantLabel(r.contentType, r.variant)}</span>
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold ${r.status === 'running' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>{ST[r.status]}</span>
              </div>
              <ul className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
                {r.players.map((p: any, i: number) => (
                  <li key={i} className="text-sm">
                    <div className="flex justify-between text-zinc-300"><span>{p.fullName}{p.team ? ` (${p.team})` : ''}{p.left ? ' — chiqdi' : ''}</span><span className="text-xs text-zinc-500">{p.finished ? '✓' : `${Math.round((p.pos / Math.max(r.textLength, 1)) * 100)}%`}</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full bg-orange-500" style={{ width: `${Math.min(100, (p.pos / Math.max(r.textLength, 1)) * 100)}%` }} /></div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StudentModal({ student, onClose }: { student: { id: string; name: string }; onClose: () => void }) {
  const [data, setData] = useState<TypingStatsData | null>(null);
  useEffect(() => {
    typingApi.adminStudentStats(student.id).then((r) => setData(r.data.data)).catch(() => undefined);
  }, [student.id]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8" onClick={onClose}>
      <div className="w-full max-w-4xl rounded-2xl border border-zinc-800 bg-zinc-950 p-5" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={student.name}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-black text-zinc-100">{student.name} — tez yozish</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800" aria-label="Yopish"><X className="h-5 w-5" /></button>
        </div>
        <TypingStats data={data} />
      </div>
    </div>
  );
}

function Pager({ page, total, limit, onPage }: { page: number; total: number; limit: number; onPage: (p: number) => void }) {
  const pages = Math.ceil(total / limit);
  return (
    <div className="flex items-center justify-center gap-2 text-sm">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-lg bg-zinc-800 px-3 py-1.5 text-zinc-200 disabled:opacity-40">‹</button>
      <span className="text-zinc-400">{page} / {pages}</span>
      <button disabled={page >= pages} onClick={() => onPage(page + 1)} className="rounded-lg bg-zinc-800 px-3 py-1.5 text-zinc-200 disabled:opacity-40">›</button>
    </div>
  );
}
