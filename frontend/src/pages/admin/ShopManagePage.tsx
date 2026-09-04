import { useEffect, useRef, useState } from 'react';
import Header from '@/components/layout/Header';
import { shopApi } from '@/api';
import { Loader2, Plus, Gift, Pencil, Trash2, X, Coins } from 'lucide-react';

interface ShopItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  stock: number | null;
  isActive: boolean;
}

const API_BASE = (import.meta.env.VITE_API_URL || '').replace('/api', '');

const emptyForm = { name: '', description: '', price: '', stock: '' };

export default function ShopManagePage() {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ShopItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await shopApi.getItems();
      setItems(res.data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (item: ShopItem) => {
    setEditing(item);
    setForm({ name: item.name, description: item.description || '', price: String(item.price), stock: item.stock === null ? '' : String(item.stock) });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.price) return;
    setSaving(true);
    try {
      const image = fileRef.current?.files?.[0];
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        price: Number(form.price),
        stock: form.stock === '' ? null : Number(form.stock),
        image,
      };
      if (editing) {
        await shopApi.updateItem(editing.id, payload);
      } else {
        await shopApi.createItem(payload);
      }
      setShowModal(false);
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Saqlashda xatolik');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item: ShopItem) => {
    try {
      await shopApi.updateItem(item.id, { isActive: !item.isActive });
      await load();
    } catch {
      alert('Holatni o\'zgartirishda xatolik');
    }
  };

  const handleDelete = async (item: ShopItem) => {
    const ok = window.confirm(`"${item.name}" o'chirilsinmi?`);
    if (!ok) return;
    try {
      await shopApi.deleteItem(item.id);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || "O'chirishda xatolik");
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b]">
      <Header title="Do'kon boshqaruvi" subtitle="Sovg'a/tovarlarni qo'shish va tahrirlash" />

      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex justify-end">
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold"
          >
            <Plus className="w-4 h-4" /> Yangi tovar
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-zinc-500">
            <Gift className="w-10 h-10 mx-auto mb-3 opacity-50" />
            Hali tovar qo'shilmagan.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((item) => (
              <div key={item.id} className={`bg-[#18181b] border rounded-xl overflow-hidden flex flex-col ${item.isActive ? 'border-zinc-800' : 'border-zinc-800 opacity-50'}`}>
                <div className="h-36 bg-zinc-900 flex items-center justify-center relative">
                  {item.imageUrl ? (
                    <img src={`${API_BASE}${item.imageUrl}`} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <Gift className="w-8 h-8 text-zinc-700" />
                  )}
                  {!item.isActive && (
                    <span className="absolute top-2 right-2 text-[10px] font-bold bg-zinc-800 text-zinc-400 px-2 py-1 rounded-md">NOFAOL</span>
                  )}
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="text-white font-bold text-sm mb-1">{item.name}</h3>
                  {item.description && <p className="text-zinc-500 text-xs mb-2 line-clamp-2">{item.description}</p>}
                  <div className="flex items-center justify-between mt-auto pt-2">
                    <span className="flex items-center gap-1 text-amber-400 font-bold text-sm">
                      <Coins className="w-4 h-4" /> {item.price}
                    </span>
                    <span className="text-xs text-zinc-500">{item.stock === null ? 'Cheksiz' : `${item.stock} dona`}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <button onClick={() => openEdit(item)} className="flex-1 flex items-center justify-center gap-1.5 border border-zinc-700 hover:border-zinc-600 text-zinc-300 py-2 rounded-lg text-xs font-semibold">
                      <Pencil className="w-3.5 h-3.5" /> Tahrirlash
                    </button>
                    <button onClick={() => handleToggleActive(item)} className="px-3 py-2 border border-zinc-700 hover:border-zinc-600 text-zinc-300 rounded-lg text-xs font-semibold">
                      {item.isActive ? 'Yashirish' : 'Faollashtirish'}
                    </button>
                    <button onClick={() => handleDelete(item)} className="px-3 py-2 border border-red-500/30 hover:border-red-500/60 text-red-400 rounded-lg">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#18181b] border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">{editing ? 'Tovarni tahrirlash' : 'Yangi tovar'}</h2>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Nomi</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full bg-[#0f0f11] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white"
                  placeholder="Masalan: Sirka ruchka"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Tavsif (ixtiyoriy)</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full bg-[#0f0f11] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Narxi (coin)</label>
                  <input
                    type="number"
                    min={1}
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    className="w-full bg-[#0f0f11] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Miqdori (ixtiyoriy)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.stock}
                    onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                    placeholder="Cheksiz"
                    className="w-full bg-[#0f0f11] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Rasm {editing && '(ixtiyoriy — bo\'sh qoldirsangiz eskisi qoladi)'}</label>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="w-full text-xs text-zinc-400" />
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim() || !form.price}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl font-semibold text-sm"
            >
              {saving ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
