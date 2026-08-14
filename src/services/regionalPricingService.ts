// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Regional Pricing Service
 * Manages loading and querying pricing data for different Azure regions
 */

import { AzureRetailPrice, ServicePricing, PricingTier } from '../types/pricing';

export type AzureRegion = 'eastus2' | 'swedencentral' | 'westeurope' | 'canadacentral' | 'brazilsouth' | 'australiaeast' | 'southeastasia' | 'mexicocentral';

export type RegionType = 'HERO' | 'HUB' | 'SATELLITE' | 'MICRO';

export interface RegionInfo {
  id: AzureRegion;
  displayName: string;
  location: string;
  flag: string;
  regionType: RegionType;
  geography: string;
}

export const AVAILABLE_REGIONS: RegionInfo[] = [
  { id: 'eastus2',       displayName: 'East US 2',        location: 'Virginia',    flag: '🇺🇸', regionType: 'HERO', geography: 'United States' },
  { id: 'australiaeast', displayName: 'Australia East',   location: 'Sydney',      flag: '🇦🇺', regionType: 'HERO', geography: 'Australia' },
  { id: 'canadacentral', displayName: 'Canada Central',   location: 'Toronto',     flag: '🇨🇦', regionType: 'HUB',  geography: 'Canada' },
  { id: 'brazilsouth',   displayName: 'Brazil South',     location: 'São Paulo',   flag: '🇧🇷', regionType: 'HUB',  geography: 'Brazil' },
  { id: 'mexicocentral', displayName: 'Mexico Central',   location: 'Querétaro',   flag: '🇲🇽', regionType: 'HUB',  geography: 'Mexico' },
  { id: 'westeurope',    displayName: 'West Europe',      location: 'Netherlands', flag: '🇳🇱', regionType: 'HUB',  geography: 'Europe' },
  { id: 'swedencentral', displayName: 'Sweden Central',   location: 'Gävle',       flag: '🇸🇪', regionType: 'HUB',  geography: 'Europe' },
  { id: 'southeastasia', displayName: 'Southeast Asia',   location: 'Singapore',   flag: '🇸🇬', regionType: 'HUB',  geography: 'Asia Pacific' },
];

interface RegionalPricingData {
  BillingCurrency: string;
  Items: AzureRetailPrice[];
}

// Statically bundle every regional pricing JSON so the data is available in the
// production build. A plain `import(path)` with /* @vite-ignore */ is NOT
// bundled, so in production it 404s to index.html (text/html) and fails the
// strict module-script MIME check. `import.meta.glob` lets Vite create lazy
// chunks for each file that resolve correctly in both dev and production.
const pricingModules = import.meta.glob<{ default: RegionalPricingData }>(
  '/src/data/pricing/regions/*/*.json'
);

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
  const loader = pricingModules[path];
  if (!loader) {
    console.warn(`⚠️ No Fabric pricing data bundled at ${path}`);
    return null;
  }
  const data = (await loader()).default as RegionalPricingData;

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
      const loader = pricingModules[path];
      if (!loader) {
        console.warn(`⚠️ No pricing data bundled at ${path}`);
        return null;
      }
      const module = await loader();
      const fullData = module.default as RegionalPricingData;
      
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
    const loader = pricingModules[path];
    if (!loader) {
      console.warn(`⚠️ No pricing data bundled at ${path}`);
      return null;
    }
    const module = await loader();
    const data = module.default as RegionalPricingData;
    
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

/**
 * Parse pricing items into tiers
 */
function parsePricingTiers(items: AzureRetailPrice[]): PricingTier[] {
  const tierMap = new Map<string, PricingTier>();

  // Convert a per-unit rate into a monthly cost given the meter's unit-of-measure.
  const toMonthly = (rate: number, unitOfMeasure: string): number => {
    if (unitOfMeasure.includes('/Month') || unitOfMeasure.includes('1/Month')) return rate;
    if (unitOfMeasure.includes('/Day') || unitOfMeasure.includes('1/Day')) return rate * 30;
    if (unitOfMeasure === '1K' || unitOfMeasure.includes('1000')) return rate * 100;
    return rate * 730; // default: hourly × 730 hours/month
  };

  items.forEach(item => {
    const skuName = item.skuName || item.armSkuName;
    if (!skuName) return;
    if (/spot|low priority/i.test(`${skuName} ${item.meterName || ''}`)) return;
    
    // Handle different billing units for AI services
    const unitOfMeasure = (item as any).unitOfMeasure || '1 Hour';
    const hourlyPrice = item.retailPrice || item.unitPrice;
    const monthlyPrice = toMonthly(hourlyPrice, unitOfMeasure);

    // Real 1-year Savings Plan monthly, when the meter carries a savings-plan rate.
    let reserved1yrMonthly: number | undefined;
    const oneYear = Array.isArray(item.savingsPlan)
      ? item.savingsPlan.find(p => /1\s*year/i.test(p.term || ''))
      : undefined;
    if (oneYear) {
      const spRate = oneYear.retailPrice || oneYear.unitPrice;
      if (spRate > 0) reserved1yrMonthly = toMonthly(spRate, unitOfMeasure);
    }

    // Only add if we don't have this SKU yet, or if this is cheaper
    if (!tierMap.has(skuName) || tierMap.get(skuName)!.monthlyPrice > monthlyPrice) {
      tierMap.set(skuName, {
        name: skuName,
        skuName: skuName,
        monthlyPrice: monthlyPrice,
        hourlyPrice: hourlyPrice,
        unit: item.unitOfMeasure,
        description: item.meterName,
        reserved1yrMonthly
      });
    }
  });
  
  const tiers = Array.from(tierMap.values()).sort((a, b) => a.monthlyPrice - b.monthlyPrice);
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
