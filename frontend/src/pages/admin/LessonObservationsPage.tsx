import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BookOpenCheck, ClipboardPenLine, Clock3, Loader2, Trophy } from 'lucide-react';
import Header from '@/components/layout/Header';
import { lessonObservationsApi } from '@/api';
import { useAuthStore } from '@/stores/authStore';
import ObservationForm from '@/features/lessonObservations/ObservationForm';
import ObservationRecordCard from '@/features/lessonObservations/ObservationRecordCard';
import { observationTime, type ObservationList, type ObservationRank, type ObservationRecord, type ObservationSection, type ObservationTeacher } from '@/features/lessonObservations/types';

const base = '/admin/lesson-observations';
const rankingPath = '/admin/lesson-observation-ranking';
const emptyList: ObservationList = { items: [], total: 0, page: 1, pageSize: 20, averageScore: null };

export default function LessonObservationsPage() {
  const { user } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const view = location.pathname === rankingPath ? 'ranking' : location.pathname.endsWith('/history') ? 'history' : 'form';
  const [teachers, setTeachers] = useState<ObservationTeacher[]>([]);
  const [filterTeachers, setFilterTeachers] = useState<{ id: string; fullName: string }[]>([]);
  const [sections, setSections] = useState<ObservationSection[]>([]);
  const [maxScore, setMaxScore] = useState(95);
  const [formLoading, setFormLoading] = useState(true);
  const [formError, setFormError] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState<ObservationList>(emptyList);
  const [ranking, setRanking] = useState<ObservationRank[]>([]);
  const [loadedKey, setLoadedKey] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<ObservationRecord | null>(null);
  const requestKey = `${view}|${teacherId}|${from}|${to}|${page}|${saved?.id ?? ''}`;
  const loading = view !== 'form' && requestKey !== loadedKey;

  useEffect(() => {
    let active = true;
    lessonObservationsApi.form().then(response => {
      if (!active) return;
      setTeachers(response.data.data.teachers);
      setFilterTeachers(response.data.data.filterTeachers);
      setSections(response.data.data.sections);
      setMaxScore(response.data.data.maxScore);
    }).catch(() => { if (active) setFormError('Forma va ustozlar ro‘yxatini yuklab bo‘lmadi.'); })
      .finally(() => { if (active) setFormLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (view === 'form') return;
    let active = true;
    const params = { teacherId: teacherId || undefined, from: from || undefined, to: to || undefined, page };
    const request = view === 'ranking' ? lessonObservationsApi.ranking(params) : lessonObservationsApi.history(params);
    request.then(response => {
      if (!active) return;
      if (view === 'ranking') setRanking(response.data.data as ObservationRank[]);
      else setHistory(response.data.data as ObservationList);
      setError('');
    }).catch(e => {
      if (active) setError(e?.response?.data?.error?.message || 'Ma’lumotlarni yuklab bo‘lmadi.');
    }).finally(() => { if (active) setLoadedKey(requestKey); });
    return () => { active = false; };
  }, [view, teacherId, from, to, page, requestKey]);

  const handleSaved = (record: ObservationRecord) => {
    setSaved(record);
    setTeacherId(''); setFrom(''); setTo(''); setPage(1);
    navigate(`${base}/history`);
  };

  return <div className="min-h-screen bg-zinc-950">
    <Header title={view === 'ranking' ? 'Dars kuzatuvi reytingi' : 'Dars baholash'}
      subtitle="Admin kuzatuvi · 19 mezon · 95 ball · barcha natijalar tarixda saqlanadi" />
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <nav aria-label="Dars kuzatuvi bo‘limlari" className="flex flex-wrap gap-2">
        <Tab to={base} active={view === 'form'} icon={<ClipboardPenLine className="h-4 w-4" />} label="Yangi baholash" />
        <Tab to={`${base}/history`} active={view === 'history'} icon={<Clock3 className="h-4 w-4" />} label="Baholar tarixi" />
        <Tab to={rankingPath} active={view === 'ranking'} icon={<Trophy className="h-4 w-4" />} label="Dars reytingi" />
      </nav>

      {view === 'form' ? (
        formLoading ? <Loading /> : formError ? <ErrorText text={formError} /> :
          <ObservationForm teachers={teachers} sections={sections} maxScore={maxScore} observerName={user?.fullName || 'Admin'} onSaved={handleSaved} />
      ) : <>
        {saved && view === 'history' && <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {saved.teacherName} uchun {saved.totalScore}/95 ball saqlandi · {observationTime(saved.createdAt)}
        </div>}
        <div className="grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:grid-cols-3">
          <label className="text-xs font-semibold text-zinc-400">Ustoz
            <select value={teacherId} onChange={event => { setTeacherId(event.target.value); setPage(1); }} className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white">
              <option value="">Barcha ustozlar</option>
              {filterTeachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-zinc-400">Boshlanish sanasi
            <input type="date" value={from} max={to || undefined} onChange={event => { setFrom(event.target.value); setPage(1); }} className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white" />
          </label>
          <label className="text-xs font-semibold text-zinc-400">Tugash sanasi
            <input type="date" value={to} min={from || undefined} onChange={event => { setTo(event.target.value); setPage(1); }} className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white" />
          </label>
        </div>

        {loading ? <Loading /> : error ? <ErrorText text={error} /> : view === 'ranking' ? <>
          <p className="text-sm text-zinc-400">Reyting tanlangan davrdagi dars kuzatuvlarining o‘rtacha bali bo‘yicha hisoblanadi.</p>
          {ranking.length === 0 ? <Empty text="Bu davrda baholangan dars yo‘q." /> :
            <div className="space-y-3">
              {ranking.map(row => <div key={row.teacherId} className="flex flex-wrap items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-black ${row.rank === 1 ? 'bg-amber-400/15 text-amber-300' : 'bg-zinc-800 text-zinc-300'}`}>{row.rank}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-white">{row.teacherName}</p>
                  <p className="text-xs text-zinc-500">{row.count} ta kuzatuv · oxirgisi {observationTime(row.lastObservedAt)}</p>
                  <div className="mt-2 h-1.5 max-w-sm overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-[#ff3218]" style={{ width: `${row.percentage}%` }} /></div>
                </div>
                <div className="text-right"><p className="text-xl font-black text-white">{row.averageScore} <span className="text-xs font-normal text-zinc-500">/ 95</span></p><p className="text-xs text-zinc-400">{row.percentage}%</p></div>
              </div>)}
            </div>}
        </> : <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="text-lg font-bold text-white">Barcha baholar</h2><p className="text-xs text-zinc-500">{history.total} ta kuzatuv · o‘rtacha {history.averageScore === null ? '—' : `${history.averageScore.toFixed(1)} / 95`}</p></div>
          </div>
          {history.items.length === 0 ? <Empty text="Bu filtr bo‘yicha baho topilmadi." /> : <div className="space-y-3">{history.items.map(record => <ObservationRecordCard key={record.id} record={record} />)}</div>}
          {history.total > history.pageSize && <Pagination page={page} total={history.total} pageSize={history.pageSize} onPage={setPage} />}
        </>}
      </>}
    </div>
  </div>;
}

function Tab({ to, active, icon, label }: { to: string; active: boolean; icon: React.ReactNode; label: string }) {
  return <Link to={to} aria-current={active ? 'page' : undefined} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${active ? 'border-[#ff3218] bg-[#ff3218] text-white' : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600 hover:text-white'}`}>{icon}{label}</Link>;
}
function Loading() { return <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-[#ff3218]" /></div>; }
function ErrorText({ text }: { text: string }) { return <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{text}</p>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center text-sm text-zinc-500"><BookOpenCheck className="mx-auto mb-3 h-9 w-9" />{text}</div>; }
function Pagination({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (page: number) => void }) {
  return <div className="flex items-center justify-center gap-3 py-2 text-sm text-zinc-400">
    <button type="button" onClick={() => onPage(page - 1)} disabled={page === 1} className="rounded-lg bg-zinc-800 px-3 py-2 disabled:opacity-40">Oldingi</button>
    <span>{page} / {Math.ceil(total / pageSize)}</span>
    <button type="button" onClick={() => onPage(page + 1)} disabled={page * pageSize >= total} className="rounded-lg bg-zinc-800 px-3 py-2 disabled:opacity-40">Keyingi</button>
  </div>;
}
