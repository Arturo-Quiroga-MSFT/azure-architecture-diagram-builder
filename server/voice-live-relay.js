// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// Voice Live relay (off by default). The browser opens a WebSocket to
// /api/voice-live; this server opens the upstream Voice Live session with its
// managed identity, so no Entra token or key ever reaches the browser.
//
// The server owns the session configuration (model, voice, instructions, tools,
// turn detection). The browser may only stream microphone audio, cancel a reply,
// and return the result of a tool call the model actually made to a browser-side
// tool. Everything else is dropped. Sessions are capped in count and length.
//
// Tools (draw_architecture, describe_canvas) run in the browser, which owns the
// canvas; the relay only accepts their results for call ids it has seen, once each.

const { WebSocketServer, WebSocket } = require('ws');

const ENABLED = String(process.env.ENABLE_VOICE_LIVE || '').toLowerCase() === 'true';
const API_VERSION = process.env.VOICE_LIVE_API_VERSION || '2026-04-10';
const MODEL = process.env.VOICE_LIVE_MODEL || 'gpt-realtime-2.1';
const VOICE = process.env.VOICE_LIVE_VOICE || 'en-US-Ava:DragonHDLatestNeural';
const MAX_SESSIONS = parseInt(process.env.VOICE_LIVE_MAX_SESSIONS || '5', 10);
const MAX_SESSION_MS = parseInt(process.env.VOICE_LIVE_MAX_SESSION_SECONDS || '600', 10) * 1000;
const MAX_CLIENT_FRAME_BYTES = 256 * 1024;
const MAX_TOOL_OUTPUT_CHARS = 8000;
const PATH = '/api/voice-live';

const ALLOWED_CLIENT_EVENTS = new Set([
  'input_audio_buffer.append',
  'input_audio_buffer.clear',
  'response.cancel',
]);

const CLIENT_TOOLS = new Set(['draw_architecture', 'describe_canvas']);

const INSTRUCTIONS = [
  'You are Ava, the voice assistant of the Azure Architecture Diagram Builder, speaking with a',
  'Microsoft seller or solution architect. This is a spoken conversation: keep every reply under',
  'three short sentences and never read IDs, JSON or long lists aloud.',
  'For a new design, ask one clarifying question at a time (workload, scale, regions, compliance,',
  'data, integration); once the user agrees, call draw_architecture with a complete written request.',
  'When the user asks to change the diagram (add, remove or replace services), call draw_architecture',
  'with just the requested change. Use describe_canvas when you need to know what is already drawn.',
  'Drawing takes about 20 to 40 seconds: right before calling a drawing tool, say you are drawing it now.',
  'After a drawing tool returns, summarize what was drawn in one or two sentences. If it reports',
  'awaiting_user_review, tell the user to choose an option in the review dialog on screen.',
].join(' ');

const TOOLS = [{
  type: 'function',
  name: 'draw_architecture',
  description: 'Create a new diagram from a written architecture request, or apply a change to the existing diagram.',
  parameters: {
    type: 'object',
    properties: {
      request: { type: 'string', description: 'For a new design: the scenario and the agreed Azure services and requirements. For a change: only the requested change.' },
      title: { type: 'string', description: 'Short title for a new design, named after the customer scenario.' },
    },
    required: ['request'],
  },
}, {
  type: 'function',
  name: 'describe_canvas',
  description: 'List the services, groups and title currently on the canvas.',
  parameters: { type: 'object', properties: {} },
}];

function sessionUpdate() {
  return {
    type: 'session.update',
    session: {
      modalities: ['text', 'audio'],
      instructions: INSTRUCTIONS,
      tools: TOOLS,
      tool_choice: 'auto',
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

// ── Relay ────────────────────────────────────────────────────────────────────
function upstreamUrl(endpoint) {
  const base = new URL(endpoint);
  base.protocol = 'wss:';
  base.pathname = '/voice-live/realtime';
  base.search = '';
  base.searchParams.set('api-version', API_VERSION);
  base.searchParams.set('model', MODEL);
  return base.toString();
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
    let responseActive = false;
    let responseQueued = false;
    const pendingClientCalls = new Map(); // call_id -> tool name
    let toolCalls = 0;

    const close = (code = 1000, reason = '') => {
      if (closed) return;
      closed = true;
      active -= 1;
      clearTimeout(limitTimer);
      try { client.close(code, reason.slice(0, 120)); } catch { /* already closed */ }
      try { upstream?.close(); } catch { /* already closed */ }
      log.log(`[voice-live] session closed after ${Math.round((Date.now() - startedAt) / 1000)}s, ${toolCalls} tool calls (${reason || code})`);
    };
    const limitTimer = setTimeout(() => close(4000, 'Session time limit reached'), MAX_SESSION_MS);

    const sendUp = (event) => {
      if (upstream?.readyState === WebSocket.OPEN) upstream.send(JSON.stringify(event));
    };
    // Hand a tool result back and ask for the spoken follow-up, waiting if a
    // response is still in flight (the API allows one active response).
    const returnToolOutput = (callId, output) => {
      sendUp({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output } });
      if (responseActive) responseQueued = true;
      else sendUp({ type: 'response.create' });
    };

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
      if (!isBinary) {
        let ev = null;
        try { ev = JSON.parse(data.toString()); } catch { /* pass through */ }
        if (ev?.type === 'response.created') responseActive = true;
        if (ev?.type === 'response.done') {
          responseActive = false;
          if (responseQueued) {
            responseQueued = false;
            sendUp({ type: 'response.create' });
          }
        }
        if (ev?.type === 'response.function_call_arguments.done' && ev.call_id) {
          toolCalls += 1;
          if (CLIENT_TOOLS.has(ev.name)) {
            pendingClientCalls.set(ev.call_id, ev.name);
          } else {
            returnToolOutput(ev.call_id, JSON.stringify({ error: `Unknown tool ${ev.name}` }));
          }
        }
      }
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
      if (!event) return;
      if (event.type === 'tool.result') {
        // Only for a browser-side call the model actually made, and only once.
        const callId = String(event.call_id || '');
        if (!pendingClientCalls.has(callId) || typeof event.output !== 'string') return;
        pendingClientCalls.delete(callId);
        returnToolOutput(callId, event.output.slice(0, MAX_TOOL_OUTPUT_CHARS));
        return;
      }
      if (!ALLOWED_CLIENT_EVENTS.has(event.type)) return;
      sendUp(event);
    });
  });

  log.log(`[voice-live] relay enabled at ${PATH} (model ${MODEL}, max ${MAX_SESSIONS} sessions, ${MAX_SESSION_MS / 1000}s each)`);
  return { enabled: true };
}

module.exports = { attachVoiceLiveRelay, PATH };
