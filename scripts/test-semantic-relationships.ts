import assert from 'node:assert/strict';
import { postProcessArchitecture } from '../src/services/architecturePostProcessing';
import { buildArchitectureGenerationSystemPrompt } from '../src/services/architectureGenerationContract';
import { buildModificationPrompt } from '../src/services/modificationPrompt';
import { animateEdgeFlow } from '../src/utils/animateEdges';
import { layoutArchitecture } from '../src/utils/layoutEngine';
import { getServiceIconMapping } from '../src/data/serviceIconMapping';

const processed = postProcessArchitecture({
  groups: [
    { id: 'edge', label: 'Ingress / Edge' },
    { id: 'app', label: 'Application' },
    { id: 'data', label: 'Data' },
  ],
  services: [
    { id: 'waf', name: 'Web Application Firewall', type: 'Web Application Firewall', category: 'security', groupId: 'edge' },
    { id: 'front-door', name: 'Azure Front Door', type: 'Azure Front Door', category: 'networking', groupId: 'edge' },
    { id: 'web', name: 'App Service', type: 'App Service', category: 'app services', groupId: 'app' },
    { id: 'private-link', name: 'Azure Private Link', type: 'Azure Private Link', category: 'networking', groupId: 'data' },
    { id: 'redis', name: 'Azure Cache for Redis', type: 'Azure Cache for Redis', category: 'databases', groupId: 'data' },
    { id: 'sql', name: 'SQL Database', type: 'SQL Database', category: 'databases', groupId: 'data' },
  ],
  connections: [
    { from: 'waf', to: 'front-door', label: 'Inspect customer requests', type: 'sync' },
    { from: 'front-door', to: 'web', label: 'Route permitted HTTPS requests', type: 'sync' },
    { from: 'web', to: 'private-link', label: 'Use private connectivity', type: 'sync' },
    { from: 'private-link', to: 'redis', label: 'Connect privately', type: 'sync' },
    { from: 'private-link', to: 'sql', label: 'Connect privately', type: 'sync' },
  ],
  workflow: [
    { step: 1, description: 'Inspect and route requests.', services: ['waf', 'front-door', 'web'] },
    { step: 2, description: 'Read data privately.', services: ['web', 'private-link', 'redis', 'sql'] },
  ],
});

const waf = processed.services.find((service: any) => service.id === 'waf');
assert.equal(waf.name, 'Front Door WAF Policy');
assert.equal(waf.type, 'Web Application Firewall');
assert.equal(waf.groupId, 'edge');

const wafEdges = processed.connections.filter((connection: any) => (
  connection.from === 'waf' || connection.to === 'waf'
));
assert.deepEqual(wafEdges, [{
  from: 'waf',
  to: 'front-door',
  label: 'WAF policy associated with Front Door route',
  type: 'association',
}]);
assert.equal(processed.connections.some((connection: any) => (
  connection.from === 'front-door' && connection.to === 'web' && connection.type === 'sync'
)), true);
assert.equal(processed.connections.some((connection: any) => (
  connection.from === 'web' && connection.to === 'redis' && connection.type === 'sync'
)), true);
assert.equal(processed.connections.some((connection: any) => (
  connection.from === 'web' && connection.to === 'sql' && connection.type === 'sync'
)), true);

const privateEndpoints = processed.services.filter((service: any) => service.type === 'Private Endpoint');
assert.equal(privateEndpoints.length, 0, 'no per-resource Private Endpoint nodes should be created');
assert.equal(processed.connections.some((connection: any) => /private endpoint/i.test(connection.label || '')), false);

const boundaryGroup = processed.groups.find((group: any) => group.id === 'private-connectivity');
assert.ok(boundaryGroup, 'a Private Connectivity group should be created when there was none to reuse');
assert.equal(boundaryGroup.note, 'Private endpoints: Azure Cache for Redis and SQL Database');

const vnet = processed.services.find((service: any) => service.name === 'Virtual Network');
const dnsZone = processed.services.find((service: any) => service.name === 'Private DNS Zone');
assert.ok(vnet && vnet.groupId === 'private-connectivity');
assert.ok(dnsZone && dnsZone.groupId === 'private-connectivity');

// One named Private Link node per protected resource, contained in the same
// group, with zero edges — membership in the group carries the relationship.
const privateLinkNodes = processed.services.filter((service: any) => /^Private Link -/.test(service.name));
assert.deepEqual(
  privateLinkNodes.map((service: any) => service.name).sort(),
  ['Private Link - Azure Cache for Redis', 'Private Link - SQL Database'],
);
assert.equal(privateLinkNodes.every((service: any) => service.groupId === 'private-connectivity'), true);
const privateLinkIds = new Set(privateLinkNodes.map((service: any) => service.id));
assert.equal(processed.connections.some((connection: any) => (
  privateLinkIds.has(connection.from) || privateLinkIds.has(connection.to)
)), false);

