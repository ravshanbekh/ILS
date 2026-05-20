import { useEffect, useState, useCallback } from 'react';
import Header from '@/components/layout/Header';
import { rankingsApi, groupsApi } from '@/api';
import api from '@/api/client';
import { useAuthStore } from '@/stores/authStore';
import {
  Trophy, Medal, Loader2, Star, ChevronLeft, ChevronRight,
  Filter, Users, Building2, ChevronsLeft, ChevronsRight, Search,
} from 'lucide-react';

type FilterType = 'overall' | 'group';

const ITEMS_PER_PAGE = 10;

export default function StudentRankingPage() {
  const { user } = useAuthStore();
  const [ranking, setRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<FilterType>('overall');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [groups, setGroups] = useState<any[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [myRank, setMyRank] = useState<any>(null);

  // Guruhlarni rol boyicha to'g'ri yuklaymiz
  useEffect(() => {
    if (user?.role === 'teacher') {
      // Teacher: o'z guruhlarini oladi
      groupsApi.getAll(1, 100, undefined, user.id)
        .then((res) => {
          const teacherGroups = res.data.data || [];
          setGroups(teacherGroups);
        })
        .catch(console.error);
    } else {
      // Student: o'z guruhlarini /auth/me orqali oladi
      api.get('/auth/me')
        .then((res) => {
          const userData = res.data.data;
          const studentGroups = userData?.groupStudents?.map((gs: any) => gs.group) || [];
          setGroups(studentGroups);
        })
        .catch(console.error);
    }
  }, [user?.role, user?.id]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reytingni yuklash
  const loadRanking = useCallback(async (page: number = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        page,
        limit: ITEMS_PER_PAGE,
      };

      if (filterType === 'group' && selectedGroupId) {
        params.groupId = selectedGroupId;
      }
      if (debouncedSearch) {
        params.search = debouncedSearch;
      }

      const res = await rankingsApi.getOverall(params);
      const responseData = res.data;

      const rankData = responseData.data || [];
      setRanking(rankData);
      // O'quvchining o'z o'rnini topish
      if (user?.role === 'student') {
        const myEntry = rankData.find((r: any) => r.student?.id === user?.id);
        if (myEntry) setMyRank(myEntry);
      }
      setPagination({
        page: responseData.pagination?.page || 1,
        total: responseData.pagination?.total || 0,
        totalPages: responseData.pagination?.totalPages || 0,
        hasNext: responseData.pagination?.hasNext || false,
        hasPrev: responseData.pagination?.hasPrev || false,
      });
    } catch (error) {
      console.error(error);
      setRanking([]);
    } finally {
      setLoading(false);
    }
  }, [filterType, selectedGroupId, debouncedSearch]);

  useEffect(() => {
    loadRanking(1);
  }, [loadRanking]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    loadRanking(newPage);
  };

  const handleFilterChange = (type: FilterType) => {
    setFilterType(type);
    if (type === 'overall') {
      setSelectedGroupId('');
    } else if (type === 'group' && groups.length > 0) {
      setSelectedGroupId(groups[0].id);
    }
  };

  const handleGroupChange = (groupId: string) => {
    setSelectedGroupId(groupId);
  };

  // Current user highlight
  const currentUserId = user?.id;

  return (
    <div>
      <Header title="Umumiy Reyting" subtitle="Markaz bo'yicha barcha o'quvchilar reytingi" />

      <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">

        {/* Filter Section */}
        <div className="bg-[#18181b] rounded-2xl overflow-hidden border border-zinc-800">
          <div className="p-4 sm:p-5 border-b border-zinc-800/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                <Filter className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Filtr</h3>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Reyting turini tanlang</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {/* Filter Tabs */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleFilterChange('overall')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    filterType === 'overall'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/20'
                      : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-white border border-zinc-700/50'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  Obshiy markaz
                </button>
                <button
                  onClick={() => handleFilterChange('group')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    filterType === 'group'
                      ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg shadow-purple-500/20'
                      : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-white border border-zinc-700/50'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Guruh bo'yicha
                </button>
              </div>

              {/* Group Selector — nechta guruh bo'lsa barchasini tanlab bo'ladi */}
              {filterType === 'group' && groups.length > 0 && (
                groups.length === 1 ? (
                  <div className="flex-1 min-w-0 flex items-center bg-zinc-800/50 text-purple-400 border border-purple-500/20 rounded-xl px-4 py-2.5 text-sm font-medium">
                    {groups[0].name}
                  </div>
                ) : (
                  <select
                    value={selectedGroupId}
                    onChange={(e) => handleGroupChange(e.target.value)}
                    className="flex-1 min-w-0 px-4 py-2.5 rounded-xl bg-zinc-800/50 text-purple-400 border border-purple-500/30 text-sm font-medium focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 appearance-none cursor-pointer"
                  >
                    {groups.map(g => (
                      <option key={g.id} value={g.id} className="bg-[#18181b] text-white">
                        {g.name}
                      </option>
                    ))}
                  </select>
                )
              )}
            </div>

            {/* Search input */}
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="O'quvchi ismi bo'yicha qidirish..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); }}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#09090b] border border-zinc-800 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder:text-zinc-600 transition-colors"
              />
            </div>
          </div>

          {/* Stats Bar */}
          <div className="px-5 py-3 bg-[#09090b]/50 flex items-center justify-between">
            <span className="text-xs text-zinc-500">
              Jami: <span className="text-zinc-300 font-semibold">{pagination.total}</span> o'quvchi
            </span>
            {pagination.totalPages > 1 && (
              <span className="text-xs text-zinc-500">
                Sahifa <span className="text-zinc-300 font-semibold">{pagination.page}</span> / {pagination.totalPages}
              </span>
            )}
          </div>
        </div>

        {/* My Rank Banner (faqat o'quvchi uchun) */}
        {user?.role === 'student' && myRank && !searchQuery && (
          <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
              <Star className="w-6 h-6 text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Sizning o'rningiz</p>
              <p className="text-white font-bold text-lg">{user.fullName}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-white">#{myRank.rank}</p>
              <p className="text-xs text-amber-400 font-semibold">⭐ {myRank.totalScore} ball</p>
            </div>
          </div>
        )}

        {/* Ranking List */}
        <div className="bg-[#18181b] rounded-2xl overflow-hidden border border-zinc-800 shadow-sm">
          <div className="p-5 border-b border-zinc-800 flex items-center gap-4 bg-[#18181b]">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
              <Trophy className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                {filterType === 'overall' ? 'Markaz Reytingi' : 'Guruh Reytingi'}
              </h2>
              <p className="text-xs text-zinc-400">
                {filterType === 'overall'
                  ? 'Barcha o\'quvchilar umumiy bali bo\'yicha'
                  : selectedGroupId
                    ? `Sizning guruhingiz bo'yicha`
                    : 'Guruh topilmadi'}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : filterType === 'group' && !selectedGroupId ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4 border border-purple-500/20">
                <Users className="w-7 h-7 text-purple-500" />
              </div>
              <p className="text-sm text-zinc-400 font-medium">Guruh mavjud emas</p>
              <p className="text-xs text-zinc-500 mt-1">Siz hali hech qanday guruhga a'zo emassiz yoki guruh tanlanmagan</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-zinc-800/50 bg-[#09090b]">
                {ranking.length === 0 ? (
                  <div className="p-12 text-center text-zinc-500 text-sm">
                    <Trophy className="w-10 h-10 mx-auto mb-3 text-zinc-700" />
                    Hozircha reyting mavjud emas
                  </div>
                ) : (
                  ranking.map((entry) => {
                    const isCurrentUser = entry.student?.id === currentUserId;
                    const rank = entry.rank;
                    const isTop3 = rank <= 3;

                    return (
                      <div
                        key={entry.student.id}
                        className={`flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 p-4 sm:px-6 transition-all duration-200 ${
                          isCurrentUser
                            ? 'bg-blue-500/5 border-l-2 border-l-blue-500'
                            : isTop3
                              ? 'bg-[#18181b] hover:bg-zinc-800/30'
                              : 'hover:bg-zinc-800/30'
                        }`}
                      >
                        <div className="flex items-center gap-4 sm:gap-6 flex-1">
                          {/* Rank Badge */}
                          <div className="w-10 flex justify-center shrink-0">
                            {rank === 1 ? (
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                                <Medal className="w-5 h-5 text-white" />
                              </div>
                            ) : rank === 2 ? (
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-zinc-300 to-zinc-500 flex items-center justify-center shadow-lg shadow-zinc-500/20">
                                <Medal className="w-5 h-5 text-white" />
                              </div>
                            ) : rank === 3 ? (
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-700 to-orange-800 flex items-center justify-center shadow-lg shadow-amber-700/20">
                                <Medal className="w-5 h-5 text-white" />
                              </div>
                            ) : (
                              <span className="text-base font-bold text-zinc-500">#{rank}</span>
                            )}
                          </div>

                          {/* Student Info */}
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center font-bold text-sm border ${
                              isCurrentUser
                                ? 'bg-blue-600/20 text-blue-400 border-blue-500/30'
                                : 'bg-blue-600/10 text-blue-500 border-blue-500/20'
                            }`}>
                              {entry.student.fullName.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <h3 className={`font-semibold truncate ${
                                isCurrentUser ? 'text-blue-400' : isTop3 ? 'text-white' : 'text-zinc-300'
                              }`}>
                                {entry.student.fullName}
                                {isCurrentUser && (
                                  <span className="ml-2 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                    Siz
                                  </span>
                                )}
                              </h3>
                              <p className="text-xs text-zinc-500 truncate">
                                {entry.groups?.map((g: any) => g.name).join(', ') || 'Guruhsiz'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-4 sm:gap-6 sm:justify-end ml-14 sm:ml-0">
                          {/* Results badges */}
                          {entry.results && (
                            <div className="hidden md:flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 text-[10px] font-bold border border-emerald-500/20">
                                {entry.results.green || 0}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/20">
                                {entry.results.blue || 0}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 text-[10px] font-bold border border-red-500/20">
                                {entry.results.red || 0}
                              </span>
                            </div>
                          )}

                          <div className="hidden sm:block text-right">
                            <p className="text-sm font-medium text-zinc-300">{entry.completed}</p>
                            <p className="text-[10px] uppercase tracking-wider text-zinc-500">bajarilgan</p>
                          </div>

                          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border min-w-[90px] justify-center ${
                            isTop3
                              ? 'bg-amber-500/5 border-amber-500/20'
                              : 'bg-[#09090b] border-zinc-800'
                          }`}>
                            <Star className={`w-3.5 h-3.5 ${isTop3 ? 'text-amber-500 fill-amber-500' : 'text-zinc-500'}`} />
                            <span className={`font-bold ${isTop3 ? 'text-amber-500 text-lg' : 'text-zinc-300 text-base'}`}>
                              {entry.totalScore}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="p-4 border-t border-zinc-800 flex items-center justify-between bg-[#18181b]">
                  <p className="text-xs text-zinc-500 hidden sm:block">
                    {(pagination.page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(pagination.page * ITEMS_PER_PAGE, pagination.total)} / {pagination.total}
                  </p>

                  <div className="flex items-center gap-1 mx-auto sm:mx-0">
                    {/* First Page */}
                    <button
                      onClick={() => handlePageChange(1)}
                      disabled={!pagination.hasPrev}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                      title="Birinchi sahifa"
                    >
                      <ChevronsLeft className="w-4 h-4" />
                    </button>

                    {/* Previous */}
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={!pagination.hasPrev}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                      title="Oldingi"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    {/* Page Numbers */}
                    {getPageNumbers(pagination.page, pagination.totalPages).map((pageNum, idx) =>
                      pageNum === '...' ? (
                        <span key={`dots-${idx}`} className="w-9 h-9 flex items-center justify-center text-zinc-600 text-sm">
                          ···
                        </span>
                      ) : (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum as number)}
                          className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-semibold transition-all duration-200 ${
                            pagination.page === pageNum
                              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                              : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    )}

                    {/* Next */}
                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={!pagination.hasNext}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                      title="Keyingi"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    {/* Last Page */}
                    <button
                      onClick={() => handlePageChange(pagination.totalPages)}
                      disabled={!pagination.hasNext}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                      title="Oxirgi sahifa"
                    >
                      <ChevronsRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Sahifa raqamlarini hisoblash (ellipsis bilan)
 */
function getPageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | string)[] = [];

  if (current <= 4) {
    for (let i = 1; i <= 5; i++) pages.push(i);
    pages.push('...');
    pages.push(total);
  } else if (current >= total - 3) {
    pages.push(1);
    pages.push('...');
    for (let i = total - 4; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    pages.push('...');
    for (let i = current - 1; i <= current + 1; i++) pages.push(i);
    pages.push('...');
    pages.push(total);
  }

  return pages;
}
