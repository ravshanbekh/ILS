/**
 * Tashqi AI agent uchun REST yo'li — MCP bilmaydigan agentlar
 * (OpenAI/Gemini function calling, n8n HTTP Request, Make, ChatGPT Actions).
 *
 *   GET  /api/agent/v1/whoami             — kalit egasi, huquq, amallar soni
 *   GET  /api/agent/v1/tools              — amallar: nomi, tavsifi, JSON Schema
 *        ?format=openai                   — OpenAI "tools" massivi ko'rinishida
 *   POST /api/agent/v1/tools/:name        — amalni bajarish (body = argumentlar)
 *   GET  /api/agent/v1/openapi.json       — OpenAPI 3.1 (GPT Actions / Make / Postman)
 *
 * Bu MCP amallarining o'zi: har so'rovda MCP server + ichki (in-memory) mijoz
 * ko'tariladi, shuning uchun validatsiya, cheklovlar (admin akkauntlar, tasdiq
 * kodi), audit (via: agent_rest) va natija formati /mcp bilan aynan bir xil.
 * Kirish: faqat agent kaliti yoki MCP OAuth tokeni (Bearer).
 */
import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import logger from '../shared/utils/logger';
import { mcpConfig } from './config';
import { actorFromAuth, canWrite, McpActor } from './context';
import { createMcpServer } from './server';
import { IlsOAuthProvider } from './oauth/provider';
import { agentKeyAuth, clientIp } from './http';

const MAX_TOOL_MS = 60_000;

type Tool = { name: string; title?: string; description?: string; inputSchema: Record<string, unknown>; annotations?: Record<string, unknown> };

/** Bitta so'rov uchun MCP server + ichki mijoz; ish tugagach ikkalasi yopiladi */
async function withClient<T>(actor: McpActor, fn: (c: Client) => Promise<T>): Promise<T> {
  const server = createMcpServer(actor);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'ils-agent-rest', version: '1.0.0' });
  await server.connect(serverSide);
  await client.connect(clientSide);
  try {
    return await fn(client);
  } finally {
    await client.close().catch(() => {});
    await server.close().catch(() => {});
  }
}

const listTools = (actor: McpActor) => withClient(actor, async (c) => (await c.listTools()).tools as unknown as Tool[]);

/** Amal natijasi matni odatda JSON — agentga tayyor obyekt qilib beramiz */
function parseContent(content: unknown): { text: string; data: unknown } {
  const text = Array.isArray(content)
    ? content.filter((x: any) => x?.type === 'text').map((x: any) => String(x.text)).join('\n')
    : '';
  try {
    return { text, data: JSON.parse(text) };
  } catch {
    return { text, data: null };
  }
}

const fail = (res: Response, status: number, message: string, extra: Record<string, unknown> = {}) =>
  res.status(status).json({ success: false, error: { message, ...extra } });

