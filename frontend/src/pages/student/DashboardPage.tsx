import { useEffect, useState, useRef } from 'react';
import Header from '@/components/layout/Header';
import StatsCard from '@/components/shared/StatsCard';
import ScoreBadge from '@/components/shared/ScoreBadge';
import { statsApi, feedbackApi } from '@/api';
import { useAuthStore } from '@/stores/authStore';
import { Trophy, Target, Clock, Star, Loader2, TrendingUp, Brain, Sparkles, MessageSquare, Send, CheckCircle2, Zap } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

// Animated counter
function AnimatedScore({ target, duration = 1000 }: { target: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number>();
  useEffect(() => {
    const begin = Date.now();
    const from = 0;
    function tick() {
      const p = Math.min((Date.now() - begin) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (target - from) * ease));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => raf.current && cancelAnimationFrame(raf.current);
  }, [target]);
  return <>{display.toLocaleString()}</>;
}

export default function StudentDashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quizHistory, setQuizHistory] = useState<any[]>([]);

  // AI Analysis state
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  // Feedback state
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackType, setFeedbackType] = useState('general');
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);

  useEffect(() => {
    if (user?.id) {
      statsApi.getStudentStats(user.id)
        .then((res) => setStats(res.data.data))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
    // Load quiz history from localStorage
    try {
      const raw = localStorage.getItem('quizHistory');
      if (raw) setQuizHistory(JSON.parse(raw));
    } catch {}
  }, [user?.id]);

  const loadAiAnalysis = async () => {
    setAiLoading(true);
    try {
      const res = await feedbackApi.getMyAiAnalysis();
      setAiAnalysis(res.data.data);
    } catch {
      /* silently fail */
    } finally {
      setAiLoading(false);
    }
  };

  const sendFeedback = async () => {
    if (!feedbackMsg.trim()) return;
    setFeedbackSending(true);
    try {
      await feedbackApi.create({ message: feedbackMsg.trim(), type: feedbackType });
      setFeedbackMsg('');
      setFeedbackSent(true);
      setTimeout(() => setFeedbackSent(false), 4000);
    } catch {
      alert("Feedback yuborishda xatolik");
    } finally {
      setFeedbackSending(false);
    }
  };

  // Compute chart data for growth dynamics
  const chartData = Array.isArray(stats?.submissions) ? [...stats.submissions]
    .filter((s: any) => s.status === 'checked')
    .sort((a: any, b: any) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime())
    .reduce((acc: any[], s: any) => {
      const prevTotal = acc.length > 0 ? acc[acc.length - 1].total : 0;
      acc.push({
        date: new Date(s.submittedAt).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' }),
        ball: s.score,
        total: prevTotal + s.score,
        task: `#${s.normative?.taskNumber || ''}`
      });
      return acc;
    }, []) : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <Header title={`Salom, ${user?.fullName}! 👋`} subtitle="O'quvchi kabineti" />

      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        
        {/* Header Profile Info (Level & Progress) */}
        <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="flex items-center gap-6 z-10">
            <div className="relative">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 flex items-center justify-center text-3xl sm:text-4xl font-bold text-white border border-white/10 shadow-xl">
                {user?.fullName?.charAt(0) || '?'}
              </div>
              <div className="absolute -bottom-3 -right-3 w-10 h-10 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center border-2 border-[#18181b] shadow-lg transform rotate-12">
                <span className="text-white font-bold text-sm">{stats?.level || 1}</span>
              </div>
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-1">{user?.fullName}</h2>
              <p className="text-sm text-zinc-400 uppercase tracking-wider font-mono">{user?.login}</p>
              
              <div className="mt-4 flex items-center gap-3">
                <div className="w-32 sm:w-48 h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-1000"
                    style={{ width: `${stats?.progressToNextLevel || 0}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-amber-500">{stats?.progressToNextLevel || 0}%</span>
                <span className="text-xs text-zinc-500 hidden sm:inline">Keyingi darajaga</span>
              </div>
            </div>
          </div>

          <div className="absolute right-0 top-0 w-64 h-64 bg-blue-500/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/3"></div>
        </div>

        {/* Badges Section */}
        {stats?.badges && stats.badges.length > 0 && (
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6 relative overflow-hidden">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2 relative z-10">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500/20" />
              Mening yutuqlarim
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 relative z-10">
              {stats.badges.map((badge: any) => (
                <div key={badge.id} className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20 flex items-start gap-3">
                  <div className="text-3xl mt-0.5">{badge.name.split(' ')[0]}</div>
                  <div>
                    <p className="text-sm font-bold text-amber-500">{badge.name.split(' ').slice(1).join(' ')}</p>
                    <p className="text-xs text-amber-500/70 mt-1 leading-snug">{badge.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatsCard
            title="Jami ball"
            value={stats?.totalScore || 0}
            icon={<Star className="w-6 h-6" />}
            color="purple"
          />
          <StatsCard
            title="Bajarilgan"
            value={`${stats?.completed || 0} ta`}
            icon={<Target className="w-6 h-6" />}
            color="green"
          />
          <StatsCard
            title="Kutilmoqda"
            value={`${stats?.pending || 0} ta`}
            icon={<Clock className="w-6 h-6" />}
            color="orange"
          />
        </div>

        {/* O'sish dinamikasi (Line Chart) */}
        {chartData.length > 0 && (
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6">
            <h3 className="text-base font-bold text-white mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              O'sish dinamikasi
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="date" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '0.5rem', color: '#fff' }}
                    itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
                    labelStyle={{ color: '#a1a1aa', marginBottom: '0.25rem' }}
                  />
                  <Area type="monotone" dataKey="total" name="Umumiy ball" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Guruh reytinglari */}
        {stats?.groups && stats.groups.length > 0 && (
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6">
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              Guruh o'rinlarim
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {stats.groups.map((g: any) => (
                <div key={g.group.id} className="p-4 rounded-lg bg-[#09090b] border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium text-sm">{g.group.name} guruhi</p>
                      <p className="text-xs text-zinc-500">{g.totalInGroup} nafar ichida</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-amber-500">#{g.rank}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* So'nggi topshiriqlar */}
        {stats?.submissions && stats.submissions.length > 0 && (
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6">
            <h3 className="text-base font-semibold text-white mb-4">So'nggi topshiriqlar</h3>
            <div className="space-y-3">
              {stats.submissions.slice(0, 10).map((sub: any) => (
                <div key={sub.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg bg-[#09090b] border border-zinc-800 gap-3">
                  <div className="flex items-start sm:items-center gap-3">
                    <span className="text-xs font-mono text-zinc-500 mt-1 sm:mt-0 w-8">#{sub.normative.taskNumber}</span>
                    <div>
                      <p className="text-sm font-medium text-white">{sub.normative.title}</p>
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{sub.group?.name || ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 sm:justify-end">
                    <span className="text-sm font-bold text-white">{sub.score} <span className="text-xs font-normal text-zinc-500">ball</span></span>
                    <ScoreBadge result={sub.result} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ⚡ LIVE QUIZ NATIJALARI */}
        {quizHistory.length > 0 && (
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6 relative overflow-hidden">
            {/* Background glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none" />

            <div className="flex items-center gap-2 mb-5 relative z-10">
              <Zap className="w-5 h-5 text-violet-400" />
              <h3 className="text-base font-bold text-white">Live Quiz natijalari</h3>
            </div>

            {/* Last quiz — hero card */}
            {(() => {
              const last = quizHistory[0];
              const rankEmoji = last.rank === 1 ? '🥇' : last.rank === 2 ? '🥈' : last.rank === 3 ? '🥉' : '🏅';
              const isTop3 = last.rank && last.rank <= 3;
              return (
                <div className={`rounded-2xl p-5 mb-4 relative overflow-hidden ${isTop3 ? 'bg-gradient-to-br from-violet-900/60 to-purple-900/40 border border-violet-500/40' : 'bg-[#09090b] border border-zinc-800'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-zinc-400 text-xs mb-1">So'nggi quiz</p>
                      <h4 className="text-white font-bold text-lg leading-tight">{last.quizTitle}</h4>
                      <p className="text-zinc-500 text-xs mt-1">{new Date(last.date).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-4xl mb-1">{rankEmoji}</div>
                      <div className={`text-3xl font-black ${isTop3 ? 'text-violet-300' : 'text-white'}`}>#{last.rank ?? '?'}</div>
                      <div className="text-xs text-zinc-500">{last.totalPlayers} nafar ichida</div>
                    </div>
                  </div>

                  {/* Score counter */}
                  <div className="mt-4 flex items-center gap-4">
                    <div className={`flex-1 rounded-xl p-3 text-center ${isTop3 ? 'bg-white/5' : 'bg-zinc-800'}`}>
                      <p className="text-xs text-zinc-400 mb-0.5">Ball</p>
                      <p className={`text-2xl font-black ${isTop3 ? 'text-violet-300' : 'text-white'}`}>
                        <AnimatedScore target={last.score} />
                      </p>
                    </div>
                    <div className={`flex-1 rounded-xl p-3 text-center ${isTop3 ? 'bg-white/5' : 'bg-zinc-800'}`}>
                      <p className="text-xs text-zinc-400 mb-0.5">O'rin</p>
                      <p className={`text-2xl font-black ${last.rank === 1 ? 'text-yellow-400' : last.rank <= 3 ? 'text-violet-300' : 'text-white'}`}>
                        #{last.rank ?? '?'}
                      </p>
                    </div>
                    {last.totalPlayers > 0 && (
                      <div className={`flex-1 rounded-xl p-3 text-center ${isTop3 ? 'bg-white/5' : 'bg-zinc-800'}`}>
                        <p className="text-xs text-zinc-400 mb-0.5">Ishtirokchilar</p>
                        <p className="text-2xl font-black text-white">{last.totalPlayers}</p>
                      </div>
                    )}
                  </div>

                  {isTop3 && (
                    <div className="mt-3 flex items-center gap-2 bg-violet-500/20 border border-violet-500/30 rounded-xl px-4 py-2">
                      <span className="text-lg">🎉</span>
                      <span className="text-violet-300 text-sm font-semibold">
                        {last.rank === 1 ? 'Birinchi o\'rin! Zo\'r natijaaa!' : last.rank === 2 ? 'Ikkinchi o\'rin! Ajoyib!' : 'Uchinchi o\'rin! Yaxshi!'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* History list */}
            {quizHistory.length > 1 && (
              <div className="space-y-2">
                <p className="text-zinc-500 text-xs uppercase tracking-wider mb-2">Oldingi quizlar</p>
                {quizHistory.slice(1, 6).map((q: any, i: number) => {
                  const rankEmoji = q.rank === 1 ? '🥇' : q.rank === 2 ? '🥈' : q.rank === 3 ? '🥉' : '🏅';
                  return (
                    <div key={i} className="flex items-center gap-3 bg-[#09090b] border border-zinc-800 rounded-xl px-4 py-3">
                      <span className="text-xl">{rankEmoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{q.quizTitle}</p>
                        <p className="text-zinc-500 text-xs">{new Date(q.date).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' })}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-violet-400 font-bold">{q.score.toLocaleString()}</p>
                        <p className="text-zinc-500 text-xs">#{q.rank ?? '?'} o'rin</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* AI Self-Analysis Card */}

        <div className="bg-gradient-to-br from-violet-900/20 to-blue-900/10 border border-violet-500/30 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-400" />
              <h3 className="text-white font-bold text-sm">Mening AI Tahlilim</h3>
            </div>
            {!aiAnalysis && (
              <button
                id="btn-my-ai-analysis"
                onClick={loadAiAnalysis}
                disabled={aiLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white text-xs font-semibold transition-all disabled:opacity-50"
              >
                {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
                {aiLoading ? 'Tahlil qilinmoqda...' : 'Tahlil qilish'}
              </button>
            )}
          </div>

          {aiAnalysis ? (
            <div className="space-y-3">
              <div className={`p-4 rounded-xl border ${
                aiAnalysis.status === 'excellent' ? 'bg-amber-500/10 border-amber-500/20' :
                aiAnalysis.status === 'critical' ? 'bg-red-500/10 border-red-500/20' :
                aiAnalysis.status === 'good' ? 'bg-emerald-500/10 border-emerald-500/20' :
                'bg-zinc-800 border-zinc-700'
              }`}>
                <p className="text-white font-semibold text-sm">{aiAnalysis.message}</p>
                <p className="text-zinc-400 text-xs mt-1">{aiAnalysis.advice}</p>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[['🏆', aiAnalysis.stats?.gold, 'Oltin'], ['🥈', aiAnalysis.stats?.silver, 'Kumush'], ['🥉', aiAnalysis.stats?.bronze, 'Bronza'], ['🔴', aiAnalysis.stats?.red, 'Qizil']].map(([icon, val, label]) => (
                  <div key={String(label)} className="bg-zinc-900 rounded-lg p-2.5 text-center border border-zinc-800">
                    <p className="text-lg">{icon}</p>
                    <p className="text-white font-bold text-base">{val ?? 0}</p>
                    <p className="text-zinc-500 text-[10px]">{label}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-zinc-500">O'rtacha ball: <span className="text-white font-bold">{aiAnalysis.stats?.avgScore}</span></p>
            </div>
          ) : !aiLoading ? (
            <p className="text-zinc-500 text-sm">"Tahlil qilish" tugmasini bosing va AI natijalaringizni ko'ring.</p>
          ) : null}
        </div>

        {/* Feedback Form */}
        <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-blue-400" />
            <h3 className="text-white font-bold text-sm">O'qituvchiga Fikr-Mulohaza Yuborish</h3>
          </div>

          {feedbackSent ? (
            <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <p className="text-emerald-300 text-sm font-medium">Fikr-mulohazangiz muvaffaqiyatli yuborildi! Rahmat 🙏</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                {[['general', 'Umumiy'], ['question', 'Savol'], ['problem', 'Muammo'], ['suggestion', 'Taklif']].map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setFeedbackType(val)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      feedbackType === val
                        ? 'bg-blue-600 text-white border-blue-500'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white'
                    }`}
                  >{label}</button>
                ))}
              </div>
              <textarea
                id="feedback-textarea"
                value={feedbackMsg}
                onChange={e => setFeedbackMsg(e.target.value)}
                placeholder="O'qituvchingizga savol, taklif yoki shikoyatingizni yozing..."
                rows={3}
                className="w-full bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 text-sm px-4 py-3 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              />
              <button
                id="btn-send-feedback"
                onClick={sendFeedback}
                disabled={!feedbackMsg.trim() || feedbackSending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all"
              >
                {feedbackSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {feedbackSending ? 'Yuborilmoqda...' : 'Yuborish'}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
