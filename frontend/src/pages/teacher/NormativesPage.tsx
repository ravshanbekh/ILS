import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import { useAuthStore } from '@/stores/authStore';
import { normativesApi, groupsApi } from '@/api';
import { Loader2, BookOpen, Link as LinkIcon, Clock, CheckCircle, Plus } from 'lucide-react';

export default function TeacherNormativesPage() {
  const { user } = useAuthStore();
  const [normatives, setNormatives] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Assign modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedNormativeIds, setSelectedNormativeIds] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [assignResult, setAssignResult] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [normRes, groupRes] = await Promise.all([
        normativesApi.getAll(1, 200),
        groupsApi.getAll(1, 100)
      ]);
      setNormatives(normRes.data.data || []);
      setGroups(groupRes.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAssignModal = () => {
    setSelectedGroupId('');
    setSelectedNormativeIds([]);
    setAssignResult(null);
    setShowAssignModal(true);
  };

  const handleAssign = async () => {
    if (!selectedGroupId || selectedNormativeIds.length === 0) {
      setAssignResult('Guruh va kamida bitta normativ tanlang');
      return;
    }
    setAssigning(true);
    setAssignResult(null);
    try {
      const res = await groupsApi.assignNormatives(selectedGroupId, selectedNormativeIds);
      const data = res.data.data;
      setAssignResult(`✅ ${data.assigned} ta normativ biriktirildi${data.errors?.length > 0 ? ` (${data.errors.length} ta xatolik)` : ''}`);
      setSelectedNormativeIds([]);
    } catch (err: any) {
      setAssignResult(err.response?.data?.error?.message || 'Xatolik yuz berdi');
    } finally {
      setAssigning(false);
    }
  };

  const toggleNormative = (id: string) => {
    setSelectedNormativeIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedNormativeIds.length === normatives.length) {
      setSelectedNormativeIds([]);
    } else {
      setSelectedNormativeIds(normatives.map(n => n.id));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <Header title="Normativlar" subtitle={`${normatives.length} ta normativ`} />

      <div className="p-8 max-w-7xl mx-auto">
        {/* Action Bar */}
        <div className="flex justify-end mb-6">
          <button
            onClick={handleOpenAssignModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Guruhga biriktirish
          </button>
        </div>

        {/* Normatives Grid */}
        {normatives.length === 0 ? (
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-12 text-center">
            <BookOpen className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Normativlar topilmadi</h3>
            <p className="text-zinc-400 text-sm">Admin normativlar qo'shishi kerak.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {normatives.map((norm) => (
              <div key={norm.id} className="bg-[#18181b] rounded-xl p-5 border border-zinc-800 hover:border-blue-500/30 transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-[#09090b] border border-zinc-800 flex items-center justify-center text-blue-500 font-bold text-sm">
                    #{norm.taskNumber}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium text-sm truncate">{norm.title}</h3>
                    <p className="text-xs text-zinc-500">20 ball</p>
                  </div>
                </div>

                <p className="text-xs text-zinc-400 mb-3 line-clamp-2 leading-relaxed">
                  {norm.description || "Ta'rif kiritilmagan"}
                </p>

                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  {norm.timeLimit && (
                    <span className="flex items-center gap-1 bg-amber-500/10 text-amber-500 px-2 py-1 rounded border border-amber-500/20">
                      <Clock className="w-3 h-3" />
                      {norm.timeLimit} sek
                    </span>
                  )}
                  {norm.url && (
                    <a 
                      href={norm.url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex items-center gap-1 bg-blue-500/10 text-blue-500 px-2 py-1 rounded border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                    >
                      <LinkIcon className="w-3 h-3" />
                      URL
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#09090b]/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#18181b] rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-zinc-800 flex flex-col max-h-[85vh]">
            <h2 className="text-xl font-bold text-white mb-2">Guruhga normativ biriktirish</h2>
            <p className="text-sm text-zinc-400 mb-4">Bir yoki bir nechta normativni tanlang</p>

            {assignResult && (
              <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${
                assignResult.startsWith('✅')
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500'
                  : 'bg-red-500/10 border border-red-500/20 text-red-500'
              }`}>
                {assignResult}
              </div>
            )}

            {/* Group selector */}
            <div className="mb-4">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 block">Guruh tanlang</label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-[#09090b] border border-zinc-800 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Tanlang...</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            {/* Normatives list */}
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Normativlar</label>
              <button onClick={selectAll} className="text-xs text-blue-500 hover:text-blue-400 transition-colors">
                {selectedNormativeIds.length === normatives.length ? 'Barchasini bekor qilish' : 'Barchasini tanlash'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mb-4 bg-[#09090b] rounded-xl border border-zinc-800 p-2 divide-y divide-zinc-800 max-h-60">
              {normatives.map(norm => (
                <label key={norm.id} className="flex items-center justify-between p-2.5 hover:bg-zinc-800/30 cursor-pointer transition-colors rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-blue-500">#{norm.taskNumber}</span>
                    <span className="text-sm text-white truncate">{norm.title}</span>
                  </div>
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-zinc-700 text-blue-600 focus:ring-blue-600 bg-[#09090b]"
                    checked={selectedNormativeIds.includes(norm.id)}
                    onChange={() => toggleNormative(norm.id)}
                  />
                </label>
              ))}
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-zinc-800">
              <button
                onClick={() => setShowAssignModal(false)}
                className="flex-1 py-2.5 rounded-lg bg-[#09090b] hover:bg-zinc-800 text-zinc-300 font-medium text-sm transition-colors border border-zinc-800"
              >
                Yopish
              </button>
              <button
                onClick={handleAssign}
                disabled={assigning || !selectedGroupId || selectedNormativeIds.length === 0}
                className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Biriktirish ({selectedNormativeIds.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
