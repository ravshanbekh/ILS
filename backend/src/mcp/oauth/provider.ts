/**
 * IT Live Score OAuth 2.1 avtorizatsiya serveri (MCP connector uchun).
 *
 * Oqim (claude.ai → Settings → Connectors → Add custom connector):
 *  1. /mcp ga tokensiz so'rov → 401 + WWW-Authenticate (resource metadata)
 *  2. Claude metama'lumotni o'qiydi, /mcp/oauth/register da o'zini ro'yxatdan
 *     o'tkazadi (DCR). redirect_uri faqat ruxsat etilgan hostlardan.
 *  3. Brauzer /mcp/oauth/authorize ga keladi → authorize() login + rozilik
 *     sahifasini chizadi (pages.ts). Admin login/parol kiritadi → approve.
 *  4. Bir martalik kod (5 daq) → /mcp/oauth/token: PKCE tekshiriladi, access
 *     (1 soat) + refresh (30 kun) beriladi.
 *  5. Har MCP so'rovida verifyAccessToken: token, foydalanuvchi faolligi,
 *     admin roli va users.token_version (parol almashsa token o'ladi).
 *
 * Bazada faqat SHA-256 xeshlar saqlanadi.
 */
import crypto from 'crypto';
import type { Response } from 'express';
import { OAuthServerProvider, AuthorizationParams } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import {
  OAuthClientInformationFull,
  OAuthTokens,
  OAuthTokenRevocationRequest,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import {
  InvalidClientMetadataError,
  InvalidGrantError,
  InvalidTokenError,
  InvalidScopeError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js';
import prisma from '../../config/database';
import logger from '../../shared/utils/logger';
import { mcpConfig, SUPPORTED_SCOPES, isAllowedRedirectUri } from '../config';
import { renderConsentPage, signConsentRequest } from './pages';

export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const randomToken = (prefix: string) => `${prefix}_${crypto.randomBytes(32).toString('base64url')}`;
const sameResource = (a?: string | null, b?: string | null) =>
  (a ?? '').replace(/\/+$/, '') === (b ?? '').replace(/\/+$/, '');

// ── Mijozlar (Dynamic Client Registration) ──────────────────────────────────

class PrismaClientsStore implements OAuthRegisteredClientsStore {
  async getClient(clientId: string) {
    if (!clientId || clientId.length > 64) return undefined;
    const row = await prisma.mcpOAuthClient.findUnique({ where: { id: clientId } });
    return row ? (row.metadata as unknown as OAuthClientInformationFull) : undefined;
  }

  async registerClient(
    client: Omit<OAuthClientInformationFull, 'client_id' | 'client_id_issued_at'> & { client_id?: string; client_id_issued_at?: number }
  ) {
    const uris = client.redirect_uris ?? [];
    if (uris.length === 0 || uris.length > 10) {
      throw new InvalidClientMetadataError('redirect_uris 1–10 ta bo\'lishi kerak');
    }
    const bad = uris.find((u) => !isAllowedRedirectUri(String(u)));
    if (bad) {
      throw new InvalidClientMetadataError(
        `redirect_uri ruxsat etilmagan: ${bad}. Faqat claude.ai / claude.com va localhost qabul qilinadi.`
      );
    }
    // SDK client_id va (kerak bo'lsa) client_secret ni o'zi yaratib beradi
    const full = {
      ...client,
      client_id: client.client_id ?? crypto.randomUUID(),
      client_id_issued_at: client.client_id_issued_at ?? Math.floor(Date.now() / 1000),
    } as OAuthClientInformationFull;

    await prisma.mcpOAuthClient.create({
      data: {
        id: full.client_id,
        name: (full.client_name ?? '').slice(0, 200) || null,
        metadata: full as any,
      },
    });
    logger.info(`MCP: yangi OAuth mijoz ro'yxatdan o'tdi: ${full.client_name ?? full.client_id}`);
    return full;
  }
}

// ── Provayder ────────────────────────────────────────────────────────────────

export interface McpTokenExtra {
  [key: string]: unknown;
  userId: string;
  fullName: string;
  role: string;
  clientName: string | null;
}

export class IlsOAuthProvider implements OAuthServerProvider {
  readonly clientsStore = new PrismaClientsStore();

  /**
   * Login + rozilik sahifasi. SDK bu yerga kelguncha client_id, redirect_uri
   * (mijozda ro'yxatdagisi), response_type=code va code_challenge (S256)
   * ni tekshirib bo'lgan.
   */
  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response) {
    const requested = params.scopes?.length ? params.scopes : SUPPORTED_SCOPES;
    const unknown = requested.filter((s) => !SUPPORTED_SCOPES.includes(s));
    if (unknown.length) throw new InvalidScopeError(`Noma'lum scope: ${unknown.join(', ')}`);
    if (params.resource && !sameResource(params.resource.href, mcpConfig.resourceUrl.href)) {
      throw new InvalidScopeError('resource bu serverga tegishli emas');
    }

    const signed = signConsentRequest({
      clientId: client.client_id,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      state: params.state,
      scopes: requested,
      resource: params.resource?.href,
    });
    res.status(200);
    renderConsentPage(res, {
      clientName: client.client_name ?? 'Noma\'lum ilova',
      redirectHost: new URL(params.redirectUri).host,
      requestedScopes: requested,
      signed,
    });
  }

  async challengeForAuthorizationCode(client: OAuthClientInformationFull, authorizationCode: string) {
    const code = await prisma.mcpOAuthCode.findUnique({ where: { codeHash: sha256(authorizationCode) } });
    if (!code || code.clientId !== client.client_id) throw new InvalidGrantError('Kod noto\'g\'ri');
    return code.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string,
    resource?: URL
  ): Promise<OAuthTokens> {
    const code = await prisma.mcpOAuthCode.findUnique({ where: { codeHash: sha256(authorizationCode) } });
    if (!code || code.clientId !== client.client_id) throw new InvalidGrantError('Kod noto\'g\'ri');
    if (code.expiresAt < new Date()) throw new InvalidGrantError('Kod muddati tugagan');
    if (redirectUri && redirectUri !== code.redirectUri) throw new InvalidGrantError('redirect_uri mos emas');
    if (resource && code.resource && !sameResource(resource.href, code.resource)) {
      throw new InvalidGrantError('resource mos emas');
    }

    // Atomik "bir marta ishlatish": ikkinchi urinish 0 qator yangilaydi
    const used = await prisma.mcpOAuthCode.updateMany({
      where: { id: code.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (used.count === 0) {
      // Kod qayta ishlatilmoqda — o'g'irlangan bo'lishi mumkin (RFC 6749 §4.1.2):
      // shu mijoz+foydalanuvchiga shu koddan keyin berilgan tokenlarni bekor qilamiz.
      await prisma.mcpOAuthToken.updateMany({
        where: { clientId: code.clientId, userId: code.userId, revokedAt: null, createdAt: { gte: code.createdAt } },
        data: { revokedAt: new Date() },
      });
      logger.warn(`MCP: avtorizatsiya kodi qayta ishlatildi (client ${code.clientId}) — tokenlar bekor qilindi`);
      throw new InvalidGrantError('Kod allaqachon ishlatilgan');
    }

    const user = await this.loadEligibleUser(code.userId);
    return this.issueTokens(client.client_id, user.id, user.tokenVersion, code.scopes, code.resource);
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    resource?: URL
  ): Promise<OAuthTokens> {
    const row = await prisma.mcpOAuthToken.findUnique({ where: { refreshHash: sha256(refreshToken) } });
    if (!row || row.clientId !== client.client_id) throw new InvalidGrantError('Refresh token noto\'g\'ri');
    if (row.revokedAt) {
      // Bekor qilingan refresh qayta kelsa — token o'g'irlanganiga ishora:
      // shu mijoz+foydalanuvchining barcha faol tokenlari yopiladi.
      await prisma.mcpOAuthToken.updateMany({
        where: { clientId: row.clientId, userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new InvalidGrantError('Refresh token bekor qilingan');
    }
    if (row.refreshExpiresAt < new Date()) throw new InvalidGrantError('Refresh token muddati tugagan');
    if (resource && row.resource && !sameResource(resource.href, row.resource)) {
      throw new InvalidGrantError('resource mos emas');
    }
    const nextScopes = scopes?.length ? scopes : row.scopes;
    if (nextScopes.some((s) => !row.scopes.includes(s))) throw new InvalidScopeError('Scope kengaytirib bo\'lmaydi');

    const user = await this.loadEligibleUser(row.userId);
    if (user.tokenVersion !== row.tokenVersion) throw new InvalidGrantError('Sessiya tugatilgan — qayta ulaning');

    // Rotation: eski juftlik yopiladi (poyga holatida faqat bittasi yutadi)
    const closed = await prisma.mcpOAuthToken.updateMany({
      where: { id: row.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (closed.count === 0) throw new InvalidGrantError('Refresh token allaqachon ishlatilgan');
    return this.issueTokens(client.client_id, user.id, user.tokenVersion, nextScopes, row.resource);
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const row = await prisma.mcpOAuthToken.findUnique({
      where: { accessHash: sha256(token) },
      include: {
        user: { select: { id: true, fullName: true, role: true, isActive: true, tokenVersion: true } },
        client: { select: { name: true } },
      },
    });
    // DIQQAT: bu xabarlar SDK tomonidan WWW-Authenticate SARLAVHASIGA yoziladi —
    // faqat ASCII ("—", "‘" kabi belgilar Node'da ERR_INVALID_CHAR → 500 berardi).
    if (!row || row.revokedAt) throw new InvalidTokenError('Token is invalid or revoked');
    if (row.accessExpiresAt < new Date()) throw new InvalidTokenError('Token has expired');
    const u = row.user;
    if (!u.isActive || !mcpConfig.allowedRoles.includes(u.role) || u.tokenVersion !== row.tokenVersion) {
      throw new InvalidTokenError('User access changed, please reconnect');
    }

    // lastUsedAt — admin sahifasida "oxirgi faollik"; har so'rovda yozmaymiz
    if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 5 * 60_000) {
      prisma.mcpOAuthToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
    }

    const extra: McpTokenExtra = { userId: u.id, fullName: u.fullName, role: u.role, clientName: row.client.name };
    return {
      token,
      clientId: row.clientId,
      scopes: row.scopes,
      expiresAt: Math.floor(row.accessExpiresAt.getTime() / 1000),
      resource: row.resource ? new URL(row.resource) : undefined,
      extra,
    };
  }

  async revokeToken(client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest) {
    const h = sha256(request.token);
    await prisma.mcpOAuthToken.updateMany({
      where: { clientId: client.client_id, revokedAt: null, OR: [{ accessHash: h }, { refreshHash: h }] },
      data: { revokedAt: new Date() },
    });
  }

  // ── Ichki ──────────────────────────────────────────────────────────────────

  /** Rozilik sahifasida login muvaffaqiyatli bo'lgach chaqiriladi (http.ts) */
  async createAuthorizationCode(input: {
    clientId: string;
    userId: string;
    scopes: string[];
    codeChallenge: string;
    redirectUri: string;
    resource?: string;
  }) {
    const code = randomToken('ilsc');
    await prisma.mcpOAuthCode.create({
      data: {
        codeHash: sha256(code),
        clientId: input.clientId,
        userId: input.userId,
        scopes: input.scopes,
        codeChallenge: input.codeChallenge,
        redirectUri: input.redirectUri,
        resource: input.resource ?? null,
        expiresAt: new Date(Date.now() + mcpConfig.authCodeTtlSec * 1000),
      },
    });
    // Eski, ishlatilmagan kodlarni yo'l-yo'lakay tozalaymiz
    prisma.mcpOAuthCode
      .deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 24 * 3600_000) } } })
      .catch(() => {});
    return code;
  }

  private async loadEligibleUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isActive: true, tokenVersion: true },
    });
    if (!user || !user.isActive || !mcpConfig.allowedRoles.includes(user.role)) {
      throw new InvalidGrantError('Foydalanuvchi faol emas yoki administrator emas');
    }
    return user;
  }

  private async issueTokens(
    clientId: string,
    userId: string,
    tokenVersion: number,
    scopes: string[],
    resource: string | null
  ): Promise<OAuthTokens> {
    const access = randomToken('ilsa');
    const refresh = randomToken('ilsr');
    const now = Date.now();
    await prisma.mcpOAuthToken.create({
      data: {
        accessHash: sha256(access),
        refreshHash: sha256(refresh),
        clientId,
        userId,
        scopes,
        resource,
        tokenVersion,
        accessExpiresAt: new Date(now + mcpConfig.accessTokenTtlSec * 1000),
        refreshExpiresAt: new Date(now + mcpConfig.refreshTokenTtlSec * 1000),
      },
    });
    // Juda eski (muddati o'tgan) yozuvlarni tozalash
    prisma.mcpOAuthToken
      .deleteMany({ where: { refreshExpiresAt: { lt: new Date(now - 7 * 24 * 3600_000) } } })
      .catch(() => {});
    return {
      access_token: access,
      token_type: 'Bearer',
      expires_in: mcpConfig.accessTokenTtlSec,
      refresh_token: refresh,
      scope: scopes.join(' '),
    };
  }
}
