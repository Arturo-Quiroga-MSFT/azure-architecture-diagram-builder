// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

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
  category: 'ai + machine learning' | 'app services' | 'compute' | 'databases' | 'storage' | 'networking' | 'web' | 'analytics' | 'containers' | 'developer tools' | 'integration' | 'identity' | 'management + governance' | 'iot' | 'monitor' | 'security' | 'fabric' | 'new icons' | 'other';
  /** Whether we have real pricing data for this service */
  hasPricingData: boolean;
  /** Service name used in pricing files (if hasPricingData is true) */
  pricingServiceName?: string;
  /** Whether this is a usage-based service */
  isUsageBased?: boolean;
  /** Typical monthly cost range (for reference) */
  costRange?: string;
  /** Preferred canonical type when multiple services intentionally share an icon */
  reverseLookupPriority?: number;
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
    iconFile: '03438-icon-service-Azure-OpenAI',
    category: 'ai + machine learning',
    hasPricingData: true,
    pricingServiceName: 'Azure OpenAI',
    isUsageBased: true,
    costRange: '$1-200/mo (token-based)'
  },
  
  'Cognitive Services': {
    displayName: 'Cognitive Services',
    aliases: ['Azure Cognitive Services', 'Cognitive Service'],
    iconFile: '10162-icon-service-Cognitive-Services',
    category: 'ai + machine learning',
    hasPricingData: true,
    pricingServiceName: 'Cognitive Services',
    isUsageBased: true,
    costRange: '$0-500/mo (varies by service)'
  },
  
  'Computer Vision': {
    displayName: 'Computer Vision',
    aliases: ['Vision', 'Azure Vision', 'Azure AI Vision', 'Image Analysis'],
    iconFile: '00792-icon-service-Computer-Vision',
    category: 'ai + machine learning',
    hasPricingData: true,
    pricingServiceName: 'Vision',
    isUsageBased: true,
    costRange: '$150-1500/mo'
  },
  
  'Custom Vision': {
    displayName: 'Custom Vision',
    aliases: ['Azure Custom Vision', 'Custom Vision Service'],
    iconFile: '00793-icon-service-Custom-Vision',
    category: 'ai + machine learning',
    hasPricingData: true,
    pricingServiceName: 'Custom Vision',
    isUsageBased: true,
    costRange: '$0-300/mo'
  },
  
  'Speech Services': {
    displayName: 'Speech Services',
    aliases: ['Speech', 'Azure Speech', 'Azure AI Speech', 'Speech-to-Text', 'Text-to-Speech'],
    iconFile: '00797-icon-service-Speech-Services',
    category: 'ai + machine learning',
    hasPricingData: true,
    pricingServiceName: 'Speech',
    isUsageBased: true,
    costRange: '$100-1000/mo'
  },
  
  'Translator': {
    displayName: 'Translator',
    aliases: ['Translator Text', 'Azure Translator', 'Azure AI Translator', 'Translation'],
    iconFile: '00800-icon-service-Translator-Text',
    category: 'ai + machine learning',
    hasPricingData: true,
    pricingServiceName: 'Translator',
    isUsageBased: true,
    costRange: '$100-1000/mo'
  },
  
  'Language': {
    displayName: 'Language',
    aliases: ['Azure Language', 'Azure AI Language', 'Text Analytics', 'NLP'],
    iconFile: '02876-icon-service-Language',
    category: 'ai + machine learning',
    hasPricingData: true,
    pricingServiceName: 'Language',
    isUsageBased: true,
    costRange: '$25-250/mo'
  },
  
  'Document Intelligence': {
    displayName: 'Document Intelligence',
    aliases: ['Form Recognizer', 'Azure Document Intelligence', 'Azure AI Document Intelligence', 'Form Processing'],
    iconFile: '02749-icon-service-Azure-Applied-AI-Services',
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
    iconFile: '038470510-icon-service-Azure-Machine-Learning',
    category: 'ai + machine learning',
    hasPricingData: true,
    pricingServiceName: 'Azure Machine Learning',
    isUsageBased: true,
    costRange: '$0-5000/mo (varies greatly)',
    reverseLookupPriority: 100
  },
  
  // AML Sub-components (granular architecture support)
  // These allow architects to break down AML into logical components
  // with accurate cost attribution (endpoints/deployments are $0, compute has cost)
  
  'AML Online Endpoint': {
    displayName: 'AML Online Endpoint',
    aliases: ['Online Endpoint', 'AML Endpoint', 'Managed Online Endpoint', 'Real-time Endpoint'],
    iconFile: '038470510-icon-service-Azure-Machine-Learning',
    category: 'ai + machine learning',
    hasPricingData: false, // No direct cost - routing construct only
    isUsageBased: false,
    costRange: '$0 (routing only)'
  },
  
  'AML Batch Endpoint': {
    displayName: 'AML Batch Endpoint',
    aliases: ['Batch Endpoint', 'AML Batch', 'Batch Inference Endpoint'],
    iconFile: '038470510-icon-service-Azure-Machine-Learning',
    category: 'ai + machine learning',
    hasPricingData: false, // No direct cost - routing construct only
    isUsageBased: false,
    costRange: '$0 (routing only)'
  },
  
  'AML Deployment': {
    displayName: 'AML Deployment',
    aliases: ['Online Deployment', 'Batch Deployment', 'Model Deployment', 'Managed Deployment', 'Shared Deployment', 'Dedicated Deployment'],
    iconFile: '038470510-icon-service-Azure-Machine-Learning',
    category: 'ai + machine learning',
    hasPricingData: false, // Configuration only - compute cost is separate
    isUsageBased: false,
    costRange: '$0 (config only)'
  },
  
  'AML Managed Compute': {
    displayName: 'AML Managed Compute',
    aliases: ['AML Compute', 'ML Compute', 'Managed Compute', 'AML Compute Instance', 'Compute Instance', 'AML Managed Compute (CPU/GPU)', 'Managed Compute (CPU/GPU)'],
    iconFile: '10021-icon-service-Virtual-Machine',
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
  
  'Azure AI Search': {
    displayName: 'Azure AI Search',
    aliases: ['Azure Cognitive Search', 'Cognitive Search', 'Azure Search', 'AI Search'],
    iconFile: '10044-icon-service-Cognitive-Search',
    category: 'ai + machine learning',
    hasPricingData: false,
    isUsageBased: false,
    costRange: '$75-2500/mo'
  },

  'Microsoft Foundry': {
    displayName: 'Microsoft Foundry',
    aliases: ['AI Foundry', 'Azure AI Foundry', 'Azure AI Studio', 'Microsoft AI Foundry'],
    iconFile: '035746832-icon-service-AI-Foundry',
    category: 'ai + machine learning',
    hasPricingData: false,
    isUsageBased: true,
    costRange: 'Platform (underlying services billed separately)'
  },

  'Foundry Application': {
    displayName: 'Foundry Application',
    aliases: ['Microsoft Foundry Application', 'Azure AI Foundry Application', 'Agent Application'],
    iconFile: '036509374-icon-service-Foundry-Application',
    category: 'ai + machine learning',
    hasPricingData: false,
    costRange: 'Legacy application boundary'
  },

  'Foundry Project': {
    displayName: 'Foundry Project',
    aliases: ['Foundry Projects', 'Microsoft Foundry Project', 'Azure AI Foundry Project', 'AI Foundry Project'],
    iconFile: '036509415-icon-service-Foundry-Project',
    category: 'ai + machine learning',
    hasPricingData: false,
    costRange: '$0 (project boundary)'
  },

  'Foundry IQ': {
    displayName: 'Foundry IQ',
    aliases: ['Microsoft Foundry IQ', 'Azure AI Foundry IQ', 'AI Foundry IQ'],
    iconFile: '038470497-icon-service-Azure-AI-Foundry-IQ',
    category: 'ai + machine learning',
    hasPricingData: false,
    isUsageBased: true,
    costRange: 'Usage-based (supporting services)'
  },

  'Microsoft Foundry Agent Service': {
    displayName: 'Microsoft Foundry Agent Service',
    aliases: ['Foundry Agent Service', 'Azure AI Foundry Agent Service', 'Azure AI Agent Service', 'AI Foundry Agent Service'],
    iconFile: '038470523-icon-service-Foundry-Agent-Service',
    category: 'ai + machine learning',
    hasPricingData: false,
    isUsageBased: true,
    costRange: 'Usage-based (models and tools)'
  },

  'Microsoft Foundry Control Plane': {
    displayName: 'Microsoft Foundry Control Plane',
    aliases: ['Foundry Control Plane', 'Azure AI Foundry Control Plane', 'AI Foundry Control Plane'],
    iconFile: '038470534-icon-service-Foundry-Control-Plane',
    category: 'ai + machine learning',
    hasPricingData: false,
    costRange: '$0 (management plane)'
  },

  'Foundry Labs': {
    displayName: 'Foundry Labs',
    aliases: ['Microsoft Foundry Labs', 'Azure AI Foundry Labs', 'AI Foundry Labs'],
    iconFile: '038470555-icon-service-Foundry-Labs',
    category: 'ai + machine learning',
    hasPricingData: false,
    costRange: 'Preview and experimental services'
  },

  'Foundry Local': {
    displayName: 'Foundry Local',
    aliases: ['Microsoft Foundry Local', 'Azure AI Foundry Local', 'AI Foundry Local'],
    iconFile: '038470593-icon-service-Foundry-Local',
    category: 'ai + machine learning',
    hasPricingData: false,
    costRange: 'Local runtime'
  },

  'Microsoft Foundry Models': {
    displayName: 'Microsoft Foundry Models',
    aliases: ['Foundry Models', 'Azure AI Foundry Models', 'AI Foundry Models', 'Azure AI Model Catalog'],
    iconFile: '038470614-icon-service-Foundry-Models',
    category: 'ai + machine learning',
    hasPricingData: false,
    isUsageBased: true,
    costRange: 'Usage-based (model dependent)'
  },

  'AI Gateway': {
    displayName: 'AI Gateway',
    aliases: ['Azure AI Gateway', 'Generative AI Gateway', 'GenAI Gateway'],
    iconFile: '037838045-icon-service-AI-Gateway',
    category: 'new icons',
    hasPricingData: false,
    costRange: 'Capability (uses API Management)'
  },
  
  // ========================================
  // Compute Services
  // ========================================
  'Virtual Machines': {
    displayName: 'Virtual Machines',
    aliases: ['VM', 'VMs', 'Virtual Machine', 'Azure VM'],
    iconFile: '10021-icon-service-Virtual-Machine',
    category: 'compute',
    hasPricingData: true,
    pricingServiceName: 'Virtual Machines',
    isUsageBased: false,
    costRange: '$13-17340/mo (per instance)',
    reverseLookupPriority: 100
  },
  
  'App Service': {
    displayName: 'App Service',
    aliases: ['Azure App Service', 'Web App', 'App Services'],
    iconFile: '10035-icon-service-App-Services',
    category: 'app services',
    hasPricingData: true,
    pricingServiceName: 'Azure App Service',
    isUsageBased: false,
    costRange: '$13-730/mo (per instance)'
  },
  
  'Functions': {
    displayName: 'Azure Functions',
    aliases: ['Function App', 'Functions', 'Serverless Functions'],
    iconFile: '10029-icon-service-Function-Apps',
    category: 'compute',
    hasPricingData: true,
    pricingServiceName: 'Functions',
    isUsageBased: true,
    costRange: '$0-160/mo (consumption-based)'
  },
  
  'Container Instances': {
    displayName: 'Container Instances',
    aliases: ['ACI', 'Azure Container Instances', 'Container Instance'],
    iconFile: '10104-icon-service-Container-Instances',
    category: 'containers',
    hasPricingData: true,
    pricingServiceName: 'Container Instances',
    isUsageBased: true,
    costRange: '$0-500/mo (per-second billing)'
  },
  
  'Kubernetes Service': {
    displayName: 'Azure Kubernetes Service',
    aliases: ['AKS', 'Kubernetes', 'K8s'],
    iconFile: '10023-icon-service-Kubernetes-Services',
    category: 'containers',
    hasPricingData: true,
    pricingServiceName: 'Azure Kubernetes Service',
    isUsageBased: false,
    costRange: '$73/mo + node costs'
  },
  
  'Container Registry': {
    displayName: 'Container Registry',
    aliases: ['ACR', 'Azure Container Registry'],
    iconFile: '10105-icon-service-Container-Registries',
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
    iconFile: '10121-icon-service-Azure-Cosmos-DB',
    category: 'databases',
    hasPricingData: true,
    pricingServiceName: 'Azure Cosmos DB',
    isUsageBased: true,
    costRange: '$24-29185/mo'
  },
  
  'SQL Database': {
    displayName: 'SQL Database',
    aliases: ['Azure SQL', 'Azure SQL Database', 'SQL DB'],
    iconFile: '02390-icon-service-Azure-SQL',
    category: 'databases',
    hasPricingData: true,
    pricingServiceName: 'SQL Database',
    isUsageBased: false,
    costRange: '$5-43800/mo'
  },
  
  'PostgreSQL': {
    displayName: 'Azure Database for PostgreSQL',
    aliases: ['PostgreSQL', 'Postgres', 'Azure PostgreSQL', 'Azure Database for PostgreSQL', 'Azure Database for PostgreSQL Flexible Server', 'PostgreSQL Flexible Server', 'Azure PostgreSQL Flexible Server', 'PostgreSQL Server'],
    iconFile: '02827-icon-service-Azure-Database-PostgreSQL-Server-Group',
    category: 'databases',
    hasPricingData: true,
    pricingServiceName: 'Azure Database for PostgreSQL',
    isUsageBased: false,
    costRange: '$5-11240/mo'
  },
  
  'MySQL': {
    displayName: 'Azure Database for MySQL',
    aliases: ['MySQL', 'Azure MySQL', 'Azure Database for MySQL'],
    iconFile: '10122-icon-service-Azure-Database-MySQL-Server',
    category: 'databases',
    hasPricingData: true,
    pricingServiceName: 'Azure Database for MySQL',
    isUsageBased: false,
    costRange: '$5-9800/mo'
  },
  
  'Redis Cache': {
    displayName: 'Azure Cache for Redis',
    aliases: ['Redis', 'Redis Cache', 'Cache', 'Azure Cache for Redis'],
    iconFile: '10137-icon-service-Cache-Redis',
    category: 'databases',
    hasPricingData: true,
    pricingServiceName: 'Redis Cache',
    isUsageBased: false,
    costRange: '$16-13600/mo'
  },

  'Azure Managed Redis': {
    displayName: 'Azure Managed Redis',
    aliases: ['Managed Redis', 'AMR'],
    iconFile: '03675-icon-service-Azure-Managed-Redis',
    category: 'databases',
    hasPricingData: false,
    isUsageBased: false,
    costRange: 'Tier and capacity dependent'
  },
  
  // ========================================
  // Storage
  // ========================================
  'Storage Account': {
    displayName: 'Storage Account',
    aliases: ['Storage', 'Blob Storage', 'Azure Storage', 'Storage Accounts'],
    iconFile: '10086-icon-service-Storage-Accounts',
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
    iconFile: '10076-icon-service-Application-Gateways',
    category: 'networking',
    hasPricingData: true,
    pricingServiceName: 'Application Gateway',
    isUsageBased: false,
    costRange: '$125-1200/mo'
  },
  
  'Azure Front Door': {
    displayName: 'Azure Front Door',
    aliases: ['Front Door', 'AFD'],
    iconFile: '10073-icon-service-Front-Door-and-CDN-Profiles',
    category: 'networking',
    hasPricingData: true,
    pricingServiceName: 'Azure Front Door Service',
    isUsageBased: true,
    costRange: '$35-412/mo + traffic'
  },
  
  'CDN': {
    displayName: 'Content Delivery Network',
    aliases: ['Azure CDN', 'CDN', 'Content Delivery'],
    iconFile: '00056-icon-service-CDN-Profiles',
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
    iconFile: '10126-icon-service-Data-Factories',
    category: 'analytics',
    hasPricingData: true,
    pricingServiceName: 'Azure Data Factory',
    isUsageBased: true,
    costRange: '$0.50-2.50 per 1000 activities'
  },
  
  'Azure Synapse Analytics': {
    displayName: 'Azure Synapse Analytics',
    aliases: ['Synapse', 'Synapse Analytics', 'Azure Synapse'],
    iconFile: '00606-icon-service-Azure-Synapse-Analytics',
    category: 'analytics',
    hasPricingData: true,
    pricingServiceName: 'Azure Synapse Analytics',
    isUsageBased: true,
    costRange: '$5-8000/mo + compute'
  },
  
  'Stream Analytics': {
    displayName: 'Azure Stream Analytics',
    aliases: ['Stream Analytics', 'ASA', 'Azure Stream Analytics'],
    iconFile: '00042-icon-service-Stream-Analytics-Jobs',
    category: 'analytics',
    hasPricingData: true,
    pricingServiceName: 'Stream Analytics',
    isUsageBased: true,
    costRange: '$0.11 per streaming unit/hour'
  },
  
  'Event Hubs': {
    displayName: 'Event Hubs',
    aliases: ['Azure Event Hubs', 'Event Hub'],
    iconFile: '00039-icon-service-Event-Hubs',
    category: 'analytics',
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
    iconFile: '10836-icon-service-Azure-Service-Bus',
    category: 'integration',
    hasPricingData: true,
    pricingServiceName: 'Service Bus',
    isUsageBased: true,
    costRange: '$0-10/mo + messages'
  },
  
  'Logic Apps': {
    displayName: 'Logic Apps',
    aliases: ['Azure Logic Apps', 'Logic App'],
    iconFile: '02631-icon-service-Logic-Apps',
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
    iconFile: '10245-icon-service-Key-Vaults',
    category: 'security',
    hasPricingData: true,
    pricingServiceName: 'Key Vault',
    isUsageBased: true,
    costRange: '$0.03 per 10K operations'
  },
  
  'Application Insights': {
    displayName: 'Application Insights',
    aliases: ['App Insights', 'Azure Application Insights', 'Monitoring'],
    iconFile: '00012-icon-service-Application-Insights',
    category: 'monitor',
    hasPricingData: true,
    pricingServiceName: 'Application Insights',
    isUsageBased: true,
    costRange: '$2.30 per GB ingested'
  },
    'Log Analytics': {
    displayName: 'Log Analytics',
    aliases: ['Azure Log Analytics', 'LA', 'Log Analytics Workspace'],
    iconFile: '00009-icon-service-Log-Analytics-Workspaces',
    category: 'monitor',
    hasPricingData: true,
    pricingServiceName: 'Log Analytics',
    isUsageBased: true,
    costRange: '$2.76 per GB ingested'
  },
    'API Management': {
    displayName: 'API Management',
    aliases: ['APIM', 'Azure API Management', 'API Gateway'],
    iconFile: '10042-icon-service-API-Management-Services',
    category: 'integration',
    hasPricingData: true,
    pricingServiceName: 'API Management',
    isUsageBased: false,
    costRange: '$50-2800/mo'
  },
  
  // ========================================
  // Dashboard & Visualization Services
  // ========================================
  'Azure Managed Grafana': {
    displayName: 'Azure Managed Grafana',
    aliases: ['Managed Grafana', 'Grafana', 'Azure Grafana'],
    iconFile: '02905-icon-service-Azure-Managed-Grafana',
    category: 'other',
    hasPricingData: true,
    pricingServiceName: 'Azure Managed Grafana',
    isUsageBased: false,
    costRange: '$10-300/mo'
  },
  'Power BI Embedded': {
    displayName: 'Power BI Embedded',
    aliases: ['Power BI', 'PowerBI', 'Power BI Dashboard', 'PBI'],
    iconFile: '03332-icon-service-Power-BI-Embedded',
    category: 'analytics',
    hasPricingData: true,
    pricingServiceName: 'Power BI Embedded',
    isUsageBased: false,
    costRange: '$735-4,700/mo'
  },
  'Azure Dashboard': {
    displayName: 'Azure Dashboard',
    aliases: ['Azure Portal Dashboard', 'Dashboard', 'Azure Monitor Dashboard'],
    iconFile: '02488-icon-service-Azure-Monitor-Dashboard',
    category: 'other',
    hasPricingData: false,
    pricingServiceName: 'Azure Dashboard',
    isUsageBased: false,
    costRange: 'Free'
  },
  'Azure Workbooks': {
    displayName: 'Azure Workbooks',
    aliases: ['Workbooks', 'Monitor Workbooks', 'Azure Monitor Workbooks'],
    iconFile: '02189-icon-service-Azure-Workbooks',
    category: 'analytics',
    hasPricingData: false,
    pricingServiceName: 'Azure Workbooks',
    isUsageBased: false,
    costRange: 'Free (data costs apply)'
  },
  
  // ========================================
  // IoT Services
  // ========================================
  'IoT Hub': {
    displayName: 'Azure IoT Hub',
    aliases: ['Azure IoT Hub', 'IoT', 'IoT Hub'],
    iconFile: '10182-icon-service-IoT-Hub',
    category: 'iot',
    hasPricingData: true,
    pricingServiceName: 'IoT Hub',
    isUsageBased: true,
    costRange: '$0-5000/mo'
  },
  
  'IoT Central': {
    displayName: 'Azure IoT Central',
    aliases: ['Azure IoT Central', 'IoT Central'],
    iconFile: '10184-icon-service-IoT-Central-Applications',
    category: 'iot',
    hasPricingData: false,
    isUsageBased: true,
    costRange: '$0-250/mo'
  },
  
  'Digital Twins': {
    displayName: 'Azure Digital Twins',
    aliases: ['Azure Digital Twins', 'Digital Twin'],
    iconFile: '01030-icon-service-Digital-Twins',
    category: 'iot',
    hasPricingData: false,
    isUsageBased: true,
    costRange: '$0-1000/mo'
  },
  
  // ========================================
  // Container Services (additional)
  // ========================================
  'Container Apps': {
    displayName: 'Azure Container Apps',
    aliases: ['Azure Container Apps', 'Container App', 'ACA'],
    iconFile: '02989-icon-service-Container-Apps-Environments',
    category: 'other',
    hasPricingData: true,
    pricingServiceName: 'Azure Container Apps',
    isUsageBased: true,
    costRange: '$0-500/mo (consumption-based)'
  },
  
  // ========================================
  // Networking (additional)
  // ========================================
  'Virtual Network': {
    displayName: 'Virtual Network',
    aliases: ['VNet', 'Azure Virtual Network', 'VNET'],
    iconFile: '10061-icon-service-Virtual-Networks',
    category: 'networking',
    hasPricingData: true,
    pricingServiceName: 'Virtual Network',
    isUsageBased: false,
    costRange: '$0-7.30/mo (peering)'
  },
  
  'Load Balancer': {
    displayName: 'Azure Load Balancer',
    aliases: ['Azure Load Balancer', 'LB'],
    iconFile: '10062-icon-service-Load-Balancers',
    category: 'networking',
    hasPricingData: true,
    pricingServiceName: 'Load Balancer',
    isUsageBased: false,
    costRange: '$18-730/mo'
  },
  
  'Azure Firewall': {
    displayName: 'Azure Firewall',
    aliases: ['Firewall'],
    iconFile: '10084-icon-service-Firewalls',
    category: 'networking',
    hasPricingData: true,
    pricingServiceName: 'Azure Firewall',
    isUsageBased: false,
    costRange: '$438-1095/mo'
  },
  
  'VPN Gateway': {
    displayName: 'VPN Gateway',
    aliases: ['Azure VPN Gateway', 'VPN', 'Virtual Network Gateway'],
    iconFile: '10063-icon-service-Virtual-Network-Gateways',
    category: 'networking',
    hasPricingData: true,
    pricingServiceName: 'VPN Gateway',
    isUsageBased: false,
    costRange: '$26-361/mo'
  },
  
  'ExpressRoute': {
    displayName: 'ExpressRoute',
    aliases: ['Azure ExpressRoute', 'Express Route'],
    iconFile: '10079-icon-service-ExpressRoute-Circuits',
    category: 'networking',
    hasPricingData: true,
    pricingServiceName: 'ExpressRoute',
    isUsageBased: false,
    costRange: '$55-580/mo'
  },
  
  'Traffic Manager': {
    displayName: 'Azure Traffic Manager',
    aliases: ['Azure Traffic Manager'],
    iconFile: '10065-icon-service-Traffic-Manager-Profiles',
    category: 'networking',
    hasPricingData: true,
    pricingServiceName: 'Traffic Manager',
    isUsageBased: true,
    costRange: '$0.54 per million queries'
  },
  
  // ========================================
  // Integration (additional)
  // ========================================
  'Event Grid': {
    displayName: 'Azure Event Grid',
    aliases: ['Azure Event Grid'],
    iconFile: '10206-icon-service-Event-Grid-Topics',
    category: 'integration',
    hasPricingData: true,
    pricingServiceName: 'Azure Event Grid',
    isUsageBased: true,
    costRange: '$0.30 per million operations'
  },
  
  'SignalR Service': {
    displayName: 'Azure SignalR Service',
    aliases: ['SignalR', 'Azure SignalR', 'Azure SignalR Service'],
    iconFile: '10052-icon-service-SignalR',
    category: 'web',
    hasPricingData: true,
    pricingServiceName: 'SignalR',
    isUsageBased: true,
    costRange: '$0-49/mo per unit'
  },
  
  'Notification Hubs': {
    displayName: 'Azure Notification Hubs',
    aliases: ['Notification Hub', 'Azure Notification Hubs', 'Push Notifications'],
    iconFile: '10045-icon-service-Notification-Hubs',
    category: 'iot',
    hasPricingData: true,
    pricingServiceName: 'Notification Hubs',
    isUsageBased: true,
    costRange: '$0-200/mo'
  },
  
  // ========================================
  // Web (additional)
  // ========================================
  'Static Web Apps': {
    displayName: 'Azure Static Web Apps',
    aliases: ['Static Web App', 'Azure Static Web Apps', 'Azure Static Web App', 'SWA'],
    iconFile: '01007-icon-service-Static-Apps',
    category: 'web',
    hasPricingData: false,
    isUsageBased: false,
    costRange: '$0-9/mo'
  },
  
  // ========================================
  // Management, Monitoring & Security (additional)
  // ========================================
  'Azure Monitor': {
    displayName: 'Azure Monitor',
    aliases: ['Monitor'],
    iconFile: '00001-icon-service-Monitor',
    category: 'monitor',
    hasPricingData: true,
    pricingServiceName: 'Azure Monitor',
    isUsageBased: true,
    costRange: '$2.30 per GB ingested'
  },
  
  'Microsoft Defender for Cloud': {
    displayName: 'Microsoft Defender for Cloud',
    aliases: ['Defender for Cloud', 'Azure Defender', 'Security Center'],
    iconFile: '10241-icon-service-Microsoft-Defender-for-Cloud',
    category: 'security',
    hasPricingData: true,
    pricingServiceName: 'Microsoft Defender for Cloud',
    isUsageBased: false,
    costRange: '$0-15/mo per server'
  },
  
  'Microsoft Entra ID': {
    displayName: 'Microsoft Entra ID',
    aliases: ['Entra ID', 'Azure AD', 'Azure Active Directory', 'Active Directory'],
    iconFile: '10340-icon-service-Entra-Identity-Roles-and-Administrators',
    category: 'identity',
    hasPricingData: false,
    isUsageBased: false,
    costRange: '$0-9/mo per user'
  },
  
  'Backup': {
    displayName: 'Azure Backup',
    aliases: ['Azure Backup', 'Recovery Services', 'Recovery Services Vault'],
    iconFile: '00017-icon-service-Recovery-Services-Vaults',
    category: 'management + governance',
    hasPricingData: true,
    pricingServiceName: 'Backup',
    isUsageBased: true,
    costRange: '$5-25/mo per instance'
  },
  
  'Network Watcher': {
    displayName: 'Network Watcher',
    aliases: ['Azure Network Watcher'],
    iconFile: '10066-icon-service-Network-Watcher',
    category: 'networking',
    hasPricingData: true,
    pricingServiceName: 'Network Watcher',
    isUsageBased: true,
    costRange: '$0-10/mo per resource'
  },
  
  // ========================================
  // Security (additional)
  // ========================================
  'Azure Bastion': {
    displayName: 'Azure Bastion',
    aliases: ['Bastion', 'Bastion Host'],
    iconFile: '02422-icon-service-Bastions',
    category: 'networking',
    hasPricingData: false,
    isUsageBased: false,
    costRange: '$138-876/mo'
  },
  
  'Azure DDoS Protection': {
    displayName: 'Azure DDoS Protection',
    aliases: ['DDoS Protection', 'DDoS', 'DDoS Protection Plan'],
    iconFile: '10072-icon-service-DDoS-Protection-Plans',
    category: 'networking',
    hasPricingData: false,
    isUsageBased: false,
    costRange: '$2944/mo'
  },
  
  'Azure Policy': {
    displayName: 'Azure Policy',
    aliases: ['Policy', 'Azure Policies', 'Governance Policy'],
    iconFile: '10316-icon-service-Policy',
    category: 'management + governance',
    hasPricingData: false,
    isUsageBased: false,
    costRange: '$0 (included)'
  },
  
  'Microsoft Sentinel': {
    displayName: 'Microsoft Sentinel',
    aliases: ['Sentinel', 'Azure Sentinel', 'SIEM', 'Azure SIEM'],
    iconFile: '10248-icon-service-Azure-Sentinel',
    category: 'security',
    hasPricingData: false,
    isUsageBased: true,
    costRange: '$2.46 per GB ingested'
  },
  
  'Web Application Firewall': {
    displayName: 'Web Application Firewall',
    aliases: ['WAF', 'Azure WAF', 'WAF Policy', 'Web Application Firewall Policy'],
    iconFile: '10362-icon-service-Web-Application-Firewall-Policies(WAF)',
    category: 'networking',
    hasPricingData: false,
    isUsageBased: false,
    costRange: '$100-500/mo'
  },
  
  'Private Link': {
    displayName: 'Azure Private Link',
    aliases: ['Azure Private Link', 'Private Endpoint', 'Private Endpoints', 'Azure Private Endpoint'],
    iconFile: '00427-icon-service-Private-Link',
    category: 'networking',
    hasPricingData: false,
    isUsageBased: false,
    costRange: '$7.30/mo per endpoint'
  },
  
  'Azure DNS': {
    displayName: 'Azure DNS',
    aliases: ['DNS', 'DNS Zone', 'DNS Zones', 'Private DNS'],
    iconFile: '10064-icon-service-DNS-Zones',
    category: 'networking',
    hasPricingData: false,
    isUsageBased: true,
    costRange: '$0.50/mo per zone'
  },
  
  // ========================================
  // Healthcare
  // ========================================
  'Azure API for FHIR': {
    displayName: 'Azure API for FHIR',
    aliases: ['FHIR', 'Azure Health Data Services', 'Health Data Services', 'FHIR Service'],
    iconFile: '10212-icon-service-Azure-API-for-FHIR',
    category: 'integration',
    hasPricingData: false,
    isUsageBased: true,
    costRange: '$0-3000/mo'
  },
  
  // ========================================
  // Data Governance
  // ========================================
  'Microsoft Purview': {
    displayName: 'Microsoft Purview',
    aliases: ['Purview', 'Azure Purview', 'Data Governance', 'Data Catalog'],
    iconFile: '10314-icon-service-Azure-Purview-Accounts',
    category: 'management + governance',
    hasPricingData: true,
    pricingServiceName: 'Microsoft Purview',
    costRange: '$0.50-240/mo'
  },
  
  // ========================================
  // Storage (additional)
  // ========================================
  'Data Lake Storage': {
    displayName: 'Azure Data Lake Storage',
    aliases: ['Data Lake', 'Azure Data Lake', 'Data Lake Storage Gen2', 'ADLS', 'Azure Data Lake Storage Gen2'],
    iconFile: '10090-icon-service-Data-Lake-Storage-Gen1',
    category: 'storage',
    hasPricingData: false,
    isUsageBased: true,
    costRange: '$0.02-0.15 per GB/mo'
  },

  // ========================================
  // Microsoft Fabric
  // ----------------------------------------
  // Fabric's cost model: a provisioned CAPACITY (F SKU) carries the fixed cost;
  // OneLake storage is usage-based (per GB); all other Fabric items consume the
  // shared capacity, so they are modeled as $0 (like AML endpoints rolling up to
  // compute). Icons are the official v6.1.0 Fabric product icons.
  // ========================================
  'Microsoft Fabric': {
    displayName: 'Microsoft Fabric',
    aliases: ['Fabric', 'MS Fabric', 'Fabric Platform'],
    iconFile: 'microsoft-fabric',
    category: 'fabric',
    hasPricingData: false,
    costRange: 'Platform (see Fabric Capacity)'
  },
  'Microsoft Fabric Capacity': {
    displayName: 'Microsoft Fabric Capacity',
    aliases: ['Fabric Capacity', 'Fabric F SKU', 'Fabric F64', 'Fabric F2', 'Capacity Unit', 'F SKU'],
    iconFile: 'fabric-capacity',
    category: 'fabric',
    hasPricingData: true,
    pricingServiceName: 'Microsoft Fabric Capacity',
    isUsageBased: false,
    costRange: '$263-8,410/mo (F2-F64, PAYG)'
  },
  'OneLake': {
    displayName: 'OneLake',
    aliases: ['One Lake', 'Fabric OneLake', 'OneLake Storage'],
    iconFile: 'onelake',
    category: 'fabric',
    hasPricingData: true,
    pricingServiceName: 'OneLake Storage',
    isUsageBased: true,
    costRange: '~$0.023–0.041 per GB/mo (Hot, region-dependent)'
  },
  'Lakehouse': {
    displayName: 'Lakehouse',
    aliases: ['Fabric Lakehouse', 'Lake House', 'Lakehouse (Bronze)', 'Lakehouse (Silver)', 'Lakehouse (Gold)'],
    iconFile: 'fabric-lakehouse',
    category: 'fabric',
    hasPricingData: false,
    costRange: '$0 (consumes Fabric capacity)'
  },
  'Warehouse': {
    displayName: 'Warehouse',
    aliases: ['Fabric Warehouse', 'Data Warehouse (Fabric)', 'Warehouse (Gold)'],
    iconFile: 'fabric-warehouse',
    category: 'fabric',
    hasPricingData: false,
    costRange: '$0 (consumes Fabric capacity)'
  },
  'Eventhouse': {
    displayName: 'Eventhouse',
    aliases: ['Fabric Eventhouse', 'Event House'],
    iconFile: 'fabric-eventhouse',
    category: 'fabric',
    hasPricingData: false,
    costRange: '$0 (consumes Fabric capacity)'
  },
  'Eventstream': {
    displayName: 'Eventstream',
    aliases: ['Fabric Eventstream', 'Event Stream'],
    iconFile: 'fabric-eventstream',
    category: 'fabric',
    hasPricingData: false,
    costRange: '$0 (consumes Fabric capacity)'
  },
  'KQL Database': {
    displayName: 'KQL Database',
    aliases: ['Fabric KQL Database', 'Kusto Database (Fabric)'],
    iconFile: 'fabric-kql-database',
    category: 'fabric',
    hasPricingData: false,
    costRange: '$0 (consumes Fabric capacity)'
  },
  'Fabric Notebook': {
    displayName: 'Fabric Notebook',
    aliases: ['Fabric Spark Notebook'],
    iconFile: 'fabric-notebook',
    category: 'fabric',
    hasPricingData: false,
    costRange: '$0 (consumes Fabric capacity)'
  },
  'Fabric Data Pipeline': {
    displayName: 'Fabric Data Pipeline',
    aliases: ['Fabric Pipeline', 'Data Pipeline (Fabric)'],
    iconFile: 'fabric-data-pipeline',
    category: 'fabric',
    hasPricingData: false,
    costRange: '$0 (consumes Fabric capacity)'
  },
  'Fabric Data Factory': {
    displayName: 'Fabric Data Factory',
    aliases: ['Data Factory (Fabric)'],
    iconFile: 'fabric-data-factory',
    category: 'fabric',
    hasPricingData: false,
    costRange: '$0 (consumes Fabric capacity)'
  },
  'Dataflow Gen2': {
    displayName: 'Dataflow Gen2',
    aliases: ['Fabric Dataflow', 'Dataflow Gen 2'],
    iconFile: 'fabric-dataflow-gen2',
    category: 'fabric',
    hasPricingData: false,
    costRange: '$0 (consumes Fabric capacity)'
  },
  'Datamart': {
    displayName: 'Datamart',
    aliases: ['Fabric Datamart'],
    iconFile: 'fabric-datamart',
    category: 'fabric',
    hasPricingData: false,
    costRange: '$0 (consumes Fabric capacity)'
  },
  'Semantic Model': {
    displayName: 'Semantic Model',
    aliases: ['Power BI Semantic Model', 'Power BI Dataset', 'Direct Lake Semantic Model'],
    iconFile: 'fabric-semantic-model',
    category: 'fabric',
    hasPricingData: false,
    costRange: '$0 (consumes Fabric capacity)'
  },
  'Power BI Report': {
    displayName: 'Power BI Report',
    aliases: ['Fabric Report', 'Fabric Power BI Report'],
    iconFile: 'fabric-power-bi-report',
    category: 'fabric',
    hasPricingData: false,
    costRange: '$0 (consumes Fabric capacity)'
  },
  'Fabric SQL Database': {
    displayName: 'Fabric SQL Database',
    aliases: ['SQL Database (Fabric)', 'Fabric SQL DB'],
    iconFile: 'fabric-sql-database',
    category: 'fabric',
    hasPricingData: false,
    costRange: '$0 (consumes Fabric capacity)'
  },
  'Mirrored Database': {
    displayName: 'Mirrored Database',
    aliases: ['Fabric Mirroring', 'Database Mirroring (Fabric)', 'Mirrored DB'],
    iconFile: 'fabric-mirrored-database',
    category: 'fabric',
    hasPricingData: false,
    costRange: '$0 (free mirroring up to capacity size)'
  },
  'Real-Time Dashboard': {
    displayName: 'Real-Time Dashboard',
    aliases: ['Fabric Real-Time Dashboard', 'Real Time Dashboard', 'Real-Time Intelligence'],
    iconFile: 'fabric-real-time-dashboard',
    category: 'fabric',
    hasPricingData: false,
    costRange: '$0 (consumes Fabric capacity)'
  },
  'Fabric Spark Job': {
    displayName: 'Fabric Spark Job',
    aliases: ['Spark Job Definition', 'Fabric Spark'],
    iconFile: 'fabric-spark-job',
    category: 'fabric',
    hasPricingData: false,
    costRange: '$0 (consumes Fabric capacity)'
  },
  'Fabric Data Agent': {
    displayName: 'Fabric Data Agent',
    aliases: ['Data Agent (Fabric)', 'Fabric AI Skill'],
    iconFile: 'fabric-data-agent',
    category: 'fabric',
    hasPricingData: false,
    costRange: '$0 (consumes Fabric capacity)'
  },
};

