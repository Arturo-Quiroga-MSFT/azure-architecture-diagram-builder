// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// Voice Live relay (beta, off by default). The browser opens a WebSocket to
// /api/voice-live; this server opens the upstream Voice Live session with its
// managed identity, so no Entra token or key ever reaches the browser.
//
// The server owns the session configuration (model, voice, instructions, turn
// detection). The browser may only stream microphone audio and cancel a reply;
// every other client event is dropped. Sessions are capped in count and length.

const { WebSocketServer, WebSocket } = require('ws');

const ENABLED = String(process.env.ENABLE_VOICE_LIVE || '').toLowerCase() === 'true';
const API_VERSION = process.env.VOICE_LIVE_API_VERSION || '2026-04-10';
const MODEL = process.env.VOICE_LIVE_MODEL || 'gpt-realtime-2.1';
const VOICE = process.env.VOICE_LIVE_VOICE || 'en-US-Ava:DragonHDLatestNeural';
const MAX_SESSIONS = parseInt(process.env.VOICE_LIVE_MAX_SESSIONS || '5', 10);
const MAX_SESSION_MS = parseInt(process.env.VOICE_LIVE_MAX_SESSION_SECONDS || '600', 10) * 1000;
const MAX_CLIENT_FRAME_BYTES = 256 * 1024;
const PATH = '/api/voice-live';

const ALLOWED_CLIENT_EVENTS = new Set([
  'input_audio_buffer.append',
  'input_audio_buffer.clear',
  'response.cancel',
]);

const INSTRUCTIONS = [
  'You are the voice assistant of the Azure Architecture Diagram Builder, speaking with a',
  'Microsoft seller or solution architect. Help them shape an Azure architecture for a',
  'customer: ask one clarifying question at a time (workload, scale, regions, compliance,',
  'data, integration), then summarize the proposed Azure services and why.',
  'Keep every reply under three short sentences; this is a spoken conversation.',
  'You cannot edit the diagram yourself. When the design is agreed, end with a one-sentence',
  'summary of the services and tell the user to press "Draw it" to put it on the canvas.',
].join(' ');

function upstreamUrl(endpoint) {
  const base = new URL(endpoint);
  base.protocol = 'wss:';
  base.pathname = '/voice-live/realtime';
  base.search = '';
  base.searchParams.set('api-version', API_VERSION);
  base.searchParams.set('model', MODEL);
  return base.toString();
}

function sessionUpdate() {
  return {
    type: 'session.update',
    session: {
      modalities: ['text', 'audio'],
      instructions: INSTRUCTIONS,
      voice: { name: VOICE, type: 'azure-standard', temperature: 0.8 },
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
      turn_detection: { type: 'azure_semantic_vad', silence_duration_ms: 500 },
      input_audio_noise_reduction: { type: 'azure_deep_noise_suppression' },
      input_audio_echo_cancellation: { type: 'server_echo_cancellation' },
      input_audio_transcription: { model: 'azure-speech' },
    },
  };
}

function attachVoiceLiveRelay(server, { credential, endpoint, log = console }) {
  if (!ENABLED) return { enabled: false };
  if (!endpoint) {
    log.warn('[voice-live] ENABLE_VOICE_LIVE is set but AZURE_OPENAI_ENDPOINT is missing; relay disabled.');
    return { enabled: false };
  }

  const target = upstreamUrl(endpoint);
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_CLIENT_FRAME_BYTES });
  let active = 0;

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname !== PATH) {
      socket.destroy();
      return;
    }
    if (active >= MAX_SESSIONS) {
      socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (client) => wss.emit('connection', client));
  });

  wss.on('connection', async (client) => {
    active += 1;
    const startedAt = Date.now();
    let upstream = null;
    let closed = false;

    const close = (code = 1000, reason = '') => {
      if (closed) return;
      closed = true;
      active -= 1;
      clearTimeout(limitTimer);
      try { client.close(code, reason.slice(0, 120)); } catch { /* already closed */ }
      try { upstream?.close(); } catch { /* already closed */ }
      log.log(`[voice-live] session closed after ${Math.round((Date.now() - startedAt) / 1000)}s (${reason || code})`);
    };
    const limitTimer = setTimeout(() => close(4000, 'Session time limit reached'), MAX_SESSION_MS);

    client.on('close', () => close(1000, 'client closed'));
    client.on('error', () => close(1011, 'client error'));

    try {
      const { token } = await credential.getToken('https://ai.azure.com/.default');
      if (closed) return;
      upstream = new WebSocket(target, { headers: { Authorization: `Bearer ${token}` } });
    } catch (err) {
      log.error('[voice-live] token acquisition failed:', err.message);
      close(1011, 'Voice service unavailable');
      return;
    }

    upstream.on('open', () => {
      upstream.send(JSON.stringify(sessionUpdate()));
      log.log(`[voice-live] session opened (model ${MODEL}, active ${active})`);
    });
    upstream.on('message', (data, isBinary) => {
      if (client.readyState === WebSocket.OPEN) client.send(data, { binary: isBinary });
    });
    upstream.on('unexpected-response', (_req, res) => {
      log.error(`[voice-live] upstream rejected the connection: HTTP ${res.statusCode}`);
      close(1011, 'Voice service rejected the session');
    });
    upstream.on('close', () => close(1000, 'upstream closed'));
    upstream.on('error', (err) => {
      log.error('[voice-live] upstream error:', err.message);
      close(1011, 'Voice service error');
    });

    client.on('message', (data, isBinary) => {
      if (isBinary || upstream?.readyState !== WebSocket.OPEN) return;
      let event;
      try { event = JSON.parse(data.toString()); } catch { return; }
      if (!event || !ALLOWED_CLIENT_EVENTS.has(event.type)) return;
      upstream.send(JSON.stringify(event));
    });
  });

  log.log(`[voice-live] relay enabled at ${PATH} (model ${MODEL}, max ${MAX_SESSIONS} sessions, ${MAX_SESSION_MS / 1000}s each)`);
  return { enabled: true };
}

module.exports = { attachVoiceLiveRelay, PATH };
