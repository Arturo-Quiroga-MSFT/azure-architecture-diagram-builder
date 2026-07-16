// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Minimal token server for Speech Service keyless auth.
 * Uses DefaultAzureCredential (az login in dev, managed identity in ACA)
 * to acquire a short-lived Speech STS token and returns it to the browser client.
 *
 * Runs on 127.0.0.1:3001 (not exposed externally — nginx proxies /api/).
 */

const express = require('express');
const { DefaultAzureCredential } = require('@azure/identity');
const { CosmosClient } = require('@azure/cosmos');
const crypto = require('crypto');

const app = express();
// The Azure OpenAI proxy forwards vision requests that embed base64 images, so
// it needs a larger body limit. This route-scoped parser runs before the small
// global parser below; the global parser then skips bodies already parsed here.
app.use('/api/openai', express.json({ limit: '12mb' }));
app.use(express.json({ limit: '16kb' }));
const credential = new DefaultAzureCredential();

const REGION = process.env.AZURE_SPEECH_REGION;
const RESOURCE_NAME = process.env.AZURE_SPEECH_RESOURCE_NAME;
const RESOURCE_ID = process.env.AZURE_SPEECH_RESOURCE_ID;

// ── Azure OpenAI proxy ─────────────────────────────────────────────────────
// Keeps Azure OpenAI credentials server-side so they are never shipped to the
// browser. Prefers keyless auth via DefaultAzureCredential (managed identity in
// ACA, `az login` in dev); falls back to AZURE_OPENAI_API_KEY when set.
const OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY; // optional fallback
const OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-05-01-preview';

// Deployment names are user-selected on the client; constrain them so they
// cannot be used to inject a different upstream path (SSRF / path traversal).
const DEPLOYMENT_NAME_RE = /^[A-Za-z0-9._-]{1,64}$/;

function buildOpenAIUrl(deployment, apiFormat) {
  const base = OPENAI_ENDPOINT.endsWith('/') ? OPENAI_ENDPOINT : `${OPENAI_ENDPOINT}/`;
  if (apiFormat === 'chat-completions') {
    return `${base}openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${OPENAI_API_VERSION}`;
  }
  return `${base}openai/v1/responses`;
}

if (!OPENAI_ENDPOINT) {
  console.warn('[openai-proxy] AZURE_OPENAI_ENDPOINT is not set. /api/openai will return 503.');
}

// ── Cosmos DB (feedback storage) ───────────────────────────────────────────
const COSMOS_ENDPOINT = process.env.AZURE_COSMOS_ENDPOINT;
const COSMOS_DATABASE_ID = process.env.COSMOS_DATABASE_ID || 'diagrams';
const COSMOS_FEEDBACK_CONTAINER_ID = process.env.COSMOS_FEEDBACK_CONTAINER_ID || 'feedback';

// Lazily created singleton — reuse one CosmosClient for the process lifetime
// (Cosmos best practice; avoids per-request connection/auth overhead).
let feedbackContainer = null;
function getFeedbackContainer() {
  if (!COSMOS_ENDPOINT) return null;
  if (!feedbackContainer) {
    const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, aadCredentials: credential });
    feedbackContainer = client
      .database(COSMOS_DATABASE_ID)
      .container(COSMOS_FEEDBACK_CONTAINER_ID);
  }
  return feedbackContainer;
}

if (!REGION) {
  console.warn('[speech-token] AZURE_SPEECH_REGION is not set. Requests will fail.');
}
if (!RESOURCE_ID) {
  console.warn('[speech-token] AZURE_SPEECH_RESOURCE_ID is not set. Requests will fail.');
}

app.get('/api/speech-token', async (_req, res) => {
  if (!REGION || !RESOURCE_ID) {
    return res.status(503).json({ error: 'AZURE_SPEECH_REGION and AZURE_SPEECH_RESOURCE_ID must be configured' });
  }
  try {
    const { token: aadToken } = await credential.getToken(
      'https://cognitiveservices.azure.com/.default',
    );
    // JS Speech SDK requires the aad#{resourceId}#{aadToken} format for Entra ID auth
    res.json({ token: `aad#${RESOURCE_ID}#${aadToken}`, region: REGION });
  } catch (err) {
    console.error('[speech-token] error:', err.message);
    res.status(500).json({ error: 'Failed to acquire speech token' });
  }
});

