import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { normativesApi, categoriesApi } from '@/api';
import Header from '@/components/layout/Header';
import { Plus, Pencil, Trash2, Link as LinkIcon, Search, Check, AlertCircle } from 'lucide-react';

export default function NormativesPage() {
  const { user } = useAuthStore();
  const [normatives, setNormatives] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  
  // Category Modal
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingNormative, setEditingNormative] = useState<any>(null);
  const [formData, setFormData] = useState({
    taskNumber: 1,
    title: '',
    description: '',
    timeLimit: '',
    url: '',
    maxScore: 40,
    categoryId: ''
  });

  const fetchCategories = async () => {
    try {
      const res = await categoriesApi.getAll();
      setCategories(res.data.data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchNormatives = async () => {
    setLoading(true);
    try {
      const res = await normativesApi.getAll(1, 100);
      setNormatives(res.data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNormatives();
    fetchCategories();
  }, []);

  const handleOpenModal = (norm: any = null) => {
    if (norm) {
      setEditingNormative(norm);
      setFormData({
        taskNumber: norm.taskNumber,
        title: norm.title,
        description: norm.description || '',
        timeLimit: norm.timeLimit ? norm.timeLimit.toString() : '',
        url: norm.url || '',
        maxScore: norm.maxScore || 40,
        categoryId: norm.categoryId || ''
      });
    } else {
      setEditingNormative(null);
      let nextNum = 1;
      if (normatives.length > 0) {
        nextNum = Math.max(...normatives.map(n => n.taskNumber)) + 1;
      }
        
      setFormData({
        taskNumber: nextNum,
        title: '',
        description: '',
        timeLimit: '',
        url: '',
        maxScore: 40,
        categoryId: formData.categoryId || (selectedCategoryId !== 'all' ? selectedCategoryId : '')
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        taskNumber: Number(formData.taskNumber),
        title: formData.title,
        maxScore: Number(formData.maxScore),
        categoryId: formData.categoryId || null
      };
      
      if (formData.description) payload.description = formData.description;
      if (formData.timeLimit) payload.timeLimit = Number(formData.timeLimit);
      if (formData.url) {
        let finalUrl = formData.url.trim();
        if (finalUrl && !/^https?:\/\//i.test(finalUrl)) {
          finalUrl = 'https://' + finalUrl;
        }
        payload.url = finalUrl;
      }

      if (editingNormative) {
        await normativesApi.update(editingNormative.id, payload);
      } else {
        await normativesApi.create(payload);
      }
      setShowModal(false);
      fetchNormatives();
    } catch (error: any) {
      console.error(error);
      alert('Xatolik: ' + (error.response?.data?.error?.message || 'Qandaydir muammo yuz berdi'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Rostdan ham o\'chirmoqchimisiz?')) return;
    try {
      await normativesApi.delete(id);
      fetchNormatives();
    } catch (error) {
      console.error(error);
      alert('O\'chirishda xatolik yuz berdi');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await categoriesApi.create({ name: newCategoryName });
      setNewCategoryName('');
      setShowCategoryModal(false);
      fetchCategories();
    } catch (error: any) {
      alert('Xatolik: ' + (error.response?.data?.error?.message || 'Qandaydir muammo yuz berdi'));
    }
  };

  const filteredNormatives = normatives.filter(n => {
    const matchSearch = n.title.toLowerCase().includes(search.toLowerCase()) || 
      (n.description && n.description.toLowerCase().includes(search.toLowerCase())) ||
      n.taskNumber.toString().includes(search);
    const matchCategory = selectedCategoryId === 'all' || n.categoryId === selectedCategoryId;
    return matchSearch && matchCategory;
  });

  return (
    <div>
      <Header title="Normativlar" subtitle="Barcha normativ (vazifa)larni boshqarish" />

      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Normativlarni qidirish..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#18181b] border border-zinc-800 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="w-full sm:w-auto">
             <select
               value={selectedCategoryId}
               onChange={(e) => setSelectedCategoryId(e.target.value)}
               className="w-full px-4 py-2 rounded-lg bg-[#18181b] border border-zinc-800 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
             >
               <option value="all">Barcha kategoriyalar</option>
               {categories.map(c => (
                 <option key={c.id} value={c.id}>{c.name}</option>
               ))}
             </select>
          </div>
          
          {user?.role === 'admin' && (
            <div className="flex w-full sm:w-auto gap-2">
              <button 
                onClick={() => setShowCategoryModal(true)}
                className="w-full sm:w-auto bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                Kategoriya qo'shish
              </button>
              <button 
                onClick={() => handleOpenModal()}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Yangi qo'shish
              </button>
            </div>
          )}
        </div>

        <div className="bg-[#18181b] border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-[#09090b] text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800 font-bold">
                <tr>
                  <th className="px-6 py-4 w-16 text-center">N</th>
                  <th className="px-6 py-4">Qaysi funksiya</th>
                  <th className="px-6 py-4">Nima qila olsin</th>
                  <th className="px-6 py-4 text-center">Vaqti</th>
                  <th className="px-6 py-4 text-center">Url</th>
                  {user?.role === 'admin' && <th className="px-6 py-4 text-right">Amallar</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">Yuklanmoqda...</td>
                  </tr>
                ) : filteredNormatives.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                      Normativlar topilmadi
                    </td>
                  </tr>
                ) : (
                  filteredNormatives.sort((a, b) => a.taskNumber - b.taskNumber).map((n) => (
                    <tr key={n.id} className="hover:bg-zinc-800/30 transition-colors group">
                      <td className="px-6 py-4 font-bold text-white text-center">
                        <div className="w-8 h-8 rounded bg-[#09090b] border border-zinc-800 flex items-center justify-center mx-auto text-blue-500">
                          {n.taskNumber}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-white">{n.title}</td>
                      <td className="px-6 py-4">
                        <div className="text-zinc-400 line-clamp-2 max-w-sm">
                          {n.description || <span className="text-zinc-600 italic">Kiritilmagan</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {n.timeLimit ? (
                          <span className="px-2 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded font-mono text-xs">
                            {n.timeLimit} sek
                          </span>
                        ) : (
                          <span className="text-zinc-600">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {n.url ? (
                          <a 
                            href={n.url} 
                            target="_blank" 
                            rel="noreferrer"
                            className="inline-flex items-center justify-center p-2 rounded bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors"
                            title={n.url}
                          >
                            <LinkIcon className="w-4 h-4" />
                          </a>
                        ) : (
                          <span className="text-zinc-600">-</span>
                        )}
                      </td>
                      {user?.role === 'admin' && (
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleOpenModal(n)}
                              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                              title="Tahrirlash"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(n.id)}
                              className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors"
                              title="O'chirish"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#09090b]/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#18181b] rounded-2xl w-full max-w-2xl p-6 shadow-2xl border border-zinc-800 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">
                {editingNormative ? 'Normativni tahrirlash' : 'Yangi normativ qoshish'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 pr-2 custom-scrollbar">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 block">
                  Kategoriya (Yo'nalish)
                </label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({...formData, categoryId: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-lg bg-[#09090b] border border-zinc-800 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  required
                >
                  <option value="">Kategoriyani tanlang</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 block">
                    Tartib raqami (N)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.taskNumber}
                    onChange={(e) => setFormData({...formData, taskNumber: parseInt(e.target.value) || 1})}
                    className="w-full px-4 py-2.5 rounded-lg bg-[#09090b] border border-zinc-800 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
                    required
                  />
                </div>
                
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 block">
                    Maksimal Ball
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxScore}
                    onChange={(e) => setFormData({...formData, maxScore: parseInt(e.target.value) || 40})}
                    className="w-full px-4 py-2.5 rounded-lg bg-[#09090b] border border-zinc-800 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 block">
                  Qaysi funksiya (Sarlavha)
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-lg bg-[#09090b] border border-zinc-800 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  required
                  placeholder="Masalan: Tez yozish"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 block">
                  Nima qila olsin (Ta'rif)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-lg bg-[#09090b] border border-zinc-800 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-h-[100px] resize-y"
                  placeholder="Masalan: Monkeytype saytiga kirib tilni ingliz tilida vaqtni 30 sekundlik intervalga qo'yib yozish..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 block">
                    Vaqti (Sekundlarda)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      value={formData.timeLimit}
                      onChange={(e) => setFormData({...formData, timeLimit: e.target.value})}
                      className="w-full pl-4 pr-12 py-2.5 rounded-lg bg-[#09090b] border border-zinc-800 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
                      placeholder="30"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-medium">sek</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 block">
                    Manba URL
                  </label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({...formData, url: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-lg bg-[#09090b] border border-zinc-800 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="https://monkeytype.com"
                  />
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center gap-3">
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

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#09090b]/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#18181b] rounded-2xl w-full max-w-md p-6 shadow-2xl border border-zinc-800">
            <h2 className="text-xl font-bold text-white mb-6">Yangi kategoriya qo'shish</h2>
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 block">
                  Kategoriya nomi
                </label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-[#09090b] border border-zinc-800 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="Masalan: Foundation, Frontend..."
                  required
                />
              </div>
              <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
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
