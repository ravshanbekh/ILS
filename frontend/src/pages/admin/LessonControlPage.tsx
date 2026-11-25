import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '@/components/layout/Header';
import { lessonSessionsApi } from '@/api';
import { AlarmClock, Loader2, Unlock, CheckCircle2, AlertTriangle, HelpCircle, History, ChevronRight, Search, X, BellRing, BellOff } from 'lucide-react';
import { uzDayMonth } from '@/utils/uzDate';

interface UngradedItem {
  groupId: string;
  groupName: string;
  teacherId?: string;
  teacherName?: string;
}

/** So'nggi kunlarda yopilgan dars: avtomatik yopilgan yoki o'qituvchi yakunlagan */
interface ClosedSession {
  sessionId: string;
  groupId: string;
  groupName: string;
  teacherName: string | null;
  status: 'avto_yopildi' | 'yakunlandi';
  date: string;
  finalizedAt: string | null;
  studentCount: number;
  /** Yopilganda baholanmagani uchun avtomatik 0 olganlar */
  autoZeroCount: number;
  activityMissing: number;
  parentNotifyAt: string | null;
  parentNotifiedAt: string | null;
  unlockedAt: string | null;
  unlockNote: string | null;
}

interface Report {
  date: string;
  notOpened: UngradedItem[];
  notFinalized: UngradedItem[];
  notConfigured: UngradedItem[];
}

/** Qayta ochish oynasi uchun kontekst */
interface Target {
  groupId: string;
  groupName: string;
  /** ISO sana; bo'lmasa bugungi kun */
  date?: string;
  session?: ClosedSession;
  /** Bugungi ro'yxatdagi "Ruxsat berish" — hali ochilmagan dars */
  fresh?: boolean;
}

type Filter = 'suspect' | 'finalized' | 'auto';

const hhmm = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));