/**
 * Resolve a service name to its canonical catalog key.
 */
export function resolveServiceName(serviceName: string): string | null {
  const normalizedName = serviceName.trim().toLowerCase();
  for (const [canonicalName, mapping] of Object.entries(SERVICE_ICON_MAP)) {
    if (
      canonicalName.toLowerCase() === normalizedName ||
      mapping.displayName.toLowerCase() === normalizedName ||
      mapping.aliases.some(alias => alias.toLowerCase() === normalizedName)
    ) {
      return canonicalName;
    }
  }
  return null;
}

/**
 * Get icon mapping for a service by name (case-insensitive, checks aliases).
 */
export function getServiceIconMapping(serviceName: string): ServiceIconMapping | null {
  const canonicalName = resolveServiceName(serviceName);
  return canonicalName ? SERVICE_ICON_MAP[canonicalName] : null;
}

/**
 * Whether a service is a Microsoft Fabric workload item whose cost is
 * included in the workspace's Fabric Capacity (it consumes Capacity Units
 * rather than billing separately). Used to show an "included in capacity"
 * indicator instead of a blank/zero cost. Excludes Fabric Capacity itself
 * and OneLake (which has its own storage billing).
 */
export function isCapacityConsumed(serviceName: string): boolean {
  const m = getServiceIconMapping(serviceName);
  return !!m
    && m.category === 'fabric'
    && !m.hasPricingData
    && /consumes Fabric capacity/i.test(m.costRange || '');
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
