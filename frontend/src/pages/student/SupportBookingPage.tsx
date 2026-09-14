import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import { supportHoursApi } from '@/api';
import {
  Loader2,
  Clock,
  Users,
  CheckCircle2,
  X,
  CalendarDays,
  Lock,
  AlertCircle,
  Building2,
} from 'lucide-react';

interface SlotView {
  slotId: string;
  startHour: number;
  timeRange: string;
  assistantId: string;
  assistantName: string;
  assistantAvatar: string | null;
  assistantBio: string | null;
  assistantFilial: string | null;
  capacity: number;
  booked: number;
  free: number;
  isMine: boolean;
  myBookingId: string | null;
  canBook: boolean;
  reason: string | null;
}

interface AssistantCard {
  id: string;
  name: string;
  avatar: string | null;
  bio: string | null;
  filial: string | null;
  slots: SlotView[];
}

/** Ism-familiyadan bosh harflar — rasm bo'lmasa o'rniga ko'rsatiladi */
function initialsOf(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase();
}

interface DayView {
  date: string;
  isClosedDay: boolean;
  alreadyBooked: {
    bookingId: string;
    timeRange: string;
    assistantName: string;
    topic: string | null;
  } | null;
  slots: SlotView[];
}

interface MyBooking {
  id: string;
  date: string;
  timeRange: string;
  assistantName: string;
  topic: string | null;
  status: string;
  canCancel: boolean;
}

const WEEKDAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];

