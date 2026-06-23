import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/api/client';
import {
  BarChart3, TrendingUp, Users, Award, AlertTriangle,
  ChevronDown, ChevronRight, Calendar, RefreshCw,
  X, CheckCircle2, XCircle, Clock, Star, User,
  ClipboardList, Trophy, Minus, ChevronLeft,
} from 'lucide-react';

// Sana yordamchi funksiyalari
function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Yak', 'Dush', 'Ses', 'Chor', 'Pay', 'Juma', 'Shan'];
  const months = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

type Period = 'today' | 'weekly' | 'monthly';

interface DayData { date: string; done: number; total: number; percent: number; }
interface UserStat {
  id: string; fullName: string; login: string;
  todayDone: number; todayTotal: number; todayPercent: number;
  avgPercent: number; dailyData: DayData[];
}
interface RoleStat {
  role: string; label: string; totalItems: number; totalUsers: number;
  avgTodayPercent: number; avgPeriodPercent: number; users: UserStat[];
}
interface Summary {
  overallTodayPercent: number; totalRoles: number; totalUsers: number;
  bestRole: { role: string; label: string; percent: number } | null;
  worstRole: { role: string; label: string; percent: number } | null;
}
interface StatsData {
  period: string; days: string[]; todayStr: string;
  summary: Summary; roles: RoleStat[];
}

// Detail modal types
interface DetailItem {
  id: string; order: number; category: string; description: string;
  score: number; isDone: boolean; doneAt: string | null;
}
interface DetailSection {
  name: string; items: DetailItem[]; doneCount: number; total: number;
}
interface DetailData {
  user: { id: string; fullName: string; login: string; role: string; avatarUrl: string | null };
  date: string;
  summary: { totalItems: number; doneItems: number; notDoneItems: number; completionPercent: number; totalScore: number; earnedScore: number };
  sections: DetailSection[];
}

