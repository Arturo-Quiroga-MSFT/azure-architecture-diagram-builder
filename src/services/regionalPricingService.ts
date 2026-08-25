// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Regional Pricing Service
 * Manages loading and querying pricing data for different Azure regions
 */

import { AzureRetailPrice, ServicePricing, PricingTier } from '../types/pricing';
import { AVAILABLE_REGIONS, type AzureRegion, type RegionInfo } from '../data/pricingRegions';

export { AVAILABLE_REGIONS };
export type { AzureRegion, RegionInfo };

interface RegionalPricingData {
  BillingCurrency: string;
  Items: AzureRetailPrice[];
}

// Emit every regional JSON file as a static URL asset. Importing JSON as parsed
// modules made Vite parse/minify 1,120 large files and exceeded the ACR build
// container's memory. URL assets preserve production-safe hashed paths while
// keeping the pricing corpus out of the JavaScript module graph.
const pricingAssets = import.meta.glob<string>(
  '/src/data/pricing/regions/*/*.json',
  { query: '?url', import: 'default' },
);

async function loadPricingAsset(path: string): Promise<RegionalPricingData | null> {
  const loader = pricingAssets[path];
  if (!loader) return null;
  const assetUrl = await loader();
  const response = await fetch(assetUrl);
  if (!response.ok) throw new Error(`Pricing asset request failed (${response.status}): ${path}`);
  return await response.json() as RegionalPricingData;
}

// Cache for loaded regional data
const regionalDataCache = new Map<AzureRegion, Map<string, RegionalPricingData>>();

// Cache for parsed service pricing
const parsedPricingCache = new Map<string, ServicePricing>();

// Current active region
let currentRegion: AzureRegion = 'eastus2';

/**
 * Map AI service display names to Foundry productNames
 */
const AI_SERVICE_PRODUCT_MAP: Record<string, { file: string; productName: string; defaultSku?: string }> = {
  'Azure OpenAI': { file: 'foundry_models', productName: 'Azure OpenAI', defaultSku: 'gpt4omini' },
  'OpenAI': { file: 'foundry_models', productName: 'Azure OpenAI', defaultSku: 'gpt4omini' },
  'Azure AI Document Intelligence': { file: 'foundry_tools', productName: 'Azure Document Intelligence', defaultSku: 'Standard' },
  'Azure Document Intelligence': { file: 'foundry_tools', productName: 'Azure Document Intelligence', defaultSku: 'Standard' },
  'Document Intelligence': { file: 'foundry_tools', productName: 'Azure Document Intelligence', defaultSku: 'Standard' },
  'Form Recognizer': { file: 'foundry_tools', productName: 'Form Recognizer', defaultSku: 'Standard' },
  'Language': { file: 'foundry_tools', productName: 'Azure Language', defaultSku: 'Standard' },
  'Text Analytics': { file: 'foundry_tools', productName: 'Azure Language', defaultSku: 'Standard' },
  'Speech': { file: 'foundry_tools', productName: 'Azure Speech', defaultSku: 'Standard' },
  'Speech Services': { file: 'foundry_tools', productName: 'Azure Speech', defaultSku: 'Standard' },
  'Vision': { file: 'foundry_tools', productName: 'Azure Vision', defaultSku: 'Standard' },
  'Computer Vision': { file: 'foundry_tools', productName: 'Azure Vision', defaultSku: 'Standard' },
  'Face': { file: 'foundry_tools', productName: 'Azure Vision - Face', defaultSku: 'Standard' },
  'Translator': { file: 'foundry_tools', productName: 'Azure Translator', defaultSku: 'Standard' },
  'Custom Vision': { file: 'foundry_tools', productName: 'Azure Custom Vision', defaultSku: 'S0' },
  'Content Safety': { file: 'foundry_tools', productName: 'Content Safety', defaultSku: 'Standard' },
};

/**
 * Check if a service is an AI service that needs Foundry data
 */
function isAIService(serviceName: string): boolean {
  return AI_SERVICE_PRODUCT_MAP.hasOwnProperty(serviceName);
}

// ── Microsoft Fabric (region-aware) ─────────────────────────────────────────
// Fabric is licensed by Capacity (F-SKUs) and OneLake storage is billed per GB.
// Both vary slightly by region, so we read the true per-region rates from the
// fetched microsoft_fabric.json instead of the static fallback ladder.

function isFabricCapacityService(name: string): boolean {
  return name === 'Microsoft Fabric Capacity';
}

