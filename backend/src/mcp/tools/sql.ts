/**
 * Erkin tahlil: baza sxemasi + faqat-o'qish SQL.
 *
 * Himoya qatlamlari (bittasiga emas, hammasiga tayanamiz):
 *  1. So'rov `SELECT * FROM (<sql>) q LIMIT n` ichiga o'raladi — bitta
 *     SELECT/WITH dan boshqa narsa (";", DDL, COPY) sintaksis xatosi beradi.
 *  2. `SET TRANSACTION READ ONLY` — Postgres o'zi har qanday yozishni rad etadi.
 *  3. statement_timeout — og'ir so'rov serverni bosib qolmaydi.
 *  4. Xavfli funksiyalar (fayl o'qish, boshqa so'rovni satrdan bajarish,
 *     sozlama o'zgartirish) ro'yxat bo'yicha rad etiladi.
 *  5. Natijada parol xeshlari va tokenlar yashiriladi — ustun nomi bo'yicha
 *     ham, qiymat ichida ham (row_to_json(users) kabi aylanma yo'llar uchun).
 *  6. Har so'rov audit jurnaliga yoziladi.
 * Yana kuchliroq: MCP_SQL_DATABASE_URL ga alohida faqat-o'qish Postgres
 * foydalanuvchisi berilsa, SQL o'sha ulanish orqali bajariladi (MCP.md).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v3';
import { Prisma, PrismaClient } from '@prisma/client';
import prisma from '../../config/database';
import { McpActor, ok, fail, toolError, redact, audit } from '../context';

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

/** Sxemada ko'rsatilmaydigan jadval/ustunlar */
const HIDDEN_MODELS = new Set(['McpOAuthClient', 'McpOAuthCode', 'McpOAuthToken']);
const HIDDEN_COLUMN_RE = /(password|token|secret|hash|chat_link_code)/i;

const FORBIDDEN_RE = new RegExp(
  [
    'pg_read_file', 'pg_read_binary_file', 'pg_ls_', 'pg_stat_file', 'lo_import', 'lo_export', 'lo_get',
    'dblink', 'set_config', 'pg_sleep', 'pg_terminate_backend', 'pg_cancel_backend', 'pg_reload_conf',
    'pg_rotate_logfile', 'query_to_xml', 'query_to_json', 'xmlparse', 'pg_execute', 'current_setting',
    'mcp_oauth',
  ].join('|'),
  'i'
);

let sqlClient: PrismaClient | null = null;
function sqlDb(): PrismaClient {
  const url = process.env.MCP_SQL_DATABASE_URL;
  if (!url) return prisma;
  if (!sqlClient) sqlClient = new PrismaClient({ datasources: { db: { url } }, log: ['error'] });
  return sqlClient;
}

/** Izohlar va satrlarni olib tashlab, kalit so'zlarni tekshirish uchun */
function stripForScan(sql: string) {
  return sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:''|[^'])*'/g, "''");
}

export function validateSql(raw: string): string {
  const sql = raw.trim().replace(/;+\s*$/, '');
  if (!sql) throw new Error('Bo\'sh so\'rov');
  if (sql.length > 8000) throw new Error('So\'rov juda uzun (8000 belgidan oshmasin)');
  const scan = stripForScan(sql);
  if (!/^\s*(select|with)\b/i.test(scan)) throw new Error('Faqat SELECT yoki WITH bilan boshlanadigan so\'rov ruxsat etilgan');
  if (scan.includes(';')) throw new Error('Bitta so\'rov yuboring (";" ishlatmang)');
  if (/\$\$/.test(scan)) throw new Error('Dollar-quote ($$) ruxsat etilmaydi');
  const bad = scan.match(FORBIDDEN_RE);
  if (bad) throw new Error(`"${bad[0]}" ruxsat etilmaydi`);
  if (/\b(insert|update|delete|merge|truncate|drop|alter|create|grant|revoke|copy|vacuum|lock|call|do)\b\s/i.test(scan.replace(/\bupdated?_at\b|\bcreated_at\b|\bdeleted?_at\b/gi, ''))) {
    // READ ONLY tranzaksiya baribir to'xtatadi — bu aniqroq xato uchun
    throw new Error('Faqat o\'qish so\'rovlari ruxsat etilgan');
  }
  return sql;
}

