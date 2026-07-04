import React, { useState, useEffect, useCallback } from 'react';
import { liveQuizApi } from '../../api';
import * as XLSX from 'xlsx';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = (import.meta.env.VITE_API_URL?.replace('/api', '') || '') || window.location.origin;

interface Quiz {
  id: string;
  title: string;
  code: string;
  status: 'waiting' | 'active' | 'finished';
  timePerQ: number;
  currentQ: number;
  _count?: { questions: number; players: number };
}

export default function LiveQuizPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', timePerQ: 20 });
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<'questions' | 'control' | 'stats'>('questions');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [manualQ, setManualQ] = useState({ question: '', options: ['','','',''], correct: 0 });
  const [qLoading, setQLoading] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<any>(null);

  useEffect(() => { fetchQuizzes(); }, []);

  // Connect socket when quiz is selected and active
  useEffect(() => {
    if (!selected) return;
    const s = io(SOCKET_URL, { transports: ['websocket'] });
    s.emit('join-room', { code: selected.code, role: 'teacher' });
    s.on('quiz:player-joined', (data) => {
      setPlayers(prev => [...prev.filter(p => p.id !== data.playerId), { id: data.playerId, fullName: data.fullName, score: 0, streak: 0 }]);
    });
    s.on('quiz:answer-received', (data) => {
      // flash logic if needed
    });
    s.on('quiz:leaderboard', (data) => {
      setLeaderboardData(data);
      setPlayers(data.players);
    });
    s.on('quiz:question', () => {
      setLeaderboardData(null);
    });
    setSocket(s);
    return () => { s.disconnect(); };
  }, [selected?.id]);

  async function fetchQuizzes() {
    const res = await liveQuizApi.getMyQuizzes();
    setQuizzes(res.data.data);
  }

  async function createQuiz() {
    setCreating(true);
    try {
      await liveQuizApi.create(form);
      setShowCreate(false);
      setForm({ title: '', timePerQ: 20 });
      fetchQuizzes();
    } finally { setCreating(false); }
  }

  async function loadQuiz(q: Quiz) {
    const res = await liveQuizApi.getById(q.id);
    setSelected(res.data.data);
    setPlayers(res.data.data.players || []);
    setTab('questions');
  }

  async function startQuiz() {
    if (!selected) return;
    const q = selected.questions?.[0];
    if (!q) return alert('Hech qanday savol yo\'q');
    await liveQuizApi.startQuiz(selected.id);
    const res = await liveQuizApi.getById(selected.id);
    setSelected(res.data.data);
    setTab('control');
    // Broadcast to socket room
    socket?.emit('teacher:next-question', { code: selected.code, questionData: { ...q, index: 0, total: selected.questions.length, timePerQ: selected.timePerQ } });
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
    const res = await liveQuizApi.getById(selected.id);
    setSelected(res.data.data);
    setPlayers(res.data.data.players.sort((a: any, b: any) => b.score - a.score));
    setTab('stats');
    fetchQuizzes();
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
        options: [String(r[1]||''), String(r[2]||''), String(r[3]||''), String(r[4]||'')],
        correct: Number(r[5] ?? 0),
      }));
      if (!parsed.length) return;
      setQLoading(true);
      try {
        await liveQuizApi.bulkAddQuestions(selected.id, parsed);
        const res = await liveQuizApi.getById(selected.id);
        setSelected(res.data.data);
        fetchQuizzes();
      } finally { setQLoading(false); }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  }

  async function addManualQ() {
    if (!selected || !manualQ.question.trim()) return;
    setQLoading(true);
    try {
      await liveQuizApi.addQuestions(selected.id, [manualQ]);
      const res = await liveQuizApi.getById(selected.id);
      setSelected(res.data.data);
      setManualQ({ question: '', options: ['','','',''], correct: 0 });
      fetchQuizzes();
    } finally { setQLoading(false); }
  }

  const currentQData = selected?.questions?.[selected?.currentQ];
  const QUIZ_LINK = `${window.location.origin}/quiz/join`;

  return (
    <div className="p-6 max-w-7xl mx-auto">
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
            <input
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white mb-3 focus:border-violet-500 outline-none"
              placeholder="Quiz nomi"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
            <div className="flex items-center gap-3 mb-4">
              <label className="text-zinc-400 text-sm whitespace-nowrap">Har savol vaqti (soniya):</label>
              <input type="number" min={5} max={120}
                className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white focus:border-violet-500 outline-none"
                value={form.timePerQ}
                onChange={e => setForm(f => ({ ...f, timePerQ: Number(e.target.value) }))}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2 bg-zinc-700 text-white rounded-lg">Bekor</button>
              <button onClick={createQuiz} disabled={creating || !form.title} className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium disabled:opacity-50">
                {creating ? '...' : 'Yaratish'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quiz list */}
        <div className="space-y-3">
          {quizzes.map(q => (
            <div
              key={q.id}
              onClick={() => loadQuiz(q)}
              className={`bg-zinc-900 border rounded-xl p-4 cursor-pointer transition-all hover:border-violet-500/50 ${selected?.id === q.id ? 'border-violet-500' : 'border-zinc-800'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-white text-sm">{q.title}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${q.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : q.status === 'finished' ? 'bg-zinc-700 text-zinc-400' : 'bg-amber-500/20 text-amber-400'}`}>
                  {q.status === 'waiting' ? 'Kutmoqda' : q.status === 'active' ? '🟢 Faol' : 'Tugagan'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-500">
                <span>📝 {q._count?.questions ?? 0} savol</span>
                <span>👥 {q._count?.players ?? 0} o'yinchi</span>
              </div>
              <div className="mt-2 font-mono text-2xl font-black text-violet-400 tracking-widest">{q.code}</div>
              <div className="text-xs text-zinc-500 mt-1">
                O'yinchi havolasi: <span className="text-violet-300">{QUIZ_LINK}</span>
              </div>
            </div>
          ))}
          {quizzes.length === 0 && <div className="text-zinc-500 text-sm text-center py-6">Hali quiz yo'q</div>}
        </div>

        {/* Detail */}
        {selected ? (
          <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="flex border-b border-zinc-800">
              {(['questions', 'control', 'stats'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-3 text-sm font-medium transition ${tab === t ? 'text-violet-400 border-b-2 border-violet-400' : 'text-zinc-400 hover:text-white'}`}
                >
                  {t === 'questions' ? '📝 Savollar' : t === 'control' ? '🎮 Boshqarish' : '📊 Natijalar'}
                </button>
              ))}
            </div>

            {tab === 'questions' && (
              <div className="p-4">
                {/* Import */}
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <label className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm cursor-pointer transition">
                    📥 Excel import
                    <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelImport} />
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

                {/* Manual */}
                <div className="bg-zinc-800/50 rounded-xl p-4 mb-4">
                  <h4 className="text-sm font-medium text-white mb-3">Qo'lda savol</h4>
                  <input
                    className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-white mb-2 text-sm focus:border-violet-500 outline-none"
                    placeholder="Savol..."
                    value={manualQ.question}
                    onChange={e => setManualQ(q => ({ ...q, question: e.target.value }))}
                  />
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {manualQ.options.map((o, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <button
                          onClick={() => setManualQ(q => ({ ...q, correct: i }))}
                          className={`w-7 h-7 rounded-full text-xs font-bold flex-shrink-0 ${manualQ.correct === i ? 'bg-violet-500 text-white' : 'bg-zinc-700 text-zinc-400'}`}
                        >{['A','B','C','D'][i]}</button>
                        <input
                          className="flex-1 bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm text-white focus:border-violet-500 outline-none"
                          placeholder={`Variant ${['A','B','C','D'][i]}`}
                          value={o}
                          onChange={e => setManualQ(q => { const opts=[...q.options]; opts[i]=e.target.value; return { ...q, options: opts }; })}
                        />
                      </div>
                    ))}
                  </div>
                  <button onClick={addManualQ} disabled={qLoading} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm">
                    + Qo'shish
                  </button>
                </div>

                {/* Question list */}
                <div className="space-y-2 max-h-[350px] overflow-y-auto">
                  {(selected.questions || []).map((q: any, i: number) => (
                    <div key={q.id} className="bg-zinc-800 rounded-lg p-3 flex items-start gap-3">
                      <span className="text-zinc-500 text-sm w-6 flex-shrink-0">{i+1}.</span>
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium">{q.question}</p>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          {(q.options as string[]).map((o, j) => (
                            <span key={j} className={`text-xs px-2 py-0.5 rounded ${j === q.correct ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500'}`}>
                              {['A','B','C','D'][j]}) {o}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Start button */}
                {selected.status === 'waiting' && (
                  <div className="mt-4 pt-4 border-t border-zinc-800">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-white font-semibold">Quizni boshlash</p>
                        <p className="text-zinc-400 text-xs">O'yinchilar kodi kiritib kutmoqda</p>
                      </div>
                      <div className="text-center">
                        <div className="font-mono text-3xl font-black text-violet-400">{selected.code}</div>
                        <div className="text-xs text-zinc-500">Kirish kodi</div>
                      </div>
                    </div>
                    <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3 mb-3 flex items-center gap-3">
                      <div className="text-2xl font-bold text-violet-300">{players.length}</div>
                      <div className="text-zinc-400 text-sm">o'yinchi ulandi</div>
                    </div>
                    <button
                      onClick={startQuiz}
                      disabled={!selected.questions?.length}
                      className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold rounded-xl transition disabled:opacity-40"
                    >🚀 Quizni boshlash</button>
                  </div>
                )}
              </div>
            )}

            {tab === 'control' && selected.status === 'active' && (
              <div className="p-4">
                {/* Current question display */}
                <div className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-xl p-4 mb-4">
                  <div className="text-xs text-violet-400 mb-2">Savol {(selected.currentQ || 0) + 1} / {selected.questions?.length}</div>
                  <p className="text-white text-lg font-semibold mb-3">{currentQData?.question}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(currentQData?.options as string[] || []).map((o: string, i: number) => (
                      <div key={i} className={`px-3 py-2 rounded-lg text-sm ${i === currentQData?.correct ? 'bg-emerald-500/20 text-emerald-400 font-medium' : 'bg-zinc-800 text-zinc-400'}`}>
                        {['▲','◆','●','■'][i]} {o}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Live players or Leaderboard stats */}
                {leaderboardData ? (
                  <div className="bg-zinc-800 rounded-xl p-4 mb-4 border border-violet-500/30">
                    <h3 className="text-white font-bold mb-3 text-lg">Natijalar (Reyting)</h3>
                    <div className="mb-4">
                      <p className="text-zinc-400 text-sm mb-2">{leaderboardData.prevQuestion?.question}</p>
                      <div className="flex gap-2 h-24 items-end bg-zinc-900/50 p-3 rounded-lg border border-zinc-700">
                        {leaderboardData.prevQuestion?.optionCounts.map((oc: any, idx: number) => {
                          const maxCount = Math.max(...leaderboardData.prevQuestion.optionCounts.map((o:any)=>o.count), 1);
                          const h = (oc.count / maxCount) * 100;
                          return (
                            <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                              <span className="text-xs font-bold text-white">{oc.count}</span>
                              <div className={`w-full rounded-t-sm transition-all ${oc.isCorrect ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ height: `${h}%` }}></div>
                              <span className="text-xs text-zinc-500">{['A','B','C','D'][idx]}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="space-y-1 max-h-[250px] overflow-y-auto">
                      {leaderboardData.players.slice(0, 10).map((p: any, i: number) => (
                        <div key={p.id || i} className="flex items-center gap-3 bg-zinc-900/80 p-2 rounded border border-zinc-700/50">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i===0?'bg-yellow-500 text-black':i===1?'bg-zinc-300 text-black':i===2?'bg-amber-600 text-white':'bg-zinc-800 text-zinc-400'}`}>{i+1}</span>
                          <span className="text-white flex-1 font-medium">{p.fullName}</span>
                          <span className="text-violet-400 font-bold">{p.score}</span>
                          {p.streak >= 2 && <span className="text-amber-400 text-xs px-1 bg-amber-500/10 rounded">🔥{p.streak}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-zinc-800 rounded-xl p-3 mb-4">
                    <p className="text-sm font-medium text-zinc-300 mb-2">O'yinchilar ({players.length})</p>
                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                      {players.map((p, i) => (
                        <div key={p.id || i} className="flex items-center gap-2 text-sm">
                          <span className="text-zinc-500 w-5 text-xs">{i+1}</span>
                          <span className="text-white flex-1">{p.fullName}</span>
                          <span className="text-violet-400 font-bold">{p.score}</span>
                          {p.streak >= 2 && <span className="text-amber-400 text-xs">🔥{p.streak}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Controls */}
                <div className="flex gap-3">
                  <button
                    onClick={nextQ}
                    disabled={(selected.currentQ || 0) >= (selected.questions?.length || 0) - 1}
                    className="flex-1 py-3 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl transition disabled:opacity-30"
                  >→ Keyingi savol</button>
                  <button
                    onClick={finishQuiz}
                    className="px-6 py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/20 rounded-xl transition"
                  >Yakunlash</button>
                </div>
              </div>
            )}

            {tab === 'stats' && (
              <div className="p-4">
                <h3 className="text-white font-semibold mb-4">🏆 Yakuniy natijalar</h3>
                <div className="space-y-2">
                  {players.map((p, i) => (
                    <div key={p.id || i} className={`flex items-center gap-3 p-3 rounded-xl ${i === 0 ? 'bg-yellow-500/10 border border-yellow-500/20' : i === 1 ? 'bg-zinc-400/10 border border-zinc-400/20' : i === 2 ? 'bg-amber-700/10 border border-amber-700/20' : 'bg-zinc-800'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${i === 0 ? 'bg-yellow-400 text-black' : i === 1 ? 'bg-zinc-400 text-black' : i === 2 ? 'bg-amber-700 text-white' : 'bg-zinc-700 text-zinc-300'}`}>
                        {i + 1}
                      </div>
                      <span className="flex-1 text-white font-medium">{p.fullName}</span>
                      <span className="text-violet-400 font-bold text-lg">{p.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 border-dashed rounded-xl flex items-center justify-center">
            <p className="text-zinc-500 text-sm">Quiz tanlang</p>
          </div>
        )}
      </div>
    </div>
  );
}
