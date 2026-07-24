#!/usr/bin/env node
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const catalog = JSON.parse(readFileSync(resolve(root, 'serviceCatalog.generated.json'), 'utf8'));
const iconMap = JSON.parse(readFileSync(resolve(root, 'iconMap.generated.json'), 'utf8'));
const iconSvgs = JSON.parse(readFileSync(resolve(root, 'iconSvgs.generated.json'), 'utf8'));
const legacyTypes = JSON.parse(readFileSync(resolve(root, 'legacyIconTypes.generated.json'), 'utf8'));
const redirects = JSON.parse(readFileSync(
  resolve(root, '..', '..', 'src', 'data', 'iconPathRedirects.generated.json'),
  'utf8',
));

const expectedV24Paths = {
  'Azure OpenAI': 'ai + machine learning/03438-icon-service-Azure-OpenAI.svg',
  'Cognitive Services': 'ai + machine learning/10162-icon-service-Cognitive-Services.svg',
  'Computer Vision': 'ai + machine learning/00792-icon-service-Computer-Vision.svg',
  'Custom Vision': 'ai + machine learning/00793-icon-service-Custom-Vision.svg',
  'Speech Services': 'ai + machine learning/00797-icon-service-Speech-Services.svg',
  Translator: 'ai + machine learning/00800-icon-service-Translator-Text.svg',
  Language: 'ai + machine learning/02876-icon-service-Language.svg',
  'Document Intelligence': 'ai + machine learning/02749-icon-service-Azure-Applied-AI-Services.svg',
  'Azure Machine Learning': 'ai + machine learning/038470510-icon-service-Azure-Machine-Learning.svg',
  'AML Online Endpoint': 'ai + machine learning/038470510-icon-service-Azure-Machine-Learning.svg',
  'AML Batch Endpoint': 'ai + machine learning/038470510-icon-service-Azure-Machine-Learning.svg',
  'AML Deployment': 'ai + machine learning/038470510-icon-service-Azure-Machine-Learning.svg',
  'AML Managed Compute': 'compute/10021-icon-service-Virtual-Machine.svg',
  'Azure AI Search': 'ai + machine learning/10044-icon-service-Cognitive-Search.svg',
  'Microsoft Foundry': 'ai + machine learning/035746832-icon-service-AI-Foundry.svg',
  'Foundry Application': 'ai + machine learning/036509374-icon-service-Foundry-Application.svg',
  'Foundry Project': 'ai + machine learning/036509415-icon-service-Foundry-Project.svg',
  'Foundry IQ': 'ai + machine learning/038470497-icon-service-Azure-AI-Foundry-IQ.svg',
  'Microsoft Foundry Agent Service': 'ai + machine learning/038470523-icon-service-Foundry-Agent-Service.svg',
  'Microsoft Foundry Control Plane': 'ai + machine learning/038470534-icon-service-Foundry-Control-Plane.svg',
  'Foundry Labs': 'ai + machine learning/038470555-icon-service-Foundry-Labs.svg',
  'Foundry Local': 'ai + machine learning/038470593-icon-service-Foundry-Local.svg',
  'Microsoft Foundry Models': 'ai + machine learning/038470614-icon-service-Foundry-Models.svg',
  'AI Gateway': 'new icons/037838045-icon-service-AI-Gateway.svg',
  'Virtual Machines': 'compute/10021-icon-service-Virtual-Machine.svg',
  'App Service': 'app services/10035-icon-service-App-Services.svg',
  Functions: 'compute/10029-icon-service-Function-Apps.svg',
  'Container Instances': 'containers/10104-icon-service-Container-Instances.svg',
  'Kubernetes Service': 'containers/10023-icon-service-Kubernetes-Services.svg',
  'Container Registry': 'containers/10105-icon-service-Container-Registries.svg',
  'Azure Cosmos DB': 'databases/10121-icon-service-Azure-Cosmos-DB.svg',
  'SQL Database': 'databases/02390-icon-service-Azure-SQL.svg',
  MySQL: 'databases/10122-icon-service-Azure-Database-MySQL-Server.svg',
  'Redis Cache': 'databases/10137-icon-service-Cache-Redis.svg',
  'Azure Managed Redis': 'databases/03675-icon-service-Azure-Managed-Redis.svg',
  'Storage Account': 'storage/10086-icon-service-Storage-Accounts.svg',
  'Application Gateway': 'networking/10076-icon-service-Application-Gateways.svg',
  'Azure Front Door': 'networking/10073-icon-service-Front-Door-and-CDN-Profiles.svg',
  'Data Factory': 'analytics/10126-icon-service-Data-Factories.svg',
  'Azure Synapse Analytics': 'analytics/00606-icon-service-Azure-Synapse-Analytics.svg',
  'Stream Analytics': 'analytics/00042-icon-service-Stream-Analytics-Jobs.svg',
  'Event Hubs': 'analytics/00039-icon-service-Event-Hubs.svg',
  'Service Bus': 'integration/10836-icon-service-Azure-Service-Bus.svg',
  'Logic Apps': 'integration/02631-icon-service-Logic-Apps.svg',
  'Key Vault': 'security/10245-icon-service-Key-Vaults.svg',
  'Application Insights': 'monitor/00012-icon-service-Application-Insights.svg',
  'Log Analytics': 'monitor/00009-icon-service-Log-Analytics-Workspaces.svg',
  'API Management': 'integration/10042-icon-service-API-Management-Services.svg',
};

