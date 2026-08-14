// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Cost Estimation Service
 * Core logic for calculating architecture costs
 */

import { Node } from 'reactflow';
import { 
  NodePricingConfig, 
  CostBreakdown,
  PricingTier
} from '../types/pricing';
import { getServicePricing } from './azurePricingService';
import { 
  getActiveRegion
} from './regionalPricingService';
import { 
  getAzureServiceName, 
  getDefaultTier, 
  getFallbackPricing,
  hasFallbackPricing,
  getFallbackDefaultLevel,
  getFallbackDefaultSku,
  PRICING_DATA_AS_OF,
  hasPricingData,
  USAGE_BASED_SERVICES 
} from '../data/azurePricing';
import { 
  applyRegionalPricing,
  getPricingFreshness
} from '../utils/pricingHelpers';
import {
  calculateNodeMonthlyCost,
  getPricingEstimateSourceLabel,
} from './pricingModeCalculator';
import type { PricingMode } from './pricingModeCalculator';

export {
  calculateNodeMonthlyCost,
  getPricingEstimateSourceLabel,
};
export type { PricingEstimateSource, PricingMode } from './pricingModeCalculator';

function normalizeTierName(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/^standard[_\s-]*/, '')
    .replace(/[^a-z0-9]/g, '');
}

function findTier(tiers: PricingTier[], requested: string): PricingTier | undefined {
  const exact = tiers.find(tier => tier.name === requested || tier.skuName === requested);
  if (exact) return exact;
  const normalized = normalizeTierName(requested);
  return tiers.find(tier => normalizeTierName(tier.name) === normalized || normalizeTierName(tier.skuName) === normalized);
}

/**
 * Initialize pricing for a new node
 */
export async function initializeNodePricing(
  serviceType: string,
  region?: string
): Promise<NodePricingConfig | null> {
  const targetRegion = region || getActiveRegion();
  console.log('🔍 Initializing pricing for:', serviceType, 'in region:', targetRegion);
  
  // Check if this service has pricing data
  if (!hasPricingData(serviceType)) {
    console.warn(`⚠️ No pricing data available for ${serviceType}`);
    return null;
  }

  try {
    // Get Azure service name
    const serviceName = getAzureServiceName(serviceType);
    const defaultTier = getDefaultTier(serviceType);
    console.log('  → Mapped to Azure service:', serviceName, 'Default tier:', defaultTier);
    
    // Check if this is a usage-based service (need this for all code paths)
    const isUsageBased = USAGE_BASED_SERVICES.includes(serviceType);
    
    // Try to fetch from API
    const pricing = await getServicePricing(serviceType, serviceName, targetRegion);
    
    if (pricing && pricing.tiers.length > 0) {
      // Use API data
      const tier = findTier(pricing.tiers, defaultTier);
      if (!tier) {
        if (!hasFallbackPricing(serviceType)) return null;
        const fallbackPrice = getFallbackPricing(serviceType, getFallbackDefaultLevel(serviceType));
        const basePrice = applyRegionalPricing(fallbackPrice, targetRegion);
        const skuLabel = getFallbackDefaultSku(serviceType);
        console.warn(`⚠️ Default tier ${defaultTier} is unavailable for ${serviceType} in ${targetRegion}; using documented static fallback ${skuLabel}`);
        return {
          estimatedCost: basePrice,
          tier: skuLabel,
          skuName: skuLabel,
          quantity: 1,
          region: targetRegion,
          unit: 'per instance/month',
          lastUpdated: new Date().toISOString(),
          isCustom: false,
          paygSource: 'static-fallback',
          isUsageBased,
        };
      }
      console.log('  ✅ Found tier:', tier.name, 'Price:', tier.monthlyPrice, '/mo (hourly:', tier.hourlyPrice, ')');
      
      // If pricing is $0 (usage-based services like Storage), use fallback pricing
      if (tier.monthlyPrice === 0 || tier.monthlyPrice === null || tier.monthlyPrice === undefined) {
        console.log('  💡 Usage-based pricing ($0 base), using fallback estimate');
        const fallbackPrice = getFallbackPricing(serviceType, 'standard');
        if (fallbackPrice > 0) {
          const basePrice = applyRegionalPricing(fallbackPrice, targetRegion);
          
          return {
            estimatedCost: basePrice,
            tier: tier.name,
            skuName: tier.skuName,
            quantity: 1,
            region: targetRegion,
            unit: tier.unit,
            lastUpdated: new Date().toISOString(),
            isCustom: false,
            paygSource: 'static-fallback',
            isUsageBased: true
          };
        }
      }
      
      return {
        estimatedCost: tier.monthlyPrice,
        tier: tier.name,
        skuName: tier.skuName,
        quantity: 1,
        region: targetRegion,
        unit: tier.unit,
        lastUpdated: new Date().toISOString(),
        isCustom: false,
        paygSource: 'retail-api',
        isUsageBased: isUsageBased,
        reserved1yrCost: tier.reserved1yrMonthly,
        reservedIsSavingsPlan: tier.reserved1yrMonthly != null
      };
    } else {
      // Fallback to static data — use the service's default SKU/level
      if (!hasFallbackPricing(serviceType)) return null;
      const fallbackPrice = getFallbackPricing(serviceType, getFallbackDefaultLevel(serviceType));
      const basePrice = applyRegionalPricing(fallbackPrice, targetRegion);
      const skuLabel = getFallbackDefaultSku(serviceType);
      console.log('  💾 Using fallback pricing:', basePrice, '/mo');
      
      return {
        estimatedCost: basePrice,
        tier: skuLabel,
        skuName: skuLabel,
        quantity: 1,
        region: targetRegion,
        unit: 'per instance/month',
        lastUpdated: new Date().toISOString(),
        isCustom: false,
        paygSource: 'static-fallback',
        isUsageBased: isUsageBased
      };
    }
  } catch (error) {
    console.error(`Error initializing pricing for ${serviceType}:`, error);
    if (!hasFallbackPricing(serviceType)) return null;
    
    // Final fallback
    const fallbackPrice = getFallbackPricing(serviceType, getFallbackDefaultLevel(serviceType));
    const basePrice = applyRegionalPricing(fallbackPrice, targetRegion);
    const skuLabel = getFallbackDefaultSku(serviceType);
    const isUsageBased = USAGE_BASED_SERVICES.includes(serviceType);
    
    return {
      estimatedCost: basePrice,
      tier: skuLabel,
      skuName: skuLabel,
      quantity: 1,
      region: targetRegion,
      unit: 'per instance/month',
      lastUpdated: new Date().toISOString(),
      isCustom: false,
      paygSource: 'static-fallback',
      isUsageBased: isUsageBased
    };
  }
}

