import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Clock,
  RefreshCw,
  Settings2,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import { milestonesApi } from '@/api';

type MilestoneType = 'demo_day' | 'imtihon';
type Status =
  | 'kutilmoqda'
  | 'sana_tanlandi'
  | 'bajarildi'
  | 'kechikdi'
  | 'kechikib_bajarildi';

interface Row {
  id: string;
  type: MilestoneType;
  seq: number;
  dueDate: string;
  plannedDate: string | null;
  heldAt: string | null;
  status: Status;
  daysLate: number;
  group: { id: string; name: string; teacher: { id: string; fullName: string } | null };
}

interface Bucket {
  total: number;
  done: number;
  lateDone: number;
  pending: number;
  late: number;
}

interface Summary {
  month: string;
  demoDay: Bucket;
  exam: Bucket;
  lateList: Array<{
    type: MilestoneType;
    groupName: string;
    teacherName: string;
    daysLate: number;
  }>;
}

interface UnconfiguredGroup {
  id: string;
  name: string;
  teacher: { id: string; fullName: string } | null;
  startDate: string | null;
  durationMonths: number | null;
  lessonDayType: string | null;
}

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString('uz-UZ') : '—');
const typeLabel = (t: MilestoneType) => (t === 'demo_day' ? 'Demo day' : 'Imtihon');

