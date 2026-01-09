/**
 * Azure Service Pricing Mappings
 * Maps our service types to Azure Retail Prices API service names
 * Also provides fallback pricing for offline scenarios
 */

/**
 * Map service types to Azure API service names
 */
export const SERVICE_NAME_MAPPING: Record<string, string> = {
  // App Services (handle both singular and plural)
  'App Service': 'Azure App Service',
  'App Services': 'Azure App Service',
  'Static Web Apps': 'Static Web Apps',
  'Azure Static Web Apps': 'Static Web Apps',
  'Azure Static Web App': 'Static Web Apps',
  'Static Web App': 'Static Web Apps',
  'Function App': 'Azure Functions',
  'Function Apps': 'Azure Functions',
  'Logic Apps': 'Logic Apps',
  'Logic App': 'Logic Apps',
  'API Management': 'API Management',
  
  // Compute
  'Virtual Machine': 'Virtual Machines',
  'Virtual Machines': 'Virtual Machines',
  'VM Scale Sets': 'Virtual Machine Scale Sets',
  'Batch': 'Azure Batch',
  
  // Containers
  'Container Registry': 'Container Registry',
  'Container Registries': 'Container Registry',
  'Container Instances': 'Container Instances',
  'Container Instance': 'Container Instances',
  'Azure Kubernetes Service': 'Azure Kubernetes Service',
  'AKS': 'Azure Kubernetes Service',
  'Kubernetes Service': 'Azure Kubernetes Service',
  'Kubernetes Services': 'Azure Kubernetes Service',
  
  // Databases (handle icon name variations - iconLoader title-cases file names)
  'SQL Database': 'SQL Database',
  'Azure SQL Database': 'SQL Database',
  'Azure Sql': 'SQL Database',  // From icon: Azure-SQL.svg
  'Azure SQL': 'SQL Database',
  'Cosmos DB': 'Azure Cosmos DB',
  'Azure Cosmos DB': 'Azure Cosmos DB',
  'Azure Cosmos Db': 'Azure Cosmos DB',  // From icon: Azure-Cosmos-DB.svg (title-cased)
  'MySQL': 'Azure Database for MySQL',
  'PostgreSQL': 'Azure Database for PostgreSQL',
  'Azure Database for PostgreSQL': 'Azure Database for PostgreSQL',
  'Redis': 'Azure Cache for Redis',
  'Redis Cache': 'Redis Cache',
  'Azure Cache for Redis': 'Azure Cache for Redis',
  
  // Storage
  'Storage Account': 'Storage',
  'Storage Accounts': 'Storage',
  'Storage Accounts (Classic)': 'Storage',
  'Blob Storage': 'Storage',
  'File Storage': 'Storage',
  'Queue Storage': 'Storage',
  'Table Storage': 'Storage',
  'Azure Blob Storage': 'Storage',
  
  // Networking
  'Virtual Network': 'Virtual Network',
  'Application Gateway': 'Application Gateway',
  'Application Gateways': 'Application Gateway',
  'Application Gateway Containers': 'Application Gateway',
  'Load Balancer': 'Azure Load Balancer',
  'Load Balancers': 'Azure Load Balancer',
  'VPN Gateway': 'VPN Gateway',
  'Front Door': 'Azure Front Door Service',
  'Azure Front Door': 'Azure Front Door Service',
  'Azure Front Door Service': 'Azure Front Door Service',
  'CDN': 'Content Delivery Network',
  'Azure CDN': 'Content Delivery Network',
  'Azure Content Delivery Network': 'Content Delivery Network',
  'Content Delivery Network': 'Content Delivery Network',
  'Traffic Manager': 'Azure Traffic Manager',
  
  // Analytics
  'Stream Analytics': 'Azure Stream Analytics',
  'Data Factory': 'Azure Data Factory',
  'Synapse Analytics': 'Azure Synapse Analytics',
  'Event Hubs': 'Azure Event Hubs',
  'Data Lake': 'Azure Data Lake Storage',
  
  // AI & Machine Learning
  'Machine Learning': 'Azure Machine Learning',
  'Cognitive Services': 'Cognitive Services',
  'OpenAI': 'Azure OpenAI',
  'Azure OpenAI': 'Azure OpenAI',
  'Bot Service': 'Azure Bot Service',
  
  // Identity & Security
  'Active Directory': 'Azure Active Directory',
  'Key Vault': 'Key Vault',
  'Azure Key Vault': 'Key Vault',
  
  // Monitoring
  'Application Insights': 'Application Insights',
  'Log Analytics': 'Azure Monitor',
  'Log Analytics Workspace': 'Log Analytics',
  'Azure Monitor': 'Azure Monitor',
  
  // IoT
  'IoT Hub': 'Azure IoT Hub',
  'IoT Central': 'Azure IoT Central',
  
  // Integration
  'Service Bus': 'Azure Service Bus',
  'Azure Service Bus': 'Azure Service Bus',
  'Event Grid': 'Azure Event Grid',
  'SignalR': 'Azure SignalR Service',
  'Azure SignalR Service': 'Azure SignalR Service',
};

