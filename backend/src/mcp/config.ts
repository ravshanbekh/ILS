/**
 * MCP (Claude connector) sozlamalari.
 *
 * Tashqi manzil: claude.ai serverlari shu URL'ga ulanadi va OAuth
 * metama'lumotidagi barcha manzillar shundan quriladi. Production'da
 * MCP_PUBLIC_URL berilmasa itlivescore.uz olinadi.
 */
const DEFAULT_PROD_URL = 'https://itlivescore.uz';

function publicBaseUrl(): string {
  const raw =
    process.env.MCP_PUBLIC_URL ||
    (process.env.NODE_ENV === 'production'
      ? DEFAULT_PROD_URL
      : `http://localhost:${process.env.PORT || '5000'}`);
  return raw.replace(/\/+$/, '');
}

export const mcpConfig = {
  /** MCP_ENABLED=false — connector butunlay o'chiriladi (favqulodda kalit) */
  enabled: process.env.MCP_ENABLED !== 'false',

  baseUrl: publicBaseUrl(),
  get issuerUrl() {
    return new URL(this.baseUrl);
  },
  /** MCP endpoint — claude.ai'ga shu manzil kiritiladi */
  get resourceUrl() {
    return new URL(`${this.baseUrl}/mcp`);
  },

  /** OAuth yo'llari (frontend nginx /mcp ni backend'ga yo'naltiradi) */
  paths: {
    mcp: '/mcp',
    authorize: '/mcp/oauth/authorize',
    approve: '/mcp/oauth/approve',
    token: '/mcp/oauth/token',
    register: '/mcp/oauth/register',
    revoke: '/mcp/oauth/revoke',
  },

  accessTokenTtlSec: 60 * 60, // 1 soat
  refreshTokenTtlSec: 30 * 24 * 60 * 60, // 30 kun
  authCodeTtlSec: 5 * 60, // 5 daqiqa
  /** Login/rozilik sahifasidagi imzolangan so'rov muddati */
  consentTtlSec: 15 * 60,

  /**
   * Ruxsat etilgan redirect_uri hostlari. Ochiq Dynamic Client Registration
   * bo'lgani uchun bu SHART: aks holda istalgan sayt o'z manzili bilan
   * mijoz ro'yxatdan o'tkazib, adminni haqiqiy login sahifamizga yuborib,
   * kodni o'ziga oqizib olishi mumkin edi (phishing).
   * Loopback (localhost/127.0.0.1) — Claude Desktop va Claude Code uchun.
   * Qo'shimcha hostlar: MCP_ALLOWED_REDIRECT_HOSTS="a.com,b.com".
   */
  allowedRedirectHosts: [
    'claude.ai',
    'claude.com',
    ...(process.env.MCP_ALLOWED_REDIRECT_HOSTS || '')
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
  ],

  scopes: {
    read: 'ils:read',
    write: 'ils:write',
  },

  /** Connector'ga faqat shu rollar ulana oladi */
  allowedRoles: ['admin'] as string[],
};

export const SUPPORTED_SCOPES = [mcpConfig.scopes.read, mcpConfig.scopes.write];

export function isAllowedRedirectUri(uri: string): boolean {
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.hash) return false;
  const host = u.hostname.toLowerCase();
  if (u.protocol === 'http:' && (host === 'localhost' || host === '127.0.0.1' || host === '[::1]')) {
    return true;
  }
  if (u.protocol !== 'https:') return false;
  return mcpConfig.allowedRedirectHosts.some((h) => host === h || host.endsWith(`.${h}`));
}
