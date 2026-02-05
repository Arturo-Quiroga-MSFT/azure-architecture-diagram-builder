/**
 * Service to Icon Mapping
 * Maps Azure service names to their icon files and indicates pricing data availability
 * This helps AI-generated diagrams use the correct icons and validates pricing support
 */

export interface ServiceIconMapping {
  /** Display name of the service */
  displayName: string;
  /** Service name variations that AI might use */
  aliases: string[];
  /** Icon filename (without path or extension) */
  iconFile: string;
  /** Category/folder in icon library */
  category: 'ai + machine learning' | 'compute' | 'databases' | 'storage' | 'networking' | 'web' | 'analytics' | 'containers' | 'integration' | 'identity' | 'management + governance' | 'iot' | 'monitor' | 'security';
  /** Whether we have real pricing data for this service */
  hasPricingData: boolean;
  /** Service name used in pricing files (if hasPricingData is true) */
  pricingServiceName?: string;
  /** Whether this is a usage-based service */
  isUsageBased?: boolean;
  /** Typical monthly cost range (for reference) */
  costRange?: string;
}

/**
 * Comprehensive service-to-icon mapping with pricing data availability
 */
export const SERVICE_ICON_MAP: Record<string, ServiceIconMapping> = {
  // ========================================
  // AI & Machine Learning Services
  // ========================================
  'Azure OpenAI': {
    displayName: 'Azure OpenAI',
    aliases: ['OpenAI', 'Azure OpenAI Service', 'GPT', 'ChatGPT'],
    iconFile: 'azure-openai',
    category: 'ai + machine learning',
    hasPricingData: true,
    pricingServiceName: 'Azure OpenAI',
    isUsageBased: true,
    costRange: '$1-200/mo (token-based)'
  },
  
  'Cognitive Services': {
    displayName: 'Cognitive Services',
    aliases: ['Azure Cognitive Services', 'Cognitive Service'],
    iconFile: 'cognitive-services',
    category: 'ai + machine learning',
    hasPricingData: true,
    pricingServiceName: 'Cognitive Services',
    isUsageBased: true,
    costRange: '$0-500/mo (varies by service)'
  },
  
  'Computer Vision': {
    displayName: 'Computer Vision',
    aliases: ['Vision', 'Azure Vision', 'Azure AI Vision', 'Image Analysis'],
    iconFile: 'computer-vision',
    category: 'ai + machine learning',
    hasPricingData: true,
    pricingServiceName: 'Vision',
    isUsageBased: true,
    costRange: '$150-1500/mo'
  },
  
  'Custom Vision': {
    displayName: 'Custom Vision',
    aliases: ['Azure Custom Vision', 'Custom Vision Service'],
    iconFile: 'custom-vision',
    category: 'ai + machine learning',
    hasPricingData: true,
    pricingServiceName: 'Custom Vision',
    isUsageBased: true,
    costRange: '$0-300/mo'
  },
  
  'Speech Services': {
    displayName: 'Speech Services',
    aliases: ['Speech', 'Azure Speech', 'Azure AI Speech', 'Speech-to-Text', 'Text-to-Speech'],
    iconFile: 'azure-speech',
    category: 'ai + machine learning',
    hasPricingData: true,
    pricingServiceName: 'Speech',
    isUsageBased: true,
    costRange: '$100-1000/mo'
  },
  
  'Translator': {
    displayName: 'Translator',
    aliases: ['Translator Text', 'Azure Translator', 'Azure AI Translator', 'Translation'],
    iconFile: 'translator',
    category: 'ai + machine learning',
    hasPricingData: true,
    pricingServiceName: 'Translator',
    isUsageBased: true,
    costRange: '$100-1000/mo'
  },
  
  'Language': {
    displayName: 'Language',
    aliases: ['Azure Language', 'Azure AI Language', 'Text Analytics', 'NLP'],
    iconFile: 'language',
    category: 'ai + machine learning',
    hasPricingData: true,
    pricingServiceName: 'Language',
    isUsageBased: true,
    costRange: '$25-250/mo'
  },
  
  'Document Intelligence': {
    displayName: 'Document Intelligence',
    aliases: ['Form Recognizer', 'Azure Document Intelligence', 'Azure AI Document Intelligence', 'Form Processing'],
    iconFile: 'document-intelligence',
    category: 'ai + machine learning',
    hasPricingData: true,
    pricingServiceName: 'Document Intelligence',
    isUsageBased: true,
    costRange: '$0-500/mo'
  },
  
  'Azure Machine Learning': {
    displayName: 'Azure Machine Learning',
    aliases: [
      'Machine Learning', 
      'ML', 
      'AML', 
      'Azure ML',
      'AML Workspace',
      'Azure Machine Learning Workspace',
      'Machine Learning Workspace',
      'ML Workspace',
      'Azure ML Workspace',
      'Machine Learning Service',
      'Azure Machine Learning Service',
      'AzureML'
    ],
    iconFile: 'azure-machine-learning',
    category: 'ai + machine learning',
    hasPricingData: true,
    pricingServiceName: 'Azure Machine Learning',
    isUsageBased: true,
    costRange: '$0-5000/mo (varies greatly)'
  },
  
  // AML Sub-components (granular architecture support)
  // These allow architects to break down AML into logical components
  // with accurate cost attribution (endpoints/deployments are $0, compute has cost)
  
  'AML Online Endpoint': {
    displayName: 'AML Online Endpoint',
    aliases: ['Online Endpoint', 'AML Endpoint', 'Managed Online Endpoint', 'Real-time Endpoint'],
    iconFile: 'azure-machine-learning',
    category: 'ai + machine learning',
    hasPricingData: false, // No direct cost - routing construct only
    isUsageBased: false,
    costRange: '$0 (routing only)'
  },
  
  'AML Batch Endpoint': {
    displayName: 'AML Batch Endpoint',
    aliases: ['Batch Endpoint', 'AML Batch', 'Batch Inference Endpoint'],
    iconFile: 'azure-machine-learning',
    category: 'ai + machine learning',
    hasPricingData: false, // No direct cost - routing construct only
    isUsageBased: false,
    costRange: '$0 (routing only)'
  },
  
  'AML Deployment': {
    displayName: 'AML Deployment',
    aliases: ['Online Deployment', 'Batch Deployment', 'Model Deployment', 'Managed Deployment', 'Shared Deployment', 'Dedicated Deployment'],
    iconFile: 'azure-machine-learning',
    category: 'ai + machine learning',
    hasPricingData: false, // Configuration only - compute cost is separate
    isUsageBased: false,
    costRange: '$0 (config only)'
  },
  
  'AML Managed Compute': {
    displayName: 'AML Managed Compute',
    aliases: ['AML Compute', 'ML Compute', 'Managed Compute', 'AML Compute Instance', 'Compute Instance', 'AML Managed Compute (CPU/GPU)', 'Managed Compute (CPU/GPU)'],
    iconFile: 'virtual-machines',
    category: 'compute',
    hasPricingData: true,
    pricingServiceName: 'Virtual Machines',
    isUsageBased: false,
    costRange: '$50-2000/mo (per instance)'
  },
  
  'Batch Compute Pool': {
    displayName: 'Batch Compute Pool',
    aliases: ['Batch Pool', 'AML Batch Compute', 'Batch Compute', 'Dedicated Batch Compute', 'Batch Compute (auto-scale)'],
    iconFile: '10031-icon-service-Batch-Accounts',
    category: 'compute',
    hasPricingData: true,
    pricingServiceName: 'Batch',
    isUsageBased: true,
    costRange: '$0-2000/mo (scale-to-zero capable)'
  },
  
  'Azure Cognitive Search': {
    displayName: 'Azure Cognitive Search',
    aliases: ['Cognitive Search', 'Azure Search', 'AI Search'],
    iconFile: 'azure-cognitive-search',
    category: 'ai + machine learning',
    hasPricingData: false,
    isUsageBased: false,
    costRange: '$75-2500/mo'
  },
  
  // ========================================
  // Compute Services
  // ========================================
  'Virtual Machines': {
    displayName: 'Virtual Machines',
    aliases: ['VM', 'VMs', 'Virtual Machine', 'Azure VM'],
    iconFile: 'virtual-machines',
    category: 'compute',
    hasPricingData: true,
    pricingServiceName: 'Virtual Machines',
    isUsageBased: false,
    costRange: '$13-17340/mo (per instance)'
  },
  
  'App Service': {
    displayName: 'App Service',
    aliases: ['Azure App Service', 'Web App', 'App Services'],
    iconFile: 'app-service',
    category: 'web',
    hasPricingData: true,
    pricingServiceName: 'Azure App Service',
    isUsageBased: false,
    costRange: '$13-730/mo (per instance)'
  },
  
  'Functions': {
    displayName: 'Azure Functions',
    aliases: ['Function App', 'Functions', 'Serverless Functions'],
    iconFile: 'azure-functions',
    category: 'compute',
    hasPricingData: true,
    pricingServiceName: 'Functions',
    isUsageBased: true,
    costRange: '$0-160/mo (consumption-based)'
  },
  
  'Container Instances': {
    displayName: 'Container Instances',
    aliases: ['ACI', 'Azure Container Instances', 'Container Instance'],
    iconFile: 'container-instances',
    category: 'containers',
    hasPricingData: true,
    pricingServiceName: 'Container Instances',
    isUsageBased: true,
    costRange: '$0-500/mo (per-second billing)'
  },
  
  'Kubernetes Service': {
    displayName: 'Azure Kubernetes Service',
    aliases: ['AKS', 'Kubernetes', 'K8s'],
    iconFile: 'azure-kubernetes-service',
    category: 'containers',
    hasPricingData: true,
    pricingServiceName: 'Azure Kubernetes Service',
    isUsageBased: false,
    costRange: '$73/mo + node costs'
  },
  
  'Container Registry': {
    displayName: 'Container Registry',
    aliases: ['ACR', 'Azure Container Registry'],
    iconFile: 'container-registry',
    category: 'containers',
    hasPricingData: true,
    pricingServiceName: 'Container Registry',
    isUsageBased: false,
    costRange: '$5-1000/mo'
  },
  
  // ========================================
  // Databases
  // ========================================
  'Azure Cosmos DB': {
    displayName: 'Azure Cosmos DB',
    aliases: ['Cosmos DB', 'CosmosDB', 'Cosmos'],
    iconFile: 'azure-cosmos-db',
    category: 'databases',
    hasPricingData: true,
    pricingServiceName: 'Azure Cosmos DB',
    isUsageBased: true,
    costRange: '$24-29185/mo'
  },
  
  'SQL Database': {
    displayName: 'SQL Database',
    aliases: ['Azure SQL', 'Azure SQL Database', 'SQL DB'],
    iconFile: 'sql-database',
    category: 'databases',
    hasPricingData: true,
    pricingServiceName: 'SQL Database',
    isUsageBased: false,
    costRange: '$5-43800/mo'
  },
  
  'PostgreSQL': {
    displayName: 'Azure Database for PostgreSQL',
    aliases: ['PostgreSQL', 'Postgres', 'Azure PostgreSQL'],
    iconFile: 'azure-database-postgresql',
    category: 'databases',
    hasPricingData: true,
    pricingServiceName: 'Azure Database for PostgreSQL',
    isUsageBased: false,
    costRange: '$5-11240/mo'
  },
  
  'MySQL': {
    displayName: 'Azure Database for MySQL',
    aliases: ['MySQL', 'Azure MySQL', 'Azure Database for MySQL'],
    iconFile: 'azure-database-mysql',
    category: 'databases',
    hasPricingData: true,
    pricingServiceName: 'Azure Database for MySQL',
    isUsageBased: false,
    costRange: '$5-9800/mo'
  },
  
  'Redis Cache': {
    displayName: 'Azure Cache for Redis',
    aliases: ['Redis', 'Redis Cache', 'Cache'],
    iconFile: 'redis-cache',
    category: 'databases',
    hasPricingData: true,
    pricingServiceName: 'Redis Cache',
    isUsageBased: false,
    costRange: '$16-13600/mo'
  },
  
  // ========================================
  // Storage
  // ========================================
  'Storage Account': {
    displayName: 'Storage Account',
    aliases: ['Storage', 'Blob Storage', 'Azure Storage', 'Storage Accounts'],
    iconFile: 'storage-account',
    category: 'storage',
    hasPricingData: true,
    pricingServiceName: 'Storage',
    isUsageBased: true,
    costRange: '$0.02-184/mo (per GB)'
  },
  
  // ========================================
  // Networking
  // ========================================
  'Application Gateway': {
    displayName: 'Application Gateway',
    aliases: ['App Gateway', 'Azure Application Gateway'],
    iconFile: 'application-gateway',
    category: 'networking',
    hasPricingData: true,
    pricingServiceName: 'Application Gateway',
    isUsageBased: false,
    costRange: '$125-1200/mo'
  },
  
  'Azure Front Door': {
    displayName: 'Azure Front Door',
    aliases: ['Front Door', 'AFD'],
    iconFile: 'azure-front-door',
    category: 'networking',
    hasPricingData: true,
    pricingServiceName: 'Azure Front Door Service',
    isUsageBased: true,
    costRange: '$35-412/mo + traffic'
  },
  
  'CDN': {
    displayName: 'Content Delivery Network',
    aliases: ['Azure CDN', 'CDN', 'Content Delivery'],
    iconFile: 'cdn-profiles',
    category: 'networking',
    hasPricingData: true,
    pricingServiceName: 'Content Delivery Network',
    isUsageBased: true,
    costRange: '$0.081-0.20 per GB'
  },
  
  // ========================================
  // Analytics & Data
  // ========================================
  'Data Factory': {
    displayName: 'Azure Data Factory',
    aliases: ['Data Factory', 'ADF'],
    iconFile: 'data-factory',
    category: 'analytics',
    hasPricingData: true,
    pricingServiceName: 'Azure Data Factory',
    isUsageBased: true,
    costRange: '$0.50-2.50 per 1000 activities'
  },
  
  'Azure Synapse Analytics': {
    displayName: 'Azure Synapse Analytics',
    aliases: ['Synapse', 'Synapse Analytics', 'Azure Synapse'],
    iconFile: 'azure-synapse-analytics',
    category: 'analytics',
    hasPricingData: true,
    pricingServiceName: 'Azure Synapse Analytics',
    isUsageBased: true,
    costRange: '$5-8000/mo + compute'
  },
  
  'Stream Analytics': {
    displayName: 'Azure Stream Analytics',
    aliases: ['Stream Analytics', 'ASA'],
    iconFile: 'stream-analytics',
    category: 'analytics',
    hasPricingData: true,
    pricingServiceName: 'Stream Analytics',
    isUsageBased: true,
    costRange: '$0.11 per streaming unit/hour'
  },
  
  'Event Hubs': {
    displayName: 'Event Hubs',
    aliases: ['Azure Event Hubs', 'Event Hub'],
    iconFile: 'event-hubs',
    category: 'integration',
    hasPricingData: true,
    pricingServiceName: 'Event Hubs',
    isUsageBased: true,
    costRange: '$11-6849/mo'
  },
  
  // ========================================
  // Integration
  // ========================================
  'Service Bus': {
    displayName: 'Service Bus',
    aliases: ['Azure Service Bus', 'Message Queue'],
    iconFile: 'service-bus',
    category: 'integration',
    hasPricingData: true,
    pricingServiceName: 'Service Bus',
    isUsageBased: true,
    costRange: '$0-10/mo + messages'
  },
  
  'Logic Apps': {
    displayName: 'Logic Apps',
    aliases: ['Azure Logic Apps', 'Logic App'],
    iconFile: 'logic-apps',
    category: 'integration',
    hasPricingData: true,
    pricingServiceName: 'Logic Apps',
    isUsageBased: true,
    costRange: '$0-1000/mo (per action)'
  },
  
  // ========================================
  // Management & Security
  // ========================================
  'Key Vault': {
    displayName: 'Key Vault',
    aliases: ['Azure Key Vault', 'Secrets Management'],
    iconFile: 'key-vault',
    category: 'security',
    hasPricingData: true,
    pricingServiceName: 'Key Vault',
    isUsageBased: true,
    costRange: '$0.03 per 10K operations'
  },
  
  'Application Insights': {
    displayName: 'Application Insights',
    aliases: ['App Insights', 'Azure Application Insights', 'Monitoring'],
    iconFile: 'application-insights',
    category: 'monitor',
    hasPricingData: true,
    pricingServiceName: 'Application Insights',
    isUsageBased: true,
    costRange: '$2.30 per GB ingested'
  },
    'Log Analytics': {
    displayName: 'Log Analytics',
    aliases: ['Azure Log Analytics', 'LA', 'Log Analytics Workspace'],
    iconFile: 'log-analytics',
    category: 'monitor',
    hasPricingData: true,
    pricingServiceName: 'Log Analytics',
    isUsageBased: true,
    costRange: '$2.76 per GB ingested'
  },
    'API Management': {
    displayName: 'API Management',
    aliases: ['APIM', 'Azure API Management', 'API Gateway'],
    iconFile: 'api-management',
    category: 'integration',
    hasPricingData: true,
    pricingServiceName: 'API Management',
    isUsageBased: false,
    costRange: '$50-2800/mo'
  },
};

