import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '@/components/layout/Header';
import StatsCard from '@/components/shared/StatsCard';
import ScoreBadge from '@/components/shared/ScoreBadge';
import { statsApi, submissionsApi, monitoringApi } from '@/api';
import { formatDateTime } from '@/utils';
import { Loader2, ArrowLeft, Star, Target, Clock, Trophy, ExternalLink, TrendingUp, Brain, FileText, Copy, X, Sparkles } from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

export default function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [regrading, setRegrading] = useState<string | null>(null);
  const [regradeComment, setRegradeComment] = useState('');
  const [regradeProcessing, setRegradeProcessing] = useState(false);
  // AI Analysis state
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  // Script modal state
  const [scriptData, setScriptData] = useState<any>(null);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (id) {
      statsApi.getStudentStats(id)
        .then((res) => setStats(res.data.data))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [id]);

  const handleRegrade = async (subId: string, result: 'green' | 'blue' | 'red') => {
    setRegradeProcessing(true);
    try {
      await submissionsApi.check(subId, { result, comment: regradeComment || undefined });
      setStats((prev: any) => ({
        ...prev,
        submissions: prev.submissions.map((s: any) => {
          if (s.id !== subId) return s;
          const maxScore = s.normative?.maxScore || 20;
          const score = result === 'green' ? maxScore : result === 'blue' ? Math.round(maxScore / 2) : 0;
          return { ...s, result, score, status: 'checked', canResubmit: false };
        })
      }));
      setRegrading(null);
      setRegradeComment('');
    } catch (err) {
      console.error(err);
      alert('Xatolik yuz berdi');
    } finally {
      setRegradeProcessing(false);
    }
  };

  const handleAiAnalysis = async () => {
    if (!id) return;
    setAiLoading(true);
    setAiError('');
    try {
      const res = await statsApi.analyzeStudentWithAI(id);
      setAiAnalysis(res.data.data);
    } catch {
      setAiError('AI tahlil qilishda xatolik yuz berdi');
    } finally {
      setAiLoading(false);
    }
  };

  const handleGenerateScript = async () => {
    if (!id) return;
    setScriptLoading(true);
    try {
      const res = await monitoringApi.generateStudentScript(id);
      setScriptData(res.data.data);
      setShowScript(true);
    } catch {
      alert('Script generatsiyasida xatolik');
    } finally {
      setScriptLoading(false);
    }
  };

  const copyScript = () => {
    if (scriptData?.script) {
      navigator.clipboard.writeText(scriptData.script);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-8 text-center text-zinc-400">
        O'quvchi ma'lumotlari topilmadi
      </div>
    );
  }

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

  const { student, totalScore, level, progressToNextLevel, badges, completed, pending, groups, submissions } = stats;

  return (
    <div>
      <Header 
        title={student?.fullName || "O'quvchi Profili"} 
        subtitle={student?.login} 
      />

      <div className="p-8 max-w-7xl mx-auto">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-medium mb-6 w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          Orqaga
        </button>

        {/* Top Info & Avatar */}
        <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="flex items-center gap-6 z-10">
            <div className="relative">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 flex items-center justify-center text-4xl font-bold text-white border border-white/10 shadow-xl">
                {student?.fullName?.charAt(0) || '?'}
              </div>
              <div className="absolute -bottom-3 -right-3 w-10 h-10 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center border-2 border-[#18181b] shadow-lg transform rotate-12">
                <span className="text-white font-bold text-sm">{level}</span>
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white tracking-tight mb-1">{student?.fullName}</h2>
              <p className="text-sm text-zinc-400 uppercase tracking-wider font-mono">{student?.login}</p>
              
              <div className="mt-4 flex items-center gap-3">
                <div className="w-48 h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-1000"
                    style={{ width: `${progressToNextLevel}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-amber-500">{progressToNextLevel}%</span>
                <span className="text-xs text-zinc-500 hidden sm:inline">Keyingi darajaga</span>
              </div>
            </div>
          </div>

          <div className="absolute right-0 top-0 w-64 h-64 bg-blue-500/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/3"></div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatsCard
            title="Jami ball"
            value={totalScore || 0}
            icon={<Star className="w-6 h-6" />}
            color="purple"
          />
          <StatsCard
            title="Bajarilgan normativlar"
            value={completed || 0}
            icon={<Target className="w-6 h-6" />}
            color="green"
          />
          <StatsCard
            title="Kutilmoqda"
            value={pending || 0}
            icon={<Clock className="w-6 h-6" />}
            color="orange"
          />
        </div>

        {/* AI Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            id="btn-ai-analyze"
            onClick={handleAiAnalysis}
            disabled={aiLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white text-sm font-semibold shadow-lg shadow-violet-500/20 transition-all disabled:opacity-50"
          >
            {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            {aiLoading ? 'Tahlil qilinmoqda...' : 'AI bilan tahlil qilish'}
          </button>
          <button
            id="btn-gen-script"
            onClick={handleGenerateScript}
            disabled={scriptLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold border border-zinc-700 transition-all disabled:opacity-50"
          >
            {scriptLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {scriptLoading ? 'Script tayyorlanmoqda...' : "O'quvchi bilan ishlash scripti"}
          </button>
        </div>

        {/* AI Analysis Result Panel */}
        {aiAnalysis && (
          <div className="mb-6 bg-gradient-to-br from-violet-900/20 to-blue-900/10 border border-violet-500/30 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-violet-400" />
              <h3 className="text-white font-bold text-sm">AI Normativ Tahlil Natijasi</h3>
              <button onClick={() => setAiAnalysis(null)} className="ml-auto text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="prose prose-invert prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-sm text-zinc-200 font-sans leading-relaxed bg-black/20 rounded-lg p-4">{aiAnalysis.analysis || JSON.stringify(aiAnalysis, null, 2)}</pre>
            </div>
          </div>
        )}
        {aiError && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {aiError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Badges, Groups and Ranks */}
          <div className="lg:col-span-1 space-y-6">
            {/* Badges Section */}
            {badges && badges.length > 0 && (
              <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6 relative overflow-hidden">
                <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2 relative z-10">
                  <Star className="w-5 h-5 text-amber-500 fill-amber-500/20" />
                  Yutuqlar (Nishonlar)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 relative z-10">
                  {badges.map((badge: any) => (
                    <div key={badge.id} className="p-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20 flex items-start gap-3">
                      <div className="text-2xl mt-0.5">{badge.name.split(' ')[0]}</div>
                      <div>
                        <p className="text-sm font-bold text-amber-500">{badge.name.split(' ').slice(1).join(' ')}</p>
                        <p className="text-xs text-amber-500/70 mt-0.5 leading-snug">{badge.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-2xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
              </div>
            )}

            <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                Guruh reytinglari
              </h3>
              
              {groups && groups.length > 0 ? (
                <div className="space-y-3">
                  {groups.map((g: any) => (
                    <div key={g.group.id} className="p-4 rounded-xl bg-[#09090b] border border-zinc-800 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-white">{g.group.name}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{g.totalInGroup} nafar ichida</p>
                      </div>
                      <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                        <p className="text-lg font-bold text-amber-500">#{g.rank}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500 text-center py-4">Guruhlarga biriktirilmagan</p>
              )}
            </div>
          </div>

          {/* Right Column: Submissions History and Chart */}
          <div className="lg:col-span-2 space-y-6">
            
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

            <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6">
              <h3 className="text-base font-bold text-white mb-4">Topshiriqlar tarixi</h3>
              
              {submissions && submissions.length > 0 ? (
                <div className="space-y-3">
                  {submissions.map((sub: any) => (
                    <div key={sub.id} className="p-4 rounded-xl bg-[#09090b] border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:border-zinc-700">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                          <span className="text-xs font-mono text-zinc-400">#{sub.normative?.taskNumber}</span>
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-medium text-white truncate">{sub.normative?.title}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded uppercase tracking-wider">
                              {sub.group?.name}
                            </span>
                            <span className="text-xs text-zinc-500">{formatDateTime(sub.submittedAt)}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 sm:justify-end shrink-0 pl-14 sm:pl-0">
                        {sub.status === 'checked' ? (
                          <>
                            {regrading === sub.id ? (
                              <div className="flex items-center gap-1.5 animate-fade-in">
                                <button onClick={() => handleRegrade(sub.id, 'green')} disabled={regradeProcessing} className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 text-xs font-bold transition-colors disabled:opacity-50">🟢</button>
                                <button onClick={() => handleRegrade(sub.id, 'blue')} disabled={regradeProcessing} className="px-2.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/30 text-xs font-bold transition-colors disabled:opacity-50">🔵</button>
                                <button onClick={() => handleRegrade(sub.id, 'red')} disabled={regradeProcessing} className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 text-xs font-bold transition-colors disabled:opacity-50">🔴</button>
                                <button onClick={() => setRegrading(null)} className="px-2 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 text-xs transition-colors hover:text-white">✕</button>
                              </div>
                            ) : (
                              <>
                                <div className="text-right">
                                  <p className="text-lg font-bold text-white leading-none">{sub.score}</p>
                                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Ball</p>
                                </div>
                                <ScoreBadge result={sub.result} showLabel />
                                <button
                                  onClick={() => setRegrading(sub.id)}
                                  className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-xs transition-colors whitespace-nowrap"
                                  title="Natijani o'zgartirish"
                                >
                                  O'zgartiris
                                </button>
                                {sub.result !== 'green' && !sub.canResubmit && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        await submissionsApi.allowResubmit(sub.id);
                                        setStats((prev: any) => ({
                                          ...prev,
                                          submissions: prev.submissions.map((s: any) =>
                                            s.id === sub.id ? { ...s, canResubmit: true } : s
                                          )
                                        }));
                                      } catch (err) {
                                        console.error('Failed to allow resubmit', err);
                                        alert('Xatolik yuz berdi');
                                      }
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs transition-colors whitespace-nowrap"
                                    title="Qayta topshirishga ruxsat berish"
                                  >
                                    Ochib berish
                                  </button>
                                )}
                                {sub.canResubmit && (
                                  <span className="text-xs text-blue-500 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20 whitespace-nowrap">
                                    Ochiq
                                  </span>
                                )}
                              </>
                            )}
                          </>
                        ) : (
                          // PENDING — teacher bu yerdan ham baholay oladi
                          regrading === sub.id ? (
                            <div className="flex flex-col gap-2 animate-fade-in min-w-[200px]">
                              <div className="flex items-center gap-1.5">
                                <button onClick={() => handleRegrade(sub.id, 'green')} disabled={regradeProcessing} className="flex-1 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 text-xs font-bold transition-colors disabled:opacity-50">🟢 A'lo</button>
                                <button onClick={() => handleRegrade(sub.id, 'blue')} disabled={regradeProcessing} className="flex-1 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/30 text-xs font-bold transition-colors disabled:opacity-50">🔵 Yaxshi</button>
                                <button onClick={() => handleRegrade(sub.id, 'red')} disabled={regradeProcessing} className="flex-1 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 text-xs font-bold transition-colors disabled:opacity-50">🔴 Qizil</button>
                                <button onClick={() => { setRegrading(null); setRegradeComment(''); }} className="px-2 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 text-xs transition-colors hover:text-white">✕</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                <Clock className="w-3.5 h-3.5" />
                                Kutilmoqda
                              </span>
                              <button
                                onClick={() => { setRegrading(sub.id); setRegradeComment(''); }}
                                className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors whitespace-nowrap"
                                title="Baholash"
                              >
                                Baholash
                              </button>
                            </>
                          )
                        )}
                        <a
                          href={sub.youtubeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center hover:bg-blue-500/20 transition-colors"
                          title="YouTube'da ko'rish"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center border border-dashed border-zinc-800 rounded-xl">
                  <p className="text-sm text-zinc-500">Hali topshiriqlar yo'q</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Script Modal */}
      {showScript && scriptData && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#18181b] border border-zinc-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">O'quvchi bilan ishlash scripti</h3>
                <p className="text-zinc-500 text-xs">{scriptData.studentName}</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={copyScript}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs transition-all border border-zinc-700"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? '✅ Nusxalandi!' : 'Nusxa olish'}
                </button>
                <button onClick={() => setShowScript(false)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            {/* Script content */}
            <div className="flex-1 overflow-y-auto p-6">
              <pre className="whitespace-pre-wrap text-sm text-zinc-200 font-sans leading-relaxed">{scriptData.script}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