function getColor(pct: number) {
  if (pct >= 80) return { bg: 'bg-emerald-500', text: 'text-emerald-400', bar: '#22c55e', light: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', ring: 'ring-emerald-500/30' };
  if (pct >= 50) return { bg: 'bg-amber-500', text: 'text-amber-400', bar: '#f59e0b', light: 'bg-amber-500/10 border-amber-500/20 text-amber-400', ring: 'ring-amber-500/30' };
  return { bg: 'bg-red-500', text: 'text-red-400', bar: '#ef4444', light: 'bg-red-500/10 border-red-500/20 text-red-400', ring: 'ring-red-500/30' };
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function formatTime(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ── Farrosh Read-only Checklist Modal ─────────────────────────────────────────
function FarroshChecklistModal({ onClose }: { onClose: () => void }) {
  const [sections, setSections] = useState<{ name: string; items: { id: string; category: string; description: string; order: number }[] }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get('/checklist/items?role=farrosh');
        const items: { id: string; category: string; description: string; order: number; section?: string }[] = res.data.data || res.data;
        const grouped: Record<string, typeof items> = {};
        for (const item of items) {
          const sec = item.section || 'Umumiy';
          if (!grouped[sec]) grouped[sec] = [];
          grouped[sec].push(item);
        }
        setSections(Object.entries(grouped).map(([name, its]) => ({ name, items: its.sort((a, b) => a.order - b.order) })));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleBackdrop = (e: React.MouseEvent) => { if (e.target === e.currentTarget) onClose(); };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(6px)' }}
      onClick={handleBackdrop}
    >
      <div className="w-full max-w-lg max-h-[85vh] flex flex-col bg-[#111113] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Farrosh — Checklist</h2>
              <p className="text-xs text-zinc-500">Kunlik vazifalar ro'yxati</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading && (
            <div className="flex items-center justify-center h-32">
              <div className="w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!loading && sections.map(sec => (
            <div key={sec.name}>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1 bg-zinc-800" />
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider px-2">{sec.name}</span>
                <div className="h-px flex-1 bg-zinc-800" />
              </div>
              <div className="space-y-2">
                {sec.items.map((item, idx) => (
                  <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-900/60">
                    <div className="w-6 h-6 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-zinc-500">{idx + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{item.category}</p>
                      {item.description && (
                        <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{item.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!loading && sections.length === 0 && (
            <div className="text-center py-10 text-zinc-600">
              <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Checklist topilmadi</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Detail Modal ──────────────────────────────────────────────────────────────
function UserDetailModal({
  userId, date, roleLabel, onClose
}: { userId: string; date: string; roleLabel: string; onClose: () => void }) {
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/checklist/user-detail/${userId}?date=${date}`);
        setData(res.data.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [userId, date]);

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={handleBackdrop}
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-[#111113] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden">

        {/* Loading */}
        {loading && (
          <div className="flex-1 flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && data && (() => {
          const c = getColor(data.summary.completionPercent);
          const pct = data.summary.completionPercent;

          return (
            <>
              {/* Header */}
              <div className="relative p-6 pb-0">
                <button onClick={onClose}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-all">
                  <X className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-4 mb-5">
                  {/* Avatar */}
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black text-white shrink-0 ${c.bg}`}>
                    {getInitials(data.user.fullName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-white truncate">{data.user.fullName}</h2>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs font-mono text-zinc-500">{data.user.login}</span>
                      <span className="text-zinc-700">·</span>
                      <span className="text-xs text-blue-400 font-medium">{roleLabel}</span>
                      <span className="text-zinc-700">·</span>
                      <span className="text-xs text-zinc-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />{data.date}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stats strip */}
                <div className="grid grid-cols-4 gap-3 mb-5">
                  {/* Circular progress */}
                  <div className={`col-span-1 rounded-2xl p-3 border flex flex-col items-center justify-center ${c.light}`}>
                    <div className="relative w-14 h-14">
                      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                        <circle cx="28" cy="28" r="22" fill="none" stroke="#27272a" strokeWidth="5" />
                        <circle cx="28" cy="28" r="22" fill="none" stroke={c.bar} strokeWidth="5"
                          strokeDasharray={`${2 * Math.PI * 22}`}
                          strokeDashoffset={`${2 * Math.PI * 22 * (1 - pct / 100)}`}
                          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
                      </svg>
                      <span className={`absolute inset-0 flex items-center justify-center text-sm font-black ${c.text}`}>{pct}%</span>
                    </div>
                  </div>
                  {/* Counts */}
                  <div className="col-span-3 grid grid-cols-3 gap-3">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-center">
                      <div className="text-2xl font-black text-emerald-400">{data.summary.doneItems}</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">Bajarildi</div>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-center">
                      <div className="text-2xl font-black text-red-400">{data.summary.notDoneItems}</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">Bajarilmadi</div>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <Star className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-2xl font-black text-amber-400">{data.summary.earnedScore}</span>
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">/ {data.summary.totalScore} ball</div>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden mb-1">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${c.bar}, ${c.bar}dd)` }} />
                </div>
                <div className="text-xs text-zinc-600 mb-4">{data.summary.doneItems} ta / {data.summary.totalItems} ta vazifa bajarildi</div>
              </div>

              {/* Scrollable sections */}
              <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
                {data.sections.map(section => (
                  <div key={section.name}>
                    {/* Section header */}
                    <div className="flex items-center gap-2 mb-2 sticky top-0 bg-[#111113] py-1">
                      <div className="h-px flex-1 bg-zinc-800" />
                      <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 shrink-0 px-2">
                        <ClipboardList className="w-3.5 h-3.5" />
                        {section.name}
                        <span className={`px-1.5 py-0.5 rounded text-[10px] border ${getColor(section.total > 0 ? Math.round(section.doneCount / section.total * 100) : 0).light}`}>
                          {section.doneCount}/{section.total}
                        </span>
                      </div>
                      <div className="h-px flex-1 bg-zinc-800" />
                    </div>

                    {/* Items */}
                    <div className="space-y-2">
                      {section.items.map(item => (
                        <div key={item.id}
                          className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                            item.isDone
                              ? 'bg-emerald-500/5 border-emerald-500/20'
                              : 'bg-zinc-900/60 border-zinc-800/60'
                          }`}>
                          {/* Status icon */}
                          <div className="shrink-0 mt-0.5">
                            {item.isDone
                              ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                              : <XCircle className="w-5 h-5 text-red-400/60" />
                            }
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm font-medium ${item.isDone ? 'text-white' : 'text-zinc-400'}`}>
                                {item.category}
                              </span>
                              {item.isDone && item.doneAt && (
                                <span className="flex items-center gap-1 text-[10px] text-emerald-500/70 font-mono">
                                  <Clock className="w-2.5 h-2.5" />
                                  {formatTime(item.doneAt)}
                                </span>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-xs text-zinc-600 mt-0.5 line-clamp-2">{item.description}</p>
                            )}
                          </div>

                          {/* Score badge */}
                          <div className="shrink-0 flex items-center gap-1">
                            <Star className={`w-3 h-3 ${item.isDone ? 'text-amber-400' : 'text-zinc-700'}`} />
                            <span className={`text-xs font-bold ${item.isDone ? 'text-amber-400' : 'text-zinc-700'}`}>
                              {item.isDone ? item.score : '—'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-zinc-800 flex items-center justify-between">
                <span className="text-xs text-zinc-600">
                  {pct >= 80 ? '🏆 Ajoyib natija!' : pct >= 50 ? '⚡ Davom eting!' : '⚠️ Yaxshilanish kerak'}
                </span>
                <button onClick={onClose}
                  className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors">
                  Yopish
                </button>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ChecklistStatsPage() {
  const [period, setPeriod] = useState<Period>('today');
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [silentLoading, setSilentLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedUser, setSelectedUser] = useState<{ id: string; roleLabel: string } | null>(null);
  const [showFarroshModal, setShowFarroshModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(toLocalDateStr(new Date()));
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goDay = (delta: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    const next = toLocalDateStr(d);
    if (next <= toLocalDateStr(new Date())) setSelectedDate(next);
  };

  // Birinchi marta — loading bilan, keyingi marta — silent
  const fetchStats = useCallback(async (silent = false) => {
    if (silent) setSilentLoading(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/checklist/admin-stats?period=${period}&date=${selectedDate}`);
      setData(res.data.data);
      setLastUpdated(new Date());
      setSecondsAgo(0);
    } catch (err: any) {
      if (!silent) {
        if (err?.response?.status === 401) {
          setError('Sessiya muddati tugadi. Iltimos qayta kiring.');
        } else {
          setError('Ma\'lumot yuklab olishda xato yuz berdi.');
        }
      }
    } finally {
      if (silent) setSilentLoading(false);
      else setLoading(false);
    }
  }, [period, selectedDate]);

  // Dastlabki yuklash va period/sana o'zgarganda
  useEffect(() => { fetchStats(false); }, [fetchStats]);

  // 30 soniyada avtomatik yangilash
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      fetchStats(true);
    }, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchStats]);

  // "X soniya oldin" hisoblagich
  useEffect(() => {
    if (!lastUpdated) return;
    const tick = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [lastUpdated]);

  const toggleExpand = (role: string) => setExpanded(p => ({ ...p, [role]: !p[role] }));
  const handleManualRefresh = () => fetchStats(false);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="text-4xl">⚠️</div>
      <p className="text-zinc-400 text-center">{error}</p>
      <button onClick={() => fetchStats()}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors">
        Qayta urinish
      </button>
    </div>
  );

  if (!data) return null;

  const { summary, roles, days, todayStr } = data;

  return (
    <>
      {/* User Detail Modal */}
      {selectedUser && (
        <UserDetailModal
          userId={selectedUser.id}
          date={selectedDate}
          roleLabel={selectedUser.roleLabel}
          onClose={() => setSelectedUser(null)}
        />
      )}

      {/* Farrosh Checklist Modal */}
      {showFarroshModal && (
        <FarroshChecklistModal onClose={() => setShowFarroshModal(false)} />
      )}

      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-blue-400" />
              Checklist Statistikasi
            </h1>
            <p className="text-zinc-500 text-sm mt-1">Xodimlarning kunlik vazifalar bajarilishi</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Sana tanlash */}
            <div className="flex items-center gap-1 bg-[#18181b] border border-zinc-800 rounded-xl px-2 py-1">
              <button
                onClick={() => goDay(-1)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                title="Oldingi kun"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2 px-2">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                <input
                  type="date"
                  value={selectedDate}
                  max={toLocalDateStr(new Date())}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="bg-transparent text-sm text-white font-medium outline-none cursor-pointer [color-scheme:dark]"
                />
              </div>
              <button
                onClick={() => goDay(1)}
                disabled={selectedDate >= toLocalDateStr(new Date())}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Keyingi kun"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            {/* Davr filtri */}
            <div className="flex bg-[#18181b] border border-zinc-800 rounded-xl overflow-hidden">
              {(['today', 'weekly', 'monthly'] as Period[]).map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${period === p ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}>
                  {p === 'today' ? 'Bugun' : p === 'weekly' ? 'Haftalik' : 'Oylik'}
                </button>
              ))}
            </div>
            <button onClick={handleManualRefresh}
              className={`p-2 rounded-xl bg-[#18181b] border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 transition-all ${silentLoading ? 'animate-spin' : ''}`}>
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Live indicator + last updated */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE
            </span>
            {lastUpdated && (
              <span className="text-xs text-zinc-600">
                {secondsAgo < 5 ? 'Yangilandi' : `${secondsAgo} soniya oldin yangilandi`}
              </span>
            )}
          </div>
          <span className="text-xs text-zinc-600">Har 30 soniyada avtomatik yangilanadi</span>
        </div>

        {/* Tanlangan sana ko'rsatgichi */}
        {selectedDate !== toLocalDateStr(new Date()) && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-amber-300 font-medium">
              Xodim ustiga bossangiz <span className="font-bold">{formatDisplayDate(selectedDate)}</span> sanasidagi checklist ko'rsatiladi
            </span>
            <button
              onClick={() => setSelectedDate(toLocalDateStr(new Date()))}
              className="ml-auto text-xs text-amber-400 hover:text-white transition-colors px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/40"
            >Bugunga qaytish</button>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#18181b] border border-zinc-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">UMUMIY ({selectedDate === toLocalDateStr(new Date()) ? 'BUGUN' : formatDisplayDate(selectedDate)})</span>
            </div>
            <div className="text-4xl font-black text-white mb-2">{summary.overallTodayPercent}%</div>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${summary.overallTodayPercent}%`, background: summary.overallTodayPercent >= 80 ? '#22c55e' : summary.overallTodayPercent >= 50 ? '#f59e0b' : '#ef4444' }} />
            </div>
          </div>

          <div className="bg-[#18181b] border border-zinc-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Xodimlar</span>
            </div>
            <div className="text-4xl font-black text-white mb-1">{summary.totalUsers}</div>
            <p className="text-xs text-zinc-500">{summary.totalRoles} ta rol</p>
          </div>

          <div className="bg-[#18181b] border border-emerald-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Eng yaxshi</span>
            </div>
            {summary.bestRole ? (
              <>
                <div className="text-2xl font-bold text-emerald-400">{summary.bestRole.percent}%</div>
                <p className="text-xs text-zinc-400 mt-1 truncate">{summary.bestRole.label}</p>
              </>
            ) : <p className="text-zinc-600 text-sm">Ma'lumot yo'q</p>}
          </div>

          <div className="bg-[#18181b] border border-red-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Eng past</span>
            </div>
            {summary.worstRole ? (
              <>
                <div className="text-2xl font-bold text-red-400">{summary.worstRole.percent}%</div>
                <p className="text-xs text-zinc-400 mt-1 truncate">{summary.worstRole.label}</p>
              </>
            ) : <p className="text-zinc-600 text-sm">Ma'lumot yo'q</p>}
          </div>
        </div>

        {/* Roles list */}
        <div className="space-y-3">
          {roles.map(role => {
            const c = getColor(role.avgTodayPercent);
            const isOpen = expanded[role.role];
            return (
              <div key={role.role} className="bg-[#18181b] border border-zinc-800 rounded-2xl overflow-hidden">
                {/* Role header */}
                <div
                  onClick={() => {
                    if (role.role === 'farrosh') { setShowFarroshModal(true); return; }
                    if (role.totalUsers > 0) toggleExpand(role.role);
                  }}
                  className={`flex items-center gap-4 p-4 ${role.role === 'farrosh' || role.totalUsers > 0 ? 'cursor-pointer hover:bg-zinc-800/40' : ''} transition-colors`}
                >
                  <div className="w-5 shrink-0">
                    {role.totalUsers > 0 && (
                      isOpen ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{role.label}</span>
                      <span className="text-xs text-zinc-600">{role.totalItems} ta vazifa</span>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-1 text-xs text-zinc-500 shrink-0">
                    <Users className="w-3.5 h-3.5" />
                    <span>{role.totalUsers} kishi</span>
                  </div>
                  {period !== 'today' && (
                    <div className="hidden md:block shrink-0 w-24 text-center">
                      <div className="text-xs text-zinc-500 mb-1">O'rtacha</div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded border ${getColor(role.avgPeriodPercent).light}`}>
                        {role.avgPeriodPercent}%
                      </span>
                    </div>
                  )}
                  <div className="w-40 shrink-0">
                    {role.totalUsers > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${role.avgTodayPercent}%`, background: c.bar }} />
                        </div>
                        <span className={`text-sm font-bold w-10 text-right ${c.text}`}>{role.avgTodayPercent}%</span>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-600 italic">Foydalanuvchi yo'q</span>
                    )}
                  </div>
                </div>

                {/* Expanded user rows */}
                {isOpen && role.users.length > 0 && (
                  <div className="border-t border-zinc-800">
                    {/* Day headers for weekly/monthly */}
                    {period !== 'today' && days.length > 1 && (
                      <div className="flex items-center gap-2 px-6 py-2 bg-zinc-900/50">
                        <div className="w-5" />
                        <div className="flex-1 text-xs text-zinc-600 font-medium">Xodim</div>
                        <div className="flex gap-1 shrink-0">
                          {days.slice(-7).map(d => (
                            <div key={d} className="w-8 text-center text-[9px] text-zinc-600">{formatDate(d)}</div>
                          ))}
                        </div>
                        <div className="w-40 text-right text-xs text-zinc-600 pr-1">Bugun / Bosing</div>
                      </div>
                    )}

                    {role.users.map(user => (
                      <div key={user.id}
                        className="flex items-center gap-3 px-6 py-3 hover:bg-zinc-800/30 border-t border-zinc-800/50 transition-colors group"
                      >
                        <div className="w-5 shrink-0">
                          <div className={`w-2 h-2 rounded-full ${getColor(user.todayPercent).bg}`} />
                        </div>

                        {/* User name — clickable */}
                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => setSelectedUser({ id: user.id, roleLabel: role.label })}
                        >
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-white font-medium truncate group-hover:text-blue-300 transition-colors">
                              {user.fullName}
                            </p>
                            <span className="text-[10px] text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">
                              → batafsil
                            </span>
                          </div>
                          <p className="text-xs text-zinc-600 font-mono">{user.login}</p>
                        </div>

                        {/* Day cells for weekly/monthly */}
                        {period !== 'today' && days.length > 1 && (
                          <div className="flex gap-1 shrink-0">
                            {user.dailyData.slice(-7).map(d => {
                              const dc = getColor(d.percent);
                              return (
                                <div key={d.date} title={`${d.date}: ${d.done}/${d.total} (${d.percent}%)`}
                                  className={`w-8 h-6 rounded flex items-center justify-center text-[9px] font-bold border ${dc.light}`}>
                                  {d.percent > 0 ? `${d.percent}%` : '—'}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Today completion + detail button */}
                        <div className="w-40 shrink-0 flex items-center gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${user.todayPercent}%`, background: getColor(user.todayPercent).bar }} />
                              </div>
                              <span className={`text-xs font-bold w-8 text-right ${getColor(user.todayPercent).text}`}>
                                {user.todayDone}/{user.todayTotal}
                              </span>
                            </div>
                          </div>
                          {/* Detail button */}
                          <button
                            onClick={() => setSelectedUser({ id: user.id, roleLabel: role.label })}
                            className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-blue-600 border border-zinc-700 hover:border-blue-500 flex items-center justify-center text-zinc-500 hover:text-white transition-all shrink-0"
                            title="Batafsil ko'rish"
                          >
                            <ClipboardList className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 text-xs text-zinc-600 justify-center">
          <Calendar className="w-3.5 h-3.5" />
          <span>Rang: 🟢 80%+ yaxshi · 🟡 50-79% qoniqarli · 🔴 50%dan past · Xodim ustiga bosing — batafsil ko'ring</span>
        </div>
      </div>
    </>
  );
}
