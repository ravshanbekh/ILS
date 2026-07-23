import React, { useState, useEffect, useRef } from 'react';
import { examApi } from '../../api';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useAuthStore } from '@/stores/authStore';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Exam {
  id: string;
  title: string;
  accessCode: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  startsAt: string;
  expiresAt: string;
  testCount: number;
  maxTestScore: number;
  maxAiScore: number;
  maxProjectScore: number;
  step2Name: string;
  step3Name: string;
  category?: { name: string };
  templateId?: string;
  _count?: { questions: number; participants: number };
}

interface Question {
  id?: string;
  question: string;
  imageUrl?: string;
  options: string[];
  correct: number;
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-700 border-amber-200',
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  completed: 'bg-blue-100 text-blue-700 border-blue-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
};
const STATUS_LABEL: Record<string, string> = {
  draft: 'Tayyorlanmoqda',
  active: '🟢 Faol',
  completed: 'Tugagan',
  cancelled: 'Bekor',
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function ExamsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const navigate = useNavigate();
  const [listTab, setListTab] = useState<'my' | 'global'>('my');
  const [exams, setExams] = useState<Exam[]>([]);
  const [globalExams, setGlobalExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Exam | null>(null);
  const [tab, setTab] = useState<'questions' | 'results'>('questions');

  // Create form
  const [form, setForm] = useState({ title: '', testCount: 20, isGlobal: false, step2Name: 'AI video taqdimot', step3Name: 'Loyiha (Youtube link)', step2Type: 'link', step2Desc: '', step3Type: 'link', step3Desc: '' });
  const [creating, setCreating] = useState(false);

  // Questions panel
  const [questions, setQuestions] = useState<Question[]>([]);
  const [qLoading, setQLoading] = useState(false);
  const [manualQ, setManualQ] = useState<Question>({ question: '', options: ['', '', '', ''], correct: 0 });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [editingQId, setEditingQId] = useState<string | null>(null);

  // Results
  const [results, setResults] = useState<any>(null);

  // Admin: edit exam
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Exam> & { step2Type?: string; step3Type?: string; step2Desc?: string; step3Desc?: string }>({});
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => { fetchExams(); }, [listTab]);

  async function fetchExams() {
    setLoading(true);
    try {
      if (listTab === 'my') {
        const res = await examApi.getMyExams();
        setExams(res.data.data);
      } else {
        const res = await examApi.getGlobalExams();
        setGlobalExams(res.data.data);
      }
    } finally { setLoading(false); }
  }

  async function createExam() {
    if (!form.title) return;
    setCreating(true);
    try {
      await examApi.create(form);
      setShowCreate(false);
      setForm({ title: '', testCount: 20, isGlobal: false, step2Name: 'AI video taqdimot', step3Name: 'Loyiha (Youtube link)', step2Type: 'link', step2Desc: '', step3Type: 'link', step3Desc: '' });
      fetchExams();
    } finally { setCreating(false); }
  }

  async function loadExam(exam: Exam) {
    setSelected(exam);
    setTab('questions');
    const res = await examApi.getById(exam.id);
    setQuestions(res.data.data.questions || []);
  }

  async function activate(exam: Exam) {
    if (!confirm('Imtihonni faollashtirish. 2 soat vaqt beriladi. Tasdiqlansinmi?')) return;
    try {
      await examApi.activate(exam.id);
      fetchExams();
      if (selected?.id === exam.id) {
        const res = await examApi.getById(exam.id);
        setSelected(res.data.data);
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Imtihonni faollashtirishda xatolik yuz berdi');
    }
  }

  async function completeExam(exam: Exam) {
    await examApi.complete(exam.id);
    fetchExams();
  }

  async function activateGlobal(exam: Exam) {
    if (!confirm("Ushbu markaz imtihonini o'z guruhlaringiz uchun aktivlashtirasizmi?")) return;
    try {
      await examApi.activateGlobalExam(exam.id);
      setListTab('my');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Aktivlashtirishda xatolik');
    }
  }

  // Admin: imtihon o'chirish
  async function deleteExamById(exam: Exam) {
    if (!confirm(`"${exam.title}" imtihonini o'chirasizmi? Bu qaytarib bo'lmaydi!`)) return;
    try {
      await examApi.delete(exam.id);
      if (selected?.id === exam.id) { setSelected(null); setQuestions([]); }
      fetchExams();
    } catch (e: any) { alert(e.response?.data?.error || 'Xatolik yuz berdi'); }
  }

  // Admin: imtihon tahrirlash modali
  function openEdit(exam: Exam) {
    setEditForm({
      title: exam.title,
      step2Name: exam.step2Name,
      step3Name: exam.step3Name,
      testCount: exam.testCount,
      maxTestScore: exam.maxTestScore,
      maxAiScore: exam.maxAiScore,
      maxProjectScore: exam.maxProjectScore,
    });
    setSelected(exam);
    setShowEdit(true);
  }

  async function saveEditExam() {
    if (!selected) return;
    setEditSaving(true);
    try {
      await examApi.update(selected.id, editForm);
      setShowEdit(false);
      fetchExams();
      // Refresh selected
      const res = await examApi.getById(selected.id);
      setSelected(res.data.data);
    } catch (e: any) { alert(e.response?.data?.error || 'Saqlashda xatolik'); }
    finally { setEditSaving(false); }
  }


  // Excel import
  function handleExcelImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const wb = XLSX.read(ev.target?.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      // Format: [savol, A, B, C, D, to'g'ri(A/B/C/D yoki 1/2/3/4 yoki 0/1/2/3)]
      const parsed: Question[] = rows.slice(1).filter(r => r[0]).map(r => {
        const correctVal = r[5];
        let correctIdx = 0;
        if (typeof correctVal === 'string') {
          const val = correctVal.trim().toUpperCase();
          // A/B/C/D formatini qabul qilish
          if (val === 'A') correctIdx = 0;
          else if (val === 'B') correctIdx = 1;
          else if (val === 'C') correctIdx = 2;
          else if (val === 'D') correctIdx = 3;
          // 1/2/3/4 formatini qabul qilish (1-bazali)
          else if (val === '1') correctIdx = 0;
          else if (val === '2') correctIdx = 1;
          else if (val === '3') correctIdx = 2;
          else if (val === '4') correctIdx = 3;
          // 0/1/2/3 formatini qabul qilish (0-bazali)
          else if (val === '0') correctIdx = 0;
          else correctIdx = 0;
        } else if (typeof correctVal === 'number') {
          const n = Math.round(correctVal);
          // Agar 1-4 oralig'ida — 1-bazali (1=A, 2=B, 3=C, 4=D)
          if (n >= 1 && n <= 4) correctIdx = n - 1;
          // Agar 0-3 oralig'ida — 0-bazali (0=A, 1=B, 2=C, 3=D)
          else if (n >= 0 && n <= 3) correctIdx = n;
          else correctIdx = 0;
        }

        if (isNaN(correctIdx) || correctIdx < 0 || correctIdx > 3) correctIdx = 0;

        return {
          question: String(r[0]),
          options: [String(r[1] || ''), String(r[2] || ''), String(r[3] || ''), String(r[4] || '')],
          correct: correctIdx,
        };
      });
      if (parsed.length === 0) return alert('Hech qanday savol topilmadi');
      setQLoading(true);
      try {
        await examApi.bulkAddQuestions(selected.id, parsed);
        const res = await examApi.getById(selected.id);
        setQuestions(res.data.data.questions);
        alert(`${parsed.length} ta savol import qilindi`);
        fetchExams();
      } catch (err: any) {
        alert(err.response?.data?.error || 'Importda xatolik yuz berdi');
      } finally { setQLoading(false); }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  }

  async function addManualQ() {
    if (!selected || !manualQ.question.trim()) return;
    setQLoading(true);
    try {
      const form = new FormData();
      form.append('question', manualQ.question);
      form.append('options', JSON.stringify(manualQ.options));
      form.append('correct', manualQ.correct.toString());
      if (imageFile) form.append('image', imageFile);
      else if (manualQ.imageUrl === null) form.append('imageUrl', ''); // for clearing image

      if (editingQId) {
        await examApi.updateQuestionWithImage(selected.id, editingQId, form);
      } else {
        await examApi.addQuestionWithImage(selected.id, form);
      }
      const res = await examApi.getById(selected.id);
      setQuestions(res.data.data.questions);
      setManualQ({ question: '', options: ['', '', '', ''], correct: 0 });
      setImageFile(null);
      setEditingQId(null);
      fetchExams();
    } finally { setQLoading(false); }
  }

  async function deleteQ(qId: string) {
    if (!selected) return;
    await examApi.deleteQuestion(selected.id, qId);
    setQuestions(q => q.filter((_, i) => (q as any)[i]?.id !== qId));
    const res = await examApi.getById(selected.id);
    setQuestions(res.data.data.questions);
    fetchExams();
  }

  async function loadResults() {
    if (!selected) return;
    setTab('results');
    const res = await examApi.getResults(selected.id);
    setResults(res.data.data);
  }

  const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

  return (
    <>
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">📋 Imtihonlar</h1>
          <p className="text-zinc-400 text-sm mt-1">3 bosqichli rasmiy imtihon tizimi</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-all"
        >
          <span className="text-lg">+</span> Yangi imtihon
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl my-4">
            <h2 className="text-lg font-bold text-white mb-4">Yangi imtihon yaratish</h2>
            <input
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white mb-3 focus:border-blue-500 outline-none"
              placeholder="Imtihon nomi"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
            <div className="flex items-center gap-3 mb-4">
              <label className="text-zinc-400 text-sm whitespace-nowrap">Test soni:</label>
              <input
                type="number"
                className="w-24 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none"
                value={form.testCount}
                onChange={e => setForm(f => ({ ...f, testCount: Number(e.target.value) }))}
                min={5} max={100}
              />
            </div>

            {/* 1-bosqich: Test (o'zgarmas) */}
            <div className="mb-3 bg-zinc-800/50 border border-zinc-700 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">1</span>
                <span className="text-white font-medium text-sm">Test — {form.testCount} ta savol</span>
                <span className="ml-auto text-blue-400 text-xs font-bold">40 ball</span>
              </div>
              <p className="text-zinc-500 text-xs pl-8">O'quvchilar test savollarini yechadi. (O'zgarmaydi)</p>
            </div>

            {/* 2-bosqich: Dinamik */}
            <div className="mb-3 bg-zinc-800/50 border border-purple-500/30 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs flex items-center justify-center font-bold">2</span>
                <span className="text-white font-medium text-sm">2-bosqich</span>
                <span className="ml-auto text-purple-400 text-xs font-bold">20 ball</span>
              </div>
              <div className="space-y-2 pl-0">
                <input
                  className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-1.5 text-white text-sm focus:border-purple-500 outline-none"
                  placeholder="Bosqich nomi (masalan: AI video taqdimot)"
                  value={form.step2Name}
                  onChange={e => setForm(f => ({ ...f, step2Name: e.target.value }))}
                />
                <div className="flex gap-2">
                  {(['link', 'code', 'text'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setForm(f => ({ ...f, step2Type: t }))}
                      className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition border ${form.step2Type === t ? 'bg-purple-600 border-purple-500 text-white' : 'bg-zinc-800 border-zinc-600 text-zinc-400 hover:border-zinc-500'}`}
                    >
                      {t === 'link' ? '🔗 Link' : t === 'code' ? '💻 Kod' : '📝 Matn'}
                    </button>
                  ))}
                </div>
                <textarea
                  className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-1.5 text-white text-xs focus:border-purple-500 outline-none resize-none"
                  placeholder="O'quvchilarga ko'rsatiladigan qoidalar/tavsif (ixtiyoriy)"
                  rows={2}
                  value={form.step2Desc}
                  onChange={e => setForm(f => ({ ...f, step2Desc: e.target.value }))}
                />
              </div>
            </div>

            {/* 3-bosqich: Dinamik */}
            <div className="mb-4 bg-zinc-800/50 border border-emerald-500/30 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">3</span>
                <span className="text-white font-medium text-sm">3-bosqich</span>
                <span className="ml-auto text-emerald-400 text-xs font-bold">40 ball</span>
              </div>
              <div className="space-y-2 pl-0">
                <input
                  className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-1.5 text-white text-sm focus:border-emerald-500 outline-none"
                  placeholder="Bosqich nomi (masalan: GitHub loyiha linki)"
                  value={form.step3Name}
                  onChange={e => setForm(f => ({ ...f, step3Name: e.target.value }))}
                />
                <div className="flex gap-2">
                  {(['link', 'code', 'text'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setForm(f => ({ ...f, step3Type: t }))}
                      className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition border ${form.step3Type === t ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-zinc-800 border-zinc-600 text-zinc-400 hover:border-zinc-500'}`}
                    >
                      {t === 'link' ? '🔗 Link' : t === 'code' ? '💻 Kod' : '📝 Matn'}
                    </button>
                  ))}
                </div>
                <textarea
                  className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-1.5 text-white text-xs focus:border-emerald-500 outline-none resize-none"
                  placeholder="O'quvchilarga ko'rsatiladigan qoidalar/tavsif (ixtiyoriy)"
                  rows={2}
                  value={form.step3Desc}
                  onChange={e => setForm(f => ({ ...f, step3Desc: e.target.value }))}
                />
              </div>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2 mb-4 text-white">
                <input
                  type="checkbox"
                  id="isGlobal"
                  className="w-4 h-4"
                  checked={form.isGlobal}
                  onChange={e => setForm(f => ({ ...f, isGlobal: e.target.checked }))}
                />
                <label htmlFor="isGlobal" className="text-sm cursor-pointer">Markaz (Global) imtihoni</label>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2 rounded-lg bg-zinc-700 text-white hover:bg-zinc-600 transition"
              >Bekor</button>
              <button
                onClick={createExam}
                disabled={creating || !form.title}
                className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition disabled:opacity-50"
              >{creating ? 'Yaratilmoqda...' : 'Yaratish'}</button>
            </div>
          </div>
        </div>
      )}


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Exam List */}
        <div className="lg:col-span-1 space-y-3">
          <div className="flex p-1 bg-zinc-900 border border-zinc-800 rounded-lg">
            <button
              onClick={() => setListTab('my')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${listTab === 'my' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
            >Mening imtihonlarim</button>
            <button
              onClick={() => setListTab('global')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${listTab === 'global' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
            >Markaz imtihonlari</button>
          </div>

          {loading ? (
            <div className="text-zinc-400 text-sm text-center py-8">Yuklanmoqda...</div>
          ) : (listTab === 'my' ? exams : globalExams).length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center text-zinc-400 text-sm">
              Hali imtihon yo'q
            </div>
          ) : (listTab === 'my' ? exams : globalExams).map(exam => (
            <div
              key={exam.id}
              onClick={() => loadExam(exam)}
              className={`bg-zinc-900 border rounded-xl p-4 cursor-pointer transition-all hover:border-blue-500/50 ${selected?.id === exam.id ? 'border-blue-500 ring-1 ring-blue-500/30' : 'border-zinc-800'}`}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-white text-sm leading-tight">{exam.title}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLOR[exam.status]}`}>
                  {STATUS_LABEL[exam.status]}
                </span>
              </div>
              <div className="text-xs text-zinc-500 space-y-1">
                <div className="flex items-center gap-3">
                  <span>📝 {exam._count?.questions ?? 0} savol</span>
                  <span>👥 {exam._count?.participants ?? 0} ishtirok</span>
                </div>
                <div className="font-mono bg-zinc-800 px-2 py-1 rounded text-zinc-300 select-all">
                  🔗 {exam.accessCode}
                </div>
                {exam.status === 'active' && (
                  <div className="text-emerald-400">
                    ⏰ {new Date(exam.expiresAt).toLocaleTimeString('uz')} gacha
                  </div>
                )}
              </div>
              {/* Actions */}
              <div className="flex gap-2 mt-3 flex-wrap">
                {listTab === 'my' ? (
                  <>
                    {exam.status === 'draft' && (
                      <button
                        onClick={e => { e.stopPropagation(); activate(exam); }}
                        className="text-xs px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition"
                      >✓ Faollashtirish</button>
                    )}
                    {exam.status === 'active' && (
                      <button
                        onClick={e => { e.stopPropagation(); completeExam(exam); }}
                        className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition"
                      >Yakunlash</button>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); loadExam(exam); loadResults(); }}
                      className="text-xs px-3 py-1 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition"
                    >Natijalar</button>
                    {isAdmin && (
                      <>
                        <button
                          onClick={e => { e.stopPropagation(); openEdit(exam); }}
                          className="text-xs px-3 py-1 bg-blue-700 hover:bg-blue-600 text-white rounded-lg transition"
                        >✏️ Tahrirlash</button>
                        <button
                          onClick={e => { e.stopPropagation(); deleteExamById(exam); }}
                          className="text-xs px-3 py-1 bg-red-700 hover:bg-red-600 text-white rounded-lg transition"
                        >🗑️ O'chirish</button>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      onClick={e => { e.stopPropagation(); activateGlobal(exam); }}
                      className="text-xs px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition flex-1"
                    >✨ Aktivlashtirish</button>
                    {isAdmin && (
                      <>
                        <button
                          onClick={e => { e.stopPropagation(); loadExam(exam); }}
                          className="text-xs px-3 py-1 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition"
                        >✏️ Tahrirlash</button>
                        <button
                          onClick={e => { e.stopPropagation(); deleteExamById(exam); }}
                          className="text-xs px-3 py-1 bg-red-700 hover:bg-red-600 text-white rounded-lg transition"
                        >🗑️ O'chirish</button>
                      </>
                    )}
                  </>
                )}
              </div>
              {/* Share link */}
              {listTab === 'my' && (exam.status === 'active' || exam.status === 'draft') && (
                <div
                  onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(`${window.location.origin}/exam/${exam.accessCode}`); alert('Link nusxalandi!'); }}
                  className="mt-2 text-xs text-blue-400 hover:text-blue-300 cursor-pointer flex items-center gap-1"
                >
                  📋 Linkni nusxalash
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Detail panel */}
        {selected ? (
          <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-zinc-800">
              <button
                onClick={() => setTab('questions')}
                className={`px-5 py-3 text-sm font-medium transition ${tab === 'questions' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-zinc-400 hover:text-white'}`}
              >📝 Savollar ({questions.length})</button>
              <button
                onClick={loadResults}
                className={`px-5 py-3 text-sm font-medium transition ${tab === 'results' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-zinc-400 hover:text-white'}`}
              >📊 Natijalar</button>
            </div>

            {tab === 'questions' ? (
              <div className="p-4">
                {/* Import and Add Forms (Only if not a session exam) */}
                {!selected.templateId && (
                  <>
                    <div className="flex items-center gap-3 mb-4 flex-wrap">
                      <label className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium cursor-pointer transition">
                        📥 Excel import
                        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelImport} />
                      </label>
                      <a
                        href="/exam-template.xlsx"
                        download
                        className="text-xs text-zinc-400 hover:text-white transition underline"
                      >Shablon yuklash</a>
                      <span className="text-xs text-zinc-500 ml-auto">
                        Format: Savol | A | B | C | D | To'g'ri(0-3)
                      </span>
                    </div>

                    <div className="bg-zinc-800/50 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-white">{editingQId ? 'Savolni tahrirlash' : 'Q\'olda savol qo\'shish'}</h4>
                    {editingQId && (
                      <button onClick={() => { setEditingQId(null); setManualQ({ question: '', options: ['', '', '', ''], correct: 0 }); setImageFile(null); }} className="text-xs text-zinc-400 hover:text-white">
                        Bekor qilish
                      </button>
                    )}
                  </div>
                  <input
                    className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-white mb-2 text-sm focus:border-blue-500 outline-none"
                    placeholder="Savol matni..."
                    value={manualQ.question}
                    onChange={e => setManualQ(q => ({ ...q, question: e.target.value }))}
                  />
                  
                  {/* Image Upload */}
                  <div className="mb-3 flex items-center gap-3">
                    <label className="flex items-center gap-2 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg text-xs cursor-pointer transition">
                      🖼️ Rasm {imageFile || manualQ.imageUrl ? 'o\'zgartirish' : 'qo\'shish'}
                      <input type="file" accept="image/*" className="hidden" onChange={e => {
                        if (e.target.files?.[0]) setImageFile(e.target.files[0]);
                      }} />
                    </label>
                    {(imageFile || manualQ.imageUrl) && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-400">Rasm tanlandi</span>
                        <button onClick={() => { setImageFile(null); setManualQ(q => ({ ...q, imageUrl: undefined })); }} className="text-xs text-red-400 hover:text-red-300">
                          Olib tashlash
                        </button>
                      </div>
                    )}
                  </div>

                    <div className="grid grid-cols-2 gap-2 mb-2">
                      {manualQ.options.map((opt, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <button
                            onClick={() => setManualQ(q => ({ ...q, correct: i }))}
                            className={`w-7 h-7 rounded-full text-xs font-bold flex-shrink-0 transition ${manualQ.correct === i ? 'bg-emerald-500 text-white' : 'bg-zinc-700 text-zinc-400'}`}
                          >{['A','B','C','D'][i]}</button>
                          <input
                            className="flex-1 bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm text-white focus:border-blue-500 outline-none"
                            placeholder={`Variant ${['A','B','C','D'][i]}`}
                            value={opt}
                            onChange={e => setManualQ(q => { const o=[...q.options]; o[i]=e.target.value; return {...q, options:o}; })}
                          />
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={addManualQ}
                      disabled={qLoading || !manualQ.question.trim()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition disabled:opacity-50"
                    >{qLoading ? '...' : (editingQId ? 'Saqlash' : '+ Qo\'shish')}</button>
                    </div>
                  </>
                )}

                {/* Question list */}
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {questions.map((q: any, i) => (
                    <div key={q.id || i} className="bg-zinc-800 rounded-lg p-3 group relative">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm text-white font-medium mb-1">
                            {i + 1}. {q.question}
                            {q.imageUrl && <span className="ml-2 text-xs text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded">🖼️ Rasm</span>}
                          </p>
                          <div className="grid grid-cols-2 gap-1">
                            {(Array.isArray(q.options) ? q.options : (typeof q.options === 'string' ? JSON.parse(q.options) : [])).map((o: string, j: number) => (
                              <span key={j} className={`text-xs px-2 py-1 rounded ${j === q.correct ? 'bg-emerald-500/20 text-emerald-400 font-medium' : 'text-zinc-400'}`}>
                                {['A','B','C','D'][j]}) {o}
                              </span>
                            ))}
                          </div>
                        </div>
                        {!selected.templateId && (
                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-3 transition">
                            <button
                              onClick={() => {
                                setEditingQId(q.id);
                                setManualQ({ question: q.question, options: q.options, correct: q.correct, imageUrl: q.imageUrl });
                                setImageFile(null);
                              }}
                              className="text-blue-400 hover:text-blue-300 text-sm"
                              title="Tahrirlash"
                            >✏️</button>
                            <button
                              onClick={() => deleteQ(q.id)}
                              className="text-red-400 hover:text-red-300 text-lg"
                              title="O'chirish"
                            >×</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <ExamResultsPanel exam={selected} results={results} />
            )}
          </div>
        ) : (
          <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 border-dashed rounded-xl flex items-center justify-center">
            <p className="text-zinc-500 text-sm">Imtihonni tanlang</p>
          </div>
        )}
      </div>
    </div>

    {/* ─── MODAL: Imtihon tahrirlash (Admin) ─────────────────────────────── */}
    {showEdit && isAdmin && (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">✏️ Imtihon tahrirlash</h2>
            <button onClick={() => setShowEdit(false)} className="text-zinc-400 hover:text-white text-xl">×</button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-zinc-400 text-xs block mb-1">Nomi</label>
              <input
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none text-sm"
                value={editForm.title || ''}
                onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-zinc-400 text-xs block mb-1">Test soni</label>
                <input type="number" min={1} max={200}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none text-sm"
                  value={editForm.testCount ?? ''}
                  onChange={e => setEditForm(f => ({ ...f, testCount: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="text-zinc-400 text-xs block mb-1">Test ball</label>
                <input type="number" min={0} max={100}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none text-sm"
                  value={editForm.maxTestScore ?? ''}
                  onChange={e => setEditForm(f => ({ ...f, maxTestScore: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="text-zinc-400 text-xs block mb-1">2-bosqich ball</label>
                <input type="number" min={0} max={100}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none text-sm"
                  value={editForm.maxAiScore ?? ''}
                  onChange={e => setEditForm(f => ({ ...f, maxAiScore: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-zinc-400 text-xs block mb-1">2-bosqich nomi</label>
                <input
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none text-sm"
                  value={editForm.step2Name || ''}
                  onChange={e => setEditForm(f => ({ ...f, step2Name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-zinc-400 text-xs block mb-1">3-bosqich nomi</label>
                <input
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none text-sm"
                  value={editForm.step3Name || ''}
                  onChange={e => setEditForm(f => ({ ...f, step3Name: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-zinc-400 text-xs block mb-1">3-bosqich ball</label>
              <input type="number" min={0} max={100}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none text-sm"
                value={editForm.maxProjectScore ?? ''}
                onChange={e => setEditForm(f => ({ ...f, maxProjectScore: Number(e.target.value) }))}
              />
            </div>
          </div>

          <div className="flex gap-2 mt-5">
            <button onClick={() => setShowEdit(false)} className="flex-1 py-2 rounded-lg bg-zinc-700 text-white hover:bg-zinc-600 transition">
              Bekor
            </button>
            <button
              onClick={saveEditExam}
              disabled={editSaving}
              className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition disabled:opacity-50"
            >
              {editSaving ? 'Saqlanmoqda...' : '💾 Saqlash'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

// ─── Results sub-component ────────────────────────────────────────────────────
function ExamResultsPanel({ exam, results }: { exam: Exam; results: any }) {
  const [grading, setGrading] = useState<string | null>(null);
  const [scoreForm, setScoreForm] = useState<any>({});

  if (!results) return (
    <div className="p-6 text-center text-zinc-400 text-sm">Natijalar yuklanmoqda...</div>
  );

  const participants: any[] = results.participants || [];

  async function saveGrade(pId: string) {
    await examApi.gradeParticipant(exam.id, pId, scoreForm[pId]);
    setGrading(null);
    alert('Ball saqlandi');
  }

  return (
    <div className="p-4 overflow-y-auto max-h-[600px]">
      <h3 className="font-semibold text-white mb-4">
        Natijalar — {participants.length} ishtirokchi
      </h3>
      {participants.length === 0 ? (
        <p className="text-zinc-400 text-sm text-center py-4">Hali hech kim qo'shilmagan</p>
      ) : participants.map(p => (
        <div key={p.id} className="bg-zinc-800 rounded-xl p-4 mb-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-semibold text-white">{p.student.fullName}</p>
              <p className="text-xs text-zinc-400">{p.student.login} • {p.status}</p>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-white">{p.totalScore ?? '—'}</div>
              <div className="text-xs text-zinc-400">/ 100</div>
            </div>
          </div>

          {/* Scores breakdown */}
          <div className="grid grid-cols-3 gap-2 mb-3 text-sm">
            <div className="bg-zinc-700/50 rounded-lg p-2 text-center">
              <div className="text-blue-400 font-bold">{p.testScore ?? '—'}</div>
              <div className="text-zinc-500 text-xs">Test (/{exam.maxTestScore})</div>
            </div>
            <div className="bg-zinc-700/50 rounded-lg p-2 text-center">
              <div className="text-purple-400 font-bold">{p.aiScore ?? '—'}</div>
              <div className="text-zinc-500 text-xs truncate" title={exam.step2Name}>{exam.step2Name} (/{exam.maxAiScore})</div>
            </div>
            <div className="bg-zinc-700/50 rounded-lg p-2 text-center">
              <div className="text-emerald-400 font-bold">{p.projectScore ?? '—'}</div>
              <div className="text-zinc-500 text-xs truncate" title={exam.step3Name}>{exam.step3Name} (/{exam.maxProjectScore})</div>
            </div>
          </div>

          {/* Videos */}
          {(p.aiVideoUrl || p.projectVideoUrl) && (
            <div className="flex flex-wrap gap-2 mb-3 text-xs">
              {p.aiVideoUrl && (
                <a href={p.aiVideoUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 rounded-lg transition border border-purple-500/20 max-w-[200px] truncate"
                  title={exam.step2Name}>
                  🎬 {exam.step2Name}
                </a>
              )}
              {p.projectVideoUrl && (
                <a href={p.projectVideoUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition border border-emerald-500/20 max-w-[200px] truncate"
                  title={exam.step3Name}>
                  💼 {exam.step3Name}
                </a>
              )}
            </div>
          )}

          {/* Grading */}
          {p.status === 'submitted' && (
            grading === p.id ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-zinc-400 truncate block" title={exam.step2Name}>{exam.step2Name} (/{exam.maxAiScore})</label>
                    <input type="number" max={exam.maxAiScore} min={0}
                      className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-white text-sm mt-1"
                      value={scoreForm[p.id]?.aiScore ?? ''}
                      onChange={e => setScoreForm((s: any) => ({ ...s, [p.id]: { ...s[p.id], aiScore: Number(e.target.value) } }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 truncate block" title={exam.step3Name}>{exam.step3Name} (/{exam.maxProjectScore})</label>
                    <input type="number" max={exam.maxProjectScore} min={0}
                      className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-white text-sm mt-1"
                      value={scoreForm[p.id]?.projectScore ?? ''}
                      onChange={e => setScoreForm((s: any) => ({ ...s, [p.id]: { ...s[p.id], projectScore: Number(e.target.value) } }))}
                    />
                  </div>
                </div>
                <textarea
                  className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-white text-xs"
                  placeholder={`${exam.step2Name} kommentariya...`}
                  rows={2}
                  value={scoreForm[p.id]?.aiComment ?? ''}
                  onChange={e => setScoreForm((s: any) => ({ ...s, [p.id]: { ...s[p.id], aiComment: e.target.value } }))}
                />
                <textarea
                  className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-white text-xs"
                  placeholder={`${exam.step3Name} kommentariya...`}
                  rows={2}
                  value={scoreForm[p.id]?.projectComment ?? ''}
                  onChange={e => setScoreForm((s: any) => ({ ...s, [p.id]: { ...s[p.id], projectComment: e.target.value } }))}
                />
                <div className="flex gap-2">
                  <button onClick={() => setGrading(null)} className="flex-1 py-1.5 bg-zinc-600 hover:bg-zinc-500 text-white rounded text-sm">Bekor</button>
                  <button onClick={() => saveGrade(p.id)} className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium">Saqlash</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setGrading(p.id); setScoreForm((s: any) => ({ ...s, [p.id]: { aiScore: p.aiScore, projectScore: p.projectScore, aiComment: p.aiComment, projectComment: p.projectComment } })); }}
                className="text-xs px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg border border-blue-500/20 transition"
              >✏️ Ball qo'yish</button>
            )
          )}
        </div>
      ))}
    </div>
  );
}