app.post('/api/openai', async (req, res) => {
  if (!OPENAI_ENDPOINT) {
    return res.status(503).json({ error: 'AZURE_OPENAI_ENDPOINT is not configured on the server' });
  }

  const { apiFormat, deployment, body } = req.body || {};
  if (apiFormat !== 'responses' && apiFormat !== 'chat-completions') {
    return res.status(400).json({ error: "apiFormat must be 'responses' or 'chat-completions'" });
  }
  if (typeof deployment !== 'string' || !DEPLOYMENT_NAME_RE.test(deployment)) {
    return res.status(400).json({ error: 'invalid deployment name' });
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'missing request body' });
  }

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (OPENAI_API_KEY) {
      headers['api-key'] = OPENAI_API_KEY;
    } else {
      // Keyless: data-plane scope for Azure OpenAI / Cognitive Services.
      const { token } = await credential.getToken('https://cognitiveservices.azure.com/.default');
      headers['Authorization'] = `Bearer ${token}`;
    }

    const upstream = await fetch(buildOpenAIUrl(deployment, apiFormat), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.set('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (err) {
    console.error('[openai-proxy] error:', err.message);
    res.status(502).json({ error: 'Azure OpenAI proxy request failed' });
  }
});

// ── Microsoft Learn docs grounding ─────────────────────────────────────────
// Server-side search of official Microsoft Learn docs via the public Learn MCP
// endpoint. Used to ground deployment-guide generation in current, citable
// documentation. Best-effort: failures return empty results so generation can
// proceed ungrounded.
const LEARN_MCP_URL = process.env.LEARN_MCP_URL || 'https://learn.microsoft.com/api/mcp';

async function searchLearnDocs(query, top) {
  const upstream = await fetch(LEARN_MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'microsoft_docs_search', arguments: { query } },
    }),
  });

  if (!upstream.ok) {
    throw new Error(`Learn MCP returned ${upstream.status}`);
  }

  // The endpoint replies with Server-Sent Events; find the data: line that
  // carries the tool result and unwrap result.content[].text (a JSON string).
  const body = await upstream.text();
  let payload = null;
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const json = trimmed.slice(5).trim();
    if (!json || json === '[DONE]') continue;
    try {
      const obj = JSON.parse(json);
      if (obj.result && Array.isArray(obj.result.content)) {
        payload = obj;
        break;
      }
    } catch {
      /* ignore non-JSON / partial frames */
    }
  }
  if (!payload) return [];

  const textNode = payload.result.content.find((c) => c.type === 'text');
  if (!textNode) return [];

  const inner = JSON.parse(textNode.text);
  const results = Array.isArray(inner.results) ? inner.results : [];
  return results.slice(0, top).map((r) => ({
    title: String(r.title || '').slice(0, 200),
    url: String(r.contentUrl || ''),
    excerpt: typeof r.content === 'string' ? r.content.slice(0, 600) : '',
  }));
}

app.post('/api/docs-search', async (req, res) => {
  const { query, top } = req.body || {};
  if (typeof query !== 'string' || query.trim().length === 0) {
    return res.status(400).json({ error: 'query is required' });
  }
  const limit = Math.min(Math.max(Number(top) || 6, 1), 10);
  try {
    const results = await searchLearnDocs(query.trim().slice(0, 400), limit);
    res.json({ results });
  } catch (err) {
    console.error('[docs-search] error:', err.message);
    // Soft-fail: grounding is best-effort.
    res.json({ results: [], error: 'docs search failed' });
  }
});

app.get('/api/ice-token', async (_req, res) => {
  if (!REGION || !RESOURCE_ID) {
    return res.status(503).json({ error: 'AZURE_SPEECH_REGION and AZURE_SPEECH_RESOURCE_ID must be configured' });
  }
  try {
    const { token: aadToken } = await credential.getToken(
      'https://cognitiveservices.azure.com/.default',
    );
    // ICE relay endpoint also requires aad#resourceId#token format
    const authToken = `aad#${RESOURCE_ID}#${aadToken}`;
    const iceUrl = `https://${REGION}.tts.speech.microsoft.com/cognitiveservices/avatar/relay/token/v1`;
    const iceRes = await fetch(iceUrl, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!iceRes.ok) {
      const body = await iceRes.text().catch(() => '');
      console.error(`[ice-token] error ${iceRes.status}: ${body}`);
      return res.status(502).json({ error: `ICE relay returned ${iceRes.status}` });
    }
    const data = await iceRes.json();
    res.json(data);
  } catch (err) {
    console.error('[ice-token] error:', err.message);
    res.status(500).json({ error: 'Failed to acquire ICE token' });
  }
});

