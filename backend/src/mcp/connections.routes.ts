/**
 * Panel: Sozlamalar → Claude (MCP). Faqat admin.
 *   GET    /api/mcp/connections        — faol ulanishlar + sozlash ma'lumoti
 *   DELETE /api/mcp/connections/:id    — bitta ulanishni uzish (mijoz+foydalanuvchi)
 *   DELETE /api/mcp/connections        — hammasini uzish (favqulodda)
 *
 * "Ulanish" = bitta mijoz (masalan claude.ai) + bitta foydalanuvchi bo'yicha
 * hali bekor qilinmagan va refresh muddati tugamagan tokenlar.
 *
 * Tashqi AI agent kalitlari (agentKeys.ts):
 *   GET    /api/mcp/agent-keys         — ro'yxat (kalitning o'zi yo'q)
 *   POST   /api/mcp/agent-keys         — yangi kalit; javobda BIR MARTA to'liq kalit
 *   DELETE /api/mcp/agent-keys/:id     — bekor qilish
 */
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { authenticate, roleGuard } from '../shared/middleware/auth.middleware';
import { mcpConfig, SUPPORTED_SCOPES } from './config';
import { recentMcpEvents } from './events';
import { createAgentKey, listAgentKeys, MAX_ACTIVE_KEYS, AGENT_KEY_EXPIRY_DAYS } from './agentKeys';

const router = Router();
router.use(authenticate, roleGuard('admin'));

