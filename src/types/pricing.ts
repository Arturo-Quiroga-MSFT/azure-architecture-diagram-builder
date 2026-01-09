/**
 * Azure Pricing Types
 * Based on Azure Retail Prices API
 * https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices
 */

/**
 * Response from Azure Retail Prices API
 */
export interface AzureRetailPricesResponse {
  BillingCurrency: string;
  CustomerEntityId: string;
  CustomerEntityType: string;
  Items: AzureRetailPrice[];
  NextPageLink: string | null;
  Count: number;
}

/**
 * Individual price item from Azure Retail Prices API
 */
export interface AzureRetailPrice {
  currencyCode: string;
  tierMinimumUnits: number;
  retailPrice: number;
  unitPrice: number;
  armRegionName: string;
  location: string;
  effectiveStartDate: string;
  meterId: string;
  meterName: string;
  productId: string;
  skuId: string;
  productName: string;
  skuName: string;
  serviceName: string;
  serviceId: string;
  serviceFamily: string;
  unitOfMeasure: string;
  type: string;
  isPrimaryMeterRegion: boolean;
  armSkuName: string;
}

/**
 * Simplified pricing tier for our application
 */
export interface PricingTier {
  name: string;           // e.g., "B1 (Basic)", "S1 (Standard)", "P1V2 (Premium)"
  skuName: string;        // e.g., "B1", "S1", "P1V2"
  monthlyPrice: number;   // Estimated monthly cost in USD
  hourlyPrice?: number;   // Hourly rate if available
  unit: string;           // e.g., "per instance", "per GB", "per hour"
  description?: string;   // Brief description of tier
}

/**
 * Service pricing information
 */
export interface ServicePricing {
  serviceType: string;                    // e.g., "App Service", "Cosmos DB"
  serviceName: string;                    // Azure service name from API
  defaultTier: string;                    // Default tier to use (e.g., "Standard")
  tiers: PricingTier[];                   // Available tiers
  calculationType: 'hourly' | 'monthly' | 'usage'; // How to calculate cost
  sourceUrl?: string;                     // Link to official pricing page
  lastUpdated: string;                    // ISO timestamp
}

/**
 * Pricing configuration stored in node data
 */
export interface NodePricingConfig {
  estimatedCost: number;      // Monthly cost in USD
  tier: string;               // Selected tier name
  skuName: string;            // SKU identifier
  quantity: number;           // Number of instances/units
  region: string;             // Azure region
  unit: string;               // Unit of measurement
  lastUpdated: string;        // ISO timestamp
  isCustom: boolean;          // Whether user manually set price
  customPrice?: number;       // Custom monthly price if set
  usageEstimate?: {           // For usage-based services
    type: 'light' | 'medium' | 'heavy';
    description: string;
  };
}

/**
 * Regional pricing multiplier
 */
export interface RegionPricing {
  region: string;
  displayName: string;
  armRegionName: string;
  multiplier: number;
}

/**
 * Cost breakdown for estimation panel
 */
export interface CostBreakdown {
  totalMonthlyCost: number;
  byService: {
    serviceName: string;
    serviceType: string;
    nodeId: string;
    cost: number;
    quantity: number;
    tier: string;
  }[];
  byGroup: {
    groupId: string;
    groupLabel: string;
    cost: number;
    serviceCount: number;
  }[];
  byCategory: {
    category: string;
    cost: number;
    percentage: number;
  }[];
  region: string;
  currency: string;
  lastCalculated: string;
}

/**
 * Cached pricing data
 */
export interface CachedPricing {
  data: ServicePricing;
  timestamp: number;
  expiresAt: number;
}

/**
 * API query parameters
 */
export interface PricingQueryParams {
  serviceName?: string;
  armRegionName?: string;
  currencyCode?: string;
  filter?: string;
}
