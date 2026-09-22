import { useCallback, useEffect, useMemo, useState } from 'react';
import Header from '@/components/layout/Header';
import { supportHoursApi } from '@/api';
import { uzDayMonth } from '@/utils/uzDate';
import { AlertTriangle, Loader2, Trophy, ArrowUpDown } from 'lucide-react';

/**
 * Assistentlar mehnati — statistika va reyting.
 *
 * "Ishlagan soat" ataylab uchga ajratilgan, chunki ular bir xil emas:
 *   Ochgan  — taklif qilgan soat. Hali mehnat emas.
 *   Band    — o'quvchi yozilgan soat. Assistent band bo'lgan.
 *   Ishlagan — kamida bitta o'quvchi HAQIQATAN kelgan soat.
 *
 * Reyting "Ishlagan" bo'yicha, lekin uchalasi ham ustunda turadi —
 * bitta raqamga ishonib qolmaslik uchun.
 */

interface Row {
  rank: number;
  assistantId: string;
  fullName: string;
  role: string | null;
  openedHours: number;
  bookedHours: number;
  workedHours: number;
  idleHours: number;
  activeDays: number;
  attended: number;
  uniqueStudents: number;
  noShow: number;
  cancelled: number;
  unmarked: number;
  capacityOffered: number;
  fillRate: number;
  hoursPerWeek: number;
  studentsPerHour: number;
}

interface Stats {
  from: string;
  to: string;
  days: number;
  weeks: number;
  totals: { openedHours: number; workedHours: number; attended: number; noShow: number; unmarked: number };
  attendanceUnreliable: boolean;
  rows: Row[];
}

type SortKey = keyof Pick<
  Row,
  'workedHours' | 'openedHours' | 'attended' | 'uniqueStudents' | 'hoursPerWeek' | 'fillRate' | 'noShow' | 'studentsPerHour'
>;

/** YYYY-MM-DD, mahalliy vaqt bo'yicha (toISOString UTC ga surib yuboradi) */
function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function presetRange(preset: 'week' | 'month' | 'prevMonth'): { from: string; to: string } {
  const now = new Date();
  if (preset === 'week') {
    // Dushanbadan boshlanadigan joriy hafta
    const day = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - day);
    return { from: iso(monday), to: iso(now) };
  }
  if (preset === 'month') {
    return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) };
  }
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last = new Date(now.getFullYear(), now.getMonth(), 0);
  return { from: iso(first), to: iso(last) };
}

const COLUMNS: { key: SortKey; label: string; hint: string }[] = [
  { key: 'workedHours', label: 'Ishlagan', hint: 'Kamida bitta o’quvchi kelgan soatlar' },
  { key: 'hoursPerWeek', label: 'Soat/hafta', hint: 'Haftasiga o’rtacha ishlagan soat' },
  { key: 'attended', label: 'Qabul', hint: 'Jami kelgan o’quvchilar (takrorlari bilan)' },
  { key: 'uniqueStudents', label: 'Noyob', hint: 'Nechta har xil o’quvchi kelgan' },
  { key: 'studentsPerHour', label: 'Bola/soat', hint: 'Bitta ishlagan soatga o’rtacha nechta o’quvchi' },
  { key: 'openedHours', label: 'Ochgan', hint: 'Nechta soat taklif qilgan' },
  { key: 'fillRate', label: 'To’lish %', hint: 'Taklif qilingan joylarning qanchasi ishlatilgan' },
  { key: 'noShow', label: 'Kelmagan', hint: 'Yozilib kelmagan o’quvchilar' },
];

