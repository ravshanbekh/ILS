import React, { useState, useEffect, useRef } from 'react';
import { liveQuizApi } from '../../api';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = (import.meta.env.VITE_API_URL?.replace('/api', '') || '') || window.location.origin;

type Stage = 'enter-code' | 'enter-name' | 'lobby' | 'question' | 'answer-result' | 'leaderboard' | 'finished';

interface Player { id: string; fullName: string; score: number; streak: number; }
interface QuizQ { id: string; question: string; options: string[]; timePerQ: number; index: number; total: number; imageUrl?: string; }
interface LeaderboardEntry { rank: number; fullName: string; score: number; streak?: number; }

const OPTION_STYLES = [
  { bg: 'bg-red-500', hover: 'hover:bg-red-400', icon: '▲' },
  { bg: 'bg-blue-500', hover: 'hover:bg-blue-400', icon: '◆' },
  { bg: 'bg-yellow-500', hover: 'hover:bg-yellow-400', icon: '●' },
  { bg: 'bg-emerald-500', hover: 'hover:bg-emerald-400', icon: '■' },
];

export default function QuizJoinPage() {
  const [stage, setStage] = useState<Stage>('enter-code');
  const [code, setCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [quizInfo, setQuizInfo] = useState<any>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);

  // Question
  const [currentQ, setCurrentQ] = useState<QuizQ | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answerResult, setAnswerResult] = useState<{ isCorrect: boolean; points: number; streak: number; correct: number } | null>(null);
  const [myScore, setMyScore] = useState(0);
  const [myStreak, setMyStreak] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState(0);

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [prevQuestion, setPrevQuestion] = useState<any>(null);

  const timerRef = useRef<ReturnType<typeof setInterval>>();

  function setupSocket(codeToJoin: string, currentPlayer: Player) {
    const s = io(SOCKET_URL, { transports: ['websocket'] });
    s.emit('join-room', { code: codeToJoin, role: 'player' });

    s.on('quiz:player-joined', (data) => setPlayerCount(data.playerCount));
    s.on('quiz:started', (data) => {
      setCurrentQ(data.question); setSelected(null); setAnswerResult(null); setQuestionStartTime(Date.now()); setStage('question');
    });
    s.on('quiz:question', (data) => {
      setCurrentQ(data); setSelected(null); setAnswerResult(null); setQuestionStartTime(Date.now()); setStage('question');
    });
    s.on('quiz:leaderboard', (data) => {
      setLeaderboard(data.players); setPrevQuestion(data.prevQuestion); setStage('leaderboard');
    });
    s.on('quiz:finished', (data) => {
      setLeaderboard(data.leaderboard); setStage('finished');
      localStorage.removeItem('quizSession');
    });

    setSocket(s);
  }

  useEffect(() => {
    const sessionStr = localStorage.getItem('quizSession');
    if (sessionStr) {
      try {
        const sess = JSON.parse(sessionStr);
        if (sess && sess.code && sess.player) {
          setCode(sess.code);
          setPlayer(sess.player);
          setStage('lobby');
          setupSocket(sess.code, sess.player);
        }
      } catch (e) {}
    }
    
    return () => {

      socket?.disconnect();
      clearInterval(timerRef.current);
    };
  }, []);

  // Timer for current question
  useEffect(() => {
    if (stage !== 'question' || selected !== null) return;
    clearInterval(timerRef.current);
    setTimeLeft(currentQ?.timePerQ ?? 20);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          // Auto submit unanswered
          if (selected === null && player && currentQ) {
            submitAnswer(-1);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [currentQ?.id]);

  async function checkCode() {
    if (!code.trim()) return;
    setLoading(true); setError('');
    try {
      const res = await liveQuizApi.getByCode(code.trim());
      setQuizInfo(res.data.data);
      setPlayerCount(res.data.data.playerCount || 0);
      setStage('enter-name');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Kod topilmadi');
    } finally { setLoading(false); }
  }

  async function joinQuiz() {
    if (!fullName.trim() || !quizInfo) return;
    setLoading(true); setError('');
    try {
      const res = await liveQuizApi.joinQuiz(code.trim(), fullName.trim());
      const p = res.data.data.player;
      const currentPlayer = { id: p.id, fullName: p.fullName, score: 0, streak: 0 };
      setPlayer(currentPlayer);
      setStage('lobby');
      
      localStorage.setItem('quizSession', JSON.stringify({ code: code.trim(), player: currentPlayer }));
      setupSocket(code.trim(), currentPlayer);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Xatolik');
    } finally { setLoading(false); }
  }

  async function submitAnswer(optionIdx: number) {
    if (!player || !currentQ || selected !== null) return;
    clearInterval(timerRef.current);
    setSelected(optionIdx);

    const timeMs = Date.now() - questionStartTime;
    try {
      const res = await liveQuizApi.submitAnswer({
        playerId: player.id,
        questionId: currentQ.id,
        selected: optionIdx,
        timeMs,
      });
      const { isCorrect, points, streak, correct } = res.data.data;
      setMyScore(s => s + points);
      setMyStreak(streak);
      setAnswerResult({ isCorrect, points, streak, correct });
      setStage('answer-result');

      // Emit to teacher panel
      socket?.emit('player:answered', {
        code: code.trim(),
        playerId: player.id,
        fullName: player.fullName,
        isCorrect,
      });
    } catch {}
  }

  const timerPct = currentQ ? (timeLeft / currentQ.timePerQ) * 100 : 0;

  // ── RENDER ─────────────────────────────────────────────────────────────────

  if (stage === 'finished') return (
    <div className="min-h-screen bg-gradient-to-b from-violet-950 via-[#09090b] to-[#09090b] flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="text-6xl mb-4">🏆</div>
        <h1 className="text-3xl font-black text-white mb-2">Quiz tugadi!</h1>
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl px-6 py-4 mb-6 inline-block">
          <div className="text-4xl font-black text-violet-300">{myScore}</div>
          <div className="text-violet-400 text-sm">Sizning ballingiz</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden">
          {leaderboard.slice(0, 10).map((p, i) => (
            <div key={i} className={`flex items-center gap-3 px-4 py-3 border-b border-zinc-800 last:border-0 ${p.fullName === fullName ? 'bg-violet-500/10' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${i === 0 ? 'bg-yellow-400 text-black' : i === 1 ? 'bg-zinc-400 text-black' : i === 2 ? 'bg-amber-700 text-white' : 'bg-zinc-700 text-zinc-300'}`}>
                {p.rank}
              </div>
              <span className={`flex-1 font-medium ${p.fullName === fullName ? 'text-violet-300' : 'text-white'}`}>{p.fullName}</span>
              <span className="text-violet-400 font-bold">{p.score}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (stage === 'leaderboard') return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-950 to-[#09090b] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {prevQuestion && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-4 mb-4">
            <p className="text-zinc-400 text-xs mb-2">Oldingi savol:</p>
            <p className="text-white font-medium mb-2">{prevQuestion.question}</p>
            <div className="flex gap-2 flex-wrap">
              {prevQuestion.optionCounts?.map((o: any) => (
                <div key={o.option} className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm ${o.isCorrect ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>
                  {['▲','◆','●','■'][o.option]} {o.count}
                </div>
              ))}
            </div>
          </div>
        )}
        <h2 className="text-2xl font-black text-white text-center mb-4">🏅 Reyting</h2>
        <div className="space-y-2">
          {leaderboard.slice(0, 8).map((p, i) => {
            const isMe = p.fullName === fullName;
            return (
              <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-500 ${isMe ? 'bg-violet-500/20 border border-violet-500/40 scale-[1.02]' : 'bg-zinc-900 border border-zinc-800'}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm ${i === 0 ? 'bg-yellow-400 text-black' : i === 1 ? 'bg-zinc-400 text-black' : i === 2 ? 'bg-amber-700 text-white' : 'bg-zinc-700 text-zinc-300'}`}>
                  {p.rank}
                </div>
                <span className={`flex-1 font-medium ${isMe ? 'text-violet-300' : 'text-white'}`}>{p.fullName}{isMe ? ' 👈' : ''}</span>
                {p.streak && p.streak >= 2 ? <span className="text-amber-400 text-xs">🔥×{p.streak}</span> : null}
                <span className="text-violet-400 font-bold">{p.score}</span>
              </div>
            );
          })}
        </div>
        <p className="text-center text-zinc-500 text-sm mt-6 animate-pulse">Keyingi savol yuklanmoqda...</p>
      </div>
    </div>
  );

  if (stage === 'answer-result' && answerResult) return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-6 transition-all ${answerResult.isCorrect ? 'bg-gradient-to-b from-emerald-950 to-[#09090b]' : 'bg-gradient-to-b from-red-950 to-[#09090b]'}`}>
      <div className="text-7xl mb-4 animate-bounce">
        {answerResult.isCorrect ? '✅' : '❌'}
      </div>
      <h2 className="text-3xl font-black text-white mb-2">
        {answerResult.isCorrect ? 'To\'g\'ri!' : 'Xato!'}
      </h2>
      {answerResult.isCorrect ? (
        <div className="text-center">
          <div className="text-5xl font-black text-emerald-300 mb-1">+{answerResult.points}</div>
          <div className="text-emerald-400 text-sm">ball</div>
          {answerResult.streak >= 2 && (
            <div className="mt-3 flex items-center gap-2 justify-center bg-amber-500/20 px-4 py-2 rounded-full">
              <span className="text-2xl">🔥</span>
              <span className="text-amber-300 font-bold">{answerResult.streak} ketma-ket streak!</span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-red-300 text-sm">Streak uzildi. Keyingi savolda yaxshirog'ini qiling!</p>
      )}
      <div className="mt-6 bg-white/5 rounded-xl px-6 py-3 text-center">
        <div className="text-2xl font-black text-white">{myScore}</div>
        <div className="text-zinc-400 text-xs">Umumiy ball</div>
      </div>
      <p className="text-zinc-500 text-sm mt-6 animate-pulse">Leaderboard yuklanmoqda...</p>
    </div>
  );

  if (stage === 'question' && currentQ) return (
    <div className="min-h-screen bg-gradient-to-b from-[#0c0c1e] to-[#09090b] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/30">
        <div className="text-white font-bold text-sm">{fullName}</div>
        <div className="flex items-center gap-3">
          <div className="text-violet-400 font-bold">{myScore} ball</div>
          {myStreak >= 2 && <span className="text-amber-400 text-sm">🔥×{myStreak}</span>}
        </div>
      </div>

      {/* Timer bar */}
      <div className="h-3 bg-zinc-800 relative">
        <div
          className={`h-full transition-all duration-1000 ${timerPct > 50 ? 'bg-emerald-500' : timerPct > 25 ? 'bg-yellow-500' : 'bg-red-500'}`}
          style={{ width: `${timerPct}%` }}
        />
        <div className={`absolute right-3 top-0 h-full flex items-center text-xs font-bold ${timerPct < 25 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
          {timeLeft}s
        </div>
      </div>

      {/* Question progress */}
      <div className="text-center py-3 text-zinc-400 text-sm">
        Savol {currentQ.index + 1} / {currentQ.total}
      </div>

      {/* Question */}
      <div className="flex-1 flex flex-col px-4">
        <div className="bg-white/5 backdrop-blur rounded-2xl p-6 mb-4 text-center min-h-[100px] flex items-center justify-center">
          {currentQ.imageUrl && (
            <img src={currentQ.imageUrl} alt="" className="max-h-40 rounded-xl mb-3 mx-auto" />
          )}
          <p className="text-white text-xl font-bold leading-relaxed">{currentQ.question}</p>
        </div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-3 pb-6">
          {currentQ.options.map((opt, i) => {
            const style = OPTION_STYLES[i];
            const isChosen = selected === i;
            return (
              <button
                key={i}
                onClick={() => submitAnswer(i)}
                disabled={selected !== null}
                className={`${style.bg} ${selected === null ? style.hover : ''} text-white rounded-2xl p-4 flex items-center gap-3 font-semibold text-left transition-all duration-150 active:scale-95 shadow-lg min-h-[80px] ${isChosen ? 'ring-4 ring-white ring-offset-2 ring-offset-transparent' : ''} ${selected !== null && !isChosen ? 'opacity-50' : ''}`}
              >
                <span className="text-3xl opacity-80 flex-shrink-0">{style.icon}</span>
                <span className="text-sm leading-tight">{opt}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (stage === 'lobby') return (
    <div className="min-h-screen bg-gradient-to-b from-violet-950 to-[#09090b] flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 bg-violet-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse text-4xl">
          ⚡
        </div>
        <h2 className="text-2xl font-black text-white mb-1">{quizInfo?.title}</h2>
        <p className="text-zinc-400 mb-6">Siz: <span className="text-violet-300 font-bold">{fullName}</span></p>
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6">
          <div className="text-5xl font-black text-violet-300 mb-1">{playerCount}</div>
          <div className="text-zinc-400 text-sm mb-4">o'yinchi ulandi</div>
          <div className="flex justify-center gap-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
          <p className="text-zinc-500 text-xs mt-3 animate-pulse">O'qituvchi quizni boshlaguncha kuting...</p>
        </div>
      </div>
    </div>
  );

  if (stage === 'enter-name') return (
    <div className="min-h-screen bg-gradient-to-b from-violet-950 to-[#09090b] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">👤</div>
          <h2 className="text-2xl font-black text-white">{quizInfo?.title}</h2>
          <p className="text-zinc-400 text-sm mt-1">{playerCount} o'yinchi ulandi</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6">
          <label className="text-zinc-300 text-sm font-medium mb-2 block">Ism va familyangiz</label>
          <input
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-lg font-medium mb-4 focus:border-violet-500 outline-none transition text-center"
            placeholder="Ism Familya"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && joinQuiz()}
            autoFocus
          />
          {error && <p className="text-red-400 text-sm mb-3 text-center">{error}</p>}
          <button
            onClick={joinQuiz}
            disabled={loading || !fullName.trim()}
            className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-black rounded-xl transition disabled:opacity-40 text-lg"
          >{loading ? 'Kirmoqda...' : 'Kirish! 🚀'}</button>
        </div>
      </div>
    </div>
  );

  // Enter code stage
  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-950 via-[#0c0c1e] to-[#09090b] flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="text-6xl mb-4">⚡</div>
        <h1 className="text-4xl font-black text-white mb-2">Live Quiz</h1>
        <p className="text-zinc-400 mb-8">O'qituvchidan kod olib kiriting</p>

        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 shadow-2xl">
          <label className="text-zinc-300 text-sm font-medium mb-3 block">6 xonali kod</label>
          <input
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-4 text-white text-4xl font-black tracking-widest text-center focus:border-violet-500 outline-none transition mb-4"
            placeholder="000000"
            value={code}
            maxLength={6}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => e.key === 'Enter' && code.length === 6 && checkCode()}
          />
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <button
            onClick={checkCode}
            disabled={loading || code.length !== 6}
            className="w-full py-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-black rounded-xl transition disabled:opacity-40 text-xl"
          >{loading ? '...' : 'Kirish →'}</button>
        </div>
      </div>
    </div>
  );
}
