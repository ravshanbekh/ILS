import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { usersApi, groupsApi } from '@/api';
import Header from '@/components/layout/Header';
import { UserPlus, Pencil, Trash2, KeyRound, Copy, Check, Search, ChevronLeft, ChevronRight, FolderOpen } from 'lucide-react';
import { formatDateTime } from '@/utils';

export default function UsersPage() {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const ITEMS_PER_PAGE = 15;
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkData, setBulkData] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    login: '',
    password: '',
    fullName: '',
    role: 'student'
  });

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Group selection for new students
  const [allGroups, setAllGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [groupSearch, setGroupSearch] = useState('');

  const fetchUsers = useCallback(async (page: number, search: string) => {
    setLoading(true);
    try {
      const roleFilter = user?.role === 'teacher' ? 'student' : undefined;
      const res = await usersApi.getAll(page, ITEMS_PER_PAGE, roleFilter, search || undefined);
      setUsers(res.data.data);
      setTotalPages(res.data.pagination?.totalPages || 1);
      setTotalCount(res.data.pagination?.total || res.data.data.length);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchUsers(currentPage, debouncedSearch);
  }, [currentPage, debouncedSearch, fetchUsers]);

  const handleOpenModal = (userToEdit: any = null) => {
    if (userToEdit) {
      setEditingUser(userToEdit);
      setFormData({
        login: userToEdit.login,
        password: '',
        fullName: userToEdit.fullName,
        role: userToEdit.role,
      });
    } else {
      setEditingUser(null);
      // Generate a random login based on timestamp for new students
      const randomId = Math.floor(1000 + Math.random() * 9000);
      setFormData({
        login: `student${randomId}`,
        password: `pass${randomId}`,
        fullName: '',
        role: 'student',
      });
    }
    setSelectedGroupId('');
    setGroupSearch('');
    // Load groups
    groupsApi.getAll(1, 200).then(res => setAllGroups(res.data.data || [])).catch(console.error);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = { ...formData };
      if (!payload.password) delete payload.password;

      if (editingUser) {
        await usersApi.update(editingUser.id, payload);
      } else {
        const res = await usersApi.create(payload);
        // If student and group selected, add to group
        if (payload.role === 'student' && selectedGroupId && res.data.data?.id) {
          try {
            await groupsApi.addStudent(selectedGroupId, res.data.data.id);
          } catch (err) {
            console.error('Guruhga qo\'shishda xatolik:', err);
          }
        }
      }
      setShowModal(false);
      fetchUsers(currentPage, debouncedSearch);
    } catch (error) {
      console.error(error);
      alert('Xatolik yuz berdi');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Rostdan ham o\'chirmoqchimisiz?')) return;
    try {
      await usersApi.delete(id);
      fetchUsers(currentPage, debouncedSearch);
    } catch (error) {
      console.error(error);
      alert('O\'chirishda xatolik yuz berdi');
    }
  };

  const copyCredentials = (login: string) => {
    navigator.clipboard.writeText(`Login: ${login}`);
    setCopiedId(login);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div>
      <Header title="Foydalanuvchilar" subtitle="O'quvchilar va boshqa foydalanuvchilarni boshqarish" />

      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Ism yoki login bo'yicha qidirish..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#18181b] border border-zinc-800 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder:text-zinc-600"
            />
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setShowBulkModal(true)}
              className="bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 border border-emerald-500/20 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Exceldan yuklash
            </button>
            <button 
              onClick={() => handleOpenModal()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Yangi qo'shish
            </button>
          </div>
        </div>

        <div className="bg-[#18181b] border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-[#09090b] text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800 font-bold">
                <tr>
                  <th className="px-6 py-4">F.I.Sh.</th>
                  <th className="px-6 py-4">Login</th>
                  <th className="px-6 py-4">Rol</th>
                  <th className="px-6 py-4">Ro'yxatdan o'tgan sana</th>
                  <th className="px-6 py-4 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">Yuklanmoqda...</td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">Ma'lumot topilmadi</td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-white">{u.fullName}</td>
                      <td className="px-6 py-4 font-mono text-blue-400 flex items-center gap-2">
                        {u.login}
                        <button 
                          onClick={() => copyCredentials(u.login)}
                          className="text-zinc-500 hover:text-white"
                          title="Loginni nusxalash"
                        >
                          {copiedId === u.login ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                          u.role === 'admin' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                          u.role === 'teacher' ? 'bg-purple-500/10 text-purple-500 border border-purple-500/20' :
                          'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-zinc-500">{formatDateTime(u.createdAt)}</td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => handleOpenModal(u)}
                            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                            title="Tahrirlash / Parolni o'zgartirish"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          {user?.role === 'admin' && (
                            <button 
                              onClick={() => handleDelete(u.id)}
                              className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800">
              <span className="text-xs text-zinc-500">
                Jami: {totalCount} ta foydalanuvchi
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#09090b]/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#18181b] rounded-2xl w-full max-w-md p-6 shadow-2xl border border-zinc-800">
            <h2 className="text-xl font-bold text-white mb-6">
              {editingUser ? 'Foydalanuvchini tahrirlash' : 'Yangi foydalanuvchi'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 block">F.I.Sh</label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-lg bg-[#09090b] border border-zinc-800 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 block">Login</label>
                <input
                  type="text"
                  value={formData.login}
                  onChange={(e) => setFormData({...formData, login: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-lg bg-[#09090b] border border-zinc-800 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 block">
                  {editingUser ? 'Yangi parol (ixtiyoriy)' : 'Parol'}
                </label>
                <input
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-lg bg-[#09090b] border border-zinc-800 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
                  required={!editingUser}
                  placeholder={editingUser ? "O'zgartirish uchun kiriting..." : ""}
                />
              </div>

              {user?.role === 'admin' && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 block">Rol</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-lg bg-[#09090b] border border-zinc-800 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="student">O'quvchi (Student)</option>
                    <option value="teacher">O'qituvchi (Teacher)</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              )}

              {/* Group selection for new students */}
              {!editingUser && formData.role === 'student' && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 block">
                    <span className="flex items-center gap-1.5">
                      <FolderOpen className="w-3.5 h-3.5" />
                      Guruhga biriktirish
                      <span className="text-zinc-600 font-normal normal-case">(ixtiyoriy)</span>
                    </span>
                  </label>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Guruh nomi bo'yicha qidirish..."
                      value={groupSearch}
                      onChange={(e) => setGroupSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 rounded-lg bg-[#09090b] border border-zinc-800 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder:text-zinc-600"
                    />
                  </div>
                  <div className="max-h-32 overflow-y-auto bg-[#09090b] rounded-lg border border-zinc-800 divide-y divide-zinc-800/50">
                    <label className="flex items-center gap-3 px-3 py-2 hover:bg-zinc-800/30 cursor-pointer transition-colors">
                      <input
                        type="radio"
                        name="group"
                        value=""
                        checked={selectedGroupId === ''}
                        onChange={() => setSelectedGroupId('')}
                        className="w-3.5 h-3.5 text-blue-600 bg-[#09090b] border-zinc-700"
                      />
                      <span className="text-sm text-zinc-400">Biriktirmasdan yaratish</span>
                    </label>
                    {allGroups
                      .filter(g => !groupSearch.trim() || g.name.toLowerCase().includes(groupSearch.toLowerCase()))
                      .map(g => (
                        <label key={g.id} className="flex items-center gap-3 px-3 py-2 hover:bg-zinc-800/30 cursor-pointer transition-colors">
                          <input
                            type="radio"
                            name="group"
                            value={g.id}
                            checked={selectedGroupId === g.id}
                            onChange={() => setSelectedGroupId(g.id)}
                            className="w-3.5 h-3.5 text-blue-600 bg-[#09090b] border-zinc-700"
                          />
                          <span className="text-sm text-white">{g.name}</span>
                        </label>
                      ))
                    }
                  </div>
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
      {/* Bulk Import Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#09090b]/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#18181b] rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-zinc-800 flex flex-col max-h-[90vh]">
            <h2 className="text-xl font-bold text-white mb-2">Excel dan yuklash</h2>
            <p className="text-xs text-zinc-400 mb-6">Exceldan F.I.Sh, Login va Parol ustunlarini nusxalab, quyidagi maydonga tashlang (paste).</p>

            <div className="flex-1 overflow-hidden flex flex-col min-h-[300px]">
              <textarea
                value={bulkData}
                onChange={(e) => setBulkData(e.target.value)}
                placeholder={`Misol uchun:\nAlijon Valiyev\tali\tpass123\nEshmat Toshmatov\teshmat\tpass123`}
                className="w-full flex-1 px-4 py-3 rounded-lg bg-[#09090b] border border-zinc-800 text-zinc-300 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono whitespace-pre resize-none"
              />
            </div>

            <div className="flex items-center gap-3 mt-6 pt-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setShowBulkModal(false);
                  setBulkData('');
                }}
                className="flex-1 py-2.5 rounded-lg bg-[#09090b] hover:bg-zinc-800 text-zinc-300 font-medium text-sm transition-colors border border-zinc-800"
              >
                Bekor qilish
              </button>
              <button
                onClick={async () => {
                  if (!bulkData.trim()) return;
                  setBulkLoading(true);
                  try {
                    const rows = bulkData.trim().split('\n');
                    const usersToCreate = rows.map(row => {
                      const cols = row.split('\t');
                      return {
                        fullName: cols[0]?.trim() || '',
                        login: cols[1]?.trim() || '',
                        password: cols[2]?.trim() || '123456',
                        role: 'student'
                      };
                    }).filter(u => u.fullName && u.login);

                    if (usersToCreate.length === 0) {
                      alert('Noto\'g\'ri format. F.I.Sh va Login bo\'lishi shart.');
                      return;
                    }

                    const res = await usersApi.bulkCreate({ users: usersToCreate });
                    alert(`Muvaffaqiyatli: ${res.data.data.created} ta. Xatolar: ${res.data.data.errors.length} ta.`);
                    setShowBulkModal(false);
                    setBulkData('');
                    fetchUsers(1, debouncedSearch);
                    setCurrentPage(1);
                  } catch (error) {
                    console.error(error);
                    alert('Yuklashda xatolik yuz berdi');
                  } finally {
                    setBulkLoading(false);
                  }
                }}
                disabled={bulkLoading}
                className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium text-sm transition-colors"
              >
                {bulkLoading ? 'Yuklanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
