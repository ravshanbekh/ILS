import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/layout/Header';
import { useAuthStore } from '@/stores/authStore';
import { freezesApi, usersApi } from '@/api';
import {
  Loader2, Snowflake, Plus, X, ChevronLeft, ChevronRight,
  BarChart2, List, Brain, RefreshCw, Copy, AlertTriangle,
  CheckCircle, TrendingDown, Search, Filter
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

// Recharts bo'lmasa xatolikka tushmaslik uchun dinamik import
const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#6366f1','#84cc16','#06b6d4','#a78bfa'];

const REASON_LABELS: Record<string, string> = {
  moliyaviy: "Moliyaviy (to'lov)",
  kochib_ketish: "Ko'chib/safarga ketish",
  vaqtincha_toxtatgan: "Vaqtincha to'xtatgan (qaytish rejasi bor)",
  kasallik: 'Kasallik',
  kanikul: 'Lager/Kanikul (vaqtinchalik)',
  boshqa_fan: "Boshqa fan/sertifikatga o'tish",
  kurs_tugadi: "Kurs tugadi, davomi yo'q",
  motivatsiya: 'Motivatsiya/oilaviy sabab',
  ish_tadbir: 'Ishga ketish/oilaviy tadbir',
  universitet: 'Universitet sessiyasi',
  shaxsiy: 'Shaxsiy sabab',
  oqituvchidan_norozi: "O'qituvchidan norozilik",
  boshqa: 'Boshqa',
  sabab_korsatilmagan: "Sabab ko'rsatilmagan",
};

const MONTH_NAMES = ['', 'Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentyabr','Oktyabr','Noyabr','Dekabr'];

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('uz-UZ');
}

