// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { estimateServiceCost, getPricingMeta, normalizeAzureRegion, type CostTier, type PricingTerm } from './pricing.js';
import { resolveServiceName, SERVICE_CATALOG } from './serviceCatalog.js';

export interface ArchitectureCostService {
  name: string;
  type: string;
  region?: string;
  tier?: string;
  quantity?: number;
}

export interface CostEstimateLine {
  name: string;
  type: string;
  category: string;
  requestedRegion: string;
  effectiveRegion: string;
  regionProxyUsed: boolean;
  regionProxyReason?: string;
  tier: string;
  quantity: number;
  hasPricingData: boolean;
  currency?: string;
  term?: PricingTerm;
  sampleSku?: string;
  expectedBasis?: string;
  reservedApplied?: boolean;
  monthlyCostPerInstance?: { low: number; expected: number; high: number };
  selectedMonthlyCost?: number;
  totalMonthlyCost?: number;
  pricesAsOf?: string | null;
  catalogCostRange?: string;
  note?: string;
}

export interface ExcludedCostService {
  name: string;
  type: string;
  quantity: number;
  requestedRegion: string;
  effectiveRegion: string;
  regionProxyUsed: boolean;
  reason: 'usage-based' | 'catalog-range' | 'no-pricing-data';
  catalogCostRange: string;
}

