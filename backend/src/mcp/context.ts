import prisma from '../config/database';
import logger from '../shared/utils/logger';
import { ApiError } from '../shared/middleware/errorHandler';
import { mcpConfig } from './config';

/**
 * MCP so'rovini kim va qanday huquq bilan bajarayotgani.
 * OAuth orqali: token egasi (admin). stdio (lokal) orqali: jarayon egasi.
 */
export interface McpActor {
  userId: string | null;
  fullName: string;
  role: string;
  scopes: string[];
  clientId: string;
  clientName: string | null;
  via: 'oauth' | 'stdio';
}

export const canWrite = (actor: McpActor) => actor.scopes.includes(mcpConfig.scopes.write);

type ToolText = { type: 'text'; text: string };
export type ToolResult = { content: ToolText[]; isError?: boolean };

/** Javob — ixcham JSON. Claude uni o'qib tahlil qiladi. */
export function ok(value: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, bigintSafe) }] };
}

export function fail(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

function bigintSafe(_key: string, v: unknown) {
  return typeof v === 'bigint' ? v.toString() : v;
}

/**
 * Xatoni foydalanuvchiga xavfsiz matnga aylantiradi.
 * ApiError — biznes qoidasi xabari (masalan "Guruh topilmadi"), uni ko'rsatamiz.
 * Boshqa xatolar (baza, ulanish) ichida ulanish satri yoki SQL bo'lishi
 * mumkin — faqat umumiy matn qaytadi, tafsilot serverda logga yoziladi.
 */
export function toolError(error: unknown, tool: string): ToolResult {
  if (error instanceof ApiError) return fail(error.message);
  if (error instanceof McpUserError) return fail(error.message);
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String((error as any).code) : 'unknown';
  logger.error(`MCP ${tool} xatosi (${code}): ${error instanceof Error ? error.message : String(error)}`);
  return fail('Amalni bajarishda server xatosi yuz berdi. Tafsilot server jurnalida.');
}

/** Foydalanuvchiga ko'rsatsa bo'ladigan xato (noto'g'ri argument va h.k.) */
export class McpUserError extends Error {}

/**
 * Yozish amallari va SQL so'rovlari audit jurnaliga tushadi
 * (Sozlamalar → Audit). action: "mcp.<amal>".
 */
export async function audit(
  actor: McpActor,
  tool: string,
  details: Record<string, unknown>,
  target?: { type: string; id?: string | null }
) {
  if (!actor.userId) return; // stdio — bazada egasi yo'q
  try {
    await prisma.auditLog.create({
      data: {
        userId: actor.userId,
        action: `mcp.${tool}`.slice(0, 100),
        targetType: target?.type?.slice(0, 50) ?? null,
        targetId: target?.id && /^[0-9a-f-]{36}$/i.test(target.id) ? target.id : null,
        details: {
          via: actor.via,
          clientId: actor.clientId,
          clientName: actor.clientName,
          ...details,
        } as any,
      },
    });
  } catch (err) {
    logger.warn(`MCP audit yozilmadi (${tool}): ${err instanceof Error ? err.message : err}`);
  }
}

// ── Maxfiy qiymatlarni yashirish ─────────────────────────────────────────────

const BCRYPT_RE = /\$2[abxy]\$\d{2}\$[./A-Za-z0-9]{53}/g;
const SECRET_KEY_RE = /(password|passwd|secret|token|_hash$|hash$|chat_link_code|chatlinkcode)/i;
export const REDACTED = '[yashirilgan]';

/**
 * Natijadan parol xeshlari va tokenlarni olib tashlaydi — ustun nomi
 * bo'yicha HAM, qiymat ichida (masalan row_to_json(users)::text) HAM.
 */
export function redact(value: unknown, key = ''): unknown {
  if (key && SECRET_KEY_RE.test(key) && !/^token_?version$/i.test(key) && value !== null) return REDACTED;
  if (typeof value === 'string') return value.replace(BCRYPT_RE, REDACTED);
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((v) => redact(v));
  if (value && typeof value === 'object') {
    // Prisma.Decimal
    if (typeof (value as any).toFixed === 'function' && typeof (value as any).toNumber === 'function') {
      return (value as any).toNumber();
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = redact(v, k);
    return out;
  }
  return value;
}

// ── Sana yordamchilari (Toshkent vaqti) ───────────────────────────────────────

const TZ = 'Asia/Tashkent';

export function tashkentNow() {
  return new Date().toLocaleString('sv-SE', { timeZone: TZ }).replace(' ', 'T') + '+05:00';
}

/** "2026-10-15" (Toshkent kuni) */
export function tashkentDay(d = new Date()) {
  return d.toLocaleDateString('sv-SE', { timeZone: TZ });
}

export function parseDay(s: string | undefined, field: string): Date | undefined {
  if (!s) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new McpUserError(`${field}: sana YYYY-MM-DD ko'rinishida bo'lsin`);
  const d = new Date(`${s}T00:00:00+05:00`);
  if (Number.isNaN(d.getTime())) throw new McpUserError(`${field}: noto'g'ri sana`);
  return d;
}

export const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 1000) / 10 : null);
