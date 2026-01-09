/**
 * Pricing Helper Utilities
 * Formatters, converters, and region helpers for pricing data
 */

import { RegionPricing } from '../types/pricing';

/**
 * Format currency with proper symbol and decimal places
 */
export function formatCurrency(
  amount: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format currency in compact notation (1.2K, 1.5M, etc.)
 */
export function formatCompactCurrency(
  amount: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  if (amount < 1000) {
    return formatCurrency(amount, currency, locale);
  }
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    notation: 'compact',
    compactDisplay: 'short',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(amount);
}

/**
 * Format monthly cost with /mo suffix
 */
export function formatMonthlyCost(amount: number): string {
  if (amount === 0) {
    return 'Free';
  }
  if (amount < 1) {
    return `$${amount.toFixed(3)}/mo`;
  }
  return `$${amount.toFixed(2)}/mo`;
}

/**
 * Convert hourly rate to monthly cost (730 hours average per month)
 */
export function hourlyToMonthly(hourlyRate: number): number {
  return hourlyRate * 730;
}

/**
 * Convert monthly cost to hourly rate
 */
export function monthlyToHourly(monthlyCost: number): number {
  return monthlyCost / 730;
}

/**
 * Convert annual cost to monthly
 */
export function annualToMonthly(annualCost: number): number {
  return annualCost / 12;
}

/**
 * Calculate percentage of total
 */
export function calculatePercentage(part: number, total: number): number {
  if (total === 0) return 0;
  return (part / total) * 100;
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Azure regions with pricing information
 */
export const AZURE_REGIONS: RegionPricing[] = [
  {
    region: 'eastus',
    displayName: 'East US',
    armRegionName: 'eastus',
    multiplier: 1.0
  },
  {
    region: 'eastus2',
    displayName: 'East US 2',
    armRegionName: 'eastus2',
    multiplier: 1.0
  },
  {
    region: 'westus',
    displayName: 'West US',
    armRegionName: 'westus',
    multiplier: 1.0
  },
  {
    region: 'westus2',
    displayName: 'West US 2',
    armRegionName: 'westus2',
    multiplier: 1.0
  },
  {
    region: 'centralus',
    displayName: 'Central US',
    armRegionName: 'centralus',
    multiplier: 1.0
  },
  {
    region: 'northeurope',
    displayName: 'North Europe',
    armRegionName: 'northeurope',
    multiplier: 1.05
  },
  {
    region: 'westeurope',
    displayName: 'West Europe',
    armRegionName: 'westeurope',
    multiplier: 1.08
  },
  {
    region: 'uksouth',
    displayName: 'UK South',
    armRegionName: 'uksouth',
    multiplier: 1.06
  },
  {
    region: 'ukwest',
    displayName: 'UK West',
    armRegionName: 'ukwest',
    multiplier: 1.06
  },
  {
    region: 'southeastasia',
    displayName: 'Southeast Asia',
    armRegionName: 'southeastasia',
    multiplier: 1.05
  },
  {
    region: 'eastasia',
    displayName: 'East Asia',
    armRegionName: 'eastasia',
    multiplier: 1.10
  },
  {
    region: 'japaneast',
    displayName: 'Japan East',
    armRegionName: 'japaneast',
    multiplier: 1.12
  },
  {
    region: 'japanwest',
    displayName: 'Japan West',
    armRegionName: 'japanwest',
    multiplier: 1.12
  },
  {
    region: 'australiaeast',
    displayName: 'Australia East',
    armRegionName: 'australiaeast',
    multiplier: 1.15
  },
  {
    region: 'australiasoutheast',
    displayName: 'Australia Southeast',
    armRegionName: 'australiasoutheast',
    multiplier: 1.15
  },
  {
    region: 'brazilsouth',
    displayName: 'Brazil South',
    armRegionName: 'brazilsouth',
    multiplier: 1.20
  },
  {
    region: 'canadacentral',
    displayName: 'Canada Central',
    armRegionName: 'canadacentral',
    multiplier: 1.04
  },
  {
    region: 'canadaeast',
    displayName: 'Canada East',
    armRegionName: 'canadaeast',
    multiplier: 1.04
  },
];

/**
 * Get region by ARM region name
 */
export function getRegionByArm(armRegionName: string): RegionPricing | undefined {
  return AZURE_REGIONS.find(r => r.armRegionName === armRegionName);
}

/**
 * Get region display name
 */
export function getRegionDisplayName(armRegionName: string): string {
  const region = getRegionByArm(armRegionName);
  return region?.displayName || armRegionName;
}

/**
 * Get regional multiplier
 */
export function getRegionalMultiplier(armRegionName: string): number {
  const region = getRegionByArm(armRegionName);
  return region?.multiplier || 1.0;
}

/**
 * Apply regional multiplier to price
 */
export function applyRegionalPricing(basePrice: number, region: string): number {
  const multiplier = getRegionalMultiplier(region);
  return basePrice * multiplier;
}

/**
 * Get default region
 */
export function getDefaultRegion(): RegionPricing {
  return AZURE_REGIONS[0]; // East US
}

/**
 * Color coding for cost levels
 */
export function getCostColor(monthlyCost: number): string {
  if (monthlyCost === 0) return '#10b981'; // Green - Free
  if (monthlyCost < 100) return '#10b981'; // Green - Low
  if (monthlyCost < 500) return '#f59e0b'; // Yellow - Medium
  if (monthlyCost < 1000) return '#f97316'; // Orange - High
  return '#ef4444'; // Red - Very High
}

/**
 * Get cost level label
 */
export function getCostLevel(monthlyCost: number): string {
  if (monthlyCost === 0) return 'Free';
  if (monthlyCost < 100) return 'Low';
  if (monthlyCost < 500) return 'Medium';
  if (monthlyCost < 1000) return 'High';
  return 'Very High';
}

/**
 * Sort services by cost
 */
export function sortByCost<T extends { cost: number }>(
  items: T[],
  descending: boolean = true
): T[] {
  return [...items].sort((a, b) => {
    return descending ? b.cost - a.cost : a.cost - b.cost;
  });
}

/**
 * Calculate cost savings percentage
 */
export function calculateSavings(originalCost: number, newCost: number): number {
  if (originalCost === 0) return 0;
  return ((originalCost - newCost) / originalCost) * 100;
}

/**
 * Format cost savings
 */
export function formatSavings(originalCost: number, newCost: number): string {
  const savings = calculateSavings(originalCost, newCost);
  const amount = originalCost - newCost;
  
  if (savings > 0) {
    return `Save ${formatPercentage(savings)} (${formatCurrency(amount)})`;
  } else if (savings < 0) {
    return `Additional ${formatPercentage(Math.abs(savings))} (${formatCurrency(Math.abs(amount))})`;
  }
  return 'No change';
}

/**
 * Estimate annual cost from monthly
 */
export function estimateAnnualCost(monthlyCost: number): number {
  return monthlyCost * 12;
}

/**
 * Format date for pricing data
 */
export function formatPricingDate(isoDate: string): string {
  const date = new Date(isoDate);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/**
 * Check if pricing data is stale (older than 30 days)
 */
export function isPricingStale(lastUpdated: string): boolean {
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const updateTime = new Date(lastUpdated).getTime();
  return updateTime < thirtyDaysAgo;
}
