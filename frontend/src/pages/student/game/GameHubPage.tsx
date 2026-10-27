/** O'yinlar markazi — o'quvchi paneli (/student/game) */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Keyboard, Swords, Trophy, Sparkles } from 'lucide-react';
import Header from '@/components/layout/Header';
import { typingApi } from '@/api';

export default function GameHubPage() {
  const [s, setS] = useState<{ avgWpm: number; rating: { rating: number }; totalTests: number } | null>(null);
  useEffect(() => {
    typingApi.myStats().then((r) => setS(r.data.data)).catch(() => setS(null));
  }, []);
  return (
    <div>
      <Header title="O'yinlar" subtitle="O'ynab o'rganing — tezlik, aniqlik va do'stlar bilan bellashuv" />
      <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-8">
        <Link
          to="/student/game/typing"
          className="group block overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-orange-500/15 via-zinc-900 to-zinc-900 p-6 transition-colors hover:border-orange-500/50"
        >
          <div className="flex flex-wrap items-start gap-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/30">
              <Keyboard className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-black text-zinc-100">Tez yozish</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Matn va dasturlash kodini tez yozish mashqi. Duel, 4 kishilik va jamoaviy bellashuvlar, 3 xil reyting.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="inline-flex items-center gap-1 rounded-full bg-zinc-950 px-2.5 py-1 text-zinc-300"><Sparkles className="h-3.5 w-3.5 text-orange-400" /> Mashq: matn va 15 ta til</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-zinc-950 px-2.5 py-1 text-zinc-300"><Swords className="h-3.5 w-3.5 text-orange-400" /> Duel · 4 kishilik · Jamoaviy</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-zinc-950 px-2.5 py-1 text-zinc-300"><Trophy className="h-3.5 w-3.5 text-orange-400" /> Reyting</span>
              </div>
            </div>
            {s && (
              <div className="grid grid-cols-3 gap-2 text-center">
                <Mini v={s.avgWpm} l="o'rt. wpm" />
                <Mini v={s.rating.rating} l="reyting" />
                <Mini v={s.totalTests} l="test" />
              </div>
            )}
          </div>
          <div className="mt-5 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white group-hover:bg-orange-600">
            O'ynash →
          </div>
        </Link>
        <div className="rounded-3xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">
          Yangi o'yinlar tez orada qo'shiladi.
        </div>
      </div>
    </div>
  );
}

const Mini = ({ v, l }: { v: number; l: string }) => (
  <div className="rounded-xl bg-zinc-950 px-3 py-2">
    <div className="text-xl font-black tabular-nums text-zinc-100">{v}</div>
    <div className="text-[10px] text-zinc-500">{l}</div>
  </div>
);
