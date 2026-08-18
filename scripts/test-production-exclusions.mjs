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

console.log('Production Adoption & Impact exclusion contract passed.');