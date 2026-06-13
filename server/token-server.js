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
app.use(express.json({ limit: '16kb' }));
const credential = new DefaultAzureCredential();

const REGION = process.env.AZURE_SPEECH_REGION;
const RESOURCE_NAME = process.env.AZURE_SPEECH_RESOURCE_NAME;
const RESOURCE_ID = process.env.AZURE_SPEECH_RESOURCE_ID;

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

const PORT = parseInt(process.env.TOKEN_SERVER_PORT || '3001', 10);
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[speech-token] Listening on 127.0.0.1:${PORT}`);
});