// ── Feedback (Cosmos DB) ──────────────────────────────────────────────────────
// ── Azure resource import (Resource Graph) ────────────────────────────────
// Lets an operator reverse-engineer a live Resource Group into a diagram by
// querying Azure Resource Graph server-side (via DefaultAzureCredential) and
// letting the client map the result deterministically. Resource Graph is
// Reader-sufficient and returns only real top-level resources.
//
// SECURITY: these routes let the *server identity* enumerate and export
// resources, so they are DISABLED by default and only enabled when
// AZURE_IMPORT_ENABLED=true. Leave unset on any shared/public deployment —
// the app's managed identity must never be exposed through /api/. Intended for
// local dev (`az login`) and single-tenant self-host.
const AZURE_IMPORT_ENABLED = String(process.env.AZURE_IMPORT_ENABLED || '').toLowerCase() === 'true';
const ARM_BASE = 'https://management.azure.com';
const GUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
// Azure RG names: letters, digits, '.', '_', '-', '(', ')'; 1-90 chars; no trailing period.
const RG_NAME_RE = /^[A-Za-z0-9._()-]{1,90}$/;

async function armToken() {
  const { token } = await credential.getToken('https://management.azure.com/.default');
  return token;
}

// Guard applied to every /api/azure/* route.
function requireAzureImport(_req, res, next) {
  if (!AZURE_IMPORT_ENABLED) {
    return res.status(503).json({ error: 'Azure import is disabled. Set AZURE_IMPORT_ENABLED=true to enable (local / self-host only).' });
  }
  next();
}

app.get('/api/azure/subscriptions', requireAzureImport, async (_req, res) => {
  try {
    const token = await armToken();
    const r = await fetch(`${ARM_BASE}/subscriptions?api-version=2022-12-01`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      console.error(`[azure-import] subscriptions ${r.status}: ${body.slice(0, 300)}`);
      return res.status(502).json({ error: `Failed to list subscriptions (${r.status})` });
    }
    const data = await r.json();
    const subs = (data.value || []).map((s) => ({ subscriptionId: s.subscriptionId, displayName: s.displayName }));
    res.json({ subscriptions: subs });
  } catch (err) {
    console.error('[azure-import] subscriptions error:', err.message);
    res.status(500).json({ error: 'Failed to list subscriptions' });
  }
});

app.get('/api/azure/resource-groups', requireAzureImport, async (req, res) => {
  const subscriptionId = String(req.query.subscriptionId || '');
  if (!GUID_RE.test(subscriptionId)) {
    return res.status(400).json({ error: 'invalid subscriptionId' });
  }
  try {
    const token = await armToken();
    const r = await fetch(`${ARM_BASE}/subscriptions/${subscriptionId}/resourcegroups?api-version=2021-04-01`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      console.error(`[azure-import] resource-groups ${r.status}: ${body.slice(0, 300)}`);
      return res.status(502).json({ error: `Failed to list resource groups (${r.status})` });
    }
    const data = await r.json();
    const groups = (data.value || []).map((g) => ({ name: g.name, location: g.location })).sort((a, b) => a.name.localeCompare(b.name));
    res.json({ resourceGroups: groups });
  } catch (err) {
    console.error('[azure-import] resource-groups error:', err.message);
    res.status(500).json({ error: 'Failed to list resource groups' });
  }
});