/**
 * Default tier recommendations for each service
 */
export const DEFAULT_TIERS: Record<string, string> = {
  'App Service': 'S1',
  'App Services': 'S1',
  'Static Web Apps': 'Standard',
  'Azure Static Web Apps': 'Standard',
  'Azure Static Web App': 'Standard',
  'Function Apps': 'Premium',
  'SQL Database': 'S1',
  'Cosmos DB': 'Standard',
  'Storage': 'Hot LRS',
  'Storage Account': 'Hot LRS',
  'Storage Accounts': 'Hot LRS',
  'Storage Accounts (Classic)': 'Hot LRS',
  'Blob Storage': 'Hot LRS',
  'Azure Blob Storage': 'Hot LRS',
  'PostgreSQL': 'GP_Gen5_2',
  'Azure Database for PostgreSQL': 'GP_Gen5_2',
  'Log Analytics': 'PerGB2018',
  'Log Analytics Workspace': 'PerGB2018',
  'Virtual Machines': 'D2s_v3',
  'AKS': 'Standard',
  'Application Gateway': 'Standard_v2',
  'Azure Cache for Redis': 'C1',
  'API Management': 'Developer',
  'Azure API Management': 'Developer',
  'CDN': 'Standard_Microsoft',
  'Azure CDN': 'Standard_Microsoft',
  'Content Delivery Network': 'Standard_Microsoft',
};

/**
 * Fallback pricing estimates (in USD/month) for offline scenarios
 * Based on common configurations, last updated: January 2026
 */
