#!/usr/bin/env node
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  SERVICE_CATALOG,
  resolveServiceName,
} from '../dist/serviceCatalog.js';

const iconMap = JSON.parse(
  readFileSync(new URL('../dist/iconMap.generated.json', import.meta.url), 'utf8'),
);
const pricing = JSON.parse(
  readFileSync(new URL('../dist/pricing.generated.json', import.meta.url), 'utf8'),
);

const catalogKeys = Object.keys(SERVICE_CATALOG);
const iconKeys = Object.keys(iconMap);
assert.equal(catalogKeys.length, 94, 'Expected all 94 canonical AADB services');
assert.deepEqual(catalogKeys.sort(), iconKeys.sort(), 'Catalog and icon-map keys must match');

for (const [key, info] of Object.entries(SERVICE_CATALOG)) {
  assert.equal(info.iconFile, iconMap[key].iconFile, `${key} icon must match the canonical icon map`);
  for (const identity of [key, info.displayName, ...info.aliases]) {
    assert.equal(resolveServiceName(identity), key, `Identity must resolve uniquely: ${identity}`);
    assert.equal(resolveServiceName(identity.toUpperCase()), key, `Identity must resolve case-insensitively: ${identity}`);
  }
  if (info.hasPricingData) {
    assert(info.pricingServiceName, `${key} must own a pricing service name`);
  }
}

assert.equal(resolveServiceName('Azure AD'), 'Microsoft Entra ID');
assert.equal(resolveServiceName('Cosmos DB'), 'Azure Cosmos DB');
assert.equal(resolveServiceName('AKS'), 'Kubernetes Service');
assert.equal(resolveServiceName('Azure AI Foundry'), 'Microsoft Foundry');
assert.equal(resolveServiceName('AI Search'), 'Azure AI Search');
assert.equal(resolveServiceName('Cognitive Search'), 'Azure AI Search');
assert.equal(resolveServiceName('Fabric Capacity'), 'Microsoft Fabric Capacity');
assert.equal(resolveServiceName('definitely-not-an-azure-service'), null);

const foundry = SERVICE_CATALOG['Microsoft Foundry'];
assert(foundry, 'Microsoft Foundry must be present');
assert.equal(foundry.hasPricingData, false);
assert.equal(foundry.isUsageBased, true);
assert.match(foundry.costRange, /usage-based/i);

const pricingOwners = new Map(
  Object.entries(SERVICE_CATALOG)
    .filter(([, info]) => info.hasPricingData && info.pricingServiceName)
    .map(([key, info]) => [info.pricingServiceName.toLowerCase().replace(/\s+/g, '_'), key]),
);
const pricingStems = new Set(
  Object.values(pricing.regions).flatMap(region => Object.keys(region)),
);
for (const stem of pricingStems) {
  assert(pricingOwners.has(stem), `Pricing sidecar entry has no canonical catalog owner: ${stem}`);
}

assert.equal(pricingOwners.get('microsoft_fabric_capacity'), 'Microsoft Fabric Capacity');
const fabricPricing = pricing.regions.eastus2?.microsoft_fabric_capacity;
assert(fabricPricing, 'East US 2 Fabric capacity pricing must be bundled');
assert.equal(fabricPricing.expectedBasis, 'fabric-capacity:F8');
assert.equal(fabricPricing.sampleSku, 'F8 (8 CU)');
assert(fabricPricing.low > 0 && fabricPricing.low < fabricPricing.expected);
assert(fabricPricing.expected < fabricPricing.high);

const searchPricing = pricing.regions.eastus2?.azure_cognitive_search;
assert(searchPricing, 'East US 2 Azure AI Search pricing must be bundled');
assert.match(searchPricing.sampleSku, /standard s1/i);
console.log(`[service-catalog] verified ${catalogKeys.length} canonical services and ${pricingStems.size} numeric pricing policies`);