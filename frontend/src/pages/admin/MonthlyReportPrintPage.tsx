import { useEffect, useState } from 'react';
import { statsApi } from '@/api';
import { Loader2 } from 'lucide-react';
import ScoreBadge from '@/components/shared/ScoreBadge';

export default function MonthlyReportPrintPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    statsApi.getTeachersRanking()
      .then(res => setStats(res.data.data))
      .catch(console.error)
      .finally(() => {
        setLoading(false);
        // Add a slight delay for charts/fonts to render before printing
        setTimeout(() => {
          window.print();
        }, 1500);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <span className="ml-3 text-zinc-600">Hisobot tayyorlanmoqda...</span>
      </div>
    );
  }

  const currentDate = new Date().toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="bg-white text-black min-h-screen p-10 print:p-0">
      <div className="max-w-[210mm] mx-auto bg-white" style={{ minHeight: '297mm' }}>
        
        {/* Header */}
        <div className="border-b-2 border-zinc-200 pb-6 mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-zinc-900 tracking-tight">O'qituvchilar Oylik Hisoboti</h1>
            <p className="text-zinc-500 mt-2 font-medium">Normativ Boshqaruv Tizimi - Umumiy Reyting</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Hisobot sanasi</p>
            <p className="text-lg font-semibold text-zinc-800">{currentDate}</p>
          </div>
        </div>

        {/* Dynamic Teacher Stats Table */}
        <div className="mb-10">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-100 text-zinc-600 text-xs uppercase tracking-wider font-bold">
                <th className="p-3 border-b-2 border-zinc-300 w-12 text-center">#</th>
                <th className="p-3 border-b-2 border-zinc-300">O'qituvchi ism-sharifi</th>
                <th className="p-3 border-b-2 border-zinc-300 text-center">Guruh / O'quvchi</th>
                <th className="p-3 border-b-2 border-zinc-300 text-center">Tekshirilgan</th>
                <th className="p-3 border-b-2 border-zinc-300 text-center">A'lo (Yashil)</th>
                <th className="p-3 border-b-2 border-zinc-300 text-center">Yaxshi (Ko'k)</th>
                <th className="p-3 border-b-2 border-zinc-300 text-center">Qoniqarsiz</th>
                <th className="p-3 border-b-2 border-zinc-300 text-center text-blue-600">O'rtacha Ball</th>
              </tr>
            </thead>
            <tbody>
              {stats?.map((teacher: any, idx: number) => (
                <tr key={teacher.id} className="border-b border-zinc-200">
                  <td className="p-3 text-center font-bold text-zinc-500">{idx + 1}</td>
                  <td className="p-3 font-semibold text-zinc-900">{teacher.teacher}</td>
                  <td className="p-3 text-center text-zinc-600">
                    <span className="font-bold">{teacher.groupsCount}</span> / <span className="font-bold">{teacher.studentsCount}</span>
                  </td>
                  <td className="p-3 text-center font-bold text-zinc-800">{teacher.checkedCount}</td>
                  <td className="p-3 text-center text-emerald-600 font-bold">{teacher.green}</td>
                  <td className="p-3 text-center text-blue-600 font-bold">{teacher.blue}</td>
                  <td className="p-3 text-center text-red-600 font-bold">{teacher.red}</td>
                  <td className="p-3 text-center">
                    <div className="inline-flex items-center justify-center bg-blue-50 text-blue-700 font-black px-3 py-1 rounded-md border border-blue-200">
                      {teacher.avgScore}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="mt-16 text-center text-zinc-400 text-sm">
          Ushbu hujjat tizim tomonidan avtomatik ravishda ishlab chiqildi.
          <br /> IT Live - Barcha huquqlar himoyalangan.
        </div>

      </div>
    </div>
  );
}
