import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { groupsApi, usersApi } from '@/api';
import Header from '@/components/layout/Header';
import { Link } from 'react-router-dom';
import { FolderPlus, Pencil, Trash2, Users, Search, ChevronLeft, ChevronRight, GraduationCap } from 'lucide-react';

export default function GroupsPage() {
  const { user } = useAuthStore();
  const [groups, setGroups] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination, search, filter
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const limit = 24;

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', teacherId: '' });

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await groupsApi.getAll(
        currentPage,
        limit,
        debouncedSearch || undefined,
        selectedTeacherId || undefined
      );
      setGroups(res.data.data);
      const meta = res.data.meta || res.data.pagination;
      if (meta) {
        setTotalPages(meta.totalPages || 1);
        setTotalItems(meta.total || 0);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearch, selectedTeacherId]);

  const fetchTeachers = async () => {
    if (user?.role === 'admin') {
      try {
        const res = await usersApi.getAll(1, 100, 'teacher');
        setTeachers(res.data.data);
      } catch (error) {
        console.error(error);
      }
    }
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Teacher filter changes => reset page
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedTeacherId]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  useEffect(() => {
    fetchTeachers();
  }, []);

  const handleOpenModal = (groupToEdit: any = null) => {
    if (groupToEdit) {
      setEditingGroup(groupToEdit);
      setFormData({ name: groupToEdit.name, teacherId: groupToEdit.teacherId || '' });
    } else {
      setEditingGroup(null);
      setFormData({ name: '', teacherId: '' });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = { ...formData };
      if (!payload.teacherId) delete payload.teacherId;

      if (editingGroup) {
        await groupsApi.update(editingGroup.id, payload);
      } else {
        await groupsApi.create(payload);
      }
      setShowModal(false);
      fetchGroups();
    } catch (error) {
      console.error(error);
      alert('Xatolik yuz berdi');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Rostdan ham o\'chirmoqchimisiz?')) return;
    try {
      await groupsApi.delete(id);
      fetchGroups();
    } catch (error) {
      console.error(error);
      alert('O\'chirishda xatolik yuz berdi');
    }
  };

  return (
    <div>
      <Header title="Guruhlar" subtitle="Guruhlarni boshqarish" />

      <div className="p-4 sm:p-8 max-w-7xl mx-auto">
        <div className="flex flex-col gap-3 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Guruh nomini qidiring..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-[#18181b] border border-zinc-800 rounded-xl text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-sm"
              />
            </div>

            {/* Teacher filter - admin only */}
            {user?.role === 'admin' && teachers.length > 0 && (
              <div className="relative min-w-[220px]">
                <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <select
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-[#18181b] border border-zinc-800 rounded-xl text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 appearance-none"
                >
                  <option value="">Barcha o'qituvchilar</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.fullName}</option>
                  ))}
                </select>
              </div>
            )}

            <button 
              onClick={() => handleOpenModal()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap justify-center"
            >
              <FolderPlus className="w-4 h-4" />
              Yangi guruh
            </button>
          </div>

          {/* Active teacher filter badge */}
          {selectedTeacherId && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">Filtr:</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-medium">
                <GraduationCap className="w-3 h-3" />
                {teachers.find(t => t.id === selectedTeacherId)?.fullName}
                <button onClick={() => setSelectedTeacherId('')} className="ml-1 text-blue-400 hover:text-white">×</button>
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {loading ? (
            <div className="col-span-full text-center py-8 text-zinc-500">Yuklanmoqda...</div>
          ) : groups.length === 0 ? (
            <div className="col-span-full text-center py-8 text-zinc-500">Guruhlar mavjud emas</div>
          ) : (
            groups.map((g) => (
              <Link to={user?.role === 'admin' ? `/admin/groups/${g.id}` : `/teacher/groups/${g.id}`} key={g.id} className="bg-[#18181b] border border-zinc-800 rounded-xl p-4 transition-all hover:border-blue-500/30 block group cursor-pointer relative">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                    <span className="text-lg font-bold text-blue-500">{g.name.charAt(0)}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleOpenModal(g); }}
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors z-10"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {user?.role === 'admin' && (
                      <button 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(g.id); }}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors z-10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                
                <h3 className="text-base font-bold text-white mb-1.5 line-clamp-1" title={g.name}>{g.name}</h3>
                
                <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
                  <Users className="w-3.5 h-3.5" />
                  <span>{g.studentsCount || 0} o'quvchi</span>
                </div>
              </Link>
            ))
          )}
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-zinc-800/50">
            <div className="text-sm text-zinc-400">
              Jami: <span className="text-white font-medium">{totalItems}</span> ta guruh
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg bg-[#18181b] border border-zinc-800 text-zinc-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-1">
                {[...Array(totalPages)].map((_, i) => {
                  const page = i + 1;
                  // Show current page, first, last, and pages around current
                  if (
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors flex items-center justify-center ${
                          currentPage === page
                            ? 'bg-blue-600 text-white'
                            : 'bg-[#18181b] border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  } else if (
                    page === currentPage - 2 ||
                    page === currentPage + 2
                  ) {
                    return <span key={page} className="text-zinc-500">...</span>;
                  }
                  return null;
                })}
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg bg-[#18181b] border border-zinc-800 text-zinc-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#09090b]/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#18181b] rounded-2xl w-full max-w-md p-6 shadow-2xl border border-zinc-800">
            <h2 className="text-xl font-bold text-white mb-6">
              {editingGroup ? 'Guruhni tahrirlash' : 'Yangi guruh'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 block">Guruh nomi</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-lg bg-[#09090b] border border-zinc-800 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  required
                  placeholder="Masalan: Frontend 101"
                />
              </div>

              {user?.role === 'admin' && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 block">O'qituvchi (ixtiyoriy)</label>
                  <select
                    value={formData.teacherId}
                    onChange={(e) => setFormData({...formData, teacherId: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-lg bg-[#09090b] border border-zinc-800 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Biriktirilmagan</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.fullName} ({t.login})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-3 mt-6 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-lg bg-[#09090b] hover:bg-zinc-800 text-zinc-300 font-medium text-sm transition-colors border border-zinc-800"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors"
                >
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
