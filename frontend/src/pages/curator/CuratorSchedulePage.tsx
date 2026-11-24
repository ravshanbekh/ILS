/**
 * Kurator jadvali: kunning bo'sh vaqtlarini 30 daqiqalik oraliqlarda ochish
 * (mashg'ulot 20 daqiqa, bitta vaqtga 8 tagacha o'quvchi). O'quvchilar o'z
 * profilidan onlayn yoziladi; kurator "keldi/kelmadi" belgilaydi va vaqtga
 * biriktirilgan dastur mashg'uloti o'quvchining 2 oylik xaritasiga tushadi.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, Clock, Loader2, Lock, Plus, Save, Trash2, Unlock, UserCheck, UserX, X } from 'lucide-react';
import Header from '@/components/layout/Header';
import { useAuthStore } from '@/stores/authStore';
import DateInput from '@/components/shared/DateInput';
import { apiErrorText, curatorApi, type CuratorDay, type CuratorLesson, type CuratorListItem, type CuratorSlot, type CuratorStudentRow } from '@/api';
import { inputCls, todayLocal } from './curatorCommon';

const WEEKDAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

function stripDays(count = 7) {
  const out: { value: string; label: string; weekday: string }[] = [];
  const [y, mo, d] = todayLocal().split('-').map(Number);
  const cur = new Date(Date.UTC(y, mo - 1, d));
  while (out.length < count) {
    if (cur.getUTCDay() !== 0) {
      out.push({ value: cur.toISOString().slice(0, 10), label: `${cur.getUTCDate()}-${MONTHS[cur.getUTCMonth()]}`, weekday: WEEKDAYS[cur.getUTCDay()] });
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

export default function CuratorSchedulePage() {
  const days = useMemo(() => stripDays(7), []);
  const [date, setDate] = useState(days[0].value);
  const [curators, setCurators] = useState<CuratorListItem[]>([]);
  const [curatorId, setCuratorId] = useState('');
  const [curatorsLoaded, setCuratorsLoaded] = useState(false);
  // Kurator — har doim o'z jadvali; qolganlar (admin, nazorat ruxsati) kuratorni tanlaydi
  const isOversight = useAuthStore((st) => st.user?.role) !== 'kurator';
  const [data, setData] = useState<CuratorDay | null>(null);
  const [lessons, setLessons] = useState<CuratorLesson[]>([]);
  const [students, setStudents] = useState<CuratorStudentRow[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [capacity, setCapacity] = useState(8);
  const [dayLesson, setDayLesson] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kuratorlar: kurator faqat o'zini oladi (server shunday qaytaradi), nazoratchi — hammani
  useEffect(() => {
    curatorApi
      .curators()
      .then((r) => {
        setCurators(r.data.data);
        setCuratorsLoaded(true);
        if (isOversight && r.data.data[0]) setCuratorId((c) => c || r.data.data[0].id);
      })
      .catch((e) => setError(apiErrorText(e)));
    curatorApi.program().then((r) => setLessons(r.data.data.lessons)).catch(() => {});
  }, [isOversight]);

  const ready = !isOversight || !!curatorId;

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      const r = await curatorApi.day(date, isOversight ? curatorId : undefined);
      const day = r.data.data;
      setData(day);
      setSelected(day.slots.filter((s) => s.isOpen && !s.isPast).map((s) => s.startMinute));
      setCapacity(day.slots.find((s) => !s.isPast)?.capacity ?? day.maxCapacity);
    } catch (e) {
      setError(apiErrorText(e));
    } finally {
      setLoading(false);
    }
  }, [date, curatorId, isOversight, ready]);
  useEffect(() => {
    load();
  }, [load]);

  // Vaqtga qo'shish uchun — shu kuratorning faol o'quvchilari
  useEffect(() => {
    if (!ready) return;
    curatorApi
      .students({ status: 'faol', curatorId: isOversight ? curatorId : undefined })
      .then((r) => setStudents(r.data.data.items))
      .catch(() => {});
  }, [curatorId, isOversight, ready]);

  const today = todayLocal();
  const isPastDay = date < today;
  const bySlot = new Map((data?.slots ?? []).map((s) => [s.startMinute, s]));
  const futureOpen = (data?.slots ?? []).filter((s) => s.isOpen && !s.isPast).map((s) => s.startMinute).sort((a, b) => a - b);
  const dirty = JSON.stringify([...selected].sort((a, b) => a - b)) !== JSON.stringify(futureOpen) || (!!dayLesson && selected.length > 0);

  const isMinutePast = (m: number) => {
    if (date < today) return true;
    if (date > today) return false;
    const now = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', hour12: false });
    const [h, mm] = now.split(':').map(Number);
    return m <= h * 60 + mm;
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const r = await curatorApi.setDay({
        date,
        minutes: selected,
        capacity,
        ...(dayLesson ? { lessonId: dayLesson } : {}),
        ...(isOversight ? { curatorId } : {}),
      });
      setData(r.data.data);
      setSelected(r.data.data.slots.filter((s) => s.isOpen && !s.isPast).map((s) => s.startMinute));
      setDayLesson('');
    } catch (e) {
      setError(apiErrorText(e));
    } finally {
      setSaving(false);
    }
  };

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(apiErrorText(e));
    }
  };

  const slotsWithInfo = (data?.slots ?? []).filter((s) => s.booked > 0 || s.isOpen || s.lesson);

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header title={isOversight ? 'Kuratorlar jadvali' : 'Mening jadvalim'} subtitle="Bo'sh vaqtlaringizni oching — o'quvchilar o'z profilidan onlayn yoziladi" />
      <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
        <div className="flex gap-3 rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 text-sm text-zinc-300">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" />
          <div>
            <p>
              Mashg'ulot <b className="text-white">{data?.sessionMinutes ?? 20} daqiqa</b>, jadval <b className="text-white">{data?.slotMinutes ?? 30} daqiqalik</b> oraliqda. Bitta vaqtga{' '}
              <b className="text-white">{data?.maxCapacity ?? 8} tagacha</b> o'quvchi yoziladi.
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Ish vaqti 08:00–20:00 · yakshanba dam olish · bir kunda bitta vaqtga yoziladi. Vaqtga mashg'ulot biriktirsangiz, "keldi" bosilganda u o'quvchining dasturiga o'zi yoziladi.
            </p>
          </div>
        </div>

        {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">{error}</div>}

        <div className="flex flex-wrap items-center gap-2">
          {isOversight && (
            <select value={curatorId} onChange={(e) => setCuratorId(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100" aria-label="Kurator">
              {curators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
            </select>
          )}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {days.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setDate(d.value)}
                className={`shrink-0 rounded-xl border px-3 py-2 text-left ${date === d.value ? 'border-blue-600 bg-blue-600 text-white' : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'}`}
              >
                <span className="block text-sm font-bold">{d.label}</span>
                <span className="block text-[11px] opacity-70">{d.weekday}</span>
              </button>
            ))}
          </div>
          <div className="w-40">
            <DateInput value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100" aria-label="Boshqa sana" />
          </div>
        </div>

        {isOversight && curatorsLoaded && curators.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-800 py-10 text-center text-sm text-zinc-500">
            Hali kurator yo'q — Foydalanuvchilar bo'limida "Kurator" rolida xodim yarating
          </p>
        ) : !ready || (loading && !data) ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        ) : data?.isClosedDay ? (
          <p className="rounded-xl border border-zinc-800 bg-zinc-900 py-10 text-center text-sm text-zinc-500">Yakshanba — dam olish kuni</p>
        ) : (
          <>
            {!isPastDay && (
              <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-white">Ochiq vaqtlarim</h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                    <label className="flex items-center gap-1.5">
                      Bitta vaqtga:
                      <select value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm text-white">
                        {Array.from({ length: data?.maxCapacity ?? 8 }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            {n} ta
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-1.5">
                      Mashg'ulot:
                      <select value={dayLesson} onChange={(e) => setDayLesson(e.target.value)} className="max-w-[220px] rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm text-white">
                        <option value="">— o'zgartirmaslik —</option>
                        {lessons.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.n}. {l.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                  {(data?.allowedMinutes ?? []).map((m) => {
                    const slot = bySlot.get(m);
                    const active = selected.includes(m);
                    const past = isMinutePast(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        disabled={past}
                        onClick={() => setSelected((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]))}
                        className={`rounded-lg border px-2 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                          active ? 'border-blue-600 bg-blue-600/15 text-white' : 'border-zinc-800 bg-zinc-950 text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        <span className="flex items-center gap-1 text-sm font-semibold">
                          {active ? <Check className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                          {hhmm(m)}
                        </span>
                        <span className="block text-[10px] opacity-70">{slot?.booked ? `${slot.booked} ta yozilgan` : active ? 'ochiq' : 'yopiq'}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-zinc-500">
                    {selected.length} ta vaqt tanlangan · {(data?.slots ?? []).reduce((s, x) => s + x.booked, 0)} ta yozilish
                  </p>
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving || !dirty}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Saqlash
                  </button>
                </div>
                {dirty && <p className="text-xs text-amber-400/80">Saqlanmagan o'zgarish bor. O'quvchi yozilgan vaqtni olib tashlasangiz — u o'chmaydi, faqat yangi yozilish yopiladi.</p>}
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white">{isPastDay ? "Shu kungi mashg'ulotlar" : 'Vaqtlar va yozilganlar'}</h3>
              {slotsWithInfo.length === 0 ? (
                <p className="rounded-xl border border-dashed border-zinc-800 py-8 text-center text-sm text-zinc-500">Bu kunda vaqt ochilmagan</p>
              ) : (
                slotsWithInfo.map((s) => (
                  <SlotCard key={s.id} slot={s} lessons={lessons} students={students} act={act} canMark={s.date <= today} />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SlotCard({
  slot,
  lessons,
  students,
  act,
  canMark,
}: {
  slot: CuratorSlot;
  lessons: CuratorLesson[];
  students: CuratorStudentRow[];
  act: (fn: () => Promise<unknown>) => Promise<void>;
  canMark: boolean;
}) {
  const [adding, setAdding] = useState('');
  const inSlot = new Set(slot.students.map((s) => s.studentId));
  const addable = students.filter((s) => !inSlot.has(s.student.id));

  return (
    <div className={`rounded-xl border bg-zinc-900 ${slot.isOpen ? 'border-zinc-800' : 'border-zinc-800/60 opacity-90'}`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 px-4 py-3">
        <span className="text-base font-bold text-white">{slot.time}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] ${slot.booked >= slot.capacity ? 'bg-red-500/10 text-red-400' : 'bg-zinc-800 text-zinc-300'}`}>
          {slot.booked}/{slot.capacity}
        </span>
        {!slot.isOpen && (
          <span className="flex items-center gap-1 text-[11px] text-zinc-500">
            <Lock className="h-3 w-3" /> yopiq
          </span>
        )}
        <select
          value={slot.lesson?.id ?? ''}
          onChange={(e) => act(() => curatorApi.updateSlot(slot.id, { lessonId: e.target.value || null }))}
          className="ml-auto max-w-[260px] rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
          aria-label="Mashg'ulot"
        >
          <option value="">Mashg'ulot belgilanmagan</option>
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>
              {l.n}. {l.title}
            </option>
          ))}
        </select>
        {!slot.isPast && (
          <button
            type="button"
            onClick={() => act(() => curatorApi.updateSlot(slot.id, { isOpen: !slot.isOpen }))}
            className="rounded-lg border border-zinc-800 p-1.5 text-zinc-400 hover:text-white"
            title={slot.isOpen ? 'Yangi yozilishni yopish' : 'Qayta ochish'}
            aria-label={slot.isOpen ? 'Yopish' : 'Ochish'}
          >
            {slot.isOpen ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
          </button>
        )}
        {slot.booked === 0 && (
          <button type="button" onClick={() => act(() => curatorApi.deleteSlot(slot.id))} className="rounded-lg border border-zinc-800 p-1.5 text-zinc-400 hover:text-red-400" title="O'chirish" aria-label="O'chirish">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="divide-y divide-zinc-800">
        {slot.students.length === 0 && <p className="px-4 py-3 text-xs text-zinc-500">Hali hech kim yozilmagan</p>}
        {slot.students.map((st) => (
          <div key={st.bookingId} className="flex items-center gap-2 px-4 py-2">
            <span className="min-w-0 flex-1 truncate text-sm text-zinc-100">{st.fullName}</span>
            <button
              type="button"
              disabled={!canMark}
              onClick={() => act(() => curatorApi.markAttendance(st.bookingId, 'keldi'))}
              title={canMark ? 'Keldi' : "Mashg'ulot kuni kelganda belgilanadi"}
              aria-label="Keldi"
              className={`rounded-lg border p-1.5 disabled:opacity-30 ${st.status === 'keldi' ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400' : 'border-zinc-800 text-zinc-500 hover:text-emerald-400'}`}
            >
              <UserCheck className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={!canMark}
              onClick={() => act(() => curatorApi.markAttendance(st.bookingId, 'kelmadi'))}
              title={canMark ? 'Kelmadi' : "Mashg'ulot kuni kelganda belgilanadi"}
              aria-label="Kelmadi"
              className={`rounded-lg border p-1.5 disabled:opacity-30 ${st.status === 'kelmadi' ? 'border-red-500/40 bg-red-500/15 text-red-400' : 'border-zinc-800 text-zinc-500 hover:text-red-400'}`}
            >
              <UserX className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => act(() => curatorApi.cancelBooking(st.bookingId))} title="Yozilishni bekor qilish" aria-label="Bekor qilish" className="rounded-lg border border-zinc-800 p-1.5 text-zinc-500 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        {!slot.isPast && slot.booked < slot.capacity && addable.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2">
            <select value={adding} onChange={(e) => setAdding(e.target.value)} className={`${inputCls} py-1.5 text-xs`} aria-label="O'quvchini qo'shish">
              <option value="">O'quvchini o'zim qo'shaman…</option>
              {addable.map((s) => (
                <option key={s.student.id} value={s.student.id}>
                  {s.student.fullName}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!adding}
              onClick={() => act(() => curatorApi.addToSlot(slot.id, adding)).then(() => setAdding(''))}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> Qo'shish
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
