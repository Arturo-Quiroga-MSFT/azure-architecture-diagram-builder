import assert from 'node:assert/strict';

import { layoutArchitecture } from '../src/utils/layoutEngine';

const groups = [
  { id: 'identity', label: 'Identity & Security' },
  { id: 'hub', label: 'Connectivity Hub' },
  { id: 'app', label: 'Application Spoke' },
  { id: 'data', label: 'Data Spoke' },
  { id: 'monitoring', label: 'Monitoring & Observability' },
];

const services = [
  { id: 'entra', name: 'Microsoft Entra ID', groupId: 'identity' },
  { id: 'hub-vnet', name: 'Virtual Network', groupId: 'hub' },
  { id: 'firewall', name: 'Azure Firewall', groupId: 'hub' },
  { id: 'bastion', name: 'Azure Bastion', groupId: 'hub' },
  { id: 'dns', name: 'Azure DNS', groupId: 'hub' },
  { id: 'app-vnet', name: 'Virtual Network', groupId: 'app' },
  { id: 'app-vm', name: 'Virtual Machines', groupId: 'app' },
  { id: 'data-vnet', name: 'Virtual Network', groupId: 'data' },
  { id: 'data-sql', name: 'SQL Database', groupId: 'data' },
  { id: 'monitor', name: 'Azure Monitor', groupId: 'monitoring' },
  { id: 'logs', name: 'Log Analytics', groupId: 'monitoring' },
];

const connections = [
  { from: 'app-vnet', to: 'hub-vnet' },
  { from: 'data-vnet', to: 'hub-vnet' },
  { from: 'hub-vnet', to: 'firewall' },
  { from: 'hub-vnet', to: 'bastion' },
  { from: 'hub-vnet', to: 'dns' },
  { from: 'app-vnet', to: 'app-vm' },
  { from: 'data-vnet', to: 'data-sql' },
  { from: 'entra', to: 'bastion' },
  { from: 'firewall', to: 'monitor' },
  { from: 'monitor', to: 'logs' },
];

const result = layoutArchitecture(services, connections, groups, { direction: 'LR' });

for (let leftIndex = 0; leftIndex < result.groups.length; leftIndex++) {
  const left = result.groups[leftIndex];
  for (let rightIndex = leftIndex + 1; rightIndex < result.groups.length; rightIndex++) {
    const right = result.groups[rightIndex];
    const overlapX = Math.min(left.position.x + left.width, right.position.x + right.width)
      - Math.max(left.position.x, right.position.x);
    const overlapY = Math.min(left.position.y + left.height, right.position.y + right.height)
      - Math.max(left.position.y, right.position.y);
    assert.ok(overlapX <= 0 || overlapY <= 0, `${left.id} overlaps ${right.id}`);
  }
}

for (const service of result.services) {
  const group = result.groups.find(candidate => candidate.id === service.groupId);
  if (!group) continue;
  assert.ok(service.position.x >= 0 && service.position.y >= 0, `${service.id} starts outside ${group.id}`);
  assert.ok(service.position.x + 180 <= group.width, `${service.id} exceeds ${group.id} width`);
  // Rendered nodes reach 134px tall, so the reserved slot must clear that.
  assert.ok(service.position.y + 136 <= group.height, `${service.id} exceeds ${group.id} height`);
}

// A labelled connection needs its own corridor; without one the chip lands on
// top of the nodes it connects.
const positionById = new Map(result.services.map(service => [service.id, service]));
for (const connection of connections) {
  const from = positionById.get(connection.from);
  const to = positionById.get(connection.to);
  if (!from || !to || from.groupId !== to.groupId) continue;
  const gapX = Math.max(from.position.x, to.position.x) - Math.min(from.position.x + 180, to.position.x + 180);
  const gapY = Math.max(from.position.y, to.position.y) - Math.min(from.position.y + 136, to.position.y + 136);
  assert.ok(
    Math.max(gapX, gapY) >= 190,
    `${connection.from} -> ${connection.to} leaves no room for its label (gapX=${gapX}, gapY=${gapY})`,
  );
}

const repeatedVnets = result.services.filter(service => service.name === 'Virtual Network');
assert.equal(repeatedVnets.length, 3);
assert.equal(new Set(repeatedVnets.map(service => `${service.groupId}:${service.position.x}:${service.position.y}`)).size, 3);

const minX = Math.min(...result.groups.map(group => group.position.x));
const minY = Math.min(...result.groups.map(group => group.position.y));
const maxX = Math.max(...result.groups.map(group => group.position.x + group.width));
const maxY = Math.max(...result.groups.map(group => group.position.y + group.height));
assert.ok(maxX - minX > 0 && maxY - minY > 0, 'grouped layout should occupy a positive area');

