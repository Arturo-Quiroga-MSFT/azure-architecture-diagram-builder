/**
 * Regional Pricing Service
 * Manages loading and querying pricing data for different Azure regions
 */

import { AzureRetailPrice, ServicePricing, PricingTier } from '../types/pricing';

export type AzureRegion = 'eastus2' | 'swedencentral' | 'westeurope' | 'canadacentral' | 'brazilsouth';

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
  { id: 'eastus2', displayName: 'East US 2', location: 'Virginia', flag: '🇺🇸', regionType: 'HERO', geography: 'United States' },
  { id: 'canadacentral', displayName: 'Canada Central', location: 'Toronto', flag: '🇨🇦', regionType: 'HUB', geography: 'Canada' },
  { id: 'brazilsouth', displayName: 'Brazil South', location: 'São Paulo', flag: '🇧🇷', regionType: 'HUB', geography: 'Brazil' },
  { id: 'westeurope', displayName: 'West Europe', location: 'Netherlands', flag: '🇳🇱', regionType: 'HUB', geography: 'Europe' },
  { id: 'swedencentral', displayName: 'Sweden Central', location: 'Gävle', flag: '🇸🇪', regionType: 'HUB', geography: 'Europe' },
];

interface RegionalPricingData {
  BillingCurrency: string;
  Items: AzureRetailPrice[];
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
  'Custom Vision': { file: 'foundry_tools', productName: 'Azure Custom Vision', defaultSku: 'Standard' },
  'Content Safety': { file: 'foundry_tools', productName: 'Content Safety', defaultSku: 'Standard' },
};

/**
 * Check if a service is an AI service that needs Foundry data
 */
function isAIService(serviceName: string): boolean {
  return AI_SERVICE_PRODUCT_MAP.hasOwnProperty(serviceName);
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
      const module = await import(/* @vite-ignore */ path);
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
    
    // Dynamically import the JSON file
    const module = await import(/* @vite-ignore */ path);
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
    'Azure Cognitive Search',
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
  
  items.forEach(item => {
    const skuName = item.skuName || item.armSkuName;
    if (!skuName) return;
    
    // Handle different billing units for AI services
    const unitOfMeasure = (item as any).unitOfMeasure || '1 Hour';
    const hourlyPrice = item.retailPrice || item.unitPrice;
    let monthlyPrice: number;
    
    // Calculate monthly price based on unit of measure
    if (unitOfMeasure.includes('/Month') || unitOfMeasure.includes('1/Month')) {
      // Already monthly pricing (commitment tiers)
      monthlyPrice = hourlyPrice;
    } else if (unitOfMeasure.includes('/Day') || unitOfMeasure.includes('1/Day')) {
      // Daily pricing (multiply by 30)
      monthlyPrice = hourlyPrice * 30;
    } else if (unitOfMeasure === '1K' || unitOfMeasure.includes('1000')) {
      // Per-1K pricing (estimate 100K transactions/month for typical usage)
      monthlyPrice = hourlyPrice * 100;
    } else {
      // Default to hourly (730 hours average per month)
      monthlyPrice = hourlyPrice * 730;
    }
    
    // Only add if we don't have this SKU yet, or if this is cheaper
    if (!tierMap.has(skuName) || tierMap.get(skuName)!.monthlyPrice > monthlyPrice) {
      tierMap.set(skuName, {
        name: skuName,
        skuName: skuName,
        monthlyPrice: monthlyPrice,
        hourlyPrice: hourlyPrice,
        unit: item.unitOfMeasure,
        description: item.meterName
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
  
  // Load service data for the region
  const data = await loadServiceData(targetRegion, serviceName);
  
  if (!data || data.Items.length === 0) {
    console.warn(`⚠️ No regional pricing data found for ${serviceName} in ${targetRegion}`);
    return null;
  }
  
  // Filter and parse the items
  const filteredItems = filterPricingItems(data.Items, serviceName);
  
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
