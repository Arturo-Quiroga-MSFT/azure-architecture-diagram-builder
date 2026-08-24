import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
assert.ok(fs.existsSync(dist), 'dist/ is missing; run npm run build first');

function filesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(target) : [target];
  });
}

const client = filesUnder(dist)
  .filter(file => /\.(?:html|js|css|json)$/.test(file))
  .map(file => fs.readFileSync(file, 'utf8'))
  .join('\n');

for (const marker of [
  'Adoption & Impact',
  '/api/impact-story',
  '/api/deployment-registration',
  'aadb.impact.profile.v1',
  'Adoption_Profile_Saved',
  'Impact_Story_Submitted',
  'Deployment_Registered',
]) {
  assert.ok(!client.includes(marker), `production client includes excluded marker: ${marker}`);
}

const dockerfile = fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8');
assert.match(dockerfile, /ARG ENABLE_ADOPTION_IMPACT=false/);
assert.match(dockerfile, /rm -f impact-routes\.js impact-records\.js/);

const deployScript = fs.readFileSync(
  path.join(root, 'scripts/vnet-migration/03-deploy-webapp.sh'),
  'utf8',
);
assert.match(deployScript, /VITE_ENABLE_ADOPTION_IMPACT=false/);
assert.match(deployScript, /ENABLE_ADOPTION_IMPACT=false/);
assert.match(deployScript, /server-appinsights-connection-string/);
assert.match(deployScript, /telemetry-hash-secret/);
assert.match(deployScript, /--logs-destination log-analytics/);

const revisionRenderer = fs.readFileSync(
  path.join(root, 'scripts/vnet-migration/render-webapp-revision.mjs'),
  'utf8',
);
assert.match(revisionRenderer, /setSecretRef\('APPLICATIONINSIGHTS_CONNECTION_STRING', 'server-appinsights-connection-string'\)/);
assert.match(revisionRenderer, /setSecretRef\('TELEMETRY_HASH_SECRET', 'telemetry-hash-secret'\)/);
assert.match(revisionRenderer, /setValue\('OTEL_SERVICE_NAME', 'aadb-token-server'\)/);

const bicep = fs.readFileSync(path.join(root, 'infra/resources.bicep'), 'utf8');
assert.match(bicep, /APPLICATIONINSIGHTS_CONNECTION_STRING', secretRef: 'server-appinsights-connection-string'/);
assert.doesNotMatch(bicep, /APPLICATIONINSIGHTS_CONNECTION_STRING', value:/);

const instrumentation = fs.readFileSync(path.join(root, 'server/instrumentation.js'), 'utf8');
assert.match(instrumentation, /disableIncomingRequestInstrumentation: true/);
assert.match(instrumentation, /console: \{ enabled: false \}/);

const nginx = fs.readFileSync(path.join(root, 'nginx.conf'), 'utf8');
const privacyLogFormat = nginx.match(/log_format privacy_safe([\s\S]*?);/)?.[0] || '';
assert.ok(privacyLogFormat, 'privacy-safe nginx log format is missing');
assert.doesNotMatch(privacyLogFormat, /remote_addr|http_user_agent|http_referer|request_uri|args/);
assert.match(privacyLogFormat, /request_method/);
assert.match(privacyLogFormat, /\$uri/);
assert.match(nginx, /access_log \/var\/log\/nginx\/access\.log privacy_safe/);
assert.match(nginx, /error_log \/dev\/stderr crit/);

console.log('Production exclusion and telemetry secret contracts passed.');