router.get('/connections', async (_req, res, next) => {
  try {
    const now = new Date();
    const tokens = await prisma.mcpOAuthToken.findMany({
      where: { revokedAt: null, refreshExpiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
      select: {
        clientId: true, scopes: true, createdAt: true, lastUsedAt: true, refreshExpiresAt: true,
        user: { select: { id: true, fullName: true, login: true } },
        client: { select: { name: true, metadata: true, createdAt: true } },
      },
    });

    // Rotation har soatda yangi qator yaratadi — mijoz+foydalanuvchi bo'yicha jamlaymiz
    const map = new Map<string, any>();
    for (const t of tokens) {
      const key = `${t.clientId}:${t.user.id}`;
      const cur = map.get(key);
      if (!cur) {
        const redirect = ((t.client.metadata as any)?.redirect_uris ?? [])[0];
        map.set(key, {
          id: key,
          clientId: t.clientId,
          clientName: t.client.name ?? 'Noma\'lum ilova',
          redirectHost: redirect ? safeHost(String(redirect)) : null,
          user: t.user,
          scopes: t.scopes,
          canWrite: t.scopes.includes(mcpConfig.scopes.write),
          connectedAt: t.createdAt,
          lastUsedAt: t.lastUsedAt,
          expiresAt: t.refreshExpiresAt,
        });
      } else {
        if (t.lastUsedAt && (!cur.lastUsedAt || t.lastUsedAt > cur.lastUsedAt)) cur.lastUsedAt = t.lastUsedAt;
        if (t.createdAt < cur.connectedAt) cur.connectedAt = t.createdAt;
      }
    }

    // Birinchi ulanish vaqti (audit jurnalidan) — rotation sababli tokenda saqlanmaydi
    const approvals = await prisma.auditLog.findMany({
      where: { action: 'mcp.connect_approved' },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { userId: true, details: true, createdAt: true },
    });
    for (const c of map.values()) {
      const first = approvals
        .filter((a) => a.userId === c.user.id && (a.details as any)?.clientId === c.clientId)
        .pop();
      if (first) c.connectedAt = first.createdAt;
    }

    res.json({
      success: true,
      data: {
        enabled: mcpConfig.enabled,
        serverUrl: mcpConfig.resourceUrl.href,
        scopes: SUPPORTED_SCOPES,
        connections: [...map.values()],
        // Diagnostika: oxirgi OAuth/MCP so'rovlari (maxfiy narsa yo'q) — ulanish
        // yiqilsa qaysi qadamda va qanday xato bilan ekanini ko'rsatadi
        recentEvents: recentMcpEvents().slice(0, 40),
      },
    });
  } catch (e) {
    next(e);
  }
});

router.delete('/connections/:id', async (req, res, next) => {
  try {
    const [clientId, userId] = String(req.params.id).split(':');
    if (!clientId || !userId) return res.status(400).json({ success: false, error: { message: 'Noto\'g\'ri ID' } });
    const r = await prisma.mcpOAuthToken.updateMany({
      where: { clientId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await prisma.auditLog.create({
      data: { userId: req.user!.userId, action: 'mcp.connection_revoked', targetType: 'mcp_client', details: { clientId, userId, tokens: r.count } },
    });
    res.json({ success: true, data: { revoked: r.count } });
  } catch (e) {
    next(e);
  }
});

// Favqulodda: Claude ulanishlari HAM agent kalitlari — hammasi to'xtaydi
router.delete('/connections', async (req, res, next) => {
  try {
    const now = new Date();
    const r = await prisma.mcpOAuthToken.updateMany({ where: { revokedAt: null }, data: { revokedAt: now } });
    const k = await prisma.mcpAgentKey.updateMany({ where: { revokedAt: null }, data: { revokedAt: now } });
    await prisma.auditLog.create({
      data: { userId: req.user!.userId, action: 'mcp.all_connections_revoked', targetType: 'mcp_client', details: { tokens: r.count, agentKeys: k.count } },
    });
    res.json({ success: true, data: { revoked: r.count, agentKeys: k.count } });
  } catch (e) {
    next(e);
  }
});

// ── Tashqi AI agent kalitlari ────────────────────────────────────────────────

router.get('/agent-keys', async (_req, res, next) => {
  try {
    res.json({
      success: true,
      data: {
        keys: await listAgentKeys(),
        mcpUrl: mcpConfig.resourceUrl.href,
        restUrl: `${mcpConfig.baseUrl}/api/agent/v1`,
        expiryOptions: AGENT_KEY_EXPIRY_DAYS,
        maxActive: MAX_ACTIVE_KEYS,
      },
    });
  } catch (e) {
    next(e);
  }
});

const createKeySchema = z.object({
  name: z.string().trim().min(2, 'Nom kamida 2 belgi').max(100),
  access: z.enum(['read', 'write']),
  // null — muddatsiz (faqat qo'lda bekor qilinadi)
  expiresInDays: z
    .number()
    .int()
    .nullable()
    .default(90)
    .refine((d) => d === null || (AGENT_KEY_EXPIRY_DAYS as readonly number[]).includes(d), `Muddat: ${AGENT_KEY_EXPIRY_DAYS.join(', ')} kun yoki muddatsiz`),
});

router.post('/agent-keys', async (req, res, next) => {
  try {
    const p = createKeySchema.safeParse(req.body ?? {});
    if (!p.success) {
      return res.status(400).json({ success: false, error: { message: p.error.errors.map((e) => e.message).join('; ') } });
    }
    const active = await prisma.mcpAgentKey.count({
      where: { revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    });
    if (active >= MAX_ACTIVE_KEYS) {
      return res.status(400).json({ success: false, error: { message: `Faol kalitlar ${MAX_ACTIVE_KEYS} tadan oshmasin — keraksizini bekor qiling` } });
    }
    const { key, row } = await createAgentKey({
      userId: req.user!.userId,
      name: p.data.name,
      write: p.data.access === 'write',
      expiresInDays: p.data.expiresInDays,
    });
    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'mcp.agent_key_created',
        targetType: 'mcp_agent_key',
        targetId: row.id,
        details: { name: row.name, prefix: row.prefix, scopes: row.scopes, expiresAt: row.expiresAt },
      },
    });
    // Kalit faqat shu javobda — bazada xeshi bor, qayta ko'rsatib bo'lmaydi
    res.status(201).json({ success: true, data: { ...row, key } });
  } catch (e) {
    next(e);
  }
});

router.delete('/agent-keys/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id);
    if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ success: false, error: { message: 'Noto\'g\'ri ID' } });
    const r = await prisma.mcpAgentKey.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (!r.count) return res.status(404).json({ success: false, error: { message: 'Faol kalit topilmadi' } });
    await prisma.auditLog.create({
      data: { userId: req.user!.userId, action: 'mcp.agent_key_revoked', targetType: 'mcp_agent_key', targetId: id, details: {} },
    });
    res.json({ success: true, data: { revoked: true } });
  } catch (e) {
    next(e);
  }
});

function safeHost(u: string) {
  try {
    return new URL(u).host;
  } catch {
    return null;
  }
}

export default router;
