/**
 * Bellashuv — Duel (2), 4 kishilik, Jamoaviy (A va B, 8 kishigacha).
 * Real vaqt: Socket.IO `/typing` (backend: modules/typing/typing.rooms.ts).
 * Xona holati va natija serverda; bu yerda faqat ko'rsatish va yozish.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  Swords, Users, UsersRound, Zap, Copy, Check, LogOut, Play, Loader2, Crown, X, Lock, RefreshCw, Trophy, AlertTriangle,
} from 'lucide-react';
import { SOCKET_URL } from '@/utils/socket';
import { useAuthStore } from '@/stores/authStore';
import TypingSurface from './TypingSurface';
import { MODE_LABEL, variantLabel, medal } from './typingUi';

type Mode = 'duel' | 'ffa' | 'team';
interface RoomPlayer {
  userId: string;
  fullName: string;
  team: 'A' | 'B' | null;
  pos: number;
  finishedAt: number | null;
  left: boolean;
  connected: boolean;
  wpm: number;
}
interface RoomState {
  code: string;
  mode: Mode;
  contentType: 'text' | 'code';
  variant: string;
  isPrivate: boolean;
  hostId: string;
  status: 'lobby' | 'countdown' | 'running' | 'finished';
  maxPlayers: number;
  timeLimitSec: number;
  startAt: number | null;
  serverNow: number;
  text: string | null;
  textLength: number;
  players: RoomPlayer[];
  results: any;
}
interface LobbyRow {
  code: string;
  mode: Mode;
  contentType: string;
  variant: string;
  players: number;
  maxPlayers: number;
  host: string;
}

const CODE_LANGS = ['Tasodifiy', 'Python', 'JavaScript', 'TypeScript', 'C++', 'Java', 'C#', 'Go', 'Rust', 'PHP', 'Kotlin', 'HTML', 'CSS', 'SQL', 'Bash', 'React'];
const MODES: { key: Mode; title: string; desc: string; icon: any }[] = [
  { key: 'duel', title: 'Duel', desc: '1 ga 1 — kim tezroq?', icon: Swords },
  { key: 'ffa', title: '4 kishilik', desc: '4 o\'yinchi, bitta g\'olib', icon: Users },
  { key: 'team', title: 'Jamoaviy', desc: 'A va B jamoa, 8 kishigacha', icon: UsersRound },
];
const SOCKET_ERR: Record<string, string> = {
  AUTH_REQUIRED: 'Tizimga qaytadan kiring',
  AUTH_INVALID: 'Sessiya eskirgan — qaytadan kiring',
  STUDENTS_ONLY: 'Bellashuv faqat o\'quvchilar uchun',
};

export default function Battle({ onFinished, active = true }: { onFinished?: () => void; active?: boolean }) {
  const me = useAuthStore((s) => s.user);
  const sockRef = useRef<Socket | null>(null);
  const [conn, setConn] = useState<'connecting' | 'online' | 'offline'>('connecting');
  const [connErr, setConnErr] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [offset, setOffset] = useState(0); // server − mahalliy soat
  const [lobbies, setLobbies] = useState<LobbyRow[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, setNow] = useState(0);

  // Yaratish sozlamalari
  const [mode, setMode] = useState<Mode>('duel');
  const [contentType, setContentType] = useState<'text' | 'code'>('text');
  const [variant, setVariant] = useState('en');
  const [lang, setLang] = useState('Tasodifiy');
  const [isPrivate, setIsPrivate] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    const s = io(`${SOCKET_URL}/typing`, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      auth: (cb) => cb({ token: localStorage.getItem('accessToken') || '' }),
    });
    sockRef.current = s;
    s.on('connect', () => {
      setConn('online');
      setConnErr(null);
      s.emit('lobbies:watch', {}, (r: any) => r?.rooms && setLobbies(r.rooms));
    });
    s.on('connect_error', (e) => {
      setConn('offline');
      setConnErr(SOCKET_ERR[e.message] ?? 'Serverga ulanib bo\'lmadi');
    });
    s.on('disconnect', () => setConn('offline'));
    s.on('rooms:list', (rows: LobbyRow[]) => setLobbies(rows));
    s.on('room:state', (r: RoomState) => {
      setOffset(r.serverNow - Date.now());
      setRoom(r);
    });
    s.on('room:closed', (p: { reason: string }) => {
      setRoom(null);
      setNotice(p.reason);
    });
    s.on('room:quick-create', (p: { mode: Mode; contentType: 'text' | 'code' }) => {
      s.emit('room:create', { mode: p.mode, contentType: p.contentType, variant: p.contentType === 'code' ? 'Tasodifiy' : 'en' }, (r: any) => {
        if (r?.ok) setRoom(r.room);
      });
    });
    return () => {
      s.emit('room:leave', {});
      s.close();
    };
  }, []);

  // Sanoq va jonli vaqt uchun qayta chizish
  useEffect(() => {
    if (!room || room.status === 'lobby' || room.status === 'finished') return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [room?.status]);

  useEffect(() => {
    if (room?.status === 'finished') onFinished?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.status]);

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

  const leave = async () => {
    await call('room:leave');
    setRoom(null);
  };

  // ── Progress yuborish (har 150 ms, faqat o'zgarganda) ──────────────────────
  const latest = useRef<{ pos: number; keys: number; errors: number; maxCombo: number } | null>(null);
  const sent = useRef(-1);
  useEffect(() => {
    if (room?.status !== 'running') return;
    sent.current = -1;
    const id = window.setInterval(() => {
      const l = latest.current;
      if (l && l.pos !== sent.current) {
        sockRef.current?.emit('race:progress', l);
        sent.current = l.pos;
      }
    }, 150);
    return () => window.clearInterval(id);
  }, [room?.status, room?.code]);

  if (conn === 'connecting') {
    return <Center><Loader2 className="h-6 w-6 animate-spin text-zinc-500" /></Center>;
  }
  if (conn === 'offline' && !room) {
    return (
      <Center>
        <AlertTriangle className="h-6 w-6 text-amber-400" />
        <p className="text-sm text-zinc-400">{connErr ?? 'Server bilan aloqa uzildi'}</p>
        <button onClick={() => sockRef.current?.connect()} className="inline-flex items-center gap-2 rounded-xl bg-zinc-800 px-4 py-2 text-sm text-zinc-200">
          <RefreshCw className="h-4 w-4" /> Qayta ulanish
        </button>
      </Center>
    );
  }

  // ── Xonada emas: yaratish / qo'shilish ─────────────────────────────────────
  if (!room) {
    return (
      <div className="space-y-4">
        {notice && <Notice text={notice} />}
        <div className="grid gap-3 sm:grid-cols-3">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`rounded-2xl border p-4 text-left transition-colors ${mode === m.key ? 'border-orange-500 bg-orange-500/10' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'}`}
            >
              <m.icon className={`mb-2 h-6 w-6 ${mode === m.key ? 'text-orange-400' : 'text-zinc-400'}`} />
              <div className="font-bold text-zinc-100">{m.title}</div>
              <div className="text-xs text-zinc-500">{m.desc}</div>
            </button>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="font-bold text-zinc-100">Xona yaratish</h3>
            <div className="flex flex-wrap gap-2">
              {(['text', 'code'] as const).map((t) => (
                <button key={t} onClick={() => setContentType(t)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${contentType === t ? 'bg-orange-500 text-white' : 'border border-zinc-800 bg-zinc-950 text-zinc-400'}`}>
                  {t === 'text' ? 'Matn' : 'Kod'}
                </button>
              ))}
              {contentType === 'text' ? (
                <select value={variant} onChange={(e) => setVariant(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-200" aria-label="So'zlar">
                  <option value="en">English</option>
                  <option value="uz">O'zbek</option>
                  <option value="tech">Dasturlash</option>
                </select>
              ) : (
                <select value={lang} onChange={(e) => setLang(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-200" aria-label="Til">
                  {CODE_LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              )}
              <label className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
                <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="accent-orange-500" />
                <Lock className="h-3.5 w-3.5" /> Faqat kod bilan
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                disabled={busy}
                onClick={() => act('room:create', { mode, contentType, variant: contentType === 'code' ? lang : variant, isPrivate })}
                className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50"
              >
                <Play className="h-4 w-4" /> {MODE_LABEL[mode]} xonasini ochish
              </button>
              <button
                disabled={busy}
                onClick={() => act('room:quick', { mode, contentType })}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-zinc-200 hover:border-orange-500/60 disabled:opacity-50"
              >
                <Zap className="h-4 w-4 text-orange-400" /> Tezkor o'yin
              </button>
            </div>
            <div className="flex gap-2 pt-1">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 8))}
                onKeyDown={(e) => e.key === 'Enter' && joinCode && act('room:join', { code: joinCode })}
                placeholder="Xona kodi"
                className="w-36 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-sm uppercase tracking-widest text-zinc-100 placeholder:normal-case placeholder:tracking-normal placeholder:text-zinc-600"
                aria-label="Xona kodi"
              />
              <button disabled={!joinCode || busy} onClick={() => act('room:join', { code: joinCode })} className="rounded-xl bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-700 disabled:opacity-50">
                Qo'shilish
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="mb-2 flex items-center gap-2 font-bold text-zinc-100">
              Ochiq xonalar <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            </h3>
            {lobbies.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500">Hozircha ochiq xona yo'q — o'zingiz oching!</p>
            ) : (
              <ul className="max-h-72 space-y-2 overflow-y-auto">
                {lobbies.map((l) => (
                  <li key={l.code} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-zinc-100">{MODE_LABEL[l.mode]} · <span className="text-zinc-400">{variantLabel(l.contentType, l.variant)}</span></div>
                      <div className="text-xs text-zinc-500">{l.host} · {l.players}/{l.maxPlayers} o'yinchi</div>
                    </div>
                    <button disabled={busy} onClick={() => act('room:join', { code: l.code })} className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-50">
                      Kirish
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isHost = room.hostId === me?.id;
  const startLocal = room.startAt ? room.startAt - offset : null;

  // ── Natija ─────────────────────────────────────────────────────────────────
  if (room.status === 'finished') {
    return <Results room={room} meId={me?.id} onBack={() => setRoom(null)} />;
  }

  // ── Lobby / poyga ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {notice && <Notice text={notice} />}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3">
        <div>
          <div className="text-xs text-zinc-500">{MODE_LABEL[room.mode]} · {variantLabel(room.contentType, room.variant)}</div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-2xl font-black tracking-[0.3em] text-zinc-100">{room.code}</span>
            <CopyBtn text={room.code} />
            {room.isPrivate && <Lock className="h-4 w-4 text-zinc-500" />}
          </div>
        </div>
        <div className="text-xs text-zinc-500">
          {room.players.length}/{room.maxPlayers} o'yinchi · {room.textLength} belgi · chegara {room.timeLimitSec} s
        </div>
        <div className="ml-auto flex gap-2">
          {room.status === 'lobby' && isHost && (
            <button disabled={busy} onClick={() => act('room:start')} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50">
              <Play className="h-4 w-4" /> Boshlash
            </button>
          )}
          <button onClick={leave} className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-red-500/50 hover:text-red-400">
            <LogOut className="h-4 w-4" /> Chiqish
          </button>
        </div>
      </div>

      <Track room={room} meId={me?.id} isHost={isHost} onTeam={(t) => act('room:team', { team: t })} onKick={(id) => act('room:kick', { userId: id })} />

      {room.status === 'lobby' ? (
        <p className="rounded-2xl border border-dashed border-zinc-800 py-6 text-center text-sm text-zinc-500">
          {isHost
            ? room.mode === 'team'
              ? 'Har ikki jamoada kamida 1 kishi bo\'lsa — "Boshlash" ni bosing. Kodni do\'stlaringizga yuboring.'
              : 'Kamida 2 o\'yinchi bo\'lsa — "Boshlash" ni bosing. Kodni do\'stlaringizga yuboring.'
            : 'Xona egasi o\'yinni boshlashini kuting…'}
          <br />Matn sanoq boshlanganda ochiladi — hammaga bir xil.
        </p>
      ) : room.text ? (
        <TypingSurface
          key={`${room.code}-${room.startAt}`}
          text={room.text}
          kind="complete"
          strict
          isCode={room.contentType === 'code'}
          startAt={startLocal}
          disabled={!active || !!room.players.find((p) => p.userId === me?.id)?.finishedAt}
          autoFocus={active}
          onProgress={(pos, c) => {
            latest.current = { pos, keys: c.totalKeys, errors: c.errors, maxCombo: c.maxCombo };
            if (pos >= (room.text?.length ?? Infinity)) sockRef.current?.emit('race:progress', latest.current);
          }}
          onFinish={() => {
            if (latest.current) sockRef.current?.emit('race:progress', latest.current);
          }}
        />
      ) : null}
      {room.status === 'running' && room.players.find((p) => p.userId === me?.id)?.finishedAt && (
        <p className="text-center text-sm text-emerald-400">Siz tugatdingiz! Boshqalar tugatishini kuting…</p>
      )}
    </div>
  );
}

function Track({
  room, meId, isHost, onTeam, onKick,
}: { room: RoomState; meId?: string; isHost: boolean; onTeam: (t: 'A' | 'B') => void; onKick: (id: string) => void }) {
  const lane = (p: RoomPlayer) => {
    const pct = room.textLength ? Math.min(100, (p.pos / room.textLength) * 100) : 0;
    const mine = p.userId === meId;
    const color = p.team === 'B' ? 'bg-sky-500' : p.team === 'A' ? 'bg-orange-500' : mine ? 'bg-orange-500' : 'bg-zinc-500';
    return (
      <li key={p.userId} className={`rounded-xl border px-3 py-2 ${mine ? 'border-orange-500/40 bg-orange-500/5' : 'border-zinc-800 bg-zinc-950'}`}>
        <div className="mb-1.5 flex items-center gap-2 text-sm">
          {p.userId === room.hostId && <Crown className="h-3.5 w-3.5 text-amber-400" />}
          <span className={`truncate font-semibold ${p.left ? 'text-zinc-600 line-through' : 'text-zinc-100'}`}>{p.fullName}{mine && ' (siz)'}</span>
          {!p.connected && !p.left && <span className="text-[10px] text-amber-400">uzildi</span>}
          {p.finishedAt && <span className="text-[10px] font-bold text-emerald-400">✓ tugatdi</span>}
          <span className="ml-auto tabular-nums text-xs text-zinc-400">{room.status === 'lobby' ? '' : `${p.wpm} wpm`}</span>
          {isHost && room.status === 'lobby' && !mine && (
            <button onClick={() => onKick(p.userId)} className="text-zinc-500 hover:text-red-400" title="Chiqarish" aria-label="Chiqarish"><X className="h-3.5 w-3.5" /></button>
          )}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
          <div className={`h-full rounded-full ${color} transition-[width] duration-200`} style={{ width: `${pct}%` }} />
        </div>
      </li>
    );
  };
  if (room.mode === 'team') {
    const col = (t: 'A' | 'B') => {
      const ps = room.players.filter((p) => p.team === t);
      const mineHere = room.players.find((p) => p.userId === meId)?.team === t;
      return (
        <div className={`rounded-2xl border p-3 ${t === 'A' ? 'border-orange-500/30' : 'border-sky-500/30'}`}>
          <div className="mb-2 flex items-center justify-between">
            <span className={`font-black ${t === 'A' ? 'text-orange-400' : 'text-sky-400'}`}>Jamoa {t}</span>
            <span className="text-xs text-zinc-500">{ps.length}/{room.maxPlayers / 2}</span>
            {room.status === 'lobby' && !mineHere && (
              <button onClick={() => onTeam(t)} className="rounded-lg bg-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-700">Shu jamoaga o'tish</button>
            )}
          </div>
          <ul className="space-y-2">{ps.map(lane)}</ul>
        </div>
      );
    };
    return <div className="grid gap-3 md:grid-cols-2">{col('A')}{col('B')}</div>;
  }
  return <ul className="space-y-2">{room.players.map(lane)}</ul>;
}

function Results({ room, meId, onBack }: { room: RoomState; meId?: string; onBack: () => void }) {
  const r = room.results;
  const mine = useMemo(() => r?.players?.find((p: any) => p.userId === meId), [r, meId]);
  if (!r || r.error) {
    return (
      <Center>
        <p className="text-sm text-red-400">{r?.error ?? 'Natija hisoblanmoqda…'}</p>
        <button onClick={onBack} className="rounded-xl bg-zinc-800 px-4 py-2 text-sm text-zinc-200">Orqaga</button>
      </Center>
    );
  }
  const won = room.mode === 'team' ? r.winnerTeam === mine?.team : mine?.place === 1;
  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border p-5 text-center ${won ? 'border-amber-500/40 bg-amber-500/10' : 'border-zinc-800 bg-zinc-900'}`}>
        <Trophy className={`mx-auto mb-2 h-10 w-10 ${won ? 'text-amber-400' : 'text-zinc-500'}`} />
        <h3 className="text-xl font-black text-zinc-100">
          {room.mode === 'team'
            ? r.winnerTeam === 'draw' ? 'Durang!' : `Jamoa ${r.winnerTeam} g'olib!`
            : won ? 'Siz g\'olibsiz! 🏆' : `Siz ${mine?.place ?? '—'}-o'rindasiz`}
        </h3>
        {room.mode === 'team' && r.teamAvg && (
          <p className="mt-1 text-sm text-zinc-400">O'rtacha tezlik: <b className="text-orange-400">A {r.teamAvg.A} wpm</b> · <b className="text-sky-400">B {r.teamAvg.B} wpm</b></p>
        )}
        {mine && (
          <p className="mt-2 text-sm text-zinc-300">
            {mine.wpm} wpm · {mine.accuracy}% aniqlik{mine.timeSec ? ` · ${mine.timeSec} s` : ''}
            {r.rated && (
              <span className={`ml-2 font-bold ${mine.delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                reyting {mine.ratingAfter} ({mine.delta >= 0 ? '+' : ''}{mine.delta})
              </span>
            )}
          </p>
        )}
        {!r.rated && <p className="mt-2 text-xs text-amber-400">Bu o'yin jang reytingiga kirmadi (shubhali natija aniqlandi).</p>}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-left text-xs text-zinc-500">
            <tr>
              <th className="px-3 py-2">O'rin</th>
              <th className="px-3 py-2">O'yinchi</th>
              {room.mode === 'team' && <th className="px-3 py-2">Jamoa</th>}
              <th className="px-3 py-2">WPM</th>
              <th className="px-3 py-2">Aniqlik</th>
              <th className="px-3 py-2">Vaqt</th>
              <th className="px-3 py-2">Reyting</th>
            </tr>
          </thead>
          <tbody>
            {r.players.map((p: any) => (
              <tr key={p.userId} className={`border-t border-zinc-800 ${p.userId === meId ? 'bg-orange-500/5' : ''}`}>
                <td className="px-3 py-2 text-lg">{medal(p.place)}</td>
                <td className="px-3 py-2 font-semibold text-zinc-100">
                  {p.fullName}
                  {p.outcome === 'left' && <span className="ml-1 text-xs text-zinc-500">(chiqib ketdi)</span>}
                  {p.outcome === 'timeout' && <span className="ml-1 text-xs text-zinc-500">(vaqt tugadi)</span>}
                  {p.flagged && <span className="ml-1 text-xs text-red-400">(shubhali)</span>}
                </td>
                {room.mode === 'team' && <td className={`px-3 py-2 font-bold ${p.team === 'A' ? 'text-orange-400' : 'text-sky-400'}`}>{p.team}</td>}
                <td className="px-3 py-2 font-bold tabular-nums text-orange-400">{p.wpm}</td>
                <td className="px-3 py-2 tabular-nums text-zinc-300">{p.accuracy}%</td>
                <td className="px-3 py-2 tabular-nums text-zinc-400">{p.timeSec ? `${p.timeSec} s` : '—'}</td>
                <td className={`px-3 py-2 tabular-nums ${p.delta > 0 ? 'text-emerald-400' : p.delta < 0 ? 'text-red-400' : 'text-zinc-500'}`}>
                  {r.rated ? `${p.ratingAfter} (${p.delta >= 0 ? '+' : ''}${p.delta})` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={onBack} className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-600">
        <Swords className="h-4 w-4" /> Yangi bellashuv
      </button>
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
      className="rounded-lg bg-zinc-800 p-1.5 text-zinc-300 hover:bg-zinc-700"
      title="Kodni nusxalash"
      aria-label="Kodni nusxalash"
    >
      {ok ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

const Center = ({ children }: { children: React.ReactNode }) => (
  <div className="flex min-h-[12rem] flex-col items-center justify-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center">{children}</div>
);
const Notice = ({ text }: { text: string }) => (
  <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-400">
    <AlertTriangle className="h-4 w-4 shrink-0" /> {text}
  </div>
);