export default function SupportStatsPage() {
  const [preset, setPreset] = useState<'week' | 'month' | 'prevMonth' | 'custom'>('month');
  const [range, setRange] = useState(() => presetRange('month'));
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('workedHours');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await supportHoursApi.getStats(range.from, range.to);
      setData(res.data.data);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.message || 'Yuklanmadi');
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    load();
  }, [load]);

  const choose = (p: 'week' | 'month' | 'prevMonth') => {
    setPreset(p);
    setRange(presetRange(p));
  };

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data.rows].sort((a, b) => b[sortKey] - a[sortKey] || a.fullName.localeCompare(b.fullName));
  }, [data, sortKey]);

  /** Reytingda ishtirok etmaganlarni pastda alohida ko'rsatamiz */
  const active = sorted.filter((r) => r.openedHours > 0);
  const inactive = sorted.filter((r) => r.openedHours === 0);

  const chipClass = 'min-h-11 rounded-xl px-4 text-sm font-semibold transition-colors';

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <Header title="Assistentlar reytingi" subtitle="Kim necha soat ishlagan va nechta o'quvchiga qaragan" />

      <div className="mx-auto w-full max-w-[1400px] p-4 sm:p-6">
        {/* Davr tanlash */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {([
            ['week', 'Shu hafta'],
            ['month', 'Shu oy'],
            ['prevMonth', "O'tgan oy"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => choose(key)}
              className={chipClass}
              style={
                preset === key
                  ? { background: 'var(--primary)', color: 'var(--on-primary)' }
                  : { background: 'var(--surface)', color: 'var(--foreground)', border: '1px solid var(--border)' }
              }
            >
              {label}
            </button>
          ))}

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={range.from}
              onChange={(e) => { setPreset('custom'); setRange((r) => ({ ...r, from: e.target.value })); }}
              className="min-h-11 rounded-xl border px-3 text-sm"
              aria-label="Boshlanish sanasi"
            />
            <span style={{ color: 'var(--muted-foreground)' }}>—</span>
            <input
              type="date"
              value={range.to}
              onChange={(e) => { setPreset('custom'); setRange((r) => ({ ...r, to: e.target.value })); }}
              className="min-h-11 rounded-xl border px-3 text-sm"
              aria-label="Tugash sanasi"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-16" style={{ color: 'var(--muted-foreground)' }}>
            <Loader2 className="h-5 w-5 animate-spin" /> Yuklanmoqda...
          </div>
        ) : error ? (
          <div
            className="rounded-2xl border p-5"
            style={{ background: 'var(--danger-bg)', borderColor: 'var(--border)', color: 'var(--danger-fg)' }}
          >
            {error}
          </div>
        ) : !data ? null : (
          <>
            {/* Davomat belgilanmagan bo'lsa — reytingga ishonib bo'lmaydi */}
            {data.attendanceUnreliable && (
              <div
                className="mb-5 flex items-start gap-3 rounded-2xl border p-4"
                style={{ background: 'var(--warning-bg)', borderColor: 'var(--border)', color: 'var(--warning-fg)' }}
              >
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <div className="text-sm">
                  <p className="font-bold">Davomat deyarli belgilanmagan</p>
                  <p className="mt-1">
                    {data.totals.unmarked} ta yozuvda "keldi/kelmadi" bosilmagan. "Ishlagan soat"
                    aynan shunga qarab hisoblanadi, shuning uchun bu davr uchun reyting haqiqiy
                    ahvolni ko'rsatmaydi. Avval assistentlardan davomatni belgilashni so'rang.
                  </p>
                </div>
              </div>
            )}

            {/* Umumiy */}
            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ['Ishlagan soat', data.totals.workedHours, `${data.totals.openedHours} soat ochilgan`],
                ['Qabul qilingan', data.totals.attended, "o'quvchi (takrorlari bilan)"],
                ['Kelmagan', data.totals.noShow, 'yozilib kelmagan'],
                ['Davr', `${data.days} kun`, `${uzDayMonth(data.from)} — ${uzDayMonth(data.to)}`],
              ].map(([label, value, hint]) => (
                <div
                  key={String(label)}
                  className="rounded-2xl border p-4"
                  style={{ background: 'var(--card-fill)', borderColor: 'var(--border)' }}
                >
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
                  <p className="tabular mt-1 text-2xl font-bold">{value}</p>
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>{hint}</p>
                </div>
              ))}
            </div>

            {active.length === 0 ? (
              <div
                className="rounded-2xl border p-8 text-center"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
              >
                Bu davrda hech kim soat ochmagan.
              </div>
            ) : (
              <div
                className="overflow-x-auto rounded-2xl border"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th className="px-4 py-3 text-left font-bold">#</th>
                      <th className="px-4 py-3 text-left font-bold">Assistent</th>
                      {COLUMNS.map((c) => (
                        <th key={c.key} className="px-3 py-3 text-right font-bold">
                          <button
                            type="button"
                            onClick={() => setSortKey(c.key)}
                            title={c.hint}
                            className="inline-flex items-center gap-1 whitespace-nowrap"
                            style={{ color: sortKey === c.key ? 'var(--primary)' : 'var(--foreground)' }}
                          >
                            {c.label}
                            <ArrowUpDown className="h-3 w-3 opacity-60" aria-hidden="true" />
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {active.map((r, i) => (
                      <tr key={r.assistantId} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td className="px-4 py-3">
                          {i < 3 ? (
                            <span
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                              style={{ background: 'var(--trend-up-bg)', color: 'var(--trend-up-fg)' }}
                            >
                              {i + 1}
                            </span>
                          ) : (
                            <span className="tabular" style={{ color: 'var(--muted-foreground)' }}>{i + 1}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold">{r.fullName}</p>
                          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            {r.activeDays} kun faol
                            {r.idleHours > 0 && ` · ${r.idleHours} soat bo'sh o'tgan`}
                            {r.unmarked > 0 && ` · ${r.unmarked} ta davomat belgilanmagan`}
                          </p>
                        </td>
                        {COLUMNS.map((c) => (
                          <td
                            key={c.key}
                            className="tabular px-3 py-3 text-right"
                            style={{
                              fontWeight: c.key === sortKey ? 700 : 400,
                              color: c.key === 'noShow' && r.noShow > 0 ? 'var(--danger-fg)' : undefined,
                            }}
                          >
                            {r[c.key]}
                            {c.key === 'fillRate' ? '%' : ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Soat ochmaganlar — reytingda emas, lekin ko'rinishi kerak */}
            {inactive.length > 0 && (
              <section className="mt-6">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--muted-foreground)' }}>
                  <Trophy className="h-4 w-4" aria-hidden="true" />
                  Bu davrda umuman soat ochmaganlar ({inactive.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {inactive.map((r) => (
                    <span
                      key={r.assistantId}
                      className="rounded-xl border px-3 py-2 text-sm"
                      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                    >
                      {r.fullName}
                    </span>
                  ))}
                </div>
              </section>
            )}

            <p className="mt-6 text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
              <strong>Ishlagan</strong> — kamida bitta o'quvchi haqiqatan kelgan soatlar.
              <strong> Ochgan</strong> — taklif qilingan soatlar (hali mehnat emas).
              <strong> Qabul</strong> — kelgan o'quvchilar soni, bitta o'quvchi bir necha marta
              kelsa har safar hisoblanadi. <strong>Noyob</strong> — nechta har xil o'quvchi.
              Ustun sarlavhasini bosib tartiblash mumkin.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
