/**
 * "Tez yozish" — natijalar, mashq sessiyalari, reytinglar, admin ko'rinishi.
 *
 * HALOLLIK (reyting buzilmasligi uchun):
 *  - Matnni server beradi (startSolo / bellashuv xonasi).
 *  - Mijoz faqat sanoqlarni yuboradi: to'g'ri belgilar, bosishlar, xatolar.
 *    WPM ni SERVER hisoblaydi; vaqt server oynasi bilan cheklanadi
 *    (sessiya berilgan paytdan hozirgacha o'tgan vaqtdan uzoq bo'lolmaydi).
 *  - Odamdan tez natija (> MAX_HUMAN_WPM) yoki imkonsiz sanoq "flagged" —
 *    saqlanadi, admin ko'radi, lekin reytingga kirmaydi.
 */
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { ApiError } from '../../shared/middleware/errorHandler';
import { generateText, pickCode, TextSource, CODE_LANGS } from './typing.content';
import { eloDeltas, START_RATING, EloPlayer } from './typing.elo';

export const MAX_HUMAN_WPM = 220;
/** Bir soniyada bosish mumkin bo'lgan eng ko'p belgi (≈ 300 wpm) */
export const MAX_CPS = 25;
export const MIN_LEADERBOARD_ACCURACY = 85;
export const TEXT_DURATIONS = [15, 30, 60, 120] as const;

export type Mode = 'solo' | 'duel' | 'ffa' | 'team' | 'class';
export type ContentType = 'text' | 'code';

export interface RawCounts {
  correctChars: number;
  totalKeys: number;
  errors: number;
  maxCombo: number;
}

/** WPM = (to'g'ri belgilar / 5) / daqiqa — CodeType bilan bir xil formula */
export function computeMetrics(c: RawCounts, elapsedMs: number) {
  const min = Math.max(elapsedMs, 1) / 60000;
  const wpm = Math.round(c.correctChars / 5 / min);
  const rawWpm = Math.round(c.totalKeys / 5 / min);
  const accuracy = c.totalKeys > 0 ? Math.round((c.correctChars / c.totalKeys) * 100) : 0;
  return { wpm, rawWpm, accuracy: Math.max(0, Math.min(100, accuracy)) };
}

function sanitizeCounts(raw: any): RawCounts {
  const int = (v: unknown, max: number) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
  };
  return {
    correctChars: int(raw?.correctChars, 100_000),
    totalKeys: int(raw?.totalKeys, 200_000),
    errors: int(raw?.errors, 100_000),
    maxCombo: int(raw?.maxCombo, 100_000),
  };
}

// ── Mashq sessiyalari (xotirada, 20 daqiqa) ──────────────────────────────────

interface SoloSession {
  id: string;
  userId: string;
  contentType: ContentType;
  variant: string;
  durationSec: number; // matn: tanlangan vaqt; kod: 0 (oxirigacha)
  text: string;
  issuedAt: number;
}

const SESSION_TTL_MS = 20 * 60 * 1000;
const sessions = new Map<string, SoloSession>();

function gcSessions() {
  const now = Date.now();
  for (const [k, s] of sessions) if (now - s.issuedAt > SESSION_TTL_MS) sessions.delete(k);
}

