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

if (!REGION) {
  console.warn('[speech-token] AZURE_SPEECH_REGION is not set. Requests will fail.');
}

app.get('/api/speech-token', async (_req, res) => {
  if (!REGION) {
    return res.status(503).json({ error: 'AZURE_SPEECH_REGION not configured' });
  }
  try {
    const { token: aadToken } = await credential.getToken(
      'https://cognitiveservices.azure.com/.default',
    );

    // Exchange the AAD bearer token for a short-lived Speech STS token.
    // This avoids ever sending the AAD token to the browser.
    const stsUrl = `https://${REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
    const stsRes = await fetch(stsUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${aadToken}`,
        'Content-Length': '0',
      },
    });

    if (!stsRes.ok) {
      const body = await stsRes.text().catch(() => '');
      console.error(`[speech-token] STS error ${stsRes.status}: ${body}`);
      return res.status(502).json({ error: `Speech STS returned ${stsRes.status}` });
    }

    const speechToken = await stsRes.text();
    res.json({ token: speechToken, region: REGION });
  } catch (err) {
    console.error('[speech-token] error:', err.message);
    res.status(500).json({ error: 'Failed to acquire speech token' });
  }
});

const PORT = parseInt(process.env.TOKEN_SERVER_PORT || '3001', 10);
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[speech-token] Listening on 127.0.0.1:${PORT}`);
});
