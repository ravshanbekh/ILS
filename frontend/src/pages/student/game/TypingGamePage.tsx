/**
 * Tez yozish — o'quvchi (/student/game/typing).
 * Tablar: Mashq · Bellashuv · Reyting · Natijalarim
 * Bellashuv tabi boshqa tabga o'tilganda ham tirik qoladi (xonadan chiqib ketmaslik uchun).
 */
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Keyboard, Swords, Trophy, BarChart3 } from 'lucide-react';
import Header from '@/components/layout/Header';
import { typingApi } from '@/api';
import SoloPractice from '@/components/typing/SoloPractice';
import Battle from '@/components/typing/Battle';
import TypingLeaderboard from '@/components/typing/TypingLeaderboard';
import TypingStats, { type TypingStatsData } from '@/components/typing/TypingStats';

type Tab = 'solo' | 'battle' | 'rating' | 'me';
const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: 'solo', label: 'Mashq', icon: Keyboard },
  { key: 'battle', label: 'Bellashuv', icon: Swords },
  { key: 'rating', label: 'Reyting', icon: Trophy },
  { key: 'me', label: 'Natijalarim', icon: BarChart3 },
];

export default function TypingGamePage() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'solo') as Tab;
  const setTab = (t: Tab) => setParams((p) => { p.set('tab', t); return p; }, { replace: true });
  const [stats, setStats] = useState<TypingStatsData | null>(null);
  const [refresh, setRefresh] = useState(0);

  const loadStats = useCallback(() => {
    typingApi.myStats().then((r) => setStats(r.data.data)).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (tab === 'me') loadStats();
  }, [tab, refresh, loadStats]);
  const onSaved = () => setRefresh((x) => x + 1);

  return (
    <div>
      <Header title="Tez yozish" subtitle="Matn va kod yozish tezligi — mashq qiling va bellashing" />
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-8">
        <div className="flex gap-1 overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                tab === t.key ? 'bg-orange-500 text-white shadow' : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>

        {tab === 'solo' && <SoloPractice onSaved={onSaved} />}
        <div className={tab === 'battle' ? '' : 'hidden'}>
          <Battle active={tab === 'battle'} onFinished={onSaved} />
        </div>
        {tab === 'rating' && <TypingLeaderboard refreshKey={refresh} />}
        {tab === 'me' && <TypingStats data={stats} />}
      </div>
    </div>
  );
}
