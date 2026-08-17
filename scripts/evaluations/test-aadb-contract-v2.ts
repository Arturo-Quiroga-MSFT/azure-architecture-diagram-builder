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
// Landing-zone topologies are out of scope; the generic layout path handled
// them with fewer edge crossings than the hub-and-spoke special case did.
assert.doesNotMatch(prompt, /Hub-and-spoke networks/);
assert.doesNotMatch(prompt, /Hub-and-spoke for monitoring/);
assert.doesNotMatch(prompt, /"position"\s*:/);
assert.equal(prompt.length, 7_883);
assert.equal(contractSha256, '2286c516cb4be2c59cab162b06a9c1cb94579374a5681113bb1f368ce8ed63c8');

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

// Group labels are passed through untouched now that landing-zone spokes are
// no longer a recognised shape.
const untouchedSpokes = postProcessArchitecture({
  groups: [
    { id: 'app-spoke', label: 'Application Spoke' },
    { id: 'data-spoke', label: 'Data Spoke' },
  ],
  services: [
    { id: 'app-vnet', name: 'Virtual Network', type: 'Virtual Network', groupId: 'app-spoke' },
    { id: 'data-vnet', name: 'Virtual Network', type: 'Virtual Network', groupId: 'data-spoke' },
  ],
  connections: [{ from: 'app-vnet', to: 'data-vnet', label: 'Peer spokes', type: 'sync' }],
  workflow: [],
}, { log: () => undefined, warn: () => undefined });

assert.equal(untouchedSpokes.services.length, 2, 'post-processing should not invent spoke workloads');
assert.equal(untouchedSpokes.connections.length, 1, 'post-processing should not invent spoke connections');

console.log(JSON.stringify({
  contractVersion: TOPOLOGY_CONTRACT_VERSION,
  contractSha256,
  postProcessing: 'passed',
}, null, 2));
