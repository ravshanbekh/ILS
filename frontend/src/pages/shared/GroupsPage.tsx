import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { groupsApi, usersApi } from '@/api';
import Header from '@/components/layout/Header';
import { Link } from 'react-router-dom';
import { FolderPlus, Pencil, Trash2, Users } from 'lucide-react';

export default function GroupsPage() {
  const { user } = useAuthStore();
  const [groups, setGroups] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', teacherId: '' });

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const res = await groupsApi.getAll(1, 100);
      setGroups(res.data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

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

  useEffect(() => {
    fetchGroups();
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

      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex justify-end mb-6">
          <button 
            onClick={() => handleOpenModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <FolderPlus className="w-4 h-4" />
            Yangi guruh
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full text-center py-8 text-zinc-500">Yuklanmoqda...</div>
          ) : groups.length === 0 ? (
            <div className="col-span-full text-center py-8 text-zinc-500">Guruhlar mavjud emas</div>
          ) : (
            groups.map((g) => (
              <Link to={user?.role === 'admin' ? `/admin/groups/${g.id}` : `/teacher/groups/${g.id}`} key={g.id} className="bg-[#18181b] border border-zinc-800 rounded-xl p-6 transition-all hover:border-blue-500/30 block group cursor-pointer relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                    <span className="text-xl font-bold text-blue-500">{g.name.charAt(0)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleOpenModal(g); }}
                      className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors z-10"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {user?.role === 'admin' && (
                      <button 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(g.id); }}
                        className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors z-10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                
                <h3 className="text-xl font-bold text-white mb-2">{g.name}</h3>
                
                <div className="flex items-center gap-2 text-zinc-400 text-sm">
                  <Users className="w-4 h-4" />
                  <span>{g.studentsCount || 0} nafar o'quvchi</span>
                </div>
              </Link>
            ))
          )}
        </div>
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