export function startSolo(
  userId: string,
  opts: { contentType: ContentType; variant?: string; durationSec?: number; punctuation?: boolean; numbers?: boolean }
) {
  gcSessions();
  // Bir o'quvchida bir vaqtning o'zida ko'pi bilan 5 ta ochiq sessiya
  const mine = [...sessions.values()].filter((s) => s.userId === userId).sort((a, b) => a.issuedAt - b.issuedAt);
  while (mine.length >= 5) sessions.delete(mine.shift()!.id);

  let s: SoloSession;
  if (opts.contentType === 'code') {
    const { lang, text } = pickCode(opts.variant ?? 'Tasodifiy');
    s = { id: crypto.randomUUID(), userId, contentType: 'code', variant: lang, durationSec: 0, text, issuedAt: Date.now() };
  } else {
    const src = (['en', 'uz', 'tech'].includes(opts.variant ?? '') ? opts.variant : 'en') as TextSource;
    const durationSec = TEXT_DURATIONS.includes(opts.durationSec as any) ? (opts.durationSec as number) : 30;
    // Yetarli so'z: 220 wpm × vaqt (mijozga qayta so'rov kerak bo'lmasin)
    const words = Math.max(80, Math.ceil((durationSec / 60) * 230));
    const text = generateText(src, words, { punctuation: !!opts.punctuation, numbers: !!opts.numbers });
    s = { id: crypto.randomUUID(), userId, contentType: 'text', variant: src, durationSec, text, issuedAt: Date.now() };
  }
  sessions.set(s.id, s);
  return { sessionId: s.id, contentType: s.contentType, variant: s.variant, durationSec: s.durationSec, text: s.text };
}

export async function finishSolo(userId: string, sessionId: string, rawCounts: unknown, clientElapsedMs: unknown) {
  const s = sessions.get(String(sessionId));
  if (!s || s.userId !== userId) throw ApiError.badRequest('Mashq sessiyasi topilmadi yoki eskirgan — qaytadan boshlang');
  sessions.delete(s.id); // bir martalik

  const c = sanitizeCounts(rawCounts);
  const serverWindow = Date.now() - s.issuedAt + 1500; // tarmoq kechikishi uchun zaxira
  let elapsed = Math.floor(Number(clientElapsedMs));
  if (!Number.isFinite(elapsed) || elapsed <= 0) throw ApiError.badRequest('Vaqt noto\'g\'ri');

  const flags: string[] = [];
  if (elapsed > serverWindow) elapsed = serverWindow; // mijoz vaqtni cho'za olmaydi
  if (s.contentType === 'text') {
    // Vaqtli rejim: tanlangan vaqtdan oldin tugash mumkin emas (taymer oxirida tugaydi)
    if (serverWindow < s.durationSec * 1000 - 500) flags.push('vaqt tugashidan oldin yuborildi');
    elapsed = s.durationSec * 1000;
  }
  if (c.correctChars > s.text.length) flags.push('matndan uzun');
  if (c.correctChars > c.totalKeys) flags.push('to\'g\'ri belgi bosishlardan ko\'p');
  if (c.totalKeys > (elapsed / 1000) * MAX_CPS + 20) flags.push('bosish tezligi imkonsiz');

  const m = computeMetrics(c, elapsed);
  if (m.wpm > MAX_HUMAN_WPM) flags.push(`${m.wpm} wpm — odam uchun juda tez`);
  if (s.contentType === 'code' && c.correctChars < s.text.replace(/^ +/gm, '').length * 0.95) {
    flags.push('kod oxirigacha yozilmagan');
  }

  const result = await prisma.typingResult.create({
    data: {
      userId,
      mode: 'solo',
      contentType: s.contentType,
      variant: s.variant,
      durationSec: s.contentType === 'text' ? s.durationSec : Math.round(elapsed / 1000),
      ...m,
      ...c,
      flagged: flags.length > 0,
      flagReason: flags.length ? flags.join('; ').slice(0, 200) : null,
    },
  });

  // Shaxsiy rekord (shu turdagi, tekshiruvdan o'tgan)
  const bestWhere: Prisma.TypingResultWhereInput = {
    userId,
    contentType: s.contentType,
    flagged: false,
    id: { not: result.id },
    ...(s.contentType === 'text' ? { durationSec: s.durationSec, variant: s.variant } : { variant: s.variant }),
  };
  const prev = await prisma.typingResult.findFirst({ where: bestWhere, orderBy: { wpm: 'desc' }, select: { wpm: true } });
  return {
    result: {
      id: result.id,
      wpm: result.wpm,
      rawWpm: result.rawWpm,
      accuracy: result.accuracy,
      errors: result.errors,
      maxCombo: result.maxCombo,
      durationSec: result.durationSec,
      flagged: result.flagged,
      flagReason: result.flagReason,
    },
    previousBest: prev?.wpm ?? null,
    isRecord: !result.flagged && (prev ? result.wpm > prev.wpm : true),
  };
}

