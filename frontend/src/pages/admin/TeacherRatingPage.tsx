import { useEffect, useState, useCallback } from 'react';
import Header from '@/components/layout/Header';
import { freezesApi } from '@/api';
import { Loader2, Trophy, ChevronLeft, ChevronRight, TrendingDown, BarChart2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const MONTH_NAMES = ['','Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentyabr','Oktyabr','Noyabr','Dekabr'];

export default function TeacherRatingPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await freezesApi.getTeacherRating(month, year);
      setData(res.data.data || []);
    } catch { setData([]); } finally { setLoading(false); }
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  const getColor = (pct: number) => {
    if (pct <= 5) return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', badge: '🟢' };
    if (pct <= 15) return { bg: 'bg-amber-500/10', text: 'text-amber-400', badge: '🟡' };
    return { bg: 'bg-red-500/10', text: 'text-red-400', badge: '🔴' };
  };

  const barColor = (pct: number) => {
    if (pct <= 5) return '#10b981';
    if (pct <= 15) return '#f59e0b';
    return '#ef4444';
  };

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div>
      <Header title="O'qituvchilar Reytingi" subtitle="Ketish hisoboti bo'yicha" />

      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Oy nav */}
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-5 py-2 bg-zinc-800 rounded-lg text-white font-semibold min-w-[150px] text-center">
            {MONTH_NAMES[month]} {year}
          </span>
          <button onClick={nextMonth} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
        ) : data.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">
            <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Bu oy uchun ma'lumot yo'q</p>
          </div>
        ) : (
          <>
            {/* Top 3 kartalar */}
            {data.length >= 3 && (
              <div className="grid grid-cols-3 gap-4 mb-2">
                {data.slice(0,3).map((t: any, i: number) => {
                  const c = getColor(t.dropoutPercent);
                  return (
                    <div key={i} className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-center relative overflow-hidden ${i === 0 ? 'border-yellow-500/30' : ''}`}>
                      <div className="text-3xl mb-2">{medals[i]}</div>
                      <p className="text-white font-bold text-sm">{t.teacher}</p>
                      <p className={`text-2xl font-black mt-2 ${c.text}`}>{t.dropoutPercent}%</p>
                      <p className="text-zinc-500 text-xs mt-1">{t.frozenCount} ta ketgan</p>
                      {i === 0 && (
                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-yellow-500 to-transparent" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Asosiy jadval */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-zinc-800 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-blue-400" />
                <h3 className="text-white font-bold text-sm">Barcha o'qituvchilar (ketish % bo'yicha)</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-zinc-800/50 text-zinc-400 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-center w-12">O'r.</th>
                    <th className="px-4 py-3 text-left">O'qituvchi</th>
                    <th className="px-4 py-3 text-center">Aktiv o'q.</th>
                    <th className="px-4 py-3 text-center">Ketgan</th>
                    <th className="px-4 py-3 text-center">O'rt. oy</th>
                    <th className="px-4 py-3 text-center">Ulushi %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {data.map((t: any) => {
                    const c = getColor(t.dropoutPercent);
                    return (
                      <tr key={t.rank} className={`hover:bg-zinc-800/30 transition-colors ${c.bg}`}>
                        <td className="px-4 py-3 text-center">
                          <span className="text-lg">{t.rank <= 3 ? medals[t.rank - 1] : t.rank}</span>
                        </td>
                        <td className="px-4 py-3 text-white font-medium">{t.teacher}</td>
                        <td className="px-4 py-3 text-center text-zinc-400">{t.activeStudents}</td>
                        <td className="px-4 py-3 text-center font-bold text-red-400">{t.frozenCount}</td>
                        <td className="px-4 py-3 text-center text-zinc-300">{t.avgDuration}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-bold ${c.text}`}>{t.dropoutPercent}% {c.badge}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bar chart */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 className="w-4 h-4 text-blue-400" />
                <h4 className="text-white font-semibold text-sm">O'qituvchi bo'yicha ketgan o'quvchilar soni</h4>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <XAxis dataKey="teacher" tick={{ fill: '#71717a', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
                    formatter={(val: any, name: any) => [val, name === 'frozenCount' ? 'Ketgan' : name]}
                  />
                  <Bar dataKey="frozenCount" radius={[4,4,0,0]} name="Ketgan">
                    {data.map((d: any, i: number) => (
                      <Cell key={i} fill={barColor(d.dropoutPercent)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> 0–5% (yaxshi)</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" /> 5–15% (o'rtacha)</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> 15%+ (diqqat)</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
