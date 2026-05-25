import { useState, useEffect, useCallback } from 'react';
import api from '@/api/client';
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronRight, Save, X,
  ClipboardList, Loader2, AlertCircle, CheckCircle2,
} from 'lucide-react';

const ALL_ROLES = [
  { value: 'filial_rahbari',     label: 'Filial Rahbari' },
  { value: 'teacher',            label: 'Mentor (Teacher)' },
  { value: 'robototexnika_ustoz',label: 'Robototexnika Ustoz' },
  { value: 'assistant',          label: 'Assistant' },
  { value: 'moliya_rahbari',     label: 'Moliya Rahbari' },
  { value: 'sotuv_operatori',    label: 'Sotuv Menejeri' },
  { value: 'kassir',             label: 'Kassir' },
  { value: 'call_operatori',     label: 'Call Operatori' },
  { value: 'farrosh',            label: 'Farrosh' },
  { value: 'nazoratchi',         label: 'Nazoratchi' },
  { value: 'hr_rahbari',         label: 'HR Menejeri' },
  { value: 'administrator',      label: 'Administrator' },
];

interface ChecklistItem {
  id: string;
  role: string;
  section: string | null;
  category: string;
  description: string | null;
  score: number;
  order: number;
}

interface FormState {
  role: string;
  section: string;
  category: string;
  description: string;
  score: number;
  order: string;
}

const emptyForm = (): FormState => ({
  role: ALL_ROLES[0].value,
  section: '',
  category: '',
  description: '',
  score: 1,
  order: '',
});