const STATUS_UI: Record<Status, { text: string; cls: string }> = {
  kutilmoqda: { text: 'Sana tanlanmagan', cls: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
  sana_tanlandi: { text: 'Sana tanlandi', cls: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
  bajarildi: { text: "O'tkazildi", cls: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  kechikdi: { text: 'Kechikdi', cls: 'bg-red-500/10 text-red-500 border-red-500/20' },
  kechikib_bajarildi: {
    text: "Kechikib o'tkazildi",
    cls: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  },
};

function currentMonth(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

/** Statistika bloki uchun bitta qator */
function StatLine({
  label,
  b,
}: {
  label: string;
  b: Bucket;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="text-zinc-400 w-24 shrink-0">{label}</span>
      <span className="text-white font-bold">{b.total} guruh</span>
      <span className="text-zinc-600">·</span>
      <span className="text-emerald-500 font-bold">{b.done} ✅</span>
      {b.lateDone > 0 && (
        <>
          <span className="text-zinc-600">·</span>
          <span className="text-amber-500 font-bold">{b.lateDone} ⏱ kechikib</span>
        </>
      )}
      <span className="text-zinc-600">·</span>
      <span className="text-sky-400 font-bold">{b.pending} 🟡</span>
      <span className="text-zinc-600">·</span>
      <span className="text-red-500 font-bold">{b.late} 🔴</span>
    </div>
  );
}

export default function MilestonesControlPage() {
  const [month, setMonth] = useState(currentMonth);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [unconfigured, setUnconfigured] = useState<UnconfiguredGroup[]>([]);
  const [typeFilter, setTypeFilter] = useState<'' | MilestoneType>('');
  const [statusFilter, setStatusFilter] = useState<'' | Status>('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, o, u] = await Promise.all([
        milestonesApi.summary(month),
        milestonesApi.overview({
          type: typeFilter || undefined,
          status: statusFilter || undefined,
        }),
        milestonesApi.unconfigured(),
      ]);
      setSummary(s.data?.data ?? null);
      setRows(o.data?.data ?? []);
      setUnconfigured(u.data?.data ?? []);
    } catch {
      setSummary(null);
      setRows([]);
      setUnconfigured([]);
    } finally {
      setLoading(false);
    }
  }, [month, typeFilter, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // Kechikkanlar doim tepada — nazoratda aynan shular kerak
  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        if (a.daysLate !== b.daysLate) return b.daysLate - a.daysLate;
        return a.dueDate.localeCompare(b.dueDate);
      }),
    [rows]
  );

  return (
    <div>
      <Header
        title="Demo day va imtihon nazorati"
        subtitle="Kim o'tkazdi, kim kechikdi, qaysi guruhda"
      />

      <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {/* ── Skrinshot uchun statistika ──────────────────────────────────
            O'quv bo'limi guruhiga tashlash uchun: katta shrift, ortiqcha
            element yo'q, telefondan skrinshot olinsa ham o'qiladi. */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-sky-400" />
              {month} — natijalar
            </h2>
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-white text-sm"
              />
              <button
                type="button"
                onClick={load}
                className="p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white"
                aria-label="Yangilash"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {summary && (
            <div className="space-y-3 text-base sm:text-lg">
              <StatLine label="Demo day" b={summary.demoDay} />
              <StatLine label="Imtihon" b={summary.exam} />

              {summary.lateList.length > 0 ? (
                <div className="pt-4 mt-4 border-t border-zinc-800">
                  <p className="text-red-500 font-bold mb-2">
                    🔴 Kechikkanlar ({summary.lateList.length})
                  </p>
                  <ul className="space-y-1.5">
                    {summary.lateList.map((l, i) => (
                      <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-sm sm:text-base">
                        <span className="font-semibold text-white">{l.groupName}</span>
                        <span className="text-zinc-600">·</span>
                        <span className="text-zinc-300">{typeLabel(l.type)}</span>
                        <span className="text-zinc-600">·</span>
                        <span className="text-zinc-400">{l.teacherName}</span>
                        <span className="text-red-500 font-bold">{l.daysLate} kun</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="pt-4 mt-4 border-t border-zinc-800 text-emerald-500 font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Kechikkan yo'q
                </p>
              )}
            </div>
          )}

          {!loading && !summary && (
            <p className="text-zinc-500 text-sm">Bu oy uchun ma'lumot yo'q</p>
          )}
        </div>

        {/* ── Sozlanmagan guruhlar ───────────────────────────────────────── */}
        {unconfigured.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
            <div className="flex items-center gap-2 mb-1">
              <Settings2 className="w-4 h-4 text-amber-500" />
              <h3 className="font-bold text-amber-500 text-sm">
                Sozlanmagan guruhlar ({unconfigured.length})
              </h3>
            </div>
            <p className="text-xs text-zinc-400 mb-3">
              Boshlanish sanasi, kurs uzunligi yoki dars kunlari belgilanmagan — bu
              guruhlarda demo day va imtihon jadvali <b>umuman qurilmaydi</b>
            </p>
            <div className="flex flex-wrap gap-2">
              {unconfigured.map((g) => (
                <span
                  key={g.id}
                  className="px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs"
                >
                  <span className="text-white font-medium">{g.name}</span>
                  <span className="text-zinc-600"> · </span>
                  <span className="text-zinc-400">{g.teacher?.fullName ?? 'biriktirilmagan'}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Batafsil jadval ────────────────────────────────────────────── */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="p-5 border-b border-zinc-800 flex items-center gap-3 flex-wrap">
            <h3 className="font-bold text-white text-sm mr-auto">Barcha bosqichlar</h3>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-white text-xs"
            >
              <option value="">Barcha turlar</option>
              <option value="demo_day">Demo day</option>
              <option value="imtihon">Imtihon</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-white text-xs"
            >
              <option value="">Barcha holatlar</option>
              <option value="kechikdi">Kechikdi</option>
              <option value="kutilmoqda">Sana tanlanmagan</option>
              <option value="sana_tanlandi">Sana tanlandi</option>
              <option value="bajarildi">O'tkazildi</option>
              <option value="kechikib_bajarildi">Kechikib o'tkazildi</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-950/50 text-[10px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Guruh</th>
                  <th className="px-5 py-3 text-left font-medium">O'qituvchi</th>
                  <th className="px-5 py-3 text-left font-medium">Tur</th>
                  <th className="px-5 py-3 text-center font-medium">Muddat</th>
                  <th className="px-5 py-3 text-center font-medium">Tanlangan</th>
                  <th className="px-5 py-3 text-center font-medium">Holat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-zinc-500">
                      {loading ? 'Yuklanmoqda...' : 'Bosqich topilmadi'}
                    </td>
                  </tr>
                ) : (
                  sorted.map((r) => {
                    const ui = STATUS_UI[r.status];
                    return (
                      <tr
                        key={r.id}
                        className={r.status === 'kechikdi' ? 'bg-red-500/5' : 'hover:bg-zinc-800/30'}
                      >
                        <td className="px-5 py-3 font-medium text-white">{r.group.name}</td>
                        <td className="px-5 py-3 text-zinc-400">
                          {r.group.teacher?.fullName ?? '—'}
                        </td>
                        <td className="px-5 py-3 text-zinc-300">
                          {typeLabel(r.type)} #{r.seq}
                        </td>
                        <td className="px-5 py-3 text-center text-zinc-300">{fmt(r.dueDate)}</td>
                        <td className="px-5 py-3 text-center text-sky-400">
                          {fmt(r.plannedDate)}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded border ${ui.cls}`}
                            >
                              {ui.text}
                            </span>
                            {r.daysLate > 0 && (
                              <span className="text-[10px] font-bold text-red-500 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                {r.daysLate} kun
                              </span>
                            )}
                            {r.status === 'sana_tanlandi' && (
                              <Clock className="w-3 h-3 text-sky-400" />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
