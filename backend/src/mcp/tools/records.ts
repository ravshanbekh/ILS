/**
 * Qo'lda to'g'rilash — istalgan jadvaldagi yozuvni ko'rish, tahrirlash,
 * yaratish, o'chirish va ORQAGA QAYTARISH (undo).
 *
 * Domen amallari (ils_create_group, ils_check_submission ...) biznes
 * qoidalarini bajaradi — iloji bo'lsa ular afzal. Bu qatlam — ular qamramagan
 * xatolarni tuzatish uchun ("ball noto'g'ri yozilib qolgan", "sana adashgan").
 *
 * Xavfsizlik:
 *  1. Ikki bosqich: confirmToken'siz chaqiruv faqat KO'RINISH (oldin → keyin)
 *     va imzolangan tasdiq kodi qaytaradi. Kod: shu admin + shu jadval + shu
 *     yozuv + aynan shu o'zgarish + yozuvning hozirgi holati xeshi, 10 daqiqa.
 *     Ko'rinishdan keyin yozuv o'zgargan bo'lsa — rad etiladi.
 *  2. Yopiq: OAuth/audit/ruxsat jadvallari; parol, token, xesh ustunlari;
 *     id/createdAt; admin akkauntlari va "admin" roli (imtiyoz oshirish yo'q).
 *  3. O'chirish faqat "barg" jadvallarda (bolalari yo'q) — kaskad bilan
 *     ko'rinmas ma'lumot yo'qolmasin va undo to'liq tiklay olsin.
 *  4. Har o'zgarish audit_logs ga to'liq "oldin/keyin" bilan yoziladi —
 *     ils_undo_change shu yozuvdan tiklaydi (keyin o'zgargan bo'lsa to'xtaydi).
 */
import crypto from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v3';
import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { env } from '../../config/env';
import milestonesService from '../../modules/milestones/milestones.service';
import permissionsService from '../../modules/permissions/permissions.service';
import { PERMISSIONS } from '../../shared/constants/permissions';
import { McpActor, McpUserError, ok, fail, redact, toolError } from '../context';
import { guarded, CONFIRM_NOTE } from './write';

type DmmfModel = Prisma.DMMF.Model;
type DmmfField = Prisma.DMMF.Field;

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const BLOCKED_MODELS = new Set(['McpOAuthClient', 'McpOAuthCode', 'McpOAuthToken', 'AuditLog', 'UserPermission']);
const SECRET_FIELD_RE = /(password|token|secret|hash)/i;
const SYSTEM_FIELDS = new Set(['id', 'createdAt']);
/** User jadvalida faqat shular (rol — admin'dan tashqari) */
const USER_EDITABLE = new Set(['fullName', 'login', 'bio', 'filial', 'avatarUrl', 'isActive', 'role']);
const TOKEN_TTL_SEC = 10 * 60;

// ── Model va maydonlar ────────────────────────────────────────────────────────

const models = () => Prisma.dmmf.datamodel.models;
const tableOf = (m: DmmfModel) => m.dbName ?? m.name;

function resolveModel(table: string): DmmfModel {
  const t = table.trim().toLowerCase();
  const m = models().find((x) => tableOf(x).toLowerCase() === t || x.name.toLowerCase() === t);
  if (!m) throw new McpUserError(`"${table}" jadvali topilmadi. ils_db_schema bilan ro'yxatni ko'ring.`);
  if (BLOCKED_MODELS.has(m.name)) throw new McpUserError(`"${tableOf(m)}" jadvalini bu amal bilan o'zgartirib bo'lmaydi`);
  if (!m.fields.some((f) => f.name === 'id' && f.isId)) throw new McpUserError(`"${tableOf(m)}" jadvalida yagona id yo'q`);
  return m;
}

const scalarFields = (m: DmmfModel) => m.fields.filter((f) => f.kind === 'scalar' || f.kind === 'enum');
const colName = (f: DmmfField) => f.dbName ?? f.name;
const delegate = (m: DmmfModel) => (prisma as any)[m.name.charAt(0).toLowerCase() + m.name.slice(1)];
/** Bolalari yo'q model — o'chirilsa kaskad bo'lmaydi, undo to'liq tiklaydi */
const isLeaf = (m: DmmfModel) => !m.fields.some((f) => f.kind === 'object' && f.isList);

