/**
 * Cost Estimation Service
 * Core logic for calculating architecture costs
 */

import { Node } from 'reactflow';
import { 
  NodePricingConfig, 
  CostBreakdown, 
  ServicePricing 
} from '../types/pricing';
import { 
  getServicePricing, 
  calculateMonthlyCost 
} from './azurePricingService';
import { 
  getRegionalServicePricing,
  getActiveRegion,
  AzureRegion
} from './regionalPricingService';
import { 
  getAzureServiceName, 
  getDefaultTier, 
  getFallbackPricing,
  hasPricingData 
} from '../data/azurePricing';
import { 
  applyRegionalPricing, 
  getDefaultRegion 
} from '../utils/pricingHelpers';
import { getActiveRegion } from './regionalPricingService';

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
    
    // Try to fetch from API
    const pricing = await getServicePricing(serviceType, serviceName, targetRegion);
    
    if (pricing && pricing.tiers.length > 0) {
      // Use API data
      const tier = pricing.tiers.find(t => t.name === defaultTier) || pricing.tiers[0];
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
            isCustom: false
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
        isCustom: false
      };
    } else {
      // Fallback to static data
      const fallbackPrice = getFallbackPricing(serviceType, 'standard');
      const basePrice = applyRegionalPricing(fallbackPrice, targetRegion);
      console.log('  💾 Using fallback pricing:', basePrice, '/mo');
      
      return {
        estimatedCost: basePrice,
        tier: 'Standard',
        skuName: 'Standard',
        quantity: 1,
        region: targetRegion,
        unit: 'per instance/month',
        lastUpdated: new Date().toISOString(),
        isCustom: false
      };
    }
  } catch (error) {
    console.error(`Error initializing pricing for ${serviceType}:`, error);
    
    // Final fallback
    const fallbackPrice = getFallbackPricing(serviceType, 'standard');
    const basePrice = applyRegionalPricing(fallbackPrice, targetRegion);
    
    return {
      estimatedCost: basePrice,
      tier: 'Standard',
      skuName: 'Standard',
      quantity: 1,
      region: targetRegion,
      unit: 'per instance/month',
      lastUpdated: new Date().toISOString(),
      isCustom: false
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
      const cost = calculateMonthlyCost(pricing, tier, quantity);
      
      return {
        ...currentConfig,
        estimatedCost: cost,
        tier,
        quantity,
        region,
        lastUpdated: new Date().toISOString(),
        isCustom: false
      };
    } else {
      // Fallback calculation
      const tierLevel = tier.toLowerCase().includes('premium') ? 'premium' :
                       tier.toLowerCase().includes('basic') ? 'basic' : 'standard';
      const fallbackPrice = getFallbackPricing(serviceType, tierLevel);
      const basePrice = applyRegionalPricing(fallbackPrice, region);
      
      return {
        ...currentConfig,
        estimatedCost: basePrice * quantity,
        tier,
        quantity,
        region,
        lastUpdated: new Date().toISOString(),
        isCustom: false
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
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Calculate total cost breakdown for all nodes
 */
export function calculateCostBreakdown(
  nodes: Node[],
  region?: string
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
    lastCalculated: new Date().toISOString()
  };

  // Track costs by group and category
  const groupCosts = new Map<string, { label: string; cost: number; count: number }>();
  const categoryCosts = new Map<string, number>();

  // Calculate per-service costs
  nodes.forEach(node => {
    const pricing = node.data.pricing as NodePricingConfig | undefined;
    
    if (!pricing) return;

    const cost = pricing.estimatedCost * pricing.quantity;
    breakdown.totalMonthlyCost += cost;

    // Add to service breakdown
    breakdown.byService.push({
      serviceName: node.data.label || 'Unnamed Service',
      serviceType: node.data.category || 'Other',
      nodeId: node.id,
      cost: cost,
      quantity: pricing.quantity,
      tier: pricing.tier
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
  lines.push(`Last Updated: ${new Date(breakdown.lastCalculated).toLocaleString()}`);
  lines.push('');
  
  lines.push('BY SERVICE:');
  breakdown.byService.forEach(svc => {
    lines.push(`  ${svc.serviceName} (${svc.tier}): $${svc.cost.toFixed(2)}/mo x${svc.quantity}`);
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
 * Export cost breakdown as CSV
 */
export function exportCostBreakdownCSV(breakdown: CostBreakdown): string {
  const lines: string[] = [];
  
  // Header
  lines.push('Azure Architecture Cost Breakdown');
  lines.push(`Total Monthly Cost,$${breakdown.totalMonthlyCost.toFixed(2)}`);
  lines.push(`Region,${breakdown.region}`);
  lines.push(`Date,${new Date(breakdown.lastCalculated).toLocaleDateString()}`);
  lines.push('');
  
  // By Service
  lines.push('Service Name,Service Type,Tier,Quantity,Monthly Cost');
  breakdown.byService.forEach(svc => {
    lines.push(`"${svc.serviceName}",${svc.serviceType},${svc.tier},${svc.quantity},$${svc.cost.toFixed(2)}`);
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
