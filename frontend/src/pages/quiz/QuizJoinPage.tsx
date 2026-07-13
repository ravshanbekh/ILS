import React, { useState, useEffect, useRef } from 'react';
import { liveQuizApi } from '../../api';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = (import.meta.env.VITE_API_URL?.replace('/api', '') || '') || window.location.origin;

type Stage = 'enter-code' | 'enter-name' | 'lobby' | 'question' | 'answer-result' | 'leaderboard' | 'finished';

interface Player { id: string; fullName: string; score: number; streak: number; }
interface QuizQ { id: string; question: string; options: string[]; timePerQ: number; index: number; total: number; imageUrl?: string; }
interface LeaderboardEntry { rank: number; fullName: string; score: number; streak?: number; }

const OPTION_STYLES = [
  { bg: 'bg-red-500',     hover: 'hover:bg-red-400',     icon: '▲', label: 'A' },
  { bg: 'bg-blue-500',    hover: 'hover:bg-blue-400',    icon: '◆', label: 'B' },
  { bg: 'bg-yellow-500',  hover: 'hover:bg-yellow-400',  icon: '●', label: 'C' },
  { bg: 'bg-emerald-500', hover: 'hover:bg-emerald-400', icon: '■', label: 'D' },
];

// ─── Score Counter Animation ──────────────────────────────────────────────────
function AnimatedScore({ target, duration = 1200 }: { target: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const start = useRef(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    const begin = Date.now();
    const from = start.current;
    function tick() {
      const elapsed = Date.now() - begin;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
      setDisplay(Math.round(from + (target - from) * ease));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
      else start.current = target;
    }
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target]);

  return <>{display.toLocaleString()}</>;
}