export function createAgentRouter() {
  const router = Router();
  const provider = new IlsOAuthProvider();

  // Kalit tekshiruvidan OLDIN — IP bo'yicha. Bu yo'l umumiy /api IP chegarasidan
  // chiqarilgan, kalit chegarasi esa faqat tekshiruvdan keyin ishlaydi: busiz
  // soxta kalitli so'rovlar cheksiz bazaga borardi.
  router.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 600,
      keyGenerator: (req) => `agent-ip:${clientIp(req) ?? 'unknown'}`,
      standardHeaders: false,
      legacyHeaders: false,
      handler: (_req, res) => fail(res, 429, 'Juda ko\'p so\'rov — bir daqiqa kuting'),
    })
  );

  // Kirish: agent kaliti (ils_ak_…) yoki MCP OAuth tokeni
  router.use(async (req: Request, res: Response, next) => {
    try {
      const r = await agentKeyAuth(req, res, mcpConfig.scopes.read, 'rest');
      if (r === 'ok') {
        (req as any).actor = actorFromAuth((req as any).auth, 'agent_rest');
        return next();
      }
      if (r === 'rejected') return;
      const h = req.headers.authorization ?? '';
      const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
      if (!token) {
        res.set('WWW-Authenticate', 'Bearer');
        return fail(res, 401, 'Authorization: Bearer <agent kaliti> sarlavhasi kerak');
      }
      const auth = await provider.verifyAccessToken(token).catch(() => null);
      if (!auth || !auth.scopes.includes(mcpConfig.scopes.read)) {
        res.set('WWW-Authenticate', 'Bearer error="invalid_token"');
        return fail(res, 401, 'Kalit yaroqsiz, muddati tugagan yoki bekor qilingan');
      }
      (req as any).auth = auth;
      (req as any).actor = actorFromAuth(auth as any, 'agent_rest');
      next();
    } catch (e) {
      logger.error(`Agent REST auth xatosi: ${e instanceof Error ? e.message : e}`);
      if (!res.headersSent) fail(res, 500, 'Ichki server xatosi');
    }
  });

  // Har kalitga alohida chegara (umumiy /api IP chegarasi bu yo'lga qo'llanmaydi)
  router.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 240,
      keyGenerator: (req) => `agent:${(req as any).auth?.clientId ?? req.ip}`,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_req, res) => fail(res, 429, 'Juda ko\'p so\'rov — bir daqiqa kuting (240/daqiqa)'),
    })
  );

  router.get('/whoami', async (req, res) => {
    const actor: McpActor = (req as any).actor;
    try {
      const tools = await listTools(actor);
      res.json({
        success: true,
        data: {
          actingAs: { userId: actor.userId, fullName: actor.fullName, role: actor.role },
          client: actor.clientName,
          scopes: actor.scopes,
          canWrite: canWrite(actor),
          tools: tools.length,
          mcpUrl: mcpConfig.resourceUrl.href,
        },
      });
    } catch (e) {
      logger.error(`Agent REST whoami xatosi: ${e instanceof Error ? e.message : e}`);
      fail(res, 500, 'Ichki server xatosi');
    }
  });

  router.get('/tools', async (req, res) => {
    const actor: McpActor = (req as any).actor;
    try {
      const tools = await listTools(actor);
      if (req.query.format === 'openai') {
        // OpenAI Chat Completions / Responses "tools" — to'g'ridan-to'g'ri berish mumkin
        return res.json({
          success: true,
          data: tools.map((t) => ({
            type: 'function',
            function: { name: t.name, description: (t.description ?? '').slice(0, 1024), parameters: t.inputSchema },
          })),
        });
      }
      res.json({
        success: true,
        data: tools.map((t) => ({
          name: t.name,
          title: t.title ?? null,
          description: t.description ?? '',
          inputSchema: t.inputSchema,
          destructive: !!t.annotations?.destructiveHint,
          readOnly: !!t.annotations?.readOnlyHint,
        })),
      });
    } catch (e) {
      logger.error(`Agent REST tools xatosi: ${e instanceof Error ? e.message : e}`);
      fail(res, 500, 'Ichki server xatosi');
    }
  });

  router.post('/tools/:name', async (req, res) => {
    const actor: McpActor = (req as any).actor;
    const name = String(req.params.name);
    const args = req.body ?? {};
    if (typeof args !== 'object' || Array.isArray(args)) return fail(res, 400, 'Body JSON obyekt bo\'lishi kerak (amal argumentlari)');
    try {
      const out = await withClient(actor, async (c) => {
        const tools = (await c.listTools()).tools;
        if (!tools.some((t) => t.name === name)) return { status: 404 as const };
        const r = await c.callTool({ name, arguments: args }, undefined, { timeout: MAX_TOOL_MS });
        return { status: 200 as const, r };
      });
      if (out.status === 404) {
        return fail(res, 404, `Amal topilmadi: ${name}`, {
          hint: canWrite(actor) ? 'GET /api/agent/v1/tools — mavjud amallar' : 'Yozish amallari uchun kalitga "O\'qish + boshqarish" huquqi kerak',
        });
      }
      const { text, data } = parseContent(out.r.content);
      if (out.r.isError) {
        // SDK argument xatosini ham amal xatosi qilib qaytaradi — 400 bilan ajratamiz
        const status = /^Input validation error|^MCP error -32602/.test(text) ? 400 : 422;
        return fail(res, status, text || 'Amal bajarilmadi', { tool: name });
      }
      res.json({ success: true, tool: name, data: data ?? text });
    } catch (e) {
      logger.error(`Agent REST ${name} xatosi: ${e instanceof Error ? e.message : e}`);
      fail(res, 500, 'Amalni bajarishda server xatosi');
    }
  });

  router.get('/openapi.json', async (req, res) => {
    const actor: McpActor = (req as any).actor;
    try {
      const tools = await listTools(actor);
      res.json(buildOpenApi(tools));
    } catch (e) {
      logger.error(`Agent REST openapi xatosi: ${e instanceof Error ? e.message : e}`);
      fail(res, 500, 'Ichki server xatosi');
    }
  });

  router.use((_req, res) => fail(res, 404, 'Endpoint topilmadi — GET /api/agent/v1/tools'));
  return router;
}

/** OpenAPI 3.1: har amal — alohida POST yo'l (operationId = amal nomi) */
function buildOpenApi(tools: Tool[]) {
  const paths: Record<string, unknown> = {};
  for (const t of tools) {
    paths[`/tools/${t.name}`] = {
      post: {
        operationId: t.name,
        summary: (t.title ?? t.name).slice(0, 120),
        description: t.description ?? '',
        'x-destructive': !!t.annotations?.destructiveHint,
        requestBody: { required: true, content: { 'application/json': { schema: t.inputSchema } } },
        responses: {
          '200': { description: 'Bajarildi', content: { 'application/json': { schema: { $ref: '#/components/schemas/Ok' } } } },
          '400': { description: 'Argument xatosi', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '422': { description: 'Biznes qoidasi rad etdi (masalan, admin akkauntga tegib bo\'lmaydi)', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    };
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'IT Live Score — Agent API',
      version: '1.0.0',
      description:
        'IT Live Score boshqaruv amallari (MCP amallari bilan bir xil). Kirish: Authorization: Bearer ils_ak_… (panel → Sozlamalar → Claude (MCP) → Tashqi AI agent).',
    },
    servers: [{ url: `${mcpConfig.baseUrl}/api/agent/v1` }],
    security: [{ agentKey: [] }],
    paths,
    components: {
      securitySchemes: { agentKey: { type: 'http', scheme: 'bearer', description: 'ils_ak_… agent kaliti' } },
      schemas: {
        Ok: { type: 'object', properties: { success: { const: true }, tool: { type: 'string' }, data: {} } },
        Error: {
          type: 'object',
          properties: { success: { const: false }, error: { type: 'object', properties: { message: { type: 'string' } } } },
        },
      },
    },
  };
}