/**
 * Get icon mapping for a service by name (case-insensitive, checks aliases)
 */
export function getServiceIconMapping(serviceName: string): ServiceIconMapping | null {
  const normalizedName = serviceName.trim();
  
  // Direct match
  if (SERVICE_ICON_MAP[normalizedName]) {
    return SERVICE_ICON_MAP[normalizedName];
  }
  
  // Search by alias (case-insensitive)
  const lowerName = normalizedName.toLowerCase();
  for (const mapping of Object.values(SERVICE_ICON_MAP)) {
    if (mapping.aliases.some(alias => alias.toLowerCase() === lowerName)) {
      return mapping;
    }
  }
  
  return null;
}

/**
 * Get all services with pricing data
 */
export function getServicesWithPricing(): ServiceIconMapping[] {
  return Object.values(SERVICE_ICON_MAP).filter(m => m.hasPricingData);
}

/**
 * Get all AI/ML services
 */
export function getAIServices(): ServiceIconMapping[] {
  return Object.values(SERVICE_ICON_MAP).filter(m => m.category === 'ai + machine learning');
}

/**
 * Get services by category
 */
export function getServicesByCategory(category: ServiceIconMapping['category']): ServiceIconMapping[] {
  return Object.values(SERVICE_ICON_MAP).filter(m => m.category === category);
}

/**
 * Validate if a service has pricing support
 */
export function hasRealPricingData(serviceName: string): boolean {
  const mapping = getServiceIconMapping(serviceName);
  return mapping?.hasPricingData || false;
}

/**
 * Get the correct icon filename for a service
 */
export function getIconFilename(serviceName: string): string | null {
  const mapping = getServiceIconMapping(serviceName);
  return mapping?.iconFile || null;
}
