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
assert.equal(privateEndpoints.length, 2);
assert.deepEqual(
  privateEndpoints.map((service: any) => service.name).sort(),
  ['Private Endpoint - Azure Cache for Redis', 'Private Endpoint - SQL Database'],
);
const privateEndpointIds = new Set(privateEndpoints.map((service: any) => service.id));
const privateEdges = processed.connections.filter((connection: any) => privateEndpointIds.has(connection.from));
assert.equal(privateEdges.length, 2);
assert.equal(privateEdges.every((connection: any) => connection.type === 'association'), true);
assert.equal(privateEdges.every((connection: any) => !privateEndpointIds.has(connection.to)), true);
const serviceNames = processed.services.map((service: any) => service.name);
assert.equal(serviceNames.indexOf('Private Endpoint - Azure Cache for Redis'), serviceNames.indexOf('Azure Cache for Redis') + 1);
assert.equal(serviceNames.indexOf('Private Endpoint - SQL Database'), serviceNames.indexOf('SQL Database') + 1);
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
assert.match(systemPrompt, /one "Private Endpoint - <resource>" node.*per protected service/);
assert.match(systemPrompt, /Virtual Network is NEVER a Private Endpoint target/);
assert.match(systemPrompt, /VNet Integration for outbound private access/);

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
assert.equal(privateNetwork.services.filter((service: any) => /^Private Endpoint -/.test(service.name)).length, 2);
assert.equal(privateNetwork.connections.some((connection: any) => (
  connection.from === 'app-2'
  && connection.to === 'vnet'
  && connection.type === 'association'
  && /VNet Integration/.test(connection.label)
)), true);
assert.equal(privateNetwork.connections.some((connection: any) => (
  connection.from === 'vnet'
  && connection.type === 'containment'
  && /Private Endpoint - SQL Database/.test(
    privateNetwork.services.find((service: any) => service.id === connection.to)?.name || '',
  )
)), true);
assert.equal(privateNetwork.connections.some((connection: any) => (
  connection.from === 'app-2' && connection.to === 'sql-2' && connection.type === 'sync'
)), true);
const privateNetworkLayout = layoutArchitecture(
  privateNetwork.services,
  privateNetwork.connections,
  privateNetwork.groups,
);
const privateGroupsById = new Map(privateNetworkLayout.groups.map((group: any) => [group.id, group]));
assert.equal(privateGroupsById.get('network')?.position.x, privateGroupsById.get('app')?.position.x);
assert.ok(
  privateGroupsById.get('network')!.position.y
    > privateGroupsById.get('app')!.position.y + privateGroupsById.get('app')!.height,
);
assert.match(buildModificationPrompt({
  architectureName: 'Private customer app',
  nodes: [
    { id: 'vnet', type: 'azureNode', data: { label: 'Virtual Network' } },
    { id: 'pe', type: 'azureNode', data: { label: 'Private Endpoint - SQL Database' } },
  ],
  edges: [{
    source: 'vnet',
    target: 'pe',
    label: 'Contains private endpoint for SQL Database',
    data: { connectionType: 'containment' },
  }],
}, 'Keep private connectivity'), /Virtual Network contains Private Endpoint.*\[containment\]/);

console.log('Semantic relationship tests passed: WAF, Private Endpoints, containment, and VNet Integration');