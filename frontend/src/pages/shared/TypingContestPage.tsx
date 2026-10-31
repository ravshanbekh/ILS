/**
 * Tez yozish — SINF MUSOBAQASI (mentor: /teacher/typing-contest, admin: /admin/typing-contest).
 * Tablar: Musobaqa (jonli boshqaruv) · Tarix (o'tkazilganlar, natija, Excel).
 * O'qituvchi faqat o'zi o'tkazganlarini, admin — hammasini ko'radi (backend tekshiradi).
 */
import { useCallback, useEffect, useState } from 'react';
import { Download, GraduationCap, History, Loader2, X, AlertTriangle } from 'lucide-react';
import Header from '@/components/layout/Header';
import { typingApi } from '@/api';
import { useAuthStore } from '@/stores/authStore';
import ClassHost, { downloadClassExcel } from '@/components/typing/ClassHost';
import { variantLabel, fmtDate, medal, errMsg } from '@/components/typing/typingUi';

type Tab = 'live' | 'history';

export default function TypingContestPage() {
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin');
  const [tab, setTab] = useState<Tab>('live');
  const [refresh, setRefresh] = useState(0);
  const onFinished = useCallback(() => setRefresh((x) => x + 1), []);

  return (
    <div>
      <Header title="Tez yozish musobaqasi" subtitle="Sinf uchun musobaqa: kod bering — o'quvchilar kiradi, siz boshlaysiz, oxirida natija va Excel" />
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-8">
        <div className="flex gap-1 rounded-2xl border border-zinc-800 bg-zinc-900 p-1">
          {([
            ['live', 'Musobaqa', GraduationCap],
            ['history', isAdmin ? 'Barcha musobaqalar' : 'Tarix', History],
          ] as const).map(([k, l, Icon]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${tab === k ? 'bg-orange-500 text-white' : 'text-zinc-400 hover:text-zinc-100'}`}
            >
              <Icon className="h-4 w-4" /> {l}
            </button>
          ))}
        </div>
        {/* Musobaqa tabi boshqa tabga o'tganda ham tirik qoladi (socket uzilmasin) */}
        <div className={tab === 'live' ? '' : 'hidden'}>
          <ClassHost onFinished={onFinished} />
        </div>
        {tab === 'history' && <ClassHistory refresh={refresh} showHost={isAdmin} />}
      </div>
    </div>
  );
}

function ClassHistory({ refresh, showHost }: { refresh: number; showHost: boolean }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const LIMIT = 20;

  useEffect(() => {
    setData(null);
    typingApi
      .classMatches({ page, limit: LIMIT })
      .then((r) => setData(r.data.data))
      .catch((e) => {
        setErr(errMsg(e, 'Ro\'yxatni yuklab bo\'lmadi'));
        setData({ items: [], total: 0 });
      });
  }, [page, refresh]);

  if (!data) return <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-zinc-500" /></div>;
  return (
    <div className="space-y-3">
      {err && <p className="flex items-center gap-2 text-sm text-red-400"><AlertTriangle className="h-4 w-4" />{err}</p>}
      {data.items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-800 py-10 text-center text-sm text-zinc-500">Hali musobaqa o'tkazilmagan</p>
      ) : (
        <ul className="space-y-2">
          {data.items.map((m: any) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3">
              <div className="min-w-0 basis-full space-y-1.5 sm:basis-auto sm:flex-1">
                <div className="truncate font-bold text-zinc-100">{m.title || `Musobaqa ${m.code}`}</div>
                <div className="text-xs text-zinc-500">
                  {fmtDate(m.startedAt)} · {variantLabel(m.contentType, m.variant)}
                  {showHost && m.host?.fullName && <> · Mentor: {m.host.fullName}</>}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-400">
                  <span>
                    <b className="text-zinc-100">{m.participants}</b> o'quvchi · <b className="text-emerald-400">{m.finishedCount}</b> tugatdi · o'rt. <b className="text-orange-400">{m.avgWpm}</b> wpm
                  </span>
                  {m.top.map((t: any) => (
                    <span key={t.place} className="text-xs leading-5 text-zinc-300">{medal(t.place)} {t.fullName} <span className="text-orange-400">{t.wpm}</span></span>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button onClick={() => setOpen(m.id)} className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:bg-zinc-700">Natija</button>
                <button
                  onClick={() => downloadClassExcel(m.id, m.title, m.code).catch(() => setErr('Excel yuklab bo\'lmadi'))}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/90 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500"
                >
                  <Download className="h-3.5 w-3.5" /> Excel
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {data.total > LIMIT && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg bg-zinc-800 px-3 py-1.5 text-zinc-200 disabled:opacity-40">‹</button>
          <span className="text-zinc-400">{page} / {Math.ceil(data.total / LIMIT)}</span>
          <button disabled={page >= Math.ceil(data.total / LIMIT)} onClick={() => setPage(page + 1)} className="rounded-lg bg-zinc-800 px-3 py-1.5 text-zinc-200 disabled:opacity-40">›</button>
        </div>
      )}
      {open && <ClassMatchModal id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

const OUTCOME: Record<string, [string, string]> = {
  finished: ['tugatdi', 'text-emerald-400'],
  timeout: ['tugatmadi', 'text-amber-400'],
  left: ['chiqib ketdi', 'text-zinc-500'],
};

function ClassMatchModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [m, setM] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    typingApi.classMatch(id).then((r) => setM(r.data.data)).catch((e) => setErr(errMsg(e, 'Yuklab bo\'lmadi')));
  }, [id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8" onClick={onClose}>
      <div className="w-full max-w-4xl rounded-2xl border border-zinc-800 bg-zinc-950 p-5" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Musobaqa natijasi">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-zinc-100">{m ? m.title || `Musobaqa ${m.code}` : 'Natija'}</h3>
            {m && (
              <p className="text-xs text-zinc-500">
                {fmtDate(m.startedAt)} · {variantLabel(m.contentType, m.variant)} · {m.textLength} belgi · Mentor: {m.host?.fullName ?? '—'}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {m && (
              <button onClick={() => downloadClassExcel(m.id, m.title, m.code).catch(() => setErr('Excel yuklab bo\'lmadi'))} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-emerald-500">
                <Download className="h-4 w-4" /> Excel
              </button>
            )}
            <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800" aria-label="Yopish"><X className="h-5 w-5" /></button>
          </div>
        </div>
        {err && <p className="mb-3 text-sm text-red-400">{err}</p>}
        {!m ? (
          !err && <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-zinc-500" /></div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900 text-left text-xs text-zinc-500">
                <tr>
                  <th className="px-3 py-2">O'rin</th><th className="px-3 py-2">O'quvchi</th><th className="px-3 py-2">WPM</th>
                  <th className="px-3 py-2">Aniqlik</th><th className="px-3 py-2">Xato</th><th className="px-3 py-2">Yozgani</th>
                  <th className="px-3 py-2">Vaqt</th><th className="px-3 py-2">Holat</th>
                </tr>
              </thead>
              <tbody>
                {m.players.map((p: any) => (
                  <tr key={p.userId} className="border-t border-zinc-800">
                    <td className="px-3 py-2 text-base">{medal(p.place)}</td>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-zinc-100">{p.fullName}</div>
                      {p.groups.length > 0 && <div className="text-[11px] text-zinc-500">{p.groups.join(', ')}</div>}
                    </td>
                    <td className="px-3 py-2 font-bold tabular-nums text-orange-400">{p.wpm}</td>
                    <td className="px-3 py-2 tabular-nums">{p.accuracy}%</td>
                    <td className="px-3 py-2 tabular-nums text-zinc-400">{p.errors ?? '—'}</td>
                    <td className="px-3 py-2 tabular-nums text-zinc-400">{m.textLength ? Math.min(100, Math.round((p.progress / m.textLength) * 100)) : 0}%</td>
                    <td className="px-3 py-2 tabular-nums text-zinc-400">{p.timeSec ? `${p.timeSec} s` : '—'}</td>
                    <td className="px-3 py-2 text-xs">
                      <span className={OUTCOME[p.outcome]?.[1]}>{OUTCOME[p.outcome]?.[0] ?? p.outcome}</span>
                      {p.flagged && <span className="ml-1 text-red-400" title={p.flagReason ?? ''}>· shubhali</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
