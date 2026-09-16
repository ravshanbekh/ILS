import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '@/components/layout/Header';
import StatsCard from '@/components/shared/StatsCard';
import ScoreBadge from '@/components/shared/ScoreBadge';
import { statsApi, feedbackApi, coinsApi } from '@/api';
import { useAuthStore } from '@/stores/authStore';
import { uzDayMonth } from '@/utils/uzDate';
import { Trophy, Target, Clock, Star, Loader2, TrendingUp, Brain, Sparkles, MessageSquare, Send, CheckCircle2, Gift, ChevronRight } from 'lucide-react';
import Illustration from '@/components/brand/Illustration';
import BadgeIcon from '@/components/brand/BadgeIcon';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

export default function StudentDashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [coinBalance, setCoinBalance] = useState<number | null>(null);

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
      coinsApi.getBalance(user.id)
        .then((res) => setCoinBalance(res.data.data.balance))
        .catch(() => {});
    }
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
        date: uzDayMonth(s.submittedAt),
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
        
        {/* ── Profil hero — mockupdagi kompozitsiya ──────────────────────
            Chapda avatar + daraja belgisi, o'rtada ism/login/progress,
            o'ngda 3D illustratsiya. Fon dekori aria-hidden. */}
        <section
          className="relative overflow-hidden rounded-[20px] border p-5 sm:p-6"
          style={{
            background: 'var(--card-fill)',
            borderColor: 'var(--border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          {/* Dekorativ naqsh — juda xira, matn ustiga chiqmaydi */}
          <div
            className="ils-pattern pointer-events-none absolute inset-y-0 right-0 w-1/2"
            aria-hidden="true"
            style={{
              backgroundImage:
                'radial-gradient(circle at 70% 30%, var(--brand-coral) 0 3px, transparent 3px)',
              backgroundSize: '46px 46px',
            }}
          />

          <div className="relative flex flex-col gap-5 md:flex-row md:items-center">
            {/* Avatar + daraja */}
            <div className="relative shrink-0">
              <div
                className="flex h-20 w-20 items-center justify-center rounded-2xl text-4xl font-bold sm:h-24 sm:w-24"
                style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}
              >
                {user?.fullName?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <span
                className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
                style={{
                  background: 'var(--chart-up)',
                  color: '#3d2a00',
                  border: '3px solid var(--background)',
                }}
                title={`Daraja: ${stats?.level || 1}`}
              >
                {stats?.level || 1}
              </span>
            </div>

            {/* Ism, login, progress */}
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-2xl font-bold tracking-[-0.02em] sm:text-3xl">
                {user?.fullName}
              </h2>
              <p
                className="mt-1 font-mono text-sm uppercase tracking-wider"
                style={{ color: 'var(--muted-foreground)' }}
              >
                {user?.login}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div
                  className="h-2 w-40 overflow-hidden rounded-full sm:w-64"
                  role="progressbar"
                  aria-valuenow={stats?.progressToNextLevel || 0}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Keyingi darajaga qolgan yo'l"
                  style={{ background: 'var(--surface-muted)' }}
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-700"
                    style={{
                      width: `${stats?.progressToNextLevel || 0}%`,
                      background: 'linear-gradient(90deg, var(--brand-red), var(--brand-gold))',
                    }}
                  />
                </div>
                <span className="tabular text-sm font-bold" style={{ color: 'var(--chart-up)' }}>
                  {stats?.progressToNextLevel || 0}%
                </span>
                <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Keyingi darajaga
                </span>
              </div>
            </div>

            <Illustration
              name="student-hero"
              size="clamp(120px, 18vw, 220px)"
              priority
              className="self-center md:self-auto"
            />
          </div>
        </section>

        {/* ── Coin balansi + Do'kon ───────────────────────────────── */}
        <section
          className="flex flex-col gap-4 rounded-[20px] border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
          style={{
            background: 'var(--card-fill)',
            borderColor: 'var(--border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="flex items-center gap-4">
            <Illustration name="coins" size={88} priority />
            <div>
              <p className="text-base font-medium" style={{ color: 'var(--muted-foreground)' }}>
                Mening coinlarim
              </p>
              <p className="tabular mt-1 text-3xl font-bold tracking-[-0.02em]">
                {coinBalance === null ? (
                  <Loader2 className="h-6 w-6 animate-spin" aria-label="Yuklanmoqda" />
                ) : (
                  coinBalance
                )}
              </p>
            </div>
          </div>

          <Link
            to="/student/shop"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 font-semibold transition-opacity hover:opacity-90"
            style={{ background: 'var(--chart-up)', color: '#3d2a00' }}
          >
            <Gift className="h-5 w-5" aria-hidden="true" />
            Do'konga o'tish
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>

        {/* ── Mening yutuqlarim ──────────────────────────────────────
            Kartochka markazlashgan: yuqorida 3D ikonka, ostida nom va izoh.
            Backend nomni emoji bilan boshlaydi ("Ajdarho" oldida emoji) —
            emoji ajratib olinadi va asset topilmasa fallback bo'ladi. */}
        {stats?.badges && stats.badges.length > 0 && (
          <section>
            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold">
              <Star className="h-5 w-5" style={{ color: 'var(--chart-up)' }} aria-hidden="true" />
              Mening yutuqlarim
            </h3>

            <ul className="grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {stats.badges.map((badge: any) => {
                const parts = String(badge.name || '').split(' ');
                const emoji = parts[0];
                const label = parts.slice(1).join(' ');
                return (
                  <li
                    key={badge.id}
                    className="flex flex-col items-center rounded-[20px] border px-4 py-5 text-center"
                    style={{
                      background: 'var(--card-fill)',
                      borderColor: 'var(--border)',
                      boxShadow: 'var(--shadow-card)',
                    }}
                  >
                    <BadgeIcon badgeId={badge.id} emoji={emoji} size={84} />
                    <p className="mt-3 font-bold leading-tight">{label}</p>
                    {badge.desc && (
                      <p
                        className="mt-1 text-sm leading-snug"
                        style={{ color: 'var(--muted-foreground)' }}
                      >
                        {badge.desc}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
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

        {/* ── O'sish dinamikasi ────────────────────────────────────────
            `type="natural"` — `monotone` dan yumshoqroq egri chiziq beradi.
            Ball kumulyativ o'sgani uchun chiziq deyarli tekis chiqardi.

            X o'qi: sana takrorlanadigan yozuvlarni ko'rsatmaydi. Bir kunda
            bir necha topshiriq bo'lsa, ilgari "15-may" o'n marta yozilardi. */}
        {chartData.length > 0 && (
          <section
            className="rounded-[20px] border p-5 sm:p-6"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--border)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <h3 className="mb-5 flex items-center gap-2 text-lg font-bold">
              <TrendingUp className="h-5 w-5" style={{ color: 'var(--primary)' }} aria-hidden="true" />
              O'sish dinamikasi
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 6" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={28}
                    tickFormatter={(value, index) =>
                      index > 0 && chartData[index - 1]?.date === value ? '' : value
                    }
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                  />
                  <Tooltip
                    cursor={{ stroke: 'var(--primary)', strokeWidth: 1, strokeDasharray: '4 4' }}
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      boxShadow: 'var(--shadow-popover)',
                      color: 'var(--foreground)',
                    }}
                    itemStyle={{ color: 'var(--primary)', fontWeight: 700 }}
                    labelStyle={{ color: 'var(--muted-foreground)', marginBottom: 4 }}
                  />
                  <Area
                    type="natural"
                    dataKey="total"
                    name="Umumiy ball"
                    stroke="var(--primary)"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorTotal)"
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--surface)' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* Guruh reytinglari */}
        {stats?.groups && stats.groups.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              Guruh o'rinlarim
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {stats.groups.map((g: any) => (
                <div key={g.group.id} className="p-4 rounded-lg bg-zinc-950 border border-zinc-800">
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
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-base font-semibold text-white mb-4">So'nggi topshiriqlar</h3>
            <div className="space-y-3">
              {stats.submissions.slice(0, 10).map((sub: any) => (
                <div key={sub.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg bg-zinc-950 border border-zinc-800 gap-3">
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
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
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
