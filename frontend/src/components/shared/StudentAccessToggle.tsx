import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Lock, LockOpen, Loader2 } from 'lucide-react';
import { studentAccessApi, type StudentAccessStatus } from '@/api';

/**
 * O'quvchi kirishini yopish/ochish — guruh sahifasidagi bitta tugma.
 *
 * Ataylab "jim": proyektorda ham sezilmaydi — yopiq o'quvchi yonida faqat
 * kichik qulf belgisi, sabab va izoh faqat shu oynachada. O'quvchi guruhda,
 * reytingda qoladi; faqat tizimga kira olmaydi (backend: modules/student-access).
 */

const REASONS: { key: 'payment' | 'other'; label: string }[] = [
  { key: 'payment', label: "To'lov" },
  { key: 'other', label: 'Boshqa sabab' },
];

const fmt = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

function errMsg(e: any, fallback: string) {
  const err = e?.response?.data?.error;
  return typeof err === 'string' ? err : err?.message ?? fallback;
}

export default function StudentAccessToggle({
  student,
  status,
  onChange,
}: {
  student: { id: string; fullName: string };
  status: StudentAccessStatus | undefined;
  onChange: (studentId: string, status: StudentAccessStatus) => void;
}) {
  const blocked = !!status?.blocked;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<'payment' | 'other'>('payment');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  // Jadval konteyneri overflow bilan kesadi — oynacha body'ga portal + fixed
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const b = box.current?.getBoundingClientRect();
      if (!b) return;
      const W = 288;
      const H = pop.current?.offsetHeight ?? 230;
      const left = Math.min(Math.max(8, b.right - W), window.innerWidth - W - 8);
      const below = b.bottom + 8;
      const top = below + H > window.innerHeight - 8 && b.top - H - 8 > 8 ? b.top - H - 8 : below;
      setPos({ top, left });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, blocked]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (box.current?.contains(t) || pop.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (blocked) {
        await studentAccessApi.unblock(student.id);
        onChange(student.id, { blocked: false });
      } else {
        const r = await studentAccessApi.block(student.id, { reason, note: note.trim() || null });
        onChange(student.id, r.data.data);
      }
      setOpen(false);
      setNote('');
    } catch (e) {
      setError(errMsg(e, 'Bajarib bo\'lmadi'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setError(null);
        }}
        className={`flex items-center gap-1.5 rounded-lg border p-2 text-xs font-medium transition-colors ${
          blocked
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
            : 'border-zinc-700 bg-zinc-800 text-zinc-400 opacity-0 hover:text-zinc-100 group-hover:opacity-100 focus-visible:opacity-100'
        }`}
        title={blocked ? 'Kirish yopiq — ochish' : 'Tizimga kirishini yopish'}
        aria-label={blocked ? `${student.fullName}: kirishni ochish` : `${student.fullName}: kirishni yopish`}
        aria-expanded={open}
      >
        {blocked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
      </button>

      {open && createPortal(
        <div
          ref={pop}
          role="dialog"
          aria-label="Kirish holati"
          style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: 288 }}
          className="z-[60] rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-left shadow-2xl"
        >
          <div className="mb-2 text-sm font-semibold text-white">{student.fullName}</div>
          {blocked ? (
            <>
              <p className="text-xs leading-relaxed text-zinc-400">
                Kirish yopilgan: <b className="text-zinc-200">{fmt(status?.blockedAt)}</b>
                {status?.blockedBy?.fullName ? <> · {status.blockedBy.fullName}</> : null}
                <br />
                Sabab: <b className="text-zinc-200">{REASONS.find((r) => r.key === status?.reason)?.label ?? '—'}</b>
                {status?.note ? <> — {status.note}</> : null}
              </p>
              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockOpen className="h-4 w-4" />} Kirishni ochish
              </button>
            </>
          ) : (
            <>
              <p className="mb-2 text-xs leading-relaxed text-zinc-400">
                O'quvchi tizimga kira olmaydi (ochiq sessiyalari ham tugaydi). Guruhda va reytingda qoladi, boshqalarga ko'rinmaydi.
              </p>
              <div className="mb-2 flex gap-1.5" role="radiogroup" aria-label="Sabab">
                {REASONS.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    role="radio"
                    aria-checked={reason === r.key}
                    onClick={() => setReason(r.key)}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold ${
                      reason === r.key ? 'bg-amber-500/20 text-amber-300' : 'border border-zinc-700 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 200))}
                onKeyDown={(e) => e.key === 'Enter' && !busy && submit()}
                placeholder="Izoh (ixtiyoriy), masalan: noyabr oyi"
                aria-label="Izoh"
                className="mb-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600"
              />
              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Kirishni yopish
              </button>
            </>
          )}
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </div>,
        document.body
      )}
    </div>
  );
}
