/**
 * Sayt dizaynidagi sana tanlagich — brauzerning standart kalendari o'rniga.
 *
 * `<input type="date">` bilan bir xil interfeys (drop-in): value — satr,
 * onChange({ target: { value } }), min, max, className, disabled, aria-label.
 *   mode="date"     → "YYYY-MM-DD"        (ko'rinish: 27.10.2026)
 *   mode="datetime" → "YYYY-MM-DDTHH:mm"  (ko'rinish: 27.10.2026 14:30)
 *   mode="month"    → "YYYY-MM"           (ko'rinish: Oktabr 2026)
 *
 * Oynasi body'ga portal orqali chiqadi (modal/overflow ichida kesilmaydi),
 * joy bo'lmasa tepaga ochiladi. Klaviatura: ← → ↑ ↓ kun, PageUp/PageDown oy,
 * Enter tanlash, Esc yopish. Mavzu (tungi/kunduzgi) palitradan avtomatik.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from 'lucide-react';

type Mode = 'date' | 'datetime' | 'month';
type View = 'days' | 'months' | 'years';

export interface DateInputProps {
  value: string;
  onChange: (e: { target: { value: string }; currentTarget: { value: string } }) => void;
  mode?: Mode;
  min?: string;
  max?: string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  title?: string;
  'aria-label'?: string;
  /** Qiymat majburiy — "Tozalash" tugmasi ko'rsatilmaydi (masalan sahifa shu sana bilan yuklanadi) */
  required?: boolean;
}

const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
const MONTHS_SHORT = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
const WEEKDAYS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
const pad = (n: number) => String(n).padStart(2, '0');

interface Parts { y: number; m: number; d: number; hh: number; mm: number }

/** Satrni qismlarga — vaqt zonasiz (Date obyektisiz), sana siljimasin */
function parse(v: string | undefined | null, mode: Mode): Parts | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?(?:T(\d{2}):(\d{2}))?/.exec(v);
  if (!m) return null;
  return { y: +m[1], m: +m[2] - 1, d: m[3] ? +m[3] : 1, hh: m[4] ? +m[4] : mode === 'datetime' ? 9 : 0, mm: m[5] ? +m[5] : 0 };
}
const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
function serialize(p: Parts, mode: Mode) {
  if (mode === 'month') return `${p.y}-${pad(p.m + 1)}`;
  const day = keyOf(p.y, p.m, p.d);
  return mode === 'datetime' ? `${day}T${pad(p.hh)}:${pad(p.mm)}` : day;
}
function display(p: Parts | null, mode: Mode) {
  if (!p) return '';
  if (mode === 'month') return `${MONTHS[p.m]} ${p.y}`;
  const day = `${pad(p.d)}.${pad(p.m + 1)}.${p.y}`;
  return mode === 'datetime' ? `${day} ${pad(p.hh)}:${pad(p.mm)}` : day;
}
const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const todayParts = (): Parts => {
  const t = new Date();
  return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate(), hh: t.getHours(), mm: Math.floor(t.getMinutes() / 5) * 5 };
};

