// Shared designs API (server/shares.js): capability links, owner keys, expiry, limits.
const assert = require('node:assert/strict');
const express = require('../server/node_modules/express');
const shares = require('../server/shares');

const design = (n = 3) => ({
  nodes: Array.from({ length: n }, (_, i) => ({ id: `n${i}`, type: 'azureNode', position: { x: i * 100, y: 0 }, data: { label: 'App Service' } })),
  edges: [{ id: 'e0', source: 'n0', target: 'n1' }],
  metadata: { architectureName: 'Clinic booking' },
  workflow: [{ step: 1, description: 'Request', services: ['n0'] }],
  originalPrompt: 'Contoso clinic booking for 40 clinics',
});

(async () => {
  let clock = Date.parse('2026-10-26T12:00:00Z');
  const store = shares.createMemoryStore();
  const app = express();
  // Same order as token-server.js: the shares parser must come before the 16 KB global one.
  app.use('/api/shares', express.json({ limit: '300kb' }));
  app.use(express.json({ limit: '16kb' }));
  shares.registerShareRoutes(app, express, store, {
    now: () => clock,
    appVersion: '9.9.9',
    createLimiter: shares.createRateLimiter({ limit: 3, windowMs: 3600_000, now: () => clock }),
    log: { error() {}, warn() {} },
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body, headers = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.0.0.1, 203.0.113.7', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 80) }; }
    return { status: res.status, headers: res.headers, json };
  };

  try {
    // Create
    let r = await call('POST', '/api/shares', { design: design(), title: '  Clinic booking  ', summary: { services: 3, monthlyCost: 118.834, region: 'eastus2', wafBand: 'Adequate', bogus: 'x' } });
    assert.equal(r.status, 201);
    const { id, ownerKey, url, expiresAt } = r.json;
    assert.match(id, shares.ID_RE, 'id is 22 base64url characters (128 bits)');
    assert.equal(url, `/d/${id}`);
    assert.equal(ownerKey.length, 43, 'owner key is 256 bits');
    assert.equal(expiresAt, '2026-11-25T12:00:00.000Z', 'default expiry is 30 days');
    assert.equal(r.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.equal(r.headers.get('cache-control'), 'no-store');

    const stored = store._items.get(id);
    assert.equal(stored.ownerKeyHash, shares.hashKey(ownerKey), 'only the owner key hash is stored');
    assert.ok(!JSON.stringify(stored).includes(ownerKey), 'the owner key itself is never stored');
    assert.equal(stored.ttl, 30 * 86400);
    assert.equal(stored.design.originalPrompt, undefined, 'the brief is left out unless asked for');
    assert.equal(stored.title, 'Clinic booking');
    assert.deepEqual(stored.summary, { services: 3, monthlyCost: 118.83, region: 'eastus2', wafBand: 'Adequate' });
    assert.equal(stored.appVersion, '9.9.9');

    // Read (viewer)
    r = await call('GET', `/api/shares/${id}`);
    assert.equal(r.status, 200);
    assert.equal(r.json.title, 'Clinic booking');
    assert.equal(r.json.design.nodes.length, 3);
    assert.equal(r.json.ownerKeyHash, undefined, 'viewers never see the owner hash');
    assert.equal(r.json.owner, undefined);
    await new Promise((res) => setTimeout(res, 20));
    assert.equal(store._items.get(id).views, 1, 'a view is counted');

    // Read (owner check-in): activity reported, not counted as a view
    r = await call('GET', `/api/shares/${id}`, undefined, { 'x-owner-key': ownerKey });
    assert.deepEqual(r.json.owner, { views: 1, lastViewedAt: '2026-10-26T12:00:00.000Z' });
    await new Promise((res) => setTimeout(res, 20));
    assert.equal(store._items.get(id).views, 1);

    // Brief only when asked; expiry choices; size and shape limits
    r = await call('POST', '/api/shares', { design: design(), includeBrief: true, expiresInDays: 7 });
    assert.equal(r.status, 201);
    assert.equal(store._items.get(r.json.id).design.originalPrompt, 'Contoso clinic booking for 40 clinics');
    assert.equal(r.json.expiresAt, '2026-11-02T12:00:00.000Z');
    assert.equal(r.json.title, 'Clinic booking', 'title falls back to the design name');
    const second = r.json;

    r = await call('POST', '/api/shares', { design: { nodes: [] } }, { 'x-forwarded-for': '198.51.100.20' });
    assert.equal(r.status, 400, 'an empty design is rejected');
    r = await call('POST', '/api/shares', { design: design() }, { 'x-forwarded-for': '198.51.100.20' });
    assert.equal(r.status, 201);
    r = await call('POST', '/api/shares', { design: { nodes: [] } }, { 'x-forwarded-for': '198.51.100.20' });
    assert.equal(r.status, 400);
    r = await call('POST', '/api/shares', { design: design() }, { 'x-forwarded-for': '198.51.100.20' });
    assert.equal(r.status, 429, 'rejected attempts count toward the limit too');
    r = await call('POST', '/api/shares', { design: 'nope' }, { 'x-forwarded-for': '198.51.100.21' });
    assert.equal(r.status, 400);
    const big = design(1);
    big.nodes[0].data.note = 'x'.repeat(310 * 1024);
    r = await call('POST', '/api/shares', { design: big }, { 'x-forwarded-for': '198.51.100.22' });
    assert.equal(r.status, 413, 'requests over the 300 KB body limit are refused by the parser');
    assert.match(r.json.error, /too large to share/, 'oversized requests get a JSON error, not an HTML stack trace');
    const bad = await fetch(base + '/api/shares', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.23' }, body: '{not json' });
    assert.equal(bad.status, 400);
    assert.deepEqual(await bad.json(), { error: 'Request body is not valid JSON' });
    big.nodes[0].data.note = 'x'.repeat(260 * 1024);
    r = await call('POST', '/api/shares', { design: big }, { 'x-forwarded-for': '198.51.100.22' });
    assert.equal(r.status, 400);
    assert.match(r.json.error, /limit is 256 KB/, 'designs over 256 KB are rejected');

    // Rate limit on creation, keyed on the last X-Forwarded-For hop (the one ingress appended)
    r = await call('POST', '/api/shares', { design: design() }); // 3rd success for 203.0.113.7
    assert.equal(r.status, 201);
    r = await call('POST', '/api/shares', { design: design() });
    assert.equal(r.status, 429, 'creation is rate limited per client');
    r = await call('POST', '/api/shares', { design: design() }, { 'x-forwarded-for': '203.0.113.7, 198.51.100.9' });
    assert.equal(r.status, 201, 'a forged first hop does not borrow or evade another client\'s limit');

    // Update: owner only, keeps the original expiry unless a new one is chosen
    const changed = design(4);
    r = await call('PUT', `/api/shares/${id}`, { design: changed, title: 'Clinic booking v2' }, { 'x-owner-key': 'A'.repeat(43) });
    assert.equal(r.status, 403, 'a wrong owner key cannot update');
    r = await call('PUT', `/api/shares/${id}`, { design: changed, title: 'Clinic booking v2' });
    assert.equal(r.status, 403, 'no owner key cannot update');
    clock += 86400_000;
    r = await call('PUT', `/api/shares/${id}`, { design: changed, title: 'Clinic booking v2' }, { 'x-owner-key': ownerKey });
    assert.equal(r.status, 200);
    assert.equal(r.json.expiresAt, expiresAt, 'updating keeps the expiry date');
    assert.equal(store._items.get(id).ttl, 29 * 86400, 'TTL is recomputed from the remaining time');
    r = await call('GET', `/api/shares/${id}`);
    assert.equal(r.json.design.nodes.length, 4);
    assert.equal(r.json.title, 'Clinic booking v2');

    // Expiry
    clock = Date.parse('2026-11-03T00:00:00Z');
    r = await call('GET', `/api/shares/${second.id}`);
    assert.equal(r.status, 404, 'an expired share is gone even before Cosmos TTL removes it');
    r = await call('DELETE', `/api/shares/${second.id}`, undefined, { 'x-owner-key': second.ownerKey });
    assert.equal(r.status, 404);

    // Revoke
    r = await call('DELETE', `/api/shares/${id}`, undefined, { 'x-owner-key': 'B'.repeat(43) });
    assert.equal(r.status, 403);
    r = await call('DELETE', `/api/shares/${id}`, undefined, { 'x-owner-key': ownerKey });
    assert.equal(r.status, 204);
    assert.equal(store._items.has(id), false, 'revoking deletes the share');
    r = await call('GET', `/api/shares/${id}`);
    assert.equal(r.status, 404);

    // Malformed ids never reach storage
    r = await call('GET', '/api/shares/..%2F..%2Fetc');
    assert.equal(r.status, 404);
    r = await call('GET', `/api/shares/${'a'.repeat(23)}`);
    assert.equal(r.status, 404);

    // Not configured
    const off = express();
    shares.registerShareRoutes(off, express, null, { log: { error() {}, warn() {} } });
    const s2 = off.listen(0, '127.0.0.1');
    await new Promise((res) => s2.once('listening', res));
    const r2 = await fetch(`http://127.0.0.1:${s2.address().port}/api/shares/${'a'.repeat(22)}`);
    assert.equal(r2.status, 503);
    s2.close();

    console.log('Shared designs API tests passed.');
  } finally {
    server.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
