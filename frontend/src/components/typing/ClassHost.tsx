/**
 * Sinf musobaqasi — MENTOR boshqaruvi.
 * Mentor o'zi o'ynamaydi: musobaqa ochadi → ekranda katta kod (proyektor uchun)
 * → o'quvchilar kod bilan kiradi (cheklovsiz) → "Boshlash" → jonli kuzatuv →
 * hamma tugatganda yoki mentor "Yakunlash" bosganda natija + Excel.
 * Mentor sahifadan chiqib ketsa ham musobaqa to'xtamaydi — qaytsa davom etadi.
 */
import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import {
  AlertTriangle, Check, Copy, Download, Flag, GraduationCap, Loader2, Play, Plus, RefreshCw, Timer, Trash2,
} from 'lucide-react';
import { typingApi } from '@/api';
import { downloadBlob } from '@/utils';
import { createTypingSocket, SOCKET_ERR, type RoomState } from './typingRoom';
import { ClassBoard, ClassLobby, ClassResults } from './ClassBoard';
import { MODE_LABEL, variantLabel } from './typingUi';

const CODE_LANGS = ['Tasodifiy', 'Python', 'JavaScript', 'TypeScript', 'C++', 'Java', 'C#', 'Go', 'Rust', 'PHP', 'Kotlin', 'HTML', 'CSS', 'SQL', 'Bash', 'React'];
const SIZES: { key: 'short' | 'medium' | 'long'; label: string; text: string; code: string }[] = [
  { key: 'short', label: 'Qisqa', text: '~25 so\'z', code: '~140 belgi' },
  { key: 'medium', label: "O'rta", text: '~40 so\'z', code: '~300 belgi' },
  { key: 'long', label: 'Uzun', text: '~80 so\'z', code: '~600 belgi' },
];

export async function downloadClassExcel(matchId: string, title: string | null, code: string) {
  const r = await typingApi.classExcel(matchId);
  const safe = (title || `Musobaqa ${code}`).replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60);
  downloadBlob(r.data, `${safe} — natijalar.xlsx`);
}

