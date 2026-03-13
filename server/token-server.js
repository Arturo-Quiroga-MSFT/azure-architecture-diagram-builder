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

const app = express();
const credential = new DefaultAzureCredential();

const REGION = process.env.AZURE_SPEECH_REGION;
const RESOURCE_NAME = process.env.AZURE_SPEECH_RESOURCE_NAME;
const RESOURCE_ID = process.env.AZURE_SPEECH_RESOURCE_ID;

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

const PORT = parseInt(process.env.TOKEN_SERVER_PORT || '3001', 10);
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[speech-token] Listening on 127.0.0.1:${PORT}`);
});