/**
 * Update pricing when tier or quantity changes
 */
export async function updateNodePricing(
  serviceType: string,
  currentConfig: NodePricingConfig,
  newTier?: string,
  newQuantity?: number,
  newRegion?: string
): Promise<NodePricingConfig> {
  const tier = newTier || currentConfig.tier;
  const quantity = newQuantity || currentConfig.quantity;
  const region = newRegion || currentConfig.region;
  
  try {
    const serviceName = getAzureServiceName(serviceType);
    const pricing = await getServicePricing(serviceType, serviceName, region);
    
    if (pricing) {
      // `estimatedCost` is PER UNIT everywhere else in the system —
      // calculateCostBreakdown and AzureNode both multiply it by quantity
      // themselves. Storing a quantity-multiplied total here would be counted
      // twice (quantity squared). Price one unit and let the callers scale it.
      const selectedTier = findTier(pricing.tiers, tier);
      if (!selectedTier) {
        const tierLevel = tier.toLowerCase().includes('premium') ? 'premium' : tier.toLowerCase().includes('basic') ? 'basic' : 'standard';
        const fallbackPrice = getFallbackPricing(serviceType, tierLevel);
        return {
          ...currentConfig,
          estimatedCost: applyRegionalPricing(fallbackPrice, region),
          tier: getFallbackDefaultSku(serviceType),
          skuName: getFallbackDefaultSku(serviceType),
          quantity,
          region,
          lastUpdated: new Date().toISOString(),
          isCustom: false,
          paygSource: 'static-fallback',
          reserved1yrCost: undefined,
          reservedIsSavingsPlan: false,
        };
      }
      const unitCost = selectedTier.monthlyPrice;
      // Refresh the real 1-year Savings Plan rate for the (possibly new) tier.

      return {
        ...currentConfig,
        estimatedCost: unitCost,
        tier: selectedTier.name,
        skuName: selectedTier.skuName,
        quantity,
        region,
        lastUpdated: new Date().toISOString(),
        isCustom: false,
        paygSource: 'retail-api',
        reserved1yrCost: selectedTier?.reserved1yrMonthly,
        reservedIsSavingsPlan: selectedTier?.reserved1yrMonthly != null
      };
    } else {
      // Fallback calculation
      const tierLevel = tier.toLowerCase().includes('premium') ? 'premium' :
                       tier.toLowerCase().includes('basic') ? 'basic' : 'standard';
      const fallbackPrice = getFallbackPricing(serviceType, tierLevel);
      const basePrice = applyRegionalPricing(fallbackPrice, region);
      
      return {
        ...currentConfig,
        estimatedCost: basePrice,
        tier,
        quantity,
        region,
        lastUpdated: new Date().toISOString(),
        isCustom: false,
        paygSource: 'static-fallback',
      };
    }
  } catch (error) {
    console.error(`Error updating pricing for ${serviceType}:`, error);
    return currentConfig;
  }
}