export default function ClassHost({ onFinished }: { onFinished?: () => void }) {
  const sockRef = useRef<Socket | null>(null);
  const [conn, setConn] = useState<'connecting' | 'online' | 'offline'>('connecting');
  const [connErr, setConnErr] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [offset, setOffset] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, setNow] = useState(0);
  const closing = useRef(false); // o'zimiz yopganda "Mentor yopdi" xabarini ko'rsatmaymiz

  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState<'text' | 'code'>('text');
  const [variant, setVariant] = useState('uz');
  const [lang, setLang] = useState('Tasodifiy');
  const [size, setSize] = useState<'short' | 'medium' | 'long'>('medium');

  useEffect(() => {
    const s = createTypingSocket();
    sockRef.current = s;
    const giveUp = window.setTimeout(() => {
      if (!s.connected) {
        setConn('offline');
        setConnErr('Serverga ulanib bo\'lmadi — internetni tekshirib, qayta urinib ko\'ring');
      }
    }, 12_000);
    s.on('connect', () => {
      window.clearTimeout(giveUp);
      setConn('online');
      setConnErr(null);
    });
    s.on('connect_error', (e) => {
      setConn('offline');
      setConnErr(SOCKET_ERR[e.message] ?? 'Serverga ulanib bo\'lmadi');
    });
    s.on('disconnect', () => setConn('offline'));
    // Qayta ulanganda server davom etayotgan musobaqani o'zi yuboradi
    s.on('room:state', (r: RoomState) => {
      setOffset(r.serverNow - Date.now());
      setRoom(r);
    });
    s.on('room:closed', (p: { reason: string }) => {
      setRoom(null);
      if (!closing.current) setNotice(p.reason);
      closing.current = false;
    });
    s.connect();
    return () => {
      window.clearTimeout(giveUp);
      // room:leave yuborilmaydi — mentor sahifadan chiqsa ham musobaqa davom etadi
      s.close();
    };
  }, []);

  useEffect(() => {
    if (!room || (room.status !== 'countdown' && room.status !== 'running')) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [room?.status]);

  useEffect(() => {
    if (room?.status === 'finished') onFinished?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.status, room?.code]);

  const call = (ev: string, data: unknown = {}) =>
    new Promise<any>((resolve) => {
      const s = sockRef.current;
      if (!s?.connected) return resolve({ ok: false, error: 'Server bilan aloqa yo\'q' });
      setBusy(true);
      s.timeout(8000).emit(ev, data, (err: unknown, r: any) => {
        setBusy(false);
        resolve(err ? { ok: false, error: 'Server javob bermadi' } : r);
      });
    });
  const act = async (ev: string, data: unknown = {}) => {
    setNotice(null);
    const r = await call(ev, data);
    if (!r?.ok) setNotice(r?.error ?? 'Xatolik');
    else if (r.room) setRoom(r.room);
    return r;
  };

  if (conn === 'connecting' && !room) {
    return <Box><Loader2 className="h-6 w-6 animate-spin text-zinc-500" /></Box>;
  }
  if (conn === 'offline' && !room) {
    return (
      <Box>
        <AlertTriangle className="h-6 w-6 text-amber-400" />
        <p className="text-sm text-zinc-400">{connErr ?? 'Server bilan aloqa uzildi'}</p>
        <button onClick={() => sockRef.current?.connect()} className="inline-flex items-center gap-2 rounded-xl bg-zinc-800 px-4 py-2 text-sm text-zinc-200">
          <RefreshCw className="h-4 w-4" /> Qayta ulanish
        </button>
      </Box>
    );
  }

  // ── Yangi musobaqa ─────────────────────────────────────────────────────────
  if (!room) {
    const seg = (on: boolean) => `rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${on ? 'bg-orange-500 text-white' : 'border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-100'}`;
    return (
      <div className="space-y-4">
        {notice && <NoticeBar text={notice} />}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <form
            className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              act('room:create', { mode: 'class', title, contentType, variant: contentType === 'code' ? lang : variant, size });
            }}
          >
            <h3 className="flex items-center gap-2 text-lg font-black text-zinc-100"><Plus className="h-5 w-5 text-orange-400" /> Yangi musobaqa</h3>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-zinc-400">Nomi (ixtiyoriy)</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 80))}
                placeholder="Masalan: Frontend-12 guruh, 1-tur"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600"
              />
            </label>
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-zinc-400">Nima yoziladi</span>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setContentType('text')} className={seg(contentType === 'text')}>Matn</button>
                <button type="button" onClick={() => setContentType('code')} className={seg(contentType === 'code')}>Kod</button>
                {contentType === 'text' ? (
                  <select value={variant} onChange={(e) => setVariant(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200" aria-label="Til">
                    <option value="uz">O'zbek</option>
                    <option value="en">English</option>
                    <option value="tech">Dasturlash</option>
                  </select>
                ) : (
                  <select value={lang} onChange={(e) => setLang(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200" aria-label="Dasturlash tili">
                    {CODE_LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-zinc-400">Hajmi</span>
              <div className="grid grid-cols-3 gap-2">
                {SIZES.map((s) => (
                  <button key={s.key} type="button" onClick={() => setSize(s.key)} className={`${seg(size === s.key)} flex flex-col items-center leading-tight`}>
                    {s.label}
                    <span className={`text-[11px] font-normal ${size === s.key ? 'text-orange-100' : 'text-zinc-500'}`}>{contentType === 'text' ? s.text : s.code}</span>
                  </button>
                ))}
              </div>
            </div>
            <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-base font-bold text-white hover:bg-orange-600 disabled:opacity-50">
              <GraduationCap className="h-5 w-5" /> Musobaqa ochish
            </button>
          </form>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <h3 className="mb-3 font-bold text-zinc-100">Qanday o'tadi</h3>
            <ol className="space-y-3 text-sm text-zinc-400">
              {[
                ['Musobaqani oching', 'Kod paydo bo\'ladi — uni proyektorda yoki chatda ko\'rsating.'],
                ['O\'quvchilar kiradi', 'O\'yinlar → Tez yozish → Bellashuv → «Sinf musobaqasi» → kod. Soni cheklanmagan.'],
                ['«Boshlash» ni bosing', '3 soniyalik sanoqdan keyin hamma bir xil matnni yozadi, siz jonli kuzatasiz.'],
                ['Natija', 'Hamma tugatganda (yoki «Yakunlash» bosganingizda) o\'rinlar chiqadi — Excel\'ga yuklab olasiz.'],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-xs font-black text-orange-400">{i + 1}</span>
                  <span><b className="text-zinc-200">{t}</b><br />{d}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-500">
              Sinf musobaqasi jang reytingiga (ELO) ta'sir qilmaydi. Natijalar o'quvchi tarixiga va tezlik reytingiga yoziladi.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const startLocal = room.startAt ? room.startAt - offset : null;
  const now = Date.now();
  const header = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3">
      <GraduationCap className="h-5 w-5 text-orange-400" />
      <span className="font-bold text-zinc-100">{room.title || MODE_LABEL.class}</span>
      <span className="text-xs text-zinc-500">{variantLabel(room.contentType, room.variant)} · {room.textLength} belgi · chegara {room.timeLimitSec} s</span>
    </div>
  );

  // ── Natija ─────────────────────────────────────────────────────────────────
  if (room.status === 'finished') {
    const res = room.results;
    const newContest = async () => {
      await call('room:close');
      setRoom(null);
    };
    return (
      <div className="space-y-3">
        {notice && <NoticeBar text={notice} />}
        {header}
        {!res?.players ? (
          <Box>{res?.error ? <p className="text-sm text-red-400">{res.error}</p> : <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />}</Box>
        ) : (
          <ClassResults
            players={res.players}
            textLength={res.textLength ?? room.textLength}
            actions={
              <>
                {res.matchId && (
                  <button
                    onClick={() => downloadClassExcel(res.matchId!, room.title, room.code).catch(() => setNotice('Excel yuklab bo\'lmadi'))}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500"
                  >
                    <Download className="h-4 w-4" /> Excel
                  </button>
                )}
                <button onClick={newContest} className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600">
                  <Plus className="h-4 w-4" /> Yangi musobaqa
                </button>
              </>
            }
          />
        )}
      </div>
    );
  }

  // ── Lobby ──────────────────────────────────────────────────────────────────
  if (room.status === 'lobby') {
    return (
      <div className="space-y-3">
        {notice && <NoticeBar text={notice} />}
        {header}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-orange-500/30 bg-gradient-to-b from-orange-500/10 to-zinc-900 p-6 text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Musobaqa kodi</span>
            <div className="flex items-center gap-3">
              <span className="select-all font-mono text-5xl font-black tracking-[0.2em] text-zinc-50 2xl:text-7xl">{room.code}</span>
              <CopyBtn text={room.code} />
            </div>
            <p className="max-w-sm text-sm text-zinc-400">
              O'quvchilar: <b className="text-zinc-200">O'yinlar → Tez yozish → Bellashuv → «Sinf musobaqasi»</b> va shu kodni kiritadi.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                disabled={busy || room.players.length === 0}
                onClick={() => act('room:start')}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-base font-bold text-white hover:bg-emerald-500 disabled:opacity-40"
              >
                <Play className="h-5 w-5" /> Boshlash{room.players.length ? ` (${room.players.length})` : ''}
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  if (room.players.length === 0 || window.confirm('Musobaqa yopilsinmi? Kirgan o\'quvchilar chiqariladi.')) {
                    closing.current = true;
                    act('room:close').then((r) => r?.ok && setRoom(null));
                  }
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-3 text-sm text-zinc-300 hover:border-red-500/50 hover:text-red-400 disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" /> Yopish
              </button>
            </div>
          </div>
          <ClassLobby room={room} onKick={(id) => act('room:kick', { userId: id })} />
        </div>
      </div>
    );
  }

  // ── Sanoq / poyga ──────────────────────────────────────────────────────────
  const counting = room.status === 'countdown' && startLocal && startLocal > now;
  const left = startLocal ? Math.max(0, Math.ceil((startLocal + room.timeLimitSec * 1000 - now) / 1000)) : room.timeLimitSec;
  const done = room.players.filter((p) => p.finishedAt).length;
  return (
    <div className="space-y-3">
      {notice && <NoticeBar text={notice} />}
      {header}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={counting ? 'Boshlanishiga' : 'Qolgan vaqt'} value={counting ? `${Math.ceil((startLocal! - now) / 1000)}` : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`} accent={!counting && left <= 15 ? 'text-red-400' : 'text-zinc-50'} icon={<Timer className="h-4 w-4" />} />
        <Stat label="Tugatdi" value={`${done} / ${room.players.length}`} accent="text-emerald-400" />
        <Stat label="Kod" value={room.code} accent="text-zinc-50 font-mono tracking-widest" />
        <div className="flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
          <button
            disabled={busy || room.status !== 'running'}
            onClick={() => {
              if (window.confirm('Musobaqani hozir yakunlaysizmi? Kim qayergacha yozgan bo\'lsa, shu natija hisoblanadi.')) act('room:finish');
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-300 hover:bg-red-500/20 disabled:opacity-40"
          >
            <Flag className="h-4 w-4" /> Yakunlash
          </button>
        </div>
      </div>
      {counting && (
        <div className="flex items-center justify-center rounded-2xl border border-orange-500/30 bg-orange-500/10 py-8">
          <span key={Math.ceil((startLocal! - now) / 1000)} className="ils-chip-in text-7xl font-black text-orange-400">{Math.ceil((startLocal! - now) / 1000)}</span>
        </div>
      )}
      <ClassBoard room={room} />
    </div>
  );
}

function Stat({ label, value, accent, icon }: { label: string; value: string; accent: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{icon}{label}</div>
      <div className={`text-2xl font-black tabular-nums ${accent}`}>{value}</div>
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          /* eski brauzer */
        }
        setOk(true);
        setTimeout(() => setOk(false), 1500);
      }}
      className="rounded-xl bg-zinc-800 p-2.5 text-zinc-300 hover:bg-zinc-700"
      title="Kodni nusxalash"
      aria-label="Kodni nusxalash"
    >
      {ok ? <Check className="h-5 w-5 text-emerald-400" /> : <Copy className="h-5 w-5" />}
    </button>
  );
}

const Box = ({ children }: { children: React.ReactNode }) => (
  <div className="flex min-h-[12rem] flex-col items-center justify-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center">{children}</div>
);
const NoticeBar = ({ text }: { text: string }) => (
  <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-400">
    <AlertTriangle className="h-4 w-4 shrink-0" /> {text}
  </div>
);
