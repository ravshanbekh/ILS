/**
 * Bellashuv xonasi — umumiy tiplar va `/typing` socket ulanishi.
 * O'quvchi (Battle) ham, mentor (ClassHost — sinf musobaqasi) ham ishlatadi.
 * Backend: modules/typing/typing.rooms.ts
 */
import { io, type Socket } from 'socket.io-client';
import { SOCKET_URL } from '@/utils/socket';

export type RoomMode = 'duel' | 'ffa' | 'team' | 'class';

export interface RoomPlayer {
  userId: string;
  fullName: string;
  team: 'A' | 'B' | null;
  pos: number;
  finishedAt: number | null;
  left: boolean;
  connected: boolean;
  wpm: number;
}

export interface RoomResultPlayer {
  userId: string;
  fullName: string;
  team: 'A' | 'B' | null;
  place: number;
  wpm: number;
  accuracy: number;
  progress?: number;
  errors?: number;
  outcome: 'finished' | 'timeout' | 'left';
  timeSec: number | null;
  ratingBefore: number;
  ratingAfter: number;
  delta: number;
  flagged: boolean;
}

export interface RoomResults {
  matchId?: string;
  rated?: boolean;
  winnerTeam?: 'A' | 'B' | 'draw' | null;
  textLength?: number;
  teamAvg?: { A: number; B: number } | null;
  players?: RoomResultPlayer[];
  error?: string;
}

export interface RoomState {
  code: string;
  mode: RoomMode;
  title: string | null;
  contentType: 'text' | 'code';
  variant: string;
  size: 'short' | 'medium' | 'long' | null;
  isPrivate: boolean;
  hostId: string;
  hostName: string;
  hostPlays: boolean;
  status: 'lobby' | 'countdown' | 'running' | 'finished';
  maxPlayers: number;
  timeLimitSec: number;
  startAt: number | null;
  serverNow: number;
  text: string | null;
  textLength: number;
  players: RoomPlayer[];
  results: RoomResults | null;
}

export const SOCKET_ERR: Record<string, string> = {
  AUTH_REQUIRED: 'Tizimga qaytadan kiring',
  AUTH_INVALID: 'Sessiya eskirgan — qaytadan kiring',
  STUDENTS_ONLY: 'Bellashuv faqat o\'quvchilar va mentorlar uchun',
};

/**
 * forceNew: o'z manager'i. Ilgari global socket (bildirishnomalar) manager'ini
 * bo'lishardi — u `autoConnect: false` bilan yaratilgan, multiplex qilingan
 * socket esa MANAGER'ning autoConnect'iga bo'ysunadi: /typing hech qachon
 * CONNECT yubormas, prod'da abadiy spinner chiqardi. Shuning uchun alohida
 * manager + chaqiruvchi o'zi `connect()` qiladi (avval tinglovchilarni qo'yib).
 */
export function createTypingSocket(): Socket {
  return io(`${SOCKET_URL}/typing`, {
    forceNew: true,
    autoConnect: false,
    withCredentials: true,
    transports: ['websocket', 'polling'],
    tryAllTransports: true,
    auth: (cb) => cb({ token: localStorage.getItem('accessToken') || '' }),
  });
}

/** Jonli o'rin: tugatganlar vaqt bo'yicha, keyin kim ko'proq yozgan, chiqib ketganlar oxirida */
export function liveOrder(players: RoomPlayer[]) {
  return [...players].sort((a, b) => {
    if (a.left !== b.left) return a.left ? 1 : -1;
    if (a.finishedAt && b.finishedAt) return a.finishedAt - b.finishedAt;
    if (a.finishedAt) return -1;
    if (b.finishedAt) return 1;
    return b.pos - a.pos || b.wpm - a.wpm;
  });
}
