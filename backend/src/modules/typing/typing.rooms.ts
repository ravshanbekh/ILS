/**
 * "Tez yozish" bellashuvlari — Socket.IO namespace `/typing`.
 *
 * Rejimlar: duel (2), ffa — 4 kishilik, team — A va B jamoa (8 × 8 = 16 kishigacha),
 * class — SINF MUSOBAQASI: faqat mentor (o'qituvchi/admin) ochadi, o'zi
 * o'ynamaydi — kodni beradi, boshlaydi, jonli kuzatadi, kerak bo'lsa erta
 * yakunlaydi. O'quvchilar kod bilan cheklovsiz (CLASS_MAX gacha) kiradi.
 *
 * Hammasi AYNI matnni yozadi; birinchi tugatgan yutadi (jamoada — jamoa
 * o'rtacha tezligi). Xona holati SERVER xotirasida, natijani server hal qiladi:
 *   - boshlanish vaqti server soatidan (3 soniyalik sanoqdan keyin);
 *   - o'yinchi faqat "qayergacha yozdim" (pos) yuboradi — pos faqat oldinga,
 *     matn uzunligidan oshmaydi va vaqtga nisbatan imkonsiz tez o'sa olmaydi;
 *   - tugatish faqat pos = matn uzunligi bo'lganda, vaqt server bo'yicha.
 * Kirish: faol o'quvchi (o'ynaydi) yoki mentor (faqat sinf musobaqasini boshqaradi).
 */
import crypto from 'crypto';
import type { Server as SocketIOServer, Namespace, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import prisma from '../../config/database';
import logger from '../../shared/utils/logger';
import { raceText, CODE_LANGS, RACE_SIZES, type RaceSize } from './typing.content';
import { persistMatch, MAX_CPS, RawCounts, FinishedPlayer, computeMetrics } from './typing.service';

type RoomMode = 'duel' | 'ffa' | 'team' | 'class';
type Status = 'lobby' | 'countdown' | 'running' | 'finished';
type Team = 'A' | 'B';

interface Player {
  userId: string;
  fullName: string;
  team: Team | null;
  pos: number;
  keys: number;
  errors: number;
  maxCombo: number;
  finishedAt: number | null;
  left: boolean;
  sockets: Set<string>;
  flags: string[];
  lastPosAt: number;
}

interface Room {
  code: string;
  mode: RoomMode;
  title: string | null;
  contentType: 'text' | 'code';
  variant: string;
  size: RaceSize | null;
  isPrivate: boolean;
  hostId: string;
  hostName: string;
  /** Sinf musobaqasida mentor o'ynamaydi — players ichida yo'q */
  hostPlays: boolean;
  hostSockets: Set<string>;
  status: Status;
  maxPlayers: number;
  createdAt: number;
  lastActivity: number;
  text: string;
  timeLimitSec: number;
  startAt: number | null;
  endTimer: NodeJS.Timeout | null;
  players: Map<string, Player>;
  results: any | null;
}

/** Sinf musobaqasi chegarasi — server va tarmoq xavfsizligi uchun (amalda "cheklovsiz") */
export const CLASS_MAX = 200;
export const MENTOR_ROLES = ['teacher', 'admin'];
const MAX_PLAYERS: Record<RoomMode, number> = { duel: 2, ffa: 4, team: 16, class: CLASS_MAX };
const COUNTDOWN_MS = 3000;
const LOBBY_IDLE_MS = 20 * 60 * 1000;
/** Mentor o'quvchilar yig'ilishini uzoqroq kutishi mumkin */
const CLASS_LOBBY_IDLE_MS = 90 * 60 * 1000;
const FINISHED_KEEP_MS = 3 * 60 * 1000;
const CLASS_FINISHED_KEEP_MS = 30 * 60 * 1000;
const rooms = new Map<string, Room>();
const userRoom = new Map<string, string>(); // o'quvchi userId → room code
const mentorRoom = new Map<string, string>(); // mentor userId → o'zi ochgan sinf musobaqasi

const newCode = () => {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (;;) {
    const c = Array.from(crypto.randomBytes(5), (b) => abc[b % abc.length]).join('');
    if (!rooms.has(c)) return c;
  }
};

/**
 * Poyga vaqti chegarasi: ≈ 14 wpm tezlikda ham tugatib bo'ladigan.
 * Oddiy bellashuv 60–240 s; sinf musobaqasida uzun matn bo'lishi mumkin — 480 s gacha.
 */
const timeLimitFor = (text: string, max = 240) => Math.min(max, Math.max(60, Math.ceil(text.length / 1.2)));

function publicRoom(r: Room) {
  const now = Date.now();
  return {
    code: r.code,
    mode: r.mode,
    title: r.title,
    contentType: r.contentType,
    variant: r.variant,
    size: r.size,
    isPrivate: r.isPrivate,
    hostId: r.hostId,
    hostName: r.hostName,
    hostPlays: r.hostPlays,
    status: r.status,
    maxPlayers: r.maxPlayers,
    timeLimitSec: r.timeLimitSec,
    startAt: r.startAt,
    serverNow: now,
    // Matn sanoq boshlanganda ochiladi — lobby'da oldindan ko'rib mashq qilib bo'lmasin
    text: r.status === 'lobby' ? null : r.text,
    textLength: r.text.length,
    players: [...r.players.values()].map((p) => ({
      userId: p.userId,
      fullName: p.fullName,
      team: p.team,
      pos: p.pos,
      finishedAt: p.finishedAt,
      left: p.left,
      connected: p.sockets.size > 0,
      wpm: liveWpm(r, p, now),
    })),
    results: r.results,
  };
}

function liveWpm(r: Room, p: Player, now: number) {
  if (!r.startAt || now < r.startAt) return 0;
  const end = p.finishedAt ?? now;
  return computeMetrics({ correctChars: p.pos, totalKeys: Math.max(p.keys, p.pos), errors: p.errors, maxCombo: 0 }, end - r.startAt).wpm;
}

function lobbyList() {
  return [...rooms.values()]
    .filter((r) => r.status === 'lobby' && !r.isPrivate && r.players.size < r.maxPlayers)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 30)
    .map((r) => ({
      code: r.code,
      mode: r.mode,
      contentType: r.contentType,
      variant: r.variant,
      players: r.players.size,
      maxPlayers: r.maxPlayers,
      host: r.hostName,
    }));
}

