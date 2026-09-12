import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import { coinsApi } from '@/api';
import { usePermissionStore } from '@/stores/permissionStore';
import { Loader2, Coins, AlertTriangle, Settings, Users, ChevronRight, X } from 'lucide-react';

interface TeacherStat {
  teacherId: string;
  teacherName: string;
  total: number;
  awardsCount: number;
  overLimit: boolean;
}

interface StudentStat {
  studentId: string;
  fullName: string;
  groupName: string | null;
  teacherName: string | null;
  earned: number;
  spent: number;
  balance: number;
  topAwarder: string | null;
}

interface BreakdownRow {
  studentId: string;
  fullName: string;
  groupName: string | null;
  total: number;
  times: number;
}

type Period = 'today' | 'week' | 'month';

export default function CoinOversightPage() {
  const can = usePermissionStore((s) => s.can);
  const canEditSettings = can('coin_settings');

  const [tab, setTab] = useState<'teachers' | 'students'>('teachers');
  const [period, setPeriod] = useState<Period>('today');

  const [teachers, setTeachers] = useState<TeacherStat[]>([]);
  const [students, setStudents] = useState<StudentStat[]>([]);
  const [dailyLimit, setDailyLimit] = useState<number>(100);
  const [loading, setLoading] = useState(true);

  const [limitDraft, setLimitDraft] = useState('');
  const [savingLimit, setSavingLimit] = useState(false);

  // O'qituvchi tafsiloti (qaysi bolalarga qancha qo'ygan)
  const [breakdownOf, setBreakdownOf] = useState<TeacherStat | null>(null);
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      if (tab === 'teachers') {
        const res = await coinsApi.getTeacherStats(period);
        setTeachers(res.data.data.teachers);
        setDailyLimit(res.data.data.dailyLimit);
      } else {
        const res = await coinsApi.getStudentStats({ period });
        setStudents(res.data.data.students);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, tab]);

  const openBreakdown = async (t: TeacherStat) => {
    setBreakdownOf(t);
    setBreakdownLoading(true);
    try {
      const res = await coinsApi.getTeacherBreakdown(t.teacherId, period);
      setBreakdown(res.data.data.students);
    } catch {
      setBreakdown([]);
    } finally {
      setBreakdownLoading(false);
    }
  };

  const handleSaveLimit = async () => {
    const n = parseInt(limitDraft, 10);
    if (!Number.isInteger(n) || n <= 0) return;
    setSavingLimit(true);
    try {
      await coinsApi.updateSettings(n);
      setLimitDraft('');
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.error?.message || e?.response?.data?.message || 'Xatolik');
    } finally {
      setSavingLimit(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header title="Coin nazorati" subtitle="Kim qancha coin berayotgani va kim qancha to'plagani" />

      <div className="p-8 max-w-5xl mx-auto space-y-5">
        {canEditSettings && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">
                <Settings className="w-3.5 h-3.5 inline mr-1" /> Kunlik chegara (bitta o'qituvchi uchun)
              </label>
              <input
                type="number"
                min={1}
                placeholder={String(dailyLimit)}
                value={limitDraft}
                onChange={(e) => setLimitDraft(e.target.value)}
                className="w-40 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
            <button
              onClick={handleSaveLimit}
              disabled={savingLimit || !limitDraft}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold"
            >
              Saqlash
            </button>
            <span className="text-zinc-500 text-xs">
              Joriy chegara: <span className="text-white font-semibold">{dailyLimit}</span> coin/kun
            </span>
          </div>
        )}

        {/* Bo'limlar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => setTab('teachers')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                tab === 'teachers' ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              O'qituvchilar
            </button>
            <button
              onClick={() => setTab('students')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                tab === 'students' ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              O'quvchilar
            </button>
          </div>

          <div className="flex gap-2">
            {(['today', 'week', 'month'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                  period === p ? 'bg-zinc-700 border-zinc-600 text-white' : 'border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                {p === 'today' ? 'Bugun' : p === 'week' ? '7 kun' : '30 kun'}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
          ) : tab === 'teachers' ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 text-xs uppercase border-b border-zinc-800">
                  <th className="text-left px-5 py-3">O'qituvchi</th>
                  <th className="text-left px-5 py-3">Berilgan coin</th>
                  <th className="text-left px-5 py-3">Necha marta</th>
                  <th className="text-left px-5 py-3">Holat</th>
                  <th className="text-left px-5 py-3">Tafsilot</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => (
                  <tr key={t.teacherId} className="border-b border-zinc-900">
                    <td className="px-5 py-3 text-white font-medium">{t.teacherName}</td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-1.5 text-amber-400 font-bold">
                        <Coins className="w-4 h-4" /> {t.total}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-zinc-400">{t.awardsCount} ta</td>
                    <td className="px-5 py-3">
                      {t.overLimit ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md border text-red-400 bg-red-500/10 border-red-500/20">
                          <AlertTriangle className="w-3.5 h-3.5" /> Chegaradan oshgan
                        </span>
                      ) : (
                        <span className="text-zinc-600 text-xs">Normal</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => openBreakdown(t)}
                        disabled={t.total === 0}
                        className="text-blue-400 hover:text-blue-300 disabled:text-zinc-700 text-xs font-semibold inline-flex items-center gap-1"
                      >
                        Kimga qo'ygan <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 text-xs uppercase border-b border-zinc-800">
                  <th className="text-left px-5 py-3">O'quvchi</th>
                  <th className="text-left px-5 py-3">Guruh / O'qituvchi</th>
                  <th className="text-left px-5 py-3">Olgan</th>
                  <th className="text-left px-5 py-3">Sarflagan</th>
                  <th className="text-left px-5 py-3">Balans</th>
                  <th className="text-left px-5 py-3">Ko'p bergan</th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-zinc-500">
                      Bu davrda coin harakati yo'q
                    </td>
                  </tr>
                ) : (
                  students.map((s) => (
                    <tr key={s.studentId} className="border-b border-zinc-900">
                      <td className="px-5 py-3 text-white font-medium">{s.fullName}</td>
                      <td className="px-5 py-3 text-zinc-400">
                        {s.groupName || '—'}
                        {s.teacherName && <span className="text-zinc-600"> · {s.teacherName}</span>}
                      </td>
                      <td className="px-5 py-3 text-amber-400 font-semibold">{s.earned}</td>
                      <td className="px-5 py-3 text-zinc-400">{s.spent}</td>
                      <td className="px-5 py-3 text-emerald-400 font-bold">{s.balance}</td>
                      <td className="px-5 py-3 text-zinc-400 text-xs">{s.topAwarder || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* O'qituvchi tafsiloti */}
      {breakdownOf && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <div>
                <h2 className="text-white font-bold">{breakdownOf.teacherName}</h2>
                <p className="text-zinc-500 text-xs">
                  {period === 'today' ? 'Bugun' : period === 'week' ? "So'nggi 7 kun" : "So'nggi 30 kun"} · jami{' '}
                  <span className="text-amber-400 font-semibold">{breakdownOf.total}</span> coin
                </p>
              </div>
              <button onClick={() => setBreakdownOf(null)} className="text-zinc-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {breakdownLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                </div>
              ) : breakdown.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-10">Ma'lumot yo'q</p>
              ) : (
                <div className="divide-y divide-zinc-900">
                  {breakdown.map((row) => (
                    <div key={row.studentId} className="flex items-center justify-between px-6 py-3">
                      <div>
                        <p className="text-white text-sm font-medium">{row.fullName}</p>
                        <p className="text-zinc-500 text-xs">
                          {row.groupName || '—'} · {row.times} marta
                        </p>
                      </div>
                      <span className="flex items-center gap-1.5 text-amber-400 font-bold text-sm">
                        <Coins className="w-4 h-4" /> {row.total}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-zinc-800 text-zinc-500 text-xs flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              {breakdown.length} ta o'quvchiga coin qo'ygan
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
