/**
 * MCP connector — uchdan-uchgacha sinov (lokal baza bilan).
 *
 * Claude (claude.ai) qiladigan hamma narsani ketma-ket bajaradi:
 *   metama'lumot → DCR → login sahifasi → approve → PKCE token → /mcp amallari
 *   → yozish amallari → refresh rotation → o'g'irlangan refresh → uzish.
 *
 * Faqat MCP router'i ko'tariladi (bot, cron ishga tushmaydi). Fixture'lar
 * "mcpe2e-" belgisi bilan yaratiladi va oxirida o'chiriladi.
 *
 * Ishlatish (backend papkasidan, backend/.env dagi LOKAL baza bilan):
 *   npm run e2e:mcp
 */
import crypto from 'crypto';

const PORT = Number(process.env.MCP_E2E_PORT || 5099);
const BASE = `http://127.0.0.1:${PORT}`;
process.env.MCP_PUBLIC_URL = BASE;
process.env.MCP_ENABLED = 'true';

let pass = 0;
let failed = 0;
function check(name: string, cond: unknown, extra = '') {
  if (cond) {
    pass++;
    console.log(`  OK   ${name}${extra ? ' — ' + extra : ''}`);
  } else {
    failed++;
    console.log(`  XATO ${name}${extra ? ' — ' + extra : ''}`);
  }
}

const b64url = (b: Buffer) => b.toString('base64url');
const REDIRECT = 'https://claude.ai/api/mcp/auth_callback';

