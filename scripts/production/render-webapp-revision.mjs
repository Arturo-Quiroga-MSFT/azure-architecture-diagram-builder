#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const [image, revisionSuffix, appVersion, publicUrl] = process.argv.slice(2);

if (!image || !revisionSuffix || !appVersion || !publicUrl) {
  console.error('Usage: render-webapp-revision.mjs <image> <revision-suffix> <app-version> <public-url>');
  process.exit(1);
}

if (!/^v[0-9]+-[0-9]+-[0-9]+-[a-f0-9]{7,12}$/.test(revisionSuffix)) {
  throw new Error(`Invalid revision suffix: ${revisionSuffix}`);
}

const template = JSON.parse(readFileSync(0, 'utf8'));
const container = template.containers?.[0];

if (!container) throw new Error('Current Container App template has no primary container.');

const setValue = (name, value) => {
  const existing = container.env.find((entry) => entry.name === name);
  if (existing) {
    delete existing.secretRef;
    existing.value = value;
  } else {
    container.env.push({ name, value });
  }
};

const setSecretRef = (name, secretRef) => {
  const existing = container.env.find((entry) => entry.name === name);
  if (existing) {
    delete existing.value;
    existing.secretRef = secretRef;
  } else {
    container.env.push({ name, secretRef });
  }
};

container.env ??= [];
container.image = image;
container.probes = [
  {
    type: 'Startup',
    httpGet: { path: '/api/ready', port: 80, scheme: 'HTTP' },
    initialDelaySeconds: 0,
    periodSeconds: 1,
    timeoutSeconds: 1,
    failureThreshold: 48,
    successThreshold: 1,
  },
  {
    type: 'Readiness',
    httpGet: { path: '/api/ready', port: 80, scheme: 'HTTP' },
    initialDelaySeconds: 5,
    periodSeconds: 1,
    timeoutSeconds: 1,
    failureThreshold: 48,
    successThreshold: 1,
  },
  {
    type: 'Liveness',
    httpGet: { path: '/api/health', port: 80, scheme: 'HTTP' },
    initialDelaySeconds: 10,
    periodSeconds: 10,
    timeoutSeconds: 5,
    failureThreshold: 3,
    successThreshold: 1,
  },
];

setSecretRef('AZURE_OPENAI_API_KEY', 'azure-openai-api-key');
setSecretRef('APPLICATIONINSIGHTS_CONNECTION_STRING', 'server-appinsights-connection-string');
setSecretRef('TELEMETRY_HASH_SECRET', 'telemetry-hash-secret');
setValue('APP_VERSION', appVersion);
setValue('PUBLIC_URL', publicUrl);
setValue('ENABLE_ADOPTION_IMPACT', 'false');
setValue('NODE_ENV', 'production');
setValue('OTEL_SERVICE_NAME', 'aadb-token-server');

template.revisionSuffix = revisionSuffix;

const plaintextSecrets = container.env.filter(
  ({ name, value }) => value != null && /(API_KEY|PASSWORD|TOKEN|CONNECTION_STRING)$/.test(name),
);
if (plaintextSecrets.length > 0) {
  throw new Error(`Refusing to emit plaintext secret environment values: ${plaintextSecrets.map(({ name }) => name).join(', ')}`);
}

process.stdout.write(`${JSON.stringify({ properties: { template } }, null, 2)}\n`);