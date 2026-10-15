/**
 * MCP connector'ning HTTP qismi: OAuth metama'lumotlari va endpointlari,
 * login/rozilik POST'i va /mcp (Streamable HTTP, stateless).
 *
 * Yo'llar (frontend nginx'i /mcp va /.well-known/oauth-* ni backend'ga beradi):
 *   GET  /.well-known/oauth-protected-resource[/mcp]  — resurs metama'lumoti
 *   GET  /.well-known/oauth-authorization-server      — AS metama'lumoti
 *   GET  /mcp/oauth/authorize    — login + rozilik sahifasi
 *   POST /mcp/oauth/approve      — login tekshiruvi, kod berish
 *   POST /mcp/oauth/token        — kod/refresh → token
 *   POST /mcp/oauth/register     — Dynamic Client Registration
 *   POST /mcp/oauth/revoke       — token bekor qilish
 *   POST /mcp                    — MCP JSON-RPC (Bearer token)
 *
 * Stateless rejim: har so'rovga yangi McpServer (token egasi konteksti bilan).
 * Sessiya xotirasi yo'q — server qayta ishga tushsa ham ulanish uzilmaydi va
 * bir nechta konteynerga ham bemalol taqsimlanadi.
 */
import { Router, Request, Response, NextFunction, urlencoded } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { authorizationHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/authorize.js';
import { tokenHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/token.js';
import { clientRegistrationHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/register.js';
import { revocationHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/revoke.js';
import { metadataHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/metadata.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { getOAuthProtectedResourceMetadataUrl } from '@modelcontextprotocol/sdk/server/auth/router.js';
import type { OAuthMetadata, OAuthProtectedResourceMetadata } from '@modelcontextprotocol/sdk/shared/auth.js';
import prisma from '../config/database';
import logger from '../shared/utils/logger';
import { mcpConfig, SUPPORTED_SCOPES } from './config';
import { IlsOAuthProvider, McpTokenExtra } from './oauth/provider';
import { renderConsentPage, renderErrorPage, verifyConsentRequest } from './oauth/pages';
import { createMcpServer } from './server';
import { McpActor } from './context';
import { mcpEventLogger, basicClientAuthToBody } from './events';

// Taymingni tenglashtirish uchun: login topilmasa ham bcrypt ishlaydi
const DUMMY_HASH = '$2a$12$BtyX2urLv3wsEzMDPeiah.7eJ0KAr4ZqkPa2l90CJOQwLltqvXXui';

export function createMcpRouter() {
  const router = Router();
  const provider = new IlsOAuthProvider();
  const { paths } = mcpConfig;
  const abs = (p: string) => new URL(p, mcpConfig.baseUrl).href;

  // ── Metama'lumotlar ─────────────────────────────────────────────────────────
  const asMetadata: OAuthMetadata = {
    issuer: mcpConfig.issuerUrl.href,
    authorization_endpoint: abs(paths.authorize),
    token_endpoint: abs(paths.token),
    registration_endpoint: abs(paths.register),
    revocation_endpoint: abs(paths.revoke),
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'none'],
    revocation_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'none'],
    scopes_supported: SUPPORTED_SCOPES,
    service_documentation: abs('/mcp/docs'),
  };
  const resourceMetadata: OAuthProtectedResourceMetadata = {
    resource: mcpConfig.resourceUrl.href,
    authorization_servers: [mcpConfig.issuerUrl.href],
    scopes_supported: SUPPORTED_SCOPES,
    bearer_methods_supported: ['header'],
    resource_name: 'IT Live Score',
    resource_documentation: abs('/mcp/docs'),
  };
  router.use('/.well-known/oauth-authorization-server', metadataHandler(asMetadata) as any);
  // RFC 9728: resurs yo'li qo'shib (/…/mcp) — asosiysi; ildiz — eski mijozlar uchun.
  // SDK handleri faqat "/" ni tutadi, shuning uchun har yo'l alohida ulanadi.
  const prmHandler = metadataHandler(resourceMetadata) as any;
  router.use(`/.well-known/oauth-protected-resource${paths.mcp}`, prmHandler);
  router.use('/.well-known/oauth-protected-resource', prmHandler);

  // ── OAuth endpointlari (SDK handlerlari: validatsiya, PKCE, xato formatlari) ─
  // Diagnostika — faqat MCP/OAuth yo'llari (router ilova ildizida turadi)
  router.use(['/mcp', '/.well-known/oauth-authorization-server', '/.well-known/oauth-protected-resource'], mcpEventLogger);

  router.use(paths.authorize, authorizationHandler({ provider }) as any);
  router.use(paths.token, basicClientAuthToBody, tokenHandler({ provider }) as any);
  router.use(
    paths.register,
    clientRegistrationHandler({
      clientsStore: provider.clientsStore,
      rateLimit: { windowMs: 60 * 60 * 1000, max: 20 },
    }) as any
  );
  router.use(paths.revoke, basicClientAuthToBody, revocationHandler({ provider }) as any);

  // ── Login + rozilik ─────────────────────────────────────────────────────────
  // bcrypt qimmat va parol taxmin qilish nishoni — qattiq chegara
  const approveLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) =>
      renderErrorPage(res, 429, 'Juda ko\'p urinish', '10 daqiqadan keyin qayta urinib ko\'ring.'),
  });

  router.post(paths.approve, approveLimiter, urlencoded({ extended: false, limit: '20kb' }), async (req, res) => {
    try {
      const signed = String(req.body?.signed ?? '');
      const consent = verifyConsentRequest(signed);
      if (!consent) {
        return renderErrorPage(res, 400, 'Sahifa eskirgan', 'Ruxsat sahifasining muddati tugagan yoki buzilgan.');
      }
      const client = await provider.clientsStore.getClient(consent.clientId);
      if (!client || !client.redirect_uris.map(String).includes(consent.redirectUri)) {
        return renderErrorPage(res, 400, 'Noma\'lum ilova', 'Bu ilova ro\'yxatdan o\'tmagan yoki manzili o\'zgargan.');
      }

      const redirect = new URL(consent.redirectUri);
      if (consent.state) redirect.searchParams.set('state', consent.state);

      if (req.body?.decision !== 'approve') {
        redirect.searchParams.set('error', 'access_denied');
        redirect.searchParams.set('error_description', 'Foydalanuvchi rad etdi');
        return res.redirect(302, redirect.href);
      }

      const login = String(req.body?.login ?? '').trim().slice(0, 50);
      const password = String(req.body?.password ?? '').slice(0, 200);
      const user = login
        ? await prisma.user.findUnique({
            where: { login },
            select: { id: true, fullName: true, role: true, isActive: true, passwordHash: true },
          })
        : null;
      const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

      const again = (status: number, error: string) => {
        res.status(status);
        renderConsentPage(res, {
          clientName: client.client_name ?? 'Noma\'lum ilova',
          redirectHost: redirect.host,
          requestedScopes: consent.scopes,
          signed,
          error,
          login,
          access: String(req.body?.access ?? ''),
        });
      };
      if (!user || !valid || !user.isActive) {
        logger.warn(`MCP login muvaffaqiyatsiz: "${login}" (${req.ip})`);
        return again(401, 'Login yoki parol noto\'g\'ri');
      }
      if (!mcpConfig.allowedRoles.includes(user.role)) {
        return again(403, 'Claude connector\'ni faqat administrator ulay oladi');
      }

      // Admin tanlovi hal qiladi (mijoz faqat ils:read so'ragan bo'lsa ham) —
      // token javobidagi `scope` mijozga haqiqiy huquqni bildiradi (RFC 6749 §3.3)
      const scopes =
        req.body?.access === 'read'
          ? [mcpConfig.scopes.read]
          : [mcpConfig.scopes.read, mcpConfig.scopes.write];

      const code = await provider.createAuthorizationCode({
        clientId: client.client_id,
        userId: user.id,
        scopes,
        codeChallenge: consent.codeChallenge,
        redirectUri: consent.redirectUri,
        resource: consent.resource,
      });
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'mcp.connect_approved',
          targetType: 'mcp_client',
          details: { clientId: client.client_id, clientName: client.client_name ?? null, scopes, ip: req.ip ?? null },
        },
      });
      logger.info(`MCP: ${user.fullName} "${client.client_name ?? client.client_id}" ga ruxsat berdi (${scopes.join(' ')})`);

      redirect.searchParams.set('code', code);
      redirect.searchParams.set('iss', mcpConfig.issuerUrl.href); // RFC 9207
      return res.redirect(302, redirect.href);
    } catch (e) {
      logger.error(`MCP approve xatosi: ${e instanceof Error ? e.message : e}`);
      return renderErrorPage(res, 500, 'Xatolik', 'Server xatosi. Birozdan keyin qayta urinib ko\'ring.');
    }
  });

  // ── Qisqa yo'riqnoma (metama'lumotdagi service_documentation) ───────────────
  router.get('/mcp/docs', (_req, res) => {
    res.type('text/plain; charset=utf-8').send(
      [
        'IT Live Score — MCP connector',
        '',
        `Claude (claude.ai) → Settings → Connectors → Add custom connector → URL: ${mcpConfig.resourceUrl.href}`,
        'Ulanishda IT Live Score administrator login/paroli so\'raladi va huquq tanlanadi:',
        '  ils:read  — o\'qish va tahlil',
        '  ils:write — boshqarish (guruh, o\'quvchi, normativ, bosqich)',
        'Ulanishlarni ko\'rish va uzish: panel → Sozlamalar → Claude (MCP).',
      ].join('\n')
    );
  });

  // ── MCP endpoint ────────────────────────────────────────────────────────────
  const sdkBearer = requireBearerAuth({
    verifier: provider,
    requiredScopes: [mcpConfig.scopes.read],
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpConfig.resourceUrl),
  }) as unknown as (req: Request, res: Response, next: NextFunction) => Promise<void>;
  // SDK middleware'i o'z catch'i ichida ham xato tashlashi mumkin (masalan,
  // sarlavhaga ASCII bo'lmagan matn) — unda so'rov javobsiz osilib qolardi.
  const bearer = (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(sdkBearer(req, res, next)).catch((e) => {
      logger.error(`MCP bearer xatosi: ${e instanceof Error ? e.message : e}`);
      if (!res.headersSent) res.status(401).json({ error: 'invalid_token', error_description: 'Token check failed' });
    });

  const mcpLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 240,
    keyGenerator: (req) => `mcp:${(req as any).auth?.clientId ?? req.ip}:${((req as any).auth?.extra as McpTokenExtra | undefined)?.userId ?? ''}`,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Juda ko\'p so\'rov — bir daqiqa kuting' }, id: null }),
  });

  router.post(paths.mcp, bearer as any, mcpLimiter, async (req: Request, res: Response) => {
    const auth = (req as any).auth as { clientId: string; scopes: string[]; extra?: McpTokenExtra };
    const extra = auth.extra!;
    const actor: McpActor = {
      userId: extra.userId,
      fullName: extra.fullName,
      role: extra.role,
      scopes: auth.scopes,
      clientId: auth.clientId,
      clientName: extra.clientName,
      via: 'oauth',
    };
    const server = createMcpServer(actor);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req as any, res as any, req.body);
    } catch (e) {
      logger.error(`MCP so'rov xatosi: ${e instanceof Error ? e.message : e}`);
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Ichki server xatosi' }, id: null });
      }
    }
  });

  // Stateless: SSE oqimi va sessiyani yopish yo'q
  const notAllowed = (_req: Request, res: Response) =>
    res
      .status(405)
      .set('Allow', 'POST')
      .json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null });
  router.get(paths.mcp, notAllowed);
  router.delete(paths.mcp, notAllowed);

  return router;
}

/** MCP_ENABLED=false bo'lsa — hamma MCP yo'llari 404 (favqulodda o'chirish) */
export function mcpDisabled(req: Request, res: Response, next: NextFunction) {
  if (req.path === '/mcp' || req.path.startsWith('/mcp/') || req.path.startsWith('/.well-known/oauth-')) {
    return res.status(404).json({ error: 'MCP o\'chirilgan' });
  }
  next();
}