app.post('/api/azure/resource-graph', requireAzureImport, async (req, res) => {
  const { subscriptionId, resourceGroup } = req.body || {};
  if (!GUID_RE.test(String(subscriptionId || ''))) {
    return res.status(400).json({ error: 'invalid subscriptionId' });
  }
  if (!RG_NAME_RE.test(String(resourceGroup || '')) || String(resourceGroup).endsWith('.')) {
    return res.status(400).json({ error: 'invalid resourceGroup' });
  }
  try {
    const token = await armToken();
    // Reader-sufficient: returns top-level resources only (no ARM export noise).
    // resourceGroup is validated above; strip single quotes defensively so it
    // cannot break out of the KQL string literal.
    const rg = String(resourceGroup).replace(/'/g, '');
    const query = `Resources | where resourceGroup =~ '${rg}' | project id, name, type, kind, location, properties | limit 1000`;
    const r = await fetch(`${ARM_BASE}/providers/Microsoft.ResourceGraph/resources?api-version=2021-03-01`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriptions: [subscriptionId], query, options: { resultFormat: 'objectArray' } }),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      console.error(`[azure-import] resource-graph ${r.status}: ${body.slice(0, 300)}`);
      return res.status(502).json({ error: `Resource Graph query failed (${r.status})` });
    }
    const data = await r.json();
    res.json({ resources: Array.isArray(data.data) ? data.data : [] });
  } catch (err) {
    console.error('[azure-import] resource-graph error:', err.message);
    res.status(500).json({ error: 'Resource Graph query failed' });
  }
});

app.post('/api/feedback', async (req, res) => {
  const container = getFeedbackContainer();
  if (!container) {
    // Storage not configured — the client still captured sentiment in
    // Application Insights, so this is a soft failure by design.
    return res.status(503).json({ error: 'Feedback storage is not configured' });
  }

  const body = req.body || {};
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'rating must be an integer between 1 and 5' });
  }

  const category = typeof body.category === 'string' ? body.category.slice(0, 100) : 'General';
  const comment = typeof body.comment === 'string' ? body.comment.slice(0, 1000) : '';
  const ctx = body.context && typeof body.context === 'object' ? body.context : {};

  const item = {
    id: crypto.randomUUID(),
    type: 'feedback',
    rating,
    category,
    comment,
    context: {
      diagramName: typeof ctx.diagramName === 'string' ? ctx.diagramName.slice(0, 200) : '',
      serviceCount: Number.isFinite(Number(ctx.serviceCount)) ? Number(ctx.serviceCount) : 0,
      model: typeof ctx.model === 'string' ? ctx.model.slice(0, 100) : '',
      url: typeof ctx.url === 'string' ? ctx.url.slice(0, 500) : '',
      userAgent: typeof ctx.userAgent === 'string' ? ctx.userAgent.slice(0, 500) : '',
    },
    createdAt: new Date().toISOString(),
  };

  try {
    await container.items.create(item);
    res.status(201).json({ ok: true, id: item.id });
  } catch (err) {
    console.error('[feedback] error:', err.message);
    res.status(500).json({ error: 'Failed to store feedback' });
  }
});

// ── Admin: read persisted feedback (protected) ──────────────────────────────
// Lets an operator read verbatim comments from Cosmos server-side — the app
// reaches Cosmos via the private endpoint, so this works even though the
// account has public network access disabled. Protected by a shared admin
// token (FEEDBACK_ADMIN_TOKEN); the endpoint is disabled (503) when unset.
const FEEDBACK_ADMIN_TOKEN = process.env.FEEDBACK_ADMIN_TOKEN || '';

function adminTokenMatches(presented) {
  if (!presented || presented.length !== FEEDBACK_ADMIN_TOKEN.length) return false;
  return crypto.timingSafeEqual(Buffer.from(presented), Buffer.from(FEEDBACK_ADMIN_TOKEN));
}

app.get('/api/feedback/list', async (req, res) => {
  if (!FEEDBACK_ADMIN_TOKEN) {
    return res.status(503).json({ error: 'Feedback admin endpoint is not configured' });
  }
  const auth = req.get('authorization') || '';
  const presented = auth.startsWith('Bearer ') ? auth.slice(7) : (req.get('x-admin-token') || '');
  if (!adminTokenMatches(presented)) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const container = getFeedbackContainer();
  if (!container) {
    return res.status(503).json({ error: 'Feedback storage is not configured' });
  }

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 1000);
  try {
    const { resources } = await container.items
      .query('SELECT c.id, c.rating, c.category, c.comment, c.context, c.createdAt FROM c ORDER BY c.createdAt DESC')
      .fetchAll();
    res.json({ count: Math.min(resources.length, limit), items: resources.slice(0, limit) });
  } catch (err) {
    console.error('[feedback/list] error:', err.message);
    res.status(500).json({ error: 'Failed to read feedback' });
  }
});

const PORT = parseInt(process.env.TOKEN_SERVER_PORT || '3001', 10);
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[speech-token] Listening on 127.0.0.1:${PORT}`);
});
