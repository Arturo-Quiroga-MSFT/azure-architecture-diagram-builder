// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// Remote MCP authorization tests: Entra token validation with locally signed
// JWTs (no network), plus the HTTP contract (Protected Resource Metadata,
// 401/403 challenges, static-token fallback) against the built server.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import { authorizeRequest, hashClientKey, loadAuthConfig, parseClientKeys, protectedResourceMetadata, verifyEntraToken } from '../dist/auth.js';

const CLIENT_ID = '11111111-2222-3333-4444-555555555555';
const TID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const OTHER_TID = 'ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee';
const AUTHORITY = 'https://login.microsoftonline.com';

const { publicKey, privateKey } = await generateKeyPair('RS256');
const jwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };
const keys = createLocalJWKSet({ keys: [jwk] });
const { privateKey: rogueKey } = await generateKeyPair('RS256');

async function token(overrides = {}, { key = privateKey, exp = '10m' } = {}) {
  const claims = { tid: TID, scp: 'mcp.tools', oid: 'user-oid', ver: '2.0', ...overrides };
  const jwt = new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuedAt()
    .setIssuer(overrides.iss ?? `${AUTHORITY}/${claims.tid}/v2.0`)
    .setAudience(overrides.aud ?? CLIENT_ID);
  if (exp) jwt.setExpirationTime(exp);
  return jwt.sign(key);
}

const entra = { clientId: CLIENT_ID, scope: 'mcp.tools', allowedTenants: [], authority: AUTHORITY };

// ── Token validation ───────────────────────────────────────────────────────
let r = await verifyEntraToken(await token(), entra, keys);
assert.deepEqual(r, { ok: true, method: 'entra', tenantId: TID, objectId: 'user-oid' });
assert.equal((await verifyEntraToken(await token({ aud: `api://${CLIENT_ID}` }), entra, keys)).ok, true, 'App ID URI audience');
assert.equal((await verifyEntraToken(await token({ aud: 'some-other-api' }), entra, keys)).error, 'invalid_token', 'wrong audience');
const MCP_URL = 'https://mcp.example.test/mcp';
assert.equal((await verifyEntraToken(await token({ aud: MCP_URL }), entra, keys)).error, 'invalid_token', 'MCP URL audience rejected unless configured');
assert.equal((await verifyEntraToken(await token({ aud: MCP_URL }), { ...entra, extraAudiences: [MCP_URL] }, keys)).ok, true, 'MCP URL audience (RFC 8707 resource)');
assert.deepEqual(loadAuthConfig({ MCP_ENTRA_CLIENT_ID: CLIENT_ID, MCP_PUBLIC_URL: 'https://mcp.example.test/', MCP_HTTP_PATH: '/mcp' }).entra.extraAudiences, [MCP_URL], 'public MCP URL becomes an accepted audience');
assert.deepEqual(loadAuthConfig({ MCP_ENTRA_CLIENT_ID: CLIENT_ID }).entra.extraAudiences, [], 'no public URL, no extra audience');
assert.equal((await verifyEntraToken(await token({ scp: 'User.Read' }), entra, keys)).error, 'insufficient_scope', 'missing scope');
assert.equal((await verifyEntraToken(await token({}, { key: rogueKey }), entra, keys)).error, 'invalid_token', 'bad signature');
assert.equal((await verifyEntraToken(await token({}, { exp: Math.floor(Date.now() / 1000) - 600 }), entra, keys)).error, 'invalid_token', 'expired');
assert.equal((await verifyEntraToken(await token({ iss: `${AUTHORITY}/${OTHER_TID}/v2.0` }), entra, keys)).error, 'invalid_token', 'issuer from another tenant');
assert.equal((await verifyEntraToken(await token({ iss: 'https://evil.example/v2.0' }), entra, keys)).error, 'invalid_token', 'foreign issuer');
assert.equal((await verifyEntraToken(await token({}, { exp: null }), entra, keys)).error, 'invalid_token', 'token without exp');
r = await verifyEntraToken(await token(), { ...entra, allowedTenants: [OTHER_TID] }, keys);
assert.equal(r.error, 'invalid_token', 'tenant allow-list');

// ── Request authorization (Entra + static fallback) ────────────────────────
const both = { entra, staticToken: 'static-secret-value' };
assert.equal((await authorizeRequest(undefined, both, keys)).error, 'missing_token');
assert.equal((await authorizeRequest('Basic abc', both, keys)).error, 'missing_token');
assert.deepEqual(await authorizeRequest('Bearer static-secret-value', both, keys), { ok: true, method: 'static' });
assert.equal((await authorizeRequest('Bearer wrong-static', both, keys)).error, 'invalid_token');
assert.equal((await authorizeRequest(`Bearer ${await token()}`, both, keys)).method, 'entra');
assert.deepEqual(await authorizeRequest(undefined, {}, keys), { ok: true, method: 'none' });