export default function DateInput({
  value, onChange, mode = 'date', min, max, className = '', disabled, placeholder, id, title, required, ...rest
}: DateInputProps) {
  const selected = useMemo(() => parse(value, mode), [value, mode]);
  const minK = useMemo(() => (min ? serialize(parse(min, mode) ?? todayParts(), 'date') : null), [min, mode]);
  const maxK = useMemo(() => (max ? serialize(parse(max, mode) ?? todayParts(), 'date') : null), [max, mode]);

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>(mode === 'month' ? 'months' : 'days');
  const [cursor, setCursor] = useState<Parts>(() => selected ?? todayParts());
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean }>({ top: 0, left: 0, up: false });
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const emit = useCallback(
    (v: string) => onChange({ target: { value: v }, currentTarget: { value: v } }),
    [onChange]
  );

  const disabledDay = (y: number, m: number, d: number) => {
    const k = keyOf(y, m, d);
    return (minK != null && k < minK) || (maxK != null && k > maxK);
  };
  const disabledMonth = (y: number, m: number) => {
    const first = keyOf(y, m, 1);
    const last = keyOf(y, m, daysIn(y, m));
    return (minK != null && last < minK) || (maxK != null && first > maxK);
  };

  // Bir vaqtda faqat bitta kalendar ochiq: ochilayotgani boshqalarga xabar beradi
  // (klaviatura bilan boshqa maydonga o'tilganda ham eskisi yopilsin)
  const selfId = useRef(Math.random().toString(36).slice(2));
  useEffect(() => {
    const onOther = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== selfId.current) setOpen(false);
    };
    window.addEventListener('ils-datepicker-open', onOther);
    return () => window.removeEventListener('ils-datepicker-open', onOther);
  }, []);

  const openPicker = () => {
    if (disabled) return;
    window.dispatchEvent(new CustomEvent('ils-datepicker-open', { detail: selfId.current }));
    setCursor(selected ?? todayParts());
    setView(mode === 'month' ? 'months' : 'days');
    setOpen(true);
  };
  const close = (focusBack = true) => {
    setOpen(false);
    if (focusBack) btnRef.current?.focus();
  };

  // Joylashuv: pastga, joy bo'lmasa tepaga; ekran chetidan chiqmasin
  const place = useCallback(() => {
    const b = btnRef.current?.getBoundingClientRect();
    if (!b) return;
    const W = 296;
    const H = popRef.current?.offsetHeight ?? (mode === 'datetime' ? 430 : 370);
    const up = window.innerHeight - b.bottom < H + 12 && b.top > H + 12;
    const left = Math.min(Math.max(8, b.left), window.innerWidth - W - 8);
    setPos({ top: up ? b.top - H - 6 : b.bottom + 6, left, up });
  }, [mode]);
  useLayoutEffect(() => {
    if (!open) return;
    place();
    const r = () => place();
    window.addEventListener('resize', r);
    window.addEventListener('scroll', r, true);
    return () => {
      window.removeEventListener('resize', r);
      window.removeEventListener('scroll', r, true);
    };
  }, [open, place, view]);

  // Tashqariga bosilsa yopiladi
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', down, true);
    return () => document.removeEventListener('pointerdown', down, true);
  }, [open]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => popRef.current?.querySelector<HTMLElement>('[data-focus="1"]')?.focus());
  }, [open, view, cursor.y, cursor.m]);

  const pickDay = (y: number, m: number, d: number) => {
    if (disabledDay(y, m, d)) return;
    const base = selected ?? cursor;
    const p = { y, m, d, hh: base.hh, mm: base.mm };
    emit(serialize(p, mode));
    if (mode === 'date') close();
    else setCursor(p);
  };
  const shiftMonth = (delta: number) => {
    setCursor((c) => {
      const t = new Date(c.y, c.m + delta, 1);
      return { ...c, y: t.getFullYear(), m: t.getMonth(), d: Math.min(c.d, daysIn(t.getFullYear(), t.getMonth())) };
    });
  };
  const shiftDay = (delta: number) => {
    setCursor((c) => {
      const t = new Date(c.y, c.m, c.d + delta);
      return { ...c, y: t.getFullYear(), m: t.getMonth(), d: t.getDate() };
    });
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (view !== 'days') return;
    const map: Record<string, () => void> = {
      ArrowLeft: () => shiftDay(-1),
      ArrowRight: () => shiftDay(1),
      ArrowUp: () => shiftDay(-7),
      ArrowDown: () => shiftDay(7),
      PageUp: () => shiftMonth(-1),
      PageDown: () => shiftMonth(1),
      Enter: () => pickDay(cursor.y, cursor.m, cursor.d),
    };
    if (map[e.key]) {
      e.preventDefault();
      map[e.key]();
    }
  };

  const today = todayParts();
  const todayK = keyOf(today.y, today.m, today.d);
  const selK = selected ? keyOf(selected.y, selected.m, selected.d) : null;

  // 6 hafta × 7 kun, dushanbadan
  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const lead = (first.getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, i) => {
      const t = new Date(cursor.y, cursor.m, 1 - lead + i);
      return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate(), out: t.getMonth() !== cursor.m };
    });
  }, [cursor.y, cursor.m]);

  const yearStart = Math.floor(cursor.y / 12) * 12;
  const headTitle =
    view === 'days' ? `${MONTHS[cursor.m]} ${cursor.y}` : view === 'months' ? `${cursor.y}` : `${yearStart} – ${yearStart + 11}`;
  const navPrev = () => (view === 'days' ? shiftMonth(-1) : setCursor((c) => ({ ...c, y: c.y - (view === 'months' ? 1 : 12) })));
  const navNext = () => (view === 'days' ? shiftMonth(1) : setCursor((c) => ({ ...c, y: c.y + (view === 'months' ? 1 : 12) })));
  const zoomOut = () => setView((v) => (v === 'days' ? 'months' : 'years'));

  const text = display(selected, mode);
  const ph = placeholder ?? (mode === 'month' ? 'Oyni tanlang' : mode === 'datetime' ? 'Sana va vaqt' : 'Sanani tanlang');

  const cellBase = 'flex items-center justify-center rounded-lg text-sm tabular-nums transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]/60';

  const pop = open
    ? createPortal(
        <div
          ref={popRef}
          role="dialog"
          aria-label={rest['aria-label'] ?? 'Sana tanlash'}
          onKeyDown={onKey}
          style={{ top: pos.top, left: pos.left, width: 296 }}
          className={`ils-datepicker fixed z-[1000] rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-zinc-100 shadow-2xl ${pos.up ? 'origin-bottom' : 'origin-top'}`}
        >
          {/* Sarlavha */}
          <div className="mb-2 flex items-center gap-1">
            <button type="button" onClick={navPrev} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100" aria-label="Oldingi">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={zoomOut}
              disabled={view === 'years'}
              className="flex-1 rounded-lg px-2 py-1.5 text-sm font-bold text-zinc-100 hover:bg-zinc-800 disabled:cursor-default disabled:hover:bg-transparent"
            >
              {headTitle}
            </button>
            <button type="button" onClick={navNext} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100" aria-label="Keyingi">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {view === 'days' && (
            <>
              <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                {WEEKDAYS.map((w, i) => (
                  <span key={w} className={i >= 5 ? 'text-orange-400/80' : ''}>{w}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5" role="grid">
                {cells.map((c) => {
                  const k = keyOf(c.y, c.m, c.d);
                  const isSel = k === selK;
                  const isToday = k === todayK;
                  const isCur = c.y === cursor.y && c.m === cursor.m && c.d === cursor.d;
                  const off = disabledDay(c.y, c.m, c.d);
                  return (
                    <button
                      key={k}
                      type="button"
                      role="gridcell"
                      tabIndex={isCur ? 0 : -1}
                      data-focus={isCur ? '1' : undefined}
                      disabled={off}
                      aria-selected={isSel}
                      aria-label={`${c.d} ${MONTHS[c.m]} ${c.y}`}
                      onClick={() => pickDay(c.y, c.m, c.d)}
                      className={`${cellBase} h-9 ${
                        isSel
                          ? 'bg-[var(--primary)] font-bold text-white shadow-md shadow-[color:var(--primary)]/30'
                          : off
                            ? 'cursor-not-allowed text-zinc-700'
                            : c.out
                              ? 'text-zinc-600 hover:bg-zinc-800'
                              : 'text-zinc-200 hover:bg-zinc-800'
                      } ${isToday && !isSel ? 'ring-1 ring-inset ring-[color:var(--primary)] font-semibold text-[color:var(--primary)]' : ''}`}
                    >
                      {c.d}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {view === 'months' && (
            <div className="grid grid-cols-3 gap-1.5 py-1">
              {MONTHS_SHORT.map((label, m) => {
                const isSel = !!selected && selected.y === cursor.y && selected.m === m;
                const isNow = today.y === cursor.y && today.m === m;
                const off = disabledMonth(cursor.y, m);
                return (
                  <button
                    key={label}
                    type="button"
                    disabled={off}
                    data-focus={(selected ? isSel : isNow) ? '1' : undefined}
                    onClick={() => {
                      if (mode === 'month') {
                        emit(serialize({ ...cursor, m, d: 1 }, 'month'));
                        close();
                      } else {
                        setCursor((c) => ({ ...c, m, d: Math.min(c.d, daysIn(c.y, m)) }));
                        setView('days');
                      }
                    }}
                    className={`${cellBase} h-11 font-medium ${
                      isSel
                        ? 'bg-[var(--primary)] font-bold text-white'
                        : off
                          ? 'cursor-not-allowed text-zinc-700'
                          : 'text-zinc-200 hover:bg-zinc-800'
                    } ${isNow && !isSel ? 'ring-1 ring-inset ring-[color:var(--primary)] text-[color:var(--primary)]' : ''}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {view === 'years' && (
            <div className="grid grid-cols-3 gap-1.5 py-1">
              {Array.from({ length: 12 }, (_, i) => yearStart + i).map((y) => {
                const isSel = selected?.y === y;
                return (
                  <button
                    key={y}
                    type="button"
                    data-focus={(selected ? isSel : y === today.y) ? '1' : undefined}
                    onClick={() => {
                      setCursor((c) => ({ ...c, y }));
                      setView('months');
                    }}
                    className={`${cellBase} h-11 font-medium ${isSel ? 'bg-[var(--primary)] font-bold text-white' : 'text-zinc-200 hover:bg-zinc-800'} ${
                      y === today.y && !isSel ? 'ring-1 ring-inset ring-[color:var(--primary)] text-[color:var(--primary)]' : ''
                    }`}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          )}

          {/* Vaqt (datetime) */}
          {mode === 'datetime' && view === 'days' && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
              <Clock className="h-4 w-4 text-zinc-500" />
              <span className="text-xs text-zinc-500">Vaqt</span>
              <TimeSelect
                value={(selected ?? cursor).hh}
                count={24}
                step={1}
                aria-label="Soat"
                onChange={(hh) => {
                  const p = { ...(selected ?? cursor), hh };
                  setCursor(p);
                  emit(serialize(p, mode));
                }}
              />
              <span className="font-bold text-zinc-500">:</span>
              <TimeSelect
                value={(selected ?? cursor).mm}
                count={60}
                step={5}
                aria-label="Daqiqa"
                onChange={(mm) => {
                  const p = { ...(selected ?? cursor), mm };
                  setCursor(p);
                  emit(serialize(p, mode));
                }}
              />
            </div>
          )}

          {/* Pastki tugmalar */}
          <div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-2.5">
            {required ? (
              <span />
            ) : (
              <button
                type="button"
                onClick={() => {
                  emit('');
                  close();
                }}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                Tozalash
              </button>
            )}
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const t = todayParts();
                  if (mode === 'month') {
                    emit(serialize(t, 'month'));
                    close();
                  } else if (!disabledDay(t.y, t.m, t.d)) {
                    const p = mode === 'datetime' ? t : { ...t, hh: 0, mm: 0 };
                    emit(serialize(p, mode));
                    if (mode === 'date') close();
                    else setCursor(p);
                  }
                }}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[color:var(--primary)] hover:bg-zinc-800"
              >
                {mode === 'month' ? 'Shu oy' : mode === 'datetime' ? 'Hozir' : 'Bugun'}
              </button>
              {mode === 'datetime' && (
                <button
                  type="button"
                  onClick={() => close()}
                  className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
                >
                  Tayyor
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        id={id}
        title={title}
        disabled={disabled}
        aria-label={rest['aria-label']}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close(false) : openPicker())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || (e.altKey && e.key === 'ArrowDown')) {
            e.preventDefault();
            openPicker();
          }
        }}
        className={`ils-date-trigger inline-flex min-w-[9.5rem] items-center justify-between gap-2 text-left tabular-nums ${className} ${
          open ? 'ils-date-open' : ''
        }`}
      >
        <span className={text ? '' : 'text-zinc-500'}>{text || ph}</span>
        <CalendarDays className={`h-4 w-4 shrink-0 ${open ? 'text-[color:var(--primary)]' : 'text-zinc-500'}`} />
      </button>
      {pop}
    </>
  );
}

function TimeSelect({ value, count, step, onChange, ...rest }: { value: number; count: number; step: number; onChange: (v: number) => void; 'aria-label': string }) {
  const opts = Array.from({ length: Math.ceil(count / step) }, (_, i) => i * step);
  if (!opts.includes(value)) opts.push(value);
  opts.sort((a, b) => a - b);
  return (
    <select
      value={value}
      onChange={(e) => onChange(+e.target.value)}
      aria-label={rest['aria-label']}
      className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm font-semibold tabular-nums text-zinc-100"
    >
      {opts.map((o) => (
        <option key={o} value={o}>{pad(o)}</option>
      ))}
    </select>
  );
}