async function main() {
  const { default: express } = await import('express');
  const { default: prisma } = await import('../src/config/database');
  const { createMcpRouter } = await import('../src/mcp/http');
  const { default: connectionsRoutes } = await import('../src/mcp/connections.routes');
  const { errorHandler } = await import('../src/shared/middleware/errorHandler');
  const { env } = await import('../src/config/env');
  const bcrypt = (await import('bcryptjs')).default;
  const jwt = (await import('jsonwebtoken')).default;

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(createMcpRouter());
  app.use('/api/mcp', connectionsRoutes);
  app.use(errorHandler);
  const server = app.listen(PORT);

  const tag = `mcpe2e-${Date.now().toString(36)}`;
  const tagU = tag.replace(/-/g, '_'); // panel login qoidasi '-' ga ruxsat bermaydi
  const adminPassword = crypto.randomBytes(12).toString('base64url');
  const ids = { users: [] as string[], groups: [] as string[], normatives: [] as string[] };

  try {
    // ── Fixture'lar ───────────────────────────────────────────────────────────
    const hash = await bcrypt.hash(adminPassword, 4);
    const admin = await prisma.user.create({ data: { fullName: 'MCP E2E Admin', login: `${tag}-a`, passwordHash: hash, role: 'admin' } });
    const teacher = await prisma.user.create({ data: { fullName: 'MCP E2E Ustoz', login: `${tag}-t`, passwordHash: hash, role: 'teacher' } });
    const students = await Promise.all(
      [1, 2, 3].map((i) =>
        prisma.user.create({ data: { fullName: `MCP E2E O'quvchi ${i}`, login: `${tag}-s${i}`, passwordHash: hash, role: 'student' } })
      )
    );
    ids.users.push(admin.id, teacher.id, ...students.map((s) => s.id));
    const group = await prisma.group.create({ data: { name: `${tag}-G1`.slice(0, 50), teacherId: teacher.id } });
    const group2 = await prisma.group.create({ data: { name: `${tag}-G2`.slice(0, 50), teacherId: teacher.id } });
    ids.groups.push(group.id, group2.id);
    await prisma.groupStudent.createMany({ data: students.map((s) => ({ groupId: group.id, studentId: s.id })) });
    const norms = await Promise.all(
      [9001, 9002].map((n) => prisma.normative.create({ data: { taskNumber: n, title: `${tag} normativ ${n}`, timeLimit: 10 } }))
    );
    ids.normatives.push(...norms.map((n) => n.id));
    await prisma.groupNormative.create({ data: { groupId: group.id, normativeId: norms[0].id } });
    await prisma.submission.create({
      data: { studentId: students[0].id, normativeId: norms[0].id, groupId: group.id, youtubeUrl: 'https://youtu.be/x', status: 'checked', result: 'green', score: 40, checkedById: teacher.id, checkedAt: new Date() },
    });
    await prisma.submission.create({
      data: { studentId: students[1].id, normativeId: norms[0].id, groupId: group.id, youtubeUrl: 'https://youtu.be/y' },
    });

    // ── 1. Kashfiyot ──────────────────────────────────────────────────────────
    console.log('\n1) Kashfiyot va metama\'lumot');
    const unauth = await fetch(`${BASE}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const wwwAuth = unauth.headers.get('www-authenticate') ?? '';
    check('tokensiz /mcp → 401', unauth.status === 401);
    check('WWW-Authenticate resource_metadata bor', wwwAuth.includes('resource_metadata='), wwwAuth.slice(0, 120));
    const prm = await (await fetch(`${BASE}/.well-known/oauth-protected-resource/mcp`)).json();
    check('resource metadata', prm.resource === `${BASE}/mcp` && prm.authorization_servers?.[0]?.startsWith(BASE));
    const asm = await (await fetch(`${BASE}/.well-known/oauth-authorization-server`)).json();
    check('AS metadata: S256 + DCR', asm.code_challenge_methods_supported?.includes('S256') && !!asm.registration_endpoint);
    check('AS endpointlari /mcp/oauth ostida', asm.authorization_endpoint === `${BASE}/mcp/oauth/authorize`);

    // ── 2. Ro'yxatdan o'tish ──────────────────────────────────────────────────
    console.log('\n2) Dynamic Client Registration');
    const evil = await fetch(asm.registration_endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: 'Evil', redirect_uris: ['https://evil.example/cb'], token_endpoint_auth_method: 'none' }),
    });
    check('begona redirect_uri rad etildi', evil.status === 400, `${evil.status}`);
    const regRes = await fetch(asm.registration_endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: 'Claude', redirect_uris: [REDIRECT], token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'] }),
    });
    const client = await regRes.json();
    check('claude.ai mijozi ro\'yxatdan o\'tdi', regRes.status === 201 && !!client.client_id, `${regRes.status}`);

    // ── 3. Avtorizatsiya ──────────────────────────────────────────────────────
    async function authorize(access: 'read' | 'write', password = adminPassword, login = admin.login, cid: string = client.client_id) {
      const verifier = b64url(crypto.randomBytes(32));
      const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
      const state = b64url(crypto.randomBytes(8));
      const u = new URL(asm.authorization_endpoint);
      u.search = new URLSearchParams({
        response_type: 'code', client_id: cid, redirect_uri: REDIRECT, code_challenge: challenge,
        code_challenge_method: 'S256', state, scope: 'ils:read', resource: `${BASE}/mcp`,
      }).toString();
      const page = await fetch(u, { redirect: 'manual' });
      const html = await page.text();
      const signed = html.match(/name="signed" value="([^"]+)"/)?.[1] ?? '';
      const approve = await fetch(`${BASE}/mcp/oauth/approve`, {
        method: 'POST', redirect: 'manual',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ signed: signed.replace(/&amp;/g, '&'), login, password, access, decision: 'approve' }).toString(),
      });
      return { page, html, approve, verifier, state };
    }

    console.log('\n3) Login + rozilik sahifasi');
    const bad = await authorize('read', 'notogri-parol');
    check('rozilik sahifasi 200 + CSP', bad.page.status === 200 && (bad.page.headers.get('content-security-policy') ?? '').includes("frame-ancestors 'none'"));
    check('sahifada ilova nomi va ikkala huquq', bad.html.includes('Claude') && bad.html.includes('value="write"'));
    check('mijoz faqat ils:read so\'rasa ham "to\'liq boshqaruv" chiqadi va standart tanlangan', /value="write" checked/.test(bad.html));
    check('noto\'g\'ri parol → 401, kod berilmadi', bad.approve.status === 401 && !bad.approve.headers.get('location'));
    const notAdmin = await authorize('read', adminPassword, teacher.login);
    check('admin bo\'lmagan foydalanuvchi → 403', notAdmin.approve.status === 403);

    const tamper = await fetch(`${BASE}/mcp/oauth/approve`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ signed: 'eyJ4IjoxfQ.AAAA', login: admin.login, password: adminPassword, decision: 'approve' }).toString(),
    });
    check('buzilgan imzo rad etildi', tamper.status === 400);

    const okRead = await authorize('read');
    const loc = new URL(okRead.approve.headers.get('location') ?? 'http://x');
    check('to\'g\'ri login → 302 claude.ai ga', okRead.approve.status === 302 && loc.origin === 'https://claude.ai', loc.origin);
    check('state qaytdi', loc.searchParams.get('state') === okRead.state);
    const code = loc.searchParams.get('code')!;

    // ── 4. Token ──────────────────────────────────────────────────────────────
    console.log('\n4) Token (PKCE)');
    const tokenReq = (body: Record<string, string>) =>
      fetch(asm.token_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() });
    const wrongVerifier = await tokenReq({ grant_type: 'authorization_code', code, code_verifier: b64url(crypto.randomBytes(32)), client_id: client.client_id, redirect_uri: REDIRECT });
    check('noto\'g\'ri code_verifier rad etildi', wrongVerifier.status === 400);
    const tok = await tokenReq({ grant_type: 'authorization_code', code, code_verifier: okRead.verifier, client_id: client.client_id, redirect_uri: REDIRECT, resource: `${BASE}/mcp` });
    const readTokens = await tok.json();
    check('access + refresh berildi', tok.status === 200 && !!readTokens.access_token && !!readTokens.refresh_token, `${tok.status}`);
    check('scope faqat ils:read', readTokens.scope === 'ils:read', readTokens.scope);
    const reuse = await tokenReq({ grant_type: 'authorization_code', code, code_verifier: okRead.verifier, client_id: client.client_id, redirect_uri: REDIRECT });
    check('kodni qayta ishlatib bo\'lmaydi', reuse.status === 400);
    const stored = await prisma.mcpOAuthToken.findFirst({ where: { userId: admin.id } });
    check('bazada token ochiq saqlanmaydi', !!stored && stored.accessHash !== readTokens.access_token && stored.accessHash.length === 64);

    // kod qayta ishlatilgani uchun shu kod bilan berilgan token bekor qilingan bo'lishi kerak
    const afterReuse = await prisma.mcpOAuthToken.findFirst({ where: { userId: admin.id }, orderBy: { createdAt: 'desc' } });
    check('kod qayta ishlatilganda tokenlar bekor qilindi', !!afterReuse?.revokedAt);

    // Yangi toza ulanish
    const fresh = await authorize('read');
    const code2 = new URL(fresh.approve.headers.get('location')!).searchParams.get('code')!;
    const readTok = await (await tokenReq({ grant_type: 'authorization_code', code: code2, code_verifier: fresh.verifier, client_id: client.client_id, redirect_uri: REDIRECT })).json();

    // ── 5. MCP amallari (o'qish) ──────────────────────────────────────────────
    let rpcId = 0;
    async function rpc(token: string, method: string, params: Record<string, unknown> = {}) {
      const res = await fetch(`${BASE}/mcp`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-06-18',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
      });
      const text = await res.text();
      let json: any = null;
      try { json = JSON.parse(text); } catch { json = { raw: text }; }
      return { status: res.status, json };
    }
    const call = async (token: string, name: string, args: Record<string, unknown> = {}) => {
      const r = await rpc(token, 'tools/call', { name, arguments: args });
      const text = r.json?.result?.content?.[0]?.text ?? '';
      let data: any = null;
      try { data = JSON.parse(text); } catch { /* matn */ }
      return { isError: !!r.json?.result?.isError || !!r.json?.error, text, data, raw: r.json };
    };

    // ── 4b. Mijoz autentifikatsiyasi usullari (claude.ai qaysini tanlasa ham) ─
    console.log('\n4b) Mijoz autentifikatsiyasi: basic / post / none');
    const regAs = async (method?: string) => {
      const body: Record<string, unknown> = { client_name: 'Claude', redirect_uris: [REDIRECT], grant_types: ['authorization_code', 'refresh_token'] };
      if (method) body.token_endpoint_auth_method = method;
      return (await fetch(asm.registration_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
    };
    const codeFor = async (cid: string) => {
      const a = await authorize('write', adminPassword, admin.login, cid);
      return { code: new URL(a.approve.headers.get('location')!).searchParams.get('code')!, verifier: a.verifier };
    };
    // Usul ko'rsatilmagan — RFC 7591 bo'yicha client_secret_basic
    const cb = await regAs();
    check('usulsiz ro\'yxat → client_secret berildi', !!cb.client_secret, cb.token_endpoint_auth_method ?? '(yo\'q)');
    const b1 = await codeFor(cb.client_id);
    const noSecret = await tokenReq({ grant_type: 'authorization_code', code: b1.code, code_verifier: b1.verifier, client_id: cb.client_id, redirect_uri: REDIRECT });
    check('sirsiz token so\'rovi → invalid_client', noSecret.status === 400 && (await noSecret.json()).error === 'invalid_client');
    const basicRes = await fetch(asm.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${encodeURIComponent(cb.client_id)}:${encodeURIComponent(cb.client_secret)}`).toString('base64')}`,
      },
      body: new URLSearchParams({ grant_type: 'authorization_code', code: b1.code, code_verifier: b1.verifier, redirect_uri: REDIRECT }).toString(),
    });
    const basicTok = await basicRes.json();
    check('client_secret_basic (Authorization: Basic) → token', basicRes.status === 200 && !!basicTok.access_token, `${basicRes.status} ${basicTok.error ?? ''}`);
    const basicRefresh = await fetch(asm.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${Buffer.from(`${cb.client_id}:${cb.client_secret}`).toString('base64')}` },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: basicTok.refresh_token ?? 'x' }).toString(),
    });
    check('… refresh ham Basic bilan', basicRefresh.status === 200);
    const wrongBasic = await fetch(asm.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${Buffer.from(`${cb.client_id}:notogri`).toString('base64')}` },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: 'x' }).toString(),
    });
    check('noto\'g\'ri Basic sir → invalid_client', wrongBasic.status === 400 && (await wrongBasic.json()).error === 'invalid_client');
    const cp = await regAs('client_secret_post');
    const p1 = await codeFor(cp.client_id);
    const postRes = await tokenReq({ grant_type: 'authorization_code', code: p1.code, code_verifier: p1.verifier, client_id: cp.client_id, client_secret: cp.client_secret, redirect_uri: REDIRECT });
    check('client_secret_post → token', postRes.status === 200);
    const { recentMcpEvents } = await import('../src/mcp/events');
    const evs = recentMcpEvents();
    check('diagnostika: token qadamlari usuli bilan yozildi', evs.some((e) => e.step === 'token:authorization_code' && e.clientAuth === 'basic' && e.status === 200) && evs.some((e) => e.error === 'invalid_client'));
    check('diagnostika: jurnalda sir/kod yo\'q', !JSON.stringify(evs).includes(cb.client_secret) && !JSON.stringify(evs).includes(b1.code));

    console.log('\n5) MCP — o\'qish amallari');
    const init = await rpc(readTok.access_token, 'initialize', {
      protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'e2e', version: '1' },
    });
    check('initialize', init.status === 200 && init.json?.result?.serverInfo?.name === 'it-live-score', JSON.stringify(init.json).slice(0, 120));
    check('instructions bor', (init.json?.result?.instructions ?? '').includes('IT Live Score'));
    const list = await rpc(readTok.access_token, 'tools/list');
    const names: string[] = (list.json?.result?.tools ?? []).map((t: any) => t.name);
    check('o\'qish amallari ro\'yxatda', names.includes('ils_overview') && names.includes('ils_sql_query'), `${names.length} ta`);
    check('read-only ulanishda yozish amallari YO\'Q', !names.some((n) => /create|update|transfer|assign|mark|set_user|add_|remove_/.test(n)));
    check('hammasi readOnlyHint', (list.json?.result?.tools ?? []).every((t: any) => t.annotations?.readOnlyHint === true));

    const who = await call(readTok.access_token, 'ils_whoami');
    check('ils_whoami — admin nomidan', who.data?.user?.id === admin.id && who.data?.canWrite === false);
    const ov = await call(readTok.access_token, 'ils_overview');
    check('ils_overview', !ov.isError && typeof ov.data?.groups?.active === 'number', ov.text.slice(0, 80));
    const lg = await call(readTok.access_token, 'ils_list_groups', { search: tag });
    check('ils_list_groups (qidiruv)', lg.data?.total === 2 && lg.data.groups.find((g: any) => g.id === group.id)?.activeStudents === 3);
    check('ils_list_groups pendingSubmissions', lg.data?.groups.find((g: any) => g.id === group.id)?.pendingSubmissions === 1);
    const gr = await call(readTok.access_token, 'ils_group_report', { groupId: group.id });
    const s0 = gr.data?.students?.find((s: any) => s.id === students[0].id);
    check('ils_group_report: o\'quvchi natijasi', s0?.normatives?.green === 1 && s0?.normatives?.completionPct === 100, JSON.stringify(s0?.normatives));
    const fu = await call(readTok.access_token, 'ils_find_users', { search: tag, role: 'student' });
    check('ils_find_users', fu.data?.total === 3 && fu.data.users[0].groups?.length === 1);
    const sr = await call(readTok.access_token, 'ils_student_report', { studentId: students[0].id });
    check('ils_student_report', sr.data?.normatives?.green === 1 && sr.data?.student?.groups?.[0]?.id === group.id);
    const tr = await call(readTok.access_token, 'ils_teacher_report', { teacherId: teacher.id });
    check('ils_teacher_report', tr.data?.review?.pendingInMyGroups === 1 && tr.data?.review?.checkedInPeriod === 1);
    const ln = await call(readTok.access_token, 'ils_list_normatives', { search: tag });
    check('ils_list_normatives', ln.data?.total === 2 && ln.data.normatives[0].submissions.green === 1);
    const ls = await call(readTok.access_token, 'ils_list_submissions', { groupId: group.id, status: 'pending' });
    check('ils_list_submissions', ls.data?.total === 1);
    const badDate = await call(readTok.access_token, 'ils_list_submissions', { from: '15.10.2026' });
    check('noto\'g\'ri sana — tushunarli xato', badDate.isError && badDate.text.includes('YYYY-MM-DD'));
    const ms = await call(readTok.access_token, 'ils_milestones', { view: 'all', groupId: group.id });
    check('ils_milestones', !ms.isError && Array.isArray(ms.data?.milestones));
    const ex = await call(readTok.access_token, 'ils_exams', { limit: 5 });
    check('ils_exams', !ex.isError && typeof ex.data?.total === 'number');
    const al = await call(readTok.access_token, 'ils_audit_log', { action: 'mcp.', limit: 5 });
    check('ils_audit_log (mcp.connect_approved bor)', al.data?.logs?.some((l: any) => l.action === 'mcp.connect_approved'));
    const badUuid = await call(readTok.access_token, 'ils_group_report', { groupId: 'abc' });
    check('noto\'g\'ri UUID — validatsiya xatosi', badUuid.isError);

    console.log('\n6) Sxema va SQL');
    const sch = await call(readTok.access_token, 'ils_db_schema');
    const users = sch.data?.tables?.find((t: any) => t.table === 'users');
    check('ils_db_schema: users jadvali', !!users && users.columns.includes('full_name'));
    check('sxemada password_hash YO\'Q', !users?.columns.includes('password_hash'));
    check('sxemada mcp_oauth jadvallari YO\'Q', !sch.data?.tables?.some((t: any) => t.table.startsWith('mcp_oauth')));
    const sq = await call(readTok.access_token, 'ils_sql_query', {
      sql: `select g.name, count(gs.id)::int as n from groups g join group_students gs on gs.group_id = g.id where g.name like '${tag}%' group by g.name`,
      purpose: 'e2e',
    });
    check('SQL: guruhlash so\'rovi', sq.data?.rows?.[0]?.n === 3, sq.text.slice(0, 100));
    const leak1 = await call(readTok.access_token, 'ils_sql_query', { sql: `select * from users where login = '${admin.login}'` });
    check('SQL: password_hash ustuni yashirildi', leak1.data?.rows?.[0]?.password_hash === '[yashirilgan]');
    const leak2 = await call(readTok.access_token, 'ils_sql_query', { sql: `select u::text as t from users u where login = '${admin.login}'` });
    check('SQL: row::text ichidagi bcrypt ham yashirildi', !!leak2.data?.rows?.[0]?.t && !/\$2[aby]\$/.test(leak2.data.rows[0].t));
    const w1 = await call(readTok.access_token, 'ils_sql_query', { sql: `update users set full_name='x' where login='${admin.login}'` });
    check('SQL: UPDATE rad etildi', w1.isError);
    const w2 = await call(readTok.access_token, 'ils_sql_query', { sql: `select 1; delete from users` });
    check('SQL: ikkinchi so\'rov rad etildi', w2.isError);
    const w3 = await call(readTok.access_token, 'ils_sql_query', { sql: `with x as (delete from audit_logs where false returning id) select * from x` });
    check('SQL: CTE ichidagi DELETE — READ ONLY to\'xtatdi', w3.isError, w3.text.slice(0, 90));
    const w4 = await call(readTok.access_token, 'ils_sql_query', { sql: `select pg_read_file('/etc/passwd')` });
    check('SQL: fayl o\'qish rad etildi', w4.isError);
    const w5 = await call(readTok.access_token, 'ils_sql_query', { sql: `select * from mcp_oauth_tokens` });
    check('SQL: mcp_oauth jadvallari rad etildi', w5.isError);
    const w6 = await call(readTok.access_token, 'ils_sql_query', { sql: `select nonexistent_col from groups` });
    check('SQL: sintaksis xatosi Claude\'ga tushunarli', w6.isError && w6.text.startsWith('SQL xatosi'), w6.text.slice(0, 90));
    const nameIntact = await prisma.user.findUnique({ where: { id: admin.id }, select: { fullName: true } });
    check('baza o\'zgarmadi', nameIntact?.fullName === 'MCP E2E Admin');
    const writeViaRead = await call(readTok.access_token, 'ils_create_group', { name: 'x' });
    check('read token bilan yozish amali yo\'q', writeViaRead.isError);

    // ── 7. Yozish huquqi ──────────────────────────────────────────────────────
    console.log('\n7) Boshqarish (ils:write)');
    const w = await authorize('write');
    const wcode = new URL(w.approve.headers.get('location')!).searchParams.get('code')!;
    const writeTok = await (await tokenReq({ grant_type: 'authorization_code', code: wcode, code_verifier: w.verifier, client_id: client.client_id, redirect_uri: REDIRECT })).json();
    check('write scope berildi', writeTok.scope === 'ils:read ils:write', writeTok.scope);
    const wl = await rpc(writeTok.access_token, 'tools/list');
    const wnames: string[] = (wl.json?.result?.tools ?? []).map((t: any) => t.name);
    check('yozish amallari ro\'yxatda', ['ils_create_group', 'ils_transfer_student', 'ils_set_user_active'].every((n) => wnames.includes(n)), `${wnames.length} ta`);
    check('xavfli amallar destructiveHint', (wl.json?.result?.tools ?? []).find((t: any) => t.name === 'ils_transfer_student')?.annotations?.destructiveHint === true);

    const cg = await call(writeTok.access_token, 'ils_create_group', { name: `${tag}-G3`.slice(0, 50), teacherId: teacher.id });
    check('ils_create_group', cg.data?.created === true, cg.text.slice(0, 100));
    if (cg.data?.group?.id) ids.groups.push(cg.data.group.id);
    const cgBad = await call(writeTok.access_token, 'ils_create_group', { name: 'x', teacherId: students[0].id });
    check('ils_create_group: o\'quvchi ustoz bo\'la olmaydi (servis qoidasi)', cgBad.isError, cgBad.text.slice(0, 80));
    const ug = await call(writeTok.access_token, 'ils_update_group', { groupId: cg.data.group.id, lessonDayType: 'juft' });
    check('ils_update_group', ug.data?.updated === true, ug.text.slice(0, 100));
    const ad = await call(writeTok.access_token, 'ils_add_students_to_group', { groupId: cg.data.group.id, studentIds: [students[2].id] });
    check('ils_add_students_to_group', ad.data?.done === true, ad.text.slice(0, 100));
    const tfBad = await call(writeTok.access_token, 'ils_transfer_student', { studentId: students[1].id, fromGroupId: group2.id, toGroupId: cg.data.group.id });
    check('ils_transfer_student: noto\'g\'ri "hozirgi guruh" rad etildi', tfBad.isError && tfBad.text.includes('hozirgi guruhda emas'));
    const tf = await call(writeTok.access_token, 'ils_transfer_student', { studentId: students[0].id, fromGroupId: group.id, toGroupId: group2.id });
    check('ils_transfer_student', !tf.isError, tf.text.slice(0, 100));
    const moved = await prisma.groupStudent.findMany({ where: { studentId: students[0].id }, select: { groupId: true } });
    check('o\'quvchi haqiqatan ko\'chdi', moved.length === 1 && moved[0].groupId === group2.id);
    const gn = await prisma.groupNormative.findFirst({ where: { groupId: group2.id, normativeId: norms[0].id } });
    check('topshirgan normativi yangi guruhga ham biriktirildi', !!gn);
    const cn = await call(writeTok.access_token, 'ils_create_normative', { taskNumber: 9003, title: `${tag} normativ 9003`, timeLimit: 12 });
    check('ils_create_normative', cn.data?.created === true, cn.text.slice(0, 100));
    if (cn.data?.normative?.id) ids.normatives.push(cn.data.normative.id);
    const un = await call(writeTok.access_token, 'ils_update_normative', { normativeId: norms[1].id, timeLimit: 8 });
    check('ils_update_normative', un.data?.updated === true);
    const an = await call(writeTok.access_token, 'ils_assign_normatives', { groupId: group.id, normativeIds: [norms[1].id] });
    check('ils_assign_normatives', an.data?.done === true, an.text.slice(0, 100));
    const sa1 = await call(writeTok.access_token, 'ils_set_user_active', { userId: admin.id, isActive: false });
    check('o\'z akkauntini o\'chirib bo\'lmaydi', sa1.isError);
    const sa2 = await call(writeTok.access_token, 'ils_set_user_active', { userId: students[2].id, isActive: false });
    check('ils_set_user_active (o\'quvchi)', sa2.data?.user?.isActive === false);
    const audits = await prisma.auditLog.findMany({ where: { userId: admin.id, action: { startsWith: 'mcp.' } }, select: { action: true, details: true } });
    const acts = new Set(audits.map((a) => a.action));
    check('audit: har yozish amali yozildi', ['mcp.create_group', 'mcp.transfer_student', 'mcp.set_user_active', 'mcp.sql_query'].every((a) => acts.has(a)), [...acts].join(','));
    check('audit: muvaffaqiyatsiz urinish ham yozildi', audits.some((a) => a.action === 'mcp.create_group' && (a.details as any)?.ok === false));

    // ── 7b. To'liq boshqaruv: domen amallari ─────────────────────────────────
    console.log('\n7b) To\'liq boshqaruv — domen amallari');
    const W = writeTok.access_token;
    check('amallar soni: 16 o\'qish + 29 boshqarish', wnames.length === 45, `${wnames.length} ta`);
    const pendingSub = await prisma.submission.findFirst({ where: { studentId: students[1].id, normativeId: norms[0].id } });
    const cs = await call(W, 'ils_check_submission', { submissionId: pendingSub!.id, result: 'blue', comment: 'MCP orqali' });
    check('ils_check_submission', cs.data?.checked === true && cs.data.submission.result === 'blue', cs.text.slice(0, 100));
    const notifCheck = await prisma.notification.count({ where: { userId: students[1].id, type: 'submission_checked' } });
    check('… o\'quvchiga bildirishnoma ketdi', notifCheck === 1);
    const rs = await call(W, 'ils_allow_resubmit', { submissionId: pendingSub!.id });
    check('ils_allow_resubmit', rs.data?.done === true, rs.text.slice(0, 80));

    const cuAdmin = await call(W, 'ils_create_user', { fullName: 'Hacker', login: `${tagU}_x`, role: 'admin' });
    check('admin yaratib bo\'lmaydi', cuAdmin.isError);
    const cu = await call(W, 'ils_create_user', { fullName: 'MCP Yangi O\'quvchi', login: `${tagU}_new`, role: 'student', groupId: group.id });
    check('ils_create_user + guruhga qo\'shish', cu.data?.created === true && cu.data.addedToGroup === group.id && !!cu.data.temporaryPassword, cu.text.slice(0, 100));
    const newUser = await prisma.user.findUnique({ where: { login: `${tagU}_new` }, select: { id: true, passwordHash: true } });
    check('… vaqtinchalik parol ishlaydi', !!newUser && (await bcrypt.compare(cu.data.temporaryPassword, newUser.passwordHash)));
    const uuAdmin = await call(W, 'ils_update_user', { userId: admin.id, fullName: 'x' });
    check('o\'z/admin akkauntini tahrirlab bo\'lmaydi', uuAdmin.isError);
    const uuRole = await call(W, 'ils_update_user', { userId: teacher.id, role: 'admin' });
    check('hech kimni admin qilib bo\'lmaydi', uuRole.isError);
    const uuFil = await call(W, 'ils_update_user', { userId: teacher.id, filial: 'yoq-filial' });
    check('noto\'g\'ri filial rad etildi', uuFil.isError && uuFil.text.includes('filial'));
    const uu = await call(W, 'ils_update_user', { userId: teacher.id, fullName: 'MCP E2E Ustoz (yangi)' });
    check('ils_update_user', uu.data?.user?.fullName === 'MCP E2E Ustoz (yangi)');
    const tvBefore = (await prisma.user.findUnique({ where: { id: newUser!.id }, select: { tokenVersion: true } }))!.tokenVersion;
    const rp = await call(W, 'ils_reset_password', { userId: newUser!.id });
    const afterRp = await prisma.user.findUnique({ where: { id: newUser!.id }, select: { passwordHash: true, tokenVersion: true } });
    check('ils_reset_password: yangi parol + sessiyalar tugadi', !!rp.data?.temporaryPassword && (await bcrypt.compare(rp.data.temporaryPassword, afterRp!.passwordHash)) && afterRp!.tokenVersion === tvBefore + 1);
    const rpAdmin = await call(W, 'ils_reset_password', { userId: admin.id });
    check('admin parolini tiklab bo\'lmaydi', rpAdmin.isError);
    const sp = await call(W, 'ils_set_permissions', { userId: teacher.id, permissions: ['quiz_tests', 'exam_create'] });
    check('ils_set_permissions', sp.data?.done === true && sp.data.now.includes('exam_create'), sp.text.slice(0, 100));
    const spBad = await call(W, 'ils_set_permissions', { userId: teacher.id, permissions: ['root_access'] });
    check('noma\'lum ruxsat rad etildi', spBad.isError);
    const gp = await call(W, 'ils_get_permissions', { userId: teacher.id });
    check('ils_get_permissions', gp.data?.catalog?.length > 10 && gp.data.user.permissions.includes('quiz_tests'));

    const fz = await call(W, 'ils_freeze_student', { studentId: students[1].id, reason: 'kasallik', detailedNote: 'e2e' });
    check('ils_freeze_student', fz.data?.frozen === true, fz.text.slice(0, 80));
    const uf = await call(W, 'ils_unfreeze', { freezeId: fz.data?.freeze?.id });
    check('ils_unfreeze', uf.data?.done === true);
    const sn = await call(W, 'ils_send_notification', { title: 'E2E xabar', body: 'salom', groupId: group.id });
    check('ils_send_notification (guruh)', sn.data?.sent >= 2, sn.text.slice(0, 60));

    const sess = await prisma.lessonSession.create({
      data: { groupId: group.id, teacherId: teacher.id, date: new Date('2026-01-05T00:00:00Z'), deadlineAt: new Date(Date.now() - 3600_000), status: 'yakunlandi' },
    });
    await prisma.lessonGrade.create({ data: { sessionId: sess.id, studentId: students[1].id } });
    const gl = await call(W, 'ils_grade_lesson', { sessionId: sess.id, studentId: students[1].id, homework: 'qisman', activityScore: 4, coinDelta: 5 });
    check('ils_grade_lesson (muddatdan keyin, admin)', gl.data?.grade?.homework === 'qisman' && gl.data.grade.activityScore === 4 && gl.data.done.length === 3, gl.text.slice(0, 120));
    const lc = await call(W, 'ils_group_lifecycle', { groupId: group2.id, action: 'graduate' });
    check('ils_group_lifecycle graduate', !!lc.data?.group?.graduatedAt && lc.data.group.isActive === false, lc.text.slice(0, 100));
    const lc2 = await call(W, 'ils_group_lifecycle', { groupId: group2.id, action: 'ungraduate' });
    check('… ungraduate', lc2.data?.group?.graduatedAt === null, lc2.text.slice(0, 100));

    // ── 7c. Qo'lda to'g'rilash + undo ────────────────────────────────────────
    console.log('\n7c) Qo\'lda to\'g\'rilash va undo');
    const gr1 = await call(W, 'ils_get_record', { table: 'submissions', id: pendingSub!.id });
    check('ils_get_record', gr1.data?.record?.result === 'blue' && gr1.data.leafTable === true);
    const pv1 = await call(W, 'ils_record_change', { table: 'submissions', action: 'update', id: pendingSub!.id, data: { score: 33, comment: 'qo\'lda tuzatildi' } });
    check('1-bosqich: ko\'rinish + confirmToken', pv1.data?.stage === 'preview' && !!pv1.data.confirmToken && pv1.data.changes?.score?.after === 33, pv1.text.slice(0, 140));
    check('… ko\'rinishda baza o\'zgarmadi', (await prisma.submission.findUnique({ where: { id: pendingSub!.id } }))!.score !== 33);
    const tamperRc = await call(W, 'ils_record_change', { table: 'submissions', action: 'update', id: pendingSub!.id, data: { score: 40, comment: 'qo\'lda tuzatildi' }, confirmToken: pv1.data.confirmToken });
    check('boshqa qiymat + eski kod → rad', tamperRc.isError && tamperRc.text.includes('confirmToken'));
    const ap1 = await call(W, 'ils_record_change', { table: 'submissions', action: 'update', id: pendingSub!.id, data: { score: 33, comment: 'qo\'lda tuzatildi' }, confirmToken: pv1.data.confirmToken });
    check('2-bosqich: qo\'llandi + auditId', ap1.data?.applied === true && !!ap1.data.auditId, ap1.text.slice(0, 120));
    check('… bazada o\'zgardi', (await prisma.submission.findUnique({ where: { id: pendingSub!.id } }))!.score === 33);
    const undoPv = await call(W, 'ils_undo_change', { auditId: ap1.data.auditId });
    check('undo ko\'rinishi (confirm=false)', undoPv.data?.stage === 'preview');
    const undo1 = await call(W, 'ils_undo_change', { auditId: ap1.data.auditId, confirm: true });
    const restored = await prisma.submission.findUnique({ where: { id: pendingSub!.id } });
    check('undo: eski qiymatlar qaytdi', undo1.data?.undone === true && restored!.score !== 33 && restored!.comment === 'MCP orqali', undo1.text.slice(0, 100));
    const undoAgain = await call(W, 'ils_undo_change', { auditId: ap1.data.auditId, confirm: true });
    check('ikki marta undo qilib bo\'lmaydi', undoAgain.isError && undoAgain.text.includes('allaqachon'));

    const pv2 = await call(W, 'ils_record_change', { table: 'submissions', action: 'update', id: pendingSub!.id, data: { comment: 'v2' } });
    await prisma.submission.update({ where: { id: pendingSub!.id }, data: { canResubmit: false } });
    await prisma.submission.update({ where: { id: pendingSub!.id }, data: { comment: 'panelda o\'zgardi' } });
    const stale = await call(W, 'ils_record_change', { table: 'submissions', action: 'update', id: pendingSub!.id, data: { comment: 'v2' }, confirmToken: pv2.data.confirmToken });
    check('ko\'rinishdan keyin yozuv o\'zgarsa → rad', stale.isError && stale.text.includes('o\'zgargan'), stale.text.slice(0, 90));
    const pv3 = await call(W, 'ils_record_change', { table: 'submissions', action: 'update', id: pendingSub!.id, data: { comment: 'v3' } });
    const ap3 = await call(W, 'ils_record_change', { table: 'submissions', action: 'update', id: pendingSub!.id, data: { comment: 'v3' }, confirmToken: pv3.data.confirmToken });
    await prisma.submission.update({ where: { id: pendingSub!.id }, data: { comment: 'yana o\'zgardi' } });
    const drift = await call(W, 'ils_undo_change', { auditId: ap3.data.auditId, confirm: true });
    check('undo: keyin o\'zgargan bo\'lsa to\'xtaydi', drift.isError && drift.text.includes('comment'), drift.text.slice(0, 90));

    const pwd = await call(W, 'ils_record_change', { table: 'users', action: 'update', id: teacher.id, data: { password_hash: 'x' } });
    check('password_hash yopiq', pwd.isError);
    const mkAdmin = await call(W, 'ils_record_change', { table: 'users', action: 'update', id: teacher.id, data: { role: 'admin' } });
    check('users.role = admin yopiq', mkAdmin.isError);
    const edAdmin = await call(W, 'ils_record_change', { table: 'users', action: 'update', id: admin.id, data: { bio: 'x' } });
    check('admin yozuvi yopiq', edAdmin.isError);
    const auditEdit = await call(W, 'ils_record_change', { table: 'audit_logs', action: 'delete', id: ap1.data.auditId });
    check('audit_logs yopiq', auditEdit.isError);
    const delGroup = await call(W, 'ils_record_change', { table: 'groups', action: 'delete', id: group.id });
    check('bolali jadvalni o\'chirib bo\'lmaydi (kaskad)', delGroup.isError && delGroup.text.includes('kaskad'));
    const badCol = await call(W, 'ils_record_change', { table: 'groups', action: 'update', id: group.id, data: { nonexistent: 1 } });
    check('noma\'lum ustun rad etildi', badCol.isError);
    const badEnum = await call(W, 'ils_record_change', { table: 'groups', action: 'update', id: group.id, data: { lesson_day_type: 'dushanba' } });
    check('noto\'g\'ri enum rad etildi', badEnum.isError && badEnum.text.includes('juft'));
    const sched = await call(W, 'ils_record_change', { table: 'groups', action: 'update', id: group.id, data: { start_date: '2026-09-01', duration_months: 6, lesson_day_type: 'toq' } });
    const schedAp = await call(W, 'ils_record_change', { table: 'groups', action: 'update', id: group.id, data: { start_date: '2026-09-01', duration_months: 6, lesson_day_type: 'toq' }, confirmToken: sched.data.confirmToken });
    const msCount = await prisma.groupMilestone.count({ where: { groupId: group.id } });
    check('jadval maydonlari o\'zgarsa bosqichlar avtomatik quriladi', schedAp.data?.applied === true && msCount > 0, `${msCount} ta bosqich`);

    const missing = await call(W, 'ils_record_change', { table: 'coin_transactions', action: 'create', data: { amount: 10 } });
    check('create: majburiy ustunlar ko\'rsatildi', missing.isError && missing.text.includes('student_id'));
    const cpv = await call(W, 'ils_record_change', { table: 'coin_transactions', action: 'create', data: { student_id: students[2].id, amount: 15, reason: 'qo\'lda bonus' } });
    const cap = await call(W, 'ils_record_change', { table: 'coin_transactions', action: 'create', data: { student_id: students[2].id, amount: 15, reason: 'qo\'lda bonus' }, confirmToken: cpv.data?.confirmToken });
    const coinRow = cap.data?.id ? await prisma.coinTransaction.findUnique({ where: { id: cap.data.id } }) : null;
    check('create: yozuv qo\'shildi (ko\'rinishdagi ID bilan)', cap.data?.applied === true && coinRow?.amount === 15 && cap.data.id === cpv.data.id, cap.text.slice(0, 100));
    const cundo = await call(W, 'ils_undo_change', { auditId: cap.data.auditId, confirm: true });
    check('create undo → o\'chirildi', cundo.data?.undone === true && !(await prisma.coinTransaction.findUnique({ where: { id: cap.data.id } })));

    const gsRow = await prisma.groupStudent.findFirst({ where: { groupId: group.id, studentId: students[1].id } });
    const dpv = await call(W, 'ils_record_change', { table: 'group_students', action: 'delete', id: gsRow!.id });
    const dap = await call(W, 'ils_record_change', { table: 'group_students', action: 'delete', id: gsRow!.id, confirmToken: dpv.data?.confirmToken });
    check('delete (barg jadval)', dap.data?.applied === true && !(await prisma.groupStudent.findUnique({ where: { id: gsRow!.id } })), dap.text.slice(0, 100));
    const dundo = await call(W, 'ils_undo_change', { auditId: dap.data.auditId, confirm: true });
    const back = await prisma.groupStudent.findUnique({ where: { id: gsRow!.id } });
    check('delete undo → aynan o\'sha yozuv qaytdi', dundo.data?.undone === true && back?.studentId === students[1].id && back.joinedAt.getTime() === gsRow!.joinedAt.getTime());
    const ms1 = await prisma.groupMilestone.findFirst({ where: { groupId: group.id, heldAt: null }, orderBy: { dueDate: 'asc' } });
    const pick = ms1?.candidates?.[0] ? ms1.candidates[0].toISOString().slice(0, 10) : null;
    const smd = pick ? await call(W, 'ils_set_milestone_date', { milestoneId: ms1!.id, date: pick }) : null;
    check('ils_set_milestone_date', !!smd && !smd.isError && smd.data?.milestone?.status === 'sana_tanlandi', smd?.text.slice(0, 100) ?? 'bosqich yo\'q');
    const arch = await call(W, 'ils_group_lifecycle', { groupId: group2.id, action: 'archive' });
    check('ils_group_lifecycle archive', arch.data?.group?.isActive === false && arch.data.group.graduatedAt === null);
    const rest = await call(W, 'ils_group_lifecycle', { groupId: group2.id, action: 'restore' });
    check('… restore', rest.data?.group?.isActive === true, rest.text.slice(0, 80));
    const ru = await call(W, 'ils_restore_user', { userId: students[2].id });
    check('ils_restore_user', ru.data?.restored === true && (await prisma.user.findUnique({ where: { id: students[2].id } }))!.isActive === true, ru.text.slice(0, 80));
    const ul = await call(W, 'ils_unlock_lesson', { groupId: group.id, note: 'e2e: ustoz kasal edi' });
    check('ils_unlock_lesson', ul.data?.unlocked === true, ul.text.slice(0, 100));
    // Murojaat (bot ishga tushmagan — haqiqiy Telegram xabari ketmaydi)
    const link = await prisma.telegramLink.create({ data: { telegramId: BigInt(900000001), chatId: BigInt(900000001), studentId: students[0].id, fullName: 'E2E ota-ona' } });
    const appeal = await prisma.parentAppeal.create({ data: { telegramLinkId: link.id, studentId: students[0].id, type: 'taklif', message: 'E2E murojaat' } });
    const sas = await call(W, 'ils_set_appeal_status', { appealId: appeal.id, status: 'korib_chiqilmoqda' });
    check('ils_set_appeal_status', sas.data?.status === 'korib_chiqilmoqda', sas.text.slice(0, 80));
    const rap = await call(W, 'ils_reply_appeal', { appealId: appeal.id, reply: 'Rahmat, ko\'rib chiqamiz' });
    const apAfter = await prisma.parentAppeal.findUnique({ where: { id: appeal.id } });
    check('ils_reply_appeal', rap.data?.replied === true && apAfter?.status === 'hal_qilindi' && apAfter.adminReply === 'Rahmat, ko\'rib chiqamiz', rap.text.slice(0, 80));
    // Do'kon: bekor qilinsa coin qaytadi
    const item = await prisma.shopItem.create({ data: { name: `${tag} sovg'a`, price: 20 } });
    const order = await prisma.shopOrder.create({ data: { studentId: students[0].id, itemId: item.id, priceAtOrder: 20 } });
    const so = await call(W, 'ils_shop_order', { orderId: order.id, action: 'cancel', note: 'e2e' });
    check('ils_shop_order cancel', so.data?.order?.status === 'bekor_qilindi', so.text.slice(0, 80));
    const so2 = await call(W, 'ils_shop_order', { orderId: order.id, action: 'fulfill' });
    check('… yakunlangan buyurtmani qayta o\'zgartirib bo\'lmaydi', so2.isError);
    await prisma.coinTransaction.deleteMany({ where: { shopOrderId: order.id } });
    await prisma.shopOrder.delete({ where: { id: order.id } });
    await prisma.shopItem.delete({ where: { id: item.id } });

    const recAudits = await prisma.auditLog.count({ where: { userId: admin.id, action: { in: ['mcp.record_update', 'mcp.record_create', 'mcp.record_delete', 'mcp.undo'] } } });
    check('qo\'lda o\'zgarishlar va undo auditda', recAudits >= 8, `${recAudits} ta`);

    // ── 8. Refresh rotation va o'g'irlangan refresh ───────────────────────────
    console.log('\n8) Refresh token');
    // claude.ai refresh'da dastlabki scope'ni (ils:read) yuboradi — boshqaruv huquqi saqlanishi kerak
    const r1 = await (await tokenReq({ grant_type: 'refresh_token', refresh_token: writeTok.refresh_token, client_id: client.client_id, scope: 'ils:read' })).json();
    check('refresh scope=ils:read bilan ham boshqaruv saqlandi', r1.scope === 'ils:read ils:write', r1.scope);
    check('refresh → yangi juftlik', !!r1.access_token && r1.refresh_token !== writeTok.refresh_token);
    const oldAccess = await rpc(writeTok.access_token, 'tools/list');
    check('eski access rotation\'dan keyin ishlamaydi', oldAccess.status === 401);
    const newAccess = await rpc(r1.access_token, 'tools/list');
    check('yangi access ishlaydi', newAccess.status === 200);
    const stolen = await tokenReq({ grant_type: 'refresh_token', refresh_token: writeTok.refresh_token, client_id: client.client_id });
    check('eski refresh qayta kelsa → rad', stolen.status === 400);
    const afterTheft = await rpc(r1.access_token, 'tools/list');
    check('o\'g\'irlik belgisi: butun oila bekor qilindi', afterTheft.status === 401);

    // ── 9. Panel API va parol almashishi ──────────────────────────────────────
    console.log('\n9) Panel: ulanishlar va bekor qilish');
    // 8-bosqichdagi o'g'irlik himoyasi hamma tokenlarni yopdi — yangi ulanish
    const c9 = await authorize('read');
    const c9code = new URL(c9.approve.headers.get('location')!).searchParams.get('code')!;
    const c9Tok = await (await tokenReq({ grant_type: 'authorization_code', code: c9code, code_verifier: c9.verifier, client_id: client.client_id, redirect_uri: REDIRECT })).json();
    check('8-bosqichdan keyin qayta ulanish', (await rpc(c9Tok.access_token, 'tools/list')).status === 200);
    const adminJwt = jwt.sign({ userId: admin.id, role: 'admin', login: admin.login, tv: 0 }, env.JWT_SECRET);
    const teacherJwt = jwt.sign({ userId: teacher.id, role: 'teacher', login: teacher.login, tv: 0 }, env.JWT_SECRET);
    const conns = await (await fetch(`${BASE}/api/mcp/connections`, { headers: { Authorization: `Bearer ${adminJwt}` } })).json();
    const mine = conns.data?.connections?.find((c: any) => c.user.id === admin.id);
    check('GET /api/mcp/connections', !!mine && mine.clientName === 'Claude', `${conns.data?.connections?.length} ta`);
    check('serverUrl to\'g\'ri', conns.data?.serverUrl === `${BASE}/mcp`);
    const tconn = await fetch(`${BASE}/api/mcp/connections`, { headers: { Authorization: `Bearer ${teacherJwt}` } });
    check('ustoz ulanishlarni ko\'ra olmaydi', tconn.status === 403);
    const del = await fetch(`${BASE}/api/mcp/connections/${encodeURIComponent(mine.id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminJwt}` } });
    check('uzish', del.status === 200);
    const afterRevoke = await rpc(c9Tok.access_token, 'tools/list');
    check('uzilgandan keyin token ishlamaydi', afterRevoke.status === 401);

    const pv = await authorize('read');
    const pcode = new URL(pv.approve.headers.get('location')!).searchParams.get('code')!;
    const pTok = await (await tokenReq({ grant_type: 'authorization_code', code: pcode, code_verifier: pv.verifier, client_id: client.client_id, redirect_uri: REDIRECT })).json();
    check('qayta ulanish', (await rpc(pTok.access_token, 'tools/list')).status === 200);
    await prisma.user.update({ where: { id: admin.id }, data: { tokenVersion: { increment: 1 } } });
    check('parol almashgach (token_version) token o\'ladi', (await rpc(pTok.access_token, 'tools/list')).status === 401);
    const pr = await tokenReq({ grant_type: 'refresh_token', refresh_token: pTok.refresh_token, client_id: client.client_id });
    check('… refresh ham ishlamaydi', pr.status === 400);

    const getMcp = await fetch(`${BASE}/mcp`, { headers: { Authorization: `Bearer ${pTok.access_token}` } });
    check('GET /mcp → 401/405 (SSE yo\'q)', getMcp.status === 405 || getMcp.status === 401);
  } finally {
    // ── Tozalash ──────────────────────────────────────────────────────────────
    // MCP orqali yaratilganlar ham (ils_create_user) — prefiks bo'yicha
    const allFixtureUsers = await prisma.user.findMany({ where: { OR: [{ login: { startsWith: tag } }, { login: { startsWith: tagU } }] }, select: { id: true } });
    ids.users = [...new Set([...ids.users, ...allFixtureUsers.map((u) => u.id)])];
    await prisma.lessonSession.deleteMany({ where: { groupId: { in: ids.groups } } });
    await prisma.coinTransaction.deleteMany({ where: { OR: [{ studentId: { in: ids.users } }, { teacherId: { in: ids.users } }] } });
    await prisma.studentFreeze.deleteMany({ where: { OR: [{ studentId: { in: ids.users } }, { frozenById: { in: ids.users } }] } });
    await prisma.notification.deleteMany({ where: { userId: { in: ids.users } } });
    await prisma.parentAppeal.deleteMany({ where: { studentId: { in: ids.users } } });
    await prisma.telegramLink.deleteMany({ where: { studentId: { in: ids.users } } });
    const clients = await prisma.mcpOAuthToken.findMany({ where: { userId: { in: ids.users } }, select: { clientId: true }, distinct: ['clientId'] });
    await prisma.mcpOAuthToken.deleteMany({ where: { userId: { in: ids.users } } });
    await prisma.mcpOAuthCode.deleteMany({ where: { userId: { in: ids.users } } });
    await prisma.mcpOAuthClient.deleteMany({ where: { id: { in: clients.map((c) => c.clientId) } } });
    await prisma.mcpOAuthClient.deleteMany({ where: { name: { in: ['Claude', 'Evil'] }, tokens: { none: {} }, codes: { none: {} }, createdAt: { gte: new Date(Date.now() - 3600_000) } } });
    await prisma.auditLog.deleteMany({ where: { OR: [{ userId: { in: ids.users } }, { targetId: { in: [...ids.groups, ...ids.normatives] } }] } });
    await prisma.submission.deleteMany({ where: { studentId: { in: ids.users } } });
    await prisma.groupMilestone.deleteMany({ where: { groupId: { in: ids.groups } } });
    await prisma.group.deleteMany({ where: { id: { in: ids.groups } } });
    await prisma.normative.deleteMany({ where: { id: { in: ids.normatives } } });
    await prisma.userPermission.deleteMany({ where: { userId: { in: ids.users } } });
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
    const left = await prisma.user.count({ where: { login: { startsWith: tag } } });
    console.log(`\nTozalash: qolgan fixture foydalanuvchi = ${left}`);
    server.close();
    await prisma.$disconnect();
  }

  console.log(`\nNatija: ${pass} OK, ${failed} XATO`);
  process.exitCode = failed ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