// ── Reytinglar ───────────────────────────────────────────────────────────────

export type Category = 'text' | 'code' | 'battle';
export type Period = 'week' | 'month' | 'all';

const sinceOf = (p: Period) =>
  p === 'week' ? new Date(Date.now() - 7 * 86400_000) : p === 'month' ? new Date(Date.now() - 30 * 86400_000) : null;

async function groupsOf(userIds: string[]) {
  if (!userIds.length) return new Map<string, string[]>();
  const gs = await prisma.groupStudent.findMany({
    where: { studentId: { in: userIds }, group: { isActive: true } },
    select: { studentId: true, group: { select: { name: true } } },
  });
  const m = new Map<string, string[]>();
  for (const g of gs) m.set(g.studentId, [...(m.get(g.studentId) ?? []), g.group.name]);
  return m;
}

export async function leaderboard(opts: { category: Category; period: Period; groupId?: string; limit?: number; meId?: string }) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const groupFilter = opts.groupId
    ? Prisma.sql`AND EXISTS (SELECT 1 FROM group_students gs WHERE gs.student_id = u.id AND gs.group_id = ${opts.groupId}::uuid)`
    : Prisma.empty;

  let rows: { userId: string; fullName: string; value: number; accuracy: number | null; detail: string | null; extra: number | null; at: Date | null }[];

  if (opts.category === 'battle') {
    const r = await prisma.$queryRaw<any[]>`
      SELECT t.user_id AS "userId", u.full_name AS "fullName", t.rating AS value, NULL::int AS accuracy,
             (t.wins || 'G · ' || t.losses || 'M · ' || t.draws || 'D') AS detail, t.matches AS extra, t.updated_at AS at
      FROM typing_ratings t JOIN users u ON u.id = t.user_id
      WHERE t.matches > 0 AND u.role = 'student' AND u.is_active = true ${groupFilter}
      ORDER BY t.rating DESC, t.wins DESC, t.updated_at ASC`;
    rows = r;
  } else {
    const since = sinceOf(opts.period);
    const sinceFilter = since ? Prisma.sql`AND r.created_at >= ${since}` : Prisma.empty;
    const r = await prisma.$queryRaw<any[]>`
      SELECT * FROM (
        SELECT DISTINCT ON (r.user_id) r.user_id AS "userId", u.full_name AS "fullName", r.wpm AS value,
               r.accuracy, r.variant AS detail, r.duration_sec AS extra, r.created_at AS at
        FROM typing_results r JOIN users u ON u.id = r.user_id
        WHERE r.content_type = ${opts.category} AND r.flagged = false
          AND r.accuracy >= ${MIN_LEADERBOARD_ACCURACY}
          AND u.role = 'student' AND u.is_active = true ${sinceFilter} ${groupFilter}
        ORDER BY r.user_id, r.wpm DESC, r.accuracy DESC, r.created_at ASC
      ) b ORDER BY value DESC, accuracy DESC, at ASC`;
    rows = r;
  }

  const ranked = rows.map((r, i) => ({ ...r, rank: i + 1, value: Number(r.value), extra: r.extra == null ? null : Number(r.extra) }));
  const top = ranked.slice(0, limit);
  const me = opts.meId ? ranked.find((r) => r.userId === opts.meId) ?? null : null;
  const groups = await groupsOf([...new Set([...top.map((r) => r.userId), ...(me ? [me.userId] : [])])]);
  const withGroups = (r: (typeof ranked)[number]) => ({ ...r, groups: groups.get(r.userId) ?? [] });
  return { category: opts.category, period: opts.category === 'battle' ? 'all' : opts.period, total: ranked.length, top: top.map(withGroups), me: me ? withGroups(me) : null };
}

