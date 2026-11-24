/**
 * Tadbir (chempionat) coini — dars sessiyasisiz. Demo-mentor haftalik
 * "Chempionat kuni"dan keyin nominatsiya egalariga coin beradi:
 * o'quvchilarni tanlaydi → miqdor → sabab → tasdiqlash → natija.
 * Doira serverda: kurator — faqat o'z faol o'quvchilari, admin/"Coin nazorati" — hamma.
 * Coin bergan xodimning kunlik chegarasiga kiradi va "Coin nazorati"da sababi bilan ko'rinadi.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, Coins, Loader2, Search, Trophy, X } from 'lucide-react';
import Header from '@/components/layout/Header';
import { apiErrorText, coinsApi, type EventAwardResult, type EventCoinContext, type EventCoinStudent } from '@/api';

const REASONS = ["Chempionat — G'olib", 'Chempionat — Shaxsiy rekord', 'Chempionat — Jamoa ruhi', "Live Quiz g'olibi", 'Sinf musobaqasi (tez yozish)'];
const AMOUNTS = [5, 10, 20, 30];

export default function EventCoinsPage() {
  const [ctx, setCtx] = useState<EventCoinContext | null>(null);
  const [list, setList] = useState<EventCoinStudent[]>([]);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Map<string, EventCoinStudent>>(new Map());
  const [amount, setAmount] = useState(10);
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EventAwardResult | null>(null);

  const loadCtx = useCallback(() => {
    coinsApi
      .eventContext()
      .then((r) => setCtx(r.data.data))
      .catch((e) => setError(apiErrorText(e)));
  }, []);
  useEffect(() => {
    loadCtx();
  }, [loadCtx]);

  // Kurator: butun ro'yxat bir marta (qidiruv mahalliy). Nazoratchi: serverda qidiruv (kamida 2 harf)
  useEffect(() => {
    if (!ctx) return;
    if (ctx.scope === 'own') {
      coinsApi.eventStudents().then((r) => setList(r.data.data.students)).catch((e) => setError(apiErrorText(e)));
      return;
    }
    if (q.trim().length < 2) {
      setList([]);
      return;
    }
    const t = setTimeout(() => {
      coinsApi.eventStudents(q.trim()).then((r) => setList(r.data.data.students)).catch((e) => setError(apiErrorText(e)));
    }, 300);
    return () => clearTimeout(t);
  }, [ctx, q]);

  const shown = useMemo(() => {
    if (ctx?.scope !== 'own') return list;
    const s = q.trim().toLowerCase();
    return s ? list.filter((x) => x.fullName.toLowerCase().includes(s) || x.login.toLowerCase().includes(s)) : list;
  }, [list, q, ctx]);

  const toggle = (s: EventCoinStudent) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(s.id)) next.delete(s.id);
      else if (!ctx || next.size < ctx.maxStudents) next.set(s.id, s);
      return next;
    });

  const total = selected.size * amount;
  const after = (ctx?.givenToday ?? 0) + total;
  const willExceed = !!ctx && ctx.dailyLimit > 0 && after > ctx.dailyLimit;
  const valid = selected.size > 0 && amount >= 1 && amount <= (ctx?.maxAmount ?? 100) && reason.trim().length >= 3;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await coinsApi.awardEvent({ studentIds: [...selected.keys()], amount, reason: reason.trim() });
      setResult(r.data.data);
      setSelected(new Map());
      setConfirming(false);
      loadCtx();
    } catch (e) {
      setError(apiErrorText(e));
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header title="Tadbir coini" subtitle="Chempionat va boshqa tadbirlar uchun — dars sessiyasisiz" />
      <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
        {ctx && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Kimga bera olasiz</p>
              {ctx.scope === 'own' ? "Faqat sizga biriktirilgan faol kurator o'quvchilari" : "Istalgan faol o'quvchi (qidiruv orqali)"}
              <p className="mt-1 text-xs text-zinc-500">Ochiq joyda faqat maqtov aytiladi — to'liq reyting ota-onalar guruhiga chiqarilmaydi.</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Bugun bergan coiningiz</p>
              <p className="text-lg font-bold text-amber-400">
                {ctx.givenToday}
                {ctx.dailyLimit > 0 && <span className="text-sm font-normal text-zinc-500"> / {ctx.dailyLimit} kunlik chegara</span>}
              </p>
              {ctx.dailyLimit > 0 && (
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                  <div className={`h-full ${ctx.givenToday > ctx.dailyLimit ? 'bg-red-500' : 'bg-amber-400'}`} style={{ width: `${Math.min(100, (ctx.givenToday / ctx.dailyLimit) * 100)}%` }} />
                </div>
              )}
            </div>
          </div>
        )}

        {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">{error}</div>}

        {result && (
          <div className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="flex items-center gap-2 font-semibold text-emerald-300">
              <CheckCircle2 className="h-5 w-5" /> {result.awarded} ta o'quvchiga {result.amount} coindan berildi — jami {result.total}
            </p>
            <p className="text-xs text-zinc-400">Sabab: {result.reason}</p>
            <div className="flex flex-wrap gap-1.5">
              {result.students.map((s) => (
                <span key={s.id} className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-200">
                  {s.fullName} · <span className="text-amber-400">{s.balance}</span>
                </span>
              ))}
            </div>
            {result.overLimit && (
              <p className="flex items-center gap-1.5 text-xs text-amber-400">
                <AlertTriangle className="h-4 w-4" /> Bugungi kunlik chegaradan oshdingiz ({result.givenToday}/{result.dailyLimit}) — rahbariyatga xabar ketdi.
              </p>
            )}
            <button type="button" onClick={() => setResult(null)} className="text-xs text-zinc-400 hover:text-white">
              Yopish
            </button>
          </div>
        )}

        {/* 1. O'quvchilar */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900">
          <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 px-4 py-3">
            <h3 className="text-sm font-bold text-white">1. O'quvchilar</h3>
            <span className="text-xs text-zinc-500">
              {selected.size} ta tanlandi{ctx && ` (eng ko'pi ${ctx.maxStudents})`}
            </span>
            {ctx?.scope === 'own' && shown.length > 0 && (
              <button
                type="button"
                onClick={() => setSelected(new Map(shown.slice(0, ctx.maxStudents).map((s) => [s.id, s])))}
                className="ml-auto text-xs text-sky-400 hover:text-sky-300"
              >
                Hammasini tanlash
              </button>
            )}
            {selected.size > 0 && (
              <button type="button" onClick={() => setSelected(new Map())} className={`text-xs text-zinc-400 hover:text-white ${ctx?.scope === 'own' && shown.length > 0 ? '' : 'ml-auto'}`}>
                Tozalash
              </button>
            )}
          </div>
          {selected.size > 0 && (
            <div className="flex flex-wrap gap-1.5 border-b border-zinc-800 px-4 py-2">
              {[...selected.values()].map((s) => (
                <button key={s.id} type="button" onClick={() => toggle(s)} className="flex items-center gap-1 rounded-full bg-blue-600/15 px-2 py-0.5 text-xs text-zinc-100 hover:bg-blue-600/25">
                  {s.fullName} <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}
          <div className="p-4">
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={ctx?.scope === 'own' ? 'Ism yoki login bo\'yicha filtr' : "O'quvchi ismi yoki login (kamida 2 harf)"}
                aria-label="O'quvchi qidirish"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-600"
              />
            </div>
            {shown.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500">
                {ctx?.scope === 'own' ? "Faol kurator o'quvchingiz topilmadi" : q.trim().length < 2 ? 'Qidiring' : 'Topilmadi'}
              </p>
            ) : (
              <ul className="max-h-72 divide-y divide-zinc-800 overflow-y-auto rounded-lg border border-zinc-800">
                {shown.map((s) => {
                  const on = selected.has(s.id);
                  return (
                    <li key={s.id}>
                      <button type="button" onClick={() => toggle(s)} className={`flex w-full items-center gap-3 px-3 py-2 text-left ${on ? 'bg-blue-600/10' : 'hover:bg-white/[0.03]'}`} aria-pressed={on}>
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${on ? 'border-blue-600 bg-blue-600 text-white' : 'border-zinc-700'}`}>{on && <Check className="h-3.5 w-3.5" />}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-zinc-100">{s.fullName}</span>
                          <span className="block truncate text-xs text-zinc-500">
                            {s.login} · {s.groups.length ? s.groups.join(', ') : 'guruhsiz'}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* 2. Miqdor va sabab */}
        <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div>
            <h3 className="mb-2 text-sm font-bold text-white">2. Har bir o'quvchiga necha coin</h3>
            <div className="flex flex-wrap items-center gap-2">
              {AMOUNTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAmount(a)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${amount === a ? 'border-amber-400 bg-amber-400/15 text-amber-300' : 'border-zinc-800 text-zinc-300 hover:text-white'}`}
                >
                  {a}
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={ctx?.maxAmount ?? 100}
                value={amount}
                onChange={(e) => setAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                aria-label="Coin miqdori"
                className="w-24 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100"
              />
              <span className="text-xs text-zinc-500">1–{ctx?.maxAmount ?? 100}</span>
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-bold text-white">3. Sabab yoki tadbir nomi</h3>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {REASONS.map((r) => (
                <button key={r} type="button" onClick={() => setReason(r)} className={`rounded-full border px-2.5 py-1 text-xs ${reason === r ? 'border-sky-500 bg-sky-500/15 text-sky-300' : 'border-zinc-800 text-zinc-400 hover:text-white'}`}>
                  <Trophy className="mr-1 inline h-3 w-3" />
                  {r}
                </button>
              ))}
            </div>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
              placeholder="Masalan: 3-hafta chempionati — G'olib"
              aria-label="Sabab"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-3">
            <p className="text-sm text-zinc-300">
              <b className="text-white">{selected.size}</b> bola × <b className="text-white">{amount}</b> = <b className="text-amber-400">{total} coin</b>
              {ctx && ctx.dailyLimit > 0 && (
                <span className={`ml-2 text-xs ${willExceed ? 'text-amber-400' : 'text-zinc-500'}`}>
                  bugun: {ctx.givenToday} → {after} / {ctx.dailyLimit}
                </span>
              )}
            </p>
            <button
              type="button"
              disabled={!valid || busy}
              onClick={() => setConfirming(true)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
            >
              <Coins className="h-4 w-4" /> Coin berish
            </button>
          </div>
          {willExceed && (
            <p className="flex items-center gap-1.5 text-xs text-amber-400">
              <AlertTriangle className="h-4 w-4" /> Bu bilan kunlik chegaradan oshasiz — coin beriladi, lekin rahbariyatga xabar ketadi.
            </p>
          )}
        </section>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Tasdiqlash">
          <div className="w-full max-w-md space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="font-bold text-white">Tasdiqlaysizmi?</h2>
            <p className="text-sm text-zinc-300">
              <b>{selected.size}</b> ta o'quvchiga <b className="text-amber-400">{amount}</b> coindan (jami <b className="text-amber-400">{total}</b>) beriladi.
            </p>
            <p className="rounded-lg bg-zinc-950 px-3 py-2 text-sm text-zinc-200">Sabab: {reason.trim()}</p>
            <p className="max-h-28 overflow-y-auto text-xs text-zinc-500">{[...selected.values()].map((s) => s.fullName).join(', ')}</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirming(false)} className="rounded-lg border border-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:text-white">
                Bekor
              </button>
              <button type="button" onClick={submit} disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Ha, berish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
