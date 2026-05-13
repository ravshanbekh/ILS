import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/layout/Header';
import ScoreBadge from '@/components/shared/ScoreBadge';
import { rankingsApi, usersApi, groupsApi } from '@/api';
import { Loader2, Trophy, Medal, Filter, ChevronLeft, ChevronRight, Search } from 'lucide-react';

const ITEMS_PER_PAGE = 15;

export default function AdminRankingsPage() {
  const [rankings, setRankings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('overall');
  const [teachers, setTeachers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    usersApi.getAll(1, 100, 'teacher').then(res => setTeachers(res.data.data)).catch(console.error);
    groupsApi.getAll(1, 100).then(res => setGroups(res.data.data)).catch(console.error);
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchRankings = useCallback(async () => {
    setLoading(true);
    try {
      let params: any = { page: currentPage, limit: ITEMS_PER_PAGE };
      if (filterType === 'teacher' && selectedTeacherId) params.teacherId = selectedTeacherId;
      if (filterType === 'group' && selectedGroupId) params.groupId = selectedGroupId;
      if (debouncedSearch) params.search = debouncedSearch;

      const res = await rankingsApi.getOverall(params);
      setRankings(res.data.data?.students || res.data.data || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
      setTotalCount(res.data.pagination?.total || (res.data.data?.students || res.data.data || []).length);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [filterType, selectedTeacherId, selectedGroupId, currentPage, debouncedSearch]);

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  const handleFilterChange = (type: string) => {
    setFilterType(type);
    setSelectedTeacherId('');
    setSelectedGroupId('');
    setCurrentPage(1);
  };

  return (
    <div>
      <Header title="Umumiy Reyting" subtitle="Barcha o'quvchilar reytingi" />

      <div className="p-4 sm:p-8 max-w-6xl mx-auto">
        {/* Filter + Search */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 bg-[#18181b] p-4 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-zinc-400" />
              <span className="text-sm font-medium text-zinc-300">Filter:</span>
            </div>
            
            <select 
              value={filterType}
              onChange={(e) => handleFilterChange(e.target.value)}
              className="px-3 py-2 rounded-lg bg-[#09090b] border border-zinc-800 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-w-[200px]"
            >
              <option value="overall">O'quv markaz bo'yicha</option>
              <option value="teacher">O'qituvchi bo'yicha</option>
              <option value="group">Guruh bo'yicha</option>
            </select>

            {filterType === 'teacher' && (
              <select 
                value={selectedTeacherId}
                onChange={(e) => { setSelectedTeacherId(e.target.value); setCurrentPage(1); }}
                className="px-3 py-2 rounded-lg bg-[#09090b] border border-zinc-800 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 flex-1"
              >
                <option value="">O'qituvchini tanlang...</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.fullName}</option>
                ))}
              </select>
            )}

            {filterType === 'group' && (
              <select 
                value={selectedGroupId}
                onChange={(e) => { setSelectedGroupId(e.target.value); setCurrentPage(1); }}
                className="px-3 py-2 rounded-lg bg-[#09090b] border border-zinc-800 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 flex-1"
              >
                <option value="">Guruhni tanlang...</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            )}

            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Ism bo'yicha qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#09090b] border border-zinc-800 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder:text-zinc-600"
              />
            </div>
          </div>
        </div>

        <div className="bg-[#18181b] border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-[#09090b] text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800 font-bold">
                <tr>
                  <th className="px-6 py-4 w-16 text-center">O'rin</th>
                  <th className="px-6 py-4">O'quvchi</th>
                  <th className="px-6 py-4 text-center">Jami Ball</th>
                  <th className="px-6 py-4 text-center">Bajarilgan</th>
                  <th className="px-6 py-4 text-center">Kutilmoqda</th>
                  <th className="px-6 py-4 text-center">Natijalar (Y / K / Q)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50 bg-[#09090b]">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <Loader2 className="w-6 h-6 text-blue-500 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : rankings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                      Reyting ma'lumotlari topilmadi
                    </td>
                  </tr>
                ) : (
                  rankings.map((student: any, idx: number) => {
                    const rank = student.rank || (currentPage - 1) * ITEMS_PER_PAGE + idx + 1;
                    return (
                      <tr key={student.student?.id || idx} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="px-6 py-4 text-center">
                          {rank === 1 ? <Medal className="w-5 h-5 text-yellow-500 mx-auto" /> :
                           rank === 2 ? <Medal className="w-5 h-5 text-zinc-400 mx-auto" /> :
                           rank === 3 ? <Medal className="w-5 h-5 text-amber-700 mx-auto" /> :
                           <span className="font-bold text-zinc-500">{rank}</span>}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-600/10 flex items-center justify-center text-xs font-bold text-blue-500 border border-blue-500/20">
                              {student.student?.fullName?.charAt(0) || '?'}
                            </div>
                            <div>
                              <p className="font-medium text-white text-sm">{student.student?.fullName}</p>
                              <p className="text-[10px] uppercase tracking-wider text-zinc-500">{student.student?.login}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="font-bold text-amber-500 text-lg">{student.totalScore}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-emerald-500 font-bold">{student.completed}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-amber-500 font-medium">{student.pending > 0 ? student.pending : '—'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-1.5 font-medium">
                            <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px]">{student.results?.green || 0}</span>
                            <span className="bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2 py-0.5 rounded text-[10px]">{student.results?.blue || 0}</span>
                            <span className="bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded text-[10px]">{student.results?.red || 0}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800">
              <span className="text-xs text-zinc-500">
                Jami: <span className="text-zinc-300 font-semibold">{totalCount}</span> ta o'quvchi
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let page: number;
                  if (totalPages <= 7) { page = i + 1; }
                  else if (currentPage <= 4) { page = i + 1; }
                  else if (currentPage >= totalPages - 3) { page = totalPages - 6 + i; }
                  else { page = currentPage - 3 + i; }
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                        currentPage === page
                          ? 'bg-blue-600 text-white'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
