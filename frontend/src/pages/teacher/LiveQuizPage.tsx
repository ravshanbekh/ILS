import React, { useState, useEffect, useCallback, useRef } from 'react';
import { liveQuizApi } from '../../api';
import * as XLSX from 'xlsx';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/authStore';

const SOCKET_URL = (import.meta.env.VITE_API_URL?.replace('/api', '') || '') || window.location.origin;
const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || '';

interface Quiz {
  id: string;
  title: string;
  description?: string;
  code: string;
  status: 'waiting' | 'active' | 'finished';
  timePerQ: number;
  currentQ: number;
  isGlobal?: boolean;
  createdBy?: { id: string; fullName: string };
  _count?: { questions: number; players: number };
}

export default function LiveQuizPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [myQuizzes, setMyQuizzes] = useState<Quiz[]>([]);
  const [globalQuizzes, setGlobalQuizzes] = useState<Quiz[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', timePerQ: 20, isGlobal: false });
  const [editForm, setEditForm] = useState({ title: '', description: '', timePerQ: 20, isGlobal: false });
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<'questions' | 'control' | 'stats'>('questions');
  const [listTab, setListTab] = useState<'my' | 'global'>('my');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [manualQ, setManualQ] = useState({ question: '', options: ['', '', '', ''], correct: 0, imageUrl: '' });
  const [qLoading, setQLoading] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<any>(null);
  const [statsData, setStatsData] = useState<any>(null);
  const [statsPlayerSelected, setStatsPlayerSelected] = useState<any>(null);
  const [statsTab, setStatsTab] = useState<'leaderboard' | 'questions' | 'player'>('leaderboard');
  const imgInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    if (!selected) return;
    const s = io(SOCKET_URL, { transports: ['websocket'] });
    s.emit('join-room', { code: selected.code, role: isAdmin ? 'admin' : 'teacher' });
    s.on('quiz:player-joined', (data) => {
      setPlayers(prev => [...prev.filter(p => p.id !== data.playerId), { id: data.playerId, fullName: data.fullName, score: 0, streak: 0 }]);
    });
    s.on('quiz:leaderboard', (data) => {
      setLeaderboardData(data);
      setPlayers(data.players);
    });
    s.on('quiz:question', () => setLeaderboardData(null));
    setSocket(s);
    return () => { s.disconnect(); };
  }, [selected?.id]);

  async function fetchAll() {
    const [myRes, globalRes] = await Promise.all([
      liveQuizApi.getMyQuizzes(),
      liveQuizApi.getGlobalQuizzes(),
    ]);
    setMyQuizzes(myRes.data.data);
    setGlobalQuizzes(globalRes.data.data);
  }

  async function createQuiz() {
    setCreating(true);
    try {
      const res = await liveQuizApi.create({ ...form, isGlobal: isAdmin ? form.isGlobal : false });
      setShowCreate(false);
      setForm({ title: '', description: '', timePerQ: 20, isGlobal: false });
      await fetchAll();
      loadQuiz(res.data.data);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Xato');
    } finally { setCreating(false); }
  }

  async function saveEdit() {
    if (!selected) return;
    try {
      await liveQuizApi.update(selected.id, editForm);
      setShowEdit(false);
      await fetchAll();
      const res = await liveQuizApi.getById(selected.id);
      setSelected(res.data.data);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Xato');
    }
  }

  async function handleDeleteQuiz(quiz: Quiz) {
    if (!confirm(`"${quiz.title}" quizini o'chirasizmi?`)) return;
    try {
      await liveQuizApi.deleteQuiz(quiz.id);
      if (selected?.id === quiz.id) setSelected(null);
      await fetchAll();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Ruxsat yo\'q');
    }
  }

  async function loadQuiz(q: Quiz) {
    const res = await liveQuizApi.getById(q.id);
    setSelected(res.data.data);
    setPlayers(res.data.data.players || []);
    setTab('questions');
    setLeaderboardData(null);
    setStatsData(null);
  }

  async function useGlobal(quiz: Quiz) {
    if (!confirm(`"${quiz.title}" ni o'z nomingizga nusxalab boshlaysizmi? Yangi kod beriladi.`)) return;
    try {
      const res = await liveQuizApi.useGlobalQuiz(quiz.id);
      await fetchAll();
      await loadQuiz(res.data.data);
      setListTab('my');
    } catch (e: any) {
      alert(e.response?.data?.error || 'Xato');
    }
  }

  async function prepareQuiz() {
    if (!selected) return;
    if (!selected.questions?.length) return alert('Savol yo\'q. Avval savol qo\'shing.');
    try {
      const res = await liveQuizApi.startQuiz(selected.id);
      const updated = res.data.data;
      setSelected(updated);
      setPlayers([]);
      setTab('control');
    } catch (e: any) {
      alert(e.response?.data?.error || 'Xato');
    }
  }

  async function launchQuiz() {
    if (!selected) return;
    const res = await liveQuizApi.launchQuiz(selected.id);
    setSelected(res.data.data);
    setLeaderboardData(null);
  }

  async function nextQ() {
    if (!selected) return;
    await liveQuizApi.nextQuestion(selected.id);
    const res = await liveQuizApi.getById(selected.id);
    setSelected(res.data.data);
  }

  async function finishQuiz() {
    if (!selected || !confirm('Quizni yakunlash?')) return;
    await liveQuizApi.finishQuiz(selected.id);
    const statsRes = await liveQuizApi.getStats(selected.id);
    setStatsData(statsRes.data.data);
    const res = await liveQuizApi.getById(selected.id);
    setSelected(res.data.data);
    setPlayers(res.data.data.players.sort((a: any, b: any) => b.score - a.score));
    setTab('stats');
    setStatsTab('leaderboard');
    await fetchAll();
  }

  async function loadStats() {
    if (!selected) return;
    try {
      const res = await liveQuizApi.getStats(selected.id);
      setStatsData(res.data.data);
    } catch {}
  }

  function handleExcelImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const wb = XLSX.read(ev.target?.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const parsed = rows.slice(1).filter(r => r[0]).map(r => ({
        question: String(r[0]),
        options: [String(r[1] || ''), String(r[2] || ''), String(r[3] || ''), String(r[4] || '')],
        correct: Number(r[5] ?? 0),
      }));
      if (!parsed.length) return;
      setQLoading(true);
      try {
        await liveQuizApi.bulkAddQuestions(selected.id, parsed);
        const res = await liveQuizApi.getById(selected.id);
        setSelected(res.data.data);
        fetchAll();
      } finally { setQLoading(false); }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await liveQuizApi.uploadImage(file);
      setManualQ(q => ({ ...q, imageUrl: res.data.data.imageUrl }));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Rasm yuklanmadi');
    }
    e.target.value = '';
  }

  async function addManualQ() {
    if (!selected || !manualQ.question.trim()) return;
    setQLoading(true);
    try {
      await liveQuizApi.addQuestions(selected.id, [{ ...manualQ, imageUrl: manualQ.imageUrl || null }]);
      const res = await liveQuizApi.getById(selected.id);
      setSelected(res.data.data);
      setManualQ({ question: '', options: ['', '', '', ''], correct: 0, imageUrl: '' });
      fetchAll();
    } finally { setQLoading(false); }
  }

  async function deleteQuestion(qId: string) {
    if (!selected || !confirm('Savolni o\'chirasizmi?')) return;
    await liveQuizApi.deleteQuestion(selected.id, qId);
    const res = await liveQuizApi.getById(selected.id);
    setSelected(res.data.data);
    fetchAll();
  }

  const canEdit = selected && (isAdmin || selected.createdBy?.id === user?.id) && !selected.isGlobal;
  const canDelete = selected && (isAdmin || selected.createdBy?.id === user?.id) && !selected.isGlobal;
  const currentQData = selected?.questions?.[selected?.currentQ >= 0 ? selected.currentQ : 0];
  const QUIZ_LINK = `${window.location.origin}/quiz/join`;
  const displayedList = listTab === 'my' ? myQuizzes : globalQuizzes;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">⚡ Live Quiz</h1>
          <p className="text-zinc-400 text-sm mt-1">Kahoot uslubidagi interaktiv test</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition">
          + Yangi quiz
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold text-white mb-4">Yangi quiz</h2>
            <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white mb-3 focus:border-violet-500 outline-none" placeholder="Quiz nomi *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <textarea className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white mb-3 text-sm resize-none focus:border-violet-500 outline-none" rows={2} placeholder="Tavsif (ixtiyoriy)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            <div className="flex items-center gap-3 mb-4">
              <label className="text-zinc-400 text-sm whitespace-nowrap">Har savol vaqti (sek):</label>
              <input type="number" min={5} max={120} className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white focus:border-violet-500 outline-none" value={form.timePerQ} onChange={e => setForm(f => ({ ...f, timePerQ: Number(e.target.value) }))} />
            </div>
            {isAdmin && (
              <label className="flex items-center gap-2 mb-4 cursor-pointer">
                <input type="checkbox" checked={form.isGlobal} onChange={e => setForm(f => ({ ...f, isGlobal: e.target.checked }))} className="w-4 h-4 accent-violet-500" />
                <span className="text-zinc-300 text-sm">🏫 Markaz quizi (hamma o'qituvchilarga ko'rinadi)</span>
              </label>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2 bg-zinc-700 text-white rounded-lg">Bekor</button>
              <button onClick={createQuiz} disabled={creating || !form.title} className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium disabled:opacity-50">
                {creating ? '...' : 'Yaratish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEdit && selected && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold text-white mb-4">✏️ Quizni tahrirlash</h2>
            <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white mb-3 focus:border-violet-500 outline-none" placeholder="Quiz nomi" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
            <textarea className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white mb-3 text-sm resize-none focus:border-violet-500 outline-none" rows={2} placeholder="Tavsif" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
            <div className="flex items-center gap-3 mb-4">
              <label className="text-zinc-400 text-sm whitespace-nowrap">Har savol vaqti:</label>
              <input type="number" min={5} max={120} className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white" value={editForm.timePerQ} onChange={e => setEditForm(f => ({ ...f, timePerQ: Number(e.target.value) }))} />
            </div>
            {isAdmin && (
              <label className="flex items-center gap-2 mb-4 cursor-pointer">
                <input type="checkbox" checked={editForm.isGlobal} onChange={e => setEditForm(f => ({ ...f, isGlobal: e.target.checked }))} className="w-4 h-4 accent-violet-500" />
                <span className="text-zinc-300 text-sm">🏫 Markaz quizi</span>
              </label>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowEdit(false)} className="flex-1 py-2 bg-zinc-700 text-white rounded-lg">Bekor</button>
              <button onClick={saveEdit} className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium">Saqlash</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quiz list */}
        <div>
          {/* Tabs: My / Global */}
          <div className="flex border-b border-zinc-800 mb-3">
            <button onClick={() => setListTab('my')} className={`px-4 py-2 text-sm font-medium transition ${listTab === 'my' ? 'text-violet-400 border-b-2 border-violet-400' : 'text-zinc-400'}`}>
              📂 Mening ({myQuizzes.length})
            </button>
            <button onClick={() => setListTab('global')} className={`px-4 py-2 text-sm font-medium transition ${listTab === 'global' ? 'text-violet-400 border-b-2 border-violet-400' : 'text-zinc-400'}`}>
              🏫 Markaz ({globalQuizzes.length})
            </button>
          </div>

          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {displayedList.map(q => (
              <div key={q.id} className={`bg-zinc-900 border rounded-xl p-4 cursor-pointer transition-all hover:border-violet-500/50 ${selected?.id === q.id ? 'border-violet-500' : 'border-zinc-800'}`}
                onClick={() => loadQuiz(q)}>
                <div className="flex items-start justify-between mb-1 gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white text-sm truncate">{q.title}</h3>
                    {q.isGlobal && <span className="text-xs text-amber-400">🏫 Markaz quizi</span>}
                    {q.createdBy && listTab === 'global' && <p className="text-xs text-zinc-500 truncate">{q.createdBy.fullName}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${q.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : q.status === 'finished' ? 'bg-zinc-700 text-zinc-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {q.status === 'waiting' ? 'Kutmoqda' : q.status === 'active' ? '🟢 Faol' : 'Tugagan'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                  <span>📝 {q._count?.questions ?? 0}</span>
                  <span>👥 {q._count?.players ?? 0}</span>
                </div>
                <div className="mt-2 font-mono text-xl font-black text-violet-400 tracking-widest">{q.code}</div>

                {/* Buttons for my quizzes */}
                {listTab === 'my' && (
                  <div className="flex gap-2 mt-2" onClick={e => e.stopPropagation()}>
                    {!q.isGlobal && (
                      <button onClick={() => { setEditForm({ title: q.title, description: q.description || '', timePerQ: q.timePerQ, isGlobal: q.isGlobal ?? false }); setSelected(q); setShowEdit(true); }}
                        className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition">✏️ Edit</button>
                    )}
                    {!q.isGlobal && (
                      <button onClick={() => handleDeleteQuiz(q)} className="px-2 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition">🗑️ O'chir</button>
                    )}
                    {isAdmin && q.isGlobal && (
                      <>
                        <button onClick={() => { setEditForm({ title: q.title, description: q.description || '', timePerQ: q.timePerQ, isGlobal: true }); setSelected(q); setShowEdit(true); }}
                          className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition">✏️ Edit</button>
                        <button onClick={() => handleDeleteQuiz(q)} className="px-2 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition">🗑️</button>
                      </>
                    )}
                  </div>
                )}

                {/* Global: use button for teachers */}
                {listTab === 'global' && !isAdmin && (
                  <button onClick={e => { e.stopPropagation(); useGlobal(q); }}
                    className="mt-2 w-full px-3 py-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition font-medium">
                    ▶ Ishlatish (Nusxala va boshlash)
                  </button>
                )}
                {listTab === 'global' && isAdmin && (
                  <div className="flex gap-2 mt-2" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setEditForm({ title: q.title, description: q.description || '', timePerQ: q.timePerQ, isGlobal: true }); loadQuiz(q); setShowEdit(true); }}
                      className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition">✏️ Edit</button>
                    <button onClick={() => handleDeleteQuiz(q)} className="px-2 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition">🗑️ O'chir</button>
                  </div>
                )}
              </div>
            ))}
            {displayedList.length === 0 && <div className="text-zinc-500 text-sm text-center py-8">Hali quiz yo'q</div>}
          </div>
        </div>

        {/* Detail panel */}
        {selected ? (
          <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            {/* Selected quiz header */}
            <div className="bg-zinc-800/60 px-4 py-3 flex items-center justify-between">
              <div>
                <span className="text-white font-semibold">{selected.title}</span>
                {selected.isGlobal && <span className="ml-2 text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">🏫 Markaz</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-black text-violet-400">{selected.code}</span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-zinc-800">
              {(['questions', 'control', 'stats'] as const).map(t => (
                <button key={t} onClick={() => { setTab(t); if (t === 'stats') loadStats(); }}
                  className={`px-4 py-3 text-sm font-medium transition ${tab === t ? 'text-violet-400 border-b-2 border-violet-400' : 'text-zinc-400 hover:text-white'}`}>
                  {t === 'questions' ? '📝 Savollar' : t === 'control' ? '🎮 Boshqarish' : '📊 Natijalar'}
                </button>
              ))}
            </div>

            {/* === QUESTIONS TAB === */}
            {tab === 'questions' && (
              <div className="p-4">
                {/* Import toolbar */}
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <label className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm cursor-pointer transition">
                    📥 Excel import
                    <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelImport} />
                  </label>
                  <a href="/exam-template.xlsx" download className="text-xs text-zinc-400 hover:text-white underline">Shablon yuklash</a>
                  <span className="text-xs text-zinc-500 ml-auto">Format: Savol | A | B | C | D | To'g'ri(0-3)</span>
                </div>

                {/* Manual question form */}
                <div className="bg-zinc-800/50 rounded-xl p-4 mb-4">
                  <h4 className="text-sm font-medium text-white mb-3">Qo'lda savol qo'shish</h4>
                  <input className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-white mb-2 text-sm focus:border-violet-500 outline-none" placeholder="Savol matni..." value={manualQ.question} onChange={e => setManualQ(q => ({ ...q, question: e.target.value }))} />

                  {/* Image upload */}
                  <div className="flex items-center gap-2 mb-3">
                    <button onClick={() => imgInputRef.current?.click()} className="px-3 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded border border-zinc-600 transition">
                      🖼️ Rasm qo'shish
                    </button>
                    <input ref={imgInputRef} type="file" accept="image/png,image/jpeg,image/jpg" className="hidden" onChange={handleImageUpload} />
                    {manualQ.imageUrl && (
                      <div className="flex items-center gap-2">
                        <img src={`${API_BASE}${manualQ.imageUrl}`} alt="" className="h-8 w-12 object-cover rounded border border-zinc-600" />
                        <button onClick={() => setManualQ(q => ({ ...q, imageUrl: '' }))} className="text-red-400 text-xs">×</button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {manualQ.options.map((o, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <button onClick={() => setManualQ(q => ({ ...q, correct: i }))}
                          className={`w-7 h-7 rounded-full text-xs font-bold flex-shrink-0 ${manualQ.correct === i ? 'bg-violet-500 text-white' : 'bg-zinc-700 text-zinc-400'}`}>
                          {['A', 'B', 'C', 'D'][i]}
                        </button>
                        <input className="flex-1 bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm text-white focus:border-violet-500 outline-none" placeholder={`Variant ${['A', 'B', 'C', 'D'][i]}`} value={o}
                          onChange={e => setManualQ(q => { const opts = [...q.options]; opts[i] = e.target.value; return { ...q, options: opts }; })} />
                      </div>
                    ))}
                  </div>
                  <button onClick={addManualQ} disabled={qLoading || !manualQ.question.trim()} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm disabled:opacity-50">
                    {qLoading ? '...' : '+ Qo\'shish'}
                  </button>
                </div>

                {/* Question list */}
                <div className="space-y-2 max-h-[350px] overflow-y-auto">
                  {(selected.questions || []).map((q: any, i: number) => (
                    <div key={q.id} className="bg-zinc-800 rounded-lg p-3 flex items-start gap-3">
                      <span className="text-zinc-500 text-sm w-6 flex-shrink-0">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium">{q.question}</p>
                        {q.imageUrl && <img src={`${API_BASE}${q.imageUrl}`} alt="" className="mt-1 h-16 rounded border border-zinc-700 object-cover" />}
                        <div className="flex gap-2 mt-1 flex-wrap">
                          {(q.options as string[]).map((o, j) => (
                            <span key={j} className={`text-xs px-2 py-0.5 rounded ${j === q.correct ? 'bg-emerald-500/20 text-emerald-400 font-medium' : 'text-zinc-500'}`}>
                              {['A', 'B', 'C', 'D'][j]}) {o}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => deleteQuestion(q.id)} className="text-red-400/60 hover:text-red-400 transition text-sm">🗑️</button>
                    </div>
                  ))}
                  {!selected.questions?.length && <p className="text-zinc-500 text-sm text-center py-4">Savol yo'q</p>}
                </div>

                {/* Prepare (new code) button */}
                {selected.status !== 'active' && (
                  <div className="mt-4 pt-4 border-t border-zinc-800">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-white font-semibold">Quizga tayyorlanish</p>
                        <p className="text-zinc-400 text-xs">Yangi kirish kodi beriladi, o'yinchilar kutadi</p>
                      </div>
                      {selected.code && (
                        <div className="text-center">
                          <div className="font-mono text-2xl font-black text-violet-400">{selected.code}</div>
                          <div className="text-xs text-zinc-500">Joriy kod</div>
                        </div>
                      )}
                    </div>
                    <button onClick={prepareQuiz} disabled={!selected.questions?.length}
                      className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold rounded-xl transition disabled:opacity-40">
                      🔄 Yangi kod olib, tayyorlanish
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* === CONTROL TAB === */}
            {tab === 'control' && (
              <div className="p-4">
                {selected.status === 'waiting' ? (
                  /* Lobby */
                  <div>
                    <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4 mb-4 text-center">
                      <p className="text-zinc-400 text-sm mb-1">Kirish kodi</p>
                      <div className="font-mono text-4xl font-black text-violet-400 tracking-widest mb-2">{selected.code}</div>
                      <p className="text-zinc-500 text-xs">{QUIZ_LINK}</p>
                    </div>
                    <div className="bg-zinc-800 rounded-xl p-4 mb-4">
                      <p className="text-zinc-300 text-sm font-medium mb-2">O'yinchilar ({players.length})</p>
                      <div className="space-y-1 max-h-[200px] overflow-y-auto">
                        {players.map((p, i) => (
                          <div key={p.id || i} className="flex items-center gap-2 text-sm bg-zinc-900/50 rounded px-3 py-1.5">
                            <span className="text-zinc-500 w-4 text-xs">{i + 1}</span>
                            <span className="text-white">{p.fullName}</span>
                          </div>
                        ))}
                        {!players.length && <p className="text-zinc-500 text-xs text-center py-2">O'yinchilar kutilmoqda...</p>}
                      </div>
                    </div>
                    <button onClick={launchQuiz} disabled={!players.length}
                      className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl transition disabled:opacity-40">
                      🚀 O'yinni boshlash ({players.length} o'yinchi)
                    </button>
                  </div>
                ) : selected.status === 'active' ? (
                  /* Active game */
                  <div>
                    <div className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-xl p-4 mb-4">
                      <div className="text-xs text-violet-400 mb-2">Savol {(selected.currentQ || 0) + 1} / {selected.questions?.length}</div>
                      <p className="text-white text-base font-semibold mb-2">{currentQData?.question}</p>
                      {currentQData?.imageUrl && <img src={`${API_BASE}${currentQData.imageUrl}`} alt="" className="mb-3 max-h-32 rounded-lg object-cover border border-violet-500/20" />}
                      <div className="grid grid-cols-2 gap-2">
                        {(currentQData?.options as string[] || []).map((o: string, i: number) => (
                          <div key={i} className={`px-3 py-2 rounded-lg text-sm ${i === currentQData?.correct ? 'bg-emerald-500/20 text-emerald-400 font-medium' : 'bg-zinc-800 text-zinc-400'}`}>
                            {['▲', '◆', '●', '■'][i]} {o}
                          </div>
                        ))}
                      </div>
                    </div>

                    {leaderboardData ? (
                      <div className="bg-zinc-800 rounded-xl p-4 mb-4 border border-violet-500/30">
                        <h3 className="text-white font-bold mb-3">📊 Natijalar</h3>
                        <div className="mb-3">
                          <div className="flex gap-2 h-20 items-end bg-zinc-900/50 p-3 rounded-lg">
                            {leaderboardData.prevQuestion?.optionCounts.map((oc: any, idx: number) => {
                              const maxCount = Math.max(...leaderboardData.prevQuestion.optionCounts.map((o: any) => o.count), 1);
                              const h = (oc.count / maxCount) * 100;
                              return (
                                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                                  <span className="text-xs font-bold text-white">{oc.count}</span>
                                  <div className={`w-full rounded-t-sm ${oc.isCorrect ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ height: `${h}%` }} />
                                  <span className="text-xs text-zinc-500">{['A', 'B', 'C', 'D'][idx]}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="space-y-1 max-h-[200px] overflow-y-auto">
                          {leaderboardData.players.slice(0, 10).map((p: any, i: number) => (
                            <div key={p.id || i} className="flex items-center gap-3 bg-zinc-900/80 p-2 rounded">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-500 text-black' : i === 1 ? 'bg-zinc-300 text-black' : i === 2 ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>{i + 1}</span>
                              <span className="text-white flex-1 font-medium">{p.fullName}</span>
                              <span className="text-violet-400 font-bold">{p.score}</span>
                              {p.streak >= 2 && <span className="text-amber-400 text-xs">🔥{p.streak}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-zinc-800 rounded-xl p-3 mb-4">
                        <p className="text-sm text-zinc-300 mb-2">O'yinchilar ({players.length})</p>
                        <div className="space-y-1 max-h-[150px] overflow-y-auto">
                          {players.map((p, i) => (
                            <div key={p.id || i} className="flex items-center gap-2 text-sm">
                              <span className="text-zinc-500 w-5 text-xs">{i + 1}</span>
                              <span className="text-white flex-1">{p.fullName}</span>
                              <span className="text-violet-400 font-bold">{p.score}</span>
                              {p.streak >= 2 && <span className="text-amber-400 text-xs">🔥{p.streak}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button onClick={nextQ} disabled={(selected.currentQ || 0) >= (selected.questions?.length || 0) - 1}
                        className="flex-1 py-3 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl transition disabled:opacity-30">→ Keyingi savol</button>
                      <button onClick={finishQuiz} className="px-6 py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/20 rounded-xl transition">Yakunlash</button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-zinc-400 mb-4">Quiz tugagan. Natijalarni ko'rish uchun Natijalar tabiga o'ting.</p>
                    <button onClick={() => { setTab('stats'); loadStats(); }} className="px-6 py-2 bg-violet-600 text-white rounded-lg">📊 Natijalar</button>
                  </div>
                )}
              </div>
            )}

            {/* === STATS TAB === */}
            {tab === 'stats' && (
              <div className="p-4">
                {!statsData ? (
                  <div className="text-center py-8 text-zinc-500">
                    <p>Ma'lumot yuklanmoqda...</p>
                  </div>
                ) : (
                  <div>
                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-zinc-800 rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-violet-400">{statsData.quiz.totalPlayers}</p>
                        <p className="text-xs text-zinc-500">O'yinchi</p>
                      </div>
                      <div className="bg-zinc-800 rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-emerald-400">{statsData.quiz.totalQuestions}</p>
                        <p className="text-xs text-zinc-500">Savol</p>
                      </div>
                      <div className="bg-zinc-800 rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-amber-400">
                          {statsData.questionAnalysis.length > 0
                            ? Math.round(statsData.questionAnalysis.reduce((s: number, q: any) => s + q.correctPercentage, 0) / statsData.questionAnalysis.length)
                            : 0}%
                        </p>
                        <p className="text-xs text-zinc-500">O'rtacha to'g'ri</p>
                      </div>
                    </div>

                    {/* Stats tabs */}
                    <div className="flex border-b border-zinc-700 mb-4">
                      {(['leaderboard', 'questions', 'player'] as const).map(st => (
                        <button key={st} onClick={() => setStatsTab(st)}
                          className={`px-3 py-2 text-xs font-medium transition ${statsTab === st ? 'text-violet-400 border-b-2 border-violet-400' : 'text-zinc-400'}`}>
                          {st === 'leaderboard' ? '🏆 Reyting' : st === 'questions' ? '📊 Savollar tahlili' : '👤 O\'yinchi profili'}
                        </button>
                      ))}
                    </div>

                    {/* Leaderboard */}
                    {statsTab === 'leaderboard' && (
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {statsData.leaderboard.map((p: any, i: number) => (
                          <div key={p.id} onClick={() => { setStatsPlayerSelected(statsData.playerDetails.find((pd: any) => pd.id === p.id)); setStatsTab('player'); }}
                            className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition hover:ring-1 hover:ring-violet-500/50 ${i === 0 ? 'bg-yellow-500/10 border border-yellow-500/20' : i === 1 ? 'bg-zinc-400/10 border border-zinc-400/20' : i === 2 ? 'bg-amber-700/10 border border-amber-700/20' : 'bg-zinc-800'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${i === 0 ? 'bg-yellow-400 text-black' : i === 1 ? 'bg-zinc-400 text-black' : i === 2 ? 'bg-amber-700 text-white' : 'bg-zinc-700 text-zinc-300'}`}>{i + 1}</div>
                            <span className="flex-1 text-white font-medium">{p.fullName}</span>
                            <div className="text-right">
                              <p className="text-violet-400 font-bold text-lg">{p.score}</p>
                              <p className="text-xs text-zinc-500">{statsData.playerDetails.find((pd: any) => pd.id === p.id)?.accuracy ?? 0}% to'g'ri</p>
                            </div>
                          </div>
                        ))}
                        {!statsData.leaderboard.length && <p className="text-zinc-500 text-center py-6">O'yinchilar yo'q</p>}
                      </div>
                    )}

                    {/* Question analysis */}
                    {statsTab === 'questions' && (
                      <div className="space-y-4 max-h-[400px] overflow-y-auto">
                        {statsData.questionAnalysis.map((q: any, i: number) => (
                          <div key={q.id} className="bg-zinc-800 rounded-xl p-4">
                            <div className="flex items-start gap-2 mb-3">
                              <span className="text-zinc-500 text-sm">{i + 1}.</span>
                              <div className="flex-1">
                                <p className="text-white text-sm font-medium">{q.question}</p>
                                {q.imageUrl && <img src={`${API_BASE}${q.imageUrl}`} alt="" className="mt-1 h-16 rounded object-cover" />}
                              </div>
                              <div className="text-right flex-shrink-0">
                                <span className={`text-sm font-bold ${q.correctPercentage >= 70 ? 'text-emerald-400' : q.correctPercentage >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                                  {q.correctPercentage}%
                                </span>
                                <p className="text-xs text-zinc-500">to'g'ri</p>
                              </div>
                            </div>
                            {/* Bar chart */}
                            <div className="flex gap-2 h-16 items-end">
                              {q.optionDistribution.map((od: any, idx: number) => (
                                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                                  <span className="text-xs text-white">{od.count}</span>
                                  <div className={`w-full rounded-t-sm ${od.isCorrect ? 'bg-emerald-500' : 'bg-rose-500/60'}`} style={{ height: `${Math.max(od.percentage, 4)}%` }} />
                                  <span className="text-xs text-zinc-500">{['A', 'B', 'C', 'D'][idx]}</span>
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-zinc-500 mt-1">{q.totalAnswers} javob • O'rtacha vaqt: {(q.avgTimeMs / 1000).toFixed(1)}s</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Player profile */}
                    {statsTab === 'player' && (
                      <div>
                        {statsPlayerSelected ? (
                          <div>
                            <button onClick={() => setStatsPlayerSelected(null)} className="text-xs text-zinc-400 hover:text-white mb-4 flex items-center gap-1">← Orqaga</button>
                            <div className="bg-zinc-800 rounded-xl p-4 mb-4">
                              <h3 className="text-white font-bold text-lg">{statsPlayerSelected.fullName}</h3>
                              <div className="grid grid-cols-3 gap-3 mt-3">
                                <div className="text-center"><p className="text-violet-400 font-bold text-xl">{statsPlayerSelected.score}</p><p className="text-xs text-zinc-500">Ball</p></div>
                                <div className="text-center"><p className="text-emerald-400 font-bold text-xl">#{statsPlayerSelected.rank}</p><p className="text-xs text-zinc-500">O'rin</p></div>
                                <div className="text-center"><p className="text-amber-400 font-bold text-xl">{statsPlayerSelected.accuracy}%</p><p className="text-xs text-zinc-500">To'g'ri</p></div>
                              </div>
                            </div>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                              {statsPlayerSelected.answers.map((a: any, i: number) => (
                                <div key={a.questionId} className={`flex items-start gap-3 p-3 rounded-lg ${a.isCorrect ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                                  <span className={`text-sm font-bold mt-0.5 ${a.isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>{a.isCorrect ? '✓' : '✗'}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-white text-sm">{i + 1}. {a.question}</p>
                                    <p className="text-xs text-zinc-500 mt-0.5">
                                      {a.selected !== null ? `${['A', 'B', 'C', 'D'][a.selected]} tanlandi` : 'Javob bermadi'} • {a.points} ball • {(a.timeMs / 1000).toFixed(1)}s
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-zinc-400 text-sm mb-3">O'yinchini bosing — batafsil ko'rasiz:</p>
                            {statsData.playerDetails.map((p: any, i: number) => (
                              <button key={p.id} onClick={() => setStatsPlayerSelected(p)}
                                className="w-full flex items-center gap-3 p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition text-left">
                                <span className="text-zinc-500 text-sm w-5">{i + 1}</span>
                                <span className="text-white flex-1">{p.fullName}</span>
                                <div className="text-right">
                                  <p className="text-violet-400 font-bold">{p.score}</p>
                                  <p className="text-xs text-zinc-500">{p.accuracy}%</p>
                                </div>
                              </button>
                            ))}
                            {!statsData.playerDetails.length && <p className="text-zinc-500 text-center py-6">O'yinchilar yo'q</p>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 border-dashed rounded-xl flex items-center justify-center min-h-[300px]">
            <p className="text-zinc-500 text-sm">Quiz tanlang yoki yangi quiz yarating</p>
          </div>
        )}
      </div>
    </div>
  );
}
