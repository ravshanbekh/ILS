import { useCallback, useEffect, useState } from 'react';
import { CalendarCheck, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { milestonesApi } from '../../api';

type MilestoneType = 'demo_day' | 'imtihon';
type Status =
  | 'kutilmoqda'
  | 'sana_tanlandi'
  | 'bajarildi'
  | 'kechikdi'
  | 'kechikib_bajarildi';

interface Milestone {
  id: string;
  type: MilestoneType;
  seq: number;
  candidates: string[];
  dueDate: string;
  plannedDate: string | null;
  heldAt: string | null;
  status: Status;
}

const fmt = (d: string) => new Date(d).toLocaleDateString('uz-UZ');
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

/**
 * Guruhning demo day va imtihon bosqichlari.
 *
 * O'qituvchi taklif qilingan 3 ta dars kunidan birini tanlaydi. Imtihon
 * "o'tkazildi" belgisini OLMAYDI — u imtihon ma'lumotidan avtomatik
 * aniqlanadi (cron 06:00), shuning uchun faqat demo day uchun tugma bor.
 */
export default function GroupMilestonesCard({ groupId }: { groupId: string }) {
  const [items, setItems] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await milestonesApi.getByGroup(groupId);
      setItems(res.data?.data ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e: any) {
      // errorHandler { success:false, error:{ message } } qaytaradi —
      // data.message har doim undefined bo'lardi.
      setError(e?.response?.data?.error?.message || e?.response?.data?.message || 'Xatolik yuz berdi');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return null;

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="flex items-center gap-2 mb-1">
          <CalendarCheck className="w-4 h-4 text-zinc-500" />
          <h3 className="font-bold text-white text-sm">Demo day va imtihon</h3>
        </div>
        <p className="text-sm text-zinc-500">
          Jadval qurilmagan. Guruh sozlamasida boshlanish sanasi, kurs uzunligi va
          dars kunlarini belgilang.
        </p>
      </div>
    );
  }

  // Tugallanmaganlar tepada — o'qituvchiga aynan shular kerak
  const open = items.filter((m) => !m.heldAt);
  const done = items.filter((m) => m.heldAt);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="flex items-center gap-2 mb-4">
        <CalendarCheck className="w-4 h-4 text-sky-400" />
        <h3 className="font-bold text-white text-sm">Demo day va imtihon</h3>
      </div>

      {error && (
        <p className="mb-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {open.map((m) => {
          const ui = STATUS_UI[m.status];
          const isLate = m.status === 'kechikdi';
          return (
            <div
              key={m.id}
              className={`rounded-lg border p-4 ${
                isLate ? 'border-red-500/30 bg-red-500/5' : 'border-zinc-800 bg-zinc-950/50'
              }`}
            >
              <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                <div className="flex items-center gap-2">
                  {isLate ? (
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  ) : (
                    <Clock className="w-4 h-4 text-zinc-500" />
                  )}
                  <span className="font-semibold text-white text-sm">
                    {typeLabel(m.type)} #{m.seq}
                  </span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${ui.cls}`}>
                  {ui.text}
                </span>
              </div>

              <p className="text-xs text-zinc-500 mb-3">
                Muddat: <span className="text-zinc-300 font-medium">{fmt(m.dueDate)}</span>
                {m.plannedDate && (
                  <>
                    {' · '}Tanlangan:{' '}
                    <span className="text-sky-400 font-medium">{fmt(m.plannedDate)}</span>
                  </>
                )}
              </p>

              <div className="flex flex-wrap gap-2">
                {m.candidates.map((c) => {
                  const chosen = m.plannedDate && fmt(m.plannedDate) === fmt(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      disabled={busyId === m.id}
                      onClick={() => run(m.id, () => milestonesApi.pickDate(m.id, c.slice(0, 10)))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
                        chosen
                          ? 'bg-sky-500/15 text-sky-400 border-sky-500/40'
                          : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-600'
                      }`}
                    >
                      {fmt(c)}
                    </button>
                  );
                })}

                {m.type === 'demo_day' && (
                  <button
                    type="button"
                    disabled={busyId === m.id}
                    onClick={() => run(m.id, () => milestonesApi.markHeld(m.id))}
                    className="ml-auto px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                  >
                    O'tkazdim
                  </button>
                )}
              </div>

              {m.type === 'imtihon' && (
                <p className="text-[11px] text-zinc-600 mt-2">
                  Imtihon o'tkazilgani avtomatik aniqlanadi — alohida belgilash shart emas
                </p>
              )}
            </div>
          );
        })}
      </div>

      {done.length > 0 && (
        <div className="mt-4 pt-4 border-t border-zinc-800">
          <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-600 mb-2">
            Tugallangan ({done.length})
          </p>
          <ul className="space-y-1">
            {done.map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-xs text-zinc-400">
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${
                    m.status === 'kechikib_bajarildi' ? 'text-amber-500' : 'text-emerald-500'
                  }`}
                />
                <span className="text-zinc-300">
                  {typeLabel(m.type)} #{m.seq}
                </span>
                <span className="text-zinc-600">·</span>
                <span>{m.heldAt ? fmt(m.heldAt) : '—'}</span>
                {m.status === 'kechikib_bajarildi' && (
                  <span className="text-amber-500">kechikib</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
