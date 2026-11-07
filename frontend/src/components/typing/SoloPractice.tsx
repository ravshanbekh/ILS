/**
 * Mashq (yakka) — matn yoki kod. Matnni server beradi, natijani server
 * hisoblaydi va saqlaydi (reytingga kiradi).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { CloudUpload, Loader2, RotateCcw, Volume2, VolumeX, Keyboard as KeyboardIcon, Trophy, AlertTriangle } from 'lucide-react';
import { typingApi } from '@/api';
import TypingSurface, { type EngineResult } from './TypingSurface';
import { SOUND_PROFILES, type SoundProfile } from './typingSound';
import { SpeedChart, errMsg, isTransientError, saveFailureCause } from './typingUi';

const CODE_LANGS = ['Python', 'JavaScript', 'TypeScript', 'C++', 'Java', 'C#', 'Go', 'Rust', 'PHP', 'Kotlin', 'HTML', 'CSS', 'SQL', 'Bash', 'React', 'Tasodifiy'];
const SRC = [
  ['en', 'English'],
  ['uz', "O'zbek"],
  ['tech', 'Dasturlash'],
] as const;

interface Opts {
  contentType: 'text' | 'code';
  durationSec: number;
  src: string;
  lang: string;
  punctuation: boolean;
  numbers: boolean;
  sound: SoundProfile | null;
  keyboard: boolean;
}
const DEFAULTS: Opts = { contentType: 'text', durationSec: 30, src: 'en', lang: 'Python', punctuation: false, numbers: false, sound: null, keyboard: true };
const LS_KEY = 'ils-typing-opts';

function loadOpts(): Opts {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(LS_KEY) || '{}') };
  } catch {
    return DEFAULTS;
  }
}

interface Session {
  sessionId: string;
  contentType: 'text' | 'code';
  variant: string;
  durationSec: number;
  text: string;
}

/**
 * Saqlanmagan natijalar navbati. Javob yo'lda yo'qolsa (internet, proxy 502)
 * natija tashlab yuborilmaydi: shu yerda turadi va aloqa tiklanganda qayta
 * yuboriladi. Server takroriy so'rovni ikkinchi yozuv qilib saqlamaydi.
 */
interface PendingSave {
  sessionId: string;
  elapsedMs: number;
  counts: EngineResult['counts'];
  at: number;
}
const PENDING_KEY = 'ils-typing-pending';
const PENDING_TTL_MS = 2 * 60 * 60 * 1000; // serverdagi sessiya muddati bilan bir xil
const PENDING_MAX = 10;
const RETRY_DELAYS_MS = [1000, 2000, 4000];
const RETRY_INTERVAL_MS = 30_000;

function readPending(): PendingSave[] {
  try {
    const rows = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]') as PendingSave[];
    return rows.filter((p) => Date.now() - p.at < PENDING_TTL_MS).slice(-PENDING_MAX);
  } catch {
    return [];
  }
}
function writePending(rows: PendingSave[]) {
  try {
    if (rows.length) localStorage.setItem(PENDING_KEY, JSON.stringify(rows));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    /* private rejim — navbat faqat shu sahifa uchun yo'qoladi */
  }
}

const NOT_SAVED_YET = (cause: string) => `Natija hozircha saqlanmadi (${cause}). U shu brauzerda turibdi va aloqa tiklanganda o'zi yuboriladi.`;

