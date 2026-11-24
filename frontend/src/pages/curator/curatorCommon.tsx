/**
 * Kurator sahifalari uchun umumiy bo'laklar: yo'l prefiksi, holat yorliqlari,
 * 2 oylik muddat chizig'i va dastur progressi.
 */
import { X } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import type { CuratorProgressSummary, CuratorStatus, CuratorTimeline, CuratorLessonState } from '@/api';

/** Rolga qarab sahifalar prefiksi: admin → /admin, boshqalar → /viewer/:role */
export function useCuratorBase(): string {
  const role = useAuthStore((s) => s.user?.role);
  return role === 'admin' ? '/admin' : `/viewer/${role}`;
}

export const STATUS_META: Record<CuratorStatus, { label: string; cls: string }> = {
  faol: { label: 'Faol', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  tugadi: { label: '2 oy tugadi', cls: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30' },
  toxtatildi: { label: "To'xtatilgan", cls: 'bg-red-500/10 text-red-400 border-red-500/30' },
};

export function StatusBadge({ status }: { status: CuratorStatus }) {
  const m = STATUS_META[status];
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${m.cls}`}>{m.label}</span>;
}

export const LESSON_STATE: Record<CuratorLessonState, { label: string; cls: string; dot: string }> = {
  otildi: { label: "O'tildi", cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300', dot: 'bg-emerald-500' },
  kelmadi: { label: 'Kelmadi', cls: 'border-red-500/40 bg-red-500/10 text-red-300', dot: 'bg-red-500' },
  kutilmoqda: { label: 'Kutilmoqda', cls: 'border-zinc-800 bg-zinc-900 text-zinc-400', dot: 'bg-zinc-600' },
};

export const HOMEWORK_LABEL: Record<string, string> = { bajardi: 'bajardi', qisman: 'qisman', bajarmadi: 'bajarmadi' };

const MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
/** "2026-11-24" → "24-noy" */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d}-${MONTHS[m - 1]}`;
}

/** 2 oylik muddat: nechanchi kun, qancha qoldi */
export function TimelineBar({ t, compact = false }: { t: CuratorTimeline; compact?: boolean }) {
  const pct = Math.min(100, Math.round((t.day / t.totalDays) * 100));
  return (
    <div className="min-w-0">
      {!compact && (
        <div className="mb-1 flex justify-between text-[11px] text-zinc-500">
          <span>
            <b className="text-zinc-300">{t.day}</b>/{t.totalDays}-kun
          </span>
          <span>{t.finished ? 'muddat tugadi' : `${t.daysLeft} kun qoldi`}</span>
        </div>
      )}
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800" title={`${t.day}/${t.totalDays}-kun`}>
        <div className={`h-full rounded-full ${t.finished ? 'bg-zinc-500' : 'bg-sky-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/**
 * Dastur progressi: o'tilgan / jami, rejaga nisbatan orqada yoki oldinda.
 * Reja = 2 oyga teng taqsimlangan mashg'ulotlar (timeline.expectedLessons).
 */
export function ProgramProgress({ p, t, compact = false }: { p: CuratorProgressSummary; t: CuratorTimeline; compact?: boolean }) {
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
  const expPct = p.total ? Math.round((t.expectedLessons / p.total) * 100) : 0;
  const lag = t.expectedLessons - p.done;
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
        <span className="text-zinc-400">
          Dastur: <b className="text-zinc-100">{p.done}</b>/{p.total}
          {p.missed > 0 && <span className="text-red-400"> · {p.missed} kelmadi</span>}
        </span>
        {lag >= 2 ? (
          <span className="font-semibold text-amber-400" title={`Reja bo'yicha ${t.expectedLessons} ta o'tilishi kerak edi`}>
            {lag} ta orqada
          </span>
        ) : lag <= -1 ? (
          <span className="font-semibold text-emerald-400">rejadan oldinda</span>
        ) : (
          <span className="text-zinc-500">reja bo'yicha</span>
        )}
      </div>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
        {!t.finished && expPct > 0 && expPct < 100 && (
          <div className="absolute top-0 h-full w-0.5 bg-amber-300/80" style={{ left: `${expPct}%` }} title="Reja bo'yicha bugungi nuqta" />
        )}
      </div>
      {!compact && (
        <p className="mt-1 truncate text-[11px] text-zinc-500">
          {p.next ? (
            <>
              Keyingisi: <span className="text-zinc-300">{p.next.n}. {p.next.title}</span> · {p.next.week}-hafta
            </>
          ) : (
            <span className="text-emerald-400">Dastur to'liq o'tildi</span>
          )}
        </p>
      )}
    </div>
  );
}

/** Foiz rangi (davomat, normativ bajarilishi) */
export const pctTone = (v: number | null | undefined) =>
  v == null ? 'text-zinc-500' : v >= 80 ? 'text-emerald-400' : v >= 50 ? 'text-amber-400' : 'text-red-400';

/** "YYYY-MM-DD" — Toshkent vaqti bo'yicha bugun */
export function todayLocal(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' });
}

export const inputCls = 'w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600';

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 className="font-bold text-white">{title}</h2>
          <button type="button" onClick={onClose} className="p-1 text-zinc-400 hover:text-white" aria-label="Yopish">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