export default function LessonControlPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [closed, setClosed] = useState<ClosedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<Target | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');
  const [filter, setFilter] = useState<Filter | null>(null);
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      // Bugungi holat va so'nggi 7 kunda yopilgan darslar (avto-yopilgan + o'qituvchi yakunlagan)
      const [res, closedRes] = await Promise.all([
        lessonSessionsApi.adminUngraded(),
        lessonSessionsApi.adminClosed(7).catch(() => null),
      ]);
      setReport(res.data.data);
      setClosed(closedRes?.data?.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // "Adashib yakunlangan bo'lishi mumkin": o'qituvchi yakunlagan, lekin kimdir baholanmay avtomatik 0 olgan
  const suspect = useMemo(() => closed.filter((c) => c.status === 'yakunlandi' && c.autoZeroCount > 0), [closed]);
  const effFilter: Filter = filter ?? (suspect.length ? 'suspect' : 'auto');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base =
      effFilter === 'suspect' ? suspect : effFilter === 'finalized' ? closed.filter((c) => c.status === 'yakunlandi') : closed.filter((c) => c.status === 'avto_yopildi');
    return base
      .filter((c) => !s || c.groupName.toLowerCase().includes(s) || (c.teacherName ?? '').toLowerCase().includes(s))
      .sort((a, b) => b.date.localeCompare(a.date) || b.autoZeroCount - a.autoZeroCount);
  }, [closed, suspect, effFilter, q]);
  const shown = showAll ? list : list.slice(0, 30);

  const openModal = (t: Target) => {
    setTarget(t);
    setNote('');
    setErr('');
  };

  const confirmUnlock = async () => {
    if (!target || !note.trim()) return;
    setBusy(true);
    setErr('');
    try {
      const r = await lessonSessionsApi.adminUnlock(target.groupId, note.trim(), target.date);
      const info = r.data?.data?.reopen as { from: string; clearedAutoZero: number; parentsAlreadyNotified: boolean } | undefined;
      setDone(
        `"${target.groupName}" qayta ochildi — o'qituvchi 2 soat ichida baholashni tugatib, "Yakunlash"ni bosadi.` +
          (info?.clearedAutoZero ? ` Avtomatik qo'yilgan ${info.clearedAutoZero} ta 0 olib tashlandi.` : '') +
          (info?.parentsAlreadyNotified ? " Ota-onalarga xabar avval ketgan edi — qayta yuborilmaydi." : '')
      );
      setTarget(null);
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.error?.message || e?.response?.data?.message || 'Xatolik yuz berdi');
    } finally {
      setBusy(false);
    }
  };

  const todayOk = report && report.notOpened.length === 0 && report.notFinalized.length === 0;

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header title="Dars nazorati" subtitle="Bugun qaysi guruhlar baholanmadi va yopilgan darslarni qayta ochish" />

      <div className="p-8 max-w-5xl mx-auto">
        {done && (
          <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            <span>{done}</span>
            <button type="button" onClick={() => setDone('')} aria-label="Yopish" className="text-emerald-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : !report ? null : (
          <div className="space-y-8">
            {todayOk && (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <p className="text-zinc-300 text-sm font-medium">Bugun barcha guruhlar baholandi.</p>
              </div>
            )}

            {report.notOpened.length > 0 && (
              <section>
                <h3 className="text-red-400 font-bold text-sm mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Ochilmagan guruhlar ({report.notOpened.length})
                </h3>
                <div className="space-y-2">
                  {report.notOpened.map((g) => (
                    <div key={g.groupId} className="flex items-center justify-between bg-zinc-900 border border-red-500/20 rounded-xl px-4 py-3">
                      <div>
                        <p className="text-white font-medium text-sm">{g.groupName}</p>
                        <p className="text-zinc-500 text-xs">{g.teacherName}</p>
                      </div>
                      <button
                        onClick={() => openModal({ groupId: g.groupId, groupName: g.groupName, fresh: true })}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        Ruxsat berish
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {report.notFinalized.length > 0 && (
              <section>
                <h3 className="text-amber-400 font-bold text-sm mb-3 flex items-center gap-2">
                  <AlarmClock className="w-4 h-4" />
                  Bugun vaqt tugab avto-yopilgan ({report.notFinalized.length})
                </h3>
                <div className="space-y-2">
                  {report.notFinalized.map((g) => (
                    <div key={g.groupId} className="flex items-center justify-between bg-zinc-900 border border-amber-500/20 rounded-xl px-4 py-3">
                      <div>
                        <p className="text-white font-medium text-sm">{g.groupName}</p>
                        <p className="text-zinc-500 text-xs">{g.teacherName}</p>
                      </div>
                      <button
                        onClick={() => openModal({ groupId: g.groupId, groupName: g.groupName })}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        Qayta ochish
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* So'nggi 7 kunda yopilgan darslar — adashib yakunlanganini ham qayta ochish mumkin */}
            <section>
              <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-zinc-300">
                <History className="h-4 w-4" />
                So'nggi 7 kunda yopilgan darslar — qayta ochish
              </h3>
              <p className="mb-3 text-xs text-zinc-500">
                O'qituvchi "Yakunlash"ni adashib, baholashni oxiriga yetkazmay bosgan bo'lsa — darsni qayta oching. Baholanmaganlarga avtomatik qo'yilgan 0 lar
                olib tashlanadi, qo'yilgan baholar va coinlar saqlanadi; o'qituvchi 2 soat ichida tugatib, qayta "Yakunlash"ni bosadi.
              </p>

              <div className="mb-3 flex flex-wrap items-center gap-2">
                {(
                  [
                    ['suspect', `Adashib yakunlangan bo'lishi mumkin (${suspect.length})`],
                    ['finalized', `Barcha yakunlanganlar (${closed.filter((c) => c.status === 'yakunlandi').length})`],
                    ['auto', `Avto-yopilgan (${closed.filter((c) => c.status === 'avto_yopildi').length})`],
                  ] as [Filter, string][]
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      setFilter(k);
                      setShowAll(false);
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      effFilter === k ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' : 'border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <div className="relative ml-auto w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Guruh yoki o'qituvchi…"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-2 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-600"
                  />
                </div>
              </div>

              {list.length === 0 ? (
                <p className="rounded-xl border border-zinc-800 px-4 py-6 text-center text-sm text-zinc-500">Bu ro'yxatda dars yo'q</p>
              ) : (
                <div className="space-y-2">
                  {shown.map((c) => (
                    <div
                      key={c.sessionId}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
                      style={{ background: 'var(--surface)', borderColor: c.status === 'yakunlandi' && c.autoZeroCount ? 'rgb(245 158 11 / 0.35)' : 'var(--border)' }}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {c.groupName}
                          <span className="ml-2 text-sm font-normal" style={{ color: 'var(--muted-foreground)' }}>
                            {uzDayMonth(c.date)}
                          </span>
                          <span
                            className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                              c.status === 'yakunlandi' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                            }`}
                          >
                            {c.status === 'yakunlandi' ? `yakunlangan${c.finalizedAt ? ' ' + hhmm(c.finalizedAt) : ''}` : 'avto-yopilgan'}
                          </span>
                        </p>
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          {c.teacherName ?? "o'qituvchi yo'q"} · {c.studentCount} o'quvchi
                          {c.autoZeroCount > 0 && <span className="text-amber-400"> · {c.autoZeroCount} ta baholanmay 0 olgan</span>}
                          {c.activityMissing > 0 && ` · faollik qo'yilmagan: ${c.activityMissing}`}
                          {c.unlockNote ? ` · avval ochilgan: ${c.unlockNote}` : ''}
                        </p>
                        {c.status === 'yakunlandi' && (
                          <p className="mt-0.5 flex items-center gap-1 text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                            {c.parentNotifiedAt ? (
                              <>
                                <BellRing className="h-3 w-3" /> Ota-onalarga xabar ketgan ({hhmm(c.parentNotifiedAt)})
                              </>
                            ) : c.parentNotifyAt ? (
                              <>
                                <BellOff className="h-3 w-3" /> Ota-onalarga xabar hali ketmagan ({hhmm(c.parentNotifyAt)} da ketadi)
                              </>
                            ) : null}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => openModal({ groupId: c.groupId, groupName: c.groupName, date: c.date, session: c })}
                        className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-opacity hover:opacity-90"
                        style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}
                      >
                        <Unlock className="h-4 w-4" />
                        Qayta ochish
                      </button>
                    </div>
                  ))}
                  {list.length > shown.length && (
                    <button type="button" onClick={() => setShowAll(true)} className="w-full rounded-xl border border-zinc-800 py-2 text-xs text-zinc-400 hover:text-white">
                      Yana {list.length - shown.length} ta
                    </button>
                  )}
                </div>
              )}
            </section>

            {report.notConfigured.length > 0 && (
              <section>
                <h3 className="text-zinc-400 font-bold text-sm mb-3 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4" />
                  Dars kuni belgilanmagan guruhlar ({report.notConfigured.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {/* Bosilganda guruh sahifasining aynan “Dars kuni” tugmalariga olib boradi */}
                  {report.notConfigured.map((g) => (
                    <Link
                      key={g.groupId}
                      to={`/admin/groups/${g.groupId}#dars-kuni`}
                      title={`${g.groupName} — dars kunini belgilash`}
                      className="inline-flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-blue-500/50 hover:text-white"
                    >
                      {g.groupName}
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-500" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
                <p className="text-zinc-600 text-xs mt-2">Guruhni bosing — sahifasida "Dars kuni" (juft/toq/har kuni) ni belgilang.</p>
              </section>
            )}
          </div>
        )}
      </div>

      {target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Darsni qayta ochish">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="font-bold text-white">
              {target.fresh ? 'Ruxsat berish' : 'Darsni qayta ochish'}: {target.groupName}
              {target.date && <span className="ml-1 font-normal text-zinc-400">({uzDayMonth(target.date)})</span>}
            </div>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-300">
              <li>Dars 2 soatga ochiladi — o'qituvchi baholashni tugatib, "Yakunlash"ni bosadi.</li>
              {!target.fresh && (
                <li>
                  Baholanmaganlarga avtomatik qo'yilgan 0 lar olib tashlanadi
                  {target.session ? ` (${target.session.autoZeroCount} ta)` : ''}; qo'yilgan baholar va coinlar saqlanadi.
                </li>
              )}
              {target.session?.status === 'yakunlandi' &&
                (target.session.parentNotifiedAt ? (
                  <li className="text-amber-300">Ota-onalarga xabar allaqachon ketgan — qayta yuborilmaydi.</li>
                ) : (
                  <li>Ota-onalarga xabar hali ketmagan — dars qayta yakunlangach to'g'ri baholar bilan ketadi.</li>
                ))}
            </ul>
            <label className="mt-4 mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-500">Sabab (majburiy)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              autoFocus
              placeholder="Masalan: o'qituvchi Yakunlash'ni adashib bosgan"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
            />
            {err && <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{err}</div>}
            <div className="mt-4 flex gap-3">
              <button type="button" onClick={() => setTarget(null)} className="flex-1 rounded-lg border border-zinc-800 py-2.5 text-sm text-zinc-300">
                Bekor qilish
              </button>
              <button
                type="button"
                disabled={busy || !note.trim()}
                onClick={confirmUnlock}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? 'Ochilmoqda…' : target.fresh ? 'Ruxsat berish' : 'Qayta ochish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