export const FALLBACK_PRICING: Record<string, { 
  basic: number; 
  standard: number; 
  premium: number;
  unit: string;
}> = {
  'App Service': {
    basic: 13.14,
    standard: 69.35,
    premium: 146.00,
    unit: 'per instance/month'
  },
  'Function Apps': {
    basic: 0, // Consumption plan
    standard: 159.35, // Premium EP1
    premium: 318.70, // Premium EP2
    unit: 'per instance/month'
  },
  'Virtual Machines': {
    basic: 29.20, // B2s
    standard: 70.08, // D2s_v3
    premium: 140.16, // D4s_v3
    unit: 'per instance/month'
  },
  'SQL Database': {
    basic: 4.90,
    standard: 29.40, // S1
    premium: 465.00, // P1
    unit: 'per database/month'
  },
  'Cosmos DB': {
    basic: 23.36, // 400 RU/s
    standard: 58.40, // 1000 RU/s
    premium: 584.00, // 10000 RU/s
    unit: 'per container/month'
  },
  'Storage': {
    basic: 0.02, // per GB
    standard: 0.02, // per GB
    premium: 0.15, // per GB (Premium)
    unit: 'per GB/month'
  },
  'Storage Account': {
    basic: 14.60, // ~1TB
    standard: 14.60, // ~1TB
    premium: 109.50, // ~1TB Premium
    unit: 'per account/month'
  },
  'Storage Accounts': {
    basic: 14.60, // ~1TB
    standard: 14.60, // ~1TB
    premium: 109.50, // ~1TB Premium
    unit: 'per account/month'
  },
  'Storage Accounts (Classic)': {
    basic: 14.60, // ~1TB
    standard: 14.60, // ~1TB
    premium: 109.50, // ~1TB Premium
    unit: 'per account/month'
  },
  'Blob Storage': {
    basic: 14.60, // ~1TB
    standard: 14.60, // ~1TB
    premium: 109.50, // ~1TB Premium
    unit: 'per account/month'
  },
  'Azure Blob Storage': {
    basic: 14.60, // ~1TB
    standard: 14.60, // ~1TB
    premium: 109.50, // ~1TB Premium
    unit: 'per account/month'
  },
  'AKS': {
    basic: 0, // Free tier
    standard: 73.00,
    premium: 146.00,
    unit: 'per cluster/month'
  },
  'Azure Cache for Redis': {
    basic: 16.06, // C1
    standard: 64.24, // C2
    premium: 256.96, // C4
    unit: 'per instance/month'
  },
  'PostgreSQL': {
    basic: 28.47, // B_Gen5_1
    standard: 109.86, // GP_Gen5_2
    premium: 438.36, // GP_Gen5_8
    unit: 'per server/month'
  },
  'Azure Database for PostgreSQL': {
    basic: 28.47, // B_Gen5_1
    standard: 109.86, // GP_Gen5_2
    premium: 438.36, // GP_Gen5_8
    unit: 'per server/month'
  },
  'Static Web Apps': {
    basic: 0, // Free tier
    standard: 9.00, // Standard tier
    premium: 9.00, // Standard tier
    unit: 'per app/month'
  },
  'Azure Static Web Apps': {
    basic: 0, // Free tier
    standard: 9.00, // Standard tier
    premium: 9.00, // Standard tier
    unit: 'per app/month'
  },
  'Azure Static Web App': {
    basic: 0, // Free tier
    standard: 9.00, // Standard tier
    premium: 9.00, // Standard tier
    unit: 'per app/month'
  },
  'Log Analytics': {
    basic: 2.30, // Per GB ingested
    standard: 2.30, // Per GB ingested
    premium: 2.30, // Per GB ingested
    unit: 'per GB/month'
  },
  'Log Analytics Workspace': {
    basic: 2.30, // Per GB ingested
    standard: 2.30, // Per GB ingested
    premium: 2.30, // Per GB ingested
    unit: 'per GB/month'
  },
  'API Management': {
    basic: 0, // Consumption (pay per call)
    standard: 50.26, // Developer tier
    premium: 696.55, // Standard tier
    unit: 'per instance/month'
  },
  'Azure API Management': {
    basic: 0, // Consumption (pay per call)
    standard: 50.26, // Developer tier
    premium: 696.55, // Standard tier
    unit: 'per instance/month'
  },
  'CDN': {
    basic: 0.087, // Per GB (first 10TB)
    standard: 0.087, // Per GB
    premium: 0.25, // Per GB (Premium)
    unit: 'per GB/month'
  },
  'Azure CDN': {
    basic: 0.087, // Per GB (first 10TB)
    standard: 0.087, // Per GB
    premium: 0.25, // Per GB (Premium)
    unit: 'per GB/month'
  },
  'Content Delivery Network': {
    basic: 8.70, // ~100GB
    standard: 8.70, // ~100GB
    premium: 25.00, // ~100GB Premium
    unit: 'per account/month'
  },
  'Azure Front Door': {
    basic: 35.00, // Standard tier
    standard: 35.00, // Standard tier
    premium: 330.00, // Premium tier
    unit: 'per instance/month'
  },
  'Azure Front Door Service': {
    basic: 35.00, // Standard tier
    standard: 35.00, // Standard tier
    premium: 330.00, // Premium tier
    unit: 'per instance/month'
  },
  'Application Gateway': {
    basic: 0,
    standard: 162.00, // v2 Standard
    premium: 425.00, // v2 WAF
    unit: 'per gateway/month'
  },
  'Azure Kubernetes Service': {
    basic: 0,
    standard: 73.00,
    premium: 146.00,
    unit: 'per cluster/month'
  },
  'Key Vault': {
    basic: 0, // Operations based
    standard: 1.50, // Estimated for typical usage
    premium: 5.00, // With HSM
    unit: 'per vault/month'
  },
  'Application Insights': {
    basic: 0, // First 5GB free
    standard: 2.30, // per GB
    premium: 2.30, // per GB
    unit: 'per GB/month'
  },
  'Service Bus': {
    basic: 0.05,
    standard: 9.81,
    premium: 677.53,
    unit: 'per namespace/month'
  },
  'Front Door': {
    basic: 35.04,
    standard: 35.04, // Standard tier
    premium: 329.85, // Premium tier
    unit: 'per profile/month'
  },
  'CDN': {
    basic: 0, // Usage based
    standard: 0.081, // per GB
    premium: 0.147, // per GB
    unit: 'per GB/month'
  },
};

/**
 * Get Azure API service name for a given service type
 */
export function getAzureServiceName(serviceType: string): string {
  return SERVICE_NAME_MAPPING[serviceType] || serviceType;
}

/**
 * Get default tier for a service
 */
export function getDefaultTier(serviceType: string): string {
  return DEFAULT_TIERS[serviceType] || 'Standard';
}

/**
 * Get fallback pricing for a service
 */
export function getFallbackPricing(serviceType: string, tier: 'basic' | 'standard' | 'premium' = 'standard'): number {
  const pricing = FALLBACK_PRICING[serviceType];
  if (!pricing) {
    console.warn(`No fallback pricing found for ${serviceType}`);
    return 0;
  }
  return pricing[tier];
}

/**
 * Check if service has pricing data available
 */
export function hasPricingData(serviceType: string): boolean {
  return serviceType in FALLBACK_PRICING || serviceType in SERVICE_NAME_MAPPING;
}

/**
 * Get all supported services
 */
export function getSupportedServices(): string[] {
  return Object.keys(FALLBACK_PRICING).sort();
}