function isOneLakeService(name: string): boolean {
  return name === 'OneLake' || name === 'OneLake Storage';
}

/** Most common value in a list (mode), or a default when empty. */
function modeOrDefault(values: number[], fallback: number): number {
  if (values.length === 0) return fallback;
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  let best = fallback;
  let bestCount = -1;
  for (const [v, c] of counts) {
    if (c > bestCount) { bestCount = c; best = v; }
  }
  return best;
}

/**
 * Build per-region Fabric pricing from the fetched microsoft_fabric.json.
 * - Capacity: F-SKU monthly = (per-CU-hour rate) × CUs × 730 hours.
 *   The per-CU-hour rate is the mode of the "Capacity Usage CU" consumption
 *   meters (≈ $0.18, with small regional variance).
 * - OneLake: uses the "OneLake Storage Hot Data Stored" per-GB meter.
 */
async function getFabricRegionalPricing(
  serviceName: string,
  region: AzureRegion
): Promise<ServicePricing | null> {
  const path = `/src/data/pricing/regions/${region}/microsoft_fabric.json`;
  const data = await loadPricingAsset(path);
  if (!data) {
    console.warn(`⚠️ No Fabric pricing data bundled at ${path}`);
    return null;
  }

  if (isFabricCapacityService(serviceName)) {
    const rates = data.Items
      .filter(i => i.type === 'Consumption'
        && (i as any).unitOfMeasure === '1 Hour'
        && /Capacity Usage CU/i.test(i.meterName))
      .map(i => i.retailPrice || i.unitPrice)
      .filter(r => r > 0);
    const rate = modeOrDefault(rates, 0.18);
    const skus: Array<[string, number]> = [['F2', 2], ['F8', 8], ['F64', 64]];
    const tiers: PricingTier[] = skus.map(([name, cu]) => ({
      name,
      skuName: name,
      monthlyPrice: parseFloat((rate * cu * 730).toFixed(2)),
      hourlyPrice: parseFloat((rate * cu).toFixed(4)),
      unit: 'per capacity/month',
      description: `${name} — ${cu} CU @ $${rate}/CU-hour (${region})`
    }));
    return {
      serviceType: serviceName,
      serviceName,
      defaultTier: 'F2',
      tiers,
      calculationType: 'hourly',
      lastUpdated: new Date().toISOString(),
    };
  }

  if (isOneLakeService(serviceName)) {
    const hot = data.Items.find(i =>
      i.type === 'Consumption' && /OneLake Storage Hot Data Stored/i.test(i.meterName));
    const perGB = (hot?.retailPrice ?? hot?.unitPrice) || 0.023;
    const sizes: Array<[string, number]> = [['~200 GB', 200], ['~1 TB', 1000], ['~10 TB', 10000]];
    const tiers: PricingTier[] = sizes.map(([name, gb]) => ({
      name,
      skuName: name,
      monthlyPrice: parseFloat((perGB * gb).toFixed(2)),
      hourlyPrice: perGB,
      unit: 'per month (storage)',
      description: `${gb} GB Hot @ $${perGB}/GB (${region})`
    }));
    return {
      serviceType: serviceName,
      serviceName,
      defaultTier: '~1 TB',
      tiers,
      calculationType: 'usage',
      lastUpdated: new Date().toISOString(),
    };
  }

  return null;
}

/**
 * Set the active region for pricing queries
 */
export function setActiveRegion(region: AzureRegion): void {
  console.log(`🌍 Switching pricing region to: ${region}`);
  currentRegion = region;
  // Clear parsed pricing cache when region changes
  parsedPricingCache.clear();
}

/**
 * Get the current active region
 */
export function getActiveRegion(): AzureRegion {
  return currentRegion;
}

/**
 * Get region display info
 */
export function getRegionInfo(region: AzureRegion): RegionInfo | undefined {
  return AVAILABLE_REGIONS.find(r => r.id === region);
}

/**
 * Load pricing data for a specific service in a region
 */
