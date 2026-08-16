import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
  buildArchitectureGenerationSystemPrompt,
  TOPOLOGY_CONTRACT_VERSION,
} from '../../src/services/architectureGenerationContract';
import { postProcessArchitecture } from '../../src/services/architecturePostProcessing';

const prompt = buildArchitectureGenerationSystemPrompt();
const contractSha256 = createHash('sha256').update(prompt).digest('hex');
assert.equal(TOPOLOGY_CONTRACT_VERSION, 'v2');
assert.match(prompt, /KNOWN SERVICES/);
assert.match(prompt, /Microsoft Entra ID/);
assert.match(prompt, /Microsoft Fabric Capacity/);
assert.match(prompt, /SINGLE edge from Azure Monitor to Log Analytics/);
assert.match(prompt, /No floating services/);
assert.match(prompt, /Hub-and-spoke networks/);
// "Hub-and-spoke" must name the network topology rule only; the monitoring rule
// used the same phrase for an unrelated instruction.
assert.doesNotMatch(prompt, /Hub-and-spoke for monitoring/);
assert.doesNotMatch(prompt, /"position"\s*:/);
assert.equal(prompt.length, 8_586);
assert.equal(contractSha256, '08f3e89c054f27ca4a8dd644c8ce7c2115d59967d404a856ce6ad7f38ed53b39');

const warnings: string[] = [];
const processed = postProcessArchitecture({
  groups: [
    'app-tier',
    { id: 'storage', label: 'Data', groupId: 'should-be-removed' },
  ],
  services: [
    {
      id: 'app-tier',
      name: 'Function App',
      type: 'Function App',
      category: 'wrong',
      groupId: 'app-tier',
    },
    {
      id: 'storage',
      name: 'Blob Storage',
      type: 'Blob Storage',
      category: 'wrong',
      groupId: 'storage',
    },
    {
      id: 'orphan',
      name: 'Azure Key Vault',
      type: 'Azure Key Vault',
      category: 'wrong',
      groupId: 'missing-group',
    },
  ],
  connections: [
    { from: 'Azure Functions', to: 'Storage Account', label: 'Store payload', type: 'sync' },
    { from: 'missing', to: 'storage', label: 'Invalid', type: 'sync' },
    { from: 'storage', to: 'storage', label: 'Self', type: 'sync' },
  ],
  workflow: [],
}, {
  log: () => undefined,
  warn: (...args) => warnings.push(args.join(' ')),
});

assert.deepEqual(processed.groups, [
  { id: 'group-app-tier', label: 'App Tier' },
  { id: 'group-storage', label: 'Data' },
]);
assert.equal(processed.services[0].groupId, 'group-app-tier');
assert.equal(processed.services[1].groupId, 'group-storage');
assert.equal(processed.services[2].groupId, null);
assert.equal(processed.services[0].name, 'Azure Functions');
assert.notEqual(processed.services[0].category, 'wrong');
assert.equal(processed.connections.length, 1);
assert.equal(processed.connections[0].from, 'app-tier');
assert.equal(processed.connections[0].to, 'storage');
assert.deepEqual(processed.integrity, {
  repairedEdges: 1,
  droppedEdges: 2,
  orphanCount: 1,
  orphanServices: ['Key Vault'],
});
assert.ok(warnings.length >= 5);

console.log(JSON.stringify({
  contractVersion: TOPOLOGY_CONTRACT_VERSION,
  contractSha256,
  postProcessing: 'passed',
}, null, 2));