/**
 * Set custom pricing for a node
 */
export function setCustomPricing(
  currentConfig: NodePricingConfig,
  customPrice: number
): NodePricingConfig {
  return {
    ...currentConfig,
    estimatedCost: customPrice,
    customPrice: customPrice,
    isCustom: true,
    paygSource: 'custom',
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Tiers/SKUs a service can be switched to, for the per-node cost editor.
 *
 * Estimates otherwise sit on two fixed assumptions — the catalog default tier
 * and quantity 1 — which users pushed back on. Returns [] when the service has
 * no catalog pricing (usage-based services, or anything with hasPricingData
 * false), in which case only a custom override is meaningful.
 */
export async function getAvailableTiers(
  serviceType: string,
  region?: string
): Promise<PricingTier[]> {
  const targetRegion = region || getActiveRegion();
  if (!hasPricingData(serviceType)) return [];
  try {
    const serviceName = getAzureServiceName(serviceType);
    const pricing = await getServicePricing(serviceType, serviceName, targetRegion);
    return pricing?.tiers ?? [];
  } catch (error) {
    console.error(`Error loading tiers for ${serviceType}:`, error);
    return [];
  }
}

/**
 * Calculate total cost breakdown for all nodes
 */
export function calculateCostBreakdown(
  nodes: Node[],
  region?: string,
  pricingMode: PricingMode = 'payg'
): CostBreakdown {
  const targetRegion = region || getActiveRegion();
  // Initialize breakdown
  const breakdown: CostBreakdown = {
    totalMonthlyCost: 0,
    byService: [],
    byGroup: [],
    byCategory: [],
    region: targetRegion,
    currency: 'USD',
    lastCalculated: new Date().toISOString(),
    pricesAsOf: PRICING_DATA_AS_OF,
    pricingTerm: pricingMode === 'reserved1yr' ? '1-year estimate (mixed provenance)' : 'Pay-as-you-go estimate',
  };

  // Track costs by group and category
  const groupCosts = new Map<string, { label: string; cost: number; count: number }>();
  const categoryCosts = new Map<string, number>();

  // Calculate per-service costs
  nodes.forEach(node => {
    const pricing = node.data.pricing as NodePricingConfig | undefined;
    
    if (!pricing) return;

    const estimate = calculateNodeMonthlyCost(node.data.label || '', pricing, pricingMode);
    const cost = estimate.cost;
    breakdown.totalMonthlyCost += cost;

    // Add to service breakdown
    breakdown.byService.push({
      serviceName: node.data.label || 'Unnamed Service',
      serviceType: node.data.category || 'Other',
      nodeId: node.id,
      cost: cost,
      quantity: pricing.quantity,
      tier: pricing.tier,
      pricingSource: estimate.source,
    });

    // Track by group
    const groupId = node.data.groupId || 'ungrouped';
    if (!groupCosts.has(groupId)) {
      groupCosts.set(groupId, {
        label: node.data.groupLabel || 'Ungrouped',
        cost: 0,
        count: 0
      });
    }
    const groupData = groupCosts.get(groupId)!;
    groupData.cost += cost;
    groupData.count += 1;

    // Track by category
    const category = node.data.category || 'Other';
    categoryCosts.set(category, (categoryCosts.get(category) || 0) + cost);
  });

  // Convert group costs to array
  breakdown.byGroup = Array.from(groupCosts.entries()).map(([groupId, data]) => ({
    groupId,
    groupLabel: data.label,
    cost: data.cost,
    serviceCount: data.count
  }));

  // Convert category costs to array with percentages
  breakdown.byCategory = Array.from(categoryCosts.entries()).map(([category, cost]) => ({
    category,
    cost,
    percentage: breakdown.totalMonthlyCost > 0 ? (cost / breakdown.totalMonthlyCost) * 100 : 0
  }));

  // Sort all arrays by cost (descending)
  breakdown.byService.sort((a, b) => b.cost - a.cost);
  breakdown.byGroup.sort((a, b) => b.cost - a.cost);
  breakdown.byCategory.sort((a, b) => b.cost - a.cost);

  return breakdown;
}

/**
 * Refresh pricing for all nodes (when region changes)
 */
export async function refreshAllNodePricing(
  nodes: Node[],
  newRegion: string
): Promise<Node[]> {
  const updatedNodes: Node[] = [];

  for (const node of nodes) {
    if (node.data.pricing) {
      const serviceType = node.data.label || 'Unknown';
      const updatedPricing = await updateNodePricing(
        serviceType,
        node.data.pricing,
        node.data.pricing.tier,
        node.data.pricing.quantity,
        newRegion
      );

      updatedNodes.push({
        ...node,
        data: {
          ...node.data,
          pricing: updatedPricing
        }
      });
    } else {
      updatedNodes.push(node);
    }
  }

  return updatedNodes;
}

/**
 * Get cost summary text for export
 */
export function getCostSummaryText(breakdown: CostBreakdown): string {
  const lines: string[] = [];
  
  lines.push('=== COST ESTIMATION SUMMARY ===');
  lines.push('');
  lines.push(`Total Monthly Cost: $${breakdown.totalMonthlyCost.toFixed(2)}`);
  lines.push(`Region: ${breakdown.region}`);
  lines.push(`Currency: ${breakdown.currency}`);
  if (breakdown.pricingTerm) lines.push(`Pricing term: ${breakdown.pricingTerm}`);
  if (breakdown.pricesAsOf) {
    const f = getPricingFreshness(breakdown.pricesAsOf);
    lines.push(`Prices as of: ${breakdown.pricesAsOf}${f.isStale ? ` (⚠️ ${f.ageLabel} — refresh with "npm run pricing:refresh")` : ''}`);
  }
  lines.push(`Last Updated: ${new Date(breakdown.lastCalculated).toLocaleString()}`);
  lines.push('');
  
  lines.push('BY SERVICE:');
  breakdown.byService.forEach(svc => {
    lines.push(`  ${svc.serviceName} (${svc.tier}): $${svc.cost.toFixed(2)}/mo x${svc.quantity} [${svc.pricingSource || 'unknown'}]`);
  });
  lines.push('');
  
  lines.push('BY GROUP:');
  breakdown.byGroup.forEach(grp => {
    lines.push(`  ${grp.groupLabel}: $${grp.cost.toFixed(2)}/mo (${grp.serviceCount} services)`);
  });
  lines.push('');
  
  lines.push('BY CATEGORY:');
  breakdown.byCategory.forEach(cat => {
    lines.push(`  ${cat.category}: $${cat.cost.toFixed(2)}/mo (${cat.percentage.toFixed(1)}%)`);
  });
  
  return lines.join('\n');
}

/**
 * Get cost summary as Markdown for export.
 *
 * Produces a well-formatted Markdown document with headings and tables that
 * render correctly in GitHub, VS Code preview, Confluence, Teams, etc.
 */
export function getCostSummaryMarkdown(breakdown: CostBreakdown): string {
  const lines: string[] = [];
  const annual = breakdown.totalMonthlyCost * 12;

  lines.push('# Azure Architecture — Cost Estimation Summary');
  lines.push('');
  lines.push(`> **Total: \`$${breakdown.totalMonthlyCost.toFixed(2)}/mo\`** · **\`$${annual.toFixed(2)}/yr\`** · Region: \`${breakdown.region}\` · ${breakdown.currency}${breakdown.pricingTerm ? ` · ${breakdown.pricingTerm}` : ''}`);
  lines.push('');
  lines.push('| Field | Value |');
  lines.push('| --- | --- |');
  lines.push(`| Total monthly cost | **$${breakdown.totalMonthlyCost.toFixed(2)}** |`);
  lines.push(`| Annual projection | $${annual.toFixed(2)} |`);
  lines.push(`| Region | ${breakdown.region} |`);
  lines.push(`| Currency | ${breakdown.currency} |`);
  if (breakdown.pricingTerm) lines.push(`| Pricing term | ${breakdown.pricingTerm} |`);
  if (breakdown.pricesAsOf) lines.push(`| Prices as of | ${breakdown.pricesAsOf} |`);
  lines.push(`| Last updated | ${new Date(breakdown.lastCalculated).toLocaleString()} |`);
  lines.push('');

  lines.push('## By service');
  lines.push('');
  lines.push('| Service | Tier | Qty | Monthly cost | Pricing source |');
  lines.push('| --- | --- | ---: | ---: | --- |');
  breakdown.byService.forEach(svc => {
    lines.push(`| ${escapeMd(svc.serviceName)} | ${escapeMd(svc.tier)} | ${svc.quantity} | $${svc.cost.toFixed(2)} | ${escapeMd(svc.pricingSource || 'unknown')} |`);
  });
  lines.push(`| **Total** | | | **$${breakdown.totalMonthlyCost.toFixed(2)}** | |`);
  lines.push('');

  if (breakdown.byGroup.length > 0) {
    lines.push('## By group');
    lines.push('');
    lines.push('| Group | Services | Monthly cost |');
    lines.push('| --- | ---: | ---: |');
    breakdown.byGroup.forEach(grp => {
      lines.push(`| ${escapeMd(grp.groupLabel)} | ${grp.serviceCount} | $${grp.cost.toFixed(2)} |`);
    });
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('_Estimates are indicative. Usage-based services (e.g. Functions, OpenAI) may vary with actual consumption. Generated by Azure Architecture Diagram Builder._');

  return lines.join('\n');
}

/**
 * Escape characters that would break Markdown table cells.
 */
function escapeMd(value: string): string {
  return value.replace(/\|/g, '\\|');
}

/**
 * Export cost breakdown as CSV
 */
export function exportCostBreakdownCSV(breakdown: CostBreakdown, nodes?: Node[]): string {
  const lines: string[] = [];
  
  // Header
  lines.push('Azure Architecture Cost Breakdown');
  lines.push(`Total Monthly Cost,$${breakdown.totalMonthlyCost.toFixed(2)}`);
  lines.push(`Region,${breakdown.region}`);
  if (breakdown.pricingTerm) lines.push(`Pricing Term,${breakdown.pricingTerm}`);
  if (breakdown.pricesAsOf) lines.push(`Prices As Of,${breakdown.pricesAsOf}`);
  lines.push(`Date,${new Date(breakdown.lastCalculated).toLocaleDateString()}`);
  lines.push('');
  
  // By Service
  lines.push('Service Name,Service Type,Tier,Quantity,Monthly Cost,Pricing Type,Pricing Source');
  breakdown.byService.forEach(svc => {
    // Check if this service is usage-based
    const node = nodes?.find(n => n.id === svc.nodeId);
    const pricing = node?.data?.pricing as NodePricingConfig | undefined;
    const pricingType = pricing?.isUsageBased ? 'Usage-based (estimate)' : 'Fixed';
    
    lines.push(`"${svc.serviceName}",${svc.serviceType},${svc.tier},${svc.quantity},$${svc.cost.toFixed(2)},${pricingType},${svc.pricingSource || 'unknown'}`);
  });
  lines.push('');
  
  // By Group
  lines.push('Group Name,Service Count,Monthly Cost');
  breakdown.byGroup.forEach(grp => {
    lines.push(`"${grp.groupLabel}",${grp.serviceCount},$${grp.cost.toFixed(2)}`);
  });
  lines.push('');
  
  // By Category
  lines.push('Category,Monthly Cost,Percentage');
  breakdown.byCategory.forEach(cat => {
    lines.push(`${cat.category},$${cat.cost.toFixed(2)},${cat.percentage.toFixed(1)}%`);
  });
  
  return lines.join('\n');
}

/**
 * Export cost breakdown as JSON
 */
export function exportCostBreakdownJSON(breakdown: CostBreakdown): string {
  return JSON.stringify(breakdown, null, 2);
}
