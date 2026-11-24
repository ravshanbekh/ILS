/**
 * Foundation normativlarini 2026 yangi tahririga o'tkazish (admin, bir martalik).
 * Avval reja ko'rsatiladi (yaratiladi / saqlanadi / arxivlanadi / guruhlar), admin
 * guruhlarni tanlaydi va "Qo'llash" bosadi. Qayta bosish xavfsiz (idempotent).
 */
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Archive, CheckCircle2, ChevronDown, ChevronRight, Image as ImageIcon, Loader2, Sparkles } from 'lucide-react';
import { apiErrorText, foundation2026Api, type Foundation2026Plan } from '@/api';

export default function Foundation2026Panel({ onApplied }: { onApplied: () => void }) {
  const [plan, setPlan] = useState<Foundation2026Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showList, setShowList] = useState<'' | 'create' | 'archive'>('');

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      const p = (await foundation2026Api.plan()).data.data;
      setPlan(p);
      setSel(new Set(p.groups.filter((g) => g.suggested).map((g) => g.id)));
      setOpen(!p.applied);
    } catch (e) {
      setErr(apiErrorText(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const nothingLeft = useMemo(
    () => !!plan && plan.create.length === 0 && plan.archive.length === 0 && plan.keep.every((k) => !k.old),
    [plan]
  );

  const apply = async () => {
    setBusy(true);
    setErr('');
    try {
      await foundation2026Api.apply([...sel]);
      setConfirm(false);
      await load();
      onApplied();
    } catch (e) {
      setErr(apiErrorText(e));
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  };

  if (loading && !plan) {
    return (
      <div className="mb-6 flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Foundation 2026 rejasi yuklanmoqda…
      </div>
    );
  }
  if (!plan) return err ? <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{err}</div> : null;

  const applied = plan.applied as null | { appliedAt: string; created: number; kept: number; archived: number; groups: number; assigned: number };
  const toggle = (id: string) =>
    setSel((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className={`mb-6 rounded-2xl border ${applied ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-sky-500/30 bg-sky-500/5'}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 px-5 py-4 text-left">
        {applied ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" /> : <Sparkles className="h-5 w-5 shrink-0 text-sky-400" />}
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-white">
            {applied ? "Foundation 2026 ga o'tilgan" : "Foundation normativlarini 2026 yangi tahririga o'tkazish"}
          </div>
          <div className="text-xs text-zinc-400">
            {applied
              ? `${new Date(applied.appliedAt).toLocaleString('uz-UZ')} · ${applied.created} yaratildi · ${applied.kept} saqlandi · ${applied.archived} arxivlandi · ${applied.groups} guruh`
              : `${plan.create.length} ta yangi normativ · ${plan.keep.filter((k) => k.old).length} tasi eskisi bilan bir xil (natijasi saqlanadi) · ${plan.archive.length} ta eski arxivga · ${sel.size} guruhga biriktiriladi`}
          </div>
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-zinc-500" /> : <ChevronRight className="h-4 w-4 text-zinc-500" />}
      </button>

      {open && (
        <div className="space-y-4 border-t border-zinc-800/70 px-5 pb-5 pt-4 text-sm">
          {plan.warnings.map((w) => (
            <div key={w} className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="h-4 w-4" /> {w}
            </div>
          ))}
          <ul className="list-disc space-y-1 pl-5 text-zinc-300">
            <li>
              "{plan.category}" yo'nalishida <b>{plan.create.length}</b> ta yangi normativ yaratiladi.
              <button type="button" className="ml-2 text-xs text-sky-400 hover:underline" onClick={() => setShowList(showList === 'create' ? '' : 'create')}>
                {showList === 'create' ? 'yashirish' : "ro'yxat"}
              </button>
            </li>
            {plan.keep.map((k) => (
              <li key={k.taskNumber}>
                №{k.taskNumber} «{k.title}» —{' '}
                {k.old ? (
                  <>
                    eski №{k.old.taskNumber} bilan bir xil: <b>qayta yaratilmaydi</b>, eski yozuv va {k.old.submissions} ta natija saqlanadi
                    (yangi ro'yxatda №{k.taskNumber} bo'ladi)
                  </>
                ) : (
                  'eskisi topilmadi — yangidan yaratiladi'
                )}
              </li>
            ))}
            <li>
              Eski "{plan.oldCategory ?? '—'}" normativlaridan <b>{plan.archive.length}</b> tasi <b>arxivlanadi</b> — o'chirilmaydi, natija va ballar saqlanadi,
              o'quvchida pastda xira ko'rinadi, ularga yangi topshirish yopiladi.
              <button type="button" className="ml-2 text-xs text-sky-400 hover:underline" onClick={() => setShowList(showList === 'archive' ? '' : 'archive')}>
                {showList === 'archive' ? 'yashirish' : "ro'yxat"}
              </button>
            </li>
            <li>Tanlangan guruhlarga yangi to'plam biriktiriladi (eski biriktirishlar tegilmaydi). Hech kimga xabar yuborilmaydi.</li>
          </ul>

          {showList === 'create' && (
            <div className="max-h-64 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-300">
              {plan.create.map((c) => (
                <div key={c.taskNumber} className="flex items-center gap-2 py-0.5">
                  <span className="ils-nm-num w-8 font-mono">#{c.taskNumber}</span> {c.title}
                  {c.hasImage && <ImageIcon className="h-3 w-3 text-sky-400" aria-label="namuna rasmi bor" />}
                </div>
              ))}
              {!plan.create.length && <div className="text-zinc-500">Hammasi allaqachon yaratilgan</div>}
            </div>
          )}
          {showList === 'archive' && (
            <div className="max-h-64 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-400">
              {plan.archive.map((a) => (
                <div key={a.id} className="flex items-center gap-2 py-0.5">
                  <Archive className="h-3 w-3" /> <span className="w-8 font-mono">#{a.taskNumber}</span> {a.title}
                  <span className="text-zinc-600">· {a.submissions} natija</span>
                </div>
              ))}
              {!plan.archive.length && <div className="text-zinc-500">Arxivlanadigan qolmagan</div>}
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Guruhlar ({sel.size} tanlangan)</span>
              <span className="text-xs text-zinc-500">Tavsiya: eski Foundation normativi bor va boshqa yo'nalishi yo'q guruhlar</span>
            </div>
            <div className="max-h-80 overflow-y-auto rounded-xl border border-zinc-800">
              <table className="w-full text-xs">
                <tbody>
                  {plan.groups.map((g) => (
                    <tr key={g.id} className="border-b border-zinc-800/60">
                      <td className="w-8 px-3 py-2">
                        <input type="checkbox" checked={sel.has(g.id)} onChange={() => toggle(g.id)} aria-label={`${g.name} guruhini tanlash`} />
                      </td>
                      <td className="px-2 py-2">
                        <div className="font-medium text-zinc-100">{g.name}</div>
                        <div className="text-zinc-500">{g.teacher?.fullName ?? 'Ustozsiz'} · {g.students} o'quvchi</div>
                      </td>
                      <td className="px-2 py-2 text-zinc-400">
                        eski: {g.oldCount} · yangi: {g.newCount}
                      </td>
                      <td className={`px-3 py-2 ${g.suggested ? 'text-emerald-400' : 'text-zinc-500'}`}>{g.reason}</td>
                    </tr>
                  ))}
                  {!plan.groups.length && (
                    <tr>
                      <td className="px-3 py-4 text-zinc-500">Faol guruh yo'q</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {err && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-400">{err}</div>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || (nothingLeft && sel.size === 0)}
              onClick={() => setConfirm(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {applied ? "Yetishmaganini qo'llash" : "Qo'llash"}
            </button>
            <button type="button" onClick={load} className="rounded-lg border border-zinc-700 px-4 py-2 text-zinc-300 hover:bg-zinc-800">
              Qayta hisoblash
            </button>
          </div>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Tasdiqlash">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="font-bold text-white">Foundation 2026 ga o'tish</div>
            <p className="mt-2 text-sm text-zinc-300">
              {plan.create.length} ta yangi normativ yaratiladi, {plan.archive.length} ta eski normativ arxivlanadi (natijalar saqlanadi) va {sel.size} ta guruhga
              yangi to'plam biriktiriladi. Barchasi bitta tranzaksiyada; arxivni normativ tahririda qaytarish mumkin.
            </p>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setConfirm(false)} className="flex-1 rounded-lg border border-zinc-800 py-2.5 text-sm text-zinc-300">
                Bekor qilish
              </button>
              <button type="button" disabled={busy} onClick={apply} className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {busy ? 'Kuting…' : "Qo'llash"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