async function loadServiceData(region: AzureRegion, serviceName: string): Promise<RegionalPricingData | null> {
  // Check cache first
  if (regionalDataCache.has(region)) {
    const regionCache = regionalDataCache.get(region)!;
    if (regionCache.has(serviceName)) {
      return regionCache.get(serviceName)!;
    }
  }

  try {
    // Check if this is an AI service that needs Foundry data
    if (isAIService(serviceName)) {
      const aiMapping = AI_SERVICE_PRODUCT_MAP[serviceName];
      console.log(`🤖 AI Service detected: ${serviceName} → Loading from ${aiMapping.file}, filtering by productName: ${aiMapping.productName}`);
      
      // Load the Foundry file
      const path = `/src/data/pricing/regions/${region}/${aiMapping.file}.json`;
      const fullData = await loadPricingAsset(path);
      if (!fullData) {
        console.warn(`⚠️ No pricing data bundled at ${path}`);
        return null;
      }
      
      // Filter items by productName
      const filteredItems = fullData.Items.filter(item => 
        (item as any).productName === aiMapping.productName
      );
      
      const filteredData: RegionalPricingData = {
        BillingCurrency: fullData.BillingCurrency,
        Items: filteredItems
      };
      
      // Cache the filtered data
      if (!regionalDataCache.has(region)) {
        regionalDataCache.set(region, new Map());
      }
      regionalDataCache.get(region)!.set(serviceName, filteredData);
      
      console.log(`📦 Loaded AI service ${serviceName} for ${region}: ${filteredItems.length} items (filtered from ${fullData.Items.length})`);
      return filteredData;
    }
    
    // Regular service - load by filename
    const filename = serviceName.toLowerCase().replace(/\s+/g, '_');
    const path = `/src/data/pricing/regions/${region}/${filename}.json`;
    
    // Look up the statically bundled module for this file
    const data = await loadPricingAsset(path);
    if (!data) {
      console.warn(`⚠️ No pricing data bundled at ${path}`);
      return null;
    }
    
    // Cache the data
    if (!regionalDataCache.has(region)) {
      regionalDataCache.set(region, new Map());
    }
    regionalDataCache.get(region)!.set(serviceName, data);
    
    console.log(`📦 Loaded ${serviceName} pricing for ${region}: ${data.Items.length} items`);
    return data;
  } catch (error) {
    console.warn(`⚠️ Failed to load ${serviceName} pricing for ${region}:`, error);
    return null;
  }
}

/**
 * Get available services for a region by checking which files exist
 */
export function getAvailableServices(_region: AzureRegion): string[] {
  // These are the services we have data for
  return [
    'Azure App Service',
    'Virtual Machines',
    'Azure Cosmos DB',
    'Storage',
    'SQL Database',
    'Azure Kubernetes Service',
    'Container Instances',
    'Application Gateway',
    'Azure Machine Learning',
    'Azure AI Search',
  ];
}

/**
 * Filter pricing items by service and region
 */
function filterPricingItems(
  items: AzureRetailPrice[],
  serviceName: string,
  consumptionOnly: boolean = true
): AzureRetailPrice[] {
  const filtered = items.filter(item => {
    // Match service name (case insensitive)
    const matches = item.serviceName.toLowerCase() === serviceName.toLowerCase();
    if (!matches) return false;
    
    // Only consumption pricing (not reservations or spot)
    if (consumptionOnly && item.type !== 'Consumption') return false;
    
    return true;
  });
  
  console.log(`🔍 Filtered ${filtered.length} items for ${serviceName} from ${items.length} total`);
  return filtered;
}

// The Retail API does not mark which of a SKU's meters prices the resource
// itself, and it is rarely the cheapest one, so "cheapest wins" picked add-ons:
// Azure Firewall Standard billed $0.016/GB data processed rather than its
// $1.25/hr deployment. Meters are ranked by what their name says they bill.
const BASE_RESOURCE_METER = /\b(base fees?|deployment|instance|fixed cost|units?)\b/i;
const USAGE_ADDER_METER = /capacity unit|data (processed|stored|transfer)|\b\d+ device\b|captcha|overage|edge actions/i;

function meterRank(meterName: string): number {
  if (USAGE_ADDER_METER.test(meterName)) return 2;
  if (BASE_RESOURCE_METER.test(meterName)) return 0;
  return 1;
}

// Services whose Retail API file prices adjacent resources only, never the
// resource the node represents. Their catalog cost ranges state a rate rather
// than a monthly amount ($0.03 per 10K operations, $2.30 per GB ingested), so
// the only hourly meters in these files belong to other products entirely --
// Key Vault's are Dedicated HSM, Virtual Network's are Public IP addresses.
const SERVICES_WITHOUT_RESOURCE_METER = new Set<string>([
  'Virtual Network',
  'Key Vault',
  'Azure Monitor',
  'Log Analytics',
  'Network Watcher',
  'Traffic Manager',
]);

