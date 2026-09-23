import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { getDefaultTier, getFallbackPricing, hasFallbackPricing } from '../src/data/azurePricing';
import { calculateNodeMonthlyCost } from '../src/services/pricingModeCalculator';
import { AVAILABLE_REGIONS } from '../src/data/pricingRegions';
import { AZURE_REGIONS, getDefaultRegion } from '../src/utils/pricingHelpers';
import type { NodePricingConfig } from '../src/types/pricing';

function pricing(overrides: Partial<NodePricingConfig> = {}): NodePricingConfig {
  return {
    estimatedCost: 100,
    tier: 'Standard',
    skuName: 'Standard',
    quantity: 2,
    region: 'eastus2',
    unit: 'per instance/month',
    lastUpdated: '2026-08-13T00:00:00.000Z',
    isCustom: false,
    paygSource: 'retail-api',
    ...overrides,
  };
}

const expectedRegions = JSON.parse(readFileSync('scripts/pricing-regions.json', 'utf8')) as string[];
const snapshotManifest = JSON.parse(readFileSync('src/data/pricing/snapshot-manifest.json', 'utf8'));
assert.equal(expectedRegions.length, 14);
for (const region of ['centralus', 'westus2', 'uksouth', 'northeurope', 'japaneast', 'centralindia']) {
  assert(expectedRegions.includes(region));
}
assert.deepEqual(AVAILABLE_REGIONS.map(region => region.id), expectedRegions);
assert.deepEqual(AZURE_REGIONS.map(region => region.armRegionName).sort(), [...expectedRegions].sort());
assert.deepEqual(snapshotManifest.regions, expectedRegions);
assert.equal(getDefaultRegion().armRegionName, 'eastus2');

assert.equal(getDefaultTier('Virtual Machine'), getDefaultTier('Virtual Machines'));
assert.equal(getFallbackPricing('Virtual Machine'), getFallbackPricing('Virtual Machines'));
assert.equal(getDefaultTier('Function App'), getDefaultTier('Function Apps'));
assert.equal(getFallbackPricing('Function App'), getFallbackPricing('Function Apps'));
assert.equal(hasFallbackPricing('Virtual Machine'), true);
assert.equal(hasFallbackPricing('AML Batch Endpoint'), true);
assert.equal(hasFallbackPricing('Bot Service'), false);
assert.equal(getDefaultTier('MySQL'), 'Standard_B2ms2');
assert.equal(getDefaultTier('Custom Vision'), 'S0');
assert.equal(getDefaultTier('VM Scale Sets'), getDefaultTier('Virtual Machines'));
assert.equal(getFallbackPricing('Active Directory'), getFallbackPricing('Microsoft Entra ID'));

assert.deepEqual(
  calculateNodeMonthlyCost('Virtual Machine', pricing(), 'payg'),
  { cost: 200, source: 'retail-payg' },
);
assert.deepEqual(
  calculateNodeMonthlyCost('Virtual Machine', pricing({ paygSource: 'static-fallback' }), 'payg'),
  { cost: 200, source: 'static-payg' },
);
assert.deepEqual(
  calculateNodeMonthlyCost('Virtual Machine', pricing({ isCustom: true, paygSource: 'custom' }), 'payg'),
  { cost: 200, source: 'custom' },
);
assert.deepEqual(
  calculateNodeMonthlyCost('Virtual Machine', pricing({ reserved1yrCost: 60 }), 'reserved1yr'),
  { cost: 120, source: 'real-savings-plan' },
);
assert.deepEqual(
  calculateNodeMonthlyCost('Virtual Machine', pricing(), 'reserved1yr'),
  { cost: 200, source: 'payg-unchanged-no-offer' },
);
assert.deepEqual(
  calculateNodeMonthlyCost('Storage', pricing({ isUsageBased: true }), 'reserved1yr'),
  { cost: 200, source: 'payg-unchanged-usage' },
);
assert.deepEqual(
  calculateNodeMonthlyCost('Service without one-year offer', pricing(), 'reserved1yr'),
  { cost: 200, source: 'payg-unchanged-no-offer' },
);
assert.deepEqual(
  calculateNodeMonthlyCost(
    'Virtual Machine',
    pricing({ isCustom: true, paygSource: 'custom', reserved1yrCost: 1 }),
    'reserved1yr',
  ),
  { cost: 200, source: 'custom-unchanged' },
);

// Tier selection demotes a meter that only shadows another with an " Instance"
// or " - Free" suffix. Redis and Load Balancer need it; Key Vault, Backup, and
// standalone free SKUs price the resource that way.
const meterNames = (file: string, sku: string): string[] => {
  const items = JSON.parse(
    readFileSync(`src/data/pricing/regions/eastus2/${file}.json`, 'utf8'),
  ).Items ?? [];
  return items
    .filter((item: any) => (item.skuName || item.armSkuName) === sku)
    .map((item: any) => String(item.meterName || '').trim());
};
const shadowsBase = (names: string[]) =>
  names.some((name) => {
    const base = name.replace(/(\s+Instance|\s+-\s+Free)$/i, '');
    return base !== name && names.includes(base);
  });

assert.equal(shadowsBase(meterNames('redis_cache', 'C1')), true, 'Redis C1 should expose both "C1 Cache" and "C1 Cache Instance"');
assert.equal(shadowsBase(meterNames('load_balancer', 'Standard')), true, 'Load Balancer Standard should expose a promotional "- Free" meter');
assert.equal(shadowsBase(meterNames('key_vault', 'Standard')), false, 'Key Vault Standard Instance must stay the resource meter');
assert.equal(shadowsBase(meterNames('backup', 'Azure Blob')), false, 'Azure Backup Protected Instance must stay the resource meter');
assert.equal(
  shadowsBase(meterNames('azure_database_for_postgresql', 'Compute - Free')),
  false,
  'a standalone free SKU has no priced sibling and must keep its own meter',
);

console.log('Pricing-mode calculator contracts passed.');