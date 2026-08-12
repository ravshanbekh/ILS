import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/layout/Header';
import { trashApi } from '@/api';
import { formatDateTime } from '@/utils';
import {
  Trash2, RefreshCw, Search, Loader2, Users, Folder, AlertTriangle, ShieldAlert, Check, X
} from 'lucide-react';

export default function TrashPage() {
  const [activeTab, setActiveTab] = useState<'groups' | 'users'>('groups');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Groups trash data
  const [groups, setGroups] = useState<any[]>([]);
  const [groupTotal, setGroupTotal] = useState(0);

  // Users trash data
  const [users, setUsers] = useState<any[]>([]);
  const [userTotal, setUserTotal] = useState(0);

  // Action states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [emptyLoading, setEmptyLoading] = useState(false);

  // Fetch trash items
  const fetchTrash = useCallback(async (search: string) => {
    setLoading(true);
    try {
      if (activeTab === 'groups') {
        const res = await trashApi.getGroups(1, search || undefined);
        setGroups(res.data.data || []);
        setGroupTotal(res.data.pagination?.total || (res.data.data || []).length);
      } else {
        const res = await trashApi.getUsers(1, search || undefined);
        setUsers(res.data.data || []);
        setUserTotal(res.data.pagination?.total || (res.data.data || []).length);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchTrash(debouncedSearch);
  }, [fetchTrash, debouncedSearch]);

  // Restore Group
  const handleRestoreGroup = async (id: string, name: string) => {
    setActionLoadingId(id);
    try {
      await trashApi.restoreGroup(id);
      fetchTrash(debouncedSearch);
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || "Qaytarishda xatolik yuz berdi");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Restore User
  const handleRestoreUser = async (id: string, name: string) => {
    setActionLoadingId(id);
    try {
      await trashApi.restoreUser(id);
      fetchTrash(debouncedSearch);
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || "Qaytarishda xatolik yuz berdi");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Permanent Delete Group
  const handlePermanentDeleteGroup = async (id: string, name: string) => {
    if (!confirm(`⚠️ Diqqat! "${name}" guruhini bazadan BUTUNLAY O'CHIRISHNI xohlaysizmi? Bu amalni ortga qaytarib bo'lmaydi!`)) return;
    setActionLoadingId(id);
    try {
      await trashApi.permanentlyDeleteGroup(id);
      fetchTrash(debouncedSearch);
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || "O'chirishda xatolik yuz berdi");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Permanent Delete User
  const handlePermanentDeleteUser = async (id: string, name: string) => {
    if (!confirm(`⚠️ Diqqat! "${name}" foydalanuvchisini bazadan BUTUNLAY O'CHIRISHNI xohlaysizmi? Bu amalni ortga qaytarib bo'lmaydi!`)) return;
    setActionLoadingId(id);
    try {
      await trashApi.permanentlyDeleteUser(id);
      fetchTrash(debouncedSearch);
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || "O'chirishda xatolik yuz berdi");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Empty Trash
  const handleEmptyTrash = async () => {
    if (!confirm("💥 Diqqat! Savatdagi barcha o'chirilgan guruhlar va foydalanuvchilar BUTUNLAY O'CHIRIB TASHLANADI! Davom etasizmi?")) return;
    setEmptyLoading(true);
    try {
      await trashApi.emptyTrash();
      fetchTrash(debouncedSearch);
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || "Savatni tozalashda xatolik");
    } finally {
      setEmptyLoading(false);
    }
  };

  return (
    <div>
      <Header
        title="Korzinka (Savat)"
        subtitle="O'chirilgan guruhlar va foydalanuvchilarni qaytarish yoki bazadan butunlay tozalash"
      />

      <div className="p-8 max-w-7xl mx-auto">
        {/* Top bar with tabs and empty trash button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
          {/* Tabs */}
          <div className="flex items-center gap-2 p-1.5 bg-[#18181b] border border-zinc-800 rounded-xl">
            <button
              onClick={() => setActiveTab('groups')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'groups'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              }`}
            >
              <Folder className="w-4 h-4" />
              O'chirilgan Guruhlar
              <span className="px-2 py-0.5 text-xs rounded-full bg-blue-950 text-blue-300 border border-blue-800/50">
                {groupTotal}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'users'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              }`}
            >
              <Users className="w-4 h-4" />
              O'chirilgan Foydalanuvchilar
              <span className="px-2 py-0.5 text-xs rounded-full bg-blue-950 text-blue-300 border border-blue-800/50">
                {userTotal}
              </span>
            </button>
          </div>

          {/* Action buttons */}
          <button
            onClick={handleEmptyTrash}
            disabled={emptyLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 text-xs font-bold transition-all disabled:opacity-50"
          >
            {emptyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {emptyLoading ? "Tozalanmoqda..." : "Savatni butunlay tozalash"}
          </button>
        </div>

        {/* Search Input */}
        <div className="relative max-w-md mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder={activeTab === 'groups' ? "Guruh nomi bo'yicha qidirish..." : "Ism yoki login bo'yicha qidirish..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#18181b] border border-zinc-800 text-white text-sm focus:border-blue-500 focus:outline-none placeholder:text-zinc-600"
          />
        </div>

        {/* Content Table */}
        <div className="bg-[#18181b] border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            {activeTab === 'groups' ? (
              <table className="w-full text-left text-sm text-zinc-300">
                <thead className="bg-[#09090b] text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800 font-bold">
                  <tr>
                    <th className="px-6 py-4">Guruh nomi</th>
                    <th className="px-6 py-4">O'qituvchisi</th>
                    <th className="px-6 py-4">O'quvchilar soni</th>
                    <th className="px-6 py-4">O'chirilgan sana</th>
                    <th className="px-6 py-4 text-right">Amallar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50 bg-[#09090b]">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                        Yuklanmoqda...
                      </td>
                    </tr>
                  ) : groups.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                        <Trash2 className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                        Savatda o'chirilgan guruhlar yo'q
                      </td>
                    </tr>
                  ) : (
                    groups.map((g) => (
                      <tr key={g.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="px-6 py-4 font-bold text-white flex items-center gap-2">
                          <Folder className="w-4 h-4 text-blue-400" />
                          {g.name}
                        </td>
                        <td className="px-6 py-4 text-zinc-400">
                          {g.teacher ? g.teacher.fullName : <span className="text-zinc-600 italic">Biriktirilmagan</span>}
                        </td>
                        <td className="px-6 py-4 text-zinc-300 font-mono">
                          {g.studentsCount || 0} nafar
                        </td>
                        <td className="px-6 py-4 text-zinc-500 text-xs">
                          {formatDateTime(g.createdAt)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleRestoreGroup(g.id, g.name)}
                              disabled={actionLoadingId === g.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-semibold transition-all disabled:opacity-50"
                              title="Guruhni faol holatga qaytarish"
                            >
                              {actionLoadingId === g.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                              Qaytarish
                            </button>
                            <button
                              onClick={() => handlePermanentDeleteGroup(g.id, g.name)}
                              disabled={actionLoadingId === g.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold transition-all disabled:opacity-50"
                              title="Bazadan butunlay o'chirish"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Butunlay o'chirish
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left text-sm text-zinc-300">
                <thead className="bg-[#09090b] text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800 font-bold">
                  <tr>
                    <th className="px-6 py-4">F.I.Sh.</th>
                    <th className="px-6 py-4">Login</th>
                    <th className="px-6 py-4">Rol</th>
                    <th className="px-6 py-4">O'chirilgan sana</th>
                    <th className="px-6 py-4 text-right">Amallar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50 bg-[#09090b]">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                        Yuklanmoqda...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                        <Trash2 className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                        Savatda o'chirilgan foydalanuvchilar yo'q
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="px-6 py-4 font-medium text-white flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-300 flex items-center justify-center font-bold text-xs border border-zinc-700">
                            {u.fullName?.charAt(0) || '?'}
                          </div>
                          {u.fullName}
                        </td>
                        <td className="px-6 py-4 font-mono text-blue-400">
                          {u.login}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-400 border border-zinc-700">
                            {u.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-zinc-500 text-xs">
                          {formatDateTime(u.createdAt)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleRestoreUser(u.id, u.fullName)}
                              disabled={actionLoadingId === u.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-semibold transition-all disabled:opacity-50"
                              title="Foydalanuvchini faol holatga qaytarish"
                            >
                              {actionLoadingId === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                              Qaytarish
                            </button>
                            <button
                              onClick={() => handlePermanentDeleteUser(u.id, u.fullName)}
                              disabled={actionLoadingId === u.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold transition-all disabled:opacity-50"
                              title="Bazadan butunlay o'chirish"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Butunlay o'chirish
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
