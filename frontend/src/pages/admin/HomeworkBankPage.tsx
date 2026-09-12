import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import { homeworkApi, lessonsApi } from '@/api';
import {
  Loader2,
  Plus,
  Trash2,
  Pencil,
  X,
  Link2,
  FileText,
  FolderOpen,
  BookOpen,
  EyeOff,
  Save,
} from 'lucide-react';

interface Folder {
  id: string;
  name: string;
  icon?: string;
  children?: Folder[];
}

interface LessonItem {
  id: string;
  title: string;
}

interface Homework {
  id: string;
  lessonItemId: string;
  title: string;
  description: string | null;
  contentType: string;
  content: string;
  isActive: boolean;
  lessonItem?: { id: string; title: string };
  _count?: { assignments: number };
}

const EMPTY = {
  title: '',
  description: '',
  contentType: 'text' as 'text' | 'link',
  content: '',
};

export default function HomeworkBankPage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderId, setFolderId] = useState<string>('');
  const [items, setItems] = useState<LessonItem[]>([]);
  const [itemId, setItemId] = useState<string>('');
  const [homeworks, setHomeworks] = useState<Homework[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Homework | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [showForm, setShowForm] = useState(false);

  const fail = (e: any, fallback: string) =>
    setError(e?.response?.data?.error?.message || e?.response?.data?.message || fallback);

  // Papkalarni yuklash (daraxtni tekis ro'yxatga aylantiramiz)
  useEffect(() => {
    (async () => {
      try {
        const res = await lessonsApi.getFolderTree();
        const flat: Folder[] = [];
        const walk = (list: Folder[], depth = 0) => {
          for (const f of list) {
            flat.push({ ...f, name: `${'— '.repeat(depth)}${f.name}` });
            if (f.children?.length) walk(f.children, depth + 1);
          }
        };
        walk(res.data.data || []);
        setFolders(flat);
      } catch (e: any) {
        fail(e, 'Papkalarni olishda xatolik');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Papka tanlanganda materiallar
  useEffect(() => {
    if (!folderId) {
      setItems([]);
      setItemId('');
      setHomeworks([]);
      return;
    }
    (async () => {
      try {
        const res = await lessonsApi.getItems(folderId);
        setItems(res.data.data || []);
        setItemId('');
        setHomeworks([]);
      } catch (e: any) {
        fail(e, 'Materiallarni olishda xatolik');
      }
    })();
  }, [folderId]);

  const loadHomeworks = async (lessonItemId: string) => {
    if (!lessonItemId) return setHomeworks([]);
    try {
      const res = await homeworkApi.listBank({ lessonItemId });
      setHomeworks(res.data.data || []);
    } catch (e: any) {
      fail(e, 'Vazifalarni olishda xatolik');
    }
  };

  useEffect(() => {
    loadHomeworks(itemId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY });
    setShowForm(true);
  };

  const openEdit = (hw: Homework) => {
    setEditing(hw);
    setForm({
      title: hw.title,
      description: hw.description || '',
      contentType: hw.contentType === 'link' ? 'link' : 'text',
      content: hw.content,
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      setError("Sarlavha va vazifa mazmuni bo'sh bo'lmasligi kerak");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        await homeworkApi.updateBank(editing.id, {
          title: form.title,
          description: form.description || null,
          contentType: form.contentType,
          content: form.content,
        });
      } else {
        await homeworkApi.createBank({
          lessonItemId: itemId,
          title: form.title,
          description: form.description || undefined,
          contentType: form.contentType,
          content: form.content,
        });
      }
      setShowForm(false);
      await loadHomeworks(itemId);
    } catch (e: any) {
      fail(e, 'Saqlashda xatolik');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (hw: Homework) => {
    const used = (hw._count?.assignments ?? 0) > 0;
    const msg = used
      ? `"${hw.title}" guruhlarga berilgan — o'chirilmaydi, yashiriladi. Davom etasizmi?`
      : `"${hw.title}" o'chirilsinmi?`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      await homeworkApi.deleteBank(hw.id);
      await loadHomeworks(itemId);
    } catch (e: any) {
      fail(e, "O'chirishda xatolik");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (hw: Homework) => {
    setBusy(true);
    try {
      await homeworkApi.updateBank(hw.id, { isActive: !hw.isActive });
      await loadHomeworks(itemId);
    } catch (e: any) {
      fail(e, 'Xatolik');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header
        title="Uyga vazifa bankasi"
        subtitle="Darsliklarga vazifa biriktiring — o'qituvchi shu ro'yxatdan tanlab guruhiga beradi"
      />

      <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-5">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-300 flex items-start justify-between gap-3">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-300/70 hover:text-red-200 shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* Tanlash */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 grid sm:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-400 mb-2">
                  <FolderOpen className="w-3.5 h-3.5" /> Papka
                </label>
                <select
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white"
                >
                  <option value="">— tanlang —</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-400 mb-2">
                  <BookOpen className="w-3.5 h-3.5" /> Darslik materiali
                </label>
                <select
                  value={itemId}
                  onChange={(e) => setItemId(e.target.value)}
                  disabled={!folderId}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white disabled:opacity-40"
                >
                  <option value="">{folderId ? '— tanlang —' : 'avval papkani tanlang'}</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Vazifalar */}
            {itemId && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800">
                  <h3 className="text-white font-bold text-sm">
                    Vazifalar {homeworks.length > 0 && <span className="text-zinc-500">({homeworks.length})</span>}
                  </h3>
                  <button
                    onClick={openNew}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Qo'shish
                  </button>
                </div>

                {homeworks.length === 0 ? (
                  <p className="text-zinc-500 text-sm text-center py-10">
                    Bu darslikka hali vazifa qo'shilmagan
                  </p>
                ) : (
                  <div className="divide-y divide-zinc-900">
                    {homeworks.map((hw) => (
                      <div key={hw.id} className="px-5 py-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-white text-sm font-semibold flex items-center gap-2 flex-wrap">
                              {hw.title}
                              {!hw.isActive && (
                                <span className="text-[10px] text-zinc-500 border border-zinc-700 rounded px-1.5 py-0.5">
                                  yashirilgan
                                </span>
                              )}
                              {(hw._count?.assignments ?? 0) > 0 && (
                                <span className="text-[10px] text-emerald-400/80 border border-emerald-500/20 rounded px-1.5 py-0.5">
                                  {hw._count!.assignments} marta berilgan
                                </span>
                              )}
                            </p>
                            {hw.description && (
                              <p className="text-zinc-500 text-xs mt-0.5">{hw.description}</p>
                            )}
                            <p className="text-zinc-400 text-xs mt-1.5 flex items-start gap-1.5">
                              {hw.contentType === 'link' ? (
                                <Link2 className="w-3 h-3 shrink-0 mt-0.5" />
                              ) : (
                                <FileText className="w-3 h-3 shrink-0 mt-0.5" />
                              )}
                              <span className="break-all line-clamp-2">{hw.content}</span>
                            </p>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => toggleActive(hw)}
                              disabled={busy}
                              title={hw.isActive ? 'Yashirish' : "Ko'rsatish"}
                              className="p-1.5 rounded-lg border border-zinc-800 text-zinc-500 hover:text-white disabled:opacity-40"
                            >
                              <EyeOff className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openEdit(hw)}
                              disabled={busy}
                              title="Tahrirlash"
                              className="p-1.5 rounded-lg border border-zinc-800 text-zinc-500 hover:text-blue-400 disabled:opacity-40"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => remove(hw)}
                              disabled={busy}
                              title="O'chirish"
                              className="p-1.5 rounded-lg border border-zinc-800 text-zinc-500 hover:text-red-400 disabled:opacity-40"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Forma */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <h2 className="text-white font-bold">
                {editing ? 'Vazifani tahrirlash' : 'Yangi uyga vazifa'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Sarlavha</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value.slice(0, 200) })}
                  placeholder="Masalan: 3-dars uyga vazifasi — tsikllar"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                  Ko'rsatma <span className="text-zinc-600">(ixtiyoriy)</span>
                </label>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value.slice(0, 1000) })}
                  placeholder="Qisqacha nima qilish kerakligi"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Vazifa turi</label>
                <div className="flex gap-2">
                  {(['text', 'link'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setForm({ ...form, contentType: t })}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                        form.contentType === t
                          ? 'bg-blue-600/15 border-blue-600 text-white'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {t === 'text' ? <FileText className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                      {t === 'text' ? 'Matn' : 'Havola'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                  {form.contentType === 'link' ? 'Havola' : 'Vazifa matni'}
                </label>
                {form.contentType === 'link' ? (
                  <input
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white"
                  />
                ) : (
                  <textarea
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                    rows={6}
                    placeholder="Vazifa matnini yozing..."
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white resize-none"
                  />
                )}
              </div>

              <button
                onClick={save}
                disabled={busy}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Saqlash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
