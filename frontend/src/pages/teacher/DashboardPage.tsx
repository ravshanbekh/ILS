import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import StatsCard from '@/components/shared/StatsCard';
import { statsApi } from '@/api';
import { useAuthStore } from '@/stores/authStore';
import { FolderOpen, Users, Clock, CheckSquare, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ChecklistPage from '@/pages/viewer/ChecklistPage';

export default function TeacherDashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    statsApi.getTeacherStats()
      .then((res) => setStats(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <Header title={`Salom, ${user?.fullName}! 👋`} subtitle="O'qituvchi paneli" />

      <div className="p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatsCard
            title="Guruhlarim"
            value={stats?.groupsCount || 0}
            icon={<FolderOpen className="w-6 h-6" />}
            color="blue"
          />
          <StatsCard
            title="Jami o'quvchilar"
            value={stats?.totalStudents || 0}
            icon={<Users className="w-6 h-6" />}
            color="purple"
          />
          <StatsCard
            title="Tekshirilmagan"
            value={stats?.pendingCount || 0}
            icon={<Clock className="w-6 h-6" />}
            color="orange"
          />
        </div>

        {/* Guruhlar bo'yicha statistika */}
        {stats?.groupStats && stats.groupStats.length > 0 && (
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6">
            <h3 className="text-base font-semibold text-white mb-4">Guruhlar statistikasi</h3>
            <div className="space-y-3">
              {stats.groupStats.map((g: any) => (
                <div
                  key={g.id}
                  onClick={() => navigate(`/teacher/groups/${g.id}`)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg bg-[#09090b] border border-zinc-800 hover:border-blue-500/30 cursor-pointer transition-all duration-200"
                >
                  <div className="flex items-center gap-4 mb-3 sm:mb-0">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 font-bold border border-blue-500/20">
                      {g.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">{g.name}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {g.studentsCount} o'quvchi · {g.normativesCount} normativ
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 sm:justify-end">
                    <div className="text-right">
                      <p className="text-sm font-bold text-white">{g.avgScore} ball</p>
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500">o'rtacha</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded px-2 py-1">{g.results.green}</span>
                      <span className="bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded px-2 py-1">{g.results.blue}</span>
                      <span className="bg-red-500/10 text-red-500 border border-red-500/20 rounded px-2 py-1">{g.results.red}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Kunlik Checklist (Mentor) */}
        <div className="bg-[#18181b] border border-zinc-800 rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <CheckSquare className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Kunlik Checklist</h3>
              <p className="text-xs text-zinc-500">Bugungi dars vazifalari</p>
            </div>
          </div>
          <ChecklistPage compact />
        </div>
      </div>
    </div>
  );
}
