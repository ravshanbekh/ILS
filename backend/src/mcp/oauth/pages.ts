/**
 * OAuth login + rozilik sahifasi (server tomonda chiziladi, JS yo'q).
 *
 * Xavfsizlik:
 *  - So'rov parametrlari (client, redirect_uri, PKCE challenge, scope) HMAC
 *    bilan imzolanadi — forma maydonlarini qo'lda o'zgartirib bo'lmaydi.
 *    Kalit JWT_SECRET dan HOSIL qilinadi (o'zi emas): bu imzo hech qachon
 *    oddiy API tokeni sifatida qabul qilinmaydi.
 *  - client_name begona mijozdan keladi — HAR DOIM escape qilinadi.
 *  - CSP: skript yo'q, iframe'ga qo'yib bo'lmaydi (clickjacking), forma faqat
 *    o'zimizga va ro'yxatdagi redirect manziliga yuboriladi.
 */
import crypto from 'crypto';
import type { Response } from 'express';
import { env } from '../../config/env';
import { mcpConfig } from '../config';

export interface ConsentRequest {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state?: string;
  scopes: string[];
  resource?: string;
}

const key = () => crypto.createHash('sha256').update(`${env.JWT_SECRET}:ils-mcp-consent:v1`).digest();

export function signConsentRequest(req: ConsentRequest): string {
  const body = Buffer.from(
    JSON.stringify({ ...req, exp: Math.floor(Date.now() / 1000) + mcpConfig.consentTtlSec })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', key()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyConsentRequest(signed: string): ConsentRequest | null {
  if (typeof signed !== 'string' || signed.length > 8000) return null;
  const [body, sig] = signed.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', key()).update(body).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (typeof data.exp !== 'number' || data.exp < Date.now() / 1000) return null;
    return data as ConsentRequest;
  } catch {
    return null;
  }
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function securityHeaders(res: Response, redirectOrigin?: string) {
  const formTargets = ["'self'", redirectOrigin].filter(Boolean).join(' ');
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; form-action ${formTargets}; frame-ancestors 'none'; base-uri 'none'`
  );
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
}

const STYLES = `
:root{--bg:#f4f5f8;--card:#fff;--ink:#14161c;--muted:#5d6472;--line:#e3e6ec;--brand:#e5322d;--brand-ink:#fff;--navy:#0f1b2d;--ok:#1f8a4c;--warn-bg:#fff4e5;--warn:#9a5b00;--err-bg:#fdecec;--err:#b42318}
@media (prefers-color-scheme:dark){:root{--bg:#0d0f14;--card:#161a22;--ink:#eef0f4;--muted:#a3abba;--line:#2a303c;--navy:#0a1220;--warn-bg:#2e2208;--warn:#f5c26b;--err-bg:#3a1414;--err:#ff9b94}}
*{box-sizing:border-box}html,body{margin:0}
body{background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;min-height:100vh;display:flex;flex-direction:column;padding:24px 16px}
.card{margin:auto;width:100%;max-width:440px;background:var(--card);border:1px solid var(--line);border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.08)}
.head{background:var(--navy);color:#fff;padding:20px 24px}
.brand{font-weight:800;letter-spacing:.3px;font-size:13px;opacity:.85}.brand b{color:var(--brand)}
h1{margin:6px 0 0;font-size:20px;line-height:1.3}
.body{padding:22px 24px 24px}
.app{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border:1px solid var(--line);border-radius:12px;margin-bottom:16px}
.app .dot{flex:none;width:36px;height:36px;border-radius:10px;background:var(--brand);color:#fff;display:grid;place-items:center;font-weight:800}
.app small{color:var(--muted);display:block}
label{display:block;font-size:13px;font-weight:600;margin:12px 0 6px}
input[type=text],input[type=password]{width:100%;padding:11px 12px;border:1px solid var(--line);border-radius:10px;background:transparent;color:var(--ink);font-size:15px}
input:focus{outline:2px solid var(--brand);outline-offset:1px;border-color:transparent}
fieldset{border:0;padding:0;margin:16px 0 0}legend{font-size:13px;font-weight:600;margin-bottom:8px}
.opt{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:1px solid var(--line);border-radius:10px;margin-bottom:8px;cursor:pointer}
.opt input{margin-top:4px;accent-color:var(--brand)}.opt small{display:block;color:var(--muted)}
.row{display:flex;gap:10px;margin-top:20px}
button{flex:1;padding:12px;border-radius:10px;border:1px solid var(--line);font-size:15px;font-weight:600;cursor:pointer;background:transparent;color:var(--ink)}
button.primary{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}
.note{font-size:12.5px;color:var(--muted);margin-top:16px}
.alert{padding:10px 12px;border-radius:10px;font-size:14px;margin-bottom:14px}
.alert.err{background:var(--err-bg);color:var(--err)}.alert.warn{background:var(--warn-bg);color:var(--warn)}
.done{text-align:center;padding:28px 24px}
`;

function page(title: string, inner: string) {
  return `<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title><style>${STYLES}</style></head><body>${inner}</body></html>`;
}

export function renderConsentPage(
  res: Response,
  opts: { clientName: string; redirectHost: string; requestedScopes: string[]; signed: string; error?: string; login?: string; access?: string }
) {
  const wantsWrite = opts.requestedScopes.includes(mcpConfig.scopes.write);
  // Xato bilan qayta chizilganda tanlov saqlanadi; standart — xavfsizrog'i (o'qish)
  const writeChecked = wantsWrite && opts.access === 'write';
  let redirectOrigin: string | undefined;
  try {
    const req = verifyConsentRequest(opts.signed);
    if (req) redirectOrigin = new URL(req.redirectUri).origin;
  } catch {
    /* ignore */
  }
  securityHeaders(res, redirectOrigin);
  const initial = esc(opts.clientName.trim().charAt(0).toUpperCase() || '?');
  const html = page(
    'Ulanishga ruxsat — IT Live Score',
    `<main class="card">
  <div class="head"><div class="brand"><b>IT LIVE</b> SCORE</div><h1>Ilovaga ruxsat berish</h1></div>
  <div class="body">
    <div class="app"><div class="dot">${initial}</div><div><b>${esc(opts.clientName)}</b><small>${esc(opts.redirectHost)} — IT Live Score ma'lumotlariga ulanmoqchi</small></div></div>
    ${opts.error ? `<div class="alert err" role="alert">${esc(opts.error)}</div>` : ''}
    <form method="post" action="${mcpConfig.paths.approve}" autocomplete="on">
      <input type="hidden" name="signed" value="${esc(opts.signed)}">
      <label for="login">Login</label>
      <input id="login" name="login" type="text" autocomplete="username" required maxlength="50" value="${esc(opts.login ?? '')}" ${opts.login ? '' : 'autofocus'}>
      <label for="password">Parol</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required maxlength="200" ${opts.login ? 'autofocus' : ''}>
      <fieldset>
        <legend>Qanday huquq berilsin?</legend>
        <label class="opt"><input type="radio" name="access" value="read" ${writeChecked ? '' : 'checked'}><span>Faqat o'qish va tahlil<small>Guruhlar, o'quvchilar, normativlar, hisobotlar, SQL tahlil. Hech narsa o'zgarmaydi.</small></span></label>
        ${wantsWrite ? `<label class="opt"><input type="radio" name="access" value="write" ${writeChecked ? 'checked' : ''}><span>O'qish va boshqarish<small>Guruh yaratish/tahrirlash, o'quvchini qo'shish/o'tkazish, normativlar, bosqichlar. Har amal audit jurnaliga yoziladi.</small></span></label>` : ''}
      </fieldset>
      <div class="row">
        <button type="submit" name="decision" value="deny">Rad etish</button>
        <button type="submit" name="decision" value="approve" class="primary">Ruxsat berish</button>
      </div>
    </form>
    <p class="note">Parolingiz faqat IT Live Score serverida tekshiriladi va ${esc(opts.clientName)} ga berilmaydi. Faqat administratorlar ulay oladi. Ulanishni istalgan vaqtda Sozlamalar → Claude (MCP) bo'limida uzish mumkin.</p>
  </div>
</main>`
  );
  res.send(html);
}

export function renderErrorPage(res: Response, status: number, title: string, message: string) {
  securityHeaders(res);
  res.status(status).send(
    page(
      `${title} — IT Live Score`,
      `<main class="card"><div class="head"><div class="brand"><b>IT LIVE</b> SCORE</div><h1>${esc(title)}</h1></div><div class="body"><div class="alert warn">${esc(message)}</div><p class="note">Claude'dagi connector sahifasiga qaytib, "Connect" ni qaytadan bosing.</p></div></main>`
    )
  );
}
