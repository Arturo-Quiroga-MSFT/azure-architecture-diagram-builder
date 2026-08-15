// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {
  estimateArchitectureCosts,
  type ArchitectureCostEstimate,
  type ArchitectureCostService,
  type ExcludedCostService,
} from './costEstimator.js';
import { getPricingMeta, normalizeAzureRegion, type PricingTerm } from './pricing.js';

export type RegionalComparisonService = Omit<ArchitectureCostService, 'region'>;

export interface RegionalCostRow {
  region: string;
  nativePricing: true;
  currency: string;
  pricesAsOf: string | null;
  serviceCount: number;
  totalResourceCount: number;
  numericallyPricedResourceCount: number;
  excludedResourceCount: number;
  numericCoveragePercent: number;
  isPartialBaseline: boolean;
  baselineLabel: string;
  totalMonthlyCost: { low: number; expected: number; high: number };
  selectedMonthlyCost: number;
  numericServices: string[];
  excludedServices: ExcludedCostService[];
  byCategory: Record<string, { count: number; services: string[]; expectedMonthlyCost: number }>;
  deltaFromBaseline: { amount: number; percent: number | null } | null;
}

export interface RegionalCostComparison {
  [key: string]: unknown;
  term: PricingTerm;
  baselineRegion: string;
  requestedRegions: string[];
  comparedRegions: string[];
  unsupportedRegions: string[];
  serviceCount: number;
  totalResourceCount: number;
  rankingEligible: boolean;
  rankingReason: string;
  coverageConsistent: boolean;
  currencyConsistent: boolean;
  comparisons: RegionalCostRow[];
  ranking: Array<{ rank: number; region: string; selectedMonthlyCost: number; deltaFromBaseline: number; deltaPercent: number | null }>;
  cheapest: { region: string; selectedMonthlyCost: number } | null;
  mostExpensive: { region: string; selectedMonthlyCost: number } | null;
  potentialMonthlySavings: { amount: number; percent: number | null } | null;
  pricingSource: { generatedAt: string; currency: string; regions: string[] };
  note: string;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

function numericServiceSet(estimate: ArchitectureCostEstimate): string[] {
  // Tier and term are shared inputs for every candidate, so identity + type +
  // quantity are sufficient to prove equivalent numeric coverage.
  return estimate.estimates
    .filter(line => line.hasPricingData)
    .map(line => `${line.name}\u0000${line.type}\u0000${line.quantity}`)
    .sort();
}

function sameStrings(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function compareRegionalCosts(params: {
  services: RegionalComparisonService[];
  regions: string[];
  baselineRegion?: string;
  term?: string;
}): RegionalCostComparison {
  const requestedRegions = params.regions.map(normalizeAzureRegion);
  const totalResourceCount = params.services.reduce(
    (total, service) => total + (service.quantity && service.quantity > 0 ? service.quantity : 1),
    0,
  );
  const pricingSource = getPricingMeta();
  const nativeRegions = new Set(pricingSource.regions);
  const comparedRegions = requestedRegions.filter(region => nativeRegions.has(region));
  const unsupportedRegions = requestedRegions.filter(region => !nativeRegions.has(region));
  const baselineRegion = normalizeAzureRegion(params.baselineRegion ?? requestedRegions[0] ?? 'eastus2');
  const term: PricingTerm = params.term === 'reserved1yr' ? 'reserved1yr' : 'payg';

  const estimates = comparedRegions.map(region => estimateArchitectureCosts({
    services: params.services.map(service => ({ ...service, region })),
    region,
    term,
  }));
  const numericSets = estimates.map(numericServiceSet);
  const coverageConsistent = numericSets.length > 0 && numericSets.every(set => sameStrings(set, numericSets[0]));
  const currencyConsistent = estimates.length > 0 && estimates.every(estimate => estimate.currency === estimates[0].currency);
  const noProxy = estimates.every(estimate => !estimate.regionProxyUsed);
  const hasNumericBaseline = estimates.length > 0 && estimates.every(estimate => estimate.numericallyPricedResourceCount > 0);
  const baselineEstimate = estimates.find(estimate => estimate.region === baselineRegion);

  const rankingEligible = unsupportedRegions.length === 0
    && comparedRegions.length >= 2
    && Boolean(baselineEstimate)
    && coverageConsistent
    && currencyConsistent
    && noProxy
    && hasNumericBaseline;

  const rankingReason = unsupportedRegions.length > 0
    ? `Ranking withheld because these requested regions have no native bundled snapshot: ${unsupportedRegions.join(', ')}.`
    : comparedRegions.length < 2
      ? 'Ranking requires at least two regions with native bundled pricing.'
      : !baselineEstimate
        ? `Ranking withheld because baseline region ${baselineRegion} is not a supported comparison candidate.`
        : !coverageConsistent
          ? 'Ranking withheld because the set of numerically priced services differs across regions.'
          : !currencyConsistent
            ? 'Ranking withheld because currencies differ across regions.'
            : !noProxy
              ? 'Ranking withheld because at least one estimate used a regional proxy.'
              : !hasNumericBaseline
                ? 'Ranking withheld because the architecture has no numeric fixed-price baseline in every region.'
                : 'Ranking compares equivalent native-region fixed-price baselines by selected-tier monthly cost.';

  const baselineSelected = baselineEstimate?.selectedMonthlyCost ?? 0;
  const comparisons: RegionalCostRow[] = estimates.map((estimate, index) => {
    const amount = round2(estimate.selectedMonthlyCost - baselineSelected);
    return {
      region: estimate.region,
      nativePricing: true,
      currency: estimate.currency,
      pricesAsOf: estimate.pricesAsOf,
      serviceCount: estimate.serviceCount,
      totalResourceCount: estimate.totalResourceCount,
      numericallyPricedResourceCount: estimate.numericallyPricedResourceCount,
      excludedResourceCount: estimate.excludedResourceCount,
      numericCoveragePercent: estimate.numericCoveragePercent,
      isPartialBaseline: estimate.isPartialBaseline,
      baselineLabel: estimate.baselineLabel,
      totalMonthlyCost: estimate.totalMonthlyCost,
      selectedMonthlyCost: estimate.selectedMonthlyCost,
      numericServices: numericSets[index].map(value => value.split('\u0000')[0]),
      excludedServices: estimate.excludedServices,
      byCategory: estimate.byCategory,
      deltaFromBaseline: baselineEstimate
        ? { amount, percent: baselineSelected > 0 ? round2((amount / baselineSelected) * 100) : null }
        : null,
    };
  });

  const ranking = rankingEligible
    ? [...comparisons]
        .sort((left, right) => left.selectedMonthlyCost - right.selectedMonthlyCost || left.region.localeCompare(right.region))
        .map((comparison, index) => ({
          rank: index + 1,
          region: comparison.region,
          selectedMonthlyCost: comparison.selectedMonthlyCost,
          deltaFromBaseline: comparison.deltaFromBaseline!.amount,
          deltaPercent: comparison.deltaFromBaseline!.percent,
        }))
    : [];
  const cheapest = ranking.length
    ? { region: ranking[0].region, selectedMonthlyCost: ranking[0].selectedMonthlyCost }
    : null;
  const mostExpensive = ranking.length
    ? { region: ranking[ranking.length - 1].region, selectedMonthlyCost: ranking[ranking.length - 1].selectedMonthlyCost }
    : null;
  const savingsAmount = cheapest && mostExpensive
    ? round2(mostExpensive.selectedMonthlyCost - cheapest.selectedMonthlyCost)
    : null;
  const potentialMonthlySavings = savingsAmount != null && mostExpensive
    ? {
        amount: savingsAmount,
        percent: mostExpensive.selectedMonthlyCost > 0
          ? round2((savingsAmount / mostExpensive.selectedMonthlyCost) * 100)
          : null,
      }
    : null;

  return {
    term,
    baselineRegion,
    requestedRegions,
    comparedRegions,
    unsupportedRegions,
    serviceCount: params.services.length,
    totalResourceCount,
    rankingEligible,
    rankingReason,
    coverageConsistent,
    currencyConsistent,
    comparisons,
    ranking,
    cheapest,
    mostExpensive,
    potentialMonthlySavings,
    pricingSource,
    note:
      'Each candidate applies the same service list, quantities, tiers, and term wholly to that region. Only native bundled snapshots are compared; no heuristic multipliers or regional proxies are used. Rankings describe the numeric fixed-price baseline only and exclude usage-based or catalog-range resources shown in excludedServices.',
  };
}

export function summarizeRegionalComparison(comparison: RegionalCostComparison): string {
  if (!comparison.rankingEligible) {
    return `Compared ${comparison.comparedRegions.length}/${comparison.requestedRegions.length} requested region(s). ${comparison.rankingReason}`;
  }
  const coverageLabel = comparison.comparisons.some(row => row.isPartialBaseline) ? 'partial fixed-price baseline' : 'fixed-price baseline';
  return `${comparison.cheapest!.region} has the lowest equivalent selected-tier ${coverageLabel} at ~$${comparison.cheapest!.selectedMonthlyCost.toLocaleString()}/mo; ${comparison.mostExpensive!.region} is highest at ~$${comparison.mostExpensive!.selectedMonthlyCost.toLocaleString()}/mo. Potential baseline difference: ~$${comparison.potentialMonthlySavings!.amount.toLocaleString()}/mo (${comparison.potentialMonthlySavings!.percent ?? 0}%).`;
}