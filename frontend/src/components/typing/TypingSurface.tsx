/**
 * Yozish maydoni — CodeType (github.com/itxona40-rgb/codetyping) dvigatelining
 * React ko'chirmasi: press / render / stats mantig'i, kod rejimida avtomatik
 * chekinish, combo, xatolar xaritasi, ovoz, ekran klaviaturasi.
 *
 * Rejimlar:
 *   kind="timed"    — vaqtli matn (15/30/60/120 s), taymer birinchi harfdan
 *   kind="complete" — oxirigacha (kod mashqi, bellashuv)
 *   strict          — xato harf kursorni siljitmaydi (bellashuvda majburiy:
 *                     "progress" = to'g'ri yozilgan belgilar, orqaga qaytmaydi)
 *   startAt         — bellashuv: server boshlash vaqti (mahalliy soatga
 *                     o'girilgan); undan oldin yozib bo'lmaydi, vaqt shundan sanaladi
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TypingCounts } from '@/api';
import { playKey, type SoundProfile } from './typingSound';
import TypingKeyboard from './TypingKeyboard';

export interface EngineResult {
  elapsedMs: number;
  counts: TypingCounts;
  wpm: number;
  rawWpm: number;
  accuracy: number;
  consistency: number | null;
  samples: number[];
  topErrors: [string, number][];
}

interface Props {
  text: string;
  kind: 'timed' | 'complete';
  durationSec?: number;
  strict?: boolean;
  isCode?: boolean;
  startAt?: number | null;
  disabled?: boolean;
  sound?: SoundProfile | null;
  showKeyboard?: boolean;
  /** Matn/kod har o'zgarganda yoki shu qiymat o'zgarganda holat yangilanadi */
  resetKey?: string | number;
  onStart?: () => void;
  onProgress?: (pos: number, counts: TypingCounts) => void;
  onFinish: (r: EngineResult) => void;
  onRestart?: () => void;
  onNewText?: () => void;
  autoFocus?: boolean;
}

type St = '' | 'c' | 'w' | 's';

// ── Kod rangi (CodeType hlt() ko'chirmasi) ──────────────────────────────────
const KW = new Set(
  (
    'def class return if else elif for while in import from as try except catch const let var function async await new public private ' +
    'static void int true false null None True False select using namespace include SELECT FROM WHERE JOIN ON AS GROUP BY ORDER DESC ' +
    'INSERT INTO VALUES HAVING UPDATE SET CREATE TABLE PRIMARY KEY NOT func package defer go range struct type interface map fn mut impl ' +
    'pub use match enum self mod foreach echo string number boolean fun val then fi do done switch case break continue extends this super final'
  ).split(' ')
);
const HL_CLASS: Record<string, string> = {
  hk: 'text-violet-400',
  hf: 'text-sky-400',
  ht: 'text-amber-400',
  hs: 'text-emerald-400',
  hn: 'text-orange-400',
  hc: 'text-zinc-500 italic',
  hp: 'text-pink-400',
};
function highlight(T: string): string[] {
  const hl: string[] = new Array(T.length).fill('');
  const n = T.length;
  const sq = /SELECT|INSERT|UPDATE|CREATE/.test(T);
  for (let i = 0; i < n; ) {
    const c = T[i];
    let k = '';
    let j = i + 1;
    if (c === "'" || c === '"') {
      while (j < n && T[j] !== c && T[j] !== '\n') j++;
      j++;
      k = 'hs';
    } else if (c === '#' && /^#[0-9a-fA-F]{3,8}\b/.test(T.slice(i, i + 9))) {
      while (j < n && /[0-9a-fA-F]/.test(T[j])) j++;
      k = 'hn';
    } else if ((c === '#' && T[i + 1] !== 'i' && T[i + 1] !== '!') || c + T[i + 1] === '//' || (sq && c + T[i + 1] === '--')) {
      while (j < n && T[j] !== '\n') j++;
      k = 'hc';
    } else if (/[a-zA-Z_]/.test(c)) {
      while (j < n && /[a-zA-Z_0-9]/.test(T[j])) j++;
      const w = T.slice(i, j);
      if (KW.has(w)) k = 'hk';
      else if (T[j] === '(') k = 'hf';
      else if (c >= 'A' && c <= 'Z') k = 'ht';
    } else if (c >= '0' && c <= '9') {
      while (j < n && T[j] >= '0' && T[j] <= '9') j++;
      k = 'hn';
    } else if ('{}[]()<>;='.includes(c)) k = 'hp';
    for (let x = i; x < j && x < n; x++) hl[x] = k;
    i = j;
  }
  return hl;
}