/** Kiruvchi kalit — Prisma nomi (fullName) yoki ustun nomi (full_name) */
function findField(m: DmmfModel, key: string): DmmfField {
  const f = scalarFields(m).find((x) => x.name === key || colName(x) === key);
  if (!f) throw new McpUserError(`"${tableOf(m)}" da "${key}" ustuni yo'q (yoki bu ustun emas, bog'lanish)`);
  return f;
}

function assertEditable(m: DmmfModel, f: DmmfField) {
  if (SYSTEM_FIELDS.has(f.name) || f.isUpdatedAt) throw new McpUserError(`"${colName(f)}" tizim ustuni — o'zgartirilmaydi`);
  if (SECRET_FIELD_RE.test(f.name) && f.name !== 'tokenVersion') throw new McpUserError(`"${colName(f)}" maxfiy ustun — o'zgartirilmaydi`);
  if (f.name === 'tokenVersion') throw new McpUserError('token_version — o\'zgartirilmaydi');
  if (m.name === 'User' && !USER_EDITABLE.has(f.name)) {
    throw new McpUserError(`users.${colName(f)} ni bu yerda o'zgartirib bo'lmaydi (parol — ils_reset_password)`);
  }
}

function coerce(f: DmmfField, v: unknown): unknown {
  const name = colName(f);
  if (v === null) {
    if (f.isRequired) throw new McpUserError(`${name}: bo'sh (null) bo'lishi mumkin emas`);
    return null;
  }
  if (f.isList) {
    if (!Array.isArray(v)) throw new McpUserError(`${name}: massiv kutilgan`);
    return v.map((x) => coerce({ ...f, isList: false, isRequired: true } as DmmfField, x));
  }
  if (f.kind === 'enum') {
    const e = Prisma.dmmf.datamodel.enums.find((x) => x.name === f.type);
    const vals = e?.values.map((x) => x.name) ?? [];
    if (typeof v !== 'string' || !vals.includes(v)) throw new McpUserError(`${name}: ${vals.join(' | ')} dan biri bo'lsin`);
    return v;
  }
  switch (f.type) {
    case 'String':
      if (typeof v !== 'string') throw new McpUserError(`${name}: matn kutilgan`);
      return v;
    case 'Int': {
      const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
      if (typeof n !== 'number' || !Number.isInteger(n)) throw new McpUserError(`${name}: butun son kutilgan`);
      return n;
    }
    case 'Float':
    case 'Decimal': {
      const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
      if (typeof n !== 'number' || !Number.isFinite(n)) throw new McpUserError(`${name}: son kutilgan`);
      return n;
    }
    case 'Boolean':
      if (v === true || v === 'true') return true;
      if (v === false || v === 'false') return false;
      throw new McpUserError(`${name}: true/false kutilgan`);
    case 'DateTime': {
      if (v instanceof Date) return v;
      if (typeof v !== 'string') throw new McpUserError(`${name}: sana (ISO yoki YYYY-MM-DD) kutilgan`);
      const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00.000Z`) : new Date(v);
      if (Number.isNaN(d.getTime())) throw new McpUserError(`${name}: noto'g'ri sana`);
      return d;
    }
    case 'BigInt':
      try {
        return BigInt(v as any);
      } catch {
        throw new McpUserError(`${name}: butun son kutilgan`);
      }
    case 'Json':
      return v;
    default:
      throw new McpUserError(`${name}: ${f.type} turini bu amal bilan o'zgartirib bo'lmaydi`);
  }
}

/** JSON'ga xavfsiz (audit snapshot va solishtirish uchun) */
function plain(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'bigint') return v.toString();
  if (Array.isArray(v)) return v.map(plain);
  if (typeof v === 'object' && typeof (v as any).toFixed === 'function' && typeof (v as any).toNumber === 'function') {
    return (v as any).toNumber();
  }
  return v;
}

function snapshot(m: DmmfModel, row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const f of scalarFields(m)) out[f.name] = plain(row[f.name]);
  return out;
}

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${stable((v as any)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const tokenKey = () => crypto.createHash('sha256').update(`${env.JWT_SECRET}:ils-mcp-record-change:v1`).digest();

function signChange(p: { u: string; t: string; a: string; id: string; d: string; b: string }) {
  const body = Buffer.from(JSON.stringify({ ...p, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC })).toString('base64url');
  return `${body}.${crypto.createHmac('sha256', tokenKey()).update(body).digest('base64url')}`;
}
function verifyChange(token: string) {
  const [body, sig] = String(token).split('.');
  if (!body || !sig) return null;
  const exp = crypto.createHmac('sha256', tokenKey()).update(body).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== exp.length || !crypto.timingSafeEqual(given, exp)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return p.exp >= Date.now() / 1000 ? (p as { u: string; t: string; a: string; id: string; d: string; b: string }) : null;
  } catch {
    return null;
  }
}

function prismaError(e: unknown): string | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') return `Takrorlanish: bunday qiymat allaqachon bor (${(e.meta as any)?.target ?? 'unique'})`;
    if (e.code === 'P2003') return `Bog'lanish xatosi: ko'rsatilgan ID li yozuv yo'q (${(e.meta as any)?.field_name ?? 'FK'})`;
    if (e.code === 'P2025') return 'Yozuv topilmadi';
    if (e.code === 'P2011' || e.code === 'P2012') return `Majburiy ustun to'ldirilmagan: ${(e.meta as any)?.constraint ?? (e.meta as any)?.path ?? ''}`;
  }
  if (e instanceof Prisma.PrismaClientValidationError) {
    const line = e.message.split('\n').filter(Boolean).pop() ?? '';
    return `Qiymat xatosi: ${line.slice(0, 300)}`;
  }
  return null;
}

/** Biznes izchilligi: servis chetlab o'tilganda ham bog'liq narsalar yangilansin */
async function afterChange(m: DmmfModel, id: string, changed: string[]) {
  if (m.name === 'Group' && changed.some((c) => ['startDate', 'durationMonths', 'lessonDayType'].includes(c))) {
    await milestonesService.syncGroupSchedule(id).catch(() => {});
  }
}

async function adminGuards(m: DmmfModel, before: Record<string, unknown> | null, data: Record<string, unknown>, actor: McpActor) {
  if (m.name !== 'User') return;
  if (before?.role === 'admin') throw new McpUserError('Administrator akkauntini MCP orqali o\'zgartirib bo\'lmaydi');
  if (before?.id === actor.userId) throw new McpUserError('O\'z akkauntingizni MCP orqali o\'zgartirib bo\'lmaydi');
  if (data.role === 'admin') throw new McpUserError('MCP orqali hech kimni administrator qilib bo\'lmaydi');
}

// ── Amallar ───────────────────────────────────────────────────────────────────

export function registerRecordReadTools(server: McpServer, _actor: McpActor) {
  server.registerTool(
    'ils_get_record',
    {
      title: 'Yozuvni to\'liq ko\'rish',
      description: 'Istalgan jadvaldan bitta yozuvni ID bo\'yicha barcha ustunlari bilan qaytaradi (maxfiylar yashirilgan). Tahrirlashdan oldin hozirgi qiymatlarni ko\'rish uchun.',
      inputSchema: { table: z.string().max(64).describe('Jadval nomi (masalan "submissions")'), id: z.string().max(64) },
      annotations: READ,
    },
    async ({ table, id }) => {
      try {
        const m = models().find((x) => tableOf(x).toLowerCase() === table.toLowerCase() || x.name.toLowerCase() === table.toLowerCase());
        if (!m || ['McpOAuthClient', 'McpOAuthCode', 'McpOAuthToken'].includes(m.name)) return fail('Jadval topilmadi');
        const row = await delegate(m).findUnique({ where: { id } });
        if (!row) return fail('Yozuv topilmadi');
        const out: Record<string, unknown> = {};
        for (const f of scalarFields(m)) out[colName(f)] = row[f.name];
        return ok({ table: tableOf(m), record: redact(out), leafTable: isLeaf(m) });
      } catch (e) {
        return toolError(e, 'ils_get_record');
      }
    }
  );

  server.registerTool(
    'ils_get_permissions',
    {
      title: 'Ruxsatlar katalogi',
      description: 'Barcha xodim ruxsatlari (kalit + nomi). userId berilsa — o\'sha xodimning hozirgi ruxsatlari ham.',
      inputSchema: { userId: z.string().uuid().optional() },
      annotations: READ,
    },
    async ({ userId }) => {
      try {
        const catalog = Object.entries(PERMISSIONS).map(([key, v]) => ({ key, label: (v as any).label }));
        const current = userId ? await permissionsService.getUserPermissions(userId) : undefined;
        return ok({ catalog, user: userId ? { id: userId, permissions: current } : undefined });
      } catch (e) {
        return toolError(e, 'ils_get_permissions');
      }
    }
  );
}

export function registerRecordWriteTools(server: McpServer, actor: McpActor) {
  server.registerTool(
    'ils_record_change',
    {
      title: 'Qo\'lda to\'g\'rilash (istalgan jadval)',
      description:
        'Istalgan jadvaldagi yozuvni tahrirlash (update), yangi yozuv qo\'shish (create) yoki o\'chirish (delete; faqat bolalari yo\'q jadvallarda). IKKI BOSQICH: 1) confirmToken\'siz chaqiring — "oldin → keyin" ko\'rinishi va confirmToken qaytadi; uni foydalanuvchiga ko\'rsatib tasdiq oling; 2) xuddi shu argumentlar + confirmToken bilan qayta chaqiring. Natijada auditId — ils_undo_change bilan qaytarish mumkin. Biznes qoidasi bor amallar uchun avval maxsus amallardan (ils_check_submission, ils_grade_lesson va h.k.) foydalaning; bu — ular qamramagan tuzatishlar uchun. Ustun nomlari: ils_db_schema / ils_get_record.' + CONFIRM_NOTE,
      inputSchema: {
        table: z.string().max(64),
        action: z.enum(['update', 'create', 'delete']),
        id: z.string().max(64).optional().describe('update/delete uchun majburiy'),
        data: z.record(z.unknown()).optional().describe('update/create: { ustun: qiymat } (Prisma yoki snake_case nomi)'),
        confirmToken: z.string().max(4000).optional().describe('1-bosqich javobidagi kod'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async ({ table, action, id, data, confirmToken }) => {
      // 1-bosqich (ko'rinish) — hech narsa yozmaydi, auditga ham tushmaydi
      let m: DmmfModel;
      let plan: {
        patch: Record<string, unknown>;
        before: Record<string, unknown> | null;
        changed: string[];
        targetId: string;
      };
      try {
        m = resolveModel(table);
        plan = await buildPlan(m, action, id, data ?? {}, actor);
      } catch (e) {
        if (e instanceof McpUserError) return fail(e.message);
        return fail(prismaError(e) ?? 'Rejani tuzib bo\'lmadi');
      }
      const digest = sha(stable(plan.patch));
      const beforeHash = sha(stable(plan.before));
      const preview = {
        table: tableOf(m),
        action,
        id: plan.targetId,
        changes: Object.fromEntries(
          plan.changed.map((k) => {
            const f = m.fields.find((x) => x.name === k)!;
            return [colName(f), { before: redact(plan.before?.[k] ?? null, colName(f)), after: redact(plan.patch[k] ?? null, colName(f)) }];
          })
        ),
      };
      if (action === 'update' && plan.changed.length === 0) return ok({ ...preview, note: 'O\'zgarish yo\'q — qiymatlar allaqachon shunday.' });

      if (!confirmToken) {
        return ok({
          stage: 'preview',
          ...preview,
          ...(action === 'delete' ? { deleting: redact(plan.before) } : {}),
          confirmToken: signChange({ u: actor.userId ?? '', t: m.name, a: action, id: plan.targetId, d: digest, b: beforeHash }),
          next: 'Foydalanuvchiga o\'zgarishni ko\'rsating; tasdiqlasa, xuddi shu argumentlar + confirmToken bilan qayta chaqiring (10 daqiqa amal qiladi).',
        });
      }

      // 2-bosqich (qo'llash)
      // Qobiq auditi alohida nomda: "mcp.record_*" faqat undo qila oladigan to'liq yozuvlar uchun
      return guarded(actor, `record_change_${action}_call`, { table: tableOf(m), id: action === 'create' ? '(yangi)' : plan.targetId }, { type: tableOf(m), id: action === 'create' ? null : plan.targetId }, async () => {
        const t = verifyChange(confirmToken);
        if (!t) throw new McpUserError('confirmToken yaroqsiz yoki muddati o\'tgan — 1-bosqichni qaytadan bajaring');
        // create: yangi ID 1-bosqichda yaratilib kodga muhrlangan — o'shani ishlatamiz
        if (action === 'create') plan.targetId = t.id;
        if (t.u !== (actor.userId ?? '') || t.t !== m.name || t.a !== action || t.id !== plan.targetId || t.d !== digest) {
          throw new McpUserError('confirmToken boshqa o\'zgarish uchun berilgan — argumentlar ko\'rinishdagidan farq qiladi');
        }
        if (t.b !== beforeHash) throw new McpUserError('Ko\'rinishdan keyin yozuv o\'zgargan — 1-bosqichni qaytadan bajaring');

        const d = delegate(m);
        let after: Record<string, unknown> | null = null;
        try {
          if (action === 'update') after = snapshot(m, await d.update({ where: { id: plan.targetId }, data: plan.patch }));
          if (action === 'create') {
            const idField = m.fields.find((f) => f.name === 'id')!;
            const created = await d.create({ data: idField.type === 'String' ? { id: plan.targetId, ...plan.patch } : plan.patch });
            plan.targetId = String(created.id);
            after = snapshot(m, created);
          }
          if (action === 'delete') await d.delete({ where: { id: plan.targetId } });
        } catch (e) {
          const msg = prismaError(e);
          if (msg) throw new McpUserError(msg);
          throw e;
        }
        await afterChange(m, plan.targetId, plan.changed);

        const audit = await prisma.auditLog.create({
          data: {
            userId: actor.userId,
            action: `mcp.record_${action}`,
            targetType: tableOf(m).slice(0, 50),
            targetId: /^[0-9a-f-]{36}$/i.test(plan.targetId) ? plan.targetId : null,
            details: {
              via: actor.via,
              clientId: actor.clientId,
              model: m.name,
              table: tableOf(m),
              id: plan.targetId,
              changed: plan.changed,
              before: plan.before,
              after,
            } as any,
          },
          select: { id: true },
        });
        return { applied: true, ...preview, id: plan.targetId, auditId: audit.id, undo: `ils_undo_change({ auditId: "${audit.id}" })` };
      });
    }
  );

  server.registerTool(
    'ils_undo_change',
    {
      title: 'O\'zgarishni orqaga qaytarish',
      description:
        'ils_record_change bilan qilingan o\'zgarishni audit yozuvidagi "oldin" holatiga qaytaradi (update → eski qiymatlar, create → yozuvni o\'chirish, delete → qayta tiklash). Keyin yana o\'zgargan bo\'lsa — qaytarmaydi. confirm=false — faqat nima qaytishini ko\'rsatadi.' + CONFIRM_NOTE,
      inputSchema: {
        auditId: z.string().uuid().describe('ils_record_change natijasidagi auditId (yoki ils_audit_log dan)'),
        confirm: z.boolean().default(false).describe('true — qo\'llash; false — ko\'rinish'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async ({ auditId, confirm }) => {
      const run = async () => {
        const log = await prisma.auditLog.findUnique({ where: { id: auditId } });
        if (!log || !['mcp.record_update', 'mcp.record_create', 'mcp.record_delete'].includes(log.action)) {
          throw new McpUserError('Bu audit yozuvi ils_record_change o\'zgarishi emas — domen amallarini teskari amal bilan qaytaring');
        }
        const already = await prisma.auditLog.findFirst({
          where: { action: 'mcp.undo', details: { path: ['ref'], equals: auditId } },
          select: { id: true, createdAt: true },
        });
        if (already) throw new McpUserError(`Bu o'zgarish allaqachon qaytarilgan (${already.createdAt.toISOString()})`);

        const det = log.details as any;
        const m = resolveModel(det.model);
        const d = delegate(m);
        const current = await d.findUnique({ where: { id: det.id } });
        const kind = log.action.replace('mcp.record_', '');

        const restoreData = (snap: Record<string, unknown>, only?: string[]) => {
          const out: Record<string, unknown> = {};
          for (const f of scalarFields(m)) {
            if (only && !only.includes(f.name)) continue;
            if (f.name === 'id' || f.isUpdatedAt) continue;
            if (!(f.name in snap)) continue;
            out[f.name] = snap[f.name] === null ? null : coerce({ ...f, isRequired: false } as DmmfField, snap[f.name]);
          }
          return out;
        };

        let plan: string;
        let apply: () => Promise<unknown>;
        if (kind === 'update') {
          if (!current) throw new McpUserError('Yozuv endi mavjud emas');
          const now = snapshot(m, current);
          const drift = (det.changed as string[]).filter((k) => stable(now[k]) !== stable(det.after?.[k]));
          if (drift.length) throw new McpUserError(`Qaytarib bo'lmaydi: keyin yana o'zgargan ustunlar — ${drift.join(', ')}`);
          plan = `${det.table}#${det.id}: ${det.changed.join(', ')} eski qiymatga qaytadi`;
          apply = () => d.update({ where: { id: det.id }, data: restoreData(det.before, det.changed) });
        } else if (kind === 'create') {
          if (!current) throw new McpUserError('Yaratilgan yozuv allaqachon yo\'q');
          if (!isLeaf(m)) throw new McpUserError('Bu jadvalda bog\'liq yozuvlar bo\'lishi mumkin — avtomatik o\'chirilmaydi');
          plan = `${det.table}#${det.id} o'chiriladi (yaratilgan yozuv)`;
          apply = () => d.delete({ where: { id: det.id } });
        } else {
          if (current) throw new McpUserError('Yozuv allaqachon mavjud');
          plan = `${det.table}#${det.id} qayta tiklanadi`;
          apply = () => d.create({ data: { id: det.id, ...restoreData(det.before) } });
        }
        if (!confirm) return { stage: 'preview', plan, next: 'Tasdiqlansa confirm: true bilan qayta chaqiring' };

        try {
          await apply();
        } catch (e) {
          const msg = prismaError(e);
          if (msg) throw new McpUserError(msg);
          throw e;
        }
        await afterChange(m, det.id, det.changed ?? []);
        await prisma.auditLog.create({
          data: {
            userId: actor.userId,
            action: 'mcp.undo',
            targetType: String(det.table).slice(0, 50),
            targetId: /^[0-9a-f-]{36}$/i.test(det.id) ? det.id : null,
            details: { ref: auditId, kind, via: actor.via, clientId: actor.clientId } as any,
          },
        });
        return { undone: true, plan };
      };
      if (!confirm) {
        try {
          return ok(await run());
        } catch (e) {
          return e instanceof McpUserError ? fail(e.message) : toolError(e, 'ils_undo_change');
        }
      }
      return guarded(actor, 'undo_change_call', { auditId }, { type: 'audit', id: auditId }, run);
    }
  );
}

async function buildPlan(
  m: DmmfModel,
  action: 'update' | 'create' | 'delete',
  id: string | undefined,
  data: Record<string, unknown>,
  actor: McpActor
) {
  const d = delegate(m);
  if (action === 'update' || action === 'delete') {
    if (!id) throw new McpUserError('id kerak');
    const row = await d.findUnique({ where: { id } });
    if (!row) throw new McpUserError('Yozuv topilmadi');
    const before = snapshot(m, row);
    if (action === 'delete') {
      if (m.name === 'User') throw new McpUserError('Foydalanuvchini o\'chirib bo\'lmaydi — ils_set_user_active bilan nofaol qiling');
      if (!isLeaf(m)) {
        throw new McpUserError(
          `"${tableOf(m)}" ga bog'liq yozuvlar bor (kaskad o'chirish xavfi) — maxsus amaldan foydalaning (masalan guruh uchun ils_group_lifecycle archive)`
        );
      }
      await adminGuards(m, before, {}, actor);
      return { patch: {}, before, changed: [] as string[], targetId: id };
    }
    if (Object.keys(data).length === 0) throw new McpUserError('data bo\'sh');
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      const f = findField(m, k);
      assertEditable(m, f);
      patch[f.name] = coerce(f, v);
    }
    await adminGuards(m, before, patch, actor);
    const changed = Object.keys(patch).filter((k) => stable(plain(patch[k])) !== stable(before[k]));
    const onlyChanged = Object.fromEntries(changed.map((k) => [k, patch[k]]));
    return { patch: onlyChanged, before, changed, targetId: id };
  }

  // create
  if (m.name === 'User') throw new McpUserError('Foydalanuvchi — ils_create_user bilan (parol va ruxsatlar to\'g\'ri o\'rnatiladi)');
  if (Object.keys(data).length === 0) throw new McpUserError('data bo\'sh');
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    const f = findField(m, k);
    assertEditable(m, f);
    patch[f.name] = coerce(f, v);
  }
  const missing = scalarFields(m)
    .filter((f) => f.isRequired && !f.hasDefaultValue && !f.isUpdatedAt && f.name !== 'id' && !(f.name in patch))
    .map(colName);
  if (missing.length) throw new McpUserError(`Majburiy ustunlar yetishmaydi: ${missing.join(', ')}`);
  return { patch, before: null, changed: Object.keys(patch), targetId: crypto.randomUUID() };
}
