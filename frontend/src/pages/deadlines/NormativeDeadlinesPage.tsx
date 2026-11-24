/**
 * Normativ deadline'lari — umumiy panel.
 *   - tizim yoqilmagan: boshqaruvchi uchun "ko'rib chiqish" va "Hammaga start";
 *   - yoqilgan: tanlangan hafta bo'yicha nechta topshirilishi kerak / topshirildi /
 *     topshirilmadi, qo'shimcha muddatdagilar va jami qizillar — guruhlar kesimida.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Rocket,
  Search,
  Settings2,
  Trash2,
} from 'lucide-react';
import { apiErrorText, deadlinesApi, type DeadlineOverview, type DeadlinePreview } from '@/api';
import DateInput from '@/components/shared/DateInput';
import { Modal, inputCls } from '@/pages/curator/curatorCommon';
import {
  doneOf,
  dueLabel,
  leftLabel,
  mondayOfStr,
  nextMondayStr,
  notDoneOf,
  scheduleLabel,
  todayTashkent,
  addDaysStr,
  useDeadlineBase,
  weekRangeLabel,
} from './deadlineCommon';

export default function NormativeDeadlinesPage() {
  const base = useDeadlineBase();
  const [week, setWeek] = useState<string | undefined>(undefined);
  const [data, setData] = useState<DeadlineOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [onlyRed, setOnlyRed] = useState(false);
  const [confirm, setConfirm] = useState<null | 'pause' | 'settings'>(null);
  const [busy, setBusy] = useState(false);
  const [grace, setGrace] = useState(2);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await deadlinesApi.overview(week);
      setData(r.data.data);
      setGrace(r.data.data.config.graceDays);
    } catch (e) {
      setError(apiErrorText(e, "Ma'lumotni yuklab bo'lmadi"));
    } finally {
      setLoading(false);
    }
  }, [week]);
  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => {
    if (!data?.enabled) return [];
    const s = q.trim().toLowerCase();
    return data.groups
      .filter((g) => !s || g.name.toLowerCase().includes(s) || (g.teacher?.fullName ?? '').toLowerCase().includes(s))
      .filter((g) => !onlyRed || g.missed > 0 || g.week.grace > 0)
      .sort((a, b) => b.missed - a.missed || b.week.grace - a.week.grace || a.name.localeCompare(b.name, 'uz'));
  }, [data, q, onlyRed]);

  const pause = async () => {
    setBusy(true);
    try {
      await deadlinesApi.pause();
      setConfirm(null);
      await load();
    } catch (e) {
      alert(apiErrorText(e));
    } finally {
      setBusy(false);
    }
  };
  const saveGrace = async () => {
    setBusy(true);
    try {
      await deadlinesApi.config({ graceDays: grace });
      setConfirm(null);
      await load();
    } catch (e) {
      alert(apiErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-24 text-zinc-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Yuklanmoqda…
      </div>
    );
  }
  if (error && !data) return <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400">{error}</div>;
  if (!data) return null;
  const cfg = data.config;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <CalendarClock className="h-6 w-6 text-amber-400" /> Normativ deadline'lari
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Haftasiga <b className="text-zinc-200">{cfg.perWeek} ta</b> normativ · muddat — haftaning oxirgi darsi, <b className="text-zinc-200">dars soatigacha</b> ·
            topshirmasa <b className="text-zinc-200">+{cfg.graceDays} kun</b> qo'shimcha imkon · undan keyin <span className="font-semibold text-red-400">qizil</span>
          </p>
        </div>
        {data.enabled && data.canManage && (
          <div className="flex gap-2">
            <button onClick={() => setConfirm('settings')} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800">
              <Settings2 className="h-4 w-4" /> Sozlama
            </button>
            <button onClick={() => setConfirm('pause')} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 px-3 py-2 text-sm text-amber-400 hover:bg-amber-500/10">
              <Pause className="h-4 w-4" /> To'xtatish
            </button>
          </div>
        )}
      </div>

      {!data.enabled ? (
        // key: tozalash/pauzadan keyin forma yangi sozlama bilan qayta ochilsin (eski sana qolmasin)
        <NotStarted key={`${cfg.startDate ?? 'new'}:${cfg.pausedAt ?? ''}`} data={data} onChanged={load} />
      ) : (
        <>
          {/* Hafta tanlash */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-xl border border-zinc-800 bg-zinc-900">
              <button className="p-2.5 text-zinc-400 hover:text-white" aria-label="Oldingi hafta" onClick={() => setWeek(addDaysStr(data.week.start, -7))}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="min-w-[180px] px-2 text-center text-sm">
                <div className="font-semibold text-white">{weekRangeLabel(data.week.start)}</div>
                <div className="text-[11px] text-zinc-500">{data.week.isCurrent ? 'bu hafta' : 'tanlangan hafta'}</div>
              </div>
              <button className="p-2.5 text-zinc-400 hover:text-white" aria-label="Keyingi hafta" onClick={() => setWeek(addDaysStr(data.week.start, 7))}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            {!data.week.isCurrent && (
              <button onClick={() => setWeek(undefined)} className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800">
                Bu hafta
              </button>
            )}
            <button onClick={load} className="rounded-lg p-2 text-zinc-500 hover:text-white" aria-label="Yangilash" title="Yangilash">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <span className="text-xs text-zinc-500">Reja {cfg.startDate} dan boshlangan</span>
          </div>

          {/* Jami */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Topshirilishi kerak" value={data.totals.week.due} hint={`${data.groups.reduce((a, g) => a + g.week.items.length, 0)} ta normativ × o'quvchilar`} />
            <Stat
              label="Topshirildi"
              value={doneOf(data.totals.week)}
              tone="ils-nd-done"
              hint={`o'z vaqtida ${data.totals.week.done} · qo'shimcha muddatda ${data.totals.week.graceDone}${data.totals.week.lateDone ? ` · kech ${data.totals.week.lateDone}` : ''}`}
            />
            <Stat
              label="Topshirilmagan"
              value={notDoneOf(data.totals.week)}
              tone="ils-nd-grace"
              hint={`kutilmoqda ${data.totals.week.open} · qo'shimcha muddatda ${data.totals.week.grace} · qizil ${data.totals.week.missed}`}
            />
            <Stat label="Qizil (jami)" value={data.totals.missed} tone="ils-nd-missed" hint={`${data.totals.studentsWithMissed} ta o'quvchida`} />
          </div>

          {/* Filtr */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Guruh yoki ustoz…" className={`${inputCls} pl-9`} />
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" checked={onlyRed} onChange={(e) => setOnlyRed(e.target.checked)} />
              Faqat qizil / qo'shimcha muddatdagilar
            </label>
          </div>

          {/* Guruhlar */}
          <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-3">Guruh</th>
                  <th className="px-4 py-3">Shu haftaning normativlari</th>
                  <th className="px-4 py-3">Topshirildi</th>
                  <th className="px-4 py-3">Topshirilmagan</th>
                  <th className="px-4 py-3 text-center">Qizil (jami)</th>
                </tr>
              </thead>
              <tbody>
                {groups.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-zinc-500">
                      Guruh topilmadi
                    </td>
                  </tr>
                )}
                {groups.map((g) => {
                  const done = doneOf(g.week);
                  const pct = g.week.due ? Math.round((done / g.week.due) * 100) : null;
                  return (
                    <tr key={g.id} className="border-b border-zinc-800/60 align-top hover:bg-zinc-800/30">
                      <td className="px-4 py-3">
                        <Link to={`${base}/normative-deadlines/${g.id}`} className="font-semibold text-white hover:underline">
                          {g.name}
                        </Link>
                        <div className="text-xs text-zinc-500">{g.teacher?.fullName ?? 'Ustozsiz'} · {g.students} o'quvchi</div>
                        <div className="text-xs text-zinc-500">{scheduleLabel(g.schedule)}</div>
                        {g.warnings.length > 0 && (
                          <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-amber-400" title={g.warnings.join('\n')}>
                            <AlertTriangle className="h-3 w-3" /> {g.warnings[0]}
                            {g.warnings.length > 1 ? ` (+${g.warnings.length - 1})` : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {g.week.items.length === 0 ? (
                          <span className="text-xs text-zinc-500">Bu haftaga normativ yo'q</span>
                        ) : (
                          <>
                            {g.week.items.map((it) => (
                              <div key={it.normativeId} className="text-zinc-200">
                                <span className="ils-nm-num font-mono text-xs">#{it.taskNumber}</span> {it.title}
                              </div>
                            ))}
                            <div className="mt-1 text-xs text-zinc-500">
                              Muddat: {dueLabel(g.week.items[0].dueAt)}
                              {data.week.isCurrent && new Date(g.week.items[0].dueAt) > new Date(data.now) && <> · {leftLabel(g.week.items[0].dueAt, data.now)} qoldi</>}
                            </div>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {g.week.due ? (
                          <>
                            <div className="font-semibold text-white">
                              {done} / {g.week.due} <span className="text-xs font-normal text-zinc-500">({pct}%)</span>
                            </div>
                            <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-zinc-800">
                              <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                            </div>
                          </>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {g.week.due ? (
                          <div className="space-y-0.5">
                            <div className="text-sm font-semibold text-zinc-200">{notDoneOf(g.week)}</div>
                            {g.week.open > 0 && <div className="text-zinc-400">kutilmoqda: {g.week.open}</div>}
                            {g.week.grace > 0 && <div className="text-amber-400">qo'shimcha muddatda: {g.week.grace}</div>}
                            {g.week.missed > 0 && <div className="text-red-400">qizil: {g.week.missed}</div>}
                          </div>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {g.missed > 0 ? (
                          <span className="ils-nd-missed inline-block rounded-lg px-2.5 py-1 text-sm font-bold" title={`${g.studentsWithMissed} ta o'quvchida`}>
                            {g.missed}
                          </span>
                        ) : (
                          <span className="text-zinc-600">0</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {confirm === 'pause' && (
        <Modal title="Tizimni to'xtatish" onClose={() => setConfirm(null)}>
          <p className="text-sm text-zinc-300">
            To'xtatilganda o'qituvchi va o'quvchilar deadline'larni ko'rmaydi. Reja va topshiriqlar saqlanadi — "Davom ettirish" bilan qayta yoqiladi.
          </p>
          <div className="mt-5 flex gap-3">
            <button onClick={() => setConfirm(null)} className="flex-1 rounded-lg border border-zinc-800 py-2.5 text-sm text-zinc-300">
              Bekor qilish
            </button>
            <button disabled={busy} onClick={pause} className="flex-1 rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              To'xtatish
            </button>
          </div>
        </Modal>
      )}
      {confirm === 'settings' && (
        <Modal title="Sozlama" onClose={() => setConfirm(null)}>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-500">Qo'shimcha muddat (kun)</label>
          <input type="number" min={0} max={7} value={grace} onChange={(e) => setGrace(Number(e.target.value))} className={inputCls} />
          <p className="mt-2 text-xs text-zinc-500">
            Darhol barcha haftalarga qo'llanadi. Haftasiga normativ soni ({cfg.perWeek}) reja qurilganda belgilangan — guruh rejasini qayta qurish bilan o'zgaradi.
          </p>
          <div className="mt-5 flex gap-3">
            <button onClick={() => setConfirm(null)} className="flex-1 rounded-lg border border-zinc-800 py-2.5 text-sm text-zinc-300">
              Bekor qilish
            </button>
            <button disabled={busy} onClick={saveGrace} className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              Saqlash
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: number; hint?: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-2 flex items-center gap-2">
        <span className={`rounded-lg px-2 py-0.5 text-2xl font-bold ${tone ?? 'text-white'}`}>{value}</span>
      </div>
      {hint && <div className="mt-1.5 text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

/** Tizim yoqilmagan: boshqaruvchi — ko'rib chiqish va start; boshqalar — xabar */
function NotStarted({ data, onChanged }: { data: Extract<DeadlineOverview, { enabled: false }>; onChanged: () => void }) {
  const cfg = data.config;
  const paused = !!cfg.startDate;
  const [startDate, setStartDate] = useState(cfg.startDate ?? nextMondayStr());
  const [perWeek, setPerWeek] = useState(cfg.perWeek);
  const [graceDays, setGraceDays] = useState(cfg.graceDays);
  const [preview, setPreview] = useState<DeadlinePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState<null | 'start' | 'reset'>(null);

  const notMonday = new Date(`${startDate}T00:00:00Z`).getUTCDay() !== 1;
  const isPast = startDate < mondayOfStr(todayTashkent());

  const doPreview = async () => {
    setBusy(true);
    setErr('');
    try {
      setPreview((await deadlinesApi.preview(startDate, perWeek)).data.data);
    } catch (e) {
      setErr(apiErrorText(e));
    } finally {
      setBusy(false);
    }
  };
  const doStart = async () => {
    setBusy(true);
    setErr('');
    try {
      await deadlinesApi.start(paused ? { startDate: cfg.startDate!, graceDays } : { startDate, perWeek, graceDays });
      setConfirm(null);
      onChanged();
    } catch (e) {
      setErr(apiErrorText(e));
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };
  const doReset = async () => {
    setBusy(true);
    try {
      await deadlinesApi.reset();
      setConfirm(null);
      onChanged();
    } catch (e) {
      setErr(apiErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (!data.canManage) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
        <CalendarClock className="mx-auto h-10 w-10 text-zinc-600" />
        <div className="mt-3 font-semibold text-white">{paused ? "Deadline tizimi vaqtincha to'xtatilgan" : 'Deadline tizimi hali ishga tushirilmagan'}</div>
        <p className="mt-1 text-sm text-zinc-500">Rahbariyat e'lon qilib start bergandan keyin shu yerda haftalik muddatlar ko'rinadi.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className={`rounded-2xl border p-5 ${paused ? 'border-amber-500/30 bg-amber-500/5' : 'border-sky-500/30 bg-sky-500/5'}`}>
        <div className="font-semibold text-white">{paused ? "Tizim to'xtatilgan" : 'Tizim hali ishga tushirilmagan'}</div>
        <p className="mt-1 text-sm text-zinc-400">
          {paused ? (
            <>
              Reja {cfg.startDate} haftasidan qurilgan va saqlangan. Davom ettirsangiz hamma yana ko'radi. Boshqa sanadan boshlash kerak bo'lsa — avval rejani tozalang.
            </>
          ) : (
            <>
              Hech kim (o'qituvchi ham, o'quvchi ham) hozircha hech narsa ko'rmaydi. Normativlarni yangilab, guruhlarga biriktirib bo'lgach — avval rejani ko'rib chiqing, keyin
              <b className="text-zinc-200"> "Hammaga start"</b> bering.
            </>
          )}
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-500">Boshlanish haftasi (dushanba)</label>
            <DateInput value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={paused} required className={inputCls} />
            {!paused && notMonday && <div className="mt-1 text-xs text-amber-400">Dushanba tanlang — hafta boshi</div>}
            {!paused && isPast && <div className="mt-1 text-xs text-red-400">O'tgan haftadan boshlab bo'lmaydi</div>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-500">Haftasiga normativ</label>
            <input type="number" min={1} max={10} value={perWeek} disabled={paused} onChange={(e) => setPerWeek(Number(e.target.value))} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-500">Qo'shimcha muddat (kun)</label>
            <input type="number" min={0} max={7} value={graceDays} onChange={(e) => setGraceDays(Number(e.target.value))} className={inputCls} />
          </div>
        </div>

        {err && <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{err}</div>}

        <div className="mt-4 flex flex-wrap gap-2">
          {!paused && (
            <button
              onClick={doPreview}
              disabled={busy || notMonday || isPast}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Rejani ko'rib chiqish
            </button>
          )}
          <button
            onClick={() => setConfirm('start')}
            disabled={busy || (!paused && (notMonday || isPast || !preview))}
            title={!paused && !preview ? "Avval rejani ko'rib chiqing" : undefined}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {paused ? <Play className="h-4 w-4" /> : <Rocket className="h-4 w-4" />} {paused ? 'Davom ettirish' : 'Hammaga start'}
          </button>
          {paused && (
            <button onClick={() => setConfirm('reset')} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10">
              <Trash2 className="h-4 w-4" /> Rejani tozalash
            </button>
          )}
        </div>
      </div>

      {preview && !paused && <PreviewTable p={preview} />}

      {confirm === 'start' && (
        <Modal title={paused ? 'Davom ettirish' : 'Hammaga start berish'} onClose={() => setConfirm(null)}>
          <div className="space-y-2 text-sm text-zinc-300">
            {paused ? (
              <p>Tizim yana yoqiladi, saqlangan reja bilan.</p>
            ) : (
              <>
                <p>
                  <b>{preview?.totals.withPlan}</b> ta guruhga reja quriladi ({weekRangeLabel(startDate)} haftasidan, haftasiga {perWeek} ta, +{graceDays} kun).
                </p>
                <p>Shu ondan o'qituvchilar o'z guruhlarini, o'quvchilar esa o'z muddatlarini ko'radi.</p>
                {!!preview?.totals.withWarnings && (
                  <p className="text-amber-400">{preview.totals.withWarnings} ta guruhda ogohlantirish bor (jadval yoki normativ yetishmaydi) — ular ham ishga tushadi.</p>
                )}
              </>
            )}
          </div>
          <div className="mt-5 flex gap-3">
            <button onClick={() => setConfirm(null)} className="flex-1 rounded-lg border border-zinc-800 py-2.5 text-sm text-zinc-300">
              Bekor qilish
            </button>
            <button disabled={busy} onClick={doStart} className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? 'Kuting…' : paused ? 'Davom ettirish' : 'Start'}
            </button>
          </div>
        </Modal>
      )}
      {confirm === 'reset' && (
        <Modal title="Rejani tozalash" onClose={() => setConfirm(null)}>
          <p className="text-sm text-zinc-300">
            Barcha guruhlarning haftalik rejasi (qaysi normativ qaysi haftada) o'chiriladi, qo'lda qilingan ko'chirishlar ham. O'quvchilarning topshiriqlari va ballari
            <b> tegilmaydi</b>. Keyin yangi sanadan qayta start berish mumkin.
          </p>
          <div className="mt-5 flex gap-3">
            <button onClick={() => setConfirm(null)} className="flex-1 rounded-lg border border-zinc-800 py-2.5 text-sm text-zinc-300">
              Bekor qilish
            </button>
            <button disabled={busy} onClick={doReset} className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              Tozalash
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PreviewTable({ p }: { p: DeadlinePreview }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900">
      <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-zinc-800 px-5 py-4 text-sm">
        <span className="font-semibold text-white">Reja ko'rinishi — {weekRangeLabel(p.startDate)} dan</span>
        <span className="text-zinc-400">{p.totals.groups} guruh · rejali {p.totals.withPlan} · {p.totals.students} o'quvchi</span>
        {p.totals.withWarnings > 0 && <span className="text-amber-400">{p.totals.withWarnings} ta guruhda ogohlantirish</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wider text-zinc-500">
              <th className="px-4 py-2.5">Guruh</th>
              <th className="px-4 py-2.5">Normativ</th>
              <th className="px-4 py-2.5">1-hafta</th>
              <th className="px-4 py-2.5">Birinchi muddat</th>
              <th className="px-4 py-2.5">Oxirgi hafta</th>
            </tr>
          </thead>
          <tbody>
            {p.groups.map((g) => (
              <tr key={g.id} className="border-b border-zinc-800/60 align-top">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-white">{g.name}</div>
                  <div className="text-xs text-zinc-500">{g.teacher?.fullName ?? 'Ustozsiz'} · {g.students} o'quvchi · {scheduleLabel(g.schedule)}</div>
                  {g.warnings.map((w) => (
                    <div key={w} className="flex items-center gap-1 text-[11px] text-amber-400">
                      <AlertTriangle className="h-3 w-3" /> {w}
                    </div>
                  ))}
                </td>
                <td className="px-4 py-2.5 text-zinc-300">{g.normatives ? `${g.normatives} ta · ${g.weeks} hafta` : '—'}</td>
                <td className="px-4 py-2.5 text-xs text-zinc-300">
                  {g.firstWeekItems.map((n) => (
                    <div key={n.id}>
                      <span className="ils-nm-num font-mono">#{n.taskNumber}</span> {n.title}
                    </div>
                  ))}
                </td>
                <td className="px-4 py-2.5 text-xs text-zinc-300">{g.firstDueAt ? dueLabel(g.firstDueAt) : '—'}</td>
                <td className="px-4 py-2.5 text-xs text-zinc-400">{g.lastWeek ? weekRangeLabel(g.lastWeek) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
