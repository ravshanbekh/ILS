import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import { coinsApi } from '@/api';
import { useAuthStore } from '@/stores/authStore';
import { Loader2, Coins, AlertTriangle, Settings } from 'lucide-react';

interface TeacherStat {
  teacherId: string;
  teacherName: string;
  total: number;
  awardsCount: number;
  overLimit: boolean;
}

export default function CoinOversightPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [teachers, setTeachers] = useState<TeacherStat[]>([]);
  const [dailyLimit, setDailyLimit] = useState<number>(100);
  const [loading, setLoading] = useState(true);
  const [limitDraft, setLimitDraft] = useState('');
  const [savingLimit, setSavingLimit] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await coinsApi.getTeacherStats(period);
      setTeachers(res.data.data.teachers);
      setDailyLimit(res.data.data.dailyLimit);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const handleSaveLimit = async () => {
    const n = parseInt(limitDraft, 10);
    if (!Number.isInteger(n) || n <= 0) return;
    setSavingLimit(true);
    try {
      await coinsApi.updateSettings(n);
      setLimitDraft('');
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Xatolik');
    } finally {
      setSavingLimit(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b]">
      <Header title="Coin nazorati" subtitle="O'qituvchilar qancha coin berayotganini kuzatish" />

      <div className="p-8 max-w-5xl mx-auto space-y-6">
        {isAdmin && (
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-5 flex flex-wrap items-end gap-3">
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
                className="w-40 bg-[#0f0f11] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
            <button
              onClick={handleSaveLimit}
              disabled={savingLimit || !limitDraft}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold"
            >
              Saqlash
            </button>
            <span className="text-zinc-500 text-xs">Joriy chegara: <span className="text-white font-semibold">{dailyLimit}</span> coin/kun</span>
          </div>
        )}

        <div className="flex gap-2">
          {(['today', 'week', 'month'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                period === p ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {p === 'today' ? 'Bugun' : p === 'week' ? '7 kun' : '30 kun'}
            </button>
          ))}
        </div>

        <div className="bg-[#18181b] border border-zinc-800 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 text-xs uppercase border-b border-zinc-800">
                  <th className="text-left px-5 py-3">O'qituvchi</th>
                  <th className="text-left px-5 py-3">Berilgan coin</th>
                  <th className="text-left px-5 py-3">Necha marta</th>
                  <th className="text-left px-5 py-3">Holat</th>
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
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
