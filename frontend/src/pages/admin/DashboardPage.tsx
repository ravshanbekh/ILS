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
      <div className="flex items-center justify-center h-screen bg-[#F5F7FB]">
        <Loader2 className="w-8 h-8 text-[#2563EB] animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <Header title="Admin Dashboard" subtitle="Platformaning umumiy ko'rsatkichlari" />

      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        {/* Top 4 Stats cards */}
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

        {/* Submissions 3 stats */}
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

        {/* Result distribution card matching AI design screenshot */}
        {stats?.resultDistribution && stats.resultDistribution.length > 0 && (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-[#0F172A] mb-5 tracking-tight">Natijalar taqsimoti</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {stats.resultDistribution.map((r: any) => {
                const isBlue = r.result === 'blue';
                const isRed = r.result === 'red';
                const isGreen = r.result === 'green';

                const bgClass = isBlue ? 'bg-[#EFF6FF] border-l-4 border-l-[#2563EB] border-[#E2E8F0]' :
                                isRed ? 'bg-[#FFF1F2] border-l-4 border-l-[#E5484D] border-[#E2E8F0]' :
                                'bg-[#ECFDF5] border-l-4 border-l-[#059669] border-[#E2E8F0]';

                const textClass = isBlue ? 'text-[#2563EB]' :
                                  isRed ? 'text-[#E5484D]' :
                                  'text-[#059669]';

                const label = isBlue ? 'Yaxshi (Ko\'k)' :
                              isRed ? 'Qoniqarsiz (Qizil)' :
                              'A\'lo (Yashil)';

                return (
                  <div
                    key={r.result}
                    className={`rounded-2xl p-6 text-center border transition-all ${bgClass}`}
                  >
                    <p className="text-3xl font-extrabold text-[#0F172A] mb-2">{r.count}</p>
                    <p className={`text-xs font-bold ${textClass}`}>
                      {label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
