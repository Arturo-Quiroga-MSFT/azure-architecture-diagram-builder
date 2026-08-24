import { spawn } from 'node:child_process';

const port = 3199;
const expectedId = 'correlation-contract-001';
const bodyMarker = 'correlation-body-must-not-be-logged';
const logs = [];
const server = spawn(process.execPath, ['server/token-server.js'], {
  env: {
    ...process.env,
    TOKEN_SERVER_PORT: String(port),
    APP_VERSION: 'test',
    AZURE_OPENAI_ENDPOINT: 'https://example.openai.azure.com/',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

server.stdout.setEncoding('utf8');
server.stdout.on('data', (chunk) => logs.push(...chunk.split('\n').filter(Boolean)));
server.stderr.setEncoding('utf8');
server.stderr.on('data', (chunk) => logs.push(...chunk.split('\n').filter(Boolean)));

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

try {
  let response;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      response = await fetch(`http://127.0.0.1:${port}/api/ready`, {
        headers: { 'x-correlation-id': expectedId },
      });
      break;
    } catch {
      await wait(50);
    }
  }

  if (!response?.ok) throw new Error('Token server did not become ready.');
  if (response.headers.get('x-correlation-id') !== expectedId) {
    throw new Error('Response correlation ID did not match request ID.');
  }

  await wait(25);
  const event = logs
    .map((line) => { try { return JSON.parse(line); } catch { return null; } })
    .find((entry) => entry?.event === 'http_request' && entry.correlationId === expectedId);

  if (!event || event.path !== '/api/ready' || event.status !== 200 || event.level !== 'info') {
    throw new Error(`Structured correlation event missing or invalid: ${JSON.stringify(event)}`);
  }

  const replacementResponse = await fetch(`http://127.0.0.1:${port}/api/ready`, {
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

  await wait(25);
  if (logs.join('\n').includes(bodyMarker)) {
    throw new Error('Structured logs exposed request body content.');
  }

  console.log('Correlation contract passed.');
} finally {
  server.kill('SIGTERM');
}