function cleanMarkdown(text: string) {
  if (!text) return '';
  return text
    .replace(/#{1,6}\s?/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '');
}

export default function FrozenStudentsPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const canFreeze = ['admin','administrator','sotuv_operatori','kassir'].includes(user?.role || '');
  const canReport = ['admin','filial_rahbari','kassir'].includes(user?.role || '');

  // Oy/Yil navigatsiya
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  // View rejimi
  const [activeView, setActiveView] = useState<'list' | 'report'>('list');
  const [reportTab, setReportTab] = useState<'summary' | 'teachers' | 'reasons' | 'duration' | 'all'>('summary');
  const [analysisMode, setAnalysisMode] = useState<'normal' | 'ai'>('normal');

  // Ma'lumotlar
  const [freezes, setFreezes] = useState<any[]>([]);
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);

  // Filtrlar
  const [search, setSearch] = useState('');
  const [filterReason, setFilterReason] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('');

  // Muzlatish modali
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [ungroupedStudents, setUngroupedStudents] = useState<any[]>([]);
  const [freezeForm, setFreezeForm] = useState({
    studentId: '', reason: '', detailedNote: '', phone: '', startDate: '', filial: '',
  });
  const [studentSearch, setStudentSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [studentSearchLoading, setStudentSearchLoading] = useState(false);

  // AI tahlil
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [aiError, setAiError] = useState('');

  // LTV kalkulyator
  const [monthlyFee, setMonthlyFee] = useState(600000);

  // Operator script
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [selectedFreeze, setSelectedFreeze] = useState<any | null>(null);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [scriptText, setScriptText] = useState('');
  const [scriptError, setScriptError] = useState('');

  const handleGetScript = async (freeze: any) => {
    setSelectedFreeze(freeze);
    setShowScriptModal(true);
    setScriptLoading(true);
    setScriptError('');
    setScriptText('');
    try {
      const res = await freezesApi.getOperatorScript(freeze.id);
      setScriptText(res.data.script || '');
    } catch (e: any) {
      setScriptError(e.response?.data?.message || 'Skript olishda xatolik yuz berdi');
    } finally {
      setScriptLoading(false);
    }
  };

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const loadFreezes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await freezesApi.getAll({ month, year, reason: filterReason || undefined, teacherName: filterTeacher || undefined, search: search || undefined });
      setFreezes(res.data.data || []);
    } catch { setFreezes([]); } finally { setLoading(false); }
  }, [month, year, filterReason, filterTeacher, search]);

  const loadReport = useCallback(async () => {
    if (!canReport) return;
    setReportLoading(true);
    try {
      const res = await freezesApi.getReport(month, year);
      setReportData(res.data.data);
    } catch { setReportData(null); } finally { setReportLoading(false); }
  }, [month, year, canReport]);

  useEffect(() => { loadFreezes(); }, [loadFreezes]);
  useEffect(() => { if (activeView === 'report') loadReport(); }, [activeView, loadReport]);

  const handleOpenFreezeModal = async () => {
    try {
      const ungroupRes = await usersApi.getUngrouped();
      setUngroupedStudents(ungroupRes.data.data || []);
      setAllStudents([]);
      setFreezeForm({ studentId: '', reason: '', detailedNote: '', phone: '', startDate: '', filial: '' });
      setStudentSearch('');
      setShowFreezeModal(true);
    } catch { alert("O'quvchilarni yuklashda xatolik"); }
  };

  const handleFreeze = async () => {
    if (!freezeForm.studentId || !freezeForm.reason) {
      alert("O'quvchi va sabab tanlanishi shart");
      return;
    }
    setSaving(true);
    try {
      await freezesApi.freeze(freezeForm);
      setShowFreezeModal(false);
      loadFreezes();
    } catch (e: any) {
      alert(e?.response?.data?.message || "Xatolik yuz berdi");
    } finally { setSaving(false); }
  };

  const handleUnfreeze = async (id: string, name: string) => {
    if (!confirm(`${name} ning muzlatilishini bekor qilasizmi?`)) return;
    try {
      await freezesApi.unfreeze(id);
      loadFreezes();
    } catch { alert("Xatolik yuz berdi"); }
  };

  const handleAiAnalyze = async () => {
    setAiLoading(true);
    setAiError('');
    setAiResult('');
    try {
      const res = await freezesApi.analyzeWithAI(month, year);
      setAiResult(res.data.analysis || '');
    } catch (e: any) {
      const err = e?.response?.data?.error;
      if (err === 'API_KEY_NOT_SET') setAiError('api_key');
      else if (err === 'NO_DATA') setAiError('no_data');
      else setAiError('connection');
    } finally { setAiLoading(false); }
  };

  // Filtrlangan o'quvchilar modal uchun
  // Backend qidiruv (debounced)
  useEffect(() => {
    if (!showFreezeModal) return;
    const timer = setTimeout(async () => {
      setStudentSearchLoading(true);
      try {
        const [ungroupRes, allRes] = await Promise.all([
          usersApi.getUngrouped(studentSearch || undefined),
          usersApi.getAll(1, 500, 'student', studentSearch || undefined),
        ]);
        setUngroupedStudents(ungroupRes.data.data || []);
        setAllStudents(allRes.data.data || []);
      } catch {}
      finally { setStudentSearchLoading(false); }
    }, 350);
    return () => clearTimeout(timer);
  }, [studentSearch, showFreezeModal]);

  const ungroupedFiltered = ungroupedStudents;
  const allFiltered = allStudents.filter(s => !ungroupedStudents.find(u => u.id === s.id));

  // Guruhlar bo'yicha guruhlash
  const allFilteredByGroup = allFiltered.reduce((acc: Record<string, any[]>, s: any) => {
    const groupName = s.group?.name || 'Guruhsiz';
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(s);
    return acc;
  }, {});

  // LTV hisoblash
  const avgLTV = reportData ? reportData.avgDuration * monthlyFee : 0;
  const totalLTV = reportData ? reportData.total * avgLTV : 0;

  return (
    <div>
      <Header
        title="Muzlatilgan O'quvchilar"
        subtitle={`${MONTH_NAMES[month]} ${year} — ${canFreeze ? 'Muzlatish va Hisobot' : 'Hisobot'}`}
      />

      <div className="p-6 max-w-7xl mx-auto">
        {/* Oy navigatsiya + view toggle */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-4 py-2 bg-zinc-800 rounded-lg text-white font-semibold min-w-[140px] text-center">
              {MONTH_NAMES[month]} {year}
            </span>
            <button onClick={nextMonth} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            {canReport && (
              <div className="flex bg-zinc-800 rounded-xl p-1">
                <button
                  onClick={() => setActiveView('list')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeView === 'list' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}
                >
                  <List className="w-4 h-4" /> Ro'yxat
                </button>
                <button
                  onClick={() => setActiveView('report')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeView === 'report' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}
                >
                  <BarChart2 className="w-4 h-4" /> Hisobot
                </button>
              </div>
            )}
            {canFreeze && (
              <button
                onClick={handleOpenFreezeModal}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" /> Yangi Muzlatish
              </button>
            )}
          </div>
        </div>

        {/* ===== RO'YXAT VIEW ===== */}
        {activeView === 'list' && (
          <div>
            {/* Filtrlar */}
            {canReport && (
              <div className="flex flex-wrap gap-3 mb-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    placeholder="Ism bo'yicha qidirish..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:border-blue-500 outline-none"
                  />
                </div>
                <select value={filterReason} onChange={e => setFilterReason(e.target.value)}
                  className="px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:border-blue-500 outline-none min-w-[200px]">
                  <option value="">Barcha sabablar</option>
                  {Object.entries(REASON_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    placeholder="O'qituvchi..."
                    value={filterTeacher}
                    onChange={e => setFilterTeacher(e.target.value)}
                    className="pl-9 pr-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:border-blue-500 outline-none w-[160px]"
                  />
                </div>
              </div>
            )}

            {/* Jadval */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              {loading ? (
                <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
              ) : freezes.length === 0 ? (
                <div className="text-center py-16 text-zinc-500">
                  <Snowflake className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Bu oy uchun muzlatilgan o'quvchi yo'q</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-800/50 text-zinc-400 text-xs uppercase">
                      <tr>
                        <th className="px-4 py-3 text-center w-10">№</th>
                        <th className="px-4 py-3 text-left">O'quvchi</th>
                        <th className="px-4 py-3 text-left">O'qituvchi</th>
                        <th className="px-4 py-3 text-left">Sabab</th>
                        <th className="px-4 py-3 text-left">Filial</th>
                        <th className="px-4 py-3 text-left">Sana</th>
                        {canReport && <th className="px-4 py-3 text-left">Tafsilot</th>}
                        <th className="px-4 py-3 text-center w-28">Skript</th>
                        {user?.role === 'admin' && <th className="px-4 py-3 text-center">Amal</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {freezes.map((f: any, i: number) => (
                        <tr key={f.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="px-4 py-3 text-center text-zinc-500 font-bold">{i+1}</td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-white font-medium">{f.studentName}</p>
                              {f.phone && <p className="text-zinc-500 text-xs">{f.phone}</p>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-zinc-300">{f.teacherName || '—'}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 rounded-lg bg-zinc-700/50 text-zinc-200 text-xs">
                              {REASON_LABELS[f.reason] || f.reason}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-zinc-400 text-xs">{f.filial || '—'}</td>
                          <td className="px-4 py-3 text-zinc-400 text-xs">{formatDate(f.frozenAt)}</td>
                          {canReport && <td className="px-4 py-3 text-zinc-500 text-xs max-w-[200px] truncate" title={f.detailedNote}>{f.detailedNote || '—'}</td>}
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleGetScript(f)}
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600/10 hover:bg-violet-600/20 text-violet-400 border border-violet-500/15 text-xs font-semibold transition-all duration-200"
                            >
                              <Brain className="w-3.5 h-3.5" /> Skript
                            </button>
                          </td>
                          {user?.role === 'admin' && (
                            <td className="px-4 py-3 text-center">
                              <button onClick={() => handleUnfreeze(f.id, f.studentName)}
                                className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors" title="Bekor qilish">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== HISOBOT VIEW ===== */}
        {activeView === 'report' && canReport && (
          <div>
            {/* AI / Normal toggle */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex bg-zinc-800 rounded-xl p-1">
                <button onClick={() => setAnalysisMode('normal')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${analysisMode === 'normal' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}>
                  <BarChart2 className="w-4 h-4" /> Oddiy Tahlil
                </button>
                <button onClick={() => setAnalysisMode('ai')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${analysisMode === 'ai' ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-white'}`}>
                  <Brain className="w-4 h-4" /> AI Tahlil
                </button>
              </div>
            </div>

            {/* === AI REJIM === */}
            {analysisMode === 'ai' && (
              <div className="bg-zinc-900 border border-violet-500/20 rounded-2xl p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                      <Brain className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold">AI Tahlil</h3>
                      <p className="text-zinc-500 text-xs">{MONTH_NAMES[month]} {year} ma'lumotlari asosida</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {aiResult && (
                      <button onClick={() => { navigator.clipboard.writeText(aiResult); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-zinc-300 text-xs transition-colors">
                        <Copy className="w-3.5 h-3.5" /> Nusxalash
                      </button>
                    )}
                    <button onClick={handleAiAnalyze} disabled={aiLoading}
                      className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
                      {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      {aiResult ? 'Qayta tahlil' : 'Tahlil qilish'}
                    </button>
                  </div>
                </div>

                {aiLoading && (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin" />
                      <Brain className="w-6 h-6 text-violet-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <p className="text-zinc-400 text-sm">AI tahlil qilmoqda...</p>
                  </div>
                )}

                {aiError && !aiLoading && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                      {aiError === 'api_key' && (
                        <>
                          <p className="text-amber-300 font-medium">AI API key sozlanmagan</p>
                          <p className="text-zinc-400 text-sm mt-1">Admin sozlamalarda API key kiriting.</p>
                          {user?.role === 'admin' && (
                            <button onClick={() => navigate('/admin/settings')}
                              className="mt-2 text-blue-400 text-sm hover:underline">Sozlamalarga o'tish →</button>
                          )}
                        </>
                      )}
                      {aiError === 'no_data' && <p className="text-amber-300">Bu oy uchun ma'lumot yo'q — tahlil qilib bo'lmadi.</p>}
                      {aiError === 'connection' && (
                        <>
                          <p className="text-amber-300 font-medium">AI bilan bog'lanib bo'lmadi</p>
                          <p className="text-zinc-400 text-sm">Oddiy tahlildan foydalaning yoki qayta urining.</p>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {aiResult && !aiLoading && (
                  <div
                    className="bg-zinc-800/50 rounded-xl p-5 text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap border border-zinc-700/50"
                    style={{ maxHeight: '480px', overflowY: 'scroll' }}
                  >
                    {cleanMarkdown(aiResult)}
                  </div>
                )}

                {!aiResult && !aiLoading && !aiError && (
                  <div className="text-center py-8 text-zinc-500">
                    <Brain className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>"Tahlil qilish" tugmasini bosing</p>
                    <p className="text-xs mt-1">AI ma'lumotlarni o'qib, chuqur tahlil beradi</p>
                  </div>
                )}
              </div>
            )}

            {/* === ODDIY TAHLIL TABLAR === */}
            {reportLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
            ) : !reportData ? (
              <div className="text-center py-16 text-zinc-500">
                <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Bu oy uchun ma'lumot yo'q</p>
              </div>
            ) : (
              <>
                {/* Tab navigatsiya */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
                  {([
                    { id: 'summary', label: 'Umumiy' },
                    { id: 'teachers', label: "O'qituvchilar" },
                    { id: 'reasons', label: 'Sabablar' },
                    { id: 'duration', label: "O'qigan muddat" },
                    { id: 'all', label: "To'liq ro'yxat" },
                  ] as const).map(tab => (
                    <button key={tab.id} onClick={() => setReportTab(tab.id)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${reportTab === tab.id ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* TAB 1: UMUMIY */}
                {reportTab === 'summary' && (
                  <div className="space-y-6">
                    {/* Stat kartalar */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[
                        { label: 'Jami ketgan', value: `${reportData.total} ta`, color: 'text-red-400' },
                        { label: "O'rt. o'qigan muddat", value: `${reportData.avgDuration} oy`, color: 'text-blue-400' },
                        { label: "Eng uzoq", value: `${reportData.maxDuration} oy`, color: 'text-emerald-400' },
                        { label: 'Eng qisqa', value: `${reportData.minDuration} oy`, color: 'text-amber-400' },
                      ].map(s => (
                        <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                          <p className="text-zinc-500 text-xs mb-2">{s.label}</p>
                          <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* LTV kalkulyator */}
                    <div className="bg-zinc-900 border border-amber-500/20 rounded-2xl p-6">
                      <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                        💰 LTV Hisoblash
                      </h3>
                      <div className="flex flex-wrap items-center gap-4 mb-4">
                        <div>
                          <label className="text-zinc-400 text-xs block mb-1">1 oylik to'lov (so'm)</label>
                          <input
                            type="number"
                            value={monthlyFee}
                            onChange={e => setMonthlyFee(Number(e.target.value))}
                            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:border-amber-500 outline-none w-[160px]"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-zinc-800/50 rounded-xl p-4">
                          <p className="text-zinc-400 text-xs mb-1">O'rtacha LTV (1 o'quvchi)</p>
                          <p className="text-amber-400 text-xl font-bold">{avgLTV.toLocaleString()} so'm</p>
                        </div>
                        <div className="bg-zinc-800/50 rounded-xl p-4">
                          <p className="text-zinc-400 text-xs mb-1">Jami yo'qotilgan LTV</p>
                          <p className="text-red-400 text-xl font-bold">{totalLTV.toLocaleString()} so'm</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: O'QITUVCHILAR */}
                {reportTab === 'teachers' && (
                  <div className="space-y-6">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                      <div className="p-4 border-b border-zinc-800">
                        <h3 className="text-white font-bold">O'qituvchilar bo'yicha ketish hisoboti</h3>
                      </div>
                      <table className="w-full text-sm">
                        <thead className="bg-zinc-800/50 text-zinc-400 text-xs uppercase">
                          <tr>
                            <th className="px-4 py-3">O'qituvchi</th>
                            <th className="px-4 py-3 text-center">Ketgan</th>
                            <th className="px-4 py-3 text-center">O'rt. o'qigan oy</th>
                            <th className="px-4 py-3 text-center">Ulushi %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                          {reportData.teachers.map((t: any, i: number) => (
                            <tr key={i} className="hover:bg-zinc-800/30">
                              <td className="px-4 py-3 text-white font-medium">{t.teacher}</td>
                              <td className="px-4 py-3 text-center text-red-400 font-bold">{t.count}</td>
                              <td className="px-4 py-3 text-center text-zinc-300">{t.avgDuration}</td>
                              <td className="px-4 py-3 text-center text-zinc-400">{t.percent}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                      <h4 className="text-white font-semibold mb-4 text-sm">O'qituvchi bo'yicha ketgan o'quvchilar soni</h4>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={reportData.teachers}>
                          <XAxis dataKey="teacher" tick={{ fill: '#71717a', fontSize: 11 }} />
                          <YAxis tick={{ fill: '#71717a', fontSize: 11 }} />
                          <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }} />
                          <Bar dataKey="count" fill="#3b82f6" radius={[4,4,0,0]} name="Ketgan" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* TAB 3: SABABLAR */}
                {reportTab === 'reasons' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-zinc-800">
                          <h3 className="text-white font-bold text-sm">Sabab kategoriyasi bo'yicha</h3>
                        </div>
                        <table className="w-full text-sm">
                          <thead className="bg-zinc-800/50 text-zinc-400 text-xs uppercase">
                            <tr>
                              <th className="px-4 py-2 text-left">Sabab</th>
                              <th className="px-4 py-2 text-center">Soni</th>
                              <th className="px-4 py-2 text-center">Ulushi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800">
                            {reportData.reasons.map((r: any, i: number) => (
                              <tr key={i} className="hover:bg-zinc-800/30">
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                                    <span className="text-zinc-200 text-xs">{r.reason}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-2.5 text-center text-white font-bold">{r.count}</td>
                                <td className="px-4 py-2.5 text-center text-zinc-400">{r.percent}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col">
                        <h4 className="text-white font-semibold mb-4 text-sm">Ketish sabablari ulushi</h4>
                        <div className="flex-1 flex items-center justify-center">
                          <ResponsiveContainer width="100%" height={260}>
                            <PieChart>
                              <Pie data={reportData.reasons} dataKey="count" nameKey="reason" cx="50%" cy="50%" outerRadius={90}>
                                {reportData.reasons.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                              </Pie>
                              <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }} />
                              <Legend wrapperStyle={{ fontSize: 11, color: '#a1a1aa' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                      <h4 className="text-white font-semibold mb-4 text-sm">Sabablar bo'yicha soni</h4>
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={[...reportData.reasons].reverse()} layout="vertical" margin={{ left: 20 }}>
                          <XAxis type="number" tick={{ fill: '#71717a', fontSize: 11 }} />
                          <YAxis type="category" dataKey="reason" tick={{ fill: '#71717a', fontSize: 10 }} width={180} />
                          <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }} />
                          <Bar dataKey="count" fill="#10b981" radius={[0,4,4,0]} name="Soni" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* TAB 4: O'QIGAN MUDDAT */}
                {reportTab === 'duration' && (
                  <div className="space-y-6">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                      <div className="p-4 border-b border-zinc-800">
                        <h3 className="text-white font-bold text-sm">O'quvchilar necha oy o'qigan</h3>
                      </div>
                      <table className="w-full text-sm">
                        <thead className="bg-zinc-800/50 text-zinc-400 text-xs uppercase">
                          <tr>
                            <th className="px-6 py-3 text-left">Muddat (oy guruh)</th>
                            <th className="px-6 py-3 text-center">O'quvchilar soni</th>
                            <th className="px-6 py-3 text-center">Ulushi (%)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                          {reportData.durationGroups.map((d: any, i: number) => (
                            <tr key={i} className="hover:bg-zinc-800/30">
                              <td className="px-6 py-3 text-white font-medium">{d.label}</td>
                              <td className="px-6 py-3 text-center text-blue-400 font-bold">{d.count}</td>
                              <td className="px-6 py-3 text-center text-zinc-400">{d.percent}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                      <h4 className="text-white font-semibold mb-4 text-sm">O'qigan muddat bo'yicha taqsimot</h4>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={reportData.durationGroups}>
                          <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} />
                          <YAxis tick={{ fill: '#71717a', fontSize: 11 }} />
                          <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }} />
                          <Bar dataKey="count" fill="#f59e0b" radius={[4,4,0,0]} name="O'quvchilar soni" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* TAB 5: TO'LIQ RO'YXAT */}
                {reportTab === 'all' && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                      <h3 className="text-white font-bold text-sm">To'liq ro'yxat ({reportData.rawList?.length || 0} ta)</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-zinc-800/50 text-zinc-400 uppercase">
                          <tr>
                            {['№','O\'quvchi','O\'qituvchi','Sabab kat.','Sabab (tafsilot)','Boshlagan sana','Filial'].map(h => (
                              <th key={h} className="px-4 py-3 text-left">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                          {reportData.rawList?.map((f: any, i: number) => {
                            const months = f.startDate
                              ? Math.round((new Date(f.frozenAt).getTime() - new Date(f.startDate).getTime()) / (1000*60*60*24*30))
                              : null;
                            return (
                              <tr key={f.id} className="hover:bg-zinc-800/30">
                                <td className="px-4 py-3 text-zinc-500 font-bold">{i+1}</td>
                                <td className="px-4 py-3 text-white">{f.studentName}</td>
                                <td className="px-4 py-3 text-zinc-300">{f.teacherName || '—'}</td>
                                <td className="px-4 py-3 text-zinc-400">{REASON_LABELS[f.reason] || f.reason}</td>
                                <td className="px-4 py-3 text-zinc-500 max-w-[180px] truncate" title={f.detailedNote}>{f.detailedNote || '—'}</td>
                                <td className="px-4 py-3 text-zinc-400">
                                  {f.startDate ? `${formatDate(f.startDate)} (${months} oy)` : '—'}
                                </td>
                                <td className="px-4 py-3 text-zinc-400">{f.filial || '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ===== MUZLATISH MODALI ===== */}
      {showFreezeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 rounded-2xl w-full max-w-lg border border-zinc-700 shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Snowflake className="w-5 h-5 text-blue-400" />
                </div>
                <h2 className="text-white font-bold">O'quvchini Muzlatish</h2>
              </div>
              <button onClick={() => setShowFreezeModal(false)} className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* O'quvchi tanlash */}
              <div>
                <label className="text-zinc-400 text-xs block mb-2">O'quvchi tanlash *</label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input placeholder="Ism yoki login..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:border-blue-500 outline-none" />
                  {studentSearchLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 animate-spin" />}
                </div>
                <div className="bg-zinc-800 border border-zinc-700 rounded-xl max-h-[220px] overflow-y-auto divide-y divide-zinc-700/50">
                  {ungroupedFiltered.length === 0 && allFiltered.length === 0 && (
                    <div className="px-3 py-4 text-center text-zinc-500 text-sm">O'quvchi topilmadi</div>
                  )}
                  {ungroupedFiltered.length > 0 && (
                    <>
                      <div className="px-3 py-1.5 text-xs text-emerald-400 font-semibold bg-emerald-500/5 sticky top-0">
                        🔓 Guruhsiz o'quvchilar ({ungroupedFiltered.length})
                      </div>
                      {ungroupedFiltered.map(s => (
                        <label key={s.id} className={`flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-700 cursor-pointer transition-colors ${freezeForm.studentId === s.id ? 'bg-blue-500/10' : ''}`}>
                          <input type="radio" name="student" value={s.id} checked={freezeForm.studentId === s.id} onChange={() => setFreezeForm(f => ({ ...f, studentId: s.id }))} className="accent-blue-500" />
                          <div>
                            <p className="text-white text-sm">{s.fullName}</p>
                            <p className="text-zinc-500 text-xs">{s.login}</p>
                          </div>
                        </label>
                      ))}
                    </>
                  )}
                  {Object.entries(allFilteredByGroup).map(([groupName, students]: [string, any]) => (
                    <div key={groupName}>
                      <div className="px-3 py-1.5 text-xs text-blue-400 font-semibold bg-blue-500/5 sticky top-0">
                        📚 {groupName} ({students.length})
                      </div>
                      {students.map((s: any) => (
                        <label key={s.id} className={`flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-700 cursor-pointer transition-colors ${freezeForm.studentId === s.id ? 'bg-blue-500/10' : ''}`}>
                          <input type="radio" name="student" value={s.id} checked={freezeForm.studentId === s.id} onChange={() => setFreezeForm(f => ({ ...f, studentId: s.id }))} className="accent-blue-500" />
                          <div>
                            <p className="text-white text-sm">{s.fullName}</p>
                            <p className="text-zinc-500 text-xs">{s.login} · <span className="text-blue-400">{groupName}</span></p>
                          </div>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Qo'shimcha ma'lumotlar */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 text-xs block mb-1">Telefon</label>
                  <input placeholder="+998 90..." value={freezeForm.phone} onChange={e => setFreezeForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="text-zinc-400 text-xs block mb-1">Boshlagan sana</label>
                  <input type="date" value={freezeForm.startDate} onChange={e => setFreezeForm(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:border-blue-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="text-zinc-400 text-xs block mb-1">Filial</label>
                <input placeholder="Beeline, Stomatologiya..." value={freezeForm.filial} onChange={e => setFreezeForm(f => ({ ...f, filial: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:border-blue-500 outline-none" />
              </div>

              {/* Sabab */}
              <div>
                <label className="text-zinc-400 text-xs block mb-2">Sabab kategoriyasi *</label>
                <div className="space-y-1.5 bg-zinc-800 border border-zinc-700 rounded-xl p-3 max-h-[220px] overflow-y-auto">
                  {Object.entries(REASON_LABELS).map(([k, v]) => (
                    <label key={k} className={`flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-700 cursor-pointer transition-colors ${freezeForm.reason === k ? 'bg-blue-500/10 border border-blue-500/20' : ''}`}>
                      <input type="radio" name="reason" value={k} checked={freezeForm.reason === k} onChange={() => setFreezeForm(f => ({ ...f, reason: k }))} className="accent-blue-500" />
                      <span className="text-zinc-200 text-sm">{v}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Tafsilot */}
              <div>
                <label className="text-zinc-400 text-xs block mb-1">Sabab (tafsilot)</label>
                <textarea placeholder="Qo'shimcha izoh..." value={freezeForm.detailedNote} onChange={e => setFreezeForm(f => ({ ...f, detailedNote: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:border-blue-500 outline-none resize-none" />
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-zinc-800 flex gap-3">
              <button onClick={() => setShowFreezeModal(false)}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm font-medium transition-colors">
                Bekor qilish
              </button>
              <button onClick={handleFreeze} disabled={saving || !freezeForm.studentId || !freezeForm.reason}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Snowflake className="w-4 h-4" />}
                Muzlatish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== OPERATOR SCRIPT MODALI ===== */}
      {showScriptModal && selectedFreeze && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 rounded-2xl w-full max-w-2xl border border-zinc-700 shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-gradient-to-r from-violet-950/20 to-zinc-900">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20 animate-pulse">
                  <Brain className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-base">Muloqot Skripti: {selectedFreeze.studentName}</h2>
                  <p className="text-xs text-zinc-400">Ketish sababi: {REASON_LABELS[selectedFreeze.reason] || selectedFreeze.reason}</p>
                </div>
              </div>
              <button onClick={() => setShowScriptModal(false)} className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {scriptLoading && (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin" />
                    <Brain className="w-6 h-6 text-violet-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <p className="text-zinc-400 text-sm">Sun'iy intellekt 10 yillik tajribali operator sifatida skript tuzmoqda...</p>
                </div>
              )}

              {scriptError && !scriptLoading && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-red-300 font-medium">Skript yaratib bo'lmadi</p>
                    <p className="text-zinc-400 text-sm mt-1">{scriptError}</p>
                  </div>
                </div>
              )}

              {scriptText && !scriptLoading && (
                <div className="bg-zinc-950 rounded-xl p-5 text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap font-sans border border-zinc-800">
                  {scriptText}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-zinc-800 flex gap-3 bg-zinc-950/20">
              <button onClick={() => setShowScriptModal(false)}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm font-medium transition-colors">
                Yopish
              </button>
              {scriptText && !scriptLoading && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(scriptText);
                    alert("Skript muvaffaqiyatli nusxalandi!");
                  }}
                  className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20"
                >
                  <Copy className="w-4 h-4" /> Nusxalash
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
