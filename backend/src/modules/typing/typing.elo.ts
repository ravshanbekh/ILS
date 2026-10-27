/**
 * Jang reytingi (ELO). Boshlang'ich — 1000.
 *
 *  duel  — klassik ELO, K = 32.
 *  ffa   — 4 kishilik: har juftlik alohida "duel" deb hisoblanadi, K = 32/(n−1)
 *          (n kishi bo'lsa ham bir o'yindagi jami o'zgarish duel bilan teng).
 *  team  — har o'yinchi o'z reytingi bilan raqib jamoa o'rtacha reytingiga
 *          qarshi; natija jamoaniki (g'alaba/mag'lubiyat/durang), K = 24.
 * Chiqib ketgan o'yinchi — oxirgi o'rin.
 */
export const START_RATING = 1000;

const expected = (a: number, b: number) => 1 / (1 + Math.pow(10, (b - a) / 400));

export interface EloPlayer {
  userId: string;
  rating: number;
  /** 1 — birinchi o'rin; teng o'rin = durang */
  place: number;
  team?: 'A' | 'B' | null;
}

export function eloDeltas(
  mode: 'duel' | 'ffa' | 'team',
  players: EloPlayer[],
  winnerTeam?: 'A' | 'B' | 'draw' | null
): Map<string, number> {
  const out = new Map<string, number>();
  if (players.length < 2) return out;

  if (mode === 'team') {
    const avg = (t: 'A' | 'B') => {
      const xs = players.filter((p) => p.team === t).map((p) => p.rating);
      return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : START_RATING;
    };
    for (const p of players) {
      if (p.team !== 'A' && p.team !== 'B') continue;
      const opp = avg(p.team === 'A' ? 'B' : 'A');
      const s = winnerTeam === 'draw' ? 0.5 : winnerTeam === p.team ? 1 : 0;
      out.set(p.userId, Math.round(24 * (s - expected(p.rating, opp))));
    }
    return out;
  }

  const k = mode === 'duel' ? 32 : 32 / (players.length - 1);
  for (const p of players) {
    let d = 0;
    for (const q of players) {
      if (q.userId === p.userId) continue;
      const s = p.place < q.place ? 1 : p.place === q.place ? 0.5 : 0;
      d += k * (s - expected(p.rating, q.rating));
    }
    out.set(p.userId, Math.round(d));
  }
  return out;
}
