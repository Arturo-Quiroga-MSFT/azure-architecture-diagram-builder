// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Local Pricing Service
 * Now delegates to Regional Pricing Service for multi-region support
 * Maintained for backward compatibility
 */

import { ServicePricing } from '../types/pricing';
import { 
  getRegionalServicePricing, 
  getActiveRegion,
  AzureRegion 
} from './regionalPricingService';

/**
 * Get pricing for a service (uses current active region)
 * @deprecated Use getRegionalServicePricing directly for better control
 */
export async function getLocalServicePricing(
  _serviceType: string,
  serviceName: string,
  region?: string
): Promise<ServicePricing | null> {
  // Convert region string to AzureRegion type if provided
  const targetRegion = region as AzureRegion | undefined;
  return getRegionalServicePricing(serviceName, targetRegion);
}

/**
 * Get available services
 */
export function getAvailableServices(): string[] {
  return [
    'Azure App Service',
    'Virtual Machines',
    'Azure Cosmos DB',
    'Storage',
    'SQL Database',
    'Azure Kubernetes Service',
    'Container Instances',
    'Application Gateway',
    'Azure Machine Learning',
  ];
}

/**
 * Get available regions
 */
export function getAvailableRegions(): string[] {
  return ['eastus2', 'canadacentral', 'brazilsouth', 'westeurope', 'swedencentral'];
}

/**
 * Get pricing summary
 */
export function getLocalPricingSummary(): {
  region: string;
  servicesAvailable: number;
} {
  return {
    region: getActiveRegion(),
    servicesAvailable: getAvailableServices().length,
  };
}

/**
 * Search for services by name
 */
export function searchServices(query: string): string[] {
  const lowerQuery = query.toLowerCase();
  return getAvailableServices().filter(service => 
    service.toLowerCase().includes(lowerQuery)
  );
}
