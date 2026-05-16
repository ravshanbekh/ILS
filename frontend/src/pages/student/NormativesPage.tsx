import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import ScoreBadge from '@/components/shared/ScoreBadge';
import { normativesApi, submissionsApi, groupsApi } from '@/api';
import api from '@/api/client';
import { useAuthStore } from '@/stores/authStore';
import { BookOpen, Video, Send, Loader2, Clock, ChevronDown, ChevronRight, ExternalLink, Play } from 'lucide-react';

export default function StudentNormativesPage() {
  const { user } = useAuthStore();
  const [normatives, setNormatives] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  // Modal state
  const [selectedNormative, setSelectedNormative] = useState<any>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // O'quvchining guruhlarini olish
      const meRes = await api.get('/auth/me');
      const studentGroups = meRes.data.data?.groupStudents?.map((gs: any) => gs.group) || [];

      // Guruhga biriktirilgan normativ ID'larini yig'ish
      const groupNormIds = new Set<string>();
      for (const group of studentGroups) {
        try {
          const groupRes = await groupsApi.getById(group.id);
          const gNorms = groupRes.data?.data?.normatives || [];
          gNorms.forEach((n: any) => groupNormIds.add(n.id));
        } catch {}
      }

      const [normRes, subRes] = await Promise.all([
        normativesApi.getAll(1, 500),
        submissionsApi.getByStudent(user?.id as string, { page: '1', limit: '1000' })
      ]);

      const allNorms = normRes.data.data || [];
      const allSubs = subRes.data.data || [];

      // Talaba topshirgan normativlar ID'lari
      const submittedNormIds = new Set<string>(allSubs.map((s: any) => s.normativeId));

      // Guruhga biriktirilgan YOKI talaba avval topshirgan normativlarni ko'rsat
      const sortedFiltered = allNorms
        .filter((n: any) => groupNormIds.has(n.id) || submittedNormIds.has(n.id))
        .sort((a: any, b: any) => a.taskNumber - b.taskNumber);

      setNormatives(sortedFiltered);
      setSubmissions(allSubs);
      setCurrentPage(1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };


  const getSubmissionForNormative = (normativeId: string) => {
    return submissions.find(s => s.normativeId === normativeId);
  };

  const handleOpenSubmitModal = async (norm: any) => {
    setSelectedNormative(norm);
    setYoutubeUrl('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Youtube validation (watch, shorts, live, youtu.be barchasi)
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch|shorts|live|embed)\/.+|youtu\.be\/.+)/;
    if (!youtubeRegex.test(youtubeUrl)) {
      setError("Noto'g'ri YouTube havola kiritildi");
      return;
    }

    setSubmitting(true);
    try {
      await submissionsApi.create({
        normativeId: selectedNormative.id,
        youtubeUrl
      });
      
      // Close modal and refresh
      setSelectedNormative(null);
      setYoutubeUrl('');
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Xatolik yuz berdi");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  // Stats
  const totalNorms = normatives.length;
  const completedCount = normatives.filter(n => {
    const sub = getSubmissionForNormative(n.id);
    return sub && sub.status === 'checked';
  }).length;
  const pendingCount = normatives.filter(n => {
    const sub = getSubmissionForNormative(n.id);
    return sub && sub.status === 'pending';
  }).length;
  const notSubmittedCount = totalNorms - completedCount - pendingCount;

  const totalPages = Math.ceil(totalNorms / PAGE_SIZE);
  const paginatedNormatives = normatives.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div>
      <Header title="Normativlar" subtitle="Barcha normativlar va ularni topshirish" />

      <div className="p-4 sm:p-8 max-w-5xl mx-auto">
        {/* Progress Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{totalNorms}</p>
            <p className="text-xs text-zinc-500 mt-1">Jami</p>
          </div>
          <div className="bg-[#18181b] border border-emerald-500/20 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-emerald-500">{completedCount}</p>
            <p className="text-xs text-zinc-500 mt-1">Bajarilgan</p>
          </div>
          <div className="bg-[#18181b] border border-amber-500/20 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-amber-500">{pendingCount}</p>
            <p className="text-xs text-zinc-500 mt-1">Tekshirilmoqda</p>
          </div>
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-zinc-400">{notSubmittedCount}</p>
            <p className="text-xs text-zinc-500 mt-1">Topshirilmagan</p>
          </div>
        </div>

        {normatives.length === 0 ? (
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-12 text-center">
            <BookOpen className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Normativlar topilmadi</h3>
            <p className="text-zinc-400 text-sm">Hali normativlar qo'shilmagan.</p>
          </div>
        ) : (
          <div className="bg-[#18181b] border border-zinc-800 rounded-2xl overflow-hidden">
            {/* Table Header */}
            <div className="hidden sm:grid grid-cols-[auto_1fr_100px_120px_100px] items-center gap-4 px-5 py-3 border-b border-zinc-800 bg-[#111113]">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold w-10 text-center">#</span>
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Nomi</span>
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold text-center">Vaqt</span>
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold text-center">Holat</span>
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold text-center">Amal</span>
            </div>

            {/* Normatives List */}
            <div className="divide-y divide-zinc-800/50">
              {paginatedNormatives.map((norm) => {
                const submission = getSubmissionForNormative(norm.id);
                const isPending = submission && submission.status === 'pending';
                const isChecked = submission && submission.status === 'checked';
                const isGreen = isChecked && submission.result === 'green';
                const canResubmit = submission && submission.canResubmit === true;
                const isExpanded = expandedId === norm.id;

                return (
                  <div key={norm.id} className="group">
                    {/* Row */}
                    <div
                      onClick={() => toggleExpand(norm.id)}
                      className={`grid grid-cols-1 sm:grid-cols-[auto_1fr_100px_120px_100px] items-center gap-3 sm:gap-4 px-5 py-4 cursor-pointer transition-all duration-200 hover:bg-zinc-800/30 ${
                        isExpanded ? 'bg-zinc-800/20' : ''
                      }`}
                    >
                      {/* Task Number */}
                      <div className="flex items-center gap-3 sm:block">
                        <div className="w-10 h-10 rounded-lg bg-[#09090b] border border-zinc-800 flex items-center justify-center text-blue-500 font-bold text-xs shrink-0">
                          #{norm.taskNumber}
                        </div>
                        {/* Mobile title */}
                        <div className="sm:hidden flex-1 min-w-0">
                          <h3 className="text-white font-medium text-sm truncate">{norm.title}</h3>
                          <p className="text-xs text-zinc-500">{norm.maxScore} ball</p>
                        </div>
                        {/* Mobile expand icon */}
                        <div className="sm:hidden">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
                        </div>
                      </div>

                      {/* Title (desktop) */}
                      <div className="hidden sm:flex items-center gap-2 min-w-0">
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />}
                        <div className="min-w-0">
                          <h3 className="text-white font-medium text-sm truncate">{norm.title}</h3>
                          <p className="text-xs text-zinc-500 truncate">{norm.maxScore} ball · {norm.description || "Ta'rifsiz"}</p>
                        </div>
                      </div>

                      {/* Time */}
                      <div className="hidden sm:flex justify-center">
                        {norm.timeLimit ? (
                          <span className="flex items-center gap-1 text-xs bg-amber-500/10 text-amber-500 px-2 py-1 rounded border border-amber-500/20">
                            <Clock className="w-3 h-3" />
                            {norm.timeLimit}s
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-600">—</span>
                        )}
                      </div>

                      {/* Status */}
                      <div className="hidden sm:flex justify-center" onClick={(e) => e.stopPropagation()}>
                        {isGreen ? (
                          <span className="text-xs bg-emerald-500/10 text-emerald-500 px-2.5 py-1 rounded-lg border border-emerald-500/20 font-medium">
                            ✅ {submission.score} ball
                          </span>
                        ) : isPending ? (
                          <span className="text-xs bg-amber-500/10 text-amber-500 px-2.5 py-1 rounded-lg border border-amber-500/20 font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Kutilmoqda
                          </span>
                        ) : isChecked ? (
                          <ScoreBadge result={submission.result} size="sm" />
                        ) : (
                          <span className="text-xs text-zinc-600 font-medium">Topshirilmagan</span>
                        )}
                      </div>

                      {/* Action */}
                      <div className="hidden sm:flex justify-center" onClick={(e) => e.stopPropagation()}>
                        {isGreen ? (
                          <span className="text-xs text-emerald-600">Tayyor</span>
                        ) : isPending ? (
                          <span className="text-xs text-zinc-600">—</span>
                        ) : isChecked && !canResubmit ? (
                          <span className="text-xs text-zinc-600">Baholangan</span>
                        ) : (
                          <button
                            onClick={() => handleOpenSubmitModal(norm)}
                            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1 ${
                              canResubmit 
                                ? 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700' 
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                          >
                            <Send className="w-3 h-3" />
                            {canResubmit ? 'Qayta' : 'Topshir'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="px-5 pb-5 bg-[#111113]/50 border-t border-zinc-800/30 animate-fade-in">
                        <div className="pt-4 space-y-4">
                          {/* Description */}
                          {norm.description && (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">Ta'rif</p>
                              <p className="text-sm text-zinc-300 leading-relaxed">{norm.description}</p>
                            </div>
                          )}

                          {/* Info row */}
                          <div className="flex flex-wrap items-center gap-3">
                            {norm.timeLimit && (
                              <span className="flex items-center gap-1.5 text-xs bg-amber-500/10 text-amber-500 px-3 py-1.5 rounded-lg border border-amber-500/20">
                                <Clock className="w-3.5 h-3.5" />
                                {norm.timeLimit} sekund
                              </span>
                            )}
                            <span className="text-xs bg-blue-500/10 text-blue-500 px-3 py-1.5 rounded-lg border border-blue-500/20">
                              Max: {norm.maxScore} ball
                            </span>
                          </div>

                          {/* Instruction URL Section */}
                          {norm.url && (
                            <div className="mt-2">
                              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2 flex items-center gap-1.5">
                                <ExternalLink className="w-3.5 h-3.5" />
                                Namuna / Ko'rsatma URL
                              </p>
                              <div className="rounded-xl overflow-hidden border border-zinc-800 bg-[#09090b]">
                                <div className="p-4 flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                    <ExternalLink className="w-4 h-4 text-blue-500" />
                                  </div>
                                  <a
                                    href={norm.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-sm text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors flex-1 truncate"
                                  >
                                    {norm.url}
                                  </a>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Mobile Status + Action */}
                          <div className="flex items-center gap-3 sm:hidden pt-2">
                            {/* Status */}
                            <div className="flex-1">
                              {isGreen ? (
                                <span className="text-xs bg-emerald-500/10 text-emerald-500 px-2.5 py-1.5 rounded-lg border border-emerald-500/20 font-medium inline-block">
                                  ✅ {submission.score} ball
                                </span>
                              ) : isPending ? (
                                <span className="text-xs bg-amber-500/10 text-amber-500 px-2.5 py-1.5 rounded-lg border border-amber-500/20 font-medium inline-flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> Kutilmoqda
                                </span>
                              ) : isChecked ? (
                                <ScoreBadge result={submission.result} size="sm" />
                              ) : (
                                <span className="text-xs text-zinc-600">Topshirilmagan</span>
                              )}
                            </div>
                            {/* Action */}
                            {!isGreen && !isPending && (!isChecked || canResubmit) && (
                              <button
                                onClick={() => handleOpenSubmitModal(norm)}
                                className={`text-xs px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-1 ${
                                  canResubmit 
                                    ? 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700' 
                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                              >
                                <Send className="w-3 h-3" />
                                {canResubmit ? 'Qayta topshirish' : 'Topshirish'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-zinc-800 bg-[#111113]">
                <p className="text-xs text-zinc-500">
                  {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalNorms)} / {totalNorms} ta
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium disabled:opacity-40 transition-colors"
                  >
                    ← Oldingi
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                        page === currentPage
                          ? 'bg-blue-600 text-white'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium disabled:opacity-40 transition-colors"
                  >
                    Keyingi →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Topshirish Modali */}
      {selectedNormative && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#09090b]/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#18181b] rounded-2xl w-full max-w-md p-6 shadow-2xl border border-zinc-800">
            <h2 className="text-xl font-bold text-white mb-2 tracking-tight">Normativ topshirish</h2>
            <p className="text-sm text-zinc-400 mb-6">
              <span className="font-mono text-blue-500">#{selectedNormative.taskNumber}</span>: {selectedNormative.title}
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5" />
                  YouTube havola
                </label>
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full px-4 py-3 rounded-xl bg-[#09090b] border border-zinc-800 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  required
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedNormative(null);
                    setYoutubeUrl('');
                    setError('');
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#09090b] hover:bg-zinc-800 text-zinc-300 font-medium text-sm transition-colors border border-zinc-800"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Yuborish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
