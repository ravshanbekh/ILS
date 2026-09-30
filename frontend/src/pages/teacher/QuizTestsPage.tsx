import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Copy, Trash2, Link2, Users, FileQuestion, Clock,
  Search, CheckCircle2, CircleDashed, Lock, X, ExternalLink,
} from 'lucide-react';
import { quizTestsApi } from '../../api';
import { useAuthStore } from '@/stores/authStore';

interface TestRow {
  id: string;
  title: string;
  code: string;
  status: 'draft' | 'active' | 'closed';
  durationMin: number;
  closedCount: number | null;
  openCount: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  createdById: string;
  createdBy: { id: string; fullName: string } | null;
  _count: { questions: number; attempts: number };
}

function errMsg(e: any, fallback: string): string {
  const err = e?.response?.data?.error;
  if (typeof err === 'string') return err;
  if (err?.message) return err.message;
  return fallback;
}

const STATUS_META = {
  draft: { label: 'Qoralama', cls: 'bg-slate-100 text-slate-600', Icon: CircleDashed },
  active: { label: 'Faol', cls: 'bg-emerald-100 text-emerald-700', Icon: CheckCircle2 },
  closed: { label: 'Yopilgan', cls: 'bg-rose-100 text-rose-700', Icon: Lock },
} as const;

export default function QuizTestsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [tests, setTests] = useState<TestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'active' | 'closed'>('all');
  const [creating, setCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await quizTestsApi.getMine();
      setTests(res.data.data);
    } catch (e: any) {
      alert(errMsg(e, 'Testlarni yuklab bo\'lmadi'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const shareUrl = (code: string) => `${window.location.origin}/t/${code}`;

  const copyLink = async (code: string) => {
    const url = shareUrl(code);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API HTTPS'siz muhitda ishlamaydi — zaxira yo'l
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1800);
  };

  const handleDuplicate = async (id: string) => {
    try {
      const res = await quizTestsApi.duplicate(id);
      await load();
      navigate(`${basePath}/${res.data.data.id}`);
    } catch (e: any) {
      alert(errMsg(e, 'Nusxa olishda xatolik'));
    }
  };

  const handleDelete = async (t: TestRow) => {
    const warn =
      t._count.attempts > 0
        ? `\n\nDIQQAT: bu testda ${t._count.attempts} ta natija bor va ular ham o'chadi.`
        : '';
    if (!confirm(`"${t.title}" o'chirilsinmi?${warn}`)) return;
    try {
      await quizTestsApi.remove(t.id);
      setTests((prev) => prev.filter((x) => x.id !== t.id));
    } catch (e: any) {
      alert(errMsg(e, 'O\'chirishda xatolik'));
    }
  };

  const basePath = user?.role === 'admin' ? '/admin/quiz-tests' : '/teacher/quiz-tests';

  const filtered = tests.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return t.title.toLowerCase().includes(q) || t.code.toLowerCase().includes(q);
  });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Sarlavha */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Test paneli</h1>
          <p className="text-sm text-slate-500 mt-1">
            O'z testingizni yarating, havolasini tarqating va natijalarni ko'ring.
            Ishtirokchi tizimga kirishi shart emas — ism-familiyasini yozadi.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition"
        >
          <Plus className="w-4 h-4" />
          Yangi test
        </button>
      </div>

      {/* Filtrlar */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom yoki kod bo'yicha qidirish"
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          {([
            ['all', 'Hammasi'],
            ['active', 'Faol'],
            ['draft', 'Qoralama'],
            ['closed', 'Yopilgan'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-1.5 text-sm rounded-md transition ${
                statusFilter === key
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Ro'yxat */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-44 rounded-xl border border-slate-200 bg-slate-50 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-16 text-center">
          <FileQuestion className="w-12 h-12 mx-auto text-slate-300" />
          <p className="mt-3 font-medium text-slate-700">
            {tests.length === 0 ? 'Hali test yaratilmagan' : 'Filtr bo\'yicha test topilmadi'}
          </p>
          {tests.length === 0 && (
            <button
              onClick={() => setCreating(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4" /> Birinchi testni yaratish
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => {
            const meta = STATUS_META[t.status];
            return (
              <div
                key={t.id}
                className="group rounded-xl border border-slate-200 bg-white p-4 hover:border-indigo-300 hover:shadow-sm transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    onClick={() => navigate(`${basePath}/${t.id}`)}
                    className="text-left font-semibold text-slate-900 hover:text-indigo-600 line-clamp-2"
                  >
                    {t.title}
                  </button>
                  <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.cls}`}>
                    <meta.Icon className="w-3 h-3" />
                    {meta.label}
                  </span>
                </div>

                {user?.role === 'admin' && t.createdBy && (
                  <p className="mt-1 text-xs text-slate-400">{t.createdBy.fullName}</p>
                )}

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <FileQuestion className="w-3.5 h-3.5" /> {t._count.questions} savol
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {t.durationMin} daq
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> {t._count.attempts} ishtirokchi
                  </span>
                </div>

                {/* Havola */}
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2">
                  <code className="flex-1 truncate text-xs font-mono text-slate-600">
                    /t/{t.code}
                  </code>
                  <button
                    onClick={() => copyLink(t.code)}
                    title="Havolani nusxalash"
                    className="rounded p-1 text-slate-500 hover:bg-white hover:text-indigo-600"
                  >
                    <Link2 className="w-4 h-4" />
                  </button>
                  <a
                    href={shareUrl(t.code)}
                    target="_blank"
                    rel="noreferrer"
                    title="Yangi oynada ochish"
                    className="rounded p-1 text-slate-500 hover:bg-white hover:text-indigo-600"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
                {copiedCode === t.code && (
                  <p className="mt-1 text-xs font-medium text-emerald-600">Havola nusxalandi</p>
                )}

                <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                  <button
                    onClick={() => navigate(`${basePath}/${t.id}`)}
                    className="flex-1 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
                  >
                    Ochish
                  </button>
                  <button
                    onClick={() => handleDuplicate(t.id)}
                    title="Nusxa olish"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(t)}
                    title="O'chirish"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {creating && (
        <CreateTestModal
          onClose={() => setCreating(false)}
          onCreated={(id) => navigate(`${basePath}/${id}`)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function CreateTestModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMin, setDurationMin] = useState(30);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (title.trim().length < 3) {
      alert('Test nomini yozing (kamida 3 belgi)');
      return;
    }
    setSaving(true);
    try {
      const res = await quizTestsApi.create({ title, description, durationMin });
      onCreated(res.data.data.id);
    } catch (e: any) {
      alert(errMsg(e, 'Test yaratishda xatolik'));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Yangi test</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Test nomi <span className="text-rose-500">*</span>
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Masalan: 1-modul yakuniy testi"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Shartlar va ko'rsatmalar
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Ishtirokchi test boshlashdan oldin ko'radi. Masalan: har savolga bitta javob, orqaga qaytish mumkin emas."
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Vaqt (daqiqa)
            </label>
            <input
              type="number"
              min={1}
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
              className="w-32 rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <p className="mt-1.5 text-xs text-slate-400">
              Qolgan sozlamalarni keyingi oynada belgilaysiz
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Bekor qilish
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Yaratilmoqda...' : 'Yaratish va davom etish'}
          </button>
        </div>
      </div>
    </div>
  );
}