function Toast({ msg, type, onHide }: { msg: string; type: 'success' | 'error'; onHide: () => void }) {
  useEffect(() => {
    const t = setTimeout(onHide, 3000);
    return () => clearTimeout(t);
  }, [onHide]);

  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border backdrop-blur-sm transition-all
      ${type === 'success'
        ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300'
        : 'bg-red-950/90 border-red-500/30 text-red-300'}`}>
      {type === 'success'
        ? <CheckCircle2 className="w-4 h-4 shrink-0" />
        : <AlertCircle className="w-4 h-4 shrink-0" />}
      <span className="text-sm font-medium">{msg}</span>
    </div>
  );
}

function ItemForm({
  initial, onSave, onCancel, saving, roleFixed,
}: {
  initial: FormState;
  onSave: (f: FormState) => void;
  onCancel: () => void;
  saving: boolean;
  roleFixed?: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const set = (k: keyof FormState, v: string | number) => setForm(p => ({ ...p, [k]: v }));

  // Collect existing sections for current role from parent — passed via initial.section as hint
  return (
    <div className="bg-zinc-900/80 border border-zinc-700 rounded-2xl p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Role */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Rol *</label>
          <select
            value={form.role}
            disabled={roleFixed}
            onChange={e => set('role', e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
          >
            {ALL_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        {/* Section */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Bo'lim (Section)</label>
          <input
            value={form.section}
            onChange={e => set('section', e.target.value)}
            placeholder="Masalan: 1. ISHGA TAYYORGARLIK"
            className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 placeholder:text-zinc-600"
          />
        </div>
      </div>

      {/* Category */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Kategoriya (sarlavha) *</label>
        <input
          value={form.category}
          onChange={e => set('category', e.target.value)}
          placeholder="Masalan: Shaxsiy ko'rinish va tayyorgarlik"
          className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 placeholder:text-zinc-600"
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Tavsif (ixtiyoriy)</label>
        <textarea
          value={form.description}
          onChange={e => set('description', e.target.value)}
          rows={2}
          placeholder="Qo'shimcha izoh, nima tekshirilishi kerak..."
          className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 placeholder:text-zinc-600 resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Score */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Ball</label>
          <input
            type="number" min={1} max={100}
            value={form.score}
            onChange={e => set('score', Number(e.target.value))}
            className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>
        {/* Order */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Tartib raqam</label>
          <input
            type="number" min={1}
            value={form.order}
            onChange={e => set('order', e.target.value)}
            placeholder="Avtomatik"
            className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 placeholder:text-zinc-600"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
          Bekor qilish
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.category.trim()}
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Saqlash
        </button>
      </div>
    </div>
  );
}

export default function ChecklistManagePage() {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<string>('');
  const [expandedRoles, setExpandedRoles] = useState<Record<string, boolean>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [addFormInitial, setAddFormInitial] = useState<FormState>(emptyForm());
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
  };

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/checklist/manage/items' + (filterRole ? `?role=${filterRole}` : ''));
      setItems(res.data.data);
    } catch {
      showToast('Yuklab bo\'lishda xato', 'error');
    } finally {
      setLoading(false);
    }
  }, [filterRole]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Group items by role then section
  const grouped: Record<string, Record<string, ChecklistItem[]>> = {};
  for (const item of items) {
    if (!grouped[item.role]) grouped[item.role] = {};
    const sec = item.section || 'Umumiy';
    if (!grouped[item.role][sec]) grouped[item.role][sec] = [];
    grouped[item.role][sec].push(item);
  }

  const toggleRole = (role: string) => {
    setExpandedRoles(p => ({ ...p, [role]: !p[role] }));
  };

  const handleAdd = async (form: FormState) => {
    setSaving(true);
    try {
      await api.post('/checklist/manage/items', {
        role: form.role,
        section: form.section.trim() || null,
        category: form.category.trim(),
        description: form.description.trim() || null,
        score: form.score,
        order: form.order ? Number(form.order) : undefined,
      });
      showToast('Checklist qo\'shildi!');
      setShowAddForm(false);
      setExpandedRoles(p => ({ ...p, [form.role]: true }));
      await fetchItems();
    } catch {
      showToast('Qo\'shishda xato yuz berdi', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (form: FormState) => {
    if (!editId) return;
    setSaving(true);
    try {
      await api.put(`/checklist/manage/items/${editId}`, {
        section: form.section.trim() || null,
        category: form.category.trim(),
        description: form.description.trim() || null,
        score: form.score,
        order: form.order ? Number(form.order) : undefined,
      });
      showToast('O\'zgarishlar saqlandi!');
      setEditId(null);
      await fetchItems();
    } catch {
      showToast('Saqlashda xato yuz berdi', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await api.delete(`/checklist/manage/items/${id}`);
      showToast('O\'chirildi!');
      setConfirmDelete(null);
      await fetchItems();
    } catch {
      showToast('O\'chirishda xato', 'error');
    } finally {
      setDeleting(null);
    }
  };

  const startEdit = (item: ChecklistItem) => {
    setEditId(item.id);
    setEditForm({
      role: item.role,
      section: item.section || '',
      category: item.category,
      description: item.description || '',
      score: item.score,
      order: String(item.order),
    });
    setShowAddForm(false);
  };

  const openAddForRole = (role: string, section?: string) => {
    setAddFormInitial({ ...emptyForm(), role, section: section || '' });
    setShowAddForm(true);
    setEditId(null);
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const roleLabel = (r: string) => ALL_ROLES.find(x => x.value === r)?.label ?? r;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {toast && <Toast msg={toast.msg} type={toast.type} onHide={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-blue-400" />
            Checklist Boshqaruvi
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Rollar bo'yicha vazifalarni qo'shish, tahrirlash va o'chirish</p>
        </div>
        <button
          onClick={() => { setShowAddForm(v => !v); setEditId(null); setAddFormInitial(emptyForm()); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
        >
          {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAddForm ? 'Yopish' : 'Yangi qo\'shish'}
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 mb-3 uppercase tracking-wider">Yangi vazifa qo'shish</h2>
          <ItemForm
            initial={addFormInitial}
            onSave={handleAdd}
            onCancel={() => setShowAddForm(false)}
            saving={saving}
          />
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Rol filtri:</span>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterRole('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterRole === '' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
          >
            Barchasi
          </button>
          {ALL_ROLES.map(r => (
            <button
              key={r.value}
              onClick={() => setFilterRole(r.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterRole === r.value ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([role, sections]) => {
            const isOpen = expandedRoles[role] !== false; // default open
            const totalItems = Object.values(sections).reduce((s, arr) => s + arr.length, 0);
            return (
              <div key={role} className="bg-[#18181b] border border-zinc-800 rounded-2xl overflow-hidden">
                {/* Role header */}
                <div
                  className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-zinc-800/40 transition-colors"
                  onClick={() => toggleRole(role)}
                >
                  <div className="w-5 shrink-0">
                    {isOpen
                      ? <ChevronDown className="w-4 h-4 text-zinc-500" />
                      : <ChevronRight className="w-4 h-4 text-zinc-500" />}
                  </div>
                  <div className="flex-1">
                    <span className="text-base font-bold text-white">{roleLabel(role)}</span>
                    <span className="ml-2 text-xs text-zinc-500">{totalItems} ta vazifa</span>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); openAddForRole(role); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/40 text-blue-400 hover:text-blue-300 text-xs font-semibold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Qo'shish
                  </button>
                </div>

                {/* Sections & items */}
                {isOpen && (
                  <div className="border-t border-zinc-800">
                    {Object.entries(sections).map(([section, sectionItems]) => (
                      <div key={section}>
                        {/* Section header */}
                        <div className="flex items-center gap-2 px-5 py-2 bg-zinc-900/60">
                          <div className="h-px flex-1 bg-zinc-800" />
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-2 shrink-0">{section}</span>
                          <div className="h-px flex-1 bg-zinc-800" />
                          <button
                            onClick={() => openAddForRole(role, section !== 'Umumiy' ? section : '')}
                            className="ml-2 text-[10px] text-zinc-600 hover:text-blue-400 transition-colors flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> bu bo'limga qo'shish
                          </button>
                        </div>

                        {/* Items */}
                        {sectionItems.map(item => (
                          <div key={item.id}>
                            {editId === item.id ? (
                              <div className="p-4 border-t border-zinc-800/50">
                                <ItemForm
                                  initial={editForm}
                                  onSave={handleEdit}
                                  onCancel={() => setEditId(null)}
                                  saving={saving}
                                  roleFixed
                                />
                              </div>
                            ) : (
                              <div className="flex items-start gap-3 px-5 py-3.5 border-t border-zinc-800/50 hover:bg-zinc-800/20 transition-colors group">
                                <div className="w-6 h-6 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 mt-0.5">
                                  <span className="text-[10px] font-bold text-zinc-500">{item.order}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-white">{item.category}</p>
                                  {item.description && (
                                    <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{item.description}</p>
                                  )}
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] text-amber-400 font-medium">⭐ {item.score} ball</span>
                                  </div>
                                </div>
                                {/* Actions */}
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                  <button
                                    onClick={() => startEdit(item)}
                                    className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-blue-600 border border-zinc-700 hover:border-blue-500 flex items-center justify-center text-zinc-500 hover:text-white transition-all"
                                    title="Tahrirlash"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setConfirmDelete(item.id)}
                                    className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-red-600 border border-zinc-700 hover:border-red-500 flex items-center justify-center text-zinc-500 hover:text-white transition-all"
                                    title="O'chirish"
                                  >
                                    {deleting === item.id
                                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      : <Trash2 className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {Object.keys(grouped).length === 0 && (
            <div className="text-center py-16 text-zinc-600">
              <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Checklist topilmadi</p>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirm Modal */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="bg-[#111113] border border-zinc-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">O'chirishni tasdiqlang</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Bu vazifa o'chiriladi va xodimlarga ko'rinmaydi</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold transition-colors"
              >
                Bekor qilish
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={!!deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                O'chirish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
