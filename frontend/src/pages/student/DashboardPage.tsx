import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import StatsCard from '@/components/shared/StatsCard';
import ScoreBadge from '@/components/shared/ScoreBadge';
import { statsApi } from '@/api';
import { useAuthStore } from '@/stores/authStore';
import { Trophy, Target, Clock, Star, Loader2, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

export default function StudentDashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      statsApi.getStudentStats(user.id)
        .then((res) => setStats(res.data.data))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [user?.id]);

  // Compute chart data for growth dynamics
  const chartData = Array.isArray(stats?.submissions) ? [...stats.submissions]
    .filter((s: any) => s.status === 'checked')
    .sort((a: any, b: any) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime())
    .reduce((acc: any[], s: any) => {
      const prevTotal = acc.length > 0 ? acc[acc.length - 1].total : 0;
      acc.push({
        date: new Date(s.submittedAt).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' }),
        ball: s.score,
        total: prevTotal + s.score,
        task: `#${s.normative?.taskNumber || ''}`
      });
      return acc;
    }, []) : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <Header title={`Salom, ${user?.fullName}! 👋`} subtitle="O'quvchi kabineti" />

      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        
        {/* Header Profile Info (Level & Progress) */}
        <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="flex items-center gap-6 z-10">
            <div className="relative">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 flex items-center justify-center text-3xl sm:text-4xl font-bold text-white border border-white/10 shadow-xl">
                {user?.fullName?.charAt(0) || '?'}
              </div>
              <div className="absolute -bottom-3 -right-3 w-10 h-10 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center border-2 border-[#18181b] shadow-lg transform rotate-12">
                <span className="text-white font-bold text-sm">{stats?.level || 1}</span>
              </div>
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-1">{user?.fullName}</h2>
              <p className="text-sm text-zinc-400 uppercase tracking-wider font-mono">{user?.login}</p>
              
              <div className="mt-4 flex items-center gap-3">
                <div className="w-32 sm:w-48 h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-1000"
                    style={{ width: `${stats?.progressToNextLevel || 0}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-amber-500">{stats?.progressToNextLevel || 0}%</span>
                <span className="text-xs text-zinc-500 hidden sm:inline">Keyingi darajaga</span>
              </div>
            </div>
          </div>

          <div className="absolute right-0 top-0 w-64 h-64 bg-blue-500/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/3"></div>
        </div>

        {/* Badges Section */}
        {stats?.badges && stats.badges.length > 0 && (
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6 relative overflow-hidden">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2 relative z-10">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500/20" />
              Mening yutuqlarim
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 relative z-10">
              {stats.badges.map((badge: any) => (
                <div key={badge.id} className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20 flex items-start gap-3">
                  <div className="text-3xl mt-0.5">{badge.name.split(' ')[0]}</div>
                  <div>
                    <p className="text-sm font-bold text-amber-500">{badge.name.split(' ').slice(1).join(' ')}</p>
                    <p className="text-xs text-amber-500/70 mt-1 leading-snug">{badge.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatsCard
            title="Jami ball"
            value={stats?.totalScore || 0}
            icon={<Star className="w-6 h-6" />}
            color="purple"
          />
          <StatsCard
            title="Bajarilgan"
            value={`${stats?.completed || 0} ta`}
            icon={<Target className="w-6 h-6" />}
            color="green"
          />
          <StatsCard
            title="Kutilmoqda"
            value={`${stats?.pending || 0} ta`}
            icon={<Clock className="w-6 h-6" />}
            color="orange"
          />
        </div>

        {/* O'sish dinamikasi (Line Chart) */}
        {chartData.length > 0 && (
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6">
            <h3 className="text-base font-bold text-white mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              O'sish dinamikasi
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="date" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '0.5rem', color: '#fff' }}
                    itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
                    labelStyle={{ color: '#a1a1aa', marginBottom: '0.25rem' }}
                  />
                  <Area type="monotone" dataKey="total" name="Umumiy ball" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Guruh reytinglari */}
        {stats?.groups && stats.groups.length > 0 && (
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6">
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              Guruh o'rinlarim
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {stats.groups.map((g: any) => (
                <div key={g.group.id} className="p-4 rounded-lg bg-[#09090b] border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium text-sm">{g.group.name} guruhi</p>
                      <p className="text-xs text-zinc-500">{g.totalInGroup} nafar ichida</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-amber-500">#{g.rank}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* So'nggi topshiriqlar */}
        {stats?.submissions && stats.submissions.length > 0 && (
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6">
            <h3 className="text-base font-semibold text-white mb-4">So'nggi topshiriqlar</h3>
            <div className="space-y-3">
              {stats.submissions.slice(0, 10).map((sub: any) => (
                <div key={sub.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg bg-[#09090b] border border-zinc-800 gap-3">
                  <div className="flex items-start sm:items-center gap-3">
                    <span className="text-xs font-mono text-zinc-500 mt-1 sm:mt-0 w-8">#{sub.normative.taskNumber}</span>
                    <div>
                      <p className="text-sm font-medium text-white">{sub.normative.title}</p>
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{sub.group?.name || ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 sm:justify-end">
                    <span className="text-sm font-bold text-white">{sub.score} <span className="text-xs font-normal text-zinc-500">ball</span></span>
                    <ScoreBadge result={sub.result} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
