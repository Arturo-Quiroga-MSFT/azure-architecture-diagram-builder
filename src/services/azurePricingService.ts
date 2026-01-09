/**
 * Azure Pricing Service
 * Fetches pricing data from Azure Retail Prices API with intelligent caching
 * API Docs: https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices
 */

import { 
  AzureRetailPricesResponse, 
  ServicePricing, 
  PricingTier,
  CachedPricing,
  PricingQueryParams
} from '../types/pricing';
import { 
  getRegionalServicePricing, 
  preloadCommonServices as preloadRegionalServices,
  getActiveRegion,
  AzureRegion
} from './regionalPricingService';

const AZURE_PRICING_API = 'https://prices.azure.com/api/retail/prices';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const REQUEST_DELAY = 100; // Delay between requests to avoid rate limiting

// In-memory cache
const pricingCache = new Map<string, CachedPricing>();

// Request queue to avoid rate limiting
let lastRequestTime = 0;

/**
 * Sleep helper for request throttling
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate cache key from query parameters
 */
function getCacheKey(serviceName: string, region: string = 'eastus'): string {
  return `${serviceName}_${region}`.toLowerCase();
}

/**
 * Check if cached data is still valid
 */
function isCacheValid(cached: CachedPricing): boolean {
  return Date.now() < cached.expiresAt;
}

/**
 * Fetch pricing data from Azure Retail Prices API
 */
async function fetchFromAPI(params: PricingQueryParams): Promise<AzureRetailPricesResponse> {
  // Throttle requests
  const timeSinceLastRequest = Date.now() - lastRequestTime;
  if (timeSinceLastRequest < REQUEST_DELAY) {
    await sleep(REQUEST_DELAY - timeSinceLastRequest);
  }
  lastRequestTime = Date.now();

  // Build query string
  const queryParams = new URLSearchParams();
  queryParams.append('currencyCode', params.currencyCode || 'USD');
  
  if (params.filter) {
    queryParams.append('$filter', params.filter);
  }

  const url = `${AZURE_PRICING_API}?${queryParams.toString()}`;
  
  console.log('Fetching Azure pricing:', url);

  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Azure Pricing API error: ${response.status} ${response.statusText}`);
  }

  const data: AzureRetailPricesResponse = await response.json();
  return data;
}

/**
 * Build OData filter for API query
 */
function buildServiceFilter(serviceName: string, region?: string): string {
  const filters: string[] = [];
  
  // Service name filter
  filters.push(`serviceName eq '${serviceName}'`);
  
  // Region filter (if specified)
  if (region) {
    filters.push(`armRegionName eq '${region}'`);
  } else {
    // Default to East US
    filters.push(`armRegionName eq 'eastus'`);
  }
  
  // Only consumption-based pricing (not reservations or spot)
  filters.push(`priceType eq 'Consumption'`);
  
  return filters.join(' and ');
}

/**
 * Parse API response into ServicePricing structure
 */
function parseServicePricing(
  serviceType: string,
  apiResponse: AzureRetailPricesResponse
): ServicePricing | null {
  if (!apiResponse.Items || apiResponse.Items.length === 0) {
    console.warn(`No pricing data found for ${serviceType}`);
    return null;
  }

  const items = apiResponse.Items;
  const firstItem = items[0];
  
  // Group by SKU and calculate monthly prices
  const tierMap = new Map<string, PricingTier>();
  
  items.forEach(item => {
    const skuName = item.skuName || item.armSkuName;
    if (!skuName) return;
    
    // Calculate monthly price from hourly rate
    const hourlyPrice = item.retailPrice;
    const monthlyPrice = hourlyPrice * 730; // Average hours per month
    
    if (!tierMap.has(skuName)) {
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

  // Convert map to array and sort by price
  const tiers = Array.from(tierMap.values())
    .sort((a, b) => a.monthlyPrice - b.monthlyPrice);

  // Determine default tier (middle tier if available, or first tier)
  const defaultTier = tiers.length > 1 ? tiers[Math.floor(tiers.length / 2)].name : tiers[0]?.name || 'Standard';

  return {
    serviceType,
    serviceName: firstItem.serviceName,
    defaultTier,
    tiers,
    calculationType: 'hourly',
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Get pricing for a specific Azure service
 */
export async function getServicePricing(
  serviceType: string,
  serviceName: string,
  region?: string
): Promise<ServicePricing | null> {
  const targetRegion = (region || getActiveRegion()) as AzureRegion;
  const cacheKey = getCacheKey(serviceName, targetRegion);
  
  // Check cache first
  const cached = pricingCache.get(cacheKey);
  if (cached && isCacheValid(cached)) {
    console.log(`💾 Using cached pricing for ${serviceType}`);
    return cached.data;
  }

  // Use regional pricing data
  console.log(`📊 Getting pricing from regional data for ${serviceType} in ${targetRegion}`);
  const pricing = await getRegionalServicePricing(serviceName, targetRegion);
  
  if (pricing) {
    // Add serviceType to pricing object
    const enhancedPricing = { ...pricing, serviceType };
    
    // Cache the result
    pricingCache.set(cacheKey, {
      data: enhancedPricing,
      timestamp: Date.now(),
      expiresAt: Date.now() + CACHE_DURATION
    });
    console.log(`✅ Found ${pricing.tiers.length} pricing tiers for ${serviceType} in ${targetRegion}`);
    return enhancedPricing;
  } else {
    console.warn(`⚠️ No regional pricing data found for ${serviceType} (${serviceName}) in ${targetRegion}`);
  }
  
  return pricing;
}

/**
 * Get pricing for multiple services (batch operation)
 */
export async function getBatchServicePricing(
  services: Array<{ serviceType: string; serviceName: string }>,
  region: string = 'eastus'
): Promise<Map<string, ServicePricing | null>> {
  const results = new Map<string, ServicePricing | null>();
  
  // Process sequentially to avoid rate limiting
  for (const service of services) {
    const pricing = await getServicePricing(service.serviceType, service.serviceName, region);
    results.set(service.serviceType, pricing);
  }
  
  return results;
}

/**
 * Clear pricing cache
 */
export function clearPricingCache(): void {
  pricingCache.clear();
  console.log('Pricing cache cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; entries: string[] } {
  return {
    size: pricingCache.size,
    entries: Array.from(pricingCache.keys())
  };
}

/**
 * Prefetch pricing for common services
 */
export async function prefetchCommonServices(region?: string): Promise<void> {
  const targetRegion = (region || getActiveRegion()) as AzureRegion;
  console.log(`📦 Preloading Azure pricing data for ${targetRegion}...`);
  await preloadRegionalServices(targetRegion);
}

/**
 * Get estimated monthly cost for a service
 */
export function calculateMonthlyCost(
  pricing: ServicePricing,
  tier: string,
  quantity: number = 1
): number {
  const selectedTier = pricing.tiers.find(t => t.skuName === tier || t.name === tier);
  
  if (!selectedTier) {
    console.warn(`Tier ${tier} not found for ${pricing.serviceType}, using default`);
    const defaultTier = pricing.tiers.find(t => t.name === pricing.defaultTier);
    return (defaultTier?.monthlyPrice || 0) * quantity;
  }
  
  return selectedTier.monthlyPrice * quantity;
}
