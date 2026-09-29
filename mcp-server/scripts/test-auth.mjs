// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// Remote MCP authorization tests: Entra token validation with locally signed
// JWTs (no network), plus the HTTP contract (Protected Resource Metadata,
// 401/403 challenges, static-token fallback) against the built server.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import { authorizeRequest, loadAuthConfig, protectedResourceMetadata, verifyEntraToken } from '../dist/auth.js';

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
  env: { ...process.env, MCP_HTTP_PORT: String(port), MCP_HTTP_HOST: '127.0.0.1', MCP_ENTRA_CLIENT_ID: CLIENT_ID, MCP_AUTH_TOKEN: 'static-secret-value' },
  stdio: ['ignore', 'ignore', 'pipe'],
});
let stderr = '';
child.stderr.on('data', d => { stderr += d; });
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
  assert.equal((await fetch(`${base}/healthz`)).status, 200, 'health stays open');
} catch (err) {
  console.error(stderr);
  throw err;
} finally {
  child.kill();
}

console.log('MCP auth test passed: Entra audience/issuer/tenant/scope/signature/expiry, static fallback, metadata, 401/403 challenges.');
