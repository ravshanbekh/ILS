import { useEffect, useState, useCallback } from 'react';
import Header from '@/components/layout/Header';
import { submissionsApi, groupsApi } from '@/api';
import { formatDateTime } from '@/utils';
import {
  Loader2, Video, Check, MessageSquare, Search, Filter, Clock,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

const PAGE_SIZE = 50;

export default function TeacherPendingPage() {
  const { user } = useAuthStore();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<any[]>([]);

  // Filter state
  const [searchName, setSearchName] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Grading state
  const [gradingSubId, setGradingSubId] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedGroup]);

  useEffect(() => {
    fetchPending(currentPage);
  }, [currentPage, selectedGroup]);

  const fetchGroups = async () => {
    try {
      const res = await groupsApi.getAll(1, 100, undefined, user?.id);
      setGroups(res.data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPending = useCallback(async (page: number) => {
    try {
      setLoading(true);
      const params: Record<string, string> = {
        page: String(page),
        limit: String(PAGE_SIZE),
      };
      if (selectedGroup) params.groupId = selectedGroup;

      const res = await submissionsApi.getPending(params);
      setSubmissions(res.data.data || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
      setTotalCount(res.data.pagination?.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedGroup]);

  // Client-side name search (server-side pagination bilan birga)
  const filtered = searchName.trim()
    ? submissions.filter(s =>
        s.student?.fullName?.toLowerCase().includes(searchName.toLowerCase())
      )
    : submissions;

  const handleGrade = async (id: string, result: 'green' | 'blue' | 'red') => {
    setProcessing(true);
    try {
      await submissionsApi.check(id, { result, comment: gradingSubId === id ? comment : undefined });
      // O'sha elementni listdan olib tashlab, totalCount ni kamaytir
      setSubmissions(prev => prev.filter(p => p.id !== id));
      setTotalCount(prev => prev - 1);
      setGradingSubId(null);
      setComment('');
    } catch (err) {
      console.error(err);
      alert('Xatolik yuz berdi');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <Header
        title="Tekshirilmagan topshiriqlar"
        subtitle={loading ? 'Yuklanmoqda...' : `Kutilyotgan: ${totalCount} ta`}
      />

      <div className="p-8 max-w-5xl mx-auto">

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="O'quvchi ismi bo'yicha qidirish..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#18181b] border border-zinc-800 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="pl-10 pr-8 py-2.5 rounded-xl bg-[#18181b] border border-zinc-800 text-white text-sm focus:outline-none focus:border-blue-500 appearance-none min-w-[180px]"
            >
              <option value="">Barcha guruhlar</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          {(searchName || selectedGroup) && (
            <button
              onClick={() => { setSearchName(''); setSelectedGroup(''); }}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors whitespace-nowrap"
            >
              Tozalash
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
              <Check className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              {totalCount === 0 ? 'Barcha ishlar tekshirilgan!' : 'Topilmadi'}
            </h3>
            <p className="text-zinc-400">
              {totalCount === 0 ? 'Hozircha yangi topshiriqlar yo\'q.' : 'Filtr bo\'yicha topshiriqlar yo\'q.'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6">
              {filtered.map((sub) => (
                <div key={sub.id} className="bg-[#18181b] border border-zinc-800 rounded-xl overflow-hidden hover:border-blue-500/30 transition-all flex flex-col md:flex-row">

                  {/* Info section */}
                  <div className="p-6 flex-1 border-b md:border-b-0 md:border-r border-zinc-800">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-white mb-1">{sub.student.fullName}</h3>
                        <p className="text-sm text-zinc-400">{sub.group?.name || 'Guruhsiz'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Topshirildi:</p>
                        <p className="text-sm font-medium text-zinc-300">{formatDateTime(sub.submittedAt)}</p>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-[#09090b] border border-zinc-800 mb-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono font-bold text-blue-500 bg-blue-500/10 px-2 py-1 rounded">#{sub.normative.taskNumber}</span>
                          <span className="font-medium text-white text-sm">{sub.normative.title}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {sub.normative.timeLimit && (
                            <span className="flex items-center gap-1 text-xs font-medium text-amber-500 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                              <Clock className="w-3 h-3" />
                              {sub.normative.timeLimit}s
                            </span>
                          )}
                          <span className="text-xs font-medium text-zinc-400 bg-zinc-800/50 px-2 py-1 rounded">Max: {sub.normative.maxScore} ball</span>
                        </div>
                      </div>
                    </div>

                    <a
                      href={sub.youtubeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 transition-colors font-medium text-sm w-fit"
                    >
                      <Video className="w-4 h-4" />
                      YouTube'da ko'rish
                    </a>
                  </div>

                  {/* Grading section */}
                  <div className="p-6 md:w-80 bg-[#09090b] flex flex-col justify-center">
                    {gradingSubId === sub.id ? (
                      <div className="space-y-4 animate-fade-in">
                        <div>
                          <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 flex items-center gap-1.5 mb-2">
                            <MessageSquare className="w-3.5 h-3.5" /> Izoh qoldirish
                          </label>
                          <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Xato va kamchiliklar haqida..."
                            className="w-full px-3 py-2.5 rounded-lg bg-[#18181b] border border-zinc-800 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                            rows={3}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <button onClick={() => handleGrade(sub.id, 'green')} disabled={processing} className="py-2.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 transition-colors disabled:opacity-50 font-bold">🟢</button>
                          <button onClick={() => handleGrade(sub.id, 'blue')} disabled={processing} className="py-2.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/30 transition-colors disabled:opacity-50 font-bold">🔵</button>
                          <button onClick={() => handleGrade(sub.id, 'red')} disabled={processing} className="py-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 transition-colors disabled:opacity-50 font-bold">🔴</button>
                        </div>
                        <button onClick={() => setGradingSubId(null)} className="w-full py-2 text-xs font-medium text-zinc-500 hover:text-white transition-colors">
                          Bekor qilish
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <h4 className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 mb-3 text-center">Natijani baholash</h4>
                        <div className="grid grid-cols-1 gap-2.5">
                          <button onClick={() => handleGrade(sub.id, 'green')} className="flex items-center justify-between px-4 py-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 transition-all">
                            <span className="font-semibold text-sm">A'lo (Yashil)</span>
                            <span className="text-xs font-bold bg-emerald-500/20 px-2 py-1 rounded">{sub.normative.maxScore} ball</span>
                          </button>
                          <button onClick={() => handleGrade(sub.id, 'blue')} className="flex items-center justify-between px-4 py-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/20 transition-all">
                            <span className="font-semibold text-sm">Yaxshi (Ko'k)</span>
                            <span className="text-xs font-bold bg-blue-500/20 px-2 py-1 rounded">{Math.round(sub.normative.maxScore / 2)} ball</span>
                          </button>
                          <div className="flex gap-2.5 mt-1">
                            <button onClick={() => handleGrade(sub.id, 'red')} className="flex-1 flex items-center justify-center px-4 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 transition-all">
                              <span className="font-semibold text-sm">Qoniqarsiz (Qizil)</span>
                            </button>
                            <button
                              onClick={() => { setGradingSubId(sub.id); setComment(''); }}
                              className="w-12 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-all flex items-center justify-center border border-zinc-700"
                              title="Izoh qoldirish"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-8 px-2">
                <p className="text-xs text-zinc-500">
                  Sahifa <span className="text-zinc-300 font-semibold">{currentPage}</span> / {totalPages}
                  {' '}· Jami <span className="text-zinc-300 font-semibold">{totalCount}</span> ta
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" /> Oldingi
                  </button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let page: number;
                    if (totalPages <= 7) page = i + 1;
                    else if (currentPage <= 4) page = i + 1;
                    else if (currentPage >= totalPages - 3) page = totalPages - 6 + i;
                    else page = currentPage - 3 + i;
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-9 h-9 rounded-lg text-sm font-bold transition-colors ${
                          page === currentPage ? 'bg-blue-600 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm disabled:opacity-40 transition-colors"
                  >
                    Keyingi <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
