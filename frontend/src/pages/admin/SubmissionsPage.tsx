import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import ScoreBadge from '@/components/shared/ScoreBadge';
import { submissionsApi } from '@/api';
import { formatDateTime } from '@/utils';
import { Loader2, ExternalLink, Video, Search, Filter } from 'lucide-react';

export default function AdminSubmissionsPage() {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'checked'>('all');
  const [search, setSearch] = useState('');

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const res = await submissionsApi.getAll();
      setSubmissions(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const filtered = submissions.filter(sub => {
    if (filter === 'pending' && sub.status !== 'pending') return false;
    if (filter === 'checked' && sub.status !== 'checked') return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        sub.student?.fullName?.toLowerCase().includes(q) ||
        sub.normative?.title?.toLowerCase().includes(q) ||
        sub.group?.name?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div>
      <Header title="Topshiriqlar" subtitle="Barcha topshiriqlar ro'yxati" />

      <div className="p-8 max-w-7xl mx-auto">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="O'quvchi, normativ yoki guruh nomi bo'yicha qidirish..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#18181b] border border-zinc-800 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            {(['all', 'pending', 'checked'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                  filter === f
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-[#18181b] border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                }`}
              >
                {f === 'all' ? 'Barchasi' : f === 'pending' ? '⏳ Kutilmoqda' : '✅ Tekshirilgan'}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-[#18181b] border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-[#09090b] text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800 font-bold">
                <tr>
                  <th className="px-6 py-4">Sana</th>
                  <th className="px-6 py-4">O'quvchi</th>
                  <th className="px-6 py-4">Normativ</th>
                  <th className="px-6 py-4">Guruh</th>
                  <th className="px-6 py-4">Havola</th>
                  <th className="px-6 py-4 text-center">Holat</th>
                  <th className="px-6 py-4 text-center">Ball</th>
                  <th className="px-6 py-4">Izoh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50 bg-[#09090b]">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <Loader2 className="w-6 h-6 text-blue-500 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-zinc-500">
                      Topshiriqlar topilmadi
                    </td>
                  </tr>
                ) : (
                  filtered.map((sub) => (
                    <tr key={sub.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-zinc-400 text-xs">
                        {formatDateTime(sub.submittedAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-600/10 flex items-center justify-center text-[10px] font-bold text-blue-500 border border-blue-500/20">
                            {sub.student?.fullName?.charAt(0) || '?'}
                          </div>
                          <span className="font-medium text-white text-sm">{sub.student?.fullName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-blue-500 text-xs">#{sub.normative?.taskNumber}</span>
                        <span className="text-white text-sm ml-2">{sub.normative?.title}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs bg-zinc-800 px-2 py-1 rounded text-zinc-300">{sub.group?.name || '—'}</span>
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
                        {sub.status === 'checked' ? (
                          <ScoreBadge result={sub.result} showLabel />
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded text-xs font-medium">
                            ⏳ Kutilmoqda
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {sub.status === 'checked' ? (
                          <span className="font-bold text-white bg-[#18181b] border border-zinc-800 px-3 py-1 rounded-md">{sub.score}</span>
                        ) : (
                          <span className="text-zinc-500">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-zinc-400 text-xs line-clamp-2 max-w-[150px]">
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

        {/* Count */}
        <div className="mt-4 text-xs text-zinc-500 text-right">
          Ko'rsatilmoqda: {filtered.length} ta topshiriq
        </div>
      </div>
    </div>
  );
}
