import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { lessonsApi } from '@/api';
import ConfirmModal from '@/components/shared/ConfirmModal';
import {
  FolderOpen, Plus, Trash2, Edit3, ExternalLink, Users, X,
  BookOpen, Link, FileText, Video, ChevronRight, Check, Save,
  FolderPlus, Lock
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────
interface LessonFolder {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  order: number;
  _count?: { items: number; access?: number };
}

interface LessonItem {
  id: string;
  folderId: string;
  title: string;
  url: string;
  type: string;
  order: number;
  createdAt: string;
}

interface Teacher {
  id: string;
  fullName: string;
  login: string;
  avatarUrl: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const ITEM_TYPES = [
  { value: 'canva', label: 'Canva', icon: '🎨', color: 'text-purple-400' },
  { value: 'pptx', label: 'PowerPoint', icon: '📊', color: 'text-orange-400' },
  { value: 'video', label: 'Video', icon: '🎬', color: 'text-red-400' },
  { value: 'link', label: 'Havola', icon: '🔗', color: 'text-blue-400' },
];

const FOLDER_ICONS = ['📁', '🎓', '💻', '🌐', '⚛️', '🖥️', '🔧', '📚', '🚀', '🎯'];

function typeIcon(type: string) {
  const t = ITEM_TYPES.find(t => t.value === type);
  return t ? `${t.icon}` : '🔗';
}
function typeColor(type: string) {
  const t = ITEM_TYPES.find(t => t.value === type);
  return t?.color || 'text-blue-400';
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function LessonsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'administrator' || user?.role === 'filial_rahbari';

  // State
  const [folders, setFolders] = useState<LessonFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<LessonFolder | null>(null);
  const [items, setItems] = useState<LessonItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);

  // Admin modals
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [editingFolder, setEditingFolder] = useState<LessonFolder | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItem, setEditingItem] = useState<LessonItem | null>(null);
  const [showAccess, setShowAccess] = useState(false);

  // Forms
  const [folderForm, setFolderForm] = useState({ name: '', description: '', icon: '📁' });
  const [itemForm, setItemForm] = useState({ title: '', url: '', type: 'canva' });

  // Access management
  const [allTeachers, setAllTeachers] = useState<Teacher[]>([]);
  const [accessList, setAccessList] = useState<string[]>([]);
  const [accessSaving, setAccessSaving] = useState(false);

  // Delete confirm modal
  const [confirmDelete, setConfirmDelete] = useState<{
    type: 'folder' | 'item';
    target: LessonFolder | LessonItem;
    title: string;
    description: string;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ─── Data loading ────────────────────────────────────────────────────────
  useEffect(() => { loadFolders(); }, []);

  async function loadFolders() {
    setLoading(true);
    try {
      const res = await lessonsApi.getFolders();
      setFolders(res.data.data);
    } finally { setLoading(false); }
  }

  async function loadItems(folder: LessonFolder) {
    setSelectedFolder(folder);
    setItemsLoading(true);
    try {
      const res = await lessonsApi.getItems(folder.id);
      setItems(res.data.data);
    } finally { setItemsLoading(false); }
  }

  // ─── Folder CRUD ─────────────────────────────────────────────────────────
  async function saveFolder() {
    if (!folderForm.name.trim()) return;
    try {
      if (editingFolder) {
        await lessonsApi.updateFolder(editingFolder.id, folderForm);
      } else {
        await lessonsApi.createFolder({ ...folderForm, order: folders.length });
      }
      setShowCreateFolder(false);
      setEditingFolder(null);
      setFolderForm({ name: '', description: '', icon: '📁' });
      await loadFolders();
    } catch (e: any) { alert(e.response?.data?.error || 'Xatolik'); }
  }

  function requestDeleteFolder(folder: LessonFolder) {
    setConfirmDelete({
      type: 'folder',
      target: folder,
      title: `"${folder.name}" papkasini o'chirmoqchimisiz?`,
      description: "Ushbu papka va uning ichidagi barcha darsliklar butunlay o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi.",
    });
  }

  // ─── Item CRUD ───────────────────────────────────────────────────────────
  async function saveItem() {
    if (!itemForm.title.trim() || !itemForm.url.trim() || !selectedFolder) return;
    try {
      if (editingItem) {
        await lessonsApi.updateItem(editingItem.id, itemForm);
      } else {
        await lessonsApi.addItem(selectedFolder.id, { ...itemForm, order: items.length });
      }
      setShowAddItem(false);
      setEditingItem(null);
      setItemForm({ title: '', url: '', type: 'canva' });
      await loadItems(selectedFolder);
      await loadFolders();
    } catch (e: any) { alert(e.response?.data?.error || 'Xatolik'); }
  }

  function requestDeleteItem(item: LessonItem) {
    setConfirmDelete({
      type: 'item',
      target: item,
      title: `"${item.title}" darsligini o'chirmoqchimisiz?`,
      description: "Ushbu darslik havolasi platformadan o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi.",
    });
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    setDeleteLoading(true);
    try {
      if (confirmDelete.type === 'folder') {
        const folder = confirmDelete.target as LessonFolder;
        await lessonsApi.deleteFolder(folder.id);
        if (selectedFolder?.id === folder.id) {
          setSelectedFolder(null);
          setItems([]);
        }
        await loadFolders();
      } else {
        const item = confirmDelete.target as LessonItem;
        await lessonsApi.deleteItem(item.id);
        if (selectedFolder) {
          await loadItems(selectedFolder);
          await loadFolders();
        }
      }
      setConfirmDelete(null);
    } catch (e: any) {
      alert(e.response?.data?.error || "O'chirishda xatolik yuz berdi");
    } finally {
      setDeleteLoading(false);
    }
  }


  // ─── Access Management ───────────────────────────────────────────────────
  async function openAccess(folder: LessonFolder) {
    setShowAccess(true);
    try {
      const [teachersRes, accessRes] = await Promise.all([
        lessonsApi.getTeachers(),
        lessonsApi.getFolderAccess(folder.id),
      ]);
      setAllTeachers(teachersRes.data.data);
      setAccessList(accessRes.data.data.map((a: any) => a.teacherId));
    } catch (e: any) { alert('Xatolik'); }
  }

  async function saveAccess() {
    if (!selectedFolder) return;
    setAccessSaving(true);
    try {
      await lessonsApi.syncAccess(selectedFolder.id, accessList);
      setShowAccess(false);
      await loadFolders();
    } catch (e: any) { alert(e.response?.data?.error || 'Xatolik'); }
    finally { setAccessSaving(false); }
  }

  function toggleTeacher(id: string) {
    setAccessList(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="p-4 lg:p-6 min-h-screen bg-[#09090b]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-blue-400" />
            Darsliklar
          </h1>
          <p className="text-zinc-500 text-sm mt-0.5">
            {isAdmin ? 'Canva, PPTX va boshqa darslik linklarini boshqarish' : "Sizga biriktirilgan darsliklar"}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setFolderForm({ name: '', description: '', icon: '📁' }); setEditingFolder(null); setShowCreateFolder(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition text-sm"
          >
            <FolderPlus className="w-4 h-4" />
            Yangi papka
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left — Folder List */}
        <div className="lg:col-span-1 space-y-2">
          {loading ? (
            <div className="text-zinc-500 text-sm text-center py-8">Yuklanmoqda...</div>
          ) : folders.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
              <FolderOpen className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">
                {isAdmin ? "Hali papka yo'q. Yangi papka yarating." : "Sizga hali papka biriktirilmagan."}
              </p>
            </div>
          ) : (
            folders.map(folder => (
              <div
                key={folder.id}
                onClick={() => loadItems(folder)}
                className={`group relative flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedFolder?.id === folder.id
                    ? 'bg-blue-600/20 border-blue-500/50 shadow-lg shadow-blue-900/20'
                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50'
                }`}
              >
                <span className="text-2xl">{folder.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-sm truncate ${selectedFolder?.id === folder.id ? 'text-blue-300' : 'text-white'}`}>
                    {folder.name}
                  </p>
                  {folder.description && (
                    <p className="text-zinc-500 text-xs truncate">{folder.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-zinc-500 text-xs">{folder._count?.items ?? 0} ta darslik</span>
                    {isAdmin && folder._count?.access !== undefined && (
                      <span className="text-zinc-600 text-xs">{folder._count.access} o'qituvchi</span>
                    )}
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 flex-shrink-0 ${selectedFolder?.id === folder.id ? 'text-blue-400' : 'text-zinc-600'}`} />

                {/* Admin action buttons */}
                {isAdmin && (
                  <div className="absolute right-2 top-2 hidden group-hover:flex gap-1" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => { setSelectedFolder(folder); openAccess(folder); }}
                      className="p-1 rounded-lg bg-zinc-700 hover:bg-purple-600 transition text-zinc-400 hover:text-white"
                      title="Ruxsatlar"
                    >
                      <Users className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingFolder(folder);
                        setFolderForm({ name: folder.name, description: folder.description || '', icon: folder.icon });
                        setShowCreateFolder(true);
                      }}
                      className="p-1 rounded-lg bg-zinc-700 hover:bg-blue-600 transition text-zinc-400 hover:text-white"
                      title="Tahrirlash"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => requestDeleteFolder(folder)}
                      className="p-1 rounded-lg bg-zinc-700 hover:bg-red-600 transition text-zinc-400 hover:text-white"
                      title="O'chirish"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Right — Items Panel */}
        <div className="lg:col-span-2">
          {!selectedFolder ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center h-full flex flex-col items-center justify-center">
              <FolderOpen className="w-16 h-16 text-zinc-700 mb-4" />
              <p className="text-zinc-500">Papkani tanlang</p>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              {/* Panel header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{selectedFolder.icon}</span>
                  <div>
                    <h2 className="text-white font-semibold">{selectedFolder.name}</h2>
                    {selectedFolder.description && (
                      <p className="text-zinc-500 text-xs">{selectedFolder.description}</p>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => { setItemForm({ title: '', url: '', type: 'canva' }); setEditingItem(null); setShowAddItem(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition"
                  >
                    <Plus className="w-4 h-4" /> Darslik qo'shish
                  </button>
                )}
              </div>

              {/* Items list */}
              <div className="p-4">
                {itemsLoading ? (
                  <div className="text-zinc-500 text-sm text-center py-8">Yuklanmoqda...</div>
                ) : items.length === 0 ? (
                  <div className="text-center py-10">
                    <BookOpen className="w-10 h-10 text-zinc-700 mx-auto mb-2" />
                    <p className="text-zinc-500 text-sm">
                      {isAdmin ? "Hali darslik yo'q. Yuqoridagi tugmadan qo'shing." : "Bu papkada hali darslik yo'q."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.map((item, idx) => (
                      <div
                        key={item.id}
                        className="group flex items-center gap-3 p-3 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-xl transition"
                      >
                        <span className="text-lg flex-shrink-0">{typeIcon(item.type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{item.title}</p>
                          <p className="text-zinc-500 text-xs truncate">{item.url}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full bg-zinc-700 ${typeColor(item.type)}`}>
                          {ITEM_TYPES.find(t => t.value === item.type)?.label || item.type}
                        </span>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition flex-shrink-0"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Ochish
                        </a>
                        {isAdmin && (
                          <div className="hidden group-hover:flex gap-1">
                            <button
                              onClick={() => { setEditingItem(item); setItemForm({ title: item.title, url: item.url, type: item.type }); setShowAddItem(true); }}
                              className="p-1.5 rounded-lg bg-zinc-700 hover:bg-blue-600 transition text-zinc-400 hover:text-white"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => requestDeleteItem(item)}
                              className="p-1.5 rounded-lg bg-zinc-700 hover:bg-red-600 transition text-zinc-400 hover:text-white"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── MODAL: Papka yaratish / tahrirlash ─────────────────────────────── */}
      {showCreateFolder && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">
                {editingFolder ? 'Papkani tahrirlash' : 'Yangi papka'}
              </h2>
              <button onClick={() => { setShowCreateFolder(false); setEditingFolder(null); }} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Icon tanlash */}
            <div className="mb-4">
              <label className="text-zinc-400 text-xs block mb-2">Icon tanlang</label>
              <div className="flex flex-wrap gap-2">
                {FOLDER_ICONS.map(icon => (
                  <button
                    key={icon}
                    onClick={() => setFolderForm(f => ({ ...f, icon }))}
                    className={`text-2xl p-2 rounded-lg border transition ${folderForm.icon === icon ? 'border-blue-500 bg-blue-600/20' : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'}`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            <input
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white mb-3 focus:border-blue-500 outline-none"
              placeholder="Papka nomi (masalan: Foundation)"
              value={folderForm.name}
              onChange={e => setFolderForm(f => ({ ...f, name: e.target.value }))}
            />
            <textarea
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white mb-4 focus:border-blue-500 outline-none resize-none text-sm"
              placeholder="Tavsif (ixtiyoriy)"
              rows={2}
              value={folderForm.description}
              onChange={e => setFolderForm(f => ({ ...f, description: e.target.value }))}
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowCreateFolder(false); setEditingFolder(null); }}
                className="flex-1 py-2 rounded-lg bg-zinc-700 text-white hover:bg-zinc-600 transition"
              >Bekor</button>
              <button
                onClick={saveFolder}
                disabled={!folderForm.name.trim()}
                className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition disabled:opacity-50"
              >
                <Save className="w-4 h-4 inline mr-1" />
                {editingFolder ? 'Saqlash' : 'Yaratish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Darslik qo'shish / tahrirlash ────────────────────────────── */}
      {showAddItem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">
                {editingItem ? 'Darslikni tahrirlash' : "Yangi darslik qo'shish"}
              </h2>
              <button onClick={() => { setShowAddItem(false); setEditingItem(null); }} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Type tanlash */}
            <div className="mb-4">
              <label className="text-zinc-400 text-xs block mb-2">Turi</label>
              <div className="grid grid-cols-4 gap-2">
                {ITEM_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setItemForm(f => ({ ...f, type: t.value }))}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition ${itemForm.type === t.value ? 'border-blue-500 bg-blue-600/20 text-white' : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600'}`}
                  >
                    <span className="text-lg">{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <input
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white mb-3 focus:border-blue-500 outline-none text-sm"
              placeholder="Mavzu nomi (masalan: CSS Flexbox)"
              value={itemForm.title}
              onChange={e => setItemForm(f => ({ ...f, title: e.target.value }))}
            />
            <input
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white mb-4 focus:border-blue-500 outline-none text-sm"
              placeholder="Link (https://www.canva.com/...)"
              value={itemForm.url}
              onChange={e => setItemForm(f => ({ ...f, url: e.target.value }))}
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowAddItem(false); setEditingItem(null); }}
                className="flex-1 py-2 rounded-lg bg-zinc-700 text-white hover:bg-zinc-600 transition"
              >Bekor</button>
              <button
                onClick={saveItem}
                disabled={!itemForm.title.trim() || !itemForm.url.trim()}
                className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition disabled:opacity-50"
              >
                <Save className="w-4 h-4 inline mr-1" />
                {editingItem ? 'Saqlash' : "Qo'shish"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Ruxsatlar boshqaruvi ─────────────────────────────────────── */}
      {showAccess && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Lock className="w-5 h-5 text-purple-400" />
                  Ruxsatlar
                </h2>
                <p className="text-zinc-500 text-xs mt-0.5">
                  "{selectedFolder?.name}" papkasiga kim kirishi mumkin?
                </p>
              </div>
              <button onClick={() => setShowAccess(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto mb-4 pr-1">
              {allTeachers.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-4">O'qituvchi topilmadi</p>
              ) : allTeachers.map(teacher => {
                const checked = accessList.includes(teacher.id);
                return (
                  <button
                    key={teacher.id}
                    onClick={() => toggleTeacher(teacher.id)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition ${
                      checked
                        ? 'bg-purple-600/20 border-purple-500/50 text-white'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition ${checked ? 'bg-purple-600 border-purple-500' : 'border-zinc-600'}`}>
                      {checked && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{teacher.fullName}</p>
                      <p className="text-xs text-zinc-500">{teacher.login}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-xs text-zinc-500 mb-3">
              <span>{accessList.length} ta o'qituvchi tanlandi</span>
              <button onClick={() => setAccessList([])} className="text-zinc-500 hover:text-red-400 transition">
                Barchasini olib tashlash
              </button>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowAccess(false)} className="flex-1 py-2 rounded-lg bg-zinc-700 text-white hover:bg-zinc-600 transition">
                Bekor
              </button>
              <button
                onClick={saveAccess}
                disabled={accessSaving}
                className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition disabled:opacity-50"
              >
                {accessSaving ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ─── MODAL: O'chirish tasdiqlash ──────────────────────────────────── */}
      <ConfirmModal
        isOpen={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleConfirmDelete}
        title={confirmDelete?.title}
        description={confirmDelete?.description}
        confirmText="Ha, o'chirish"
        cancelText="Yo'q, bekor qilish"
        loading={deleteLoading}
      />
    </div>
  );
}
