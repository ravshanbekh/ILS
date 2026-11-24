/**
 * Normativ deadline'lari — umumiy yordamchilar (panel, guruh matritsasi, o'quvchi kartasi).
 * Vaqtlar doim Toshkent bo'yicha ko'rsatiladi.
 */
import type { DeadlineCounts, DeadlineState, GroupScheduleInfo } from '@/api';
import { useAuthStore } from '@/stores/authStore';

export const STATE_META: Record<DeadlineState, { label: string; short: string; cls: string }> = {
  done: { label: "O'z vaqtida topshirdi", short: '✔', cls: 'ils-nd-done' },
  grace_done: { label: "Qo'shimcha muddatda topshirdi", short: '✔', cls: 'ils-nd-gdone' },
  late_done: { label: 'Kech topshirdi (qizil tarixi bor)', short: '✔', cls: 'ils-nd-late' },
  open: { label: 'Muddat hali kelmagan', short: '·', cls: 'ils-nd-open' },
  grace: { label: "Muddat o'tdi — qo'shimcha muddat ketyapti", short: '⏳', cls: 'ils-nd-grace' },
  missed: { label: "Topshirmadi — QIZIL", short: '✘', cls: 'ils-nd-missed' },
  na: { label: "Guruhga muddatdan keyin qo'shilgan — hisobga olinmaydi", short: '–', cls: 'ils-nd-na' },
};

export const DAY_TYPE_LABEL: Record<string, string> = {
  toq: 'Du · Chor · Ju',
  juft: 'Se · Pay · Sha',
  har_kuni: 'Har kuni',
};

export function scheduleLabel(s: GroupScheduleInfo | null | undefined): string {
  if (!s || !s.dayType) return 'Jadval kiritilmagan';
  const time = s.start ? ` · ${s.start}${s.end ? `–${s.end}` : ''}` : '';
  return `${DAY_TYPE_LABEL[s.dayType]}${time}`;
}

const TZ = 'Asia/Tashkent';
const WD = ['Yak', 'Du', 'Se', 'Chor', 'Pay', 'Ju', 'Sha'];
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

/** Toshkentdagi sana qismlari */
function tzParts(iso: string) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' });
  const p = Object.fromEntries(f.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { y: +p.year, m: +p.month, d: +p.day, hh: p.hour === '24' ? '00' : p.hour, mm: p.minute, wd };
}

/** "Sha, 5-dek · 14:00" */
export function dueLabel(iso: string): string {
  const p = tzParts(iso);
  return `${WD[p.wd]}, ${p.d}-${MONTHS[p.m - 1].slice(0, 3)} · ${p.hh}:${p.mm}`;
}

/** Qolgan vaqt: "2 kun 4 soat", "3 soat", "40 daq" */
export function leftLabel(iso: string, nowIso?: string): string {
  const ms = new Date(iso).getTime() - (nowIso ? new Date(nowIso).getTime() : Date.now());
  if (ms <= 0) return "o'tdi";
  const h = Math.floor(ms / 3_600_000);
  if (h >= 24) return `${Math.floor(h / 24)} kun${h % 24 ? ` ${h % 24} soat` : ''}`;
  if (h >= 1) return `${h} soat`;
  return `${Math.max(1, Math.floor(ms / 60_000))} daq`;
}

/** 'YYYY-MM-DD' ustida kun qo'shish (vaqt zonasiz) */
export function addDaysStr(s: string, n: number): string {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function mondayOfStr(s: string): string {
  const d = new Date(`${s}T00:00:00Z`);
  const wd = d.getUTCDay();
  return addDaysStr(s, wd === 0 ? -6 : 1 - wd);
}
/** Toshkentdagi bugungi sana */
export function todayTashkent(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}
export const nextMondayStr = () => addDaysStr(mondayOfStr(todayTashkent()), 7);

/** "1–7 dekabr" yoki "29-noyabr – 5-dekabr" */
export function weekRangeLabel(start: string): string {
  const end = addDaysStr(start, 6);
  const [, m1, d1] = start.split('-').map(Number);
  const [, m2, d2] = end.split('-').map(Number);
  return m1 === m2 ? `${d1}–${d2} ${MONTHS[m2 - 1]}` : `${d1}-${MONTHS[m1 - 1]} – ${d2}-${MONTHS[m2 - 1]}`;
}

export const doneOf = (c: DeadlineCounts) => c.done + c.graceDone + c.lateDone;
export const notDoneOf = (c: DeadlineCounts) => c.open + c.grace + c.missed;

/** Admin / o'qituvchi / viewer yo'l prefiksi */
export function useDeadlineBase(): string {
  const { user } = useAuthStore();
  if (!user) return '';
  if (user.role === 'admin') return '/admin';
  if (user.role === 'teacher') return '/teacher';
  return `/viewer/${user.role}`;
}

export function StateCell({ state, title }: { state: DeadlineState; title?: string }) {
  const m = STATE_META[state];
  return (
    <span className={`inline-flex h-7 w-8 items-center justify-center rounded-md text-sm font-bold ${m.cls}`} title={title ?? m.label}>
      {m.short}
    </span>
  );
}

export function Legend() {
  const order: DeadlineState[] = ['done', 'grace_done', 'late_done', 'open', 'grace', 'missed', 'na'];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-400">
      {order.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <StateCell state={s} />
          {STATE_META[s].label}
        </span>
      ))}
    </div>
  );
}