export function initTypingGateway(io: SocketIOServer) {
  const nsp: Namespace = io.of('/typing');

  // Majburiy autentifikatsiya: faol o'quvchi yoki mentor (o'qituvchi/admin)
  nsp.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string' || !token) return next(new Error('AUTH_REQUIRED'));
      const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string; tv?: number };
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, fullName: true, role: true, isActive: true, tokenVersion: true },
      });
      if (!user || !user.isActive || (decoded.tv ?? 0) !== user.tokenVersion) return next(new Error('AUTH_INVALID'));
      if (user.role !== 'student' && !MENTOR_ROLES.includes(user.role)) return next(new Error('STUDENTS_ONLY'));
      socket.data.userId = user.id;
      socket.data.fullName = user.fullName;
      socket.data.role = user.role;
      next();
    } catch {
      next(new Error('AUTH_INVALID'));
    }
  });

  const emitRoom = (r: Room) => nsp.to(`room:${r.code}`).emit('room:state', publicRoom(r));
  const emitLobbies = () => nsp.to('lobbies').emit('rooms:list', lobbyList());

  // Progress ko'p keladi — xonaga ko'pi bilan har 200 ms da bir marta yuboramiz
  // (sinf musobaqasida o'yinchi ko'p, holat katta — 600 ms)
  const pendingEmit = new Map<string, NodeJS.Timeout>();
  const emitRoomThrottled = (r: Room) => {
    if (pendingEmit.has(r.code)) return;
    pendingEmit.set(
      r.code,
      setTimeout(() => {
        pendingEmit.delete(r.code);
        if (rooms.has(r.code)) emitRoom(r);
      }, r.mode === 'class' ? 600 : 200)
    );
  };

  /** O'quvchining xonasi yoki mentorning sinf musobaqasi */
  const roomOf = (userId: string) => rooms.get(userRoom.get(userId) ?? mentorRoom.get(userId) ?? '');

  function leaveRoom(userId: string, reason: 'leave' | 'switch' = 'leave') {
    const code = userRoom.get(userId);
    if (!code) return;
    userRoom.delete(userId);
    const r = rooms.get(code);
    if (!r) return;
    const p = r.players.get(userId);
    if (!p) return;
    for (const sid of p.sockets) nsp.sockets.get(sid)?.leave(`room:${code}`);
    if (r.status === 'lobby') {
      r.players.delete(userId);
      if (r.hostPlays) {
        if (r.players.size === 0) {
          destroy(r);
        } else if (r.hostId === userId) {
          const next = r.players.values().next().value as Player;
          r.hostId = next.userId;
          r.hostName = next.fullName;
        }
      }
    } else if (r.status === 'countdown' || r.status === 'running') {
      p.left = true;
      p.sockets.clear();
      checkAllDone(r);
    }
    if (rooms.has(code)) emitRoom(r);
    emitLobbies();
    logger.info(`Typing: ${userId} ${code} xonasidan chiqdi (${reason})`);
  }

  function destroy(r: Room) {
    if (r.endTimer) clearTimeout(r.endTimer);
    for (const p of r.players.values()) if (userRoom.get(p.userId) === r.code) userRoom.delete(p.userId);
    if (mentorRoom.get(r.hostId) === r.code) mentorRoom.delete(r.hostId);
    rooms.delete(r.code);
  }

  /** Xonani hammaga xabar berib yopish (mentor yopdi / uzoq faol emas) */
  function closeRoom(r: Room, reason: string) {
    nsp.to(`room:${r.code}`).emit('room:closed', { reason });
    nsp.in(`room:${r.code}`).socketsLeave(`room:${r.code}`);
    destroy(r);
    emitLobbies();
  }

  function joinSocketToRoom(socket: Socket, r: Room) {
    socket.join(`room:${r.code}`);
    const p = r.players.get(socket.data.userId)!;
    p.sockets.add(socket.id);
  }

  function joinMentorSocket(socket: Socket, r: Room) {
    socket.join(`room:${r.code}`);
    r.hostSockets.add(socket.id);
    mentorRoom.set(r.hostId, r.code);
  }

  function addPlayer(socket: Socket, r: Room) {
    const userId = socket.data.userId as string;
    if (userRoom.get(userId) && userRoom.get(userId) !== r.code) leaveRoom(userId, 'switch');
    let team: Team | null = null;
    if (r.mode === 'team') {
      const a = [...r.players.values()].filter((p) => p.team === 'A').length;
      const b = [...r.players.values()].filter((p) => p.team === 'B').length;
      team = a <= b ? 'A' : 'B';
    }
    r.players.set(userId, {
      userId,
      fullName: socket.data.fullName,
      team,
      pos: 0,
      keys: 0,
      errors: 0,
      maxCombo: 0,
      finishedAt: null,
      left: false,
      sockets: new Set(),
      flags: [],
      lastPosAt: 0,
    });
    userRoom.set(userId, r.code);
    joinSocketToRoom(socket, r);
    r.lastActivity = Date.now();
  }

  function checkAllDone(r: Room) {
    if (r.status !== 'running') return;
    const active = [...r.players.values()].filter((p) => !p.left);
    if (active.length === 0 || active.every((p) => p.finishedAt)) void finishRoom(r);
  }

  async function finishRoom(r: Room) {
    if (r.status === 'finished') return;
    r.status = 'finished';
    if (r.endTimer) clearTimeout(r.endTimer);
    const startAt = r.startAt!;
    const endAt = Math.min(Date.now(), startAt + r.timeLimitSec * 1000);
    const ps = [...r.players.values()];

    // O'rinlar: tugatganlar vaqt bo'yicha, keyin qolganlar yozgan uzunligi bo'yicha,
    // chiqib ketganlar oxirida
    const sorted = [...ps].sort((a, b) => {
      if (a.left !== b.left) return a.left ? 1 : -1;
      if (a.finishedAt && b.finishedAt) return a.finishedAt - b.finishedAt;
      if (a.finishedAt) return -1;
      if (b.finishedAt) return 1;
      return b.pos - a.pos;
    });
    const placeOf = new Map<string, number>();
    sorted.forEach((p, i) => {
      const prev = sorted[i - 1];
      const same = prev && !p.left && !prev.left && !p.finishedAt && !prev.finishedAt && p.pos === prev.pos;
      placeOf.set(p.userId, same ? placeOf.get(prev.userId)! : i + 1);
    });

    const finished: FinishedPlayer[] = ps.map((p) => {
      const elapsedMs = Math.max(1000, (p.finishedAt ?? endAt) - startAt);
      const counts: RawCounts = { correctChars: p.pos, totalKeys: Math.max(p.keys, p.pos), errors: p.errors, maxCombo: p.maxCombo };
      return {
        userId: p.userId,
        team: p.team,
        place: placeOf.get(p.userId)!,
        progress: p.pos,
        finished: !!p.finishedAt,
        outcome: p.left ? 'left' : p.finishedAt ? 'finished' : 'timeout',
        finishedAt: p.finishedAt ? new Date(p.finishedAt) : null,
        counts,
        elapsedMs,
        flagged: p.flags,
      };
    });

    let winnerTeam: 'A' | 'B' | 'draw' | null = null;
    if (r.mode === 'team') {
      const avg = (t: Team) => {
        const xs = finished.filter((f) => f.team === t);
        return xs.length ? xs.reduce((s, f) => s + computeMetrics(f.counts, f.elapsedMs).wpm, 0) / xs.length : 0;
      };
      const a = avg('A');
      const b = avg('B');
      winnerTeam = Math.abs(a - b) < 0.5 ? 'draw' : a > b ? 'A' : 'B';
      // Jamoaviy o'rin: g'olib jamoa a'zolari 1, yutqazganlar 2 (draw — hammasi 1)
      for (const f of finished) {
        if (f.outcome === 'left') f.place = 2;
        else f.place = winnerTeam === 'draw' || winnerTeam === f.team ? 1 : 2;
      }
    }

    try {
      const saved = await persistMatch({
        code: r.code,
        mode: r.mode,
        title: r.title,
        contentType: r.contentType,
        variant: r.variant,
        text: r.text,
        hostId: r.hostId,
        timeLimitSec: r.timeLimitSec,
        startedAt: new Date(startAt),
        finishedAt: new Date(endAt),
        winnerTeam,
        players: finished,
      });
      const byUser = new Map(saved.players.map((p) => [p.userId, p]));
      r.results = {
        matchId: saved.matchId,
        rated: saved.rated,
        winnerTeam,
        textLength: r.text.length,
        teamAvg:
          r.mode === 'team'
            ? Object.fromEntries((['A', 'B'] as Team[]).map((t) => {
                const xs = finished.filter((f) => f.team === t).map((f) => byUser.get(f.userId)!.wpm);
                return [t, xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0];
              }))
            : null,
        players: finished
          .map((f) => {
            const s = byUser.get(f.userId)!;
            return {
              userId: f.userId,
              fullName: r.players.get(f.userId)!.fullName,
              team: f.team,
              place: f.place,
              wpm: s.wpm,
              accuracy: s.accuracy,
              progress: f.progress,
              errors: f.counts.errors,
              outcome: f.outcome,
              timeSec: f.finished ? Math.round(f.elapsedMs / 100) / 10 : null,
              ratingBefore: s.ratingBefore,
              ratingAfter: s.ratingAfter,
              delta: s.delta,
              flagged: f.flagged.length > 0,
            };
          })
          .sort((a, b) => a.place - b.place || b.wpm - a.wpm),
      };
    } catch (e) {
      logger.error(`Typing: o'yin natijasini saqlashda xato (${r.code}): ${e instanceof Error ? e.message : e}`);
      r.results = { error: 'Natijani saqlab bo\'lmadi' };
    }
    emitRoom(r);
    for (const p of ps) if (userRoom.get(p.userId) === r.code) userRoom.delete(p.userId);
    setTimeout(() => {
      if (rooms.get(r.code) === r) destroy(r);
    }, r.mode === 'class' ? CLASS_FINISHED_KEEP_MS : FINISHED_KEEP_MS).unref?.();
  }

  // Tashlab ketilgan lobby'larni tozalash
  setInterval(() => {
    const now = Date.now();
    for (const r of rooms.values()) {
      const idle = r.mode === 'class' ? CLASS_LOBBY_IDLE_MS : LOBBY_IDLE_MS;
      if (r.status === 'lobby' && now - r.lastActivity > idle) closeRoom(r, 'Xona uzoq vaqt faol bo\'lmadi');
    }
    emitLobbies();
  }, 60_000).unref();

  nsp.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    const mentor = MENTOR_ROLES.includes(socket.data.role);

    const ack = (cb: unknown, payload: unknown) => {
      if (typeof cb === 'function') cb(payload);
    };
    const fail = (cb: unknown, error: string) => ack(cb, { ok: false, error });
    const STUDENT_ONLY = 'Bu amal faqat o\'quvchilar uchun';

    // Qayta ulanish: o'yinchi/mentor xonada bo'lsa — o'sha xonaga qaytaramiz
    if (mentor) {
      const r = rooms.get(mentorRoom.get(userId) ?? '');
      if (r) {
        joinMentorSocket(socket, r);
        socket.emit('room:state', publicRoom(r));
      }
    } else {
      const existing = userRoom.get(userId);
      if (existing && rooms.has(existing)) {
        const r = rooms.get(existing)!;
        const p = r.players.get(userId);
        if (p && !p.left) {
          joinSocketToRoom(socket, r);
          socket.emit('room:state', publicRoom(r));
        }
      }
    }

    socket.on('lobbies:watch', (_: unknown, cb?: unknown) => {
      socket.join('lobbies');
      ack(cb, { ok: true, rooms: lobbyList() });
    });
    socket.on('lobbies:unwatch', () => socket.leave('lobbies'));

    socket.on('room:create', (raw: any, cb?: unknown) => {
      const isClass = raw?.mode === 'class';
      if (isClass && !mentor) return fail(cb, 'Sinf musobaqasini faqat mentor ochadi');
      if (!isClass && mentor) return fail(cb, 'Mentor faqat sinf musobaqasini ochadi');
      const mode: RoomMode = isClass ? 'class' : ['duel', 'ffa', 'team'].includes(raw?.mode) ? raw.mode : 'duel';

      if (isClass) {
        // Mentorda bir vaqtda bitta musobaqa: lobby'dagisi yangisi bilan almashadi,
        // davom etayotganini esa avval yakunlash kerak
        const prev = rooms.get(mentorRoom.get(userId) ?? '');
        if (prev && (prev.status === 'countdown' || prev.status === 'running')) {
          return fail(cb, `Avvalgi musobaqa (${prev.code}) hali davom etyapti — avval uni yakunlang`);
        }
        if (prev && prev.status === 'lobby') closeRoom(prev, 'Mentor yangi musobaqa ochdi');
        if (prev && prev.status === 'finished') {
          for (const sid of prev.hostSockets) nsp.sockets.get(sid)?.leave(`room:${prev.code}`);
          mentorRoom.delete(userId);
        }
      }

      const contentType = raw?.contentType === 'code' ? 'code' : 'text';
      const variantIn = String(raw?.variant ?? '');
      const variant =
        contentType === 'code'
          ? [...CODE_LANGS, 'Tasodifiy'].includes(variantIn) ? variantIn : 'Tasodifiy'
          : ['en', 'uz', 'tech'].includes(variantIn) ? variantIn : 'en';
      const size: RaceSize | null = isClass ? (RACE_SIZES.includes(raw?.size) ? raw.size : 'medium') : null;
      const title = isClass ? String(raw?.title ?? '').replace(/\s+/g, ' ').trim().slice(0, 80) || null : null;
      const r: Room = {
        code: newCode(),
        mode,
        title,
        contentType,
        variant,
        size,
        isPrivate: isClass || !!raw?.isPrivate,
        hostId: userId,
        hostName: socket.data.fullName,
        hostPlays: !isClass,
        hostSockets: new Set(),
        status: 'lobby',
        maxPlayers: MAX_PLAYERS[mode],
        createdAt: Date.now(),
        lastActivity: Date.now(),
        text: '',
        timeLimitSec: 0,
        startAt: null,
        endTimer: null,
        players: new Map(),
        results: null,
      };
      // Matn oldindan tanlanadi (uzunligi lobby'da ko'rinadi), lekin o'zi sanoqgacha yopiq
      const t = raceText(contentType, variant, size ?? undefined);
      r.text = t.text;
      if (contentType === 'code') r.variant = variant === 'Tasodifiy' ? 'Tasodifiy' : t.variant;
      r.timeLimitSec = timeLimitFor(r.text, isClass ? 480 : 240);
      rooms.set(r.code, r);
      if (isClass) joinMentorSocket(socket, r);
      else addPlayer(socket, r);
      emitRoom(r);
      emitLobbies();
      ack(cb, { ok: true, room: publicRoom(r) });
      if (isClass) logger.info(`Typing: ${socket.data.fullName} sinf musobaqasini ochdi (${r.code})`);
    });

    socket.on('room:join', (raw: any, cb?: unknown) => {
      if (mentor) return fail(cb, STUDENT_ONLY);
      const code = String(raw?.code ?? '').trim().toUpperCase();
      const r = rooms.get(code);
      if (!r) return fail(cb, 'Bunday xona topilmadi');
      if (r.players.has(userId)) {
        const p = r.players.get(userId)!;
        if (p.left) return fail(cb, 'Siz bu o\'yindan chiqib ketgansiz');
        joinSocketToRoom(socket, r);
        if (r.status !== 'finished') userRoom.set(userId, r.code);
        return ack(cb, { ok: true, room: publicRoom(r) });
      }
      if (r.status !== 'lobby') {
        return fail(cb, r.mode === 'class' ? 'Musobaqa allaqachon boshlangan — keyingisini kuting' : 'O\'yin allaqachon boshlangan');
      }
      if (r.players.size >= r.maxPlayers) return fail(cb, 'Xona to\'la');
      addPlayer(socket, r);
      emitRoom(r);
      emitLobbies();
      ack(cb, { ok: true, room: publicRoom(r) });
    });

    // Tezkor o'yin: mos ochiq xonaga qo'shilish, bo'lmasa yangi xona
    socket.on('room:quick', (raw: any, cb?: unknown) => {
      if (mentor) return fail(cb, STUDENT_ONLY);
      const mode: RoomMode = ['duel', 'ffa', 'team'].includes(raw?.mode) ? raw.mode : 'duel';
      const contentType = raw?.contentType === 'code' ? 'code' : 'text';
      const r = [...rooms.values()].find(
        (x) => x.status === 'lobby' && !x.isPrivate && x.mode === mode && x.contentType === contentType && x.players.size < x.maxPlayers && !x.players.has(userId)
      );
      if (r) {
        addPlayer(socket, r);
        emitRoom(r);
        emitLobbies();
        return ack(cb, { ok: true, room: publicRoom(r), joined: true });
      }
      socket.emit('room:quick-create', { mode, contentType });
      ack(cb, { ok: true, create: true });
    });

    socket.on('room:leave', (_: unknown, cb?: unknown) => {
      if (mentor) {
        // Mentor sahifadan chiqsa musobaqa to'xtamaydi (qaytsa davom ettiradi);
        // natijani ko'rib bo'lgach chiqsa — bog'lanish uziladi
        const r = rooms.get(mentorRoom.get(userId) ?? '');
        if (r) {
          for (const sid of r.hostSockets) nsp.sockets.get(sid)?.leave(`room:${r.code}`);
          r.hostSockets.clear();
          if (r.status === 'finished') mentorRoom.delete(userId);
        }
        return ack(cb, { ok: true });
      }
      leaveRoom(userId);
      ack(cb, { ok: true });
    });

    socket.on('room:close', (_: unknown, cb?: unknown) => {
      const r = rooms.get(mentorRoom.get(userId) ?? '');
      if (!r || r.hostId !== userId) return fail(cb, 'Xona topilmadi');
      if (r.status === 'countdown' || r.status === 'running') return fail(cb, 'Musobaqa davom etyapti — "Yakunlash" tugmasidan foydalaning');
      if (r.status === 'finished') {
        for (const sid of r.hostSockets) nsp.sockets.get(sid)?.leave(`room:${r.code}`);
        mentorRoom.delete(userId);
      } else {
        closeRoom(r, 'Mentor musobaqani yopdi');
      }
      ack(cb, { ok: true });
    });

    socket.on('room:team', (raw: any, cb?: unknown) => {
      const r = rooms.get(userRoom.get(userId) ?? '');
      if (!r || r.mode !== 'team' || r.status !== 'lobby') return fail(cb, 'Jamoani hozir o\'zgartirib bo\'lmaydi');
      const team: Team = raw?.team === 'B' ? 'B' : 'A';
      const count = [...r.players.values()].filter((p) => p.team === team).length;
      if (count >= r.maxPlayers / 2) return fail(cb, `${team} jamoa to'la`);
      r.players.get(userId)!.team = team;
      r.lastActivity = Date.now();
      emitRoom(r);
      ack(cb, { ok: true });
    });

    socket.on('room:kick', (raw: any, cb?: unknown) => {
      const r = roomOf(userId);
      if (!r || r.hostId !== userId || r.status !== 'lobby') return fail(cb, 'Faqat xona egasi lobby\'da chiqara oladi');
      const target = String(raw?.userId ?? '');
      if (!r.players.has(target) || target === userId) return fail(cb, 'O\'yinchi topilmadi');
      const p = r.players.get(target)!;
      for (const sid of p.sockets) {
        const s = nsp.sockets.get(sid);
        s?.leave(`room:${r.code}`);
        s?.emit('room:closed', { reason: r.mode === 'class' ? 'Mentor sizni musobaqadan chiqardi' : 'Xona egasi sizni chiqardi' });
      }
      r.players.delete(target);
      userRoom.delete(target);
      emitRoom(r);
      emitLobbies();
      ack(cb, { ok: true });
    });

    socket.on('room:start', (_: unknown, cb?: unknown) => {
      const r = roomOf(userId);
      if (!r) return fail(cb, 'Xona topilmadi');
      if (r.hostId !== userId) return fail(cb, r.mode === 'class' ? 'Musobaqani faqat mentor boshlaydi' : 'Faqat xona egasi boshlaydi');
      if (r.status !== 'lobby') return fail(cb, 'O\'yin allaqachon boshlangan');
      if (r.mode === 'class') {
        if (r.players.size < 1) return fail(cb, 'Hali hech kim kirmadi — o\'quvchilarga kodni bering');
      } else if (r.players.size < 2) {
        return fail(cb, 'Kamida 2 o\'yinchi kerak');
      }
      if (r.mode === 'team') {
        const a = [...r.players.values()].filter((p) => p.team === 'A').length;
        const b = [...r.players.values()].filter((p) => p.team === 'B').length;
        if (!a || !b) return fail(cb, 'Har ikki jamoada kamida 1 o\'yinchi bo\'lsin');
      }
      r.status = 'countdown';
      r.startAt = Date.now() + COUNTDOWN_MS;
      setTimeout(() => {
        if (r.status !== 'countdown') return;
        r.status = 'running';
        emitRoom(r);
        r.endTimer = setTimeout(() => void finishRoom(r), r.timeLimitSec * 1000 + 500);
      }, COUNTDOWN_MS);
      emitRoom(r);
      emitLobbies();
      ack(cb, { ok: true });
    });

    // Mentor musobaqani muddatidan oldin yakunlaydi — kim qayergacha yozgan bo'lsa shu natija
    socket.on('room:finish', (_: unknown, cb?: unknown) => {
      const r = rooms.get(mentorRoom.get(userId) ?? '');
      if (!r || r.hostId !== userId) return fail(cb, 'Xona topilmadi');
      if (r.status !== 'running') return fail(cb, 'Musobaqa hozir davom etmayapti');
      void finishRoom(r);
      ack(cb, { ok: true });
    });

    socket.on('race:progress', (raw: any) => {
      if (mentor) return;
      const r = rooms.get(userRoom.get(userId) ?? '');
      if (!r || r.status !== 'running' || !r.startAt) return;
      const p = r.players.get(userId);
      if (!p || p.left || p.finishedAt) return;
      const now = Date.now();
      const elapsedSec = Math.max(0, (now - r.startAt) / 1000);
      const maxPos = Math.min(r.text.length, Math.floor(elapsedSec * MAX_CPS) + 10);
      let pos = Math.floor(Number(raw?.pos));
      if (!Number.isFinite(pos)) return;
      if (pos > maxPos) {
        if (!p.flags.includes('imkonsiz tez progress')) p.flags.push('imkonsiz tez progress');
        pos = maxPos;
      }
      if (pos < p.pos) return; // orqaga qaytish (backspace) — server progressi kamaymaydi
      p.pos = pos;
      const keys = Math.floor(Number(raw?.keys));
      const errors = Math.floor(Number(raw?.errors));
      const combo = Math.floor(Number(raw?.maxCombo));
      if (Number.isFinite(keys)) p.keys = Math.max(p.keys, Math.min(keys, pos * 5 + 200));
      if (Number.isFinite(errors)) p.errors = Math.max(p.errors, Math.min(errors, 100_000));
      if (Number.isFinite(combo)) p.maxCombo = Math.max(p.maxCombo, Math.min(combo, pos));
      p.lastPosAt = now;
      if (p.pos >= r.text.length) {
        p.finishedAt = now;
        checkAllDone(r);
        emitRoom(r);
        return;
      }
      emitRoomThrottled(r);
    });

    socket.on('disconnect', () => {
      if (mentor) {
        rooms.get(mentorRoom.get(userId) ?? '')?.hostSockets.delete(socket.id);
        return;
      }
      const code = userRoom.get(userId);
      const r = code ? rooms.get(code) : undefined;
      const p = r?.players.get(userId);
      if (!r || !p) return;
      p.sockets.delete(socket.id);
      if (p.sockets.size > 0) return;
      // Lobby'da 30 s ichida qaytmasa — chiqarib yuboramiz; o'yinda — o'yin davom etadi,
      // 20 s ichida qaytmasa "chiqib ketdi" deb belgilanadi
      const grace = r.status === 'lobby' ? 30_000 : 20_000;
      setTimeout(() => {
        const rr = rooms.get(r.code);
        const pp = rr?.players.get(userId);
        if (!rr || !pp || pp.sockets.size > 0 || pp.left || pp.finishedAt) return;
        if (rr.status === 'finished') return;
        leaveRoom(userId);
      }, grace);
      emitRoom(r);
    });
  });

  logger.info('⌨️  Typing gateway (/typing) tayyor');
  return nsp;
}

/** Admin: hozir davom etayotgan xonalar (xotiradagi) */
export function liveRoomsSnapshot() {
  return [...rooms.values()].map((r) => ({
    code: r.code,
    mode: r.mode,
    title: r.title,
    host: r.hostName,
    contentType: r.contentType,
    variant: r.variant,
    status: r.status,
    players: [...r.players.values()].map((p) => ({ fullName: p.fullName, team: p.team, pos: p.pos, finished: !!p.finishedAt, left: p.left })),
    textLength: r.text.length,
    createdAt: new Date(r.createdAt).toISOString(),
  }));
}