// ── Shaxsiy statistika ───────────────────────────────────────────────────────

export async function myStats(userId: string) {
  const [count, agg, bestText, bestCode, recent, rating, matchCount] = await Promise.all([
    prisma.typingResult.count({ where: { userId } }),
    prisma.typingResult.aggregate({ where: { userId, flagged: false }, _avg: { wpm: true, accuracy: true }, _max: { maxCombo: true } }),
    prisma.typingResult.groupBy({
      by: ['durationSec'],
      where: { userId, contentType: 'text', flagged: false, mode: 'solo' },
      _max: { wpm: true },
    }),
    prisma.typingResult.findFirst({ where: { userId, contentType: 'code', flagged: false }, orderBy: { wpm: 'desc' }, select: { wpm: true, variant: true, accuracy: true } }),
    prisma.typingResult.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, mode: true, contentType: true, variant: true, durationSec: true, wpm: true, accuracy: true, errors: true, place: true, flagged: true, createdAt: true },
    }),
    prisma.typingRating.findUnique({ where: { userId } }),
    prisma.typingMatchPlayer.count({ where: { userId } }),
  ]);
  return {
    totalTests: count,
    battles: matchCount,
    avgWpm: agg._avg.wpm ? Math.round(agg._avg.wpm) : 0,
    avgAccuracy: agg._avg.accuracy ? Math.round(agg._avg.accuracy) : 0,
    bestCombo: agg._max.maxCombo ?? 0,
    bestTextByDuration: Object.fromEntries(bestText.map((b) => [b.durationSec, b._max.wpm ?? 0])),
    bestCode: bestCode ?? null,
    rating: rating ? { rating: rating.rating, wins: rating.wins, losses: rating.losses, draws: rating.draws, matches: rating.matches } : { rating: START_RATING, wins: 0, losses: 0, draws: 0, matches: 0 },
    recent,
  };
}

// ── Bellashuv natijasini saqlash (typing.rooms.ts chaqiradi) ─────────────────

export interface FinishedPlayer {
  userId: string;
  team: 'A' | 'B' | null;
  place: number;
  progress: number;
  finished: boolean;
  outcome: 'finished' | 'timeout' | 'left';
  finishedAt: Date | null;
  counts: RawCounts;
  elapsedMs: number;
  flagged: string[];
}