// ─── Confetti particle ────────────────────────────────────────────────────────
function Confetti() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-10">
      {Array.from({ length: 50 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-3 rounded-sm animate-fall"
          style={{
            left: `${Math.random() * 100}%`,
            top: '-10px',
            backgroundColor: ['#a855f7', '#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#f97316'][i % 6],
            animationDelay: `${Math.random() * 3}s`,
            animationDuration: `${2 + Math.random() * 3}s`,
            transform: `rotate(${Math.random() * 360}deg)`,
          }}
        />
      ))}
    </div>
  );
}

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

  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameVal, setEditNameVal] = useState('');
  // Question state
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

  // Finished state extras
  const [myRank, setMyRank] = useState<number | null>(null);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [scoreHistory, setScoreHistory] = useState<Array<{ q: number; pts: number; total: number }>>([]);

  const timerRef = useRef<number>(0);
  const scoreRef = useRef(0);
  const qIndexRef = useRef(0);

  function leaveQuiz() {
    if (player?.id) {
      liveQuizApi.leaveQuiz(player.id).catch(() => {});
    }
    localStorage.removeItem('quizSession');
    socket?.disconnect();
    setSocket(null);
    setPlayer(null);
    setCode('');
    setFullName('');
    setQuizInfo(null);
    setStage('enter-code');
    setError('');
    setMyScore(0);
    setMyStreak(0);
    setScoreHistory([]);
  }

  function setupSocket(codeToJoin: string, currentPlayer: Player) {
    const s = io(SOCKET_URL, { transports: ['websocket'] });
    
    s.on('connect', () => {
      s.emit('join-room', { code: codeToJoin, role: 'player', playerId: currentPlayer.id });
    });

    s.on('quiz:player-joined', (data) => setPlayerCount(data.playerCount));
    s.on('quiz:started', (data) => {
      qIndexRef.current = 0;
      setCurrentQ(data.question);
      setSelected(null);
      setAnswerResult(null);
      setQuestionStartTime(Date.now());
      setStage('question');
    });
    s.on('quiz:question', (data) => {
      qIndexRef.current = data.index;
      setCurrentQ(data);
      setSelected(null);
      setAnswerResult(null);
      setQuestionStartTime(Date.now());
      setStage('question');
    });
    s.on('quiz:leaderboard', (data) => {
      setLeaderboard(data.players);
      setPrevQuestion(data.prevQuestion);
      setStage('leaderboard');
    });
    s.on('quiz:finished', (data) => {
      setLeaderboard(data.leaderboard);
      setTotalPlayers(data.leaderboard.length);
      const me = data.leaderboard.find((p: any) => p.fullName === currentPlayer.fullName);
      setMyRank(me?.rank ?? null);
      setStage('finished');
      localStorage.removeItem('quizSession');
    });
    s.on('quiz:player-kicked', (data) => {
      if (data.playerId === currentPlayer.id) {
        alert("Siz o'yindan chetlatildingiz");
        leaveQuiz();
      }
    });

    setSocket(s);
  }

  useEffect(() => {
    const sessionStr = localStorage.getItem('quizSession');
    if (sessionStr) {
      try {
        const sess = JSON.parse(sessionStr);
        if (sess?.code && sess?.player) {
          // Verify session is still valid
          liveQuizApi.getByCode(sess.code).then((res) => {
            setCode(sess.code);
            setPlayer(sess.player);
            setFullName(sess.player.fullName);
            setQuizInfo(res.data.data);
            setPlayerCount(res.data.data.playerCount || 0);
            setStage('lobby');
            setupSocket(sess.code, sess.player);
          }).catch(() => {
            // Quiz no longer exists or ended — clear stale session
            localStorage.removeItem('quizSession');
          });
        }
      } catch (e) {
        localStorage.removeItem('quizSession');
      }
    }
    return () => { socket?.disconnect(); clearInterval(timerRef.current); };
  }, []);

  // Timer
  useEffect(() => {
    if (stage !== 'question' || selected !== null) return;
    clearInterval(timerRef.current);
    setTimeLeft(currentQ?.timePerQ ?? 20);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          if (selected === null && player && currentQ) submitAnswer(-1);
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

  async function updateName() {
    if (!editNameVal.trim() || !player) return;
    setLoading(true);
    try {
      await liveQuizApi.updatePlayerName(player.id, editNameVal.trim());
      const newName = editNameVal.trim();
      setFullName(newName);
      setPlayer({ ...player, fullName: newName });
      localStorage.setItem('quizSession', JSON.stringify({ code: code.trim(), player: { ...player, fullName: newName } }));
      setIsEditingName(false);
    } catch (e: any) {
      alert("Xatolik yuz berdi");
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
      const res = await liveQuizApi.submitAnswer({ playerId: player.id, questionId: currentQ.id, selected: optionIdx, timeMs });
      const { isCorrect, points, streak, correct } = res.data.data;
      const newTotal = myScore + points;
      scoreRef.current = newTotal;
      setMyScore(newTotal);
      setMyStreak(streak);
      setAnswerResult({ isCorrect, points, streak, correct });

      // Track score history
      setScoreHistory(prev => [...prev, { q: qIndexRef.current + 1, pts: points, total: newTotal }]);
      setStage('answer-result');

      socket?.emit('player:answered', { code: code.trim(), playerId: player.id, fullName: player.fullName, isCorrect });
    } catch {}
  }

  const timerPct = currentQ ? (timeLeft / currentQ.timePerQ) * 100 : 0;
  const myLeaderboardEntry = leaderboard.find(p => p.fullName === fullName);
  const myCurrentRank = myLeaderboardEntry?.rank ?? leaderboard.findIndex(p => p.fullName === fullName) + 1;

  // ── FINISHED STAGE ──────────────────────────────────────────────────────────
  if (stage === 'finished') {
    const isTop3 = myRank && myRank <= 3;
    const rankEmoji = myRank === 1 ? '🥇' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : '🏅';
    const rankColors = ['', 'from-yellow-500 to-amber-400', 'from-zinc-400 to-zinc-300', 'from-amber-700 to-amber-600'];

    return (
      <div className="min-h-screen bg-gradient-to-b from-violet-950 via-[#09090b] to-[#09090b] flex flex-col items-center justify-start p-4 pt-10">
        {isTop3 && <Confetti />}

        {/* My result hero */}
        <div className="relative z-20 w-full max-w-md mb-6">
          <div className={`rounded-3xl p-6 text-center ${isTop3 ? `bg-gradient-to-br ${rankColors[myRank!]} text-black shadow-2xl` : 'bg-zinc-900 border border-zinc-700'}`}>
            <div className="text-7xl mb-3 animate-bounce">{rankEmoji}</div>
            <h1 className={`text-3xl font-black mb-1 ${isTop3 ? 'text-black' : 'text-white'}`}>{fullName}</h1>
            <p className={`text-sm mb-4 ${isTop3 ? 'text-black/70' : 'text-zinc-400'}`}>
              {totalPlayers} o'yinchi ichida
            </p>

            {/* Rank badge */}
            <div className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl mb-4 ${isTop3 ? 'bg-black/20' : 'bg-violet-500/10 border border-violet-500/30'}`}>
              <span className={`text-5xl font-black ${isTop3 ? 'text-black' : 'text-violet-300'}`}>#{myRank ?? '?'}</span>
              <span className={`text-sm ${isTop3 ? 'text-black/70' : 'text-zinc-400'}`}>O'rin</span>
            </div>

            {/* Score */}
            <div className={`text-6xl font-black mb-1 ${isTop3 ? 'text-black' : 'text-violet-400'}`}>
              <AnimatedScore target={myScore} duration={1500} />
            </div>
            <p className={`text-sm ${isTop3 ? 'text-black/70' : 'text-zinc-400'}`}>ball</p>

            {/* Accuracy */}
            {scoreHistory.length > 0 && (
              <div className="mt-4 flex justify-center gap-4">
                <div className={`text-center ${isTop3 ? 'text-black/80' : 'text-zinc-300'}`}>
                  <p className="text-xl font-bold">{scoreHistory.filter(s => s.pts > 0).length}</p>
                  <p className="text-xs">To'g'ri</p>
                </div>
                <div className="w-px bg-white/20" />
                <div className={`text-center ${isTop3 ? 'text-black/80' : 'text-zinc-300'}`}>
                  <p className="text-xl font-bold">{scoreHistory.length - scoreHistory.filter(s => s.pts > 0).length}</p>
                  <p className="text-xs">Xato</p>
                </div>
                <div className="w-px bg-white/20" />
                <div className={`text-center ${isTop3 ? 'text-black/80' : 'text-zinc-300'}`}>
                  <p className="text-xl font-bold">{scoreHistory.length > 0 ? Math.round(scoreHistory.filter(s => s.pts > 0).length / scoreHistory.length * 100) : 0}%</p>
                  <p className="text-xs">Aniqlik</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Full leaderboard */}
        <div className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-zinc-800">
            <h2 className="text-white font-bold">🏆 Yakuniy reyting</h2>
          </div>
          {leaderboard.slice(0, 15).map((p, i) => {
            const isMe = p.fullName === fullName;
            return (
              <div key={i} className={`flex items-center gap-3 px-4 py-3 border-b border-zinc-800/50 last:border-0 transition-all ${isMe ? 'bg-violet-500/15 border-l-2 border-l-violet-500' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0
                  ${i === 0 ? 'bg-yellow-400 text-black' : i === 1 ? 'bg-zinc-400 text-black' : i === 2 ? 'bg-amber-700 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                  {p.rank}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold truncate ${isMe ? 'text-violet-300' : 'text-white'}`}>
                    {p.fullName}{isMe ? ' 👈' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {p.streak && p.streak >= 3 && <span className="text-amber-400 text-xs">🔥{p.streak}</span>}
                  <span className={`font-bold text-lg ${isMe ? 'text-violet-400' : 'text-white'}`}>{p.score.toLocaleString()}</span>
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={leaveQuiz}
          className="px-8 py-3 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl transition mb-10">
          Yana o'ynash
        </button>

        <style>{`
          @keyframes fall {
            0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
            100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
          }
          .animate-fall { animation: fall linear infinite; }
        `}</style>
      </div>
    );
  }

  // ── LEADERBOARD STAGE ───────────────────────────────────────────────────────
  if (stage === 'leaderboard') return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-950 to-[#09090b] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Previous question result */}
        {prevQuestion && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-4 mb-4">
            <p className="text-zinc-400 text-xs mb-1">Oldingi savol:</p>
            <p className="text-white text-sm font-medium mb-3">{prevQuestion.question}</p>
            <div className="flex gap-2 h-16 items-end">
              {prevQuestion.optionCounts?.map((o: any, idx: number) => {
                const maxCount = Math.max(...prevQuestion.optionCounts.map((x: any) => x.count), 1);
                const h = Math.max((o.count / maxCount) * 100, 4);
                return (
                  <div key={o.option} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-bold text-white">{o.count}</span>
                    <div className={`w-full rounded-t-sm ${o.isCorrect ? 'bg-emerald-500' : 'bg-zinc-700'}`} style={{ height: `${h}%` }} />
                    <span className={`text-xs ${o.isCorrect ? 'text-emerald-400 font-bold' : 'text-zinc-500'}`}>{['A', 'B', 'C', 'D'][idx]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* My rank spotlight */}
        {myCurrentRank > 0 && (
          <div className="bg-violet-500/20 border border-violet-500/40 rounded-2xl px-4 py-3 mb-4 flex items-center justify-between">
            <div>
              <p className="text-violet-300 text-xs">Sizning o'rningiz</p>
              <p className="text-white font-bold">{fullName}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-violet-300">#{myCurrentRank}</p>
              <p className="text-violet-400 text-sm font-bold">
                <AnimatedScore target={myScore} /> ball
              </p>
            </div>
          </div>
        )}

        <h2 className="text-2xl font-black text-white text-center mb-4">🏅 Reyting</h2>
        <div className="space-y-2">
          {leaderboard.slice(0, 8).map((p, i) => {
            const isMe = p.fullName === fullName;
            return (
              <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300
                ${isMe ? 'bg-violet-500/20 border border-violet-500/40 scale-[1.02]' : 'bg-zinc-900 border border-zinc-800'}`}
                style={{ animationDelay: `${i * 50}ms` }}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0
                  ${i === 0 ? 'bg-yellow-400 text-black' : i === 1 ? 'bg-zinc-400 text-black' : i === 2 ? 'bg-amber-700 text-white' : 'bg-zinc-700 text-zinc-300'}`}>
                  {p.rank}
                </div>
                <span className={`flex-1 font-medium ${isMe ? 'text-violet-300' : 'text-white'}`}>
                  {p.fullName}{isMe ? ' 👈' : ''}
                </span>
                {p.streak && p.streak >= 2 && <span className="text-amber-400 text-xs">🔥×{p.streak}</span>}
                <span className={`font-bold ${isMe ? 'text-violet-400' : 'text-white'}`}>{p.score.toLocaleString()}</span>
              </div>
            );
          })}
        </div>
        <p className="text-center text-zinc-500 text-sm mt-6 animate-pulse">Keyingi savol yuklanmoqda...</p>
      </div>
    </div>
  );

  // ── ANSWER RESULT STAGE ──────────────────────────────────────────────────────
  if (stage === 'answer-result' && answerResult) return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-6 transition-all
      ${answerResult.isCorrect ? 'bg-gradient-to-b from-emerald-950 to-[#09090b]' : 'bg-gradient-to-b from-red-950 to-[#09090b]'}`}>

      {/* Correct/Wrong icon */}
      <div className={`w-28 h-28 rounded-full flex items-center justify-center mb-6 text-6xl
        ${answerResult.isCorrect ? 'bg-emerald-500/20 border-2 border-emerald-400' : 'bg-red-500/20 border-2 border-red-400'}
        animate-scale-in`}>
        {answerResult.isCorrect ? '✅' : '❌'}
      </div>

      <h2 className={`text-4xl font-black mb-4 ${answerResult.isCorrect ? 'text-emerald-300' : 'text-red-300'}`}>
        {answerResult.isCorrect ? 'To\'g\'ri!' : 'Xato!'}
      </h2>

      {answerResult.isCorrect ? (
        <div className="text-center">
          {/* Points with counter */}
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-8 py-4 mb-4">
            <div className="text-6xl font-black text-emerald-300">+{answerResult.points}</div>
            <div className="text-emerald-400 text-sm mt-1">ball qo'shildi</div>
          </div>

          {/* Streak */}
          {answerResult.streak >= 2 && (
            <div className="flex items-center gap-2 justify-center bg-amber-500/20 border border-amber-500/30 px-6 py-3 rounded-2xl mb-4">
              <span className="text-3xl">🔥</span>
              <span className="text-amber-300 font-black text-xl">{answerResult.streak}× streak!</span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-red-300 text-base mb-4 text-center">
          To'g'ri javob: <strong className="text-white">{['A', 'B', 'C', 'D'][answerResult.correct]}</strong>
        </p>
      )}

      {/* Total score panel */}
      <div className="bg-white/5 border border-white/10 rounded-2xl px-8 py-4 text-center">
        <div className="text-xs text-zinc-400 mb-1">Jami ball</div>
        <div className="text-4xl font-black text-white">
          <AnimatedScore target={myScore} />
        </div>
        {myStreak >= 2 && <div className="text-xs text-amber-400 mt-1">🔥 Streak davom etmoqda!</div>}
      </div>

      <p className="text-zinc-500 text-sm mt-8 animate-pulse">Reyting yuklanmoqda...</p>

      <style>{`
        @keyframes scale-in { from { transform: scale(0.3); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-scale-in { animation: scale-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
      `}</style>
    </div>
  );

  // ── QUESTION STAGE ───────────────────────────────────────────────────────────
  if (stage === 'question' && currentQ) return (
    <div className="min-h-screen bg-gradient-to-b from-[#0c0c1e] to-[#09090b] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/40 backdrop-blur-sm">
        <div>
          <p className="text-zinc-400 text-xs">Siz</p>
          <p className="text-white font-bold text-sm truncate max-w-[140px]">{fullName}</p>
        </div>
        <div className="text-center">
          <p className="text-zinc-400 text-xs">Savol</p>
          <p className="text-white font-bold">{currentQ.index + 1}/{currentQ.total}</p>
        </div>
        <div className="text-right">
          <p className="text-zinc-400 text-xs">Ball</p>
          <p className="text-violet-300 font-black text-lg">{myScore.toLocaleString()}</p>
          {myStreak >= 2 && <p className="text-amber-400 text-xs">🔥×{myStreak}</p>}
        </div>
      </div>

      {/* Timer bar */}
      <div className="h-3 bg-zinc-800 relative">
        <div
          className={`h-full transition-all duration-1000 ${timerPct > 50 ? 'bg-emerald-500' : timerPct > 25 ? 'bg-yellow-500' : 'bg-red-500'}`}
          style={{ width: `${timerPct}%` }}
        />
        <div className={`absolute right-3 top-0 h-full flex items-center text-xs font-black ${timerPct < 25 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
          {timeLeft}s
        </div>
      </div>

      {/* Question card */}
      <div className="flex-1 flex flex-col px-4 pt-4">
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5 mb-4 flex flex-col items-center justify-center min-h-[120px] text-center">
          {currentQ.imageUrl && (
            <img src={currentQ.imageUrl} alt="" className="max-h-44 rounded-xl mb-3 mx-auto object-contain" />
          )}
          <p className="text-white text-xl font-bold leading-relaxed">{currentQ.question}</p>
        </div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-3 pb-6">
          {currentQ.options.map((opt, i) => {
            const style = OPTION_STYLES[i];
            const isChosen = selected === i;
            const isRevealed = selected !== null;
            return (
              <button
                key={i}
                onClick={() => submitAnswer(i)}
                disabled={isRevealed}
                className={`
                  ${style.bg} ${!isRevealed ? style.hover : ''} text-white rounded-2xl p-4
                  flex items-center gap-3 font-semibold text-left transition-all duration-200
                  active:scale-95 shadow-lg min-h-[80px]
                  ${isChosen ? 'ring-4 ring-white ring-offset-2 ring-offset-[#09090b] scale-[1.02]' : ''}
                  ${isRevealed && !isChosen ? 'opacity-40 scale-95' : ''}
                `}
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

  // ── LOBBY STAGE ──────────────────────────────────────────────────────────────
  if (stage === 'lobby') return (
    <div className="min-h-screen bg-gradient-to-b from-violet-950 to-[#09090b] flex items-center justify-center p-4">
      <div className="text-center max-w-sm w-full">
        <div className="w-20 h-20 bg-gradient-to-br from-violet-600 to-purple-700 rounded-2xl flex items-center justify-center mx-auto mb-4 text-4xl shadow-xl shadow-violet-900/50">⚡</div>
        <h2 className="text-2xl font-black text-white mb-1">{quizInfo?.title}</h2>
        <div className="mb-6 bg-zinc-900/50 p-3 rounded-2xl border border-zinc-800">
          <p className="text-zinc-400 text-sm mb-1">Siz:</p>
          {isEditingName ? (
            <div className="flex gap-2 justify-center">
              <input 
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1 text-white outline-none w-3/4"
                value={editNameVal}
                onChange={e => setEditNameVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && updateName()}
                autoFocus
              />
              <button onClick={updateName} disabled={loading} className="px-3 bg-violet-600 rounded-lg text-white">✓</button>
              <button onClick={() => setIsEditingName(false)} className="px-3 bg-zinc-700 rounded-lg text-white">✕</button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <span className="text-violet-300 font-bold text-lg">{fullName}</span>
              <button onClick={() => { setEditNameVal(fullName); setIsEditingName(true); }} className="text-zinc-500 hover:text-white" title="Ismni o'zgartirish">✎</button>
            </div>
          )}
        </div>
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6">
          <div className="text-5xl font-black text-violet-300 mb-1 transition-all duration-500">{playerCount}</div>
          <div className="text-zinc-400 text-sm mb-4">o'yinchi ulandi</div>
          <div className="flex justify-center gap-1.5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-2.5 h-2.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
          <p className="text-zinc-500 text-xs mt-3 animate-pulse">O'qituvchi quizni boshlaguncha kuting...</p>
        </div>
        <button
          onClick={leaveQuiz}
          className="mt-4 w-full py-3 bg-zinc-800 hover:bg-red-600/80 border border-zinc-700 hover:border-red-500 text-zinc-400 hover:text-white rounded-xl font-medium transition-all duration-200"
        >🚪 Chiqish</button>
      </div>
    </div>
  );

  // ── ENTER NAME STAGE ─────────────────────────────────────────────────────────
  if (stage === 'enter-name') return (
    <div className="min-h-screen bg-gradient-to-b from-violet-950 to-[#09090b] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">👤</div>
          <h2 className="text-2xl font-black text-white">{quizInfo?.title}</h2>
          <p className="text-zinc-400 text-sm mt-1">{playerCount} o'yinchi ulandi</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6">
          <label className="text-zinc-300 text-sm font-medium mb-2 block">Ismingiz</label>
          <input
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-lg font-bold mb-4 focus:border-violet-500 outline-none transition text-center tracking-wide"
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

  // ── ENTER CODE STAGE ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-950 via-[#0c0c1e] to-[#09090b] flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="text-7xl mb-4">⚡</div>
        <h1 className="text-4xl font-black text-white mb-2">Live Quiz</h1>
        <p className="text-zinc-400 mb-8">O'qituvchidan kod olib kiriting</p>

        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 shadow-2xl shadow-violet-900/20">
          <label className="text-zinc-300 text-sm font-medium mb-3 block">6 xonali kod</label>
          <input
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-4 text-white text-4xl font-black tracking-widest text-center focus:border-violet-500 outline-none transition mb-4"
            placeholder="000000"
            value={code}
            maxLength={6}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => e.key === 'Enter' && code.length === 6 && checkCode()}
            autoFocus
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
