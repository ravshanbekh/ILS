import React, { useState, useEffect, useRef, useCallback } from 'react';
import { liveQuizApi } from '../../api';
import * as XLSX from 'xlsx';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/authStore';

const SOCKET_URL = (import.meta.env.VITE_API_URL?.replace('/api', '') || '') || window.location.origin;
const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || '';

// ── Animated score counter ────────────────────────────────────────────────────
function AnimatedNum({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  const raf = useRef<number>(0);
  useEffect(() => {
    const from = prev.current;
    const begin = Date.now();
    function tick() {
      const p = Math.min((Date.now() - begin) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (value - from) * ease));
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else prev.current = value;
    }
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value]);
  return <>{display.toLocaleString()}</>;
}

interface Quiz {
  id: string; title: string; description?: string; code: string;
  status: 'waiting' | 'active' | 'finished'; timePerQ: number; currentQ: number;
  isGlobal?: boolean; createdBy?: { id: string; fullName: string };
  _count?: { questions: number; players: number };
}

// Faza: 'lobby' → 'question' → 'leaderboard' → 'question' → … → 'finished'
type GamePhase = 'idle' | 'lobby' | 'question' | 'leaderboard' | 'finished';

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
  const [tab, setTab] = useState<'questions' | 'game' | 'stats'>('questions');
  const [listTab, setListTab] = useState<'my' | 'global'>('my');

  // Game state
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gamePhase, setGamePhase] = useState<GamePhase>('idle');
  const [players, setPlayers] = useState<any[]>([]);          // Lobby players
  const [liveScores, setLiveScores] = useState<any[]>([]);    // Real-time leaderboard
  const [answeredCount, setAnsweredCount] = useState(0);
  const [currentQData, setCurrentQData] = useState<any>(null); // Current question
  const [timeLeft, setTimeLeft] = useState(0);
  const [leaderboardData, setLeaderboardData] = useState<any>(null);
  const [statsData, setStatsData] = useState<any>(null);
  const [statsTab, setStatsTab] = useState<'leaderboard' | 'questions' | 'player'>('leaderboard');
  const [statsPlayerSelected, setStatsPlayerSelected] = useState<any>(null);

  // Questions tab
  const [manualQ, setManualQ] = useState({ question: '', options: ['', '', '', ''], correct: 0, imageUrl: '' });
  const [qLoading, setQLoading] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const [editingQId, setEditingQId] = useState<string | null>(null);
  const timerRef = useRef<number>(0);
  const totalPlayersRef = useRef(0);

  // Music state
  const [musics, setMusics] = useState<any[]>([]);
  const [selectedMusicId, setSelectedMusicId] = useState<string | null>(null);
  const [showMusicManager, setShowMusicManager] = useState(false);
  const [musicUploadForm, setMusicUploadForm] = useState({ title: '' });
  const [musicUploading, setMusicUploading] = useState(false);
  const musicFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchAll(); fetchMusics(); }, []);

  async function fetchMusics() {
    try {
      const res = await liveQuizApi.getMusics();
      setMusics(res.data.data);
    } catch {}
  }

  async function uploadMusic() {
    if (!musicUploadForm.title || !musicFileRef.current?.files?.[0]) return;
    setMusicUploading(true);
    try {
      await liveQuizApi.uploadMusic(musicUploadForm.title, musicFileRef.current.files[0]);
      setMusicUploadForm({ title: '' });
      if (musicFileRef.current) musicFileRef.current.value = '';
      await fetchMusics();
    } catch (e: any) { alert(e.response?.data?.error || 'Xato'); }
    finally { setMusicUploading(false); }
  }

  async function deleteMusic(id: string) {
    if (!confirm('Musiqani o\'chirasizmi?')) return;
    try {
      await liveQuizApi.deleteMusic(id);
      if (selectedMusicId === id) setSelectedMusicId(null);
      await fetchMusics();
    } catch (e: any) { alert(e.response?.data?.error || 'Xato'); }
  }

  useEffect(() => {
    if (!selected?.code) return; // Only connect if we have a generated code
    const s = io(SOCKET_URL, { transports: ['websocket'] });
    
    s.on('connect', () => {
      s.emit('join-room', { code: selected.code, role: 'teacher' });
      // Reconnect paytida o'tkazib yuborilgan player-joined/left eventlarni
      // DB'dan qayta yuklab sinxronlaymiz — ro'yxat hech qachon "orqada qolmasin"
      liveQuizApi.getById(selected.id).then(res => {
        const q = res.data.data;
        if (q?.players) setPlayers(q.players);
      }).catch(() => {});
    });

    s.on('quiz:player-joined', (data) => {
      setPlayers(prev => {
        const exists = prev.find(p => p.id === data.playerId);
        if (exists) return prev;
        return [...prev, { id: data.playerId, fullName: data.fullName, score: 0, streak: 0 }];
      });
      // O'yin o'rtasida qo'shilgan o'quvchi "Joriy reyting"da ham darhol ko'rinsin
      setLiveScores(prev => {
        if (!prev.length || prev.find(p => p.id === data.playerId)) return prev;
        return [...prev, { id: data.playerId, fullName: data.fullName, score: 0, streak: 0 }];
      });
      totalPlayersRef.current = data.playerCount;
    });

    s.on('quiz:player-left', (data) => {
      setPlayers(prev => prev.filter(p => p.id !== data.playerId));
      setLiveScores(prev => prev.filter(p => p.id !== data.playerId));
      totalPlayersRef.current = data.playerCount;
    });

    // Real-time score update — savol vaqtida
    s.on('quiz:score-update', (data) => {
      setLiveScores(data.players);
      setAnsweredCount(data.answeredCount);
    });

    // Leaderboard (teacher presses "Natija") — received by students, teacher triggers it
    s.on('quiz:leaderboard', (data) => {
      setLeaderboardData(data);
      setLiveScores(data.players);
      setGamePhase('leaderboard');
      clearInterval(timerRef.current);
    });

    // Question (teacher presses "Keyingi savol") — received by students
    const onQuestion = (data: any) => {
      setCurrentQData(data);
      setGamePhase('question');
      setAnsweredCount(0);
      setLeaderboardData(null);
      // Start timer
      clearInterval(timerRef.current);
      setTimeLeft(data.timePerQ);
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) { clearInterval(timerRef.current); return 0; }
          return t - 1;
        });
      }, 1000);
    };

    s.on('quiz:question', onQuestion);
    s.on('quiz:started', (data) => onQuestion(data.question));

    s.on('quiz:finished', (data) => {
      setLiveScores(data.leaderboard.map((p: any, i: number) => ({ ...p, rank: i + 1 })));
      setGamePhase('finished');
      clearInterval(timerRef.current);
      fetchAll();
    });

    setSocket(s);
    return () => { s.disconnect(); clearInterval(timerRef.current); };
  }, [selected?.code]); // <--- Dependency on code! Reconnects when code is generated.

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
    } catch (e: any) { alert(e.response?.data?.error || 'Xato'); }
    finally { setCreating(false); }
  }

  async function saveEdit() {
    if (!selected) return;
    try {
      await liveQuizApi.update(selected.id, editForm);
      setShowEdit(false);
      await fetchAll();
      const res = await liveQuizApi.getById(selected.id);
      setSelected(res.data.data);
    } catch (e: any) { alert(e.response?.data?.error || 'Xato'); }
  }

  async function handleDeleteQuiz(quiz: Quiz) {
    if (!confirm(`"${quiz.title}" quizini o'chirasizmi?`)) return;
    try {
      await liveQuizApi.deleteQuiz(quiz.id);
      if (selected?.id === quiz.id) { setSelected(null); setGamePhase('idle'); }
      await fetchAll();
    } catch (e: any) { alert(e.response?.data?.error || 'Ruxsat yo\'q'); }
  }

  async function loadQuiz(q: Quiz) {
    const res = await liveQuizApi.getById(q.id);
    const loadedQuiz = res.data.data;
    setSelected(loadedQuiz);
    setPlayers(loadedQuiz.players || []);
    setLiveScores([]);
    setAnsweredCount(0);
    setCurrentQData(null);
    setLeaderboardData(null);
    setStatsData(null);
    clearInterval(timerRef.current);

    if (loadedQuiz.status === 'waiting' || loadedQuiz.status === 'active') {
      setTab('game');
      setGamePhase('lobby'); // Allows teacher to see connected players and resume
    } else {
      setGamePhase('idle');
      setTab('questions');
    }
  }

  async function useGlobal(quiz: Quiz) {
    if (!confirm(`"${quiz.title}" ni nusxalab boshlaysizmi?`)) return;
    try {
      const res = await liveQuizApi.useGlobalQuiz(quiz.id);
      await fetchAll();
      await loadQuiz(res.data.data);
      setListTab('my');
    } catch (e: any) { alert(e.response?.data?.error || 'Xato'); }
  }

  // ── Game flow: Lobby uchun tayyorlash ───────────────────────────────────────
  async function prepareQuiz() {
    if (!selected?.questions?.length) return alert('Savol yo\'q!');
    try {
      const res = await liveQuizApi.startQuiz(selected.id, selectedMusicId || undefined);
      setSelected((s: any) => ({ ...s, ...res.data.data, code: res.data.data.code }));
      setPlayers([]);
      setLiveScores([]);
      setAnsweredCount(0);
      setGamePhase('lobby');
      setTab('game');
    } catch (e: any) { alert(e.response?.data?.error || 'Xato'); }
  }

  // ── Birinchi savolni yuborish (LOBBY → QUESTION) ─────────────────────────────
  async function launchFirstQuestion() {
    if (!selected) return;
    try {
      await liveQuizApi.launchQuiz(selected.id);
      setAnsweredCount(0);
      // quiz:question event socket orqali keladi → gamePhase = 'question'
    } catch (e: any) { alert(e.response?.data?.error || 'Xato'); }
  }

  // ── Natijani ko'rsatish (QUESTION → LEADERBOARD) ─────────────────────────────
  async function showResults() {
    if (!selected) return;
    clearInterval(timerRef.current);
    try {
      await liveQuizApi.nextQuestion(selected.id);
      // quiz:leaderboard event socket orqali keladi → gamePhase = 'leaderboard'
    } catch (e: any) {
      // Agar oxirgi savol bo'lsa → yakunlash
      if (e.response?.status === 400) {
        await finishQuiz();
      }
    }
  }

  // ── Keyingi savolni yuborish (LEADERBOARD → QUESTION) ────────────────────────
  async function sendNextQuestion() {
    if (!selected) return;
    try {
      await liveQuizApi.showQuestion(selected.id);
      // quiz:question event socket orqali keladi → gamePhase = 'question'
    } catch (e: any) { alert(e.response?.data?.error || 'Xato'); }
  }

  // ── Quiz yakunlash ────────────────────────────────────────────────────────────
  async function finishQuiz() {
    if (!selected) return;
    if (!confirm('Quizni yakunlash?')) return;
    try {
      await liveQuizApi.finishQuiz(selected.id);
      // quiz:finished event keladi
      const statsRes = await liveQuizApi.getStats(selected.id);
      setStatsData(statsRes.data.data);
    } catch (e: any) { alert(e.response?.data?.error || 'Xato'); }
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
      const parsed = rows.slice(1).filter(r => r[0]).map(r => {
        const correctVal = r[5];
        let correctIdx = 0;

        if (correctVal !== undefined && correctVal !== null) {
          if (typeof correctVal === 'number') {
            const n = Math.round(correctVal);
            if (n >= 0 && n <= 3) correctIdx = n;
            else if (n === 4) correctIdx = 3;
          } else {
            const val = String(correctVal).trim().toUpperCase();
            if (val === 'A' || val === '0') correctIdx = 0;
            else if (val === 'B' || val === '1') correctIdx = 1;
            else if (val === 'C' || val === '2') correctIdx = 2;
            else if (val === 'D' || val === '3' || val === '4') correctIdx = 3;
            else {
              const parsedNum = parseInt(val, 10);
              if (!isNaN(parsedNum)) {
                if (parsedNum >= 0 && parsedNum <= 3) correctIdx = parsedNum;
                else if (parsedNum === 4) correctIdx = 3;
              }
            }
          }
        }

        if (isNaN(correctIdx) || correctIdx < 0 || correctIdx > 3) {
          correctIdx = 0;
        }

        return {
          question: String(r[0]),
          options: [String(r[1] || ''), String(r[2] || ''), String(r[3] || ''), String(r[4] || '')],
          correct: correctIdx,
        };
      });
      if (!parsed.length) return alert('Hech qanday savol topilmadi');
      setQLoading(true);
      try {
        await liveQuizApi.bulkAddQuestions(selected.id, parsed);
        const res = await liveQuizApi.getById(selected.id);
        setSelected(res.data.data);
        fetchAll();
        alert(`${parsed.length} ta savol import qilindi`);
      } catch (err: any) {
        alert(err.response?.data?.error || 'Importda xatolik yuz berdi');
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
    } catch (err: any) { alert(err.response?.data?.error || 'Rasm yuklanmadi'); }
    e.target.value = '';
  }

  async function addManualQ() {
    if (!selected || !manualQ.question.trim()) return;
    setQLoading(true);
    try {
      if (editingQId) {
        await liveQuizApi.updateQuestion(selected.id, editingQId, { ...manualQ, imageUrl: manualQ.imageUrl || null });
        setEditingQId(null);
      } else {
        await liveQuizApi.addQuestions(selected.id, [{ ...manualQ, imageUrl: manualQ.imageUrl || null }]);
      }
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

  const QUIZ_LINK = `${window.location.origin}/quiz/join`;
  const displayedList = listTab === 'my' ? myQuizzes : globalQuizzes;
  const timerPct = currentQData ? (timeLeft / currentQData.timePerQ) * 100 : 0;
  const totalQ = selected?.questions?.length ?? 0;

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
                <span className="text-zinc-300 text-sm">🏫 Markaz quizi</span>
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
            <h2 className="text-lg font-bold text-white mb-4">✏️ Tahrirlash</h2>
            <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white mb-3 focus:border-violet-500 outline-none" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
            <textarea className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white mb-3 text-sm resize-none outline-none" rows={2} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
            <div className="flex items-center gap-3 mb-4">
              <label className="text-zinc-400 text-sm">Vaqt:</label>
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
              <button onClick={saveEdit} className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg">Saqlash</button>
            </div>
          </div>
        </div>
      )}

      {/* Music Manager Modal (Admin only) */}
      {showMusicManager && isAdmin && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">🎵 Musiqa boshqarish</h2>
              <button onClick={() => setShowMusicManager(false)} className="text-zinc-400 hover:text-white text-xl leading-none">×</button>
            </div>

            {/* Upload new music */}
            <div className="bg-zinc-800 rounded-xl p-4 mb-4">
              <h3 className="text-sm font-medium text-zinc-300 mb-3">Yangi musiqa yuklash</h3>
              <input
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-white text-sm mb-2 focus:border-violet-500 outline-none"
                placeholder="Musiqa nomi *"
                value={musicUploadForm.title}
                onChange={e => setMusicUploadForm(f => ({ ...f, title: e.target.value }))}
              />
              <div className="flex items-center gap-2">
                <label className="flex-1 flex items-center gap-2 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 border border-zinc-600 rounded-lg text-sm text-zinc-300 cursor-pointer transition">
                  📎 Audio fayl tanlang (MP3/WAV)
                  <input ref={musicFileRef} type="file" accept="audio/mp3,audio/mpeg,audio/wav,audio/ogg,.mp3,.wav,.ogg" className="hidden" />
                </label>
                <button
                  onClick={uploadMusic}
                  disabled={musicUploading || !musicUploadForm.title}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm disabled:opacity-50 transition"
                >
                  {musicUploading ? '...' : 'Yuklash'}
                </button>
              </div>
            </div>

            {/* Music list */}
            <div className="space-y-2 max-h-[260px] overflow-y-auto">
              {musics.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-4">Hali musiqa yuklanmagan</p>
              ) : musics.map(m => (
                <div key={m.id} className="flex items-center gap-3 bg-zinc-800 rounded-xl px-3 py-2.5">
                  <span className="text-xl">🎵</span>
                  <span className="text-white text-sm flex-1 truncate">{m.title}</span>
                  <audio src={`${API_BASE}${m.url}`} controls className="h-7 w-32 opacity-80" />
                  <button onClick={() => deleteMusic(m.id)} className="text-red-400 hover:text-red-300 text-sm px-2">🗑️</button>
                </div>
              ))}
            </div>

            <button onClick={() => setShowMusicManager(false)} className="w-full mt-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl text-sm transition">
              Yopish
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* === QUIZ LIST === */}
        <div>
          <div className="flex border-b border-zinc-800 mb-3">
            <button onClick={() => setListTab('my')} className={`px-4 py-2 text-sm font-medium transition ${listTab === 'my' ? 'text-violet-400 border-b-2 border-violet-400' : 'text-zinc-400'}`}>
              📂 Mening ({myQuizzes.length})
            </button>
            <button onClick={() => setListTab('global')} className={`px-4 py-2 text-sm font-medium transition ${listTab === 'global' ? 'text-violet-400 border-b-2 border-violet-400' : 'text-zinc-400'}`}>
              🏫 Markaz ({globalQuizzes.length})
            </button>
          </div>

          <div className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
            {displayedList.map(q => (
              <div key={q.id}
                className={`bg-zinc-900 border rounded-xl p-4 cursor-pointer transition-all hover:border-violet-500/50 ${selected?.id === q.id ? 'border-violet-500' : 'border-zinc-800'}`}
                onClick={() => loadQuiz(q)}>
                <div className="flex items-start justify-between mb-1 gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white text-sm truncate">{q.title}</h3>
                    {q.isGlobal && <span className="text-xs text-amber-400">🏫 Markaz</span>}
                    {q.createdBy && listTab === 'global' && <p className="text-xs text-zinc-500 truncate">{q.createdBy.fullName}</p>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${q.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : q.status === 'finished' ? 'bg-zinc-700 text-zinc-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {q.status === 'waiting' ? 'Kutmoqda' : q.status === 'active' ? '🟢 Faol' : 'Tugagan'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                  <span>📝 {q._count?.questions ?? 0}</span>
                  <span>👥 {q._count?.players ?? 0}</span>
                </div>
                <div className="mt-1 font-mono text-xl font-black text-violet-400 tracking-widest">{q.code}</div>

                {listTab === 'my' && (
                  <div className="flex gap-2 mt-2" onClick={e => e.stopPropagation()}>
                    {!q.isGlobal && (
                      <>
                        <button onClick={() => { setEditForm({ title: q.title, description: q.description || '', timePerQ: q.timePerQ, isGlobal: false }); setSelected(q); setShowEdit(true); }}
                          className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded">✏️</button>
                        <button onClick={() => handleDeleteQuiz(q)} className="px-2 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded">🗑️</button>
                      </>
                    )}
                    {isAdmin && q.isGlobal && (
                      <>
                        <button onClick={() => { setEditForm({ title: q.title, description: q.description || '', timePerQ: q.timePerQ, isGlobal: true }); setSelected(q); setShowEdit(true); }}
                          className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded">✏️</button>
                        <button onClick={() => handleDeleteQuiz(q)} className="px-2 py-1 text-xs bg-red-500/10 text-red-400 rounded">🗑️</button>
                      </>
                    )}
                  </div>
                )}

                {listTab === 'global' && !isAdmin && (
                  <button onClick={e => { e.stopPropagation(); useGlobal(q); }}
                    className="mt-2 w-full px-3 py-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium">
                    ▶ Ishlatish
                  </button>
                )}
                {listTab === 'global' && isAdmin && (
                  <div className="flex gap-2 mt-2" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setEditForm({ title: q.title, description: q.description || '', timePerQ: q.timePerQ, isGlobal: true }); loadQuiz(q); setShowEdit(true); }}
                      className="px-2 py-1 text-xs bg-zinc-800 text-zinc-300 rounded">✏️</button>
                    <button onClick={() => handleDeleteQuiz(q)} className="px-2 py-1 text-xs bg-red-500/10 text-red-400 rounded">🗑️</button>
                  </div>
                )}
              </div>
            ))}
            {displayedList.length === 0 && <div className="text-zinc-500 text-sm text-center py-8">Quiz yo'q</div>}
          </div>
        </div>

        {/* === DETAIL PANEL === */}
        {selected ? (
          <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col">
            {/* Quiz header bar */}
            <div className="bg-zinc-800/60 px-4 py-3 flex items-center justify-between flex-shrink-0">
              <div>
                <span className="text-white font-semibold">{selected.title}</span>
                {selected.isGlobal && <span className="ml-2 text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">🏫</span>}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-lg font-black text-violet-400">{selected.code}</span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-zinc-800 flex-shrink-0">
              {(['questions', 'game', 'stats'] as const).map(t => (
                <button key={t} onClick={() => { setTab(t); if (t === 'stats') loadStats(); }}
                  className={`px-4 py-3 text-sm font-medium transition ${tab === t ? 'text-violet-400 border-b-2 border-violet-400' : 'text-zinc-400 hover:text-white'}`}>
                  {t === 'questions' ? '📝 Savollar' : t === 'game' ? '🎮 O\'yin' : '📊 Natijalar'}
                </button>
              ))}
            </div>

            {/* ═══════════ QUESTIONS TAB ═══════════ */}
            {tab === 'questions' && (
              <div className="p-4 overflow-y-auto flex-1">
                {/* Toolbar */}
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <label className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm cursor-pointer transition">
                    📥 Excel import
                    <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelImport} />
                  </label>
                  <a href="/exam-template.xlsx" download className="text-xs text-zinc-400 hover:text-white underline">Shablon</a>
                  <span className="text-xs text-zinc-500 ml-auto">Savol | A | B | C | D | To'g'ri(0-3)</span>
                </div>

                {/* Manual Q form */}
                <div className="bg-zinc-800/50 rounded-xl p-4 mb-4">
                  <h4 className="text-sm font-medium text-white mb-3">
                    {editingQId ? 'Savolni tahrirlash' : 'Qo\'lda savol'}
                    {editingQId && (
                      <button onClick={() => { setEditingQId(null); setManualQ({ question: '', options: ['', '', '', ''], correct: 0, imageUrl: '' }); }} className="ml-3 text-xs text-zinc-400 hover:text-white border border-zinc-600 rounded px-2 py-0.5">Bekor qilish</button>
                    )}
                  </h4>
                  <input className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-white mb-2 text-sm focus:border-violet-500 outline-none" placeholder="Savol..." value={manualQ.question} onChange={e => setManualQ(q => ({ ...q, question: e.target.value }))} />
                  <div className="flex items-center gap-2 mb-3">
                    <button onClick={() => imgInputRef.current?.click()} className="px-3 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded border border-zinc-600">🖼️ Rasm</button>
                    <input ref={imgInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleImageUpload} />
                    {manualQ.imageUrl && (
                      <div className="flex items-center gap-1">
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
                    {qLoading ? '...' : editingQId ? 'Saqlash' : '+ Qo\'shish'}
                  </button>
                </div>

                {/* Q List */}
                <div className="space-y-2 max-h-[350px] overflow-y-auto">
                  {(selected.questions || []).map((q: any, i: number) => (
                    <div key={q.id} className="bg-zinc-800 rounded-lg p-3 flex items-start gap-3">
                      <span className="text-zinc-500 text-sm w-6">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium">{q.question}</p>
                        {q.imageUrl && <img src={`${API_BASE}${q.imageUrl}`} alt="" className="mt-1 h-12 rounded border border-zinc-700 object-cover" />}
                        <div className="flex gap-2 mt-1 flex-wrap">
                          {(q.options as string[]).map((o, j) => (
                            <span key={j} className={`text-xs px-2 py-0.5 rounded ${j === q.correct ? 'bg-emerald-500/20 text-emerald-400 font-medium' : 'text-zinc-500'}`}>
                              {['A', 'B', 'C', 'D'][j]}) {o}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <button onClick={() => {
                          setEditingQId(q.id);
                          setManualQ({
                            question: q.question,
                            options: q.options,
                            correct: q.correct,
                            imageUrl: q.imageUrl || '',
                          });
                        }} className="text-blue-400/60 hover:text-blue-400 text-sm">✏️</button>
                        <button onClick={() => deleteQuestion(q.id)} className="text-red-400/60 hover:text-red-400 text-sm">🗑️</button>
                      </div>
                    </div>
                  ))}
                  {!selected.questions?.length && <p className="text-zinc-500 text-sm text-center py-4">Savol yo'q</p>}
                </div>

                {/* Prepare button */}
                {gamePhase === 'idle' && (
                  <div className="mt-4 pt-4 border-t border-zinc-800">
                    <button onClick={prepareQuiz} disabled={!selected.questions?.length}
                      className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold rounded-xl disabled:opacity-40">
                      🔄 O'yinga tayyorlanish (yangi kod)
                    </button>
                  </div>
                )}
                {gamePhase !== 'idle' && (
                  <div className="mt-4 pt-4 border-t border-zinc-800">
                    <button onClick={() => setTab('game')} className="w-full py-2 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-xl">
                      🎮 O'yin paneliga o'tish →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ═══════════ GAME TAB ═══════════ */}
            {tab === 'game' && (
              <div className="p-4 flex-1 overflow-y-auto">

                {/* ── LOBBY PHASE ─────────────────────────────────── */}
                {gamePhase === 'lobby' && (
                  <div>
                    {/* Join code */}
                    <div className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/30 rounded-2xl p-5 mb-4 text-center">
                      <p className="text-zinc-400 text-xs mb-1">O'yinchilar kirish kodi</p>
                      <div className="font-mono text-5xl font-black text-violet-300 tracking-widest mb-2">{selected?.code}</div>
                      <p className="text-zinc-500 text-xs">{QUIZ_LINK}</p>
                    </div>

                    {/* Music selector */}
                    <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-4 mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-zinc-300 font-medium text-sm">🎵 Lobby musiqasi</p>
                        {isAdmin && (
                          <button onClick={() => setShowMusicManager(true)}
                            className="text-xs text-violet-400 hover:text-violet-300 border border-violet-500/30 px-2 py-1 rounded-lg transition">
                            + Musiqa boshqarish
                          </button>
                        )}
                      </div>
                      {musics.length === 0 ? (
                        <p className="text-zinc-500 text-xs text-center py-2">
                          {isAdmin ? 'Musiqa yuklanmagan. "+ Musiqa boshqarish" tugmasi orqali qo\'shing.' : 'Admin hali musiqa yuklamagan.'}
                        </p>
                      ) : (
                        <div className="space-y-1 max-h-[140px] overflow-y-auto">
                          <button
                            onClick={() => setSelectedMusicId(null)}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                              selectedMusicId === null ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:bg-zinc-700'
                            }`}>
                            <span>🔇</span> Musiqa yo'q
                          </button>
                          {musics.map(m => (
                            <button
                              key={m.id}
                              onClick={() => setSelectedMusicId(m.id)}
                              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                                selectedMusicId === m.id ? 'bg-violet-600/30 text-violet-300 border border-violet-500/50' : 'text-zinc-300 hover:bg-zinc-700'
                              }`}>
                              <span>🎵</span>
                              <span className="flex-1 text-left truncate">{m.title}</span>
                              {selectedMusicId === m.id && <span className="text-violet-400">✓</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Live player list */}
                    <div className="bg-zinc-800 rounded-xl p-4 mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-zinc-300 font-medium">O'yinchilar</p>
                        <span className="text-2xl font-black text-violet-400">{players.length}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 max-h-[200px] overflow-y-auto">
                        {players.map((p, i) => (
                          <div key={p.id || i} className="flex items-center justify-between bg-zinc-900/60 rounded-lg px-3 py-1.5 group">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <span className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">{p.fullName[0]}</span>
                              <span className="text-white text-xs truncate">{p.fullName}</span>
                            </div>
                            <button
                              onClick={async () => {
                                if (!window.confirm(`Rostdan ham ${p.fullName} ni chiqarib yubormoqchimisiz?`)) return;
                                try { await liveQuizApi.kickPlayer(selected!.id, p.id); }
                                catch(e:any) { alert(e.response?.data?.error || "Xatolik"); }
                              }}
                              className="text-red-500 transition hover:bg-red-500/20 rounded p-1"
                              title="O'yinchini chiqarib yuborish"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                          </div>
                        ))}
                        {!players.length && <p className="text-zinc-500 text-xs col-span-2 text-center py-4 animate-pulse">O'yinchilar kutilmoqda...</p>}
                      </div>
                    </div>

                    <button onClick={launchFirstQuestion}
                      className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-2xl text-lg transition">
                      🚀 O'yinni boshlash ({players.length} o'yinchi)
                    </button>
                    <p className="text-xs text-zinc-500 text-center mt-2">Tugmani bosganda 1-savol barcha ekraniga chiqadi va taymer boshlanadi</p>
                  </div>
                )}

                {/* ── QUESTION PHASE ──────────────────────────────── */}
                {gamePhase === 'question' && currentQData && (
                  <div>
                    {/* Timer + progress */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-zinc-400 text-sm">Savol {(currentQData.index ?? 0) + 1} / {currentQData.total}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-400 text-sm">Javob berdi:</span>
                          <span className="text-white font-bold">{answeredCount}/{players.length || '?'}</span>
                        </div>
                        <span className={`font-black text-2xl ${timeLeft <= 5 ? 'text-red-400 animate-pulse' : timeLeft <= 10 ? 'text-yellow-400' : 'text-white'}`}>
                          {timeLeft}s
                        </span>
                      </div>
                      <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-1000 rounded-full ${timerPct > 50 ? 'bg-emerald-500' : timerPct > 25 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${timerPct}%` }} />
                      </div>
                    </div>

                    {/* Current question */}
                    <div className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-2xl p-4 mb-4">
                      <p className="text-white font-bold text-base leading-relaxed mb-2">{currentQData.question}</p>
                      {currentQData.imageUrl && (
                        <img src={`${API_BASE}${currentQData.imageUrl}`} alt="" className="mb-2 max-h-32 rounded-lg object-cover" />
                      )}
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        {(currentQData.options as string[] || []).map((o: string, i: number) => (
                          <div key={i} className={`px-3 py-2 rounded-xl text-sm font-medium
                            ${['bg-red-500/20 text-red-300', 'bg-blue-500/20 text-blue-300', 'bg-yellow-500/20 text-yellow-300', 'bg-emerald-500/20 text-emerald-300'][i]}
                            ${i === currentQData.correct ? 'ring-2 ring-white/40' : ''}`}>
                            {['▲', '◆', '●', '■'][i]} {o}
                            {i === currentQData.correct && <span className="ml-1 text-xs">✓</span>}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Live leaderboard (from previous question) */}
                    {liveScores.length > 0 && (
                      <div className="bg-zinc-800 rounded-xl p-3 mb-4">
                        <p className="text-zinc-400 text-xs mb-2">Joriy reyting ({liveScores.length} o'yinchi)</p>
                        <div className="space-y-1 max-h-[180px] overflow-y-auto">
                          {liveScores.map((p, i) => (
                            <div key={p.id || i} className="flex items-center gap-2 text-sm">
                              <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold
                                ${i === 0 ? 'bg-yellow-400 text-black' : i === 1 ? 'bg-zinc-400 text-black' : i === 2 ? 'bg-amber-700 text-white' : 'bg-zinc-700 text-zinc-400'}`}>{i + 1}</span>
                              <span className="text-white flex-1 truncate">{p.fullName}</span>
                              <span className="text-violet-400 font-bold">
                                <AnimatedNum value={p.score} />
                              </span>
                              {p.streak >= 2 && <span className="text-amber-400 text-xs">🔥{p.streak}</span>}
                              <button
                                onClick={async () => {
                                  if (!window.confirm(`Rostdan ham ${p.fullName} ni chiqarib yubormoqchimisiz?`)) return;
                                  try { await liveQuizApi.kickPlayer(selected!.id, p.id); }
                                  catch(e:any) { alert(e.response?.data?.error || "Xatolik"); }
                                }}
                                className="text-red-500 transition hover:bg-red-500/20 rounded p-1 ml-auto"
                                title="O'yinchini chiqarib yuborish"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ACTION: Show Results button */}
                    <button onClick={showResults}
                      className="w-full py-3 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl transition">
                      📊 Natijani ko'rsatish
                    </button>
                    <p className="text-xs text-zinc-500 text-center mt-1">Barcha o'yinchilar ekraniga leaderboard chiqadi</p>
                  </div>
                )}

                {/* ── LEADERBOARD PHASE ────────────────────────────── */}
                {gamePhase === 'leaderboard' && leaderboardData && (
                  <div>
                    {/* Question result */}
                    {leaderboardData.prevQuestion && (
                      <div className="bg-zinc-800 rounded-xl p-4 mb-4">
                        <p className="text-zinc-400 text-xs mb-1">Savol natijasi:</p>
                        <p className="text-white text-sm font-medium mb-3">{leaderboardData.prevQuestion.question}</p>
                        <div className="flex gap-2 h-20 items-end">
                          {leaderboardData.prevQuestion.optionCounts.map((oc: any, idx: number) => {
                            const maxC = Math.max(...leaderboardData.prevQuestion.optionCounts.map((o: any) => o.count), 1);
                            const h = Math.max((oc.count / maxC) * 100, 4);
                            return (
                              <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                                <span className="text-xs font-bold text-white">{oc.count}</span>
                                <div className={`w-full rounded-t-sm ${oc.isCorrect ? 'bg-emerald-500' : 'bg-rose-500/60'}`} style={{ height: `${h}%` }} />
                                <span className={`text-xs ${oc.isCorrect ? 'text-emerald-400 font-bold' : 'text-zinc-500'}`}>{['A', 'B', 'C', 'D'][idx]}</span>
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-xs text-zinc-500 mt-2">{leaderboardData.prevQuestion.totalAnswers} javob berildi</p>
                      </div>
                    )}

                    {/* Animated Leaderboard */}
                    <div className="bg-zinc-800 rounded-xl p-4 mb-4">
                      <h3 className="text-white font-bold mb-3">🏆 Reyting</h3>
                      <div className="space-y-2 max-h-[280px] overflow-y-auto">
                        {(leaderboardData.players || []).map((p: any, i: number) => (
                          <div key={p.id || i} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all
                            ${i === 0 ? 'bg-yellow-500/10 border border-yellow-500/20' : i === 1 ? 'bg-zinc-400/10' : i === 2 ? 'bg-amber-700/10' : 'bg-zinc-900/60'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0
                              ${i === 0 ? 'bg-yellow-400 text-black' : i === 1 ? 'bg-zinc-300 text-black' : i === 2 ? 'bg-amber-700 text-white' : 'bg-zinc-700 text-zinc-400'}`}>
                              {i + 1}
                            </div>
                            <span className="text-white flex-1 font-medium truncate">{p.fullName}</span>
                            {p.streak >= 2 && <span className="text-amber-400 text-xs">🔥{p.streak}</span>}
                            <span className="text-violet-400 font-black text-lg">
                              <AnimatedNum value={p.score} duration={1000} />
                            </span>
                            <button
                                onClick={async () => {
                                  if (!window.confirm(`Rostdan ham ${p.fullName} ni chiqarib yubormoqchimisiz?`)) return;
                                  try { await liveQuizApi.kickPlayer(selected!.id, p.id); }
                                  catch(e:any) { alert(e.response?.data?.error || "Xatolik"); }
                                }}
                                className="text-red-500 transition hover:bg-red-500/20 rounded p-1"
                                title="O'yinchini chiqarib yuborish"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                              </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* NEXT buttons */}
                    <div className="flex gap-3">
                      {leaderboardData.nextIndex < leaderboardData.totalQuestions ? (
                        <button onClick={sendNextQuestion}
                          className="flex-1 py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold rounded-xl">
                          → {leaderboardData.nextIndex + 1}-savol boshlash
                        </button>
                      ) : (
                        <button onClick={sendNextQuestion}
                          className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-xl">
                          → Oxirgi savol
                        </button>
                      )}
                      <button onClick={finishQuiz}
                        className="px-5 py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/20 rounded-xl">
                        Yakunlash
                      </button>
                    </div>
                    <p className="text-xs text-zinc-500 text-center mt-1">
                      Tugmani bosganda keyingi savol barcha ekraniga chiqadi va taymer boshlanadi
                    </p>
                  </div>
                )}

                {/* ── FINISHED PHASE ───────────────────────────────── */}
                {gamePhase === 'finished' && (
                  <div>
                    <div className="text-center mb-4">
                      <div className="text-4xl mb-2">🏆</div>
                      <h3 className="text-white font-black text-xl">Quiz yakunlandi!</h3>
                      <p className="text-zinc-400 text-sm">{liveScores.length} o'yinchi qatnashdi</p>
                    </div>
                    <div className="space-y-2 mb-4 max-h-[300px] overflow-y-auto">
                      {liveScores.map((p, i) => (
                        <div key={p.id || i} className={`flex items-center gap-3 px-4 py-3 rounded-xl
                          ${i === 0 ? 'bg-yellow-500/10 border border-yellow-500/20' : i === 1 ? 'bg-zinc-400/10' : i === 2 ? 'bg-amber-700/10' : 'bg-zinc-800'}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm
                            ${i === 0 ? 'bg-yellow-400 text-black' : i === 1 ? 'bg-zinc-300 text-black' : i === 2 ? 'bg-amber-700 text-white' : 'bg-zinc-700 text-zinc-300'}`}>{i + 1}</div>
                          <span className="text-white flex-1 font-medium">{p.fullName}</span>
                          <span className="text-violet-400 font-black text-lg">{p.score?.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => { setTab('stats'); loadStats(); }} className="w-full py-2 bg-violet-600/20 text-violet-400 border border-violet-500/30 rounded-xl">
                      📊 Batafsil statistika
                    </button>
                  </div>
                )}

                {/* Idle state */}
                {gamePhase === 'idle' && (
                  <div className="text-center py-12">
                    <p className="text-zinc-500 mb-4">Quiz hali boshlanmagan</p>
                    <button onClick={() => setTab('questions')} className="px-6 py-2 bg-violet-600 text-white rounded-xl">
                      📝 Savollar tabiga o'tish
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ═══════════ STATS TAB ═══════════ */}
            {tab === 'stats' && (
              <div className="p-4 overflow-y-auto flex-1">
                {!statsData ? (
                  <div className="text-center py-8 text-zinc-500">
                    <p>Ma'lumot yuklanmoqda...</p>
                    <button onClick={loadStats} className="mt-3 px-4 py-2 bg-zinc-800 text-white rounded-lg text-sm">Yuklash</button>
                  </div>
                ) : (
                  <div>
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
                          {statsData.questionAnalysis.length > 0 ? Math.round(statsData.questionAnalysis.reduce((s: number, q: any) => s + q.correctPercentage, 0) / statsData.questionAnalysis.length) : 0}%
                        </p>
                        <p className="text-xs text-zinc-500">O'rtacha</p>
                      </div>
                    </div>

                    <div className="flex border-b border-zinc-700 mb-4">
                      {(['leaderboard', 'questions', 'player'] as const).map(st => (
                        <button key={st} onClick={() => setStatsTab(st)}
                          className={`px-3 py-2 text-xs font-medium transition ${statsTab === st ? 'text-violet-400 border-b-2 border-violet-400' : 'text-zinc-400'}`}>
                          {st === 'leaderboard' ? '🏆 Reyting' : st === 'questions' ? '📊 Savollar' : '👤 O\'yinchi'}
                        </button>
                      ))}
                    </div>

                    {statsTab === 'leaderboard' && (
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {statsData.leaderboard.map((p: any, i: number) => (
                          <div key={p.id} onClick={() => { setStatsPlayerSelected(statsData.playerDetails.find((pd: any) => pd.id === p.id)); setStatsTab('player'); }}
                            className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:ring-1 hover:ring-violet-500/50
                              ${i === 0 ? 'bg-yellow-500/10 border border-yellow-500/20' : i === 1 ? 'bg-zinc-400/10' : i === 2 ? 'bg-amber-700/10' : 'bg-zinc-800'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                              ${i === 0 ? 'bg-yellow-400 text-black' : i === 1 ? 'bg-zinc-400 text-black' : i === 2 ? 'bg-amber-700 text-white' : 'bg-zinc-700 text-zinc-300'}`}>{i + 1}</div>
                            <span className="flex-1 text-white font-medium">{p.fullName}</span>
                            <div className="text-right">
                              <p className="text-violet-400 font-bold text-lg">{p.score}</p>
                              <p className="text-xs text-zinc-500">{statsData.playerDetails.find((pd: any) => pd.id === p.id)?.accuracy ?? 0}%</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {statsTab === 'questions' && (
                      <div className="space-y-4 max-h-[400px] overflow-y-auto">
                        {statsData.questionAnalysis.map((q: any, i: number) => (
                          <div key={q.id} className="bg-zinc-800 rounded-xl p-4">
                            <div className="flex items-start gap-2 mb-3">
                              <span className="text-zinc-500 text-sm">{i + 1}.</span>
                              <p className="text-white text-sm font-medium flex-1">{q.question}</p>
                              <span className={`text-sm font-bold ${q.correctPercentage >= 70 ? 'text-emerald-400' : q.correctPercentage >= 40 ? 'text-amber-400' : 'text-red-400'}`}>{q.correctPercentage}%</span>
                            </div>
                            <div className="flex gap-2 h-14 items-end">
                              {q.optionDistribution.map((od: any, idx: number) => (
                                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                                  <span className="text-xs text-white">{od.count}</span>
                                  <div className={`w-full rounded-t-sm ${od.isCorrect ? 'bg-emerald-500' : 'bg-rose-500/60'}`} style={{ height: `${Math.max(od.percentage, 4)}%` }} />
                                  <span className="text-xs text-zinc-500">{['A', 'B', 'C', 'D'][idx]}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {statsTab === 'player' && (
                      <div>
                        {statsPlayerSelected ? (
                          <div>
                            <button onClick={() => setStatsPlayerSelected(null)} className="text-xs text-zinc-400 hover:text-white mb-4">← Orqaga</button>
                            <div className="bg-zinc-800 rounded-xl p-4 mb-4">
                              <h3 className="text-white font-bold text-lg">{statsPlayerSelected.fullName}</h3>
                              <div className="grid grid-cols-3 gap-3 mt-3">
                                <div className="text-center"><p className="text-violet-400 font-bold text-xl">{statsPlayerSelected.score}</p><p className="text-xs text-zinc-500">Ball</p></div>
                                <div className="text-center"><p className="text-emerald-400 font-bold text-xl">#{statsPlayerSelected.rank}</p><p className="text-xs text-zinc-500">O'rin</p></div>
                                <div className="text-center"><p className="text-amber-400 font-bold text-xl">{statsPlayerSelected.accuracy}%</p><p className="text-xs text-zinc-500">To'g'ri</p></div>
                              </div>
                            </div>
                            <div className="space-y-2 max-h-[280px] overflow-y-auto">
                              {statsPlayerSelected.answers.map((a: any, i: number) => (
                                <div key={a.questionId} className={`flex items-start gap-3 p-3 rounded-lg ${a.isCorrect ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                                  <span className={`text-sm font-bold ${a.isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>{a.isCorrect ? '✓' : '✗'}</span>
                                  <div className="flex-1">
                                    <p className="text-white text-sm">{i + 1}. {a.question}</p>
                                    <p className="text-xs text-zinc-500 mt-0.5">{a.selected !== null ? `${['A', 'B', 'C', 'D'][a.selected]} • ` : 'Javob bermadi • '}{a.points} ball • {(a.timeMs / 1000).toFixed(1)}s</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {statsData.playerDetails.map((p: any, i: number) => (
                              <button key={p.id} onClick={() => setStatsPlayerSelected(p)}
                                className="w-full flex items-center gap-3 p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-left">
                                <span className="text-zinc-500 text-sm w-5">{i + 1}</span>
                                <span className="text-white flex-1">{p.fullName}</span>
                                <p className="text-violet-400 font-bold">{p.score}</p>
                                <p className="text-xs text-zinc-500">{p.accuracy}%</p>
                              </button>
                            ))}
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
