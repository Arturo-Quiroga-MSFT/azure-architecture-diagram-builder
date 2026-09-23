// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Azure Pricing Service
 * Fetches pricing data from Azure Retail Prices API with intelligent caching
 * API Docs: https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices
 */

import { 
  ServicePricing, 
  CachedPricing
} from '../types/pricing';
import { 
  getRegionalServicePricing, 
  preloadCommonServices as preloadRegionalServices,
  getActiveRegion,
  AzureRegion
} from './regionalPricingService';

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// In-memory cache
const pricingCache = new Map<string, CachedPricing>();

/**
 * Generate cache key from query parameters
 */
function getCacheKey(serviceName: string, region?: string): string {
  const targetRegion = region || getActiveRegion();
  return `${serviceName}_${targetRegion}`.toLowerCase();
}

/**
 * Check if cached data is still valid
 */
function isCacheValid(cached: CachedPricing): boolean {
  return Date.now() < cached.expiresAt;
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
  region?: string
): Promise<Map<string, ServicePricing | null>> {
  const targetRegion = region || getActiveRegion();
  const results = new Map<string, ServicePricing | null>();
  
  // Process sequentially to avoid rate limiting
  for (const service of services) {
    const pricing = await getServicePricing(service.serviceType, service.serviceName, targetRegion);
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