// Deliberately no edges into the boundary — the note and the named nodes
// carry the relationship, not a drawn line.
assert.equal(processed.connections.some((connection: any) => (
  connection.from === vnet.id || connection.to === vnet.id || connection.from === dnsZone.id || connection.to === dnsZone.id
)), false);
assert.equal(processed.integrity.orphanCount, 0, 'the boundary\'s own nodes are not orphans');

// The connector's real neighbours still connect directly, unlabelled by any
// per-resource private-endpoint node.
assert.equal(processed.connections.some((connection: any) => (
  connection.from === 'web' && connection.to === 'redis' && connection.type === 'sync'
)), true);
assert.equal(processed.connections.some((connection: any) => (
  connection.from === 'web' && connection.to === 'sql' && connection.type === 'sync'
)), true);
assert.equal(processed.workflow.some((step: any) => step.services.includes('private-link')), false);
assert.ok(processed.integrity.semanticRepairs >= 3);

const positioned = layoutArchitecture(processed.services, processed.connections, processed.groups);
assert.equal(positioned.services.length, processed.services.length);
assert.equal(positioned.services.every((service: any) => Number.isFinite(service.position.x) && Number.isFinite(service.position.y)), true);
const positionedByName = new Map(positioned.services.map((service: any) => [service.name, service.position]));
assert.equal(positionedByName.get('Front Door WAF Policy')?.x, positionedByName.get('Azure Front Door')?.x);

const systemPrompt = buildArchitectureGenerationSystemPrompt();
assert.match(systemPrompt, /sync\|async\|optional\|association\|containment/);
assert.match(systemPrompt, /Never emit Client → WAF → Front Door/);
assert.match(systemPrompt, /Do not model a "Private Endpoint - <resource>" node/);
assert.match(systemPrompt, /Do not connect either of them to the protected resources/);
assert.doesNotMatch(systemPrompt, /VNet Integration for outbound private access/);

const modificationPrompt = buildModificationPrompt({
  architectureName: 'Customer app',
  nodes: [
    { id: 'waf', type: 'azureNode', data: { label: 'Front Door WAF Policy' } },
    { id: 'fd', type: 'azureNode', data: { label: 'Azure Front Door' } },
  ],
  edges: [{
    source: 'waf',
    target: 'fd',
    label: 'WAF policy associated with Front Door route',
    data: { connectionType: 'association' },
  }],
}, 'Add WAF in front of Front Door');
assert.match(modificationPrompt, /associated with.*\[association\]/);
assert.match(modificationPrompt, /associate a Front Door WAF Policy with Azure Front Door/);