export function registerSqlTools(server: McpServer, actor: McpActor) {
  server.registerTool(
    'ils_db_schema',
    {
      title: 'Baza sxemasi',
      description:
        'PostgreSQL jadvallari, ustunlari (haqiqiy snake_case nomlar), turlari, bog\'lanishlar va enum qiymatlari. ils_sql_query yozishdan oldin chaqiring. table berilsa — faqat o\'sha jadval(lar).',
      inputSchema: {
        tables: z.array(z.string().max(64)).max(20).optional().describe('Jadval nomlari (masalan ["groups","submissions"]); berilmasa — hammasi qisqa ko\'rinishda'),
      },
      annotations: READ,
    },
    async ({ tables }) => {
      try {
        const models = Prisma.dmmf.datamodel.models.filter((m) => !HIDDEN_MODELS.has(m.name));
        const want = tables?.map((t) => t.toLowerCase());
        const tableName = (m: (typeof models)[number]) => m.dbName ?? m.name;
        const selected = want ? models.filter((m) => want.includes(tableName(m).toLowerCase()) || want.includes(m.name.toLowerCase())) : models;
        if (want && selected.length === 0) return fail('Bunday jadval topilmadi. Parametrsiz chaqirib ro\'yxatni ko\'ring.');

        const detailed = !!want;
        const enums = Prisma.dmmf.datamodel.enums;
        const usedEnums = new Set<string>();
        const out = selected.map((m) => {
          const cols = m.fields
            .filter((f) => f.kind !== 'object')
            .filter((f) => !HIDDEN_COLUMN_RE.test(f.dbName ?? f.name) || /token_version/.test(f.dbName ?? ''))
            .map((f) => {
              if (f.kind === 'enum') usedEnums.add(f.type);
              const col = f.dbName ?? f.name;
              if (!detailed) return col;
              return `${col} ${f.type}${f.isList ? '[]' : ''}${f.isRequired ? '' : '?'}${f.isId ? ' PK' : ''}${f.isUnique ? ' UNIQUE' : ''}`;
            });
          const rels = m.fields
            .filter((f) => f.kind === 'object' && f.relationFromFields && f.relationFromFields.length)
            .map((f) => {
              const target = models.find((x) => x.name === f.type);
              const fromCols = f.relationFromFields!.map((ff) => m.fields.find((x) => x.name === ff)?.dbName ?? ff);
              return `${fromCols.join(',')} -> ${target ? tableName(target) : f.type}.id`;
            });
          return { table: tableName(m), columns: cols, ...(detailed && rels.length ? { foreignKeys: rels } : {}) };
        });
        return ok({
          note: detailed
            ? 'Vaqtlar UTC (timestamp). Toshkent: AT TIME ZONE \'Asia/Tashkent\'. Ballarni guruh bo\'yicha hisoblashda submissions.group_id eskirgan bo\'lishi mumkin — group_students va group_normatives orqali bog\'lang.'
            : 'Qisqa ko\'rinish. Turlar va FK uchun tables=[...] bilan qayta chaqiring.',
          tables: out,
          enums: Object.fromEntries(enums.filter((e) => !want || usedEnums.has(e.name)).map((e) => [e.dbName ?? e.name, e.values.map((v) => v.name)])),
        });
      } catch (e) {
        return toolError(e, 'ils_db_schema');
      }
    }
  );

  server.registerTool(
    'ils_sql_query',
    {
      title: 'SQL tahlil (faqat o\'qish)',
      description:
        'Murakkab tahlil uchun bitta PostgreSQL SELECT/WITH so\'rovini faqat-o\'qish rejimida bajaradi (8 soniya, ko\'pi bilan 1000 qator). Jadval/ustun nomlari uchun avval ils_db_schema. Maxfiy ustunlar (parol xeshi, tokenlar) natijada yashiriladi. Har so\'rov audit jurnaliga yoziladi.',
      inputSchema: {
        sql: z.string().min(1).max(8000).describe('Bitta SELECT yoki WITH so\'rov, ";" siz'),
        maxRows: z.number().int().min(1).max(1000).default(200),
        purpose: z.string().max(300).optional().describe('So\'rov maqsadi (audit uchun, qisqa)'),
      },
      annotations: READ,
    },
    async ({ sql, maxRows, purpose }) => {
      let checked: string;
      try {
        checked = validateSql(sql);
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Noto\'g\'ri so\'rov');
      }
      const started = Date.now();
      try {
        const rows = await sqlDb().$transaction(async (tx) => {
          await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
          await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '8s'");
          await tx.$executeRawUnsafe("SET LOCAL idle_in_transaction_session_timeout = '10s'");
          return tx.$queryRawUnsafe<Record<string, unknown>[]>(
            `SELECT * FROM (\n${checked}\n) AS mcp_q LIMIT ${maxRows + 1}`
          );
        }, { timeout: 12_000, maxWait: 5_000 });

        const truncated = rows.length > maxRows;
        const data = redact(rows.slice(0, maxRows)) as Record<string, unknown>[];
        await audit(actor, 'sql_query', {
          sql: checked.slice(0, 2000),
          purpose: purpose ?? null,
          rows: Math.min(rows.length, maxRows),
          ms: Date.now() - started,
        });
        return ok({ rowCount: data.length, truncated, columns: data[0] ? Object.keys(data[0]) : [], rows: data });
      } catch (e) {
        await audit(actor, 'sql_query', { sql: checked.slice(0, 2000), purpose: purpose ?? null, error: true });
        // Postgres xato matni (sintaksis, ustun yo'q) — Claude so'rovni tuzatishi uchun kerak.
        // U ulanish satrini o'z ichiga olmaydi; boshqa (ulanish) xatolar umumiy matn bilan.
        const pg = extractPgMessage(e);
        if (pg) return fail(`SQL xatosi: ${pg}`);
        return toolError(e, 'ils_sql_query');
      }
    }
  );
}

function extractPgMessage(e: unknown): string | null {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return null;
  const meta = e.meta as { message?: string; code?: string } | undefined;
  const msg = meta?.message ?? '';
  if (!msg) return null;
  return msg.replace(/postgres(ql)?:\/\/\S+/gi, '[ulanish]').slice(0, 500);
}
