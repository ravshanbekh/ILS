/**
 * Panel: Sozlamalar → Claude (MCP). Faqat admin.
 *   GET    /api/mcp/connections        — faol ulanishlar + sozlash ma'lumoti
 *   DELETE /api/mcp/connections/:id    — bitta ulanishni uzish (mijoz+foydalanuvchi)
 *   DELETE /api/mcp/connections        — hammasini uzish (favqulodda)
 *
 * "Ulanish" = bitta mijoz (masalan claude.ai) + bitta foydalanuvchi bo'yicha
 * hali bekor qilinmagan va refresh muddati tugamagan tokenlar.
 */
import { Router } from 'express';
import prisma from '../config/database';
import { authenticate, roleGuard } from '../shared/middleware/auth.middleware';
import { mcpConfig, SUPPORTED_SCOPES } from './config';

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

router.delete('/connections', async (req, res, next) => {
  try {
    const r = await prisma.mcpOAuthToken.updateMany({ where: { revokedAt: null }, data: { revokedAt: new Date() } });
    await prisma.auditLog.create({
      data: { userId: req.user!.userId, action: 'mcp.all_connections_revoked', targetType: 'mcp_client', details: { tokens: r.count } },
    });
    res.json({ success: true, data: { revoked: r.count } });
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
