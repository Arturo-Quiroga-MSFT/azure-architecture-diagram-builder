import type { NodePricingConfig } from '../types/pricing';

export type PricingMode = 'payg' | 'reserved1yr';

export type PricingEstimateSource =
  | 'retail-payg'
  | 'static-payg'
  | 'custom'
  | 'real-savings-plan'
  | 'payg-unchanged-usage'
  | 'payg-unchanged-no-offer'
  | 'custom-unchanged';

export function getPricingEstimateSourceLabel(source: PricingEstimateSource): string {
  const labels: Record<PricingEstimateSource, string> = {
    'retail-payg': 'Azure Retail Prices PAYG meter',
    'static-payg': 'Static fallback estimate',
    custom: 'Custom user-provided price',
    'real-savings-plan': 'Azure Retail Prices real 1-year Savings Plan meter',
    'payg-unchanged-usage': 'Usage-based service; unchanged PAYG estimate',
    'payg-unchanged-no-offer': 'No 1-year offer; unchanged PAYG estimate',
    'custom-unchanged': 'Custom price; unchanged in 1-year mode',
  };
  return labels[source];
}

export function calculateNodeMonthlyCost(
  _serviceType: string,
  pricing: NodePricingConfig,
  pricingMode: PricingMode = 'payg'
): { cost: number; source: PricingEstimateSource } {
  const payg = pricing.estimatedCost * pricing.quantity;
  if (pricingMode === 'payg') {
    const source: PricingEstimateSource = pricing.isCustom
      ? 'custom'
      : pricing.paygSource === 'retail-api'
        ? 'retail-payg'
        : 'static-payg';
    return { cost: payg, source };
  }
  if (pricing.isCustom) return { cost: payg, source: 'custom-unchanged' };
  if (pricing.isUsageBased) return { cost: payg, source: 'payg-unchanged-usage' };
  if (pricing.reserved1yrCost != null && pricing.reserved1yrCost > 0) {
    return { cost: pricing.reserved1yrCost * pricing.quantity, source: 'real-savings-plan' };
  }
  return { cost: payg, source: 'payg-unchanged-no-offer' };
}