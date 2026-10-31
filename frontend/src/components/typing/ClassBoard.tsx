/**
 * Sinf musobaqasi — jonli taxta va natija (o'quvchi ham, mentor ham ko'radi).
 * O'quvchilar soni o'nlab bo'lishi mumkin: ro'yxat ixcham, o'quvchiga esa
 * eng yaxshi 10 talik + o'z qatori ko'rsatiladi.
 */
import { useMemo } from 'react';
import { CheckCircle2, Trophy, UserX, WifiOff, X, AlertTriangle } from 'lucide-react';
import { liveOrder, type RoomResultPlayer, type RoomState } from './typingRoom';
import { medal } from './typingUi';

/** Lobby: kirganlar "chip" ko'rinishida */
export function ClassLobby({ room, meId, onKick }: { room: RoomState; meId?: string; onKick?: (userId: string) => void }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="font-bold text-zinc-100">Kirganlar</h3>
        <span className="text-sm tabular-nums text-zinc-400">
          <b className="text-2xl font-black text-orange-400">{room.players.length}</b> o'quvchi
        </span>
      </div>
      {room.players.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">Hali hech kim kirmadi — kodni o'quvchilarga ko'rsating</p>
      ) : (
        <ul className="flex max-h-[22rem] flex-wrap gap-2 overflow-y-auto">
          {room.players.map((p) => (
            <li
              key={p.userId}
              className={`ils-chip-in inline-flex items-center gap-1.5 rounded-full border py-1 pl-3 text-sm ${onKick ? 'pr-1' : 'pr-3'} ${
                p.userId === meId ? 'border-orange-500/50 bg-orange-500/10 text-orange-300' : 'border-zinc-700 bg-zinc-950 text-zinc-200'
              }`}
            >
              {!p.connected && <WifiOff className="h-3.5 w-3.5 text-amber-400" aria-label="uzildi" />}
              {p.fullName}
              {p.userId === meId && <span className="text-xs text-orange-400">(siz)</span>}
              {onKick && (
                <button onClick={() => onKick(p.userId)} className="rounded-full p-1 text-zinc-500 hover:bg-red-500/15 hover:text-red-400" title="Chiqarish" aria-label={`${p.fullName} ni chiqarish`}>
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Poyga: jonli o'rinlar */
export function ClassBoard({ room, meId, compact = false }: { room: RoomState; meId?: string; compact?: boolean }) {
  const ordered = useMemo(() => liveOrder(room.players), [room.players]);
  const myIdx = meId ? ordered.findIndex((p) => p.userId === meId) : -1;
  const shown = compact ? ordered.slice(0, 10) : ordered;
  const extra = compact && myIdx >= 10 ? ordered[myIdx] : null;
  const done = room.players.filter((p) => p.finishedAt).length;

  const row = (p: (typeof ordered)[number], idx: number) => {
    const pct = room.textLength ? Math.min(100, (p.pos / room.textLength) * 100) : 0;
    const mine = p.userId === meId;
    return (
      <li
        key={p.userId}
        className={`grid grid-cols-[2rem_minmax(0,1fr)_4.5rem] items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-2 sm:grid-cols-[2rem_minmax(8rem,14rem)_minmax(0,1fr)_4.5rem] ${
          mine ? 'border-orange-500/50 bg-orange-500/10' : 'border-zinc-800 bg-zinc-950'
        }`}
      >
        <span className="text-center text-base font-black tabular-nums text-zinc-400">{p.finishedAt && idx < 3 ? medal(idx + 1) : idx + 1}</span>
        <span className={`truncate text-sm font-semibold ${p.left ? 'text-zinc-600 line-through' : 'text-zinc-100'}`}>
          {p.fullName}
          {mine && <span className="ml-1 text-xs text-orange-400">(siz)</span>}
          {!p.connected && !p.left && <WifiOff className="ml-1 inline h-3 w-3 text-amber-400" aria-label="uzildi" />}
        </span>
        <span className="col-span-3 row-start-2 h-2 overflow-hidden rounded-full bg-zinc-800 sm:col-span-1 sm:col-start-3 sm:row-start-1">
          <span
            className={`block h-full rounded-full transition-[width] duration-500 ${p.finishedAt ? 'bg-emerald-500' : mine ? 'bg-orange-500' : 'bg-zinc-500'}`}
            style={{ width: `${pct}%` }}
          />
        </span>
        <span className="col-start-3 row-start-1 text-right text-xs tabular-nums sm:col-start-4">
          {p.finishedAt ? (
            <span className="inline-flex items-center gap-1 font-bold text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" />{p.wpm}</span>
          ) : p.left ? (
            <span className="inline-flex items-center gap-1 text-zinc-600"><UserX className="h-3.5 w-3.5" />chiqdi</span>
          ) : (
            <span className="text-zinc-300">{room.status === 'running' ? `${p.wpm} wpm` : `${Math.round(pct)}%`}</span>
          )}
        </span>
      </li>
    );
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2 text-sm">
        <h3 className="font-bold text-zinc-100">Jonli o'rinlar</h3>
        <span className="tabular-nums text-zinc-400">
          <b className="text-emerald-400">{done}</b> / {room.players.length} tugatdi
        </span>
      </div>
      <ol className={`space-y-1.5 ${compact ? '' : 'max-h-[60vh] overflow-y-auto pr-1'}`}>
        {shown.map((p, i) => row(p, i))}
        {extra && (
          <>
            <li className="py-0.5 text-center text-xs text-zinc-600">⋯</li>
            {row(extra, myIdx)}
          </>
        )}
      </ol>
    </div>
  );
}

/** Natija: shohsupa (1–3) + to'liq jadval */
export function ClassResults({ players, meId, textLength, actions }: { players: RoomResultPlayer[]; meId?: string; textLength?: number; actions?: React.ReactNode }) {
  const mine = players.find((p) => p.userId === meId);
  const podium = players.filter((p) => p.place <= 3 && p.outcome === 'finished').slice(0, 3);
  const order = [podium[1], podium[0], podium[2]]; // 2 · 1 · 3
  const heights = ['h-20', 'h-28', 'h-14'];
  const counted = players.filter((p) => p.outcome !== 'left');
  const avgWpm = counted.length ? Math.round(counted.reduce((s, p) => s + p.wpm, 0) / counted.length) : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-transparent p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-xl font-black text-zinc-100"><Trophy className="h-6 w-6 text-amber-400" /> Musobaqa yakunlandi</h3>
            <p className="mt-1 text-sm text-zinc-400">
              {players.length} ishtirokchi · {players.filter((p) => p.outcome === 'finished').length} tasi oxirigacha yozdi · o'rtacha {avgWpm} wpm
            </p>
            {mine && (
              <p className="mt-2 text-base text-zinc-200">
                Siz <b className="text-orange-400">{mine.place}-o'rin</b>
                <span className="text-zinc-400"> ({players.length} kishidan)</span> — {mine.wpm} wpm · {mine.accuracy}% aniqlik
              </p>
            )}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
        {podium.length > 0 && (
          <div className="mx-auto mt-5 grid max-w-xl grid-cols-3 items-end gap-2 sm:gap-4">
            {order.map((p, i) =>
              p ? (
                <div key={p.userId} className="flex min-w-0 flex-col items-center text-center">
                  <span className="text-3xl">{medal(p.place)}</span>
                  <span className={`mt-1 w-full truncate text-sm font-bold ${p.userId === meId ? 'text-orange-300' : 'text-zinc-100'}`}>{p.fullName}</span>
                  <span className="text-xs tabular-nums text-orange-400">{p.wpm} wpm · {p.accuracy}%</span>
                  <div className={`mt-2 w-full rounded-t-xl ${heights[i]} ${i === 1 ? 'bg-amber-400/30' : i === 0 ? 'bg-zinc-400/20' : 'bg-orange-700/25'} border border-b-0 border-zinc-700/50`} />
                </div>
              ) : (
                <div key={i} />
              )
            )}
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-left text-xs text-zinc-500">
            <tr>
              <th className="px-3 py-2">O'rin</th>
              <th className="px-3 py-2">O'quvchi</th>
              <th className="px-3 py-2">WPM</th>
              <th className="px-3 py-2">Aniqlik</th>
              <th className="hidden px-3 py-2 sm:table-cell">Yozgani</th>
              <th className="px-3 py-2">Vaqt</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.userId} className={`border-t border-zinc-800 ${p.userId === meId ? 'bg-orange-500/10' : ''}`}>
                <td className="px-3 py-2 text-base">{medal(p.place)}</td>
                <td className="px-3 py-2 font-semibold text-zinc-100">
                  {p.fullName}
                  {p.outcome === 'left' && <span className="ml-1 text-xs font-normal text-zinc-500">(chiqib ketdi)</span>}
                  {p.outcome === 'timeout' && <span className="ml-1 text-xs font-normal text-zinc-500">(tugatmadi)</span>}
                  {p.flagged && <span className="ml-1 inline-flex items-center gap-0.5 text-xs font-normal text-red-400"><AlertTriangle className="h-3 w-3" />shubhali</span>}
                </td>
                <td className="px-3 py-2 font-bold tabular-nums text-orange-400">{p.wpm}</td>
                <td className="px-3 py-2 tabular-nums text-zinc-300">{p.accuracy}%</td>
                <td className="hidden px-3 py-2 tabular-nums text-zinc-400 sm:table-cell">
                  {textLength && p.progress != null ? `${Math.min(100, Math.round((p.progress / textLength) * 100))}%` : '—'}
                </td>
                <td className="px-3 py-2 tabular-nums text-zinc-400">{p.timeSec ? `${p.timeSec} s` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">Sinf musobaqasi jang reytingiga (ELO) ta'sir qilmaydi — natijalar tezlik reytingi va tarixga yoziladi.</p>
    </div>
  );
}
