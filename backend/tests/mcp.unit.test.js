/**
 * MCP — bazasiz unit testlar (dist/ ga qarshi). Ishlatish: npm run test:mcp
 * Uchdan-uchgacha (baza + OAuth + barcha amallar): npm run e2e:mcp
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js');
const { validateSql } = require('../dist/mcp/tools/sql.js');
const { redact, REDACTED } = require('../dist/mcp/context.js');
const { isAllowedRedirectUri } = require('../dist/mcp/config.js');
const { signConsentRequest, verifyConsentRequest } = require('../dist/mcp/oauth/pages.js');
const { createMcpServer } = require('../dist/mcp/server.js');

test('validateSql: faqat bitta SELECT/WITH', () => {
  assert.equal(validateSql('select 1;'), 'select 1');
  assert.ok(validateSql('WITH a AS (SELECT 1) SELECT * FROM a'));
  assert.ok(validateSql("select created_at, updated_at from groups where name = 'drop table'"));
  for (const bad of [
    'update users set role = 1',
    'select 1; delete from users',
    'delete from users',
    "select pg_read_file('/etc/passwd')",
    'select * from mcp_oauth_tokens',
    "select query_to_xml('select 1', true, true, '')",
    'select $$x$$',
    "select set_config('statement_timeout', '0', false)",
    'with x as (delete from users returning id) select * from x',
    '',
  ]) {
    assert.throws(() => validateSql(bad), undefined, bad);
  }
});

test('redact: parol xeshi va tokenlar yashiriladi', () => {
  const bcrypt = '$2a$12$BtyX2urLv3wsEzMDPeiah.7eJ0KAr4ZqkPa2l90CJOQwLltqvXXui';
  const out = redact([
    { full_name: 'Ali', password_hash: bcrypt, token_version: 3, access_hash: 'abc', n: 10n, d: new Date(0) },
    { t: `(1,Ali,${bcrypt},admin)` },
    { nested: { refresh_token: 'x', ok: 'y' } },
  ]);
  assert.equal(out[0].password_hash, REDACTED);
  assert.equal(out[0].access_hash, REDACTED);
  assert.equal(out[0].token_version, 3);
  assert.equal(out[0].full_name, 'Ali');
  assert.equal(out[0].n, '10');
  assert.equal(out[0].d, '1970-01-01T00:00:00.000Z');
  assert.ok(!out[1].t.includes('$2a$'));
  assert.equal(out[2].nested.refresh_token, REDACTED);
  assert.equal(out[2].nested.ok, 'y');
});

test('redirect_uri: faqat claude.ai/claude.com va loopback', () => {
  assert.ok(isAllowedRedirectUri('https://claude.ai/api/mcp/auth_callback'));
  assert.ok(isAllowedRedirectUri('https://claude.com/api/mcp/auth_callback'));
  assert.ok(isAllowedRedirectUri('http://localhost:33418/callback'));
  assert.ok(isAllowedRedirectUri('http://127.0.0.1:5000/cb'));
  assert.ok(!isAllowedRedirectUri('http://claude.ai/api/mcp/auth_callback'));
  assert.ok(!isAllowedRedirectUri('https://claude.ai.evil.com/cb'));
  assert.ok(!isAllowedRedirectUri('https://evilclaude.ai/cb'));
  assert.ok(!isAllowedRedirectUri('https://claude.ai/cb#frag'));
  assert.ok(!isAllowedRedirectUri('javascript:alert(1)'));
});

test('rozilik imzosi: o\'zgartirilsa rad etiladi', () => {
  const s = signConsentRequest({ clientId: 'c', redirectUri: 'https://claude.ai/x', codeChallenge: 'ch', scopes: ['ils:read'] });
  assert.equal(verifyConsentRequest(s).clientId, 'c');
  const [body, sig] = s.split('.');
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url')), redirectUri: 'https://evil' })).toString('base64url');
  assert.equal(verifyConsentRequest(`${forged}.${sig}`), null);
  assert.equal(verifyConsentRequest('garbage'), null);
});

async function toolsFor(scopes) {
  const server = createMcpServer({
    userId: '00000000-0000-4000-8000-000000000000', fullName: 'Test', role: 'admin', scopes,
    clientId: 'c', clientName: 'Test', via: 'oauth',
  });
  const client = new Client({ name: 't', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(b), client.connect(a)]);
  const { tools } = await client.listTools();
  return { tools, client, server };
}

test('amallar ro\'yxati huquqqa bog\'liq', async () => {
  const r = await toolsFor(['ils:read']);
  const readNames = r.tools.map((t) => t.name);
  assert.ok(readNames.includes('ils_overview') && readNames.includes('ils_sql_query'));
  assert.ok(r.tools.every((t) => t.annotations?.readOnlyHint === true));
  assert.ok(!readNames.some((n) => n.startsWith('ils_create') || n === 'ils_transfer_student'));
  assert.equal(readNames.length, 16);
  assert.ok(readNames.includes('ils_get_record') && !readNames.includes('ils_record_change'));
  const res = await r.client.callTool({ name: 'ils_create_group', arguments: { name: 'x' } }).catch((e) => ({ isError: true, e }));
  assert.equal(res.isError, true);
  await r.client.close();

  const w = await toolsFor(['ils:read', 'ils:write']);
  const writeNames = w.tools.map((t) => t.name);
  for (const n of ['ils_create_group', 'ils_update_group', 'ils_add_students_to_group', 'ils_remove_student_from_group',
    'ils_transfer_student', 'ils_create_normative', 'ils_update_normative', 'ils_assign_normatives',
    'ils_mark_milestone_held', 'ils_set_user_active']) {
    assert.ok(writeNames.includes(n), n);
  }
  const destructive = w.tools.filter((t) => t.annotations?.destructiveHint).map((t) => t.name).sort();
  assert.deepEqual(destructive, [
    'ils_group_lifecycle', 'ils_record_change', 'ils_remove_student_from_group', 'ils_reset_password',
    'ils_set_permissions', 'ils_set_user_active', 'ils_transfer_student', 'ils_undo_change', 'ils_unfreeze',
  ]);
  assert.equal(writeNames.length, 45);
  for (const n of ['ils_check_submission', 'ils_create_user', 'ils_grade_lesson', 'ils_record_change', 'ils_undo_change', 'ils_send_notification']) {
    assert.ok(writeNames.includes(n), n);
  }
  await w.client.close();
});
