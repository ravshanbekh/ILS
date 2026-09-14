import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import { supportHoursApi } from '@/api';
import {
  Loader2,
  Users,
  Clock,
  UserCheck,
  UserX,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CalendarDays,
} from 'lucide-react';

interface BookedStudent {
  bookingId: string;
  fullName: string | null;
  groupName: string | null;
  topic: string | null;
  status: string;
}

interface Slot {
  id: string;
  timeRange: string;
  capacity: number;
  booked: number;
  free: number;
  isOpen: boolean;
  students: BookedStudent[];
}

interface AssistantRow {
  assistantId: string;
  assistantName: string;
  openHours: number;
  capacity: number;
  booked: number;
  attended: number;
  missed: number;
  slots: Slot[];
}

interface Overview {
  date: string;
  isClosedDay: boolean;
  today: string;
  assistants: AssistantRow[];
  totals: {
    openHours: number;
    capacity: number;
    booked: number;
    attended: number;
    missed: number;
    idleAssistants: number;
    assistantCount: number;
  };
}

const WEEKDAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];

function shiftDate(value: string, days: number): string {
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekdayOf(value: string): string {
  const [y, m, d] = value.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function SupportOversightPage() {
  const [date, setDate] = useState(todayLocal());
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await supportHoursApi.getOverview(date);
      setData(res.data.data);
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

  const t = data?.totals;

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header
        title="Assistent qabul soatlari"
        subtitle="Kim qaysi soatni ochgan, kim yozilgan va kim kelgan"
      />

      <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-5">
        {/* Sana */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDate(shiftDate(date, -1))}
              className="px-3 py-2 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white text-sm"
            >
              ‹
            </button>
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white"
            />
            <button
              onClick={() => setDate(shiftDate(date, 1))}
              className="px-3 py-2 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white text-sm"
            >
              ›
            </button>
            <span className="text-zinc-500 text-xs ml-1">{weekdayOf(date)}</span>
          </div>

          <button
            onClick={() => setDate(data?.today || todayLocal())}
            className="px-3 py-2 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold"
          >
            Bugun
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {data?.isClosedDay && (
          <div className="bg-zinc-500/5 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-400">
            Yakshanba — qabul kuni emas.
          </div>
        )}

        {/* Kunlik yig'indi */}
        {t && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Ochilgan soat', value: t.openHours, cls: 'text-white' },
              { label: 'Yozilgan', value: `${t.booked}/${t.capacity}`, cls: 'text-blue-400' },
              { label: 'Kelgan', value: t.attended, cls: 'text-emerald-400' },
              { label: 'Kelmagan', value: t.missed, cls: 'text-red-400' },
              {
                label: 'Soat ochmagan',
                value: `${t.idleAssistants}/${t.assistantCount}`,
                cls: t.idleAssistants > 0 ? 'text-amber-400' : 'text-zinc-500',
              },
            ].map((card) => (
              <div key={card.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-zinc-500 text-[11px] uppercase tracking-wide">{card.label}</p>
                <p className={`text-xl font-bold mt-1 ${card.cls}`}>{card.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Assistentlar */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : (data?.assistants.length ?? 0) === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 text-center">
            <CalendarDays className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">Faol assistent topilmadi</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data!.assistants.map((a) => {
              const isOpen = expanded === a.assistantId;
              const idle = a.openHours === 0;

              return (
                <div
                  key={a.assistantId}
                  className={`bg-zinc-900 border rounded-xl overflow-hidden ${
                    idle ? 'border-amber-500/20' : 'border-zinc-800'
                  }`}
                >
                  <button
                    onClick={() => setExpanded(isOpen ? null : a.assistantId)}
                    className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left hover:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isOpen ? (
                        <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-white font-semibold text-sm truncate">{a.assistantName}</p>
                        <p className="text-zinc-500 text-xs">
                          {idle ? (
                            <span className="text-amber-400 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Bu kunga soat ochmagan
                            </span>
                          ) : (
                            `${a.openHours} soat ochiq · ${a.booked}/${a.capacity} joy band`
                          )}
                        </p>
                      </div>
                    </div>

                    {!idle && (
                      <div className="flex items-center gap-3 text-xs shrink-0">
                        <span className="flex items-center gap-1 text-emerald-400">
                          <UserCheck className="w-3.5 h-3.5" />
                          {a.attended}
                        </span>
                        <span className="flex items-center gap-1 text-red-400">
                          <UserX className="w-3.5 h-3.5" />
                          {a.missed}
                        </span>
                      </div>
                    )}
                  </button>

                  {isOpen && (
                    <div className="border-t border-zinc-800">
                      {a.slots.length === 0 ? (
                        <p className="text-zinc-500 text-sm px-5 py-6 text-center">
                          Bu kunga soat ochilmagan
                        </p>
                      ) : (
                        a.slots.map((slot) => (
                          <div key={slot.id} className="px-5 py-3 border-b border-zinc-900 last:border-0">
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <span className="text-white text-sm font-semibold flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-zinc-500" />
                                {slot.timeRange}
                                {!slot.isOpen && (
                                  <span className="text-[10px] text-zinc-600 font-normal">(yopiq)</span>
                                )}
                              </span>
                              <span className="text-zinc-400 text-xs flex items-center gap-1">
                                <Users className="w-3.5 h-3.5" />
                                {slot.booked}/{slot.capacity}
                              </span>
                            </div>

                            {slot.students.length === 0 ? (
                              <p className="text-zinc-600 text-xs">Hech kim yozilmagan</p>
                            ) : (
                              <div className="space-y-1.5">
                                {slot.students.map((st) => (
                                  <div
                                    key={st.bookingId}
                                    className="flex items-start justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-zinc-200 text-xs font-medium truncate">
                                        {st.fullName}
                                        {st.groupName && (
                                          <span className="text-zinc-600"> · {st.groupName}</span>
                                        )}
                                      </p>
                                      {st.topic && (
                                        <p className="text-zinc-500 text-[11px] mt-0.5">{st.topic}</p>
                                      )}
                                    </div>
                                    <span
                                      className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 ${
                                        st.status === 'keldi'
                                          ? 'text-emerald-400 bg-emerald-500/10'
                                          : st.status === 'kelmadi'
                                          ? 'text-red-400 bg-red-500/10'
                                          : 'text-blue-400 bg-blue-500/10'
                                      }`}
                                    >
                                      {st.status === 'band' ? 'kutilmoqda' : st.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
