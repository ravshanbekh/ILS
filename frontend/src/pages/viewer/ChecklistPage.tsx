import { useState, useEffect, useCallback } from 'react';
import { checklistApi } from '@/api';
import {
  CheckSquare, Square, TrendingUp, Calendar, Clock,
  Lock, CheckCircle2, XCircle, Minus,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChecklistItem {
  id: string;
  order: number;
  score: number;
  section: string | null;
  category: string;
  description: string | null;
  isDone: boolean;
  doneAt: string | null;
}
interface Progress { done: number; total: number; percent: number; }
interface DayResponse {
  date: string;
  isToday: boolean;
  isReadOnly: boolean;
  isFuture?: boolean;
  items: ChecklistItem[];
  progress: Progress;
}
interface WeekDay {
  date: string;       // YYYY-MM-DD
  done: number;
  total: number;
  percent: number;
  isToday: boolean;
  isFuture: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

const DAY_NAMES_SHORT = ['Yak', 'Du', 'Se', 'Cho', 'Pay', 'Ju', 'Sha'];

function getDayName(dateStr: string): string {
  return DAY_NAMES_SHORT[new Date(dateStr + 'T00:00:00').getDay()];
}
function getDayNumber(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00').getDate();
}
function formatTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
}
function getTodayHeaderStr(): string {
  const d = new Date();
  const days = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
  const months = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function groupBySection(items: ChecklistItem[]) {
  const groups: { section: string; items: ChecklistItem[] }[] = [];
  const seen = new Map<string, ChecklistItem[]>();
  for (const item of items) {
    const key = item.section ?? 'Vazifalar';
    if (!seen.has(key)) {
      seen.set(key, []);
      groups.push({ section: key, items: seen.get(key)! });
    }
    seen.get(key)!.push(item);
  }
  return groups;
}

// ─── Weekly Day Cell ──────────────────────────────────────────────────────────
function WeekDayCell({
  day, isSelected, onClick,
}: { day: WeekDay; isSelected: boolean; onClick: () => void }) {
  const today = day.isToday;
  const future = day.isFuture;
  const allDone = !future && day.total > 0 && day.done === day.total;
  const noneDone = !future && day.done === 0 && day.total > 0;
  const partial = !future && !allDone && day.done > 0;

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 px-2 py-2 rounded-xl transition-all duration-200 min-w-[46px] border
        ${isSelected
          ? 'bg-blue-600 border-blue-500 text-white scale-105 shadow-lg shadow-blue-500/20'
          : today
          ? 'bg-zinc-800 border-zinc-600 text-white'
          : future
          ? 'bg-zinc-900/40 border-zinc-800/50 text-zinc-600 cursor-not-allowed'
          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-white'
        }`}
      disabled={future}
    >
      {/* Kun nomi */}
      <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'text-blue-200' : today ? 'text-blue-400' : ''}`}>
        {getDayName(day.date)}
      </span>
      {/* Sana raqami */}
      <span className="text-sm font-black">{getDayNumber(day.date)}</span>
      {/* Status belgisi */}
      <div className="w-5 h-5 flex items-center justify-center">
        {future ? (
          <Minus className="w-3 h-3 text-zinc-700" />
        ) : allDone ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        ) : noneDone ? (
          <XCircle className="w-4 h-4 text-red-400/70" />
        ) : partial ? (
          <div className="w-4 h-4 rounded-full border-2 border-amber-400 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          </div>
        ) : (
          <div className="w-4 h-4 rounded-full border-2 border-zinc-700" />
        )}
      </div>
      {/* Foiz — faqat o'tgan kunlar uchun */}
      {!future && day.total > 0 && (
        <span className={`text-[9px] font-bold ${allDone ? 'text-emerald-400' : noneDone ? 'text-red-400/70' : 'text-amber-400'}`}>
          {day.percent}%
        </span>
      )}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface ChecklistPageProps {
  roleLabel?: string;
  compact?: boolean;
}

export default function ChecklistPage({ roleLabel, compact = false }: ChecklistPageProps) {
  const todayStr = toLocalDateStr(new Date());

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [weekDays, setWeekDays] = useState<WeekDay[]>([]);
  const [dayData, setDayData] = useState<DayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [weekLoading, setWeekLoading] = useState(true);

  // Haftalik summaryni yuklash
  const fetchWeekly = useCallback(async () => {
    setWeekLoading(true);
    try {
      const res = await checklistApi.getWeekly();
      setWeekDays(res.data.data);
    } catch { /* ignore */ }
    finally { setWeekLoading(false); }
  }, []);

  // Tanlangan kun checklistini yuklash
  const fetchDay = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const res = await checklistApi.getDay(date);
      setDayData(res.data.data);
    } catch {
      setDayData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWeekly(); }, [fetchWeekly]);
  useEffect(() => { fetchDay(selectedDate); }, [selectedDate, fetchDay]);

  const handleToggle = async (itemId: string) => {
    if (toggling) return;
    if (!dayData?.isToday) return; // Read-only himoya (frontend)

    setToggling(itemId);
    // Optimistic update
    setDayData(prev => {
      if (!prev) return prev;
      const items = prev.items.map(item =>
        item.id === itemId
          ? { ...item, isDone: !item.isDone, doneAt: !item.isDone ? new Date().toISOString() : null }
          : item
      );
      const done = items.filter(i => i.isDone).length;
      const total = items.length;
      return { ...prev, items, progress: { done, total, percent: total > 0 ? Math.round(done / total * 100) : 0 } };
    });

    try {
      await checklistApi.toggle(itemId);
      // Haftalik summaryni ham yangilash
      fetchWeekly();
    } catch {
      // Xato bo'lsa, asl holatga qaytarish
      fetchDay(selectedDate);
    } finally {
      setToggling(null);
    }
  };

  const isReadOnly = !dayData?.isToday;
  const items = dayData?.items ?? [];
  const progress = dayData?.progress ?? { done: 0, total: 0, percent: 0 };
  const groups = groupBySection(items);

  return (
    <div className={compact ? 'px-0' : 'p-6 max-w-3xl mx-auto'}>
      {/* Header */}
      {!compact && (
        <div className="mb-5">
          <div className="flex items-center gap-2 text-zinc-500 text-sm mb-1">
            <Calendar className="w-4 h-4" />
            <span>{getTodayHeaderStr()}</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Kunlik Checklist</h1>
          {roleLabel && <p className="text-zinc-400 text-sm mt-1">{roleLabel} — bugungi vazifalar</p>}
        </div>
      )}

      {/* ── Haftalik Strip ─────────────────────────────────────────── */}
      <div className={`bg-[#18181b] border border-zinc-800 rounded-2xl p-4 ${compact ? 'mb-4' : 'mb-5'}`}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> Haftalik ko'rinish
          </span>
          {selectedDate !== todayStr && (
            <button
              onClick={() => setSelectedDate(todayStr)}
              className="text-xs px-3 py-1 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/40 transition-colors font-medium"
            >
              Bugunga qaytish
            </button>
          )}
        </div>
        {weekLoading ? (
          <div className="flex gap-2">
            {Array(7).fill(0).map((_, i) => (
              <div key={i} className="flex-1 h-24 rounded-xl bg-zinc-800 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="flex gap-1.5 justify-between">
            {weekDays.map(day => (
              <div key={day.date} className="flex-1">
                <WeekDayCell
                  day={day}
                  isSelected={selectedDate === day.date}
                  onClick={() => !day.isFuture && setSelectedDate(day.date)}
                />
              </div>
            ))}
          </div>
        )}
        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 justify-center text-[10px] text-zinc-600">
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Bajarildi</span>
          <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-400/70" /> Bajarilmadi</span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full border border-amber-400 flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-amber-400" />
            </div> Qisman
          </span>
        </div>
      </div>

      {/* ── Read-only Banner ───────────────────────────────────────── */}
      {isReadOnly && dayData && (
        <div className="flex items-center gap-3 px-4 py-3 bg-zinc-800/60 border border-zinc-700/60 rounded-xl mb-4">
          <Lock className="w-4 h-4 text-zinc-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-zinc-300">
              {selectedDate} — ko'rish rejimi
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Faqat bugungi kunni o'zgartirish mumkin. O'tgan kunlar qulflangan.
            </p>
          </div>
        </div>
      )}

      {/* ── Progress ───────────────────────────────────────────────── */}
      <div className={`bg-[#18181b] border border-zinc-800 rounded-2xl p-5 ${compact ? 'mb-4' : 'mb-5'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-zinc-300">
              {compact ? 'Kunlik checklist' : 'Bajarilish darajasi'}
            </span>
            {isReadOnly && <Lock className="w-3 h-3 text-zinc-600" />}
          </div>
          <span className="text-2xl font-bold text-white">
            {progress.done}<span className="text-zinc-500 text-lg font-normal">/{progress.total}</span>
          </span>
        </div>
        <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress.percent}%`,
              background: progress.percent === 100
                ? 'linear-gradient(90deg,#22c55e,#16a34a)'
                : 'linear-gradient(90deg,#3b82f6,#6366f1)',
            }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-xs text-zinc-500">{progress.total - progress.done} ta qoldi</span>
          <span className={`text-xs font-bold ${progress.percent === 100 ? 'text-emerald-400' : 'text-blue-400'}`}>
            {progress.percent}%
          </span>
        </div>
        {progress.percent === 100 && (
          <div className="mt-3 text-center text-sm font-medium text-emerald-400 bg-emerald-500/10 rounded-lg py-2 border border-emerald-500/20">
            🎉 Barcha vazifalar bajarildi!
          </div>
        )}
      </div>

      {/* ── Checklist Items ────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-zinc-500">
          <CheckSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Bu kun uchun checklist elementlari yo'q</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(({ section, items: sectionItems }, gIdx) => (
            <div key={gIdx}>
              {/* Section header */}
              <div className="flex items-center gap-3 mb-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                  {gIdx + 1}
                </span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400">{section}</h3>
                <div className="flex-1 h-px bg-zinc-800" />
                <span className="text-xs text-zinc-600">
                  {sectionItems.filter(i => i.isDone).length}/{sectionItems.length}
                </span>
              </div>

              {/* Items */}
              <div className="space-y-2">
                {sectionItems.map(item => (
                  <div
                    key={item.id}
                    onClick={() => !isReadOnly && handleToggle(item.id)}
                    className={`group flex items-start gap-4 p-4 rounded-xl border transition-all duration-200 ${
                      item.isDone
                        ? 'bg-emerald-500/5 border-emerald-500/20'
                        : 'bg-[#18181b] border-zinc-800'
                    } ${
                      isReadOnly
                        ? 'cursor-default'
                        : 'cursor-pointer hover:border-zinc-600 hover:bg-zinc-800/50'
                    } ${toggling === item.id ? 'opacity-60' : ''}`}
                  >
                    {/* Checkbox */}
                    <div className="mt-0.5 shrink-0">
                      {isReadOnly ? (
                        item.isDone
                          ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          : <XCircle className="w-5 h-5 text-red-400/50" />
                      ) : (
                        item.isDone
                          ? <CheckSquare className="w-5 h-5 text-emerald-400" />
                          : <Square className="w-5 h-5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-semibold ${item.isDone ? 'text-zinc-500 line-through' : 'text-white'}`}>
                          {item.category}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                          item.isDone
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                        }`}>
                          {item.score}
                        </span>
                      </div>
                      {item.description && (
                        <p className={`text-xs mt-1 leading-relaxed ${item.isDone ? 'text-zinc-600' : 'text-zinc-500'}`}>
                          {item.description}
                        </p>
                      )}
                    </div>

                    {/* Done time */}
                    {item.isDone && item.doneAt && (
                      <div className="flex items-center gap-1 text-xs text-emerald-500/70 shrink-0">
                        <Clock className="w-3 h-3" />
                        <span>{formatTime(item.doneAt)}</span>
                      </div>
                    )}

                    {/* Lock icon for read-only */}
                    {isReadOnly && !item.isDone && (
                      <Lock className="w-3.5 h-3.5 text-zinc-700 shrink-0 mt-0.5" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
