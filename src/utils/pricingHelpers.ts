// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

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
 * Freshness of the bundled pricing data relative to today.
 * - `fresh`  : ≤ 30 days old
 * - `aging`  : 31–90 days old (subtle warning)
 * - `stale`  : > 90 days old (strong warning)
 */
export type PricingFreshnessLevel = 'fresh' | 'aging' | 'stale';

export interface PricingFreshness {
  /** Whole days between the data date and today (0 if in the future/today). */
  ageDays: number;
  level: PricingFreshnessLevel;
  /** Short human label, e.g. "12 days old" / "3 months old". */
  ageLabel: string;
  /** Localized data date, e.g. "Jun 25, 2026" (falls back to the raw string). */
  dateLabel: string;
  /** True when the data warrants a refresh warning (> 30 days). */
  isStale: boolean;
}

/**
 * Compute how stale the pricing data is from its "as of" date (YYYY-MM-DD).
 * Used to surface a data-freshness guardrail in the cost UI so estimates never
 * silently age out.
 */
export function getPricingFreshness(
  asOf: string,
  now: Date = new Date()
): PricingFreshness {
  const asOfDate = new Date(`${asOf}T00:00:00Z`);
  const valid = !Number.isNaN(asOfDate.getTime());
  const msPerDay = 86_400_000;
  const ageDays = valid
    ? Math.max(0, Math.floor((now.getTime() - asOfDate.getTime()) / msPerDay))
    : 0;

  const level: PricingFreshnessLevel =
    ageDays > 90 ? 'stale' : ageDays > 30 ? 'aging' : 'fresh';

  let ageLabel: string;
  if (ageDays < 1) ageLabel = 'today';
  else if (ageDays === 1) ageLabel = '1 day old';
  else if (ageDays < 60) ageLabel = `${ageDays} days old`;
  else ageLabel = `${Math.round(ageDays / 30)} months old`;

  const dateLabel = valid
    ? asOfDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      })
    : asOf;

  return { ageDays, level, ageLabel, dateLabel, isStale: ageDays > 30 };
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
    region: 'eastus2',
    displayName: 'East US 2',
    armRegionName: 'eastus2',
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
    region: 'swedencentral',
    displayName: 'Sweden Central',
    armRegionName: 'swedencentral',
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
    region: 'southeastasia',
    displayName: 'Southeast Asia',
    armRegionName: 'southeastasia',
    multiplier: 1.05
  },
  {
    region: 'japaneast',
    displayName: 'Japan East',
    armRegionName: 'japaneast',
    multiplier: 1.12
  },
  {
    region: 'australiaeast',
    displayName: 'Australia East',
    armRegionName: 'australiaeast',
    multiplier: 1.15
  },
  {
    region: 'brazilsouth',
    displayName: 'Brazil South',
    armRegionName: 'brazilsouth',
    multiplier: 1.20
  },
  {
    region: 'mexicocentral',
    displayName: 'Mexico Central',
    armRegionName: 'mexicocentral',
    multiplier: 1.0
  },
  {
    region: 'canadacentral',
    displayName: 'Canada Central',
    armRegionName: 'canadacentral',
    multiplier: 1.04
  },
  {
    region: 'centralindia',
    displayName: 'Central India',
    armRegionName: 'centralindia',
    multiplier: 1.0
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
  return AZURE_REGIONS[0]; // East US 2
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