export async function persistMatch(m: {
  code: string;
  mode: 'duel' | 'ffa' | 'team' | 'class';
  title?: string | null;
  contentType: ContentType;
  variant: string;
  text: string;
  hostId: string;
  timeLimitSec: number;
  startedAt: Date;
  finishedAt: Date;
  winnerTeam: 'A' | 'B' | 'draw' | null;
  players: FinishedPlayer[];
}) {
  const ratings = await prisma.typingRating.findMany({ where: { userId: { in: m.players.map((p) => p.userId) } } });
  const rmap = new Map(ratings.map((r) => [r.userId, r.rating]));
  // Reyting faqat haqiqiy raqobatda: kamida 2 kishi va hech kim "shubhali" emas.
  // Sinf musobaqasi (mentor o'tkazadi, o'nlab o'quvchi) jang reytingiga ta'sir qilmaydi —
  // natijasi esa tezlik reytinglariga (matn/kod) odatdagidek kiradi.
  const rated = m.mode !== 'class' && m.players.length >= 2 && m.players.every((p) => p.flagged.length === 0);
  const elo: EloPlayer[] = m.players.map((p) => ({ userId: p.userId, rating: rmap.get(p.userId) ?? START_RATING, place: p.place, team: p.team }));
  const deltas = rated ? eloDeltas(m.mode as 'duel' | 'ffa' | 'team', elo, m.winnerTeam) : new Map<string, number>();

  // Sinf musobaqasida 100+ o'quvchi bo'lishi mumkin — yozuvlar createMany bilan,
  // tranzaksiya vaqti ham uzaytirilgan (standart 5 s yetmasligi mumkin)
  return prisma.$transaction(async (tx) => {
    const match = await tx.typingMatch.create({
      data: {
        code: m.code,
        mode: m.mode,
        title: m.title ?? null,
        contentType: m.contentType,
        variant: m.variant,
        text: m.text,
        hostId: m.hostId,
        timeLimitSec: m.timeLimitSec,
        status: 'finished',
        winnerTeam: m.winnerTeam,
        startedAt: m.startedAt,
        finishedAt: m.finishedAt,
      },
    });
    const out: { userId: string; wpm: number; accuracy: number; ratingBefore: number; ratingAfter: number; delta: number }[] = [];
    const playerRows: Prisma.TypingMatchPlayerCreateManyInput[] = [];
    const resultRows: Prisma.TypingResultCreateManyInput[] = [];
    for (const p of m.players) {
      const metrics = computeMetrics(p.counts, p.elapsedMs);
      const before = rmap.get(p.userId) ?? START_RATING;
      const delta = deltas.get(p.userId) ?? 0;
      const after = before + delta;
      playerRows.push({
        matchId: match.id,
        userId: p.userId,
        team: p.team,
        place: p.place,
        wpm: metrics.wpm,
        accuracy: metrics.accuracy,
        progress: p.progress,
        finished: p.finished,
        outcome: p.outcome,
        ratingBefore: rated ? before : null,
        ratingAfter: rated ? after : null,
        finishedAt: p.finishedAt,
      });
      if (p.outcome !== 'left' || p.counts.correctChars > 0) {
        resultRows.push({
          userId: p.userId,
          mode: m.mode,
          contentType: m.contentType,
          variant: m.variant,
          durationSec: Math.round(p.elapsedMs / 1000),
          ...metrics,
          ...p.counts,
          place: p.place,
          matchId: match.id,
          // Bellashuvdagi haqiqiy tezlik ham tezlik reytingiga kiradi (mode hisobga olinmaydi)
          flagged: p.flagged.length > 0,
          flagReason: p.flagged.length ? p.flagged.join('; ').slice(0, 200) : null,
        });
      }
      if (rated) {
        const won =
          m.mode === 'team' ? m.winnerTeam === p.team : p.place === 1 && m.players.filter((x) => x.place === 1).length === 1;
        const draw = m.mode === 'team' ? m.winnerTeam === 'draw' : p.place === 1 && !won;
        await tx.typingRating.upsert({
          where: { userId: p.userId },
          create: { userId: p.userId, rating: after, matches: 1, wins: won ? 1 : 0, draws: draw ? 1 : 0, losses: !won && !draw ? 1 : 0 },
          update: {
            rating: after,
            matches: { increment: 1 },
            wins: { increment: won ? 1 : 0 },
            draws: { increment: draw ? 1 : 0 },
            losses: { increment: !won && !draw ? 1 : 0 },
          },
        });
      }
      out.push({ userId: p.userId, wpm: metrics.wpm, accuracy: metrics.accuracy, ratingBefore: before, ratingAfter: rated ? after : before, delta: rated ? delta : 0 });
    }
    if (playerRows.length) await tx.typingMatchPlayer.createMany({ data: playerRows });
    if (resultRows.length) await tx.typingResult.createMany({ data: resultRows });
    return { matchId: match.id, rated, players: out };
  }, { timeout: 30_000, maxWait: 10_000 });
}

// ── Admin ────────────────────────────────────────────────────────────────────