const animated = animateEdgeFlow('<svg><path id="semantic-association-edge-0" class="react-flow__edge-path"/><path id="semantic-containment-edge-1" class="react-flow__edge-path"/><path class="react-flow__edge-path"/></svg>');
assert.equal((animated.match(/<animateMotion/g) || []).length, 2);
assert.match(animated, /id="semantic-association-edge-0"/);
assert.doesNotMatch(animated, /id="semantic-association-edge-0"[^>]*id="rfflow-/);
assert.doesNotMatch(animated, /id="semantic-containment-edge-1"[^>]*id="rfflow-/);
assert.equal(getServiceIconMapping('Private Endpoint')?.iconFile, '02579-icon-service-Private-Endpoints');

const privateNetwork = postProcessArchitecture({
  groups: [
    { id: 'edge', label: 'Ingress / Edge' },
    { id: 'app', label: 'Application and Data' },
    { id: 'network', label: 'Private Connectivity' },
  ],
  services: [
    { id: 'front-door-2', name: 'Azure Front Door', type: 'Azure Front Door', category: 'networking', groupId: 'edge' },
    { id: 'app-2', name: 'App Service', type: 'App Service', category: 'app services', groupId: 'app' },
    { id: 'sql-2', name: 'SQL Database', type: 'SQL Database', category: 'databases', groupId: 'app' },
    { id: 'vnet', name: 'Virtual Network', type: 'Virtual Network', category: 'networking', groupId: 'network' },
    { id: 'private-link-app', name: 'Azure Private Link', type: 'Azure Private Link', category: 'networking', groupId: 'network' },
    { id: 'private-link-sql', name: 'Azure Private Link', type: 'Azure Private Link', category: 'networking', groupId: 'network' },
  ],
  connections: [
    { from: 'front-door-2', to: 'app-2', label: 'Route approved HTTPS requests through Private Link', type: 'sync' },
    { from: 'app-2', to: 'sql-2', label: 'Read and write data privately', type: 'sync' },
    { from: 'app-2', to: 'private-link-app', label: 'Private Front Door origin', type: 'sync' },
    { from: 'vnet', to: 'private-link-app', label: 'Place in private network', type: 'sync' },
    { from: 'sql-2', to: 'private-link-sql', label: 'Private database access', type: 'sync' },
    { from: 'vnet', to: 'private-link-sql', label: 'Place in private network', type: 'sync' },
  ],
  workflow: [],
});

assert.equal(privateNetwork.services.some((service: any) => service.name === 'Private Endpoint - Virtual Network'), false);
assert.equal(privateNetwork.services.some((service: any) => /^Private Endpoint -/.test(service.name)), false);

// The pre-existing 'network' group (already holding the VNet) is reused rather
// than abandoned for a fresh 'private-connectivity' group.
const reusedGroup = privateNetwork.groups.find((group: any) => group.id === 'network');
assert.equal(reusedGroup.label, 'Private Connectivity');
assert.equal(reusedGroup.note, 'Private endpoints: App Service and SQL Database');
assert.equal(privateNetwork.groups.some((group: any) => group.id === 'private-connectivity'), false);

const reusedVnet = privateNetwork.services.find((service: any) => service.name === 'Virtual Network');
const reusedDns = privateNetwork.services.find((service: any) => service.name === 'Private DNS Zone');
assert.equal(reusedVnet.groupId, 'network');
assert.equal(reusedDns.groupId, 'network');
assert.equal(privateNetwork.connections.some((connection: any) => (
  connection.from === reusedVnet.id || connection.to === reusedVnet.id
)), false);

const reusedPrivateLinkNodes = privateNetwork.services.filter((service: any) => /^Private Link -/.test(service.name));
assert.deepEqual(
  reusedPrivateLinkNodes.map((service: any) => service.name).sort(),
  ['Private Link - App Service', 'Private Link - SQL Database'],
);
assert.equal(reusedPrivateLinkNodes.every((service: any) => service.groupId === 'network'), true);
const reusedPrivateLinkIds = new Set(reusedPrivateLinkNodes.map((service: any) => service.id));
assert.equal(privateNetwork.connections.some((connection: any) => (
  reusedPrivateLinkIds.has(connection.from) || reusedPrivateLinkIds.has(connection.to)
)), false);

assert.equal(privateNetwork.integrity.orphanCount, 0);

assert.equal(privateNetwork.connections.some((connection: any) => (
  connection.from === 'app-2' && connection.to === 'sql-2' && connection.type === 'sync'
)), true);
const privateNetworkLayout = layoutArchitecture(
  privateNetwork.services,
  privateNetwork.connections,
  privateNetwork.groups,
);
const privateGroupsById = new Map(privateNetworkLayout.groups.map((group: any) => [group.id, group]));
// The Private Connectivity boundary carries zero edges by design (the note
// replaces them), so the layout engine has no rank signal to place it near
// 'app' the way the old per-resource edges used to. It still must land
// somewhere finite and non-overlapping.
for (const group of privateNetworkLayout.groups) {
  assert.ok(Number.isFinite(group.position.x) && Number.isFinite(group.position.y));
}
const overlaps = (a: any, b: any) => !(
  a.position.x + a.width <= b.position.x
  || b.position.x + b.width <= a.position.x
  || a.position.y + a.height <= b.position.y
  || b.position.y + b.height <= a.position.y
);
const network = privateGroupsById.get('network')!;
assert.equal(overlaps(network, privateGroupsById.get('app')!), false, 'Private Connectivity group must not overlap Application');
assert.equal(overlaps(network, privateGroupsById.get('edge')!), false, 'Private Connectivity group must not overlap Ingress / Edge');
assert.match(buildModificationPrompt({
  architectureName: 'Private customer app',
  nodes: [
    { id: 'vnet', type: 'azureNode', data: { label: 'Virtual Network' } },
    { id: 'app', type: 'azureNode', data: { label: 'App Service' } },
  ],
  edges: [{
    source: 'app',
    target: 'vnet',
    label: 'Connect privately to Virtual Network',
    data: { connectionType: 'sync' },
  }],
}, 'Keep private connectivity'), /connect privately to virtual network/i);

console.log('Semantic relationship tests passed: WAF, and the Private Connectivity group (no per-resource Private Endpoint nodes)');