/** Bugundan boshlab 7 kun (yakshanbalar chiqarib tashlanadi) */
function upcomingDays(count = 7): { value: string; label: string; weekday: string }[] {
  const out: { value: string; label: string; weekday: string }[] = [];
  const d = new Date();
  while (out.length < count) {
    if (d.getDay() !== 0) {
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      out.push({
        value,
        label: `${d.getDate()}-${['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'][d.getMonth()]}`,
        weekday: WEEKDAYS[d.getDay()],
      });
    }
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export default function SupportBookingPage() {
  const days = upcomingDays(7);
  const [date, setDate] = useState(days[0].value);
  const [day, setDay] = useState<DayView | null>(null);
  const [mine, setMine] = useState<MyBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [picked, setPicked] = useState<SlotView | null>(null);
  const [topic, setTopic] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dayRes, mineRes] = await Promise.all([
        supportHoursApi.getAvailable(date),
        supportHoursApi.getMyBookings(),
      ]);
      setDay(dayRes.data.data);
      setMine(mineRes.data.data);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.message || 'Ma\'lumotni olishda xatolik');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const confirmBooking = async () => {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      await supportHoursApi.book(picked.slotId, topic.trim() || undefined);
      setPicked(null);
      setTopic('');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.message || 'Yozilishda xatolik');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (bookingId: string) => {
    setBusy(true);
    setError(null);
    try {
      await supportHoursApi.cancelBooking(bookingId);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.message || 'Bekor qilishda xatolik');
    } finally {
      setBusy(false);
    }
  };

  // Assistentlar bo'yicha guruhlash
  const byAssistant = new Map<string, AssistantCard>();
  for (const slot of day?.slots || []) {
    const entry = byAssistant.get(slot.assistantId);
    if (entry) {
      entry.slots.push(slot);
    } else {
      byAssistant.set(slot.assistantId, {
        id: slot.assistantId,
        name: slot.assistantName,
        avatar: slot.assistantAvatar,
        bio: slot.assistantBio,
        filial: slot.assistantFilial,
        slots: [slot],
      });
    }
  }
  const cards = [...byAssistant.values()];

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header
        title="Yordamchi ustoz soatlari"
        subtitle="Bo'sh soatga yozilib qo'shimcha yordam oling"
      />

      <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-5">
        {/* Qoida */}
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 text-sm text-zinc-300 flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>
              Kuniga <span className="text-white font-semibold">bitta</span> soatga yozilishingiz
              mumkin. Bitta soatga <span className="text-white font-semibold">10 tagacha</span> o'quvchi
              sig'adi.
            </p>
            <p className="text-zinc-500 text-xs">
              Ish vaqti 08:00–19:00 · Tushlik 12:00–14:00 · Yakshanba dam olish
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Kun tanlash */}
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

        {/* Bugungi yozuvim */}
        {day?.alreadyBooked && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-start justify-between gap-3">
            <div className="flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-semibold text-sm">
                  Bu kunga yozilgansiz: {day.alreadyBooked.timeRange}
                </p>
                <p className="text-zinc-400 text-xs mt-0.5">
                  {day.alreadyBooked.assistantName}
                  {day.alreadyBooked.topic ? ` · ${day.alreadyBooked.topic}` : ''}
                </p>
              </div>
            </div>
            <button
              onClick={() => cancel(day.alreadyBooked!.bookingId)}
              disabled={busy}
              className="text-red-400 hover:text-red-300 text-xs font-semibold shrink-0 disabled:opacity-50"
            >
              Bekor qilish
            </button>
          </div>
        )}

        {/* Soatlar */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : cards.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 text-center">
            <CalendarDays className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">Bu kunga hali hech kim soat ochmagan</p>
            <p className="text-zinc-600 text-xs mt-1">Boshqa kunni tanlab ko'ring</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((a) => {
              const freeTotal = a.slots.reduce((s, x) => s + (x.canBook ? x.free : 0), 0);
              return (
                <div
                  key={a.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col"
                >
                  {/* Rasm */}
                  {a.avatar ? (
                    <img
                      src={a.avatar}
                      alt={a.name}
                      loading="lazy"
                      className="w-full aspect-square object-cover bg-zinc-900"
                    />
                  ) : (
                    <div className="w-full aspect-square bg-zinc-900 flex items-center justify-center text-4xl font-bold text-zinc-700">
                      {initialsOf(a.name)}
                    </div>
                  )}

                  {/* Ma'lumot */}
                  <div className="p-4 flex flex-col gap-1.5 grow">
                    <h3 className="text-white font-bold text-sm leading-tight">{a.name}</h3>

                    {a.filial ? (
                      <p className="text-zinc-400 text-xs flex items-center gap-1">
                        <Building2 className="w-3 h-3 shrink-0" />
                        {a.filial}
                      </p>
                    ) : (
                      <p className="text-zinc-600 text-xs">Filial ko'rsatilmagan</p>
                    )}

                    {a.bio && <p className="text-zinc-400 text-xs leading-relaxed mt-1">{a.bio}</p>}

                    <p className="text-[11px] mt-1.5">
                      {freeTotal > 0 ? (
                        <span className="text-emerald-400">{freeTotal} ta bo'sh joy</span>
                      ) : (
                        <span className="text-zinc-600">Bo'sh joy qolmagan</span>
                      )}
                    </p>
                  </div>

                  {/* Soatlar */}
                  <div className="px-4 pb-4 mt-auto">
                    <div className="grid grid-cols-2 gap-2">
                      {a.slots
                        .slice()
                        .sort((x, y) => x.startHour - y.startHour)
                        .map((slot) => {
                          const base =
                            'rounded-lg border px-2.5 py-2 text-left transition-colors disabled:cursor-not-allowed';
                          const cls = slot.isMine
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : slot.canBook
                            ? 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:border-blue-600 hover:text-white'
                            : 'bg-zinc-900 border-zinc-900 text-zinc-600';

                          return (
                            <button
                              key={slot.slotId}
                              disabled={!slot.canBook}
                              onClick={() => {
                                setPicked(slot);
                                setTopic('');
                              }}
                              className={`${base} ${cls}`}
                            >
                              <span className="flex items-center gap-1 text-xs font-semibold">
                                <Clock className="w-3 h-3 shrink-0" />
                                {slot.timeRange}
                              </span>
                              <span className="flex items-center gap-1 text-[10px] mt-0.5 opacity-80">
                                {slot.isMine ? (
                                  <>
                                    <CheckCircle2 className="w-2.5 h-2.5" /> Yozildingiz
                                  </>
                                ) : slot.reason ? (
                                  <>
                                    <Lock className="w-2.5 h-2.5" /> {slot.reason}
                                  </>
                                ) : (
                                  <>
                                    <Users className="w-2.5 h-2.5" /> {slot.free} joy
                                  </>
                                )}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tarix */}
        {mine.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <h3 className="text-white font-bold px-5 py-3 border-b border-zinc-800 text-sm">
              Mening yozuvlarim
            </h3>
            <div className="divide-y divide-zinc-900">
              {mine.map((b) => (
                <div key={b.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">
                      {b.date} · {b.timeRange}
                    </p>
                    <p className="text-zinc-500 text-xs truncate">
                      {b.assistantName}
                      {b.topic ? ` · ${b.topic}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`text-[11px] font-semibold px-2 py-1 rounded-md border ${
                        b.status === 'keldi'
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                          : b.status === 'kelmadi'
                          ? 'text-red-400 bg-red-500/10 border-red-500/20'
                          : b.status === 'bekor'
                          ? 'text-zinc-500 bg-zinc-500/10 border-zinc-700'
                          : 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                      }`}
                    >
                      {b.status === 'band' ? 'Yozilgan' : b.status}
                    </span>
                    {b.canCancel && (
                      <button
                        onClick={() => cancel(b.id)}
                        disabled={busy}
                        className="text-red-400 hover:text-red-300 text-xs disabled:opacity-50"
                      >
                        Bekor
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tasdiqlash oynasi */}
      {picked && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <h2 className="text-white font-bold">Yozilishni tasdiqlang</h2>
              <button onClick={() => setPicked(null)} className="text-zinc-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm">
                <p className="text-white font-semibold">{picked.timeRange}</p>
                <p className="text-zinc-400 text-xs mt-0.5">
                  {picked.assistantName} · {date}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                  Nima bo'yicha yordam kerak? <span className="text-zinc-600">(ixtiyoriy)</span>
                </label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  rows={3}
                  maxLength={300}
                  placeholder="Masalan: 12-normativdagi tsikl tushunarsiz"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white resize-none"
                />
                <p className="text-zinc-600 text-[11px] mt-1">
                  Ustoz oldindan tayyorlanib kelishi uchun yozib qo'ying
                </p>
              </div>

              <button
                onClick={confirmBooking}
                disabled={busy}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Yozilaman
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