// ── Named client keys ──────────────────────────────────────────────────────
const COPILOT_KEY = 'aadb_ck_test-copilot-key-value';
const PARTNER_KEY = 'aadb_ck_test-partner-key-value';
const clientKeys = parseClientKeys(`azure-copilot=${hashClientKey(COPILOT_KEY)}, partner-x=${hashClientKey(PARTNER_KEY).toUpperCase()}`);
assert.deepEqual(clientKeys.map(k => k.name), ['azure-copilot', 'partner-x']);
assert.deepEqual(parseClientKeys(undefined), []);
assert.deepEqual(parseClientKeys(' none '), [], 'deploy placeholder means no keys');
assert.throws(() => parseClientKeys('Bad Name=abc'), /invalid entry/);
assert.throws(() => parseClientKeys(`a=${'0'.repeat(63)}`), /invalid entry/, 'short hash');
assert.throws(() => parseClientKeys(`a=${'0'.repeat(64)},a=${'1'.repeat(64)}`), /duplicate/);
const withKeys = { ...both, clientKeys };
assert.deepEqual(await authorizeRequest(`Bearer ${COPILOT_KEY}`, withKeys, keys), { ok: true, method: 'client-key', client: 'azure-copilot' });
assert.deepEqual(await authorizeRequest(undefined, withKeys, keys, PARTNER_KEY), { ok: true, method: 'client-key', client: 'partner-x' }, 'X-API-Key header');
assert.equal((await authorizeRequest(undefined, withKeys, keys, 'wrong-key')).error, 'invalid_token', 'bad X-API-Key');
assert.equal((await authorizeRequest(`Bearer ${COPILOT_KEY}`, both, keys)).error, 'invalid_token', 'revoked key (not configured)');
assert.equal((await authorizeRequest(undefined, withKeys, keys, 'static-secret-value')).error, 'invalid_token', 'static token is not an API key');
assert.deepEqual(await authorizeRequest(`Bearer ${COPILOT_KEY}`, { clientKeys }, keys), { ok: true, method: 'client-key', client: 'azure-copilot' }, 'keys alone enable auth');
assert.equal((await authorizeRequest(undefined, { clientKeys }, keys)).error, 'missing_token', 'keys alone close the endpoint');
assert.equal(loadAuthConfig({ MCP_CLIENT_KEYS: `azure-copilot=${hashClientKey(COPILOT_KEY)}` }).clientKeys[0].name, 'azure-copilot');

// ── Config + metadata ──────────────────────────────────────────────────────
const cfg = loadAuthConfig({ MCP_ENTRA_CLIENT_ID: CLIENT_ID, MCP_ENTRA_ALLOWED_TENANTS: ` ${TID.toUpperCase()} ` });
assert.deepEqual(cfg.entra.allowedTenants, [TID]);
const prm = protectedResourceMetadata(cfg.entra, 'https://mcp.example/mcp');
assert.equal(prm.resource, 'https://mcp.example/mcp');
assert.deepEqual(prm.authorization_servers, [`${AUTHORITY}/${TID}/v2.0`], 'single allowed tenant pins the authority');
assert.deepEqual(protectedResourceMetadata(entra, 'x').authorization_servers, [`${AUTHORITY}/organizations/v2.0`]);
assert.deepEqual(prm.scopes_supported, [`api://${CLIENT_ID}/mcp.tools`]);

