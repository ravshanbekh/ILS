import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import ScoreBadge from '@/components/shared/ScoreBadge';
import { submissionsApi } from '@/api';
import { useAuthStore } from '@/stores/authStore';
import { formatDateTime } from '@/utils';
import { Loader2, ExternalLink, Video } from 'lucide-react';

export default function StudentHistoryPage() {
  const { user } = useAuthStore();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      submissionsApi.getByStudent(user.id)
        .then((res) => setSubmissions(res.data.data || []))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [user?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <Header title="Topshiriqlarim tarixi" subtitle="Barcha topshirilgan va tekshirilgan ishlar" />

      <div className="p-8 max-w-6xl mx-auto">
        <div className="bg-[#18181b] border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-[#09090b] text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800 font-bold">
                <tr>
                  <th className="px-6 py-4">Sana</th>
                  <th className="px-6 py-4">Normativ</th>
                  <th className="px-6 py-4">Havola</th>
                  <th className="px-6 py-4 text-center">Holat</th>
                  <th className="px-6 py-4 text-center">Ball</th>
                  <th className="px-6 py-4">Izoh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50 bg-[#09090b]">
                {submissions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                      Hali hech qanday topshiriq yubormagansiz
                    </td>
                  </tr>
                ) : (
                  submissions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-zinc-400">
                        {formatDateTime(sub.submittedAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-white text-sm">#{sub.normative.taskNumber}</div>
                        <div className="text-xs text-zinc-500 truncate max-w-[200px]">{sub.normative.title}</div>
                      </td>
                      <td className="px-6 py-4">
                        <a 
                          href={sub.youtubeUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-blue-500 hover:text-blue-400 transition-colors w-fit bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20"
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium">Ko'rish</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <ScoreBadge result={sub.result} showLabel />
                      </td>
                      <td className="px-6 py-4 text-center">
                        {sub.status === 'checked' ? (
                          <span className="font-bold text-white bg-[#18181b] border border-zinc-800 px-3 py-1 rounded-md">{sub.score}</span>
                        ) : (
                          <span className="text-zinc-500">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-zinc-400 text-xs line-clamp-2 max-w-xs">
                          {sub.comment || '—'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
