// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Resource Graph import: edges are inferred from resource ids, endpoint
 * hostnames, Log Analytics customer ids and identity blocks, and labelled by
 * what each reference means. Synthetic rows modelled on a real Container Apps
 * + Cosmos DB + Foundry resource group.
 *
 * Run: npm run test:resource-graph
 */
import assert from 'node:assert/strict';
import { buildArchitectureFromResources, type ArgResource } from '../src/services/resourceGraphAdapter';

const SUB = '00000000-0000-0000-0000-000000000000';
const rid = (type: string, name: string) => `/subscriptions/${SUB}/resourceGroups/rg-demo/providers/${type}/${name}`;
const WS_CUSTOMER_ID = '11111111-2222-3333-4444-555555555555';

const resources: ArgResource[] = [
  {
    id: rid('Microsoft.App/containerApps', 'web'), name: 'web', type: 'microsoft.app/containerapps',
    properties: {
      managedEnvironmentId: rid('Microsoft.App/managedEnvironments', 'cae'),
      configuration: { registries: [{ server: 'acrdemo.azurecr.io', identity: rid('Microsoft.ManagedIdentity/userAssignedIdentities', 'id-app') }] },
      template: { containers: [{
        image: 'acrdemo.azurecr.io/web:1',
        env: [
          { name: 'COSMOS_ENDPOINT', value: 'https://cosmos-demo.documents.azure.com:443/' },
          { name: 'OPENAI_ENDPOINT', value: 'https://aif-demo.openai.azure.com/' },
          { name: 'SPEECH_RESOURCE_ID', value: rid('Microsoft.CognitiveServices/accounts', 'spch-demo') },
          { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', secretRef: 'appi' },
        ],
      }] },
    },
    identity: { type: 'UserAssigned', userAssignedIdentities: { [rid('Microsoft.ManagedIdentity/userAssignedIdentities', 'id-app')]: {} } },
  },
  {
    id: rid('Microsoft.App/managedEnvironments', 'cae'), name: 'cae', type: 'microsoft.app/managedenvironments',
    properties: {
      appLogsConfiguration: { logAnalyticsConfiguration: { customerId: WS_CUSTOMER_ID } },
      vnetConfiguration: { infrastructureSubnetId: `${rid('Microsoft.Network/virtualNetworks', 'vnet')}/subnets/aca` },
    },
  },
  { id: rid('Microsoft.ContainerRegistry/registries', 'acrdemo'), name: 'acrdemo', type: 'microsoft.containerregistry/registries', properties: { loginServer: 'acrdemo.azurecr.io' } },
  { id: rid('Microsoft.ManagedIdentity/userAssignedIdentities', 'id-app'), name: 'id-app', type: 'microsoft.managedidentity/userassignedidentities', properties: {} },
  { id: rid('Microsoft.DocumentDB/databaseAccounts', 'cosmos-demo'), name: 'cosmos-demo', type: 'microsoft.documentdb/databaseaccounts',
    properties: { documentEndpoint: 'https://cosmos-demo.documents.azure.com:443/',
      privateEndpointConnections: [{ properties: { privateEndpoint: { id: rid('Microsoft.Network/privateEndpoints', 'pe-cosmos') } } }] } },
  { id: rid('Microsoft.CognitiveServices/accounts', 'aif-demo'), name: 'aif-demo', type: 'microsoft.cognitiveservices/accounts', kind: 'AIServices',
    properties: { endpoints: { 'OpenAI Language Model Instance API': 'https://aif-demo.openai.azure.com/' } } },
  { id: rid('Microsoft.CognitiveServices/accounts', 'spch-demo'), name: 'spch-demo', type: 'microsoft.cognitiveservices/accounts', kind: 'SpeechServices', properties: {} },
  { id: rid('Microsoft.OperationalInsights/workspaces', 'log-demo'), name: 'log-demo', type: 'microsoft.operationalinsights/workspaces', properties: { customerId: WS_CUSTOMER_ID } },
  { id: rid('Microsoft.Insights/components', 'appi-demo'), name: 'appi-demo', type: 'microsoft.insights/components', kind: 'web',
    properties: { WorkspaceResourceId: rid('Microsoft.OperationalInsights/workspaces', 'log-demo') } },
  { id: rid('Microsoft.Network/virtualNetworks', 'vnet'), name: 'vnet', type: 'microsoft.network/virtualnetworks', properties: {} },
  { id: rid('Microsoft.Network/privateEndpoints', 'pe-cosmos'), name: 'pe-cosmos', type: 'microsoft.network/privateendpoints',
    properties: {
      subnet: { id: `${rid('Microsoft.Network/virtualNetworks', 'vnet')}/subnets/pe` },
      privateLinkServiceConnections: [{ properties: { privateLinkServiceId: rid('Microsoft.DocumentDB/databaseAccounts', 'cosmos-demo') } }],
      customDnsConfigs: [{ fqdn: 'cosmos-demo.documents.azure.com' }],
    } },
  { id: rid('Microsoft.Network/privateDnsZones', 'privatelink.documents.azure.com'), name: 'privatelink.documents.azure.com', type: 'microsoft.network/privatednszones', properties: {} },
  { id: `${rid('Microsoft.Network/privateDnsZones', 'privatelink.documents.azure.com')}/virtualNetworkLinks/link`, name: 'link',
    type: 'microsoft.network/privatednszones/virtualnetworklinks', properties: { virtualNetwork: { id: rid('Microsoft.Network/virtualNetworks', 'vnet') } } },
];

const { architecture, coverage } = buildArchitectureFromResources(resources);
const name = new Map(architecture.services.map(s => [s.id, s.description.split(': ').pop()]));
const edges = architecture.connections.map(c => `${name.get(c.from)} -[${c.label}|${c.type}]-> ${name.get(c.to)}`).sort();

const expected = [
  'web -[runs in|association]-> cae',
  'web -[pulls images from|sync]-> acrdemo',
  'web -[uses identity|association]-> id-app',
  'web -[reads/writes data|sync]-> cosmos-demo',
  'web -[calls AI models|sync]-> aif-demo',
  'web -[uses Speech|sync]-> spch-demo',
  'cae -[sends logs to|async]-> log-demo',
  'cae -[deployed in subnet|association]-> vnet',
  'appi-demo -[stores telemetry in|async]-> log-demo',
  'pe-cosmos -[private link to|sync]-> cosmos-demo',
  'pe-cosmos -[deployed in subnet|association]-> vnet',
  'privatelink.documents.azure.com -[linked to VNet|association]-> vnet',
].sort();

assert.deepEqual(edges, expected);
assert.equal(coverage.edgeCount, expected.length);
assert.ok(!architecture.connections.some(c => c.label === 'references'), 'no generic "references" labels');
assert.deepEqual(coverage.skippedTypes, ['microsoft.network/privatednszones/virtualnetworklinks']);
// Real resource names travel with each node so same-type services are distinguishable.
assert.deepEqual(
  architecture.services.filter(s => s.name === 'Foundry Tools').map(s => s.resourceName).sort(),
  ['aif-demo', 'spch-demo'],
);

// Unknown reference targets keep the generic fallback label.
const generic = buildArchitectureFromResources([
  { id: rid('Microsoft.Web/sites', 'a'), name: 'a', type: 'microsoft.web/sites', properties: { x: rid('Microsoft.Batch/batchAccounts', 'b') } },
  { id: rid('Microsoft.Batch/batchAccounts', 'b'), name: 'b', type: 'microsoft.batch/batchaccounts', properties: {} },
]);
assert.deepEqual(generic.architecture.connections.map(c => c.label), ['references']);

console.log(`Resource Graph import test passed: ${expected.length} labelled edges (ids, hostnames, workspace ids, identity, child resources).`);