// ── HTTP contract against the built server ─────────────────────────────────
const port = await new Promise((resolve, reject) => {
  const s = createServer();
  s.once('error', reject);
  s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
});
const child = spawn(process.execPath, ['dist/index.js', '--http'], {
  env: { ...process.env, MCP_HTTP_PORT: String(port), MCP_HTTP_HOST: '127.0.0.1', MCP_ENTRA_CLIENT_ID: CLIENT_ID, MCP_AUTH_TOKEN: 'static-secret-value', MCP_CLIENT_KEYS: `azure-copilot=${hashClientKey(COPILOT_KEY)}` },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let stderr = '';
let stdout = '';
child.stderr.on('data', d => { stderr += d; });
child.stdout.on('data', d => { stdout += d; });
const usageRecords = () => stdout.split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(r => r.event === 'mcp_request');
const base = `http://127.0.0.1:${port}`;
try {
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${base}/healthz`)).ok) break; } catch { /* starting */ }
    await new Promise(res => setTimeout(res, 100));
  }
  for (const path of ['/.well-known/oauth-protected-resource/mcp', '/.well-known/oauth-protected-resource']) {
    const res = await fetch(`${base}${path}`, { headers: { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'aadb-mcp.example' } });
    assert.equal(res.status, 200, path);
    const body = await res.json();
    assert.equal(body.resource, 'https://aadb-mcp.example/mcp', 'resource derived from forwarded headers');
    assert.deepEqual(body.scopes_supported, [`api://${CLIENT_ID}/mcp.tools`]);
  }
  const init = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'auth-test', version: '1' } } };
  const post = (auth) => fetch(`${base}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...(auth ? { authorization: auth } : {}) },
    body: JSON.stringify(init),
  });
  let res = await post();
  assert.equal(res.status, 401);
  const challenge = res.headers.get('www-authenticate');
  assert.match(challenge, /^Bearer resource_metadata="http:\/\/127\.0\.0\.1:\d+\/\.well-known\/oauth-protected-resource\/mcp"/);
  assert.match(challenge, new RegExp(`scope="api://${CLIENT_ID}/mcp.tools"`));
  res = await post('Bearer not-a-jwt');
  assert.equal(res.status, 401);
  assert.match(res.headers.get('www-authenticate'), /error="invalid_token"/);
  res = await post('Bearer static-secret-value');
  assert.equal(res.status, 200, 'static token still accepted');
  assert.match(await res.text(), /"serverInfo"/);
  res = await fetch(`${base}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: 'Bearer static-secret-value' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'list_services', arguments: { category: 'databases' } } }),
  });
  assert.equal(res.status, 200);
  await res.text();
  await new Promise(r => setTimeout(r, 200));
  const records = usageRecords();
  const rejected = records.filter(r => r.auth === 'rejected');
  assert.ok(rejected.some(r => r.status === 401 && r.authError === 'missing_token'), 'usage log: missing token');
  assert.ok(rejected.some(r => r.status === 401 && r.authError === 'invalid_token'), 'usage log: invalid token');
  const initRec = records.find(r => r.auth === 'static' && r.rpcMethods?.includes('initialize'));
  assert.equal(initRec?.clientName, 'auth-test', 'usage log: client name from initialize');
  assert.equal(initRec?.status, 200);
  const toolRec = records.find(r => r.tools?.includes('list_services'));
  assert.deepEqual(toolRec?.toolResults?.map(t => [t.tool, t.ok]), [['list_services', true]], 'usage log: tool outcome');
  assert.ok(!stdout.includes('static-secret-value') && !stdout.includes('databases'), 'usage log never contains tokens or tool arguments');
  const postWith = (headers) => fetch(`${base}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers },
    body: JSON.stringify({ ...init, params: { ...init.params, clientInfo: { name: 'azure-copilot-test', version: '1' } } }),
  });
  res = await postWith({ authorization: `Bearer ${COPILOT_KEY}` });
  assert.equal(res.status, 200, 'client key as bearer token');
  await res.text();
  res = await postWith({ 'x-api-key': COPILOT_KEY });
  assert.equal(res.status, 200, 'client key in X-API-Key');
  await res.text();
  res = await postWith({ 'x-api-key': PARTNER_KEY });
  assert.equal(res.status, 401, 'unconfigured client key rejected');
  await res.text();
  const cors = await fetch(`${base}/mcp`, { method: 'OPTIONS' });
  assert.match(cors.headers.get('access-control-allow-headers') ?? '', /X-API-Key/, 'CORS allows X-API-Key');
  await new Promise(r => setTimeout(r, 200));
  const keyRecs = usageRecords().filter(r => r.auth === 'client-key');
  assert.equal(keyRecs.length, 2, 'usage log: client-key calls');
  assert.ok(keyRecs.every(r => r.clientKey === 'azure-copilot'), 'usage log: client attribution');
  assert.ok(!stdout.includes(COPILOT_KEY) && !stdout.includes(PARTNER_KEY), 'usage log never contains client keys');
  assert.match(stderr, /Client keys accepted on \/mcp: azure-copilot/);
  assert.ok(!stderr.includes(COPILOT_KEY), 'startup log never contains client keys');
  assert.equal((await fetch(`${base}/healthz`)).status, 200, 'health stays open');
} catch (err) {
  console.error(stderr);
  throw err;
} finally {
  child.kill();
}

console.log('MCP auth test passed: Entra audience/issuer/tenant/scope/signature/expiry, static fallback, metadata, 401/403 challenges, usage log.');
