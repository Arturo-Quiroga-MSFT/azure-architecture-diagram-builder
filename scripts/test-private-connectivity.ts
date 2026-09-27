import assert from 'node:assert/strict';

import {
  PRIVATE_CONNECTIVITY_LINE_LIMIT,
  PRIVATE_NETWORK_EDGE_LABEL,
  postProcessArchitecture,
} from '../src/services/architecturePostProcessing';
import { buildModificationPrompt } from '../src/services/modificationPrompt';

const quiet = { log: () => {}, warn: () => {} };
const process = (architecture: any) => postProcessArchitecture(structuredClone(architecture), quiet);
const vnetLinesOf = (result: any, vnetId: string) => result.connections
  .filter((connection: any) => connection.from === vnetId && connection.label === PRIVATE_NETWORK_EDGE_LABEL)
  .map((connection: any) => connection.to)
  .sort();

// ── 1. The reported diagram: "Internal REST API on Container Apps backed by
// Azure SQL", then "Add private networking" and "Add Private DNS zones". The
// model declared nothing, so the boundary was an island with no note.
const reported = {
  groups: [
    { id: 'ingress-api-management', label: 'Ingress and API Management' },
    { id: 'application-compute', label: 'Application and Compute' },
    { id: 'data-storage', label: 'Data and Storage' },
    { id: 'identity-security', label: 'Identity and Security' },
    { id: 'private-connectivity', label: 'Private Connectivity' },
  ],
  services: [
    { id: 'api-management', name: 'API Management', type: 'API Management', groupId: 'ingress-api-management' },
    { id: 'container-apps', name: 'Azure Container Apps', type: 'Azure Container Apps', groupId: 'application-compute' },
    { id: 'sql-database', name: 'SQL Database', type: 'SQL Database', groupId: 'data-storage' },
    { id: 'entra-id', name: 'Microsoft Entra ID', type: 'Microsoft Entra ID', groupId: 'identity-security' },
    { id: 'virtual-network', name: 'Virtual Network', type: 'Virtual Network', groupId: 'private-connectivity' },
    { id: 'azure-dns', name: 'Azure DNS', type: 'Azure DNS', groupId: 'private-connectivity' },
  ],
  connections: [
    { from: 'entra-id', to: 'api-management', label: 'Authorize callers and validate Microsoft Entra ID access tokens', type: 'association' },
    { from: 'api-management', to: 'container-apps', label: 'Forward authenticated REST operations to the internal Container Apps endpoint', type: 'sync' },
    { from: 'container-apps', to: 'sql-database', label: 'Execute parameterized SQL queries and transactions over private connectivity', type: 'sync' },
    { from: 'azure-dns', to: 'virtual-network', label: 'Link the SQL Database and Container Apps private DNS zones to the virtual network', type: 'association' },
  ],
  workflow: [
    { step: 1, description: "API Management validates the caller's bearer token against Microsoft Entra ID.", services: ['entra-id', 'api-management'] },
    { step: 4, description: 'Azure Container Apps resolves the private SQL Database service name through the linked private DNS zone.', services: ['container-apps', 'azure-dns', 'virtual-network'] },
    { step: 5, description: 'Azure Container Apps executes parameterized queries against SQL Database over private connectivity.', services: ['container-apps', 'sql-database'] },
  ],
};

const fixed = process(reported);
const boundary = fixed.groups.find((group: any) => group.id === 'private-connectivity');
assert.equal(boundary.note, 'Private endpoints: Azure Container Apps and SQL Database',
  'the boundary names what it protects, inferred from the private/internal traffic labels');
assert.deepEqual(vnetLinesOf(fixed, 'virtual-network'), ['container-apps', 'sql-database'],
  'the boundary is visibly linked to each protected resource');
assert.equal(fixed.services.filter((service: any) => /dns/i.test(service.name)).length, 1,
  'the existing Azure DNS node is the private DNS zone; no second DNS node is added');
assert.equal(fixed.services.some((service: any) => service.id === 'api-management' && service.privateConnectivity), false,
  'API Management is not marked: nothing describes it as reached privately');
const step5 = fixed.workflow.find((step: any) => step.step === 5);
assert.ok(step5.services.includes('virtual-network'), 'a step over private connectivity also highlights the boundary');
const step1 = fixed.workflow.find((step: any) => step.step === 1);
assert.equal(step1.services.includes('virtual-network'), false, 'unrelated steps are unchanged');
assert.equal(fixed.integrity.orphanCount, 0);

// Re-processing (as every Guided Chat refinement does) never duplicates lines.
const refined = process({ ...fixed, groups: fixed.groups, workflow: fixed.workflow });
assert.deepEqual(vnetLinesOf(refined, 'virtual-network'), ['container-apps', 'sql-database']);

// ── 2. An explicit declaration wins over inference, by id or by name.
const declared = process({
  ...reported,
  privateConnectivity: { protects: ['sql-database', 'API Management'] },
});
assert.deepEqual(vnetLinesOf(declared, 'virtual-network'), ['api-management', 'sql-database']);
assert.equal('privateConnectivity' in declared, false, 'the declaration is consumed, not rendered');
const declaredApim = declared.services.find((service: any) => service.id === 'api-management');
assert.equal(declaredApim.privateConnectivity, 'line');