export default function SoloPractice({ onSaved }: { onSaved?: () => void }) {
  const [o, setO] = useState<Opts>(loadOpts);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ sessionId: string; engine: EngineResult; server: any; isRecord: boolean; previousBest: number | null; unsaved: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingCount, setPendingCount] = useState(() => readPending().length);
  const [flushing, setFlushing] = useState(false);
  const flushBusy = useRef(false);
  const shownSession = useRef<string | null>(null); // ekrandagi natija kartasi qaysi sessiyaniki
  const savedCb = useRef(onSaved); // ota har chizilganda yangi funksiya beradi — flush qayta ishga tushmasin
  savedCb.current = onSaved;

  const set = (patch: Partial<Opts>) => {
    const next = { ...o, ...patch };
    setO(next);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
      /* private rejim */
    }
  };

  const start = useCallback(async (opts: Opts) => {
    setLoading(true);
    setError(null);
    setResult(null);
    shownSession.current = null;
    try {
      const res = await typingApi.startSolo(
        opts.contentType === 'code'
          ? { contentType: 'code', variant: opts.lang }
          : { contentType: 'text', variant: opts.src, durationSec: opts.durationSec, punctuation: opts.punctuation, numbers: opts.numbers }
      );
      setSession(res.data.data);
    } catch (e) {
      setError(errMsg(e, 'Matnni yuklab bo\'lmadi'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Sozlama o'zgarsa — yangi matn
  useEffect(() => {
    void start(o);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.contentType, o.durationSec, o.src, o.lang, o.punctuation, o.numbers]);

  /** Navbatdagi natijalarni yuboradi; aloqa yo'q bo'lsa to'xtab, keyingi safar davom etadi */
  const flushPending = useCallback(async () => {
    if (flushBusy.current) return;
    flushBusy.current = true;
    setFlushing(true);
    try {
      for (const item of readPending()) {
        const drop = () => {
          writePending(readPending().filter((p) => p.sessionId !== item.sessionId));
          setPendingCount(readPending().length);
        };
        const isShown = shownSession.current === item.sessionId;
        try {
          const res = await typingApi.finishSolo({ sessionId: item.sessionId, elapsedMs: item.elapsedMs, counts: item.counts });
          const d = res.data.data;
          drop();
          if (isShown) {
            setResult((cur) => (cur ? { ...cur, server: d.result, isRecord: d.isRecord, previousBest: d.previousBest, unsaved: false } : cur));
            setError(null);
          }
          savedCb.current?.();
        } catch (e) {
          if (isTransientError(e)) {
            if (isShown) setError(NOT_SAVED_YET(saveFailureCause(e)));
            break;
          }
          // Server rad etdi (masalan, sessiya eskirgan) — qayta yuborishdan foyda yo'q
          drop();
          if (isShown) {
            setResult((cur) => (cur ? { ...cur, unsaved: false } : cur));
            setError(errMsg(e, 'Natijani saqlab bo\'lmadi'));
          }
        }
      }
    } finally {
      flushBusy.current = false;
      setFlushing(false);
    }
  }, []);

  // Oldingi tashrifdan qolganlari ham, aloqa qaytgani ham shu yerda ushlanadi
  useEffect(() => {
    void flushPending();
    const onOnline = () => void flushPending();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [flushPending]);
  useEffect(() => {
    if (!pendingCount) return;
    const id = window.setInterval(() => void flushPending(), RETRY_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [pendingCount, flushPending]);

  const onFinish = async (r: EngineResult) => {
    if (!session) return;
    const payload = { sessionId: session.sessionId, elapsedMs: Math.max(1, Math.round(r.elapsedMs)), counts: r.counts };
    setSaving(true);
    try {
      // Qisqa uzilishni o'quvchi sezmasin: bir necha marta jim qayta uriniladi
      for (let attempt = 0; ; attempt++) {
        try {
          const res = await typingApi.finishSolo(payload);
          const d = res.data.data;
          shownSession.current = payload.sessionId;
          setResult({ sessionId: payload.sessionId, engine: r, server: d.result, isRecord: d.isRecord, previousBest: d.previousBest, unsaved: false });
          onSaved?.();
          return;
        } catch (e) {
          if (!isTransientError(e) || attempt >= RETRY_DELAYS_MS.length) throw e;
          await new Promise((done) => window.setTimeout(done, RETRY_DELAYS_MS[attempt]));
        }
      }
    } catch (e) {
      shownSession.current = payload.sessionId;
      const transient = isTransientError(e);
      setResult({ sessionId: payload.sessionId, engine: r, server: null, isRecord: false, previousBest: null, unsaved: transient });
      if (transient) {
        const rows = [...readPending(), { ...payload, at: Date.now() }].slice(-PENDING_MAX);
        writePending(rows);
        setPendingCount(rows.length);
        setError(NOT_SAVED_YET(saveFailureCause(e)));
      } else {
        setError(errMsg(e, 'Natijani saqlab bo\'lmadi'));
      }
    } finally {
      setSaving(false);
    }
  };

  const Chip = ({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) => (
    <button
      onClick={onClick}
      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${on ? 'bg-orange-500 text-white' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-100 border border-zinc-800'}`}
    >
      {children}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Sozlamalar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3">
        <div className="flex gap-1.5">
          <Chip on={o.contentType === 'text'} onClick={() => set({ contentType: 'text' })}>Matn</Chip>
          <Chip on={o.contentType === 'code'} onClick={() => set({ contentType: 'code' })}>Kod</Chip>
        </div>
        {o.contentType === 'text' ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-zinc-500">vaqt</span>
              {[15, 30, 60, 120].map((d) => (
                <Chip key={d} on={o.durationSec === d} onClick={() => set({ durationSec: d })}>{d}</Chip>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-zinc-500">so'zlar</span>
              {SRC.map(([k, label]) => (
                <Chip key={k} on={o.src === k} onClick={() => set({ src: k })}>{label}</Chip>
              ))}
            </div>
            {o.src !== 'tech' && (
              <div className="flex gap-1.5">
                <Chip on={o.punctuation} onClick={() => set({ punctuation: !o.punctuation })}>Belgilar</Chip>
                <Chip on={o.numbers} onClick={() => set({ numbers: !o.numbers })}>Raqamlar</Chip>
              </div>
            )}
          </>
        ) : (
          <select
            value={o.lang}
            onChange={(e) => set({ lang: e.target.value })}
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs font-semibold text-zinc-200"
            aria-label="Dasturlash tili"
          >
            {CODE_LANGS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => set({ sound: o.sound ? null : 'soft' })}
            className="rounded-lg border border-zinc-800 bg-zinc-900 p-1.5 text-zinc-400 hover:text-zinc-100"
            title={o.sound ? 'Ovozni o\'chirish' : 'Ovozni yoqish'}
            aria-label="Ovoz"
          >
            {o.sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          {o.sound && (
            <select
              value={o.sound}
              onChange={(e) => set({ sound: e.target.value as SoundProfile })}
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-300"
              aria-label="Ovoz turi"
            >
              {SOUND_PROFILES.map(([label, v]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => set({ keyboard: !o.keyboard })}
            className={`hidden rounded-lg border p-1.5 md:block ${o.keyboard ? 'border-orange-500/40 text-orange-400' : 'border-zinc-800 text-zinc-400'} bg-zinc-900`}
            title="Ekran klaviaturasi"
            aria-label="Ekran klaviaturasi"
          >
            <KeyboardIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {pendingCount > 0 && !result?.unsaved && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-400">
          <CloudUpload className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">{pendingCount} ta natija hali saqlanmagan — aloqa tiklanganda o'zi yuboriladi.</span>
          <button onClick={() => void flushPending()} disabled={flushing} className="rounded-lg border border-amber-500/40 px-3 py-1 text-xs font-semibold hover:bg-amber-500/10 disabled:opacity-50">
            {flushing ? 'Yuborilmoqda…' : 'Hozir yuborish'}
          </button>
        </div>
      )}

      {loading || !session ? (
        <div className="flex h-40 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        </div>
      ) : result ? (
        <ResultCard result={result} contentType={session.contentType} onAgain={() => void start(o)} onRetrySave={() => void flushPending()} retrying={flushing} />
      ) : (
        <>
          <TypingSurface
            key={session.sessionId}
            text={session.text}
            kind={session.contentType === 'text' ? 'timed' : 'complete'}
            durationSec={session.durationSec}
            isCode={session.contentType === 'code'}
            sound={o.sound}
            showKeyboard={o.keyboard}
            onFinish={onFinish}
            onRestart={() => void start(o)}
            onNewText={() => void start(o)}
          />
          <p className="text-center text-xs text-zinc-500">
            {session.contentType === 'text'
              ? 'Vaqt birinchi harfdan boshlanadi. Esc — yangi matn, Tab — qayta. Combo 10 dan boshlanadi!'
              : `${session.variant}: qator oxirida Enter bosing, chekinish avtomatik o'tkaziladi. Esc — yangi kod.`}
          </p>
          {saving && <p className="text-center text-xs text-zinc-500">Natija saqlanmoqda…</p>}
        </>
      )}
    </div>
  );
}

function ResultCard({
  result,
  contentType,
  onAgain,
  onRetrySave,
  retrying,
}: {
  result: { engine: EngineResult; server: any; isRecord: boolean; previousBest: number | null; unsaved: boolean };
  contentType: string;
  onAgain: () => void;
  onRetrySave: () => void;
  retrying: boolean;
}) {
  const s = result.server;
  const e = result.engine;
  useEffect(() => {
    const h = (ev: KeyboardEvent) => {
      if (ev.key === 'Enter' || ev.key === 'Tab' || ev.key === 'Escape') {
        ev.preventDefault();
        onAgain();
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onAgain]);
  const cells: [string | number, string][] = [
    [s?.wpm ?? e.wpm, 'wpm'],
    [`${s?.accuracy ?? e.accuracy}%`, 'aniqlik'],
    [s?.durationSec ?? Math.round(e.elapsedMs / 1000), 'soniya'],
    [s?.errors ?? e.counts.errors, 'xatolar'],
    [s?.maxCombo ?? e.counts.maxCombo, 'eng uzun combo'],
    [s?.rawWpm ?? e.rawWpm, 'raw wpm'],
    [e.consistency != null ? `${e.consistency}%` : '—', 'barqarorlik'],
  ];
  return (
    <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex flex-wrap items-center gap-2">
        {result.isRecord && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm font-bold text-amber-400">
            <Trophy className="h-4 w-4" /> Yangi rekord!
          </span>
        )}
        {!result.isRecord && result.previousBest != null && (
          <span className="text-sm text-zinc-400">Rekordingiz: <b className="text-zinc-100">{result.previousBest} wpm</b></span>
        )}
        {s?.flagged && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs text-red-400">
            <AlertTriangle className="h-3.5 w-3.5" /> Tekshiruvda: reytingga kirmaydi ({s.flagReason})
          </span>
        )}
        {!s && <span className="text-xs text-red-400">{result.unsaved ? 'Natija hali serverga yetib bormadi' : 'Natija serverga saqlanmadi'}</span>}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {cells.map(([v, label], i) => (
          <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5">
            <div className={`text-2xl font-black tabular-nums ${i === 0 ? 'text-orange-400' : 'text-zinc-100'}`}>{v}</div>
            <div className="text-[11px] text-zinc-500">{label}</div>
          </div>
        ))}
      </div>
      <SpeedChart samples={e.samples} />
      <p className="text-sm text-zinc-400">
        {e.topErrors.length
          ? <>Eng ko'p xato: {e.topErrors.map(([k, v]) => <code key={k} className="mx-1 rounded bg-zinc-950 px-1.5 py-0.5 text-red-400">{k.trim() ? (k === '\n' ? '↵' : k) : '␣'} ×{v}</code>)}</>
          : 'Xatosiz! 💯'}
      </p>
      <div className="flex flex-wrap gap-2">
        <button onClick={onAgain} className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-600">
          <RotateCcw className="h-4 w-4" /> Yana urinish
        </button>
        {result.unsaved && (
          <button onClick={onRetrySave} disabled={retrying} className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-5 py-2.5 text-sm font-bold text-amber-400 hover:bg-amber-500/20 disabled:opacity-50">
            {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />} Qayta saqlash
          </button>
        )}
        <span className="self-center text-xs text-zinc-500">Enter / Tab — yangi {contentType === 'code' ? 'kod' : 'matn'}</span>
      </div>
    </div>
  );
}