assert.deepEqual(Object.keys(catalog), Object.keys(iconMap), 'catalog and icon map keys must have parity');

const index = new Map();
for (const [canonicalName, service] of Object.entries(catalog)) {
  for (const name of [canonicalName, service.displayName, ...service.aliases]) {
    const normalized = name.trim().toLowerCase();
    assert(!index.has(normalized) || index.get(normalized) === canonicalName, `ambiguous alias: ${name}`);
    index.set(normalized, canonicalName);
  }
  assert(iconSvgs[iconMap[canonicalName].iconFile], `missing embedded SVG for ${canonicalName}`);
}

for (const [service, expectedPath] of Object.entries(expectedV24Paths)) {
  const mapping = iconMap[service];
  assert(mapping, `missing expected service mapping: ${service}`);
  assert.equal(`${mapping.category}/${mapping.iconFile}.svg`, expectedPath);
}

const expectedAliases = {
  'Azure AI Foundry': 'Microsoft Foundry',
  'Foundry Agent Service': 'Microsoft Foundry Agent Service',
  'Azure AI Foundry IQ': 'Foundry IQ',
  'Foundry Models': 'Microsoft Foundry Models',
  'Azure Cognitive Search': 'Azure AI Search',
  'WAF Policy': 'Web Application Firewall',
  'Azure Cache for Redis': 'Redis Cache',
};
for (const [alias, canonicalName] of Object.entries(expectedAliases)) {
  assert.equal(index.get(alias.toLowerCase()), canonicalName, `${alias} must resolve to ${canonicalName}`);
}

assert.equal(Object.values(catalog).filter(service => service.category === 'fabric').length, 20);
assert.equal(Object.keys(catalog).length, 104);
assert.equal(Object.keys(iconSvgs).length, 100);
assert.equal(Object.keys(redirects).length, 72);
assert.equal(
  redirects['app services/cdn-profiles.svg'],
  'networking/00056-icon-service-CDN-Profiles.svg',
);
assert.equal(legacyTypes['app-service'], 'App Service');
assert.equal(legacyTypes['azure-machine-learning'], 'Azure Machine Learning');
assert.equal(legacyTypes['virtual-machines'], 'Virtual Machines');
assert.equal(legacyTypes['cdn-profiles'], 'CDN');
console.log('[test-catalog] verified 104 services, 100 embedded icons, 72 legacy redirects, aliases, Foundry, and Fabric parity');
