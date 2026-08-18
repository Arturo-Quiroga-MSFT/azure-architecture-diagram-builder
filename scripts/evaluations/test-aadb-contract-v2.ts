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
assert.match(prompt, /One connection per service pair/);
assert.match(prompt, /Reuse shared platform nodes/);
// Landing-zone topologies are out of scope; the generic layout path handled
// them with fewer edge crossings than the hub-and-spoke special case did.
assert.doesNotMatch(prompt, /Hub-and-spoke networks/);
assert.doesNotMatch(prompt, /Hub-and-spoke for monitoring/);
assert.doesNotMatch(prompt, /"position"\s*:/);
assert.equal(prompt.length, 9_020);
assert.equal(contractSha256, '8035074c5c485bf2e30f5442c4dba8437c113503e7b8656d744172a90170ae77');

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
  mergedServices: 0,
  mergedEdges: 0,
  orphanCount: 1,
  orphanServices: ['Key Vault'],
});
assert.ok(warnings.length >= 5);

// Several connections between one pair resolve to the same two handles, so they
// stack into overlapping lines carrying separate labels.
const mergedPair = postProcessArchitecture({
  groups: [{ id: 'app', label: 'App' }],
  services: [
    { id: 'api', name: 'API Management', type: 'API Management', groupId: 'app' },
    { id: 'cache', name: 'Azure Cache for Redis', type: 'Azure Cache for Redis', groupId: 'app' },
  ],
  connections: [
    { from: 'api', to: 'cache', label: 'Read cached positions', type: 'sync' },
    { from: 'api', to: 'cache', label: 'Write updated positions', type: 'sync' },
    { from: 'cache', to: 'api', label: 'Read cached positions', type: 'sync' },
  ],
  workflow: [],
}, { log: () => undefined, warn: () => undefined });

assert.equal(mergedPair.connections.length, 1, 'a service pair should carry a single connection');
assert.equal(mergedPair.integrity.mergedEdges, 2);
assert.equal(
  mergedPair.connections[0].label,
  'Read cached positions · Write updated positions',
  'merging should combine distinct labels without repeating one',
);

const consolidatedSharedServices = postProcessArchitecture({
  groups: [{ id: 'processing', label: 'Processing' }],
  services: [
    { id: 'order-api', name: 'Azure Container Apps', type: 'Azure Container Apps', groupId: 'processing' },
    { id: 'matching-engine', name: 'Azure Container Apps', type: 'Azure Container Apps', groupId: 'processing' },
    { id: 'command-bus', name: 'Service Bus', type: 'Service Bus', groupId: 'processing' },
    { id: 'fill-bus', name: 'Service Bus', type: 'Service Bus', groupId: 'processing' },
    { id: 'retry-bus', name: 'Service Bus', type: 'Service Bus', groupId: 'processing' },
  ],
  connections: [
    { from: 'order-api', to: 'command-bus', label: 'Publish commands', type: 'async' },
    { from: 'command-bus', to: 'matching-engine', label: 'Deliver commands', type: 'async' },
    { from: 'matching-engine', to: 'fill-bus', label: 'Publish fills', type: 'async' },
    { from: 'fill-bus', to: 'order-api', label: 'Deliver fills', type: 'async' },
    { from: 'matching-engine', to: 'retry-bus', label: 'Publish retries', type: 'async' },
  ],
  workflow: [{ step: 1, services: ['order-api', 'command-bus', 'matching-engine', 'fill-bus'] }],
}, { log: () => undefined, warn: () => undefined });

assert.deepEqual(
  consolidatedSharedServices.services.map((service: any) => service.name),
  ['Azure Container Apps', 'Service Bus'],
);
assert.equal(consolidatedSharedServices.integrity.mergedServices, 3);
assert.equal(consolidatedSharedServices.connections.length, 1);
assert.deepEqual(consolidatedSharedServices.workflow[0].services, ['order-api', 'command-bus']);

const isolatedSharedServices = postProcessArchitecture({
  groups: [
    { id: 'east', label: 'East US 2' },
    { id: 'west', label: 'West US 2' },
  ],
  services: [
    { id: 'east-bus', name: 'Service Bus', type: 'Service Bus', groupId: 'east' },
    { id: 'west-bus', name: 'Service Bus', type: 'Service Bus', groupId: 'west' },
  ],
  connections: [{ from: 'east-bus', to: 'west-bus', label: 'Replicate events', type: 'async' }],
  workflow: [],
}, { log: () => undefined, warn: () => undefined });

assert.equal(isolatedSharedServices.services.length, 2, 'separate logical groups should preserve isolated deployments');
assert.equal(isolatedSharedServices.integrity.mergedServices, 0);

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