/**
 * Parse pricing items into tiers
 */
function parsePricingTiers(items: AzureRetailPrice[]): PricingTier[] {
  const tierMap = new Map<string, PricingTier & { rank: number }>();

  // A meter that only restates another with an " Instance" or " - Free" suffix
  // prices a node or a promotion, not the resource: Redis lists "C1 Cache" and
  // "C1 Cache Instance", Load Balancer lists its Standard rules meter twice.
  const meterNamesBySku = new Map<string, Set<string>>();
  items.forEach(item => {
    const sku = item.skuName || item.armSkuName;
    if (!sku) return;
    const names = meterNamesBySku.get(sku) ?? new Set<string>();
    names.add((item.meterName || '').trim());
    meterNamesBySku.set(sku, names);
  });
  const shadowsBaseMeter = (sku: string, meterName: string): boolean => {
    const name = (meterName || '').trim();
    const base = name.replace(/(\s+Instance|\s+-\s+Free)$/i, '');
    return base !== name && (meterNamesBySku.get(sku)?.has(base) ?? false);
  };

  // Convert a per-unit rate into a monthly cost given the meter's unit-of-measure.
  // Returns null for units that measure consumption rather than elapsed time: a
  // per-GB or per-transaction rate has no monthly value for a deployed resource,
  // and assuming one produces a confidently wrong number.
  const toMonthly = (rate: number, unitOfMeasure: string): number | null => {
    if (unitOfMeasure.includes('/Month') || unitOfMeasure.includes('1/Month')) return rate;
    if (unitOfMeasure.trim() === '1 Month') return rate;
    if (unitOfMeasure.includes('/Day') || unitOfMeasure.includes('1/Day')) return rate * 30;
    if (unitOfMeasure === '1K' || unitOfMeasure.includes('1000')) return rate * 100;
    if (/hour/i.test(unitOfMeasure)) return rate * 730;
    return null;
  };

  items.forEach(item => {
    const skuName = item.skuName || item.armSkuName;
    if (!skuName) return;
    const meterIdentity = `${skuName} ${item.armSkuName || ''} ${item.meterName || ''} ${(item as any).productName || ''}`;
    if (/spot|low priority|secondary|failover|passive/i.test(meterIdentity)) return;
    
    // Handle different billing units for AI services
    const unitOfMeasure = (item as any).unitOfMeasure || '1 Hour';
    const hourlyPrice = item.retailPrice || item.unitPrice;
    const monthlyPrice = toMonthly(hourlyPrice, unitOfMeasure);
    if (monthlyPrice === null) return;

    // Real 1-year Savings Plan monthly, when the meter carries a savings-plan rate.
    let reserved1yrMonthly: number | undefined;
    const oneYear = Array.isArray(item.savingsPlan)
      ? item.savingsPlan.find(p => /1\s*year/i.test(p.term || ''))
      : undefined;
    if (oneYear) {
      const spRate = oneYear.retailPrice || oneYear.unitPrice;
      if (spRate > 0) reserved1yrMonthly = toMonthly(spRate, unitOfMeasure) ?? undefined;
    }

    const rank = shadowsBaseMeter(skuName, item.meterName || '')
      ? 2
      : meterRank(item.meterName || '');
    const existing = tierMap.get(skuName);
    // A resource meter always outranks an add-on; between peers, cheapest wins.
    const isBetter = !existing
      || rank < existing.rank
      || (rank === existing.rank && existing.monthlyPrice > monthlyPrice);

    if (isBetter) {
      tierMap.set(skuName, {
        name: skuName,
        skuName: skuName,
        monthlyPrice: monthlyPrice,
        hourlyPrice: hourlyPrice,
        unit: item.unitOfMeasure,
        description: item.meterName,
        reserved1yrMonthly,
        rank,
      });
    }
  });
  
  const tiers = Array.from(tierMap.values())
    .map(({ rank: _rank, ...tier }) => tier)
    .sort((a, b) => a.monthlyPrice - b.monthlyPrice);
  console.log(`📊 Parsed ${tiers.length} pricing tiers. First few:`, tiers.slice(0, 3).map(t => ({ name: t.name, monthly: t.monthlyPrice })));
  return tiers;
}

/**
 * Get pricing for a service in the current active region
 */