// Dagre centres a rank, so a narrow group beside a wide one starts far along it.
// Every architecture must read as aligned columns.
const tiered = layoutArchitecture(
  [
    { id: 'cdn', name: 'Content Delivery Network', groupId: 'edge' },
    { id: 'aks', name: 'Azure Kubernetes Service', groupId: 'compute' },
    { id: 'bus', name: 'Service Bus', groupId: 'compute' },
    { id: 'cosmos', name: 'Azure Cosmos DB', groupId: 'store' },
    { id: 'monitor', name: 'Azure Monitor', groupId: 'ops' },
    { id: 'logs', name: 'Log Analytics', groupId: 'ops' },
  ],
  [
    { from: 'cdn', to: 'aks', label: 'Route storefront traffic' },
    { from: 'aks', to: 'bus', label: 'Publish order events' },
    { from: 'aks', to: 'cosmos', label: 'Persist catalog projections' },
    { from: 'aks', to: 'monitor', label: 'Send application telemetry' },
    { from: 'monitor', to: 'logs', label: 'Centralize operational telemetry' },
  ],
  [
    { id: 'edge', label: 'Edge and Ingress' },
    { id: 'compute', label: 'Application and Compute' },
    { id: 'store', label: 'Data and Storage' },
    { id: 'ops', label: 'Monitoring and Observability' },
  ],
  { direction: 'LR' },
);

const storeGroup = tiered.groups.find(group => group.id === 'store')!;
const opsGroup = tiered.groups.find(group => group.id === 'ops')!;
assert.notEqual(storeGroup.width, opsGroup.width, 'the fixture needs differently sized peers to be meaningful');
assert.equal(
  Math.round(storeGroup.position.x),
  Math.round(opsGroup.position.x),
  'groups sharing a rank should share a leading edge instead of a centre line',
);

const privateEndpointPacking = layoutArchitecture(
  [
    { id: 'app', name: 'App Service', groupId: 'application' },
    { id: 'managed-app-endpoint', name: 'Private Endpoint - App Service', groupId: 'application' },
    { id: 'vnet', name: 'Virtual Network', groupId: 'protected' },
    { id: 'sql', name: 'SQL Database', groupId: 'protected' },
    { id: 'sql-endpoint', name: 'Private Endpoint - SQL Database', groupId: 'protected' },
    { id: 'vault', name: 'Key Vault', groupId: 'protected' },
    { id: 'vault-endpoint', name: 'Private Endpoint - Key Vault', groupId: 'protected' },
    { id: 'storage', name: 'Storage Account', groupId: 'protected' },
    { id: 'storage-endpoint', name: 'Private Endpoint - Storage Account', groupId: 'protected' },
  ],
  [
    { from: 'app', to: 'sql', label: 'Read relational data', type: 'sync' },
    { from: 'app', to: 'vault', label: 'Retrieve secrets', type: 'sync' },
    { from: 'app', to: 'storage', label: 'Read application objects', type: 'sync' },
    { from: 'managed-app-endpoint', to: 'app', label: 'Managed origin endpoint', type: 'association' },
    { from: 'sql-endpoint', to: 'sql', label: 'Private endpoint associated with SQL', type: 'association' },
    { from: 'vault-endpoint', to: 'vault', label: 'Private endpoint associated with Key Vault', type: 'association' },
    { from: 'storage-endpoint', to: 'storage', label: 'Private endpoint associated with Storage', type: 'association' },
    { from: 'vnet', to: 'sql-endpoint', label: 'Contains SQL endpoint', type: 'containment' },
    { from: 'vnet', to: 'vault-endpoint', label: 'Contains Key Vault endpoint', type: 'containment' },
    { from: 'vnet', to: 'storage-endpoint', label: 'Contains Storage endpoint', type: 'containment' },
  ],
  [
    { id: 'application', label: 'Application / Compute' },
    { id: 'protected', label: 'Protected Data / Storage' },
  ],
  { direction: 'LR' },
);

const privatePosition = new Map(privateEndpointPacking.services.map(service => [service.id, service.position]));
for (const [targetId, endpointId] of [
  ['sql', 'sql-endpoint'],
  ['vault', 'vault-endpoint'],
  ['storage', 'storage-endpoint'],
]) {
  assert.ok(
    privatePosition.get(endpointId)!.x > privatePosition.get(targetId)!.x + 180,
    `${targetId} and ${endpointId} should occupy separate columns with a label corridor`,
  );
  assert.equal(
    privatePosition.get(endpointId)!.y,
    privatePosition.get(targetId)!.y,
    `${targetId} and ${endpointId} should read as one horizontal pair`,
  );
}
assert.ok(
  privatePosition.get('vnet')!.y < privatePosition.get('sql')!.y,
  'the shared VNet should occupy a separate row above customer-owned endpoint pairs',
);
assert.equal(
  privatePosition.get('managed-app-endpoint')!.x,
  privatePosition.get('app')!.x,
  'the Front Door-managed App Service endpoint should keep compact vertical packing',
);

const protectedGroup = privateEndpointPacking.groups.find(group => group.id === 'protected')!;
assert.ok(protectedGroup.width >= 700, 'multiple private endpoint pairs should widen their owning group');
assert.ok(protectedGroup.height < 1100, 'pair packing should avoid a tall single-column resource tower');

console.log('Grouped layout tests passed.');