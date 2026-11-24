/**
 * O'quvchi: "Kuratorim" — kurator kim, 2 oylik dasturning qaysi joyida
 * turibman, va kuratorning bo'sh vaqtiga onlayn yozilish (30 daqiqalik vaqt,
 * 8 kishigacha, kuniga bittasi).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, Loader2, Sparkles, Users, X } from 'lucide-react';
import Header from '@/components/layout/Header';
import { apiErrorText, curatorApi, type StudentCuratorInfo, type StudentCuratorSlot } from '@/api';
import { KindBadge, LESSON_STATE, ProgramProgress, TimelineBar, lessonLabel, shortDate } from '@/pages/curator/curatorCommon';

const WEEKDAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const weekday = (iso: string) => WEEKDAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()];

export default function StudentCuratorPage() {
  const [info, setInfo] = useState<StudentCuratorInfo | null | undefined>(undefined);
  const [slots, setSlots] = useState<StudentCuratorSlot[]>([]);
  const [slotReason, setSlotReason] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [me, av] = await Promise.all([curatorApi.me(), curatorApi.available()]);
      setInfo(me.data.data.enrollment);
      setSlots(av.data.data.slots);
      setSlotReason(av.data.data.reason);
      setError(null);
    } catch (e) {
      setError(apiErrorText(e));
      setInfo((v) => (v === undefined ? null : v));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const byDay = useMemo(() => {
    const m = new Map<string, StudentCuratorSlot[]>();
    for (const s of slots) {
      if (!m.has(s.date)) m.set(s.date, []);
      m.get(s.date)!.push(s);
    }
    return [...m.entries()];
  }, [slots]);

  const weeks = useMemo(() => {
    const m = new Map<number, { title: string; items: StudentCuratorInfo['program'] }>();
    for (const l of info?.program ?? []) {
      if (!m.has(l.week)) m.set(l.week, { title: l.weekTitle, items: [] });
      m.get(l.week)!.items.push(l);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [info]);

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      setFlash(ok);
      setTimeout(() => setFlash(null), 3000);
      await load();
    } catch (e) {
      setError(apiErrorText(e));
    } finally {
      setBusy(null);
    }
  };

  if (info === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }
  if (!info) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <Header title="Kuratorim" />
        <div className="mx-auto max-w-xl p-6">
          <div className="rounded-xl border border-dashed border-zinc-800 py-12 text-center">
            <Users className="mx-auto mb-2 h-8 w-8 text-zinc-600" />
            <p className="text-sm text-zinc-400">Sizga kurator biriktirilmagan</p>
          </div>
        </div>
      </div>
    );
  }

  const upcoming = info.bookings.filter((b) => b.status === 'band' && b.canCancel);
  return (
    <div className="min-h-screen bg-zinc-950">
      <Header title="Kuratorim" subtitle="2 oylik mashg'ulotlar: qayerdasiz va keyingi vaqtga yozilish" />
      <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
        {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">{error}</div>}
        {flash && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
            <Check className="h-4 w-4" /> {flash}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-3">
          <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            {info.curator.avatarUrl ? (
              <img src={info.curator.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600/15 text-lg font-bold text-blue-400">{info.curator.fullName.charAt(0)}</span>
            )}
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">Kuratorim</p>
              <p className="truncate font-semibold text-zinc-100">{info.curator.fullName}</p>
              {info.curator.bio && <p className="line-clamp-2 text-xs text-zinc-400">{info.curator.bio}</p>}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="mb-2 text-[11px] uppercase tracking-wide text-zinc-500">2 oylik yo'l</p>
            <TimelineBar t={info.timeline} />
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="mb-2 text-[11px] uppercase tracking-wide text-zinc-500">Mashg'ulotlar</p>
            <ProgramProgress p={info.progress} t={info.timeline} />
          </div>
        </div>

        {/* Yozilish */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900">
          <h3 className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3 text-sm font-bold text-white">
            <CalendarClock className="h-4 w-4 text-zinc-400" /> Kurator vaqtiga yozilish
          </h3>
          {upcoming.length > 0 && (
            <div className="space-y-2 border-b border-zinc-800 p-4">
              {upcoming.map((b) => (
                <div key={b.id} className="flex items-center gap-3 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm">
                  <span className="text-sky-300">
                    {shortDate(b.date)} ({weekday(b.date)}), <b>{b.time}</b>
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-zinc-400">{b.lesson ? lessonLabel(b.lesson) : ''}</span>
                  <button
                    type="button"
                    disabled={busy === b.id}
                    onClick={() => run(b.id, () => curatorApi.cancelBooking(b.id), 'Yozilish bekor qilindi')}
                    className="flex items-center gap-1 rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" /> Bekor qilish
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-4 p-4">
            {slotReason && <p className="text-sm text-amber-400">{slotReason}</p>}
            {byDay.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500">Kurator yaqin 7 kunga hali vaqt ochmagan</p>
            ) : (
              byDay.map(([date, list]) => (
                <div key={date}>
                  <p className="mb-2 text-xs font-semibold text-zinc-400">
                    {shortDate(date)} · {weekday(date)}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                    {list.map((s) => (
                      <button
                        key={s.slotId}
                        type="button"
                        disabled={!s.canBook || busy === s.slotId}
                        onClick={() => run(s.slotId, () => curatorApi.book(s.slotId), `Yozildingiz: ${shortDate(s.date)}, ${s.time}`)}
                        title={s.lesson ? lessonLabel(s.lesson) : undefined}
                        className={`rounded-lg border px-2 py-2 text-left transition-colors ${
                          s.isMine
                            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                            : s.canBook
                              ? 'border-zinc-700 bg-zinc-950 text-zinc-100 hover:border-blue-600'
                              : 'cursor-not-allowed border-zinc-800 bg-zinc-950 text-zinc-600'
                        }`}
                      >
                        <span className="block text-sm font-semibold">{s.time.slice(0, 5)}</span>
                        <span className="block text-[10px] opacity-80">{s.isMine ? (s.isPast ? (s.myStatus === 'keldi' ? 'keldingiz ✔' : s.myStatus === 'kelmadi' ? 'kelmadingiz' : "o'tdi") : 'siz yozilgansiz') : s.reason ?? `${s.free} ta joy bor`}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Dastur */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900">
          <h3 className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3 text-sm font-bold text-white">
            <Sparkles className="h-4 w-4 text-amber-400" /> 2 oylik dastur
          </h3>
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            {weeks.map(([w, wk]) => (
              <div key={w} className={`rounded-lg border p-3 ${info.progress.next?.week === w ? 'border-sky-500/50 bg-sky-500/5' : 'border-zinc-800'}`}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  {w}-hafta
                  <span className="block normal-case tracking-normal text-zinc-300">{wk.title}</span>
                </p>
                <div className="space-y-1.5">
                  {wk.items.map((l) => (
                    <div key={l.n} className={`rounded-md border px-2 py-1.5 text-xs ${LESSON_STATE[l.state].cls}`} title={l.goal ?? undefined}>
                      <span className="font-semibold">
                        {lessonLabel(l)}
                      </span>
                      <KindBadge kind={l.kind} />
                      {l.date && <span className="block text-[10px] opacity-80">{shortDate(l.date)}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