export interface ArchitectureCostEstimate {
  [key: string]: unknown;
  region: string;
  term: PricingTerm;
  currency: string;
  pricesAsOf: string | null;
  serviceCount: number;
  totalResourceCount: number;
  numericallyPricedResourceCount: number;
  excludedResourceCount: number;
  catalogRangeResourceCount: number;
  usageBasedResourceCount: number;
  noPricingDataResourceCount: number;
  numericCoveragePercent: number;
  isPartialBaseline: boolean;
  baselineLabel: string;
  regionProxyUsed: boolean;
  proxiedResourceCount: number;
  requestedRegions: string[];
  effectiveRegions: string[];
  hasPricingData: boolean;
  totalMonthlyCost: { low: number; expected: number; high: number };
  selectedMonthlyCost: number;
  byCategory: Record<string, { count: number; services: string[]; expectedMonthlyCost: number }>;
  estimates: CostEstimateLine[];
  excludedServices: ExcludedCostService[];
  servicesMissingData: string[];
  pricingSource: { generatedAt: string; currency: string; regions: string[] };
  note: string;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

export function estimateArchitectureCosts(params: {
  services: ArchitectureCostService[];
  region?: string;
  term?: string;
}): ArchitectureCostEstimate {
  const targetRegion = normalizeAzureRegion(params.region ?? 'eastus2');
  const targetTerm: PricingTerm = params.term === 'reserved1yr' ? 'reserved1yr' : 'payg';
  const estimates: CostEstimateLine[] = [];
  const totals = { low: 0, expected: 0, high: 0 };
  let selectedTotal = 0;
  const categoryTotals = new Map<string, { count: number; services: string[]; expectedMonthlyCost: number }>();
  let anyPricingData = false;
  let currency = 'USD';
  let pricesAsOf: string | null = null;
  const servicesMissingData: string[] = [];
  const excludedServices: ExcludedCostService[] = [];
  const requestedRegions = new Set<string>();
  const effectiveRegions = new Set<string>();
  let totalResourceCount = 0;
  let numericallyPricedResourceCount = 0;
  let usageBasedResourceCount = 0;
  let catalogRangeResourceCount = 0;
  let noPricingDataResourceCount = 0;
  let proxiedResourceCount = 0;

  for (const service of params.services) {
    const resolved = resolveServiceName(service.type);
    const info = resolved ? SERVICE_CATALOG[resolved] : null;
    const tier = (service.tier as CostTier) ?? 'standard';
    const quantity = service.quantity && service.quantity > 0 ? service.quantity : 1;
    totalResourceCount += quantity;

    const category = info?.category ?? 'other';
    if (!categoryTotals.has(category)) {
      categoryTotals.set(category, { count: 0, services: [], expectedMonthlyCost: 0 });
    }
    const categoryEntry = categoryTotals.get(category)!;
    categoryEntry.count += quantity;
    categoryEntry.services.push(service.name);

    const pricingName = info?.pricingServiceName ?? resolved ?? service.type;
    const estimate = estimateServiceCost({
      pricingServiceName: pricingName,
      region: service.region ?? targetRegion,
      fallbackRegion: targetRegion,
      term: targetTerm,
      tier,
      quantity,
    });
    requestedRegions.add(estimate.requestedRegion);

    if (estimate.hasPricingData && estimate.monthlyCost) {
      effectiveRegions.add(estimate.effectiveRegion);
      if (estimate.regionProxyUsed) proxiedResourceCount += quantity;
      numericallyPricedResourceCount += quantity;
      anyPricingData = true;
      currency = estimate.currency ?? currency;
      if (estimate.pricesAsOf && (!pricesAsOf || estimate.pricesAsOf > pricesAsOf)) {
        pricesAsOf = estimate.pricesAsOf;
      }
      totals.low += estimate.monthlyCost.low * quantity;
      totals.expected += estimate.monthlyCost.expected * quantity;
      totals.high += estimate.monthlyCost.high * quantity;
      selectedTotal += estimate.totalMonthlyCost ?? (estimate.selectedMonthlyCost ?? 0) * quantity;
      categoryEntry.expectedMonthlyCost += (estimate.selectedMonthlyCost ?? 0) * quantity;

      estimates.push({
        name: service.name,
        type: resolved ?? service.type,
        category,
        requestedRegion: estimate.requestedRegion,
        effectiveRegion: estimate.effectiveRegion,
        regionProxyUsed: estimate.regionProxyUsed,
        regionProxyReason: estimate.regionProxyReason,
        tier,
        quantity,
        hasPricingData: true,
        currency: estimate.currency,
        term: targetTerm,
        sampleSku: estimate.sampleSku,
        expectedBasis: estimate.expectedBasis,
        reservedApplied: estimate.reservedApplied ?? false,
        monthlyCostPerInstance: estimate.monthlyCost,
        selectedMonthlyCost: estimate.selectedMonthlyCost,
        totalMonthlyCost: estimate.totalMonthlyCost,
        pricesAsOf: estimate.pricesAsOf,
      });
      continue;
    }

    servicesMissingData.push(service.name);
    const reason = info?.isUsageBased
      ? 'usage-based' as const
      : info?.costRange
        ? 'catalog-range' as const
        : 'no-pricing-data' as const;
    if (reason === 'usage-based') usageBasedResourceCount += quantity;
    else if (reason === 'catalog-range') catalogRangeResourceCount += quantity;
    else noPricingDataResourceCount += quantity;
    const catalogCostRange = info?.costRange ?? 'No pricing data available';
    excludedServices.push({
      name: service.name,
      type: resolved ?? service.type,
      quantity,
      requestedRegion: estimate.requestedRegion,
      effectiveRegion: estimate.requestedRegion,
      regionProxyUsed: false,
      reason,
      catalogCostRange,
    });
    estimates.push({
      name: service.name,
      type: resolved ?? service.type,
      category,
      requestedRegion: estimate.requestedRegion,
      effectiveRegion: estimate.requestedRegion,
      regionProxyUsed: false,
      tier,
      quantity,
      hasPricingData: false,
      catalogCostRange,
      note: info?.isUsageBased
        ? 'Usage-based service — no trusted fixed monthly value is distilled; using the catalog range.'
        : 'No distilled pricing for this service/region; using catalog range.',
    });
  }

  const totalMonthlyCost = {
    low: round2(totals.low),
    expected: round2(totals.expected),
    high: round2(totals.high),
  };
  const excludedResourceCount = totalResourceCount - numericallyPricedResourceCount;
  const numericCoveragePercent = totalResourceCount > 0
    ? Math.round((numericallyPricedResourceCount / totalResourceCount) * 10000) / 100
    : 0;
  const isPartialBaseline = excludedResourceCount > 0;
  const baselineLabel = isPartialBaseline
    ? `Partial fixed-price baseline covering ${numericallyPricedResourceCount}/${totalResourceCount} resources`
    : `Fixed-price baseline covering all ${totalResourceCount} resources`;

  return {
    region: targetRegion,
    term: targetTerm,
    currency,
    pricesAsOf,
    serviceCount: params.services.length,
    totalResourceCount,
    numericallyPricedResourceCount,
    excludedResourceCount,
    catalogRangeResourceCount,
    usageBasedResourceCount,
    noPricingDataResourceCount,
    numericCoveragePercent,
    isPartialBaseline,
    baselineLabel,
    regionProxyUsed: proxiedResourceCount > 0,
    proxiedResourceCount,
    requestedRegions: [...requestedRegions].sort(),
    effectiveRegions: [...effectiveRegions].sort(),
    hasPricingData: anyPricingData,
    totalMonthlyCost,
    selectedMonthlyCost: round2(selectedTotal),
    byCategory: Object.fromEntries(
      [...categoryTotals.entries()].map(([category, data]) => [
        category,
        {
          count: data.count,
          services: data.services,
          expectedMonthlyCost: round2(data.expectedMonthlyCost),
        },
      ]),
    ),
    estimates,
    excludedServices,
    servicesMissingData,
    pricingSource: getPricingMeta(),
    note:
      'Numeric costs are derived from a distilled Azure Retail Prices snapshot (per region). Instance-priced services use a configured representative SKU with low/high spanning eligible PAYG SKUs; Microsoft Fabric uses F2/F8/F64 capacity bands. In reserved1yr mode, each tier uses its own exact one-year Savings Plan meter when available and otherwise remains PAYG. Usage-based and composite-billed services without a trusted fixed monthly value report curated catalog ranges. generatedAt identifies sidecar generation; pricesAsOf identifies the newest contributing meter date. For authoritative quotes use the Azure Pricing Calculator.',
  };
}

export function summarizeArchitectureCosts(estimate: ArchitectureCostEstimate): string {
  const proxyNote = estimate.proxiedResourceCount
    ? ` ${estimate.proxiedResourceCount} resource(s) use an explicit regional proxy; inspect requestedRegion/effectiveRegion.`
    : '';
  return `${estimate.baselineLabel}: ~$${estimate.totalMonthlyCost.expected.toLocaleString()}/mo expected ($${estimate.totalMonthlyCost.low.toLocaleString()}–$${estimate.totalMonthlyCost.high.toLocaleString()} numeric range, ${estimate.term}, ${estimate.currency}). ${estimate.excludedResourceCount} resource(s) are excluded from this baseline.${proxyNote}`;
}