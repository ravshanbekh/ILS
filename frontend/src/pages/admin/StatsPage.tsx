import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import StatsCard from '@/components/shared/StatsCard';
import { statsApi, usersApi } from '@/api';
import { Users, FolderOpen, BookOpen, ClipboardCheck, TrendingUp, Award, Loader2, Filter } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export default function AdminStatsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');

  useEffect(() => {
    usersApi.getAll(1, 100, 'teacher').then(res => setTeachers(res.data.data)).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    if (selectedTeacherId) {
      statsApi.getTeacherStats(selectedTeacherId)
        .then((res) => {
          const tStats = res.data.data;
          // Transform teacher stats to match overview format
          let greenCount = 0;
          let blueCount = 0;
          let redCount = 0;
          let checkedSubmissions = 0;

          tStats.groupStats?.forEach((g: any) => {
            greenCount += g.results.green;
            blueCount += g.results.blue;
            redCount += g.results.red;
            checkedSubmissions += (g.results.green + g.results.blue + g.results.red);
          });

          setStats({
            totalStudents: tStats.totalStudents,
            totalGroups: tStats.groupsCount,
            totalSubmissions: checkedSubmissions + (tStats.pendingCount || 0),
            pendingSubmissions: tStats.pendingCount || 0,
            checkedSubmissions,
            resultDistribution: [
              { result: 'green', count: greenCount },
              { result: 'blue', count: blueCount },
              { result: 'red', count: redCount },
            ]
          });
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      statsApi.getOverview()
        .then((res) => setStats(res.data.data))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [selectedTeacherId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  const greenCount = stats?.resultDistribution?.find((r: any) => r.result === 'green')?.count || 0;
  const blueCount = stats?.resultDistribution?.find((r: any) => r.result === 'blue')?.count || 0;
  const redCount = stats?.resultDistribution?.find((r: any) => r.result === 'red')?.count || 0;
  const totalChecked = greenCount + blueCount + redCount;

  const pieData = [
    { name: "A'lo (Yashil)", value: greenCount, color: '#10b981' }, // emerald-500
    { name: "Yaxshi (Ko'k)", value: blueCount, color: '#3b82f6' },  // blue-500
    { name: "Qoniqarsiz (Qizil)", value: redCount, color: '#ef4444' }, // red-500
  ].filter(d => d.value > 0);

  return (
    <div>
      <Header title="Statistika" subtitle="Platformaning batafsil statistikasi" />

      <div className="p-8 max-w-7xl mx-auto space-y-8">
        
        {/* Filter Section */}
        <div className="flex items-center gap-4 bg-[#18181b] p-4 rounded-xl border border-zinc-800">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-zinc-400" />
            <span className="text-sm font-medium text-zinc-300">O'qituvchi orqali filtr:</span>
          </div>
          <select 
            value={selectedTeacherId}
            onChange={(e) => setSelectedTeacherId(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[#09090b] border border-zinc-800 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-64"
          >
            <option value="">Barcha o'qituvchilar (Umumiy markaz)</option>
            {teachers.map(t => (
              <option key={t.id} value={t.id}>{t.fullName}</option>
            ))}
          </select>
        </div>

        {/* Main Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="Jami o'quvchilar"
            value={stats?.totalStudents || 0}
            icon={<Users className="w-6 h-6" />}
            color="blue"
          />
          {!selectedTeacherId && (
            <StatsCard
              title="O'qituvchilar"
              value={stats?.totalTeachers || 0}
              icon={<Users className="w-6 h-6" />}
              color="purple"
            />
          )}
          <StatsCard
            title="Guruhlar"
            value={stats?.totalGroups || 0}
            icon={<FolderOpen className="w-6 h-6" />}
            color="green"
          />
          {!selectedTeacherId && (
            <StatsCard
              title="Normativlar"
              value={stats?.totalNormatives || 0}
              icon={<BookOpen className="w-6 h-6" />}
              color="orange"
            />
          )}
        </div>

        {/* Submission Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatsCard
            title="Jami topshiriqlar"
            value={stats?.totalSubmissions || 0}
            icon={<ClipboardCheck className="w-6 h-6" />}
            color="blue"
          />
          <StatsCard
            title="Tekshirilgan"
            value={stats?.checkedSubmissions || 0}
            icon={<Award className="w-6 h-6" />}
            color="green"
          />
          <StatsCard
            title="Kutilmoqda"
            value={stats?.pendingSubmissions || 0}
            icon={<TrendingUp className="w-6 h-6" />}
            color="orange"
          />
        </div>

        {/* Result Distribution */}
        <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6">
          <h3 className="text-base font-bold text-white mb-6">Natijalar taqsimoti</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            <div className="rounded-xl p-6 text-center border bg-emerald-500/5 border-emerald-500/20">
              <p className="text-4xl font-bold text-emerald-500 mb-2">{greenCount}</p>
              <p className="text-sm font-medium text-emerald-500/80">A'lo (Yashil)</p>
              <p className="text-xs text-zinc-500 mt-1">{totalChecked > 0 ? Math.round(greenCount / totalChecked * 100) : 0}%</p>
            </div>
            <div className="rounded-xl p-6 text-center border bg-blue-500/5 border-blue-500/20">
              <p className="text-4xl font-bold text-blue-500 mb-2">{blueCount}</p>
              <p className="text-sm font-medium text-blue-500/80">Yaxshi (Ko'k)</p>
              <p className="text-xs text-zinc-500 mt-1">{totalChecked > 0 ? Math.round(blueCount / totalChecked * 100) : 0}%</p>
            </div>
            <div className="rounded-xl p-6 text-center border bg-red-500/5 border-red-500/20">
              <p className="text-4xl font-bold text-red-500 mb-2">{redCount}</p>
              <p className="text-sm font-medium text-red-500/80">Qoniqarsiz (Qizil)</p>
              <p className="text-xs text-zinc-500 mt-1">{totalChecked > 0 ? Math.round(redCount / totalChecked * 100) : 0}%</p>
            </div>
          </div>

          {/* Visual Progress Bar */}
          {totalChecked > 0 && (
            <div>
              <div className="flex rounded-full overflow-hidden h-4 bg-zinc-800 border border-zinc-700">
                {greenCount > 0 && (
                  <div 
                    className="bg-emerald-500 transition-all duration-500" 
                    style={{ width: `${(greenCount / totalChecked) * 100}%` }} 
                  />
                )}
                {blueCount > 0 && (
                  <div 
                    className="bg-blue-500 transition-all duration-500" 
                    style={{ width: `${(blueCount / totalChecked) * 100}%` }} 
                  />
                )}
                {redCount > 0 && (
                  <div 
                    className="bg-red-500 transition-all duration-500" 
                    style={{ width: `${(redCount / totalChecked) * 100}%` }} 
                  />
                )}
              </div>
              <div className="flex justify-between mt-2 text-xs text-zinc-500 mb-8">
                <span>Jami tekshirilgan: {totalChecked}</span>
                <span>O'rtacha ball: {totalChecked > 0 ? Math.round((greenCount * 20 + blueCount * 10) / totalChecked) : 0}</span>
              </div>

              {/* Pie Chart */}
              {pieData.length > 0 && (
                <div className="h-64 mt-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '0.5rem', color: '#fff' }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