// Network plumbing is never a "protected resource", even if declared.
const selfProtected = process({ ...reported, privateConnectivity: { protects: ['virtual-network', 'azure-dns', 'sql-database'] } });
assert.deepEqual(vnetLinesOf(selfProtected, 'virtual-network'), ['sql-database']);

// ── 3. Above the line limit: badges on each protected resource, no lines.
const many = ['app', 'func', 'sql', 'cosmos', 'storage', 'kv'];
assert.ok(many.length > PRIVATE_CONNECTIVITY_LINE_LIMIT);
const crowded = process({
  groups: [{ id: 'net', label: 'Private Connectivity' }, { id: 'work', label: 'Workload' }],
  services: [
    { id: 'app', name: 'App Service', type: 'App Service', groupId: 'work' },
    { id: 'func', name: 'Azure Functions', type: 'Azure Functions', groupId: 'work' },
    { id: 'sql', name: 'SQL Database', type: 'SQL Database', groupId: 'work' },
    { id: 'cosmos', name: 'Azure Cosmos DB', type: 'Azure Cosmos DB', groupId: 'work' },
    { id: 'storage', name: 'Storage Account', type: 'Storage Account', groupId: 'work' },
    { id: 'kv', name: 'Key Vault', type: 'Key Vault', groupId: 'work' },
    { id: 'vnet', name: 'Virtual Network', type: 'Virtual Network', groupId: 'net' },
  ],
  connections: [
    { from: 'app', to: 'func', label: 'Invoke', type: 'sync' },
    { from: 'func', to: 'sql', label: 'Write', type: 'sync' },
    { from: 'func', to: 'cosmos', label: 'Write', type: 'sync' },
    { from: 'func', to: 'storage', label: 'Store', type: 'sync' },
    { from: 'func', to: 'kv', label: 'Read secrets', type: 'sync' },
  ],
  workflow: [],
  privateConnectivity: { protects: many },
});
assert.deepEqual(vnetLinesOf(crowded, 'vnet'), [], 'no lines once they would crowd the diagram');
assert.equal(crowded.services.filter((service: any) => service.privateConnectivity === 'badge').length, many.length);
assert.match(crowded.groups.find((group: any) => group.id === 'net').note, /^Private endpoints: /);

// ── 4. A v2.0.3 diagram's per-resource "Private Link - X" nodes are folded
// back into the boundary, keeping what they protected.
const legacy = process({
  groups: [{ id: 'net', label: 'Private Connectivity' }, { id: 'work', label: 'Workload' }],
  services: [
    { id: 'app', name: 'App Service', type: 'App Service', groupId: 'work' },
    { id: 'sql', name: 'SQL Database', type: 'SQL Database', groupId: 'work' },
    { id: 'vnet', name: 'Virtual Network', type: 'Virtual Network', groupId: 'net' },
    { id: 'pl-sql', name: 'Private Link - SQL Database', type: 'Azure Private Link', groupId: 'net' },
  ],
  connections: [{ from: 'app', to: 'sql', label: 'Read and write', type: 'sync' }],
  workflow: [],
});
assert.equal(legacy.services.some((service: any) => service.id === 'pl-sql'), false);
assert.deepEqual(vnetLinesOf(legacy, 'vnet'), ['sql']);

// ── 5. The refinement prompt tells the model what is protected today, and
// leaves out the app-drawn lines it would otherwise echo back.
const prompt = buildModificationPrompt({
  architectureName: 'Internal REST API',
  nodes: [
    { id: 'vnet', type: 'azureNode', data: { label: 'Virtual Network' } },
    { id: 'sql', type: 'azureNode', data: { label: 'SQL Database', privateConnectivity: 'line' } },
    { id: 'aca', type: 'azureNode', data: { label: 'Azure Container Apps', privateConnectivity: 'line' } },
    { id: 'apim', type: 'azureNode', data: { label: 'API Management', privateConnectivity: null } },
  ],
  edges: [
    { id: 'e1', source: 'vnet', target: 'sql', label: PRIVATE_NETWORK_EDGE_LABEL, data: { connectionType: 'association' } },
    // As rendered on the canvas: unlabelled, recognised by its flag.
    { id: 'e0', source: 'vnet', target: 'aca', label: '', data: { connectionType: 'association', privateNetworkLink: true } },
    { id: 'e2', source: 'aca', target: 'sql', label: 'Execute queries', data: { connectionType: 'sync' } },
  ],
}, 'Add Azure Monitor');
assert.match(prompt, /Private connectivity protects: SQL Database, Azure Container Apps/);
assert.doesNotMatch(prompt, new RegExp(PRIVATE_NETWORK_EDGE_LABEL));
assert.doesNotMatch(prompt, /Virtual Network associated with Azure Container Apps/, 'the unlabelled canvas line is left out too');
assert.match(prompt, /Execute queries/);
assert.match(prompt, /"privateConnectivity": \{ "protects"/);

console.log('Private connectivity tests passed: inference, declaration, line limit, legacy nodes, refinement prompt.');
