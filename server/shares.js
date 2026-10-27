// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Shared designs: capability links to a read-only snapshot of a design.
 * See DOCS/SHARED-DESIGNS.md.
 *
 * - The share id (128 random bits, base64url) is the read capability: anyone
 *   holding the link can view. Nothing is listed or searchable.
 * - Creating a share returns an owner key (256 random bits). Only its SHA-256
 *   hash is stored; updating or revoking requires the key.
 * - Shares expire (Cosmos per-item TTL, also checked on read) and can be
 *   revoked, which deletes them.
 *
 * Storage is a small interface so tests and local runs can use memory; the
 * deployed app uses the Cosmos `diagrams` container over its private endpoint.
 */

const crypto = require('crypto');

const ID_RE = /^[A-Za-z0-9_-]{22}$/;
const KEY_RE = /^[A-Za-z0-9_-]{43}$/;
const MAX_DESIGN_BYTES = 256 * 1024;
const MAX_NODES = 600;
const MAX_EDGES = 2000;
const EXPIRY_CHOICES = [7, 30, 90];
const DEFAULT_EXPIRY_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const newId = () => crypto.randomBytes(16).toString('base64url');
const newOwnerKey = () => crypto.randomBytes(32).toString('base64url');
const hashKey = (key) => crypto.createHash('sha256').update(key).digest('hex');

function keyMatches(presented, storedHash) {
  if (!KEY_RE.test(presented || '') || typeof storedHash !== 'string' || storedHash.length !== 64) return false;
  return crypto.timingSafeEqual(Buffer.from(hashKey(presented), 'hex'), Buffer.from(storedHash, 'hex'));
}

const str = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const num = (value, min, max) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : undefined;
};

/**
 * Keep only what a viewer needs. The design is the same JSON as the app's Save
 * button; prompts are included only when the owner asked for them.
 */
function sanitizeDesign(raw, includeBrief) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'design must be an object' };
  if (!Array.isArray(raw.nodes) || raw.nodes.length === 0) return { error: 'design.nodes must be a non-empty array' };
  if (raw.nodes.length > MAX_NODES) return { error: `design has more than ${MAX_NODES} nodes` };
  const edges = Array.isArray(raw.edges) ? raw.edges : [];
  if (edges.length > MAX_EDGES) return { error: `design has more than ${MAX_EDGES} connections` };
  const design = {
    nodes: raw.nodes,
    edges,
    ...(raw.viewport && typeof raw.viewport === 'object' ? { viewport: raw.viewport } : {}),
    ...(raw.metadata && typeof raw.metadata === 'object' ? { metadata: raw.metadata } : {}),
    ...(Array.isArray(raw.workflow) ? { workflow: raw.workflow } : {}),
  };
  if (includeBrief) {
    const brief = str(raw.originalPrompt || raw.architecturePrompt, 20000);
    if (brief) design.originalPrompt = brief;
  }
  const bytes = Buffer.byteLength(JSON.stringify(design));
  if (bytes > MAX_DESIGN_BYTES) return { error: `design is ${Math.round(bytes / 1024)} KB; the limit is ${MAX_DESIGN_BYTES / 1024} KB` };
  return { design };
}

function sanitizeSummary(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    services: num(s.services, 0, MAX_NODES) ?? 0,
    ...(num(s.monthlyCost, 0, 1e9) !== undefined ? { monthlyCost: Math.round(num(s.monthlyCost, 0, 1e9) * 100) / 100 } : {}),
    ...(str(s.region, 40) ? { region: str(s.region, 40) } : {}),
    ...(str(s.wafBand, 60) ? { wafBand: str(s.wafBand, 60) } : {}),
    ...(num(s.wafScore, 0, 100) !== undefined ? { wafScore: Math.round(num(s.wafScore, 0, 100)) } : {}),
  };
}

function expiryDays(value) {
  const n = Number(value);
  return EXPIRY_CHOICES.includes(n) ? n : DEFAULT_EXPIRY_DAYS;
}

/** What a viewer receives. No owner hash, no counters. */
function publicView(item) {
  return {
    id: item.id,
    title: item.title,
    design: item.design,
    summary: item.summary,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    expiresAt: item.expiresAt,
    appVersion: item.appVersion,
  };
}

/** Fixed-window per-client limiter (per replica; enough to stop scripted floods). */
function createRateLimiter({ limit, windowMs, now = () => Date.now() }) {
  const hits = new Map();
  return function allow(key) {
    const t = now();
    const entry = hits.get(key);
    if (!entry || t - entry.start >= windowMs) {
      hits.set(key, { start: t, count: 1 });
      if (hits.size > 10000) {
        for (const [k, v] of hits) if (t - v.start >= windowMs) hits.delete(k);
      }
      return true;
    }
    entry.count += 1;
    return entry.count <= limit;
  };
}

/**
 * Client address for rate limiting. Behind Container Apps ingress (Envoy) and
 * nginx, X-Real-IP is the proxy; Envoy appends the real client address as the
 * LAST X-Forwarded-For entry, and earlier entries can be forged by the client.
 */
function clientKey(req) {
  const hops = String(req.get('x-forwarded-for') || '').split(',').map((h) => h.trim()).filter(Boolean);
  return hops[hops.length - 1] || req.ip || 'unknown';
}

/** In-memory store for tests and local runs (SHARES_STORE=memory). */
function createMemoryStore() {
  const items = new Map();
  return {
    kind: 'memory',
    async create(item) { items.set(item.id, JSON.parse(JSON.stringify(item))); },
    async read(id) { const v = items.get(id); return v ? JSON.parse(JSON.stringify(v)) : null; },
    async replace(item) { items.set(item.id, JSON.parse(JSON.stringify(item))); },
    async remove(id) { items.delete(id); },
    async recordView(id, at) {
      const v = items.get(id);
      if (v) { v.views = (v.views || 0) + 1; v.lastViewedAt = at; }
    },
    _items: items,
  };
}

/** Cosmos store over a container client (partition key /id). */
function createCosmosStore(getContainer) {
  const container = () => {
    const c = getContainer();
    if (!c) throw Object.assign(new Error('Share storage is not configured'), { status: 503 });
    return c;
  };
  const notFound = (err) => err && (err.code === 404 || err.statusCode === 404);
  return {
    kind: 'cosmos',
    async create(item) { await container().items.create(item); },
    async read(id) {
      try {
        const { resource } = await container().item(id, id).read();
        return resource || null;
      } catch (err) {
        if (notFound(err)) return null;
        throw err;
      }
    },
    async replace(item) { await container().item(item.id, item.id).replace(item); },
    async remove(id) {
      try { await container().item(id, id).delete(); } catch (err) { if (!notFound(err)) throw err; }
    },
    async recordView(id, at) {
      await container().item(id, id).patch([
        { op: 'incr', path: '/views', value: 1 },
        { op: 'set', path: '/lastViewedAt', value: at },
      ]);
    },
  };
}

/**
 * Mount /api/shares. `store` is null when sharing is not configured (503).
 * Options are injectable for tests.
 */
function registerShareRoutes(app, express, store, opts = {}) {
  const now = opts.now || (() => Date.now());
  const appVersion = opts.appVersion || process.env.APP_VERSION || 'unknown';
  const allowCreate = opts.createLimiter || createRateLimiter({ limit: 60, windowMs: 60 * 60 * 1000, now });
  const allowWrite = opts.writeLimiter || createRateLimiter({ limit: 120, windowMs: 60 * 60 * 1000, now });
  const log = opts.log || console;

  // The host app must register express.json({ limit: '300kb' }) for /api/shares
  // BEFORE any smaller global JSON parser (token-server.js does); this one is a
  // fallback for hosts without a global parser.
  app.use('/api/shares', express.json({ limit: '300kb' }));
  app.use('/api/shares', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    if (!store) return res.status(503).json({ error: 'Sharing is not configured on this deployment' });
    next();
  });

  const fail = (res, err, what) => {
    if (err && err.status === 503) return res.status(503).json({ error: err.message });
    log.error(`[shares] ${what} failed:`, err && err.message);
    return res.status(500).json({ error: `Failed to ${what}` });
  };
  const isLive = (item) => item && item.type === 'share' && Date.parse(item.expiresAt) > now();
  const ownerKeyOf = (req) => req.get('x-owner-key') || '';

  app.post('/api/shares', async (req, res) => {
    if (!allowCreate(clientKey(req))) return res.status(429).json({ error: 'Too many shares created; try again later' });
    const body = req.body || {};
    const { design, error } = sanitizeDesign(body.design, body.includeBrief === true);
    if (error) return res.status(400).json({ error });
    const days = expiryDays(body.expiresInDays);
    const created = new Date(now());
    const ownerKey = newOwnerKey();
    const item = {
      id: newId(),
      type: 'share',
      schemaVersion: 1,
      title: str(body.title, 200) || str(design.metadata && design.metadata.architectureName, 200) || 'Azure architecture',
      design,
      summary: sanitizeSummary(body.summary),
      ownerKeyHash: hashKey(ownerKey),
      createdAt: created.toISOString(),
      updatedAt: created.toISOString(),
      expiresAt: new Date(created.getTime() + days * DAY_MS).toISOString(),
      views: 0,
      lastViewedAt: null,
      appVersion,
      ttl: days * 24 * 60 * 60,
    };
    try {
      await store.create(item);
    } catch (err) {
      return fail(res, err, 'create the share');
    }
    return res.status(201).json({ id: item.id, ownerKey, url: `/d/${item.id}`, expiresAt: item.expiresAt, title: item.title });
  });

  app.get('/api/shares/:id', async (req, res) => {
    const { id } = req.params;
    if (!ID_RE.test(id)) return res.status(404).json({ error: 'Not found' });
    let item;
    try {
      item = await store.read(id);
    } catch (err) {
      return fail(res, err, 'read the share');
    }
    if (!isLive(item)) return res.status(404).json({ error: 'This link has expired or was removed' });
    const presented = ownerKeyOf(req);
    if (presented && keyMatches(presented, item.ownerKeyHash)) {
      // The owner's own check-in: report activity, don't count it as a view.
      return res.json({ ...publicView(item), owner: { views: item.views || 0, lastViewedAt: item.lastViewedAt || null } });
    }
    store.recordView(id, new Date(now()).toISOString()).catch((err) => log.warn('[shares] view count failed:', err && err.message));
    return res.json(publicView(item));
  });

  async function loadOwned(req, res) {
    const { id } = req.params;
    if (!ID_RE.test(id)) { res.status(404).json({ error: 'Not found' }); return null; }
    if (!allowWrite(clientKey(req))) { res.status(429).json({ error: 'Too many changes; try again later' }); return null; }
    let item;
    try {
      item = await store.read(id);
    } catch (err) {
      fail(res, err, 'read the share');
      return null;
    }
    if (!isLive(item)) { res.status(404).json({ error: 'This link has expired or was removed' }); return null; }
    if (!keyMatches(ownerKeyOf(req), item.ownerKeyHash)) { res.status(403).json({ error: 'Only the owner can change this link' }); return null; }
    return item;
  }

  app.put('/api/shares/:id', async (req, res) => {
    const item = await loadOwned(req, res);
    if (!item) return;
    const body = req.body || {};
    const { design, error } = sanitizeDesign(body.design, body.includeBrief === true);
    if (error) return res.status(400).json({ error });
    const t = new Date(now());
    const updated = {
      ...item,
      design,
      title: str(body.title, 200) || item.title,
      summary: sanitizeSummary(body.summary),
      updatedAt: t.toISOString(),
      appVersion,
    };
    if (body.expiresInDays !== undefined) {
      const days = expiryDays(body.expiresInDays);
      updated.expiresAt = new Date(t.getTime() + days * DAY_MS).toISOString();
      updated.ttl = days * 24 * 60 * 60;
    } else {
      // Cosmos counts ttl from the last write; keep the original expiry date.
      updated.ttl = Math.max(60, Math.ceil((Date.parse(item.expiresAt) - t.getTime()) / 1000));
    }
    try {
      await store.replace(updated);
    } catch (err) {
      return fail(res, err, 'update the share');
    }
    return res.json({ id: updated.id, url: `/d/${updated.id}`, expiresAt: updated.expiresAt, title: updated.title, updatedAt: updated.updatedAt });
  });

  // Body-parser errors (too large, bad JSON) as JSON, never Express's HTML page.
  app.use('/api/shares', (err, _req, res, next) => {
    if (err && err.type === 'entity.too.large') {
      return res.status(413).json({ error: `Design is too large to share (limit ${MAX_DESIGN_BYTES / 1024} KB)` });
    }
    if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON' });
    return next(err);
  });

  app.delete('/api/shares/:id', async (req, res) => {
    const item = await loadOwned(req, res);
    if (!item) return;
    try {
      await store.remove(item.id);
    } catch (err) {
      return fail(res, err, 'remove the share');
    }
    return res.status(204).end();
  });
}

module.exports = {
  registerShareRoutes,
  createMemoryStore,
  createCosmosStore,
  createRateLimiter,
  clientKey,
  sanitizeDesign,
  sanitizeSummary,
  hashKey,
  keyMatches,
  ID_RE,
  EXPIRY_CHOICES,
  MAX_DESIGN_BYTES,
};
