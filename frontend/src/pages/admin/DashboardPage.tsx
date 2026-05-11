import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import StatsCard from '@/components/shared/StatsCard';
import { statsApi } from '@/api';
import { Users, FolderOpen, BookOpen, ClipboardCheck, CheckCircle, Clock, Loader2 } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    statsApi.getOverview()
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
      <Header title="Admin Dashboard" subtitle="Platformaning umumiy ko'rsatkichlari" />

      <div className="p-8 space-y-8">
        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="O'quvchilar"
            value={stats?.totalStudents || 0}
            icon={<Users className="w-6 h-6" />}
            color="blue"
          />
          <StatsCard
            title="O'qituvchilar"
            value={stats?.totalTeachers || 0}
            icon={<Users className="w-6 h-6" />}
            color="purple"
          />
          <StatsCard
            title="Guruhlar"
            value={stats?.totalGroups || 0}
            icon={<FolderOpen className="w-6 h-6" />}
            color="green"
          />
          <StatsCard
            title="Normativlar"
            value={stats?.totalNormatives || 0}
            icon={<BookOpen className="w-6 h-6" />}
            color="orange"
          />
        </div>

        {/* Submissions stats */}
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
            icon={<CheckCircle className="w-6 h-6" />}
            color="green"
          />
          <StatsCard
            title="Kutilmoqda"
            value={stats?.pendingSubmissions || 0}
            icon={<Clock className="w-6 h-6" />}
            color="orange"
          />
        </div>

        {/* Result distribution */}
        {stats?.resultDistribution && stats.resultDistribution.length > 0 && (
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6">
            <h3 className="text-base font-semibold text-white mb-4">Natijalar taqsimoti</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {stats.resultDistribution.map((r: any) => (
                <div
                  key={r.result}
                  className={`rounded-lg p-5 text-center border ${
                    r.result === 'green'
                      ? 'bg-emerald-500/5 border-emerald-500/20'
                      : r.result === 'blue'
                      ? 'bg-blue-500/5 border-blue-500/20'
                      : 'bg-red-500/5 border-red-500/20'
                  }`}
                >
                  <p className="text-3xl font-bold text-white mb-1">{r.count}</p>
                  <p className={`text-xs font-medium ${
                    r.result === 'green' ? 'text-emerald-500' :
                    r.result === 'blue' ? 'text-blue-500' : 'text-red-500'
                  }`}>
                    {r.result === 'green' ? 'A\'lo (Yashil)' :
                     r.result === 'blue' ? 'Yaxshi (Ko\'k)' : 'Qoniqarsiz (Qizil)'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
