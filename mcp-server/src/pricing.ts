// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Pricing module for the MCP server.
 *
 * Loads the distilled pricing sidecar (pricing.generated.json, produced by
 * scripts/sync-pricing-data.mjs from the web app's Azure Retail Prices data)
 * and returns numeric per-service monthly cost estimates — replacing the vague
 * catalog "costRange" strings with real low/expected/high numbers, region- and
 * term-aware.
 *
 * The sidecar is read from disk (relative to the compiled file) rather than
 * imported, so it works identically whether run from src (ts-node) or the
 * bundled dist/ output shipped to Azure Container Apps.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

export type PricingTerm = 'payg' | 'reserved1yr';
export type CostTier = 'basic' | 'standard' | 'premium';

interface ServicePricingEntry {
  low: number;
  expected: number;
  high: number;
  reservedLow: number | null;
  reservedExpected: number | null;
  reservedHigh: number | null;
  currency: string;
  sampleSku: string;
  expectedBasis?: string;
  tierCount: number;
  pricesAsOf: string | null;
}

interface PricingData {
  generatedAt: string;
  source: string;
  hoursPerMonth: number;
  currency: string;
  regions: Record<string, Record<string, ServicePricingEntry>>;
}

const DEFAULT_REGION = 'eastus2';

let cachedData: PricingData | null = null;

function loadData(): PricingData {
  if (cachedData) return cachedData;
  const here = dirname(fileURLToPath(import.meta.url));
  const dataPath = resolve(here, 'pricing.generated.json');
  cachedData = JSON.parse(readFileSync(dataPath, 'utf8')) as PricingData;
  return cachedData;
}

/** Convert a pricing service name ("Azure App Service") to a file stem. */
function stemFor(pricingServiceName: string): string {
  return pricingServiceName.toLowerCase().replace(/\s+/g, '_');
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface ServiceCostEstimate {
  hasPricingData: boolean;
  currency?: string;
  pricesAsOf?: string | null;
  term?: PricingTerm;
  /** Per-instance monthly cost across the SKU range. */
  monthlyCost?: { low: number; expected: number; high: number };
  /** The tier-selected per-instance monthly cost. */
  selectedTier?: CostTier;
  selectedMonthlyCost?: number;
  /** selectedMonthlyCost × quantity. */
  totalMonthlyCost?: number;
  quantity?: number;
  sampleSku?: string;
  /** How "expected" was chosen: a default SKU match or the p25 fallback. */
  expectedBasis?: string;
  /** True when reserved numbers were derived from a 1-year savings plan. */
  reservedApplied?: boolean;
  note?: string;
}

export interface EstimateParams {
  pricingServiceName: string;
  region?: string;
  term?: PricingTerm;
  tier?: CostTier;
  quantity?: number;
}

/**
 * Estimate the monthly cost for a single service. Returns
 * { hasPricingData: false } when the distilled data lacks this service/region,
 * so the caller can fall back to the catalog costRange string.
 */
export function estimateServiceCost(params: EstimateParams): ServiceCostEstimate {
  const { pricingServiceName } = params;
  const region = params.region || DEFAULT_REGION;
  const term: PricingTerm = params.term || 'payg';
  const tier: CostTier = params.tier || 'standard';
  const quantity = params.quantity && params.quantity > 0 ? params.quantity : 1;

  const data = loadData();
  const regionMap = data.regions[region] ?? data.regions[DEFAULT_REGION];
  const entry = regionMap?.[stemFor(pricingServiceName)];

  if (!entry) {
    return { hasPricingData: false };
  }

  // Never extrapolate one SKU's discount over unrelated SKUs. In one-year
  // mode each tier uses its own real Savings Plan meter when present; tiers
  // without one remain PAYG and are explicitly described as mixed coverage.
  const oneYearRequested = term === 'reserved1yr';
  const band = {
    low: round2(oneYearRequested && entry.reservedLow != null ? entry.reservedLow : entry.low),
    expected: round2(oneYearRequested && entry.reservedExpected != null ? entry.reservedExpected : entry.expected),
    high: round2(oneYearRequested && entry.reservedHigh != null ? entry.reservedHigh : entry.high),
  };

  const selected =
    tier === 'basic' ? band.low : tier === 'premium' ? band.high : band.expected;
  const selectedHasReserved = oneYearRequested && (
    tier === 'basic' ? entry.reservedLow != null
      : tier === 'premium' ? entry.reservedHigh != null
        : entry.reservedExpected != null
  );
  const reservedTierCount = [entry.reservedLow, entry.reservedExpected, entry.reservedHigh].filter((value) => value != null).length;

  return {
    hasPricingData: true,
    currency: entry.currency,
    pricesAsOf: entry.pricesAsOf,
    term,
    monthlyCost: band,
    selectedTier: tier,
    selectedMonthlyCost: round2(selected),
    totalMonthlyCost: round2(selected * quantity),
    quantity,
    sampleSku: entry.sampleSku,
    expectedBasis: entry.expectedBasis,
    reservedApplied: selectedHasReserved,
    note: oneYearRequested
      ? `${reservedTierCount}/3 tier values have real SKU-specific 1-year Savings Plan meters; unavailable tiers remain PAYG. Selected tier ${selectedHasReserved ? 'uses a real one-year rate' : 'remains PAYG'}.`
      : 'Expected uses a configured representative SKU; low/high span the cheapest/most-expensive eligible PAYG SKUs in the region.',
  };
}

/** Metadata about the bundled pricing snapshot (for tool responses). */
export function getPricingMeta(): { generatedAt: string; currency: string; regions: string[] } {
  const data = loadData();
  return {
    generatedAt: data.generatedAt,
    currency: data.currency,
    regions: Object.keys(data.regions),
  };
}
