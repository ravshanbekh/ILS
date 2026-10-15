import { useEffect, useState } from 'react';
import { ClipboardCheck, Loader2 } from 'lucide-react';
import { lessonObservationsApi } from '@/api';
import ObservationRecordCard from './ObservationRecordCard';
import type { ObservationList } from './types';

export default function MyObservationHistory() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ObservationList | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const [error, setError] = useState('');
  const requestKey = `${from}|${to}|${page}`;
  const loading = requestKey !== loadedKey;

  useEffect(() => {
    let active = true;
    lessonObservationsApi.mine({ from: from || undefined, to: to || undefined, page })
      .then(response => { if (active) { setData(response.data.data as ObservationList); setError(''); } })
      .catch(e => { if (active) setError(e?.response?.data?.error?.message || 'Baholar tarixi yuklanmadi.'); })
      .finally(() => { if (active) setLoadedKey(requestKey); });
    return () => { active = false; };
  }, [from, to, page, requestKey]);

  return <section aria-label="Dars kuzatuvi baholarim" className="space-y-4">
    <div className="flex items-center gap-2">
      <ClipboardCheck className="h-5 w-5 text-[#ff3218]" />
      <div><h2 className="font-bold text-white">Dars kuzatuvi baholarim</h2><p className="text-xs text-zinc-500">Admin qo‘ygan baholar va ularning tarixi · faqat sizga ko‘rinadi</p></div>
    </div>
    <div className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:grid-cols-2">
      <label className="text-xs font-semibold text-zinc-400">Boshlanish sanasi
        <input type="date" value={from} max={to || undefined} onChange={event => { setFrom(event.target.value); setPage(1); }} className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
      </label>
      <label className="text-xs font-semibold text-zinc-400">Tugash sanasi
        <input type="date" value={to} min={from || undefined} onChange={event => { setTo(event.target.value); setPage(1); }} className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
      </label>
    </div>
    {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#ff3218]" /></div> :
      error ? <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</p> : data && <>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500">{data.total} ta kuzatuv</p>
          <p className="mt-1 text-2xl font-black text-white">{data.averageScore === null ? '—' : data.averageScore.toFixed(1)} <span className="text-sm font-normal text-zinc-500">/ 95 o‘rtacha ball</span></p>
        </div>
        {data.items.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">Hozircha dars kuzatuvi bahosi yo‘q.</p> :
          <div className="space-y-3">{data.items.map(record => <ObservationRecordCard key={record.id} record={record} showTeacher={false} />)}</div>}
        {data.total > data.pageSize && <div className="flex items-center justify-center gap-3 text-sm text-zinc-400">
          <button onClick={() => setPage(page - 1)} disabled={page === 1} className="rounded-lg bg-zinc-800 px-3 py-2 disabled:opacity-40">Oldingi</button>
          <span>{page} / {Math.ceil(data.total / data.pageSize)}</span>
          <button onClick={() => setPage(page + 1)} disabled={page * data.pageSize >= data.total} className="rounded-lg bg-zinc-800 px-3 py-2 disabled:opacity-40">Keyingi</button>
        </div>}
      </>}
  </section>;
}