export async function adminOverview() {
  const d1 = new Date(Date.now() - 86400_000);
  const d7 = new Date(Date.now() - 7 * 86400_000);
  const [tests24, tests7, players7, matches7, avg7, flagged7, topToday] = await Promise.all([
    prisma.typingResult.count({ where: { createdAt: { gte: d1 } } }),
    prisma.typingResult.count({ where: { createdAt: { gte: d7 } } }),
    prisma.typingResult.groupBy({ by: ['userId'], where: { createdAt: { gte: d7 } } }).then((r) => r.length),
    prisma.typingMatch.groupBy({ by: ['mode'], where: { createdAt: { gte: d7 } }, _count: true }),
    prisma.typingResult.aggregate({ where: { createdAt: { gte: d7 }, flagged: false }, _avg: { wpm: true, accuracy: true } }),
    prisma.typingResult.count({ where: { createdAt: { gte: d7 }, flagged: true } }),
    prisma.typingResult.findFirst({
      where: { createdAt: { gte: d1 }, flagged: false },
      orderBy: { wpm: 'desc' },
      select: { wpm: true, accuracy: true, contentType: true, user: { select: { fullName: true } } },
    }),
  ]);
  return {
    testsLast24h: tests24,
    testsLast7d: tests7,
    activePlayers7d: players7,
    matches7d: Object.fromEntries(matches7.map((m) => [m.mode, m._count])),
    avgWpm7d: avg7._avg.wpm ? Math.round(avg7._avg.wpm) : 0,
    avgAccuracy7d: avg7._avg.accuracy ? Math.round(avg7._avg.accuracy) : 0,
    flagged7d: flagged7,
    topToday: topToday ? { fullName: topToday.user.fullName, wpm: topToday.wpm, accuracy: topToday.accuracy, contentType: topToday.contentType } : null,
  };
}

export async function adminResults(f: {
  userId?: string;
  groupId?: string;
  mode?: string;
  contentType?: string;
  flagged?: boolean;
  search?: string;
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
}) {
  const where: Prisma.TypingResultWhereInput = {
    ...(f.userId && { userId: f.userId }),
    ...(f.mode && { mode: f.mode }),
    ...(f.contentType && { contentType: f.contentType }),
    ...(f.flagged !== undefined && { flagged: f.flagged }),
    ...((f.from || f.to) && { createdAt: { ...(f.from && { gte: f.from }), ...(f.to && { lt: f.to }) } }),
    ...((f.groupId || f.search) && {
      user: {
        ...(f.groupId && { groupStudents: { some: { groupId: f.groupId } } }),
        ...(f.search && { fullName: { contains: f.search, mode: 'insensitive' as const } }),
      },
    }),
  };
  const [total, items] = await Promise.all([
    prisma.typingResult.count({ where }),
    prisma.typingResult.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (f.page - 1) * f.limit,
      take: f.limit,
      include: { user: { select: { id: true, fullName: true, login: true } } },
    }),
  ]);
  const groups = await groupsOf([...new Set(items.map((i) => i.userId))]);
  return { total, page: f.page, limit: f.limit, items: items.map((i) => ({ ...i, groups: groups.get(i.userId) ?? [] })) };
}

export async function adminMatches(f: { mode?: string; page: number; limit: number }) {
  const where: Prisma.TypingMatchWhereInput = { ...(f.mode && { mode: f.mode }) };
  const [total, items] = await Promise.all([
    prisma.typingMatch.count({ where }),
    prisma.typingMatch.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (f.page - 1) * f.limit,
      take: f.limit,
      select: {
        id: true, code: true, mode: true, title: true, contentType: true, variant: true, status: true, winnerTeam: true,
        startedAt: true, finishedAt: true, createdAt: true, timeLimitSec: true,
        host: { select: { fullName: true } },
        players: {
          orderBy: [{ place: 'asc' }],
          select: {
            place: true, team: true, wpm: true, accuracy: true, finished: true, outcome: true, ratingBefore: true, ratingAfter: true,
            user: { select: { id: true, fullName: true } },
          },
        },
      },
    }),
  ]);
  return { total, page: f.page, limit: f.limit, items };
}

export async function matchDetail(id: string) {
  const m = await prisma.typingMatch.findUnique({
    where: { id },
    include: {
      host: { select: { fullName: true } },
      players: { orderBy: { place: 'asc' }, include: { user: { select: { id: true, fullName: true, login: true } } } },
      results: { select: { userId: true, rawWpm: true, errors: true, maxCombo: true, totalKeys: true, correctChars: true, flagged: true, flagReason: true } },
    },
  });
  if (!m) throw ApiError.notFound('O\'yin topilmadi');
  return m;
}