export async function getRegionalServicePricing(
  serviceName: string,
  region?: AzureRegion
): Promise<ServicePricing | null> {
  const targetRegion = region || currentRegion;
  const cacheKey = `${serviceName}-${targetRegion}`;

  // The Retail API groups meters under a service even when none of them price
  // the resource itself: "Virtual Network" carries only Public IP and
  // inter-region transfer meters, because a VNet is free. Any tier built from
  // them describes a different resource, so these fall through to the catalog
  // range instead.
  if (SERVICES_WITHOUT_RESOURCE_METER.has(serviceName)) {
    console.log(`ℹ️ ${serviceName} has no meter for the resource itself; deferring to catalog range`);
    return null;
  }
  
  // Check cache
  if (parsedPricingCache.has(cacheKey)) {
    return parsedPricingCache.get(cacheKey)!;
  }
  
  console.log(`📊 Getting pricing from regional data for ${serviceName} in ${targetRegion}...`);
  
  // Microsoft Fabric is region-aware but parsed specially from microsoft_fabric.json
  if (isFabricCapacityService(serviceName) || isOneLakeService(serviceName)) {
    const fabricPricing = await getFabricRegionalPricing(serviceName, targetRegion);
    if (fabricPricing) {
      parsedPricingCache.set(cacheKey, fabricPricing);
      console.log(`✅ Loaded region-aware Fabric pricing for ${serviceName} in ${targetRegion}`);
      return fabricPricing;
    }
    // fall through to static fallback if the regional file is missing
    return null;
  }
  
  // Load service data for the region
  const data = await loadServiceData(targetRegion, serviceName);
  
  if (!data || data.Items.length === 0) {
    console.warn(`⚠️ No regional pricing data found for ${serviceName} in ${targetRegion}`);
    return null;
  }
  
  // Filter and parse the items
  // AI files were already narrowed by productName in loadServiceData. Their
  // Retail API serviceName remains "Foundry Models" / "Foundry Tools", so a
  // second comparison with display names such as "Azure OpenAI" would discard
  // every valid meter.
  const filteredItems = isAIService(serviceName)
    ? data.Items.filter(item => item.type === 'Consumption')
    : filterPricingItems(data.Items, serviceName);
  
  if (filteredItems.length === 0) {
    console.warn(`⚠️ No consumption pricing items for ${serviceName} in ${targetRegion}`);
    return null;
  }
  
  const tiers = parsePricingTiers(filteredItems);
  
  if (tiers.length === 0) {
    console.warn(`⚠️ No pricing tiers parsed for ${serviceName} in ${targetRegion}`);
    return null;
  }
  
  console.log(`✅ Found ${tiers.length} tiers for ${serviceName} in ${targetRegion}`);
  
  const pricing: ServicePricing = {
    serviceType: serviceName,
    serviceName,
    defaultTier: tiers[0]?.name || 'Standard',
    tiers,
    calculationType: 'hourly',
    lastUpdated: new Date().toISOString(),
  };
  
  // Cache the result
  parsedPricingCache.set(cacheKey, pricing);
  
  return pricing;
}

/**
 * Get pricing summary for the current region
 */
export function getRegionalPricingSummary(region?: AzureRegion): {
  region: AzureRegion;
  servicesLoaded: number;
  totalItems: number;
  cacheSize: number;
} {
  const targetRegion = region || currentRegion;
  const regionCache = regionalDataCache.get(targetRegion);
  
  let totalItems = 0;
  if (regionCache) {
    for (const data of regionCache.values()) {
      totalItems += data.Items.length;
    }
  }
  
  return {
    region: targetRegion,
    servicesLoaded: regionCache?.size || 0,
    totalItems,
    cacheSize: parsedPricingCache.size,
  };
}

/**
 * Preload common services for faster initial pricing
 */
export async function preloadCommonServices(region?: AzureRegion): Promise<void> {
  const targetRegion = region || currentRegion;
  const commonServices = [
    'Azure App Service',
    'Virtual Machines',
    'Storage',
    'SQL Database',
    'Azure Cosmos DB',
  ];
  
  console.log(`⏳ Preloading ${commonServices.length} common services for ${targetRegion}...`);
  
  const promises = commonServices.map(service => loadServiceData(targetRegion, service));
  await Promise.all(promises);
  
  const summary = getRegionalPricingSummary(targetRegion);
  console.log(`✅ Preloaded ${summary.servicesLoaded} services (${summary.totalItems} items) for ${targetRegion}`);
}
