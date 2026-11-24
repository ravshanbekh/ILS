/**
 * Bitta guruhning deadline matritsasi: o'quvchilar × haftalar (har haftada N ta normativ).
 * Boshqaruvchi uchun: rejani tahrirlash — boshqa haftaga ko'chirish, rejadan
 * chiqarish/qaytarish va shu haftadan qayta qurish.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CalendarClock, Loader2, RefreshCw, Undo2, X } from 'lucide-react';
import { apiErrorText, deadlinesApi, type DeadlineGroupDetail } from '@/api';
import DateInput from '@/components/shared/DateInput';
import { inputCls } from '@/pages/curator/curatorCommon';
import { Legend, STATE_META, StateCell, doneOf, dueLabel, leftLabel, scheduleLabel, useDeadlineBase, weekRangeLabel } from './deadlineCommon';

type Enabled = Extract<DeadlineGroupDetail, { enabled: true }>;

export default function NormativeDeadlineGroupPage() {
  const { groupId } = useParams();
  const base = useDeadlineBase();
  const [data, setData] = useState<DeadlineGroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    setError('');
    try {
      setData((await deadlinesApi.group(groupId)).data.data);
    } catch (e) {
      setError(apiErrorText(e, "Ma'lumotni yuklab bo'lmadi"));
    } finally {
      setLoading(false);
    }
  }, [groupId]);
  useEffect(() => {
    load();
  }, [load]);

  const back = (
    <Link to={`${base}/normative-deadlines`} className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white">
      <ArrowLeft className="h-4 w-4" /> Normativ deadline'lari
    </Link>
  );

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-24 text-zinc-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Yuklanmoqda…
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="space-y-4">
        {back}
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400">{error}</div>
      </div>
    );
  }
  if (!data) return null;
  if (!data.enabled) {
    return (
      <div className="space-y-4">
        {back}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-400">
          {data.group.name}: deadline tizimi hali ishga tushirilmagan.
        </div>
      </div>
    );
  }
  return <Matrix d={data} back={back} reload={load} loading={loading} />;
}

function Matrix({ d, back, reload, loading }: { d: Enabled; back: React.ReactNode; reload: () => void; loading: boolean }) {
  const weeks = useMemo(() => d.weeks.map((w) => ({ ...w, active: w.items.filter((i) => !i.excluded) })).filter((w) => w.active.length > 0), [d.weeks]);
  const nowMs = new Date(d.now).getTime();
  const totalRed = d.students.reduce((a, s) => a + s.counts.missed, 0);

  return (
    <div className="space-y-5">
      {back}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <CalendarClock className="h-6 w-6 text-amber-400" /> {d.group.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {d.group.teacher?.fullName ?? 'Ustozsiz'} · {scheduleLabel(d.group.schedule)} · haftasiga {d.config.perWeek} ta · +{d.config.graceDays} kun qo'shimcha
          </p>
          {d.group.warnings.map((w) => (
            <div key={w} className="mt-1 flex items-center gap-1 text-xs text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" /> {w}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-400">
            Qizil jami: <span className={`rounded-md px-2 py-0.5 font-bold ${totalRed ? 'ils-nd-missed' : 'text-zinc-500'}`}>{totalRed}</span>
          </span>
          <button onClick={reload} className="p-2 text-zinc-500 hover:text-white" aria-label="Yangilash" title="Yangilash">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <Legend />

      {weeks.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500">Bu guruhda rejaga kirgan normativ yo'q.</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900">
          <table className="text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th rowSpan={2} className="sticky left-0 z-10 min-w-[200px] bg-zinc-900 px-4 py-2 text-left text-xs uppercase tracking-wider text-zinc-500">
                  O'quvchi
                </th>
                {weeks.map((w) => {
                  const current = w.weekStart === d.currentWeek;
                  const passed = new Date(w.graceEnd).getTime() < nowMs;
                  return (
                    <th
                      key={w.weekStart}
                      colSpan={w.active.length}
                      className={`border-l border-zinc-800 px-2 py-2 text-center text-[11px] font-medium ${current ? 'ils-nd-grace' : 'text-zinc-400'}`}
                      title={`Muddat: ${dueLabel(w.dueAt)}\nQo'shimcha muddat: ${dueLabel(w.graceEnd)} gacha`}
                    >
                      <div className="whitespace-nowrap font-semibold">{weekRangeLabel(w.weekStart)}</div>
                      <div className="whitespace-nowrap text-zinc-500">
                        {current && new Date(w.dueAt).getTime() > nowMs ? `${leftLabel(w.dueAt, d.now)} qoldi` : passed ? 'yopilgan' : dueLabel(w.dueAt)}
                      </div>
                    </th>
                  );
                })}
                <th rowSpan={2} className="border-l border-zinc-800 px-3 py-2 text-center text-xs uppercase tracking-wider text-zinc-500">
                  Topshirdi
                </th>
                <th rowSpan={2} className="px-3 py-2 text-center text-xs uppercase tracking-wider text-zinc-500">
                  Qizil
                </th>
              </tr>
              <tr className="border-b border-zinc-800">
                {weeks.flatMap((w) =>
                  w.active.map((it, i) => (
                    <th key={it.id} className={`px-1 py-1.5 text-center ${i === 0 ? 'border-l border-zinc-800' : ''}`} title={it.title}>
                      <span className="ils-nm-num font-mono text-[11px]">#{it.taskNumber}</span>
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {d.students.map((s) => (
                <tr key={s.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="sticky left-0 z-10 bg-zinc-900 px-4 py-1.5">
                    <div className="font-medium text-zinc-100">{s.fullName}</div>
                    <div className="text-[11px] text-zinc-500">{s.login}</div>
                  </td>
                  {weeks.flatMap((w) =>
                    w.active.map((it, i) => {
                      const c = s.cells[it.id];
                      if (!c) return <td key={it.id} />;
                      const [state, at, url] = c;
                      const title = `#${it.taskNumber} ${it.title}\n${STATE_META[state].label}${at ? `\nTopshirgan: ${dueLabel(at)}` : ''}`;
                      return (
                        <td key={it.id} className={`px-1 py-1 text-center ${i === 0 ? 'border-l border-zinc-800' : ''}`}>
                          {url ? (
                            <a href={url} target="_blank" rel="noopener noreferrer" className="hover:opacity-80">
                              <StateCell state={state} title={`${title}\nIsbot videosini ochish`} />
                            </a>
                          ) : (
                            <StateCell state={state} title={title} />
                          )}
                        </td>
                      );
                    })
                  )}
                  <td className="border-l border-zinc-800 px-3 text-center text-zinc-200">
                    {doneOf(s.counts)}/{s.counts.due - s.counts.open}
                  </td>
                  <td className="px-3 text-center">
                    {s.counts.missed ? <span className="ils-nd-missed rounded-md px-2 py-0.5 font-bold">{s.counts.missed}</span> : <span className="text-zinc-600">0</span>}
                  </td>
                </tr>
              ))}
              {d.students.length === 0 && (
                <tr>
                  <td colSpan={99} className="px-4 py-8 text-center text-zinc-500">
                    Guruhda faol o'quvchi yo'q
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-zinc-500">
        "Topshirdi" — muddati kelgan normativlardan nechtasi topshirilgan. Belgi bosilsa isbot videosi ochiladi. Guruhga muddatdan keyin qo'shilgan o'quvchida o'sha hafta "–" (hisobga olinmaydi).
      </p>

      {d.canManage && <PlanEditor d={d} onChanged={reload} />}
    </div>
  );
}

/** Reja tahriri (boshqaruvchi) */
function PlanEditor({ d, onChanged }: { d: Enabled; onChanged: () => void }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [moveTo, setMoveTo] = useState('');
  const [fromWeek, setFromWeek] = useState(d.currentWeek);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const toggle = (id: string) =>
    setSel((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
      setSel(new Set());
      onChanged();
    } catch (e) {
      setErr(apiErrorText(e));
    } finally {
      setBusy(false);
    }
  };
  const isMonday = (s: string) => !!s && new Date(`${s}T00:00:00Z`).getUTCDay() === 1;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="font-semibold text-white">Rejani boshqarish</div>
      <p className="mt-1 text-xs text-zinc-500">
        Normativlarni belgilang va boshqa haftaga ko'chiring yoki rejadan chiqaring (chiqarilgani hisobga olinmaydi). Guruh kursning o'rtasida bo'lsa: o'tilgan
        normativlarni chiqarib, keyin "shu haftadan qayta qurish"ni bosing.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-zinc-500">Ko'chirish (dushanba)</label>
          <DateInput value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className={inputCls} />
        </div>
        <button
          disabled={busy || !sel.size || !isMonday(moveTo)}
          onClick={() => run(() => deadlinesApi.updateItems(d.group.id, { ids: [...sel], weekStart: moveTo }))}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
        >
          Belgilanganlarni ko'chirish ({sel.size})
        </button>
        <button
          disabled={busy || !sel.size}
          onClick={() => run(() => deadlinesApi.updateItems(d.group.id, { ids: [...sel], excluded: true }))}
          className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-40"
        >
          <X className="h-4 w-4" /> Rejadan chiqarish
        </button>
        <button
          disabled={busy || !sel.size}
          onClick={() => run(() => deadlinesApi.updateItems(d.group.id, { ids: [...sel], excluded: false }))}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
        >
          <Undo2 className="h-4 w-4" /> Qaytarish
        </button>
        <div className="ml-auto flex items-end gap-2">
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-zinc-500">Qayta qurish shu haftadan</label>
            <DateInput value={fromWeek} onChange={(e) => setFromWeek(e.target.value)} required className={inputCls} />
          </div>
          <button
            disabled={busy || !isMonday(fromWeek)}
            onClick={() => {
              if (confirm(`Rejadagi barcha (chiqarilmagan) normativlar ${weekRangeLabel(fromWeek)} haftasidan boshlab haftasiga ${d.config.perWeek} tadan qayta joylanadi. Davom etilsinmi?`)) {
                run(() => deadlinesApi.rebuild(d.group.id, fromWeek));
              }
            }}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            Qayta qurish
          </button>
        </div>
      </div>
      {(moveTo && !isMonday(moveTo)) || (fromWeek && !isMonday(fromWeek)) ? <div className="mt-2 text-xs text-amber-400">Hafta boshi — dushanba sanasini tanlang</div> : null}
      {err && <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{err}</div>}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {d.weeks.map((w) => (
          <div key={w.weekStart} className={`rounded-xl border p-3 ${w.weekStart === d.currentWeek ? 'border-amber-500/40' : 'border-zinc-800'}`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-white">{weekRangeLabel(w.weekStart)}</span>
              <span className="text-[11px] text-zinc-500">{dueLabel(w.dueAt)}</span>
            </div>
            <div className="mt-2 space-y-1">
              {w.items.map((it) => (
                <label key={it.id} className={`flex cursor-pointer items-start gap-2 text-sm ${it.excluded ? 'text-zinc-600 line-through' : 'text-zinc-200'}`}>
                  <input type="checkbox" className="mt-1" checked={sel.has(it.id)} onChange={() => toggle(it.id)} />
                  <span>
                    <span className="ils-nm-num font-mono text-xs">#{it.taskNumber}</span> {it.title}
                    {it.category && <span className="ml-1 text-[11px] text-zinc-500">· {it.category}</span>}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
