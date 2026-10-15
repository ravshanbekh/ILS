/**
 * MCP diagnostika jurnali — OAuth va /mcp so'rovlarining natijasi.
 *
 * Nega kerak: claude.ai ulanish xatosini faqat "wasn't connected" deb
 * ko'rsatadi; qaysi qadam (register / authorize / token / /mcp) va qanday
 * xato bilan yiqilganini bilish uchun server tomonda iz kerak.
 *
 * Xotirada oxirgi 100 ta hodisa (server qayta ishga tushsa tozalanadi) +
 * winston log (docker logs). MAXFIY NARSA YOZILMAYDI: kod, token, sir,
 * parol, so'rov tanasi yo'q — faqat yo'l, status, OAuth xato kodi/izohi,
 * grant turi, mijoz usuli va User-Agent.
 */
import type { Request, Response, NextFunction } from 'express';
import logger from '../shared/utils/logger';

export interface McpEvent {
  at: string;
  method: string;
  path: string;
  status: number;
  ms: number;
  step: string;
  error?: string;
  detail?: string;
  clientAuth?: string;
  ua?: string;
}

const MAX = 100;
const events: McpEvent[] = [];

export const recentMcpEvents = () => [...events].reverse();

function stepOf(path: string, body: any): string {
  if (path.startsWith('/.well-known/')) return 'metadata';
  if (path.endsWith('/register')) return 'register';
  if (path.endsWith('/authorize')) return 'authorize';
  if (path.endsWith('/approve')) return 'login';
  if (path.endsWith('/token')) return `token:${String(body?.grant_type ?? '?').slice(0, 30)}`;
  if (path.endsWith('/revoke')) return 'revoke';
  if (path === '/mcp') return `mcp:${String(body?.method ?? '?').slice(0, 40)}`;
  return 'other';
}

/** JSON javobdan OAuth xato kodini ushlab qolish uchun res.json ni o'raydi */
export function mcpEventLogger(req: Request, res: Response, next: NextFunction) {
  const started = Date.now();
  let error: string | undefined;
  let detail: string | undefined;
  const origJson = res.json.bind(res);
  res.json = ((payload: any) => {
    if (payload && typeof payload === 'object') {
      if (typeof payload.error === 'string') error = payload.error;
      else if (payload.error?.message) error = String(payload.error.message);
      if (typeof payload.error_description === 'string') detail = payload.error_description;
    }
    return origJson(payload);
  }) as any;

  const auth = req.headers.authorization ?? '';
  const clientAuth = /^basic /i.test(auth)
    ? 'basic'
    : /^bearer /i.test(auth)
      ? 'bearer'
      : req.body?.client_secret
        ? 'post'
        : req.body?.client_id
          ? 'none'
          : undefined;

  // router.use(path, ...) ichida req.path qisqartirilgan — to'liq yo'l originalUrl'da
  const fullPath = (req.originalUrl || req.url).split('?')[0];
  res.on('finish', () => {
    // Redirect bilan qaytgan OAuth xatosi (authorize → ?error=...)
    const loc = res.getHeader('location');
    if (!error && typeof loc === 'string' && /[?&]error=/.test(loc)) {
      try {
        const u = new URL(loc);
        error = u.searchParams.get('error') ?? undefined;
        detail = u.searchParams.get('error_description') ?? undefined;
      } catch {
        /* ignore */
      }
    }
    const ev: McpEvent = {
      at: new Date().toISOString(),
      method: req.method,
      path: fullPath,
      status: res.statusCode,
      ms: Date.now() - started,
      step: stepOf(fullPath, req.body),
      ...(error ? { error: error.slice(0, 80) } : {}),
      ...(detail ? { detail: detail.slice(0, 200) } : {}),
      ...(clientAuth ? { clientAuth } : {}),
      ua: String(req.headers['user-agent'] ?? '').slice(0, 80),
    };
    events.push(ev);
    if (events.length > MAX) events.shift();
    const line = `MCP ${ev.step} ${ev.method} ${ev.path} → ${ev.status}${ev.error ? ` ${ev.error}` : ''}${ev.detail ? ` (${ev.detail})` : ''}${ev.clientAuth ? ` [auth:${ev.clientAuth}]` : ''} ua="${ev.ua}"`;
    if (ev.status >= 400 && ev.status !== 401) logger.warn(line);
    else logger.info(line);
  });
  next();
}

/**
 * client_secret_basic (RFC 6749 §2.3.1): mijoz sirini Authorization: Basic
 * sarlavhasida yuboradi. SDK handlerlari sirni FAQAT tanadan o'qiydi —
 * shuning uchun bu yerda sarlavhadan tanaga ko'chiramiz. Ilgari bu yo'q edi:
 * auth usulini ko'rsatmay ro'yxatdan o'tgan mijoz (RFC 7591 bo'yicha standart
 * — basic) token ololmasdi va claude.ai "wasn't connected" ko'rsatardi.
 */
export function basicClientAuthToBody(req: Request, _res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (h && /^basic\s+/i.test(h)) {
    try {
      const decoded = Buffer.from(h.replace(/^basic\s+/i, '').trim(), 'base64').toString('utf8');
      const i = decoded.indexOf(':');
      if (i > 0) {
        const unform = (s: string) => decodeURIComponent(s.replace(/\+/g, ' '));
        const id = unform(decoded.slice(0, i));
        const secret = unform(decoded.slice(i + 1));
        const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
        if (!body.client_id) body.client_id = id;
        // Tanadagi client_id boshqa bo'lsa — sirni qo'shmaymiz (SDK rad etadi)
        if (!body.client_secret && body.client_id === id) body.client_secret = secret;
        req.body = body;
      }
    } catch {
      /* noto'g'ri sarlavha — SDK o'zi invalid_client qaytaradi */
    }
  }
  next();
}