// ── Sinf musobaqasi (mentor) ─────────────────────────────────────────────────

/** Mentor faqat o'zi o'tkazgan musobaqalarni ko'radi, admin — hammasini */
const classScope = (viewer: { userId: string; role: string }): Prisma.TypingMatchWhereInput =>
  viewer.role === 'admin' ? { mode: 'class' } : { mode: 'class', hostId: viewer.userId };

export async function classMatches(viewer: { userId: string; role: string }, f: { page: number; limit: number }) {
  const where = classScope(viewer);
  const [total, items] = await Promise.all([
    prisma.typingMatch.count({ where }),
    prisma.typingMatch.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (f.page - 1) * f.limit,
      take: f.limit,
      select: {
        id: true, code: true, title: true, contentType: true, variant: true, timeLimitSec: true,
        startedAt: true, finishedAt: true, createdAt: true,
        host: { select: { fullName: true } },
        players: { orderBy: [{ place: 'asc' }], select: { place: true, wpm: true, accuracy: true, finished: true, outcome: true, user: { select: { fullName: true } } } },
      },
    }),
  ]);
  return {
    total,
    page: f.page,
    limit: f.limit,
    items: items.map(({ players, ...m }) => {
      const counted = players.filter((p) => p.outcome !== 'left');
      return {
        ...m,
        participants: players.length,
        finishedCount: players.filter((p) => p.finished).length,
        avgWpm: counted.length ? Math.round(counted.reduce((s, p) => s + p.wpm, 0) / counted.length) : 0,
        top: players.slice(0, 3).map((p) => ({ place: p.place, fullName: p.user.fullName, wpm: p.wpm, accuracy: p.accuracy })),
      };
    }),
  };
}

export async function classMatchDetail(viewer: { userId: string; role: string }, id: string) {
  const m = await prisma.typingMatch.findFirst({
    where: { id, ...classScope(viewer) },
    include: {
      host: { select: { fullName: true } },
      players: { orderBy: [{ place: 'asc' }], include: { user: { select: { id: true, fullName: true, login: true } } } },
      results: { select: { userId: true, rawWpm: true, errors: true, maxCombo: true, totalKeys: true, correctChars: true, durationSec: true, flagged: true, flagReason: true } },
    },
  });
  if (!m) throw ApiError.notFound('Musobaqa topilmadi');
  const groups = await groupsOf(m.players.map((p) => p.userId));
  const res = new Map(m.results.map((r) => [r.userId, r]));
  const { results: _r, players, ...rest } = m;
  return {
    ...rest,
    textLength: m.text.length,
    players: players.map((p) => {
      const r = res.get(p.userId);
      return {
        userId: p.userId,
        fullName: p.user.fullName,
        login: p.user.login,
        groups: groups.get(p.userId) ?? [],
        place: p.place,
        wpm: p.wpm,
        accuracy: p.accuracy,
        progress: p.progress,
        finished: p.finished,
        outcome: p.outcome,
        timeSec: p.finished && p.finishedAt && m.startedAt ? Math.round((p.finishedAt.getTime() - m.startedAt.getTime()) / 100) / 10 : null,
        rawWpm: r?.rawWpm ?? null,
        errors: r?.errors ?? null,
        maxCombo: r?.maxCombo ?? null,
        flagged: r?.flagged ?? false,
        flagReason: r?.flagReason ?? null,
      };
    }),
  };
}

export const catalog = () => ({
  textSources: [
    { key: 'en', label: 'English' },
    { key: 'uz', label: "O'zbek" },
    { key: 'tech', label: 'Dasturlash' },
  ],
  codeLangs: [...CODE_LANGS, 'Tasodifiy'],
  durations: TEXT_DURATIONS,
  maxHumanWpm: MAX_HUMAN_WPM,
  minLeaderboardAccuracy: MIN_LEADERBOARD_ACCURACY,
});
