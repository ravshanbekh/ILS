import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import { supportHoursApi } from '@/api';
import {
  Loader2,
  Clock,
  Users,
  Check,
  X,
  Save,
  UserCheck,
  UserX,
  Lock,
  AlertCircle,
} from 'lucide-react';

interface BookedStudent {
  bookingId: string;
  studentId: string;
  fullName: string | null;
  groupName: string | null;
  topic: string | null;
  status: string;
}

interface Slot {
  id: string;
  startHour: number;
  timeRange: string;
  capacity: number;
  booked: number;
  free: number;
  isOpen: boolean;
  students: BookedStudent[];
}

interface DayData {
  date: string;
  isClosedDay: boolean;
  allowedHours: number[];
  maxCapacity: number;
  slots: Slot[];
}

const WEEKDAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];

function upcomingDays(count = 7) {
  const out: { value: string; label: string; weekday: string }[] = [];
  const d = new Date();
  while (out.length < count) {
    if (d.getDay() !== 0) {
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      out.push({ value, label: `${d.getDate()}-${MONTHS[d.getMonth()]}`, weekday: WEEKDAYS[d.getDay()] });
    }
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export default function MySupportHoursPage() {
  const days = upcomingDays(7);
  const [date, setDate] = useState(days[0].value);
  const [data, setData] = useState<DayData | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [capacity, setCapacity] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openSlot, setOpenSlot] = useState<Slot | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await supportHoursApi.getMyDay(date);
      const day: DayData = res.data.data;
      setData(day);
      setSelected(day.slots.filter((s) => s.isOpen).map((s) => s.startHour));
      setCapacity(day.slots[0]?.capacity ?? day.maxCapacity);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.message || 'Xatolik');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const toggleHour = (hour: number) => {
    setSelected((prev) => (prev.includes(hour) ? prev.filter((h) => h !== hour) : [...prev, hour]));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await supportHoursApi.setMyDay({ date, hours: selected, capacity });
      const day: DayData = res.data.data;
      setData(day);
      setSelected(day.slots.filter((s) => s.isOpen).map((s) => s.startHour));
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.message || 'Saqlashda xatolik');
    } finally {
      setSaving(false);
    }
  };

  const mark = async (bookingId: string, status: 'keldi' | 'kelmadi') => {
    try {
      await supportHoursApi.markAttendance(bookingId, status);
      await load();
      setOpenSlot(null);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.message || 'Xatolik');
    }
  };

  const slotByHour = new Map((data?.slots || []).map((s) => [s.startHour, s]));
  const currentOpen = data?.slots.filter((s) => s.isOpen) || [];
  const totalBooked = (data?.slots || []).reduce((sum, s) => sum + s.booked, 0);
  const dirty =
    data !== null &&
    JSON.stringify([...selected].sort((a, b) => a - b)) !==
      JSON.stringify(data.slots.filter((s) => s.isOpen).map((s) => s.startHour).sort((a, b) => a - b));

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header title="Mening qabul soatlarim" subtitle="Bo'sh soatlaringizni belgilang — o'quvchilar shu vaqtga yoziladi" />

      <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-5">
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 text-sm text-zinc-300 flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>
              Faqat <span className="text-white font-semibold">dars vaqtingizdan tashqari</span> bo'sh
              soatlarni belgilang — o'quvchilar shu soatlarga yoziladi.
            </p>
            <p className="text-zinc-500 text-xs">
              Ish vaqti 08:00–19:00 · Tushlik 12:00–14:00 · Yakshanba dam olish · Bir soatga 10 tagacha o'quvchi
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.map((d) => (
            <button
              key={d.value}
              onClick={() => setDate(d.value)}
              className={`shrink-0 px-4 py-2.5 rounded-xl border text-left transition-colors ${
                date === d.value
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              <span className="block text-sm font-bold">{d.label}</span>
              <span className="block text-[11px] opacity-70">{d.weekday}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* Soat tanlash */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h3 className="text-white font-bold text-sm">Bo'sh soatlarim</h3>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-zinc-400">Bir soatga:</label>
                  <select
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-sm text-white"
                  >
                    {Array.from({ length: data?.maxCapacity ?? 10 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n} ta
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {(data?.allowedHours || []).map((hour) => {
                  const slot = slotByHour.get(hour);
                  const active = selected.includes(hour);
                  const hasStudents = (slot?.booked ?? 0) > 0;

                  return (
                    <button
                      key={hour}
                      onClick={() => toggleHour(hour)}
                      className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        active
                          ? 'bg-blue-600/15 border-blue-600 text-white'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 text-sm font-semibold">
                        {active ? <Check className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                        {String(hour).padStart(2, '0')}:00
                      </span>
                      <span className="block text-[11px] mt-0.5 opacity-70">
                        {hasStudents ? `${slot!.booked} ta yozilgan` : active ? 'ochiq' : 'yopiq'}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <p className="text-zinc-500 text-xs">
                  {currentOpen.length} ta soat ochiq · {totalBooked} ta o'quvchi yozilgan
                </p>
                <button
                  onClick={save}
                  disabled={saving || !dirty}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Saqlash
                </button>
              </div>

              {dirty && (
                <p className="text-amber-400/80 text-xs">
                  O'zgarishlar hali saqlanmadi. O'quvchi yozilgan soatni ro'yxatdan chiqarsangiz, u
                  o'chmaydi — faqat yangi yozilish to'xtaydi.
                </p>
              )}
            </div>

            {/* Yozilganlar */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <h3 className="text-white font-bold px-5 py-3 border-b border-zinc-800 text-sm">
                Kim yozilgan
              </h3>
              {(data?.slots || []).filter((s) => s.booked > 0).length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-8">Hali hech kim yozilmagan</p>
              ) : (
                <div className="divide-y divide-zinc-900">
                  {(data?.slots || [])
                    .filter((s) => s.booked > 0)
                    .map((slot) => (
                      <button
                        key={slot.id}
                        onClick={() => setOpenSlot(slot)}
                        className="w-full px-5 py-3 flex items-center justify-between gap-3 hover:bg-white/[0.02] text-left"
                      >
                        <div>
                          <p className="text-white text-sm font-semibold flex items-center gap-2">
                            {slot.timeRange}
                            {!slot.isOpen && (
                              <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                                <Lock className="w-3 h-3" /> yopiq
                              </span>
                            )}
                          </p>
                          <p className="text-zinc-500 text-xs truncate max-w-[220px] sm:max-w-none">
                            {slot.students.map((s) => s.fullName).join(', ')}
                          </p>
                        </div>
                        <span className="flex items-center gap-1.5 text-sm text-zinc-300 shrink-0">
                          <Users className="w-4 h-4" />
                          {slot.booked}/{slot.capacity}
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Soat tafsiloti + davomat */}
      {openSlot && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <div>
                <h2 className="text-white font-bold">{openSlot.timeRange}</h2>
                <p className="text-zinc-500 text-xs">
                  {date} · {openSlot.booked}/{openSlot.capacity} o'quvchi
                </p>
              </div>
              <button onClick={() => setOpenSlot(null)} className="text-zinc-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto divide-y divide-zinc-900">
              {openSlot.students.map((st) => (
                <div key={st.bookingId} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium">{st.fullName}</p>
                      <p className="text-zinc-500 text-xs">{st.groupName || '—'}</p>
                      {st.topic && (
                        <p className="text-zinc-400 text-xs mt-1 bg-zinc-900 rounded px-2 py-1 border border-zinc-800">
                          {st.topic}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => mark(st.bookingId, 'keldi')}
                        title="Keldi"
                        className={`p-1.5 rounded-lg border ${
                          st.status === 'keldi'
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                            : 'border-zinc-800 text-zinc-500 hover:text-emerald-400'
                        }`}
                      >
                        <UserCheck className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => mark(st.bookingId, 'kelmadi')}
                        title="Kelmadi"
                        className={`p-1.5 rounded-lg border ${
                          st.status === 'kelmadi'
                            ? 'bg-red-500/15 border-red-500/40 text-red-400'
                            : 'border-zinc-800 text-zinc-500 hover:text-red-400'
                        }`}
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