export default function TypingSurface(props: Props) {
  const {
    text, kind, durationSec = 30, strict = false, isCode = false, startAt = null, disabled = false,
    sound = null, showKeyboard = false, resetKey, onStart, onProgress, onFinish, onRestart, onNewText, autoFocus = true,
  } = props;

  const boxRef = useRef<HTMLDivElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, setTick] = useState(0);
  const rerender = () => setTick((t) => (t + 1) % 1_000_000);

  // Dvigatel holati — har bosishda React state emas, ref (tez)
  const E = useRef({
    st: [] as St[],
    pos: 0,
    t0: 0,
    keys: 0,
    good: 0,
    errs: 0,
    combo: 0,
    best: 0,
    samples: [] as number[],
    em: {} as Record<string, number>,
    done: false,
    started: false,
  });
  const hl = useMemo(() => (isCode ? highlight(text) : []), [text, isCode]);
  const cb = useRef({ onStart, onProgress, onFinish, onRestart, onNewText });
  cb.current = { onStart, onProgress, onFinish, onRestart, onNewText };

  const skipIndent = () => {
    const e = E.current;
    if (!isCode) return;
    if (e.pos === 0 || text[e.pos - 1] === '\n') {
      while (text[e.pos] === ' ') {
        e.st[e.pos] = 's';
        e.pos++;
      }
    }
  };

  const reset = useCallback(() => {
    E.current = { st: new Array(text.length).fill(''), pos: 0, t0: 0, keys: 0, good: 0, errs: 0, combo: 0, best: 0, samples: [], em: {}, done: false, started: false };
    skipIndent();
    rerender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, isCode]);

  useEffect(() => {
    reset();
  }, [reset, resetKey]);

  const elapsedMs = () => {
    const e = E.current;
    const from = startAt ?? e.t0;
    if (!from) return 0;
    const ms = Date.now() - from;
    return kind === 'timed' ? Math.min(ms, durationSec * 1000) : Math.max(ms, 0);
  };

  const counts = (): TypingCounts => {
    const e = E.current;
    return { correctChars: e.good, totalKeys: e.keys, errors: e.errs, maxCombo: e.best };
  };

  const live = () => {
    const e = E.current;
    const ms = elapsedMs();
    const m = ms / 60000;
    return {
      ms,
      wpm: m > 0 ? Math.round(e.good / 5 / m) : 0,
      raw: m > 0 ? Math.round(e.keys / 5 / m) : 0,
      acc: e.keys ? Math.round((e.good / e.keys) * 100) : 100,
    };
  };

  const finish = useCallback(() => {
    const e = E.current;
    if (e.done) return;
    e.done = true;
    const l = live();
    const q = e.samples.slice(2);
    const mu = q.reduce((a, b) => a + b, 0) / (q.length || 1);
    const sd = Math.sqrt(q.reduce((a, b) => a + (b - mu) ** 2, 0) / (q.length || 1));
    const topErrors = Object.entries(e.em).sort((a, b) => b[1] - a[1]).slice(0, 5) as [string, number][];
    rerender();
    cb.current.onFinish({
      elapsedMs: l.ms,
      counts: counts(),
      wpm: l.wpm,
      rawWpm: l.raw,
      accuracy: l.acc,
      consistency: q.length > 2 && mu ? Math.max(0, Math.round(100 - (sd / mu) * 100)) : null,
      samples: e.samples,
      topErrors,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, durationSec, startAt]);

  // Taymer: jonli ko'rsatkichlar, namunalar (grafik), vaqtli rejim oxiri
  useEffect(() => {
    const id = window.setInterval(() => {
      const e = E.current;
      if (e.done || !(e.started || (startAt && Date.now() >= startAt))) return;
      const l = live();
      if (Math.floor(l.ms / 1000) > e.samples.length) e.samples.push(l.wpm);
      if (kind === 'timed' && l.ms >= durationSec * 1000) finish();
      rerender();
    }, 100);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, durationSec, startAt, finish]);

  const press = useCallback(
    (k: string) => {
      const e = E.current;
      if (e.done || disabled) return;
      if (startAt && Date.now() < startAt) return; // sanoq tugamagan
      if (k === 'Backspace') {
        if (strict) {
          if (e.st[e.pos] === 'w') {
            e.st[e.pos] = '';
            rerender();
          }
          return;
        }
        if (e.pos === 0) return;
        e.pos--;
        while (e.pos > 0 && e.st[e.pos] === 's') e.pos--;
        e.st[e.pos] = '';
        rerender();
        return;
      }
      const ch = k === 'Enter' ? '\n' : k;
      if (!isCode && ch === '\n') return;
      if (!e.started) {
        e.started = true;
        if (!startAt) e.t0 = Date.now();
        cb.current.onStart?.();
      }
      e.keys++;
      if (ch === text[e.pos]) {
        e.st[e.pos] = 'c';
        e.good++;
        e.combo++;
        if (e.combo > e.best) e.best = e.combo;
        if (sound) playKey(ch === '\n' ? 4 : ch === ' ' ? 3 : 0, sound, 0.8, ch);
        if (sound && e.combo && e.combo % 25 === 0) playKey(2, sound);
      } else {
        e.errs++;
        e.combo = 0;
        const want = text[e.pos] ?? '';
        e.em[want] = (e.em[want] || 0) + 1;
        e.st[e.pos] = 'w';
        if (sound) playKey(1, sound);
        if (strict) {
          cb.current.onProgress?.(e.pos, counts());
          rerender();
          return;
        }
      }
      e.pos++;
      if (ch === '\n') skipIndent();
      cb.current.onProgress?.(e.pos, counts());
      if (e.pos >= text.length) {
        finish();
        return;
      }
      rerender();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text, disabled, strict, isCode, startAt, sound, finish]
  );

  // Klaviatura: faqat maydon fokusda (yoki sahifada boshqa input fokusda bo'lmasa)
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      // Faol bo'lmagan (yashirin tab, tugagan) maydon klaviaturani umuman tutmaydi —
      // sahifada ikkita maydon bo'lsa ham bitta harf ikki joyga yozilmasin
      if (disabled) return;
      const t = ev.target as HTMLElement | null;
      const inOther = t && t !== inputRef.current && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (inOther) return;
      if ((t?.tagName === 'BUTTON' || t?.tagName === 'A') && (ev.key === 'Enter' || ev.key === ' ')) return;
      if (ev.key === 'Escape' && cb.current.onNewText) {
        ev.preventDefault();
        cb.current.onNewText();
        return;
      }
      if (ev.key === 'Tab' && cb.current.onRestart) {
        ev.preventDefault();
        cb.current.onRestart();
        return;
      }
      const ag = ev.getModifierState?.('AltGraph');
      if (!ag && (ev.ctrlKey || ev.metaKey || ev.altKey)) return;
      if (ev.key === 'Backspace' || ev.key === 'Enter' || ev.key.length === 1) {
        ev.preventDefault();
        press(ev.key);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [press, disabled]);

  // Mobil klaviatura: yashirin input "input" hodisasi (keydown "Unidentified" bo'ladi)
  const SE = '​';
  const onInput = () => {
    const el = inputRef.current;
    if (!el) return;
    const v = el.value;
    el.value = SE;
    if (v.length < SE.length) {
      press('Backspace');
      return;
    }
    for (const c of v.replace(SE, '')) press(c);
  };

  useEffect(() => {
    if (autoFocus && !disabled) inputRef.current?.focus({ preventScroll: true });
  }, [autoFocus, disabled, text]);

  // Kursor ko'rinib tursin
  useEffect(() => {
    const box = boxRef.current;
    const cur = preRef.current?.querySelector('[data-cur="1"]') as HTMLElement | null;
    if (!box || !cur) return;
    const lh = parseFloat(getComputedStyle(cur).lineHeight) || 32;
    // boxRef — "relative" aylantirgich, ya'ni offsetTop to'g'ridan-to'g'ri unga nisbatan
    const top = cur.offsetTop;
    if (top - box.scrollTop > lh * 1.5 || top < box.scrollTop) box.scrollTop = Math.max(0, top - lh);
  });

  const e = E.current;
  const l = live();
  const remaining = kind === 'timed' ? Math.max(0, Math.ceil(durationSec - l.ms / 1000)) : null;
  const waiting = !!startAt && Date.now() < startAt;

  // Uzun vaqtli matnda faqat kursor atrofini chizamiz (tezlik uchun)
  const winStart = kind === 'timed' ? Math.max(0, text.lastIndexOf(' ', Math.max(0, e.pos - 250)) + 1) : 0;
  const winEnd = kind === 'timed' ? Math.min(text.length, e.pos + 700) : text.length;

  const spans = [];
  for (let i = winStart; i < winEnd; i++) {
    const ch = text[i];
    const s = e.st[i];
    let cls = '';
    if (s === 'c' || s === 's') cls = isCode && hl[i] ? HL_CLASS[hl[i]] : 'text-zinc-100';
    else if (s === 'w') cls = 'text-red-400 bg-red-500/20 rounded-sm';
    else cls = isCode && hl[i] ? `${HL_CLASS[hl[i]]} opacity-40` : 'text-zinc-500';
    const isCur = i === e.pos && !e.done;
    spans.push(
      <span
        key={i}
        data-cur={isCur ? '1' : undefined}
        className={`${cls} ${isCur ? 'relative before:absolute before:-left-px before:top-[10%] before:h-[80%] before:w-[2px] before:rounded before:bg-orange-500 before:animate-pulse' : ''}`}
      >
        {ch === '\n' ? <><span className="text-zinc-600 select-none">↵</span>{'\n'}</> : ch}
      </span>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <Stat value={l.wpm} label="wpm" accent />
        <Stat value={`${l.acc}`} label="% aniqlik" />
        <Stat value={remaining ?? Math.floor(l.ms / 1000)} label={remaining != null ? 'soniya qoldi' : 'soniya'} />
        {e.combo >= 10 && (
          <span className={`text-lg font-bold text-orange-400 ${e.combo >= 25 ? 'drop-shadow-[0_0_8px_rgba(249,115,22,.7)]' : ''}`}>🔥 {e.combo}</span>
        )}
      </div>

      <div
        onClick={() => inputRef.current?.focus({ preventScroll: true })}
        className={`relative cursor-text rounded-2xl border bg-zinc-950 px-4 py-4 sm:px-6 sm:py-5 transition-colors ${
          disabled ? 'border-zinc-800 opacity-60' : 'border-zinc-800 focus-within:border-orange-500/60'
        }`}
        aria-label="Yozish maydoni"
      >
        <input
          ref={inputRef}
          defaultValue={SE}
          onInput={onInput}
          onFocus={(ev) => (ev.currentTarget.value = SE)}
          onPaste={(ev) => ev.preventDefault()}
          onDrop={(ev) => ev.preventDefault()}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Yozing"
          className="absolute left-0 top-0 h-px w-px opacity-0"
        />
        {/* Ichki aylantirgich: vaqtli matnda aniq 3 qator (padding zonasida 4-qator
            yarmi ko'rinib qolmasin), kodda — 26rem gacha */}
        <div
          ref={boxRef}
          className={`relative ${kind === 'timed' ? 'h-[6.75rem] overflow-hidden sm:h-[7.5rem]' : 'max-h-[24rem] overflow-y-auto'}`}
        >
          <pre
            ref={preRef}
            className={`whitespace-pre-wrap break-words font-mono leading-[2] ${isCode ? 'text-[15px] sm:text-base' : 'text-lg sm:text-xl'}`}
          >
            {spans}
          </pre>
        </div>
        {waiting && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/70 backdrop-blur-[1px]">
            <span className="text-5xl font-black text-orange-400 tabular-nums">{Math.ceil((startAt! - Date.now()) / 1000)}</span>
          </div>
        )}
      </div>

      {showKeyboard && <TypingKeyboard next={e.done ? undefined : text[e.pos]} />}
    </div>
  );
}

function Stat({ value, label, accent }: { value: number | string; label: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`text-3xl font-black tabular-nums ${accent ? 'text-orange-400' : 'text-zinc-100'}`}>{value}</span>
      <small className="text-xs text-zinc-500">{label}</small>
    </div>
  );
}
