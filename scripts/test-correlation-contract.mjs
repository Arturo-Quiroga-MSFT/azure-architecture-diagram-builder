import { spawn } from 'node:child_process';
import { createServer } from 'node:http';

const port = 3199;
const upstreamPort = 3200;
const expectedId = 'correlation-contract-001';
const bodyMarker = 'correlation-body-must-not-be-logged';
const userAgentMarker = 'raw-user-agent-must-not-be-logged';
const logs = [];
let serverExit = null;

const upstream = createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    const parsed = JSON.parse(body || '{}');
    const respond = () => {
      if (parsed.model === 'rate-limit-model') {
        res.writeHead(429, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'rate limited' } }));
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        model: parsed.model,
        output_text: '{"ok":true}',
        usage: {
          input_tokens: 120,
          output_tokens: 30,
          total_tokens: 150,
          input_tokens_details: { cached_tokens: 20 },
        },
      }));
    };
    if (parsed.model === 'slow-model') setTimeout(respond, 60);
    else respond();
  });
});
await new Promise((resolve) => upstream.listen(upstreamPort, '127.0.0.1', resolve));

const server = spawn(process.execPath, ['server/token-server.js'], {
  env: {
    ...process.env,
    TOKEN_SERVER_PORT: String(port),
    APP_VERSION: 'test',
    AZURE_OPENAI_ENDPOINT: `http://127.0.0.1:${upstreamPort}/`,
    AZURE_OPENAI_API_KEY: 'test-only-key',
    TELEMETRY_HASH_SECRET: 'test-only-hmac-secret',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

server.stdout.setEncoding('utf8');
server.stdout.on('data', (chunk) => logs.push(...chunk.split('\n').filter(Boolean)));
server.stderr.setEncoding('utf8');
server.stderr.on('data', (chunk) => logs.push(...chunk.split('\n').filter(Boolean)));
server.on('exit', (code, signal) => { serverExit = { code, signal }; });

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const parseEvents = () => logs.map((line) => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);

async function callProxy(model, correlationId = crypto.randomUUID()) {
  return fetch(`http://127.0.0.1:${port}/api/openai`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-correlation-id': correlationId,
      'user-agent': userAgentMarker,
    },
    body: JSON.stringify({
      apiFormat: 'responses',
      deployment: model,
      model: model === 'rate-limit-model' ? 'Rate Limit Model' : 'GPT-5.6 Luna',
      operation: 'architecture_generation',
      body: { model, input: bodyMarker },
    }),
  });
}

try {
  let serverReady = false;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (serverExit) {
      throw new Error(`Token server exited before readiness: ${JSON.stringify(serverExit)}\n${logs.join('\n')}`);
    }
    try {
      const ready = await fetch(`http://127.0.0.1:${port}/api/ready`);
      if (ready.ok) {
        serverReady = true;
        break;
      }
    } catch { /* server is still starting */ }
    await wait(50);
  }
  if (!serverReady) {
    throw new Error(`Token server was not ready within 10 seconds.\n${logs.join('\n')}`);
  }

  const response = await callProxy('success-model', expectedId);
  if (!response.ok) throw new Error(`Expected successful proxy response, got ${response.status}.`);
  if (response.headers.get('x-correlation-id') !== expectedId) {
    throw new Error('Response correlation ID did not match request ID.');
  }

  const concurrentResponses = await Promise.all([callProxy('slow-model'), callProxy('slow-model')]);
  if (concurrentResponses.some((item) => !item.ok)) throw new Error('Concurrent proxy requests failed.');

  const limited = await callProxy('rate-limit-model');
  if (limited.status !== 429) throw new Error(`Expected 429 classification, got ${limited.status}.`);

  const legacy = await fetch(`http://127.0.0.1:${port}/api/openai`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      apiFormat: 'responses',
      deployment: 'legacy-model',
      body: { model: 'legacy-model', input: 'legacy request' },
    }),
  });
  if (!legacy.ok) throw new Error(`Legacy proxy contract failed with ${legacy.status}.`);

  const replacementResponse = await fetch(`http://127.0.0.1:${port}/api/correlation-test`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-correlation-id': 'invalid correlation id',
    },
    body: JSON.stringify({ prompt: bodyMarker }),
  });
  const replacementId = replacementResponse.headers.get('x-correlation-id');
  if (!replacementId || replacementId === 'invalid correlation id' || !/^[A-Za-z0-9._-]{1,128}$/.test(replacementId)) {
    throw new Error('Malformed correlation ID was not replaced with a valid value.');
  }

  await wait(50);
  const events = parseEvents();
  const success = events.find((entry) => entry.event === 'openai_request_completed' && entry.correlationId === expectedId);
  if (!success || success.status !== 200 || success.model !== 'GPT-5.6 Luna'
    || success.operation !== 'architecture_generation' || success.totalTokens !== 150
    || success.promptTokens !== 120 || success.completionTokens !== 30 || success.cachedTokens !== 20
    || !/^[a-f0-9]{24}$/.test(success.clientKey)) {
    throw new Error(`Authoritative success event missing or invalid: ${JSON.stringify(success)}`);
  }

  const concurrentEvents = events.filter((entry) => entry.event === 'openai_request_completed' && entry.deployment === 'slow-model');
  if (Math.max(...concurrentEvents.map((entry) => entry.concurrentAtStart || 0)) < 2
    || Math.max(...concurrentEvents.map((entry) => entry.peakConcurrent || 0)) < 2) {
    throw new Error(`Concurrency fields did not observe overlapping requests: ${JSON.stringify(concurrentEvents)}`);
  }

  const failure = events.find((entry) => entry.event === 'openai_request_completed' && entry.status === 429);
  if (!failure || failure.success !== false || failure.errorType !== 'rate_limited' || failure.totalTokens !== 0) {
    throw new Error(`Rate-limit event missing or invalid: ${JSON.stringify(failure)}`);
  }

  const legacyEvent = events.find((entry) => entry.event === 'openai_request_completed' && entry.deployment === 'legacy-model');
  if (!legacyEvent || legacyEvent.model !== 'legacy-model' || legacyEvent.operation !== 'unspecified') {
    throw new Error(`Legacy telemetry defaults missing or invalid: ${JSON.stringify(legacyEvent)}`);
  }

  if (events.some((entry) => entry.event === 'http_request' && ['/api/health', '/api/ready'].includes(entry.path))) {
    throw new Error('Probe completion logs were not suppressed.');
  }
  if (logs.join('\n').includes(bodyMarker) || logs.join('\n').includes(userAgentMarker)) {
    throw new Error('Structured logs exposed request body or raw client data.');
  }

  console.log('Authoritative server telemetry contract passed.');
} finally {
  server.kill('SIGTERM');
  upstream.close();
}