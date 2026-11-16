/**
 * Tashqi AI agent kalitlari — OAuth oqimini o'tay olmaydigan agentlar uchun
 * (o'z serveridagi agent, n8n, OpenAI/Claude API, LangChain va h.k.).
 *
 *   Authorization: Bearer ils_ak_<43 belgi>
 *
 * Kalitni admin panelda yaratadi (Sozlamalar → Claude (MCP) → Tashqi AI agent),
 * u faqat yaratilganda bir marta ko'rsatiladi; bazada SHA-256 xeshi saqlanadi.
 * Agent kalit egasi (admin) NOMIDAN ishlaydi — MCP amallarining barcha
 * cheklovlari (admin akkauntlarga tegmaslik, tasdiq kodi, audit) o'z kuchida.
 *
 * Kalit o'ladi: bekor qilinsa, muddati tugasa, egasi nofaol bo'lsa yoki admin
 * emas bo'lib qolsa, egasining paroli almashsa / "barcha qurilmalardan
 * chiqarish" bosilsa (users.token_version) — o'g'irlangan admin akkaunti
 * orqali yaratilgan kalit ham parol tiklanganda yo'q bo'ladi.
 */
import crypto from 'crypto';
import { InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import prisma from '../config/database';
import { mcpConfig } from './config';
import { sha256, type McpTokenExtra } from './oauth/provider';

export const AGENT_KEY_PREFIX = 'ils_ak_';
export const AGENT_CLIENT_PREFIX = 'agent-key:';
export const MAX_ACTIVE_KEYS = 20;
export const AGENT_KEY_EXPIRY_DAYS = [30, 90, 180, 365] as const;

export const isAgentKey = (token: string) => token.startsWith(AGENT_KEY_PREFIX);

export async function createAgentKey(input: { userId: string; name: string; write: boolean; expiresInDays: number | null }) {
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { tokenVersion: true } });
  if (!user) throw new Error('user not found');
  const key = `${AGENT_KEY_PREFIX}${crypto.randomBytes(32).toString('base64url')}`;
  const scopes = input.write ? [mcpConfig.scopes.read, mcpConfig.scopes.write] : [mcpConfig.scopes.read];
  const row = await prisma.mcpAgentKey.create({
    data: {
      name: input.name,
      keyHash: sha256(key),
      prefix: key.slice(0, AGENT_KEY_PREFIX.length + 4),
      userId: input.userId,
      scopes,
      tokenVersion: user.tokenVersion,
      expiresAt: input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86400_000) : null,
    },
    select: { id: true, name: true, prefix: true, scopes: true, expiresAt: true, createdAt: true },
  });
  return { key, row };
}

/**
 * Bearer kalitni tekshiradi va MCP SDK kutgan AuthInfo qaytaradi.
 * DIQQAT: xabarlar WWW-Authenticate sarlavhasiga tushadi — faqat ASCII.
 */
export async function verifyAgentKey(token: string, ip?: string | null): Promise<AuthInfo> {
  const row = await prisma.mcpAgentKey.findUnique({
    where: { keyHash: sha256(token) },
    include: { user: { select: { id: true, fullName: true, role: true, isActive: true, tokenVersion: true } } },
  });
  if (!row || row.revokedAt) throw new InvalidTokenError('API key is invalid or revoked');
  if (row.expiresAt && row.expiresAt < new Date()) throw new InvalidTokenError('API key has expired');
  const u = row.user;
  if (!u.isActive || !mcpConfig.allowedRoles.includes(u.role) || u.tokenVersion !== row.tokenVersion) {
    throw new InvalidTokenError('API key owner access changed, create a new key');
  }

  // Oxirgi faollik — panel uchun; har so'rovda yozmaymiz
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000 || (ip && ip !== row.lastUsedIp)) {
    prisma.mcpAgentKey
      .update({ where: { id: row.id }, data: { lastUsedAt: new Date(), lastUsedIp: ip?.slice(0, 64) ?? null } })
      .catch(() => {});
  }

  const extra: McpTokenExtra = { userId: u.id, fullName: u.fullName, role: u.role, clientName: `Agent: ${row.name}` };
  return {
    token,
    clientId: `${AGENT_CLIENT_PREFIX}${row.id}`,
    scopes: row.scopes,
    // SDK muddat talab qiladi; muddatsiz kalit uchun — nominal 1 soat (har so'rovda qayta tekshiriladi)
    expiresAt: Math.floor((row.expiresAt?.getTime() ?? Date.now() + 3600_000) / 1000),
    extra,
  };
}

/** Panel ro'yxati: holati bilan, maxfiy narsasiz */
export async function listAgentKeys() {
  const rows = await prisma.mcpAgentKey.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true, name: true, prefix: true, scopes: true, tokenVersion: true, expiresAt: true, revokedAt: true,
      lastUsedAt: true, lastUsedIp: true, createdAt: true,
      user: { select: { id: true, fullName: true, login: true, role: true, isActive: true, tokenVersion: true } },
    },
  });
  const now = new Date();
  return rows.map(({ tokenVersion, user, ...r }) => ({
    ...r,
    canWrite: r.scopes.includes(mcpConfig.scopes.write),
    owner: { id: user.id, fullName: user.fullName, login: user.login },
    status: r.revokedAt
      ? 'revoked'
      : r.expiresAt && r.expiresAt < now
        ? 'expired'
        : !user.isActive || !mcpConfig.allowedRoles.includes(user.role) || user.tokenVersion !== tokenVersion
          ? 'owner_changed'
          : 'active',
  }));
}
