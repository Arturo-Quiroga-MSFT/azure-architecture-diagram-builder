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
  'App Service Certificates': 'Azure Functions',
  'Static Web Apps': 'Static Web Apps',
  'Azure Static Web Apps': 'Static Web Apps',
  'Azure Static Web App': 'Static Web Apps',
  'Static Web App': 'Static Web Apps',
  'Function App': 'Azure Functions',
  'Function Apps': 'Azure Functions',
  'Azure Functions': 'Azure Functions',
  'Functions': 'Azure Functions',
  'Logic Apps': 'Logic Apps',
  'Logic App': 'Logic Apps',
  'API Management': 'API Management',
  'API Management Services': 'API Management',
  'Api Management Services': 'API Management',
  'Api Management': 'API Management',  // Handle AI-generated name variations
  'Azure API Management': 'API Management',
  
  // Compute
  'Virtual Machine': 'Virtual Machines',
  'Virtual Machines': 'Virtual Machines',
  'VM Scale Sets': 'Virtual Machine Scale Sets',
  'Batch': 'Azure Batch',
  
  // Containers
  'Container Registry': 'Container Registry',
  'Container Registries': 'Container Registry',
  'Azure Container Registry': 'Container Registry',
  'Container Instances': 'Container Instances',
  'Container Instance': 'Container Instances',
  'Azure Kubernetes Service': 'Azure Kubernetes Service',
  'AKS': 'Azure Kubernetes Service',
  'Kubernetes Service': 'Azure Kubernetes Service',
  'Kubernetes Services': 'Azure Kubernetes Service',
  
  // Databases (handle icon name variations - iconLoader title-cases file names)
  'SQL Database': 'SQL Database',
  'Sql Database': 'SQL Database',  // AI-generated title case
  'Azure SQL Database': 'SQL Database',
  'Azure Sql Database': 'SQL Database',  // AI-generated title case
  'Azure Sql': 'SQL Database',  // From icon: Azure-SQL.svg
  'Azure SQL': 'SQL Database',
  'Cosmos DB': 'Azure Cosmos DB',
  'Azure Cosmos DB': 'Azure Cosmos DB',
  'Azure Cosmos Db': 'Azure Cosmos DB',  // From icon: Azure-Cosmos-DB.svg (title-cased)
  'MySQL': 'Azure Database for MySQL',
  'PostgreSQL': 'Azure Database for PostgreSQL',
  'Azure Database for PostgreSQL': 'Azure Database for PostgreSQL',
  'Redis': 'Azure Cache for Redis',
  'Redis Cache': 'Azure Cache for Redis',
  'Cache Redis': 'Azure Cache for Redis',
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
  'ExpressRoute': 'ExpressRoute',
  'Express Route': 'ExpressRoute',
  'Azure ExpressRoute': 'ExpressRoute',
  'Front Door': 'Azure Front Door Service',
  'Azure Front Door': 'Azure Front Door Service',
  'Azure Front Door Service': 'Azure Front Door Service',
  'CDN': 'Content Delivery Network',
  'Azure CDN': 'Content Delivery Network',
  'Azure Content Delivery Network': 'Content Delivery Network',
  'Content Delivery Network': 'Content Delivery Network',
  'Traffic Manager': 'Traffic Manager',
  'Azure Traffic Manager': 'Traffic Manager',
  'Azure Firewall': 'Azure Firewall',
  'Firewall': 'Azure Firewall',
  'Network Watcher': 'Network Watcher',
  'Azure Network Watcher': 'Network Watcher',
  
  // Analytics
  'Power BI Embedded': 'Power BI Embedded',
  'Power BI': 'Power BI Embedded',
  'Stream Analytics': 'Azure Stream Analytics',
  'Azure Stream Analytics': 'Azure Stream Analytics',
  'Data Factory': 'Azure Data Factory',
  'Azure Data Factory': 'Azure Data Factory',
  'Synapse Analytics': 'Azure Synapse Analytics',
  'Event Hubs': 'Azure Event Hubs',
  'Azure Event Hubs': 'Azure Event Hubs',
  'Data Lake': 'Azure Data Lake Storage',
  'Data Lake Storage': 'Azure Data Lake Storage',
  'Data Lake Storage Gen2': 'Azure Data Lake Storage',
  'Azure Data Lake Storage Gen2': 'Azure Data Lake Storage',
  
  // AI & Machine Learning
  'Machine Learning': 'Azure Machine Learning',
  'Azure Machine Learning': 'Azure Machine Learning',
  'Cognitive Services': 'Cognitive Services',
  // AI Services - mapped to display names that regionalPricingService understands
  'OpenAI': 'Azure OpenAI',
  'Azure OpenAI': 'Azure OpenAI',
  'Bot Service': 'Azure Bot Service',
  'Azure AI Document Intelligence': 'Document Intelligence',
  'Document Intelligence': 'Document Intelligence',
  'Form Recognizer': 'Form Recognizer',
  'Azure AI Language': 'Language',
  'Language': 'Language',
  'Text Analytics': 'Language',
  'Azure AI Speech': 'Speech',
  'Speech': 'Speech',
  'Speech Services': 'Speech',
  'Azure AI Vision': 'Vision',
  'Vision': 'Vision',
  'Computer Vision': 'Vision',
  'Face': 'Face',
  'Azure AI Translator': 'Translator',
  'Translator': 'Translator',
  'Translator Text': 'Translator',
  'Custom Vision': 'Custom Vision',
  'Content Safety': 'Content Safety',
  'Azure Cognitive Search': 'Azure Cognitive Search',
  'Cognitive Search': 'Azure Cognitive Search',
  'Azure AI Search': 'Azure Cognitive Search',
  'AI Search': 'Azure Cognitive Search',
  'Azure Search': 'Azure Cognitive Search',
  
  // Identity & Security
  'Active Directory': 'Azure Active Directory',
  'Microsoft Entra ID': 'Microsoft Entra ID',
  'Entra ID': 'Microsoft Entra ID',
  'Azure AD': 'Microsoft Entra ID',
  'Azure Active Directory': 'Microsoft Entra ID',
  'Key Vault': 'Key Vault',
  'Azure Key Vault': 'Key Vault',
  
  // Security
  'Security Center': 'Microsoft Defender for Cloud',
  'Microsoft Defender for Cloud': 'Microsoft Defender for Cloud',
  'Defender for Cloud': 'Microsoft Defender for Cloud',
  'Azure Defender': 'Microsoft Defender for Cloud',
  
  // Backup & Recovery
  'Azure Backup': 'Backup',
  'Backup': 'Backup',
  'Recovery Services': 'Backup',
  'Recovery Services Vault': 'Backup',
  
  // Monitoring
  'Application Insights': 'Application Insights',
  'Log Analytics': 'Azure Monitor',
  'Log Analytics Workspace': 'Log Analytics',
  'Azure Monitor': 'Azure Monitor',
  'Monitor': 'Azure Monitor',  // Generic "Monitor" maps to Azure Monitor
  
  // IoT
  'IoT Hub': 'IoT Hub',
  'Azure IoT Hub': 'IoT Hub',
  'IoT Central': 'IoT Central',
  'Azure IoT Central': 'IoT Central',
  'Digital Twins': 'Digital Twins',
  'Azure Digital Twins': 'Digital Twins',
  
  // Containers (additional)
  'Container Apps': 'Azure Container Apps',
  'Azure Container Apps': 'Azure Container Apps',
  'Container App': 'Azure Container Apps',
  
  // Integration
  'Service Bus': 'Azure Service Bus',
  'Azure Service Bus': 'Azure Service Bus',
  'Event Grid': 'Azure Event Grid',
  'Azure Event Grid': 'Azure Event Grid',
  'SignalR': 'SignalR',
  'SignalR Service': 'SignalR',
  'Azure SignalR Service': 'SignalR',
  'Notification Hubs': 'Notification Hubs',
  'Azure Notification Hubs': 'Notification Hubs',
  'Notification Hub': 'Notification Hubs',
  
  // Healthcare
  'Azure API for FHIR': 'Azure API for FHIR',
  'FHIR': 'Azure API for FHIR',
  'FHIR Service': 'Azure API for FHIR',
  'Health Data Services': 'Azure API for FHIR',
  'Azure Health Data Services': 'Azure API for FHIR',
};

/**
 * Services with usage-based pricing (consumption model)
 * These show variable costs based on usage rather than fixed monthly fees
 */
export const USAGE_BASED_SERVICES = [
  'Storage',
  'Storage Account',
  'Storage Accounts',
  'Storage Accounts (Classic)',
  'Blob Storage',
  'Azure Blob Storage',
  'CDN',
  'Azure CDN',
  'Content Delivery Network',
  'Function Apps',
  'Azure Functions',
  'Static Web Apps',
  'Azure Static Web Apps',
  'Data Lake Storage',
  'Azure Data Lake Storage',
  'Data Lake Storage Gen2',
  'Azure Data Lake Storage Gen2',
  'Event Hubs',
  'Azure Event Hubs',
  'Service Bus',
  'Azure Service Bus',
  'Cosmos DB',
  'Azure Cosmos DB',
  'Cognitive Services',
  'Azure AI Document Intelligence',
  'Document Intelligence',
  'Form Recognizer',
  'Azure AI Language',
  'Language',
  'Text Analytics',
  'Azure AI Speech',
  'Speech',
  'Speech Services',
  'Azure AI Vision',
  'Vision',
  'Computer Vision',
  'Face',
  'Azure AI Translator',
  'Translator',
  'Azure OpenAI',
  'OpenAI',
  'Custom Vision',
  'Content Safety',
  'Azure Cognitive Search',
  'Cognitive Search',
  'Azure AI Search',
  'AI Search',
  // IoT
  'IoT Hub',
  'Azure IoT Hub',
  'IoT Central',
  'Azure IoT Central',
  'Digital Twins',
  'Azure Digital Twins',
  // Containers
  'Container Apps',
  'Azure Container Apps',
  // Integration
  'Event Grid',
  'Azure Event Grid',
  'SignalR',
  'SignalR Service',
  'Azure SignalR Service',
  'Notification Hubs',
  'Azure Notification Hubs',
  // Healthcare
  'Azure API for FHIR',
  'FHIR',
  'FHIR Service',
];

/**
 * Default tier recommendations for each service
 */
export const DEFAULT_TIERS: Record<string, string> = {
  'App Service': 'S1',
  'App Services': 'S1',
  'App Service Certificates': 'Premium',
  'Static Web Apps': 'Standard',
  'Azure Static Web Apps': 'Standard',
  'Azure Static Web App': 'Standard',
  'Function Apps': 'Premium',
  'SQL Database': 'S1',
  'Sql Database': 'S1',
  'Azure SQL Database': 'S1',
  'Azure Sql Database': 'S1',
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
  'ExpressRoute': 'Standard',
  'Azure Firewall': 'Standard',
  'Firewall': 'Standard',
  'VPN Gateway': 'VpnGw2',
  'Virtual Network': 'Standard',
  'Network Watcher': 'Standard',
  'Microsoft Entra ID': 'P1',
  'Entra ID': 'P1',
  'Azure AD': 'P1',
  'Microsoft Defender for Cloud': 'Standard',
  'Defender for Cloud': 'Standard',
  'Security Center': 'Standard',
  'Backup': 'Standard',
  'Azure Backup': 'Standard',
  'Azure Cache for Redis': 'C1',
  'Cache Redis': 'C1',
  'API Management': 'Developer',
  'API Management Services': 'Developer',
  'Api Management Services': 'Developer',
  'Azure API Management': 'Developer',
  'CDN': 'Standard_Microsoft',
  'Azure CDN': 'Standard_Microsoft',
  'Content Delivery Network': 'Standard_Microsoft',
  'Data Factory': 'Standard',
  'Azure Data Factory': 'Standard',
  'Event Hubs': 'Standard',
  'Azure Event Hubs': 'Standard',
  'Machine Learning': 'Standard',
  'Azure Machine Learning': 'Standard',
  'Container Registry': 'Standard',
  'Azure Container Registry': 'Standard',
  'Data Lake Storage Gen2': 'Hot LRS',
  'Azure Data Lake Storage Gen2': 'Hot LRS',
  'Cognitive Services': 'S0',
  // AI Services - use Standard or Free as defaults for realistic estimates
  'Azure OpenAI': 'Standard',
  'OpenAI': 'Standard',
  'Document Intelligence': 'Standard',
  'Form Recognizer': 'Standard',
  'Language': 'Standard',
  'Text Analytics': 'Standard',
  'Speech': 'Standard',
  'Speech Services': 'Standard',
  'Vision': 'Standard',
  'Computer Vision': 'Standard',
  'Face': 'Standard',
  'Translator': 'Standard',
  'Custom Vision': 'Standard',
  'Content Safety': 'Standard',
  'Azure Cognitive Search': 'Basic',
  'Cognitive Search': 'Basic',
  'Azure AI Search': 'Basic',
  'AI Search': 'Basic',
  // IoT
  'IoT Hub': 'S1',
  'Azure IoT Hub': 'S1',
  'IoT Central': 'Standard',
  'Azure IoT Central': 'Standard',
  'Digital Twins': 'Standard',
  'Azure Digital Twins': 'Standard',
  // Containers
  'Container Apps': 'Consumption',
  'Azure Container Apps': 'Consumption',
  // Networking (additional)
  'Load Balancer': 'Standard',
  'Azure Load Balancer': 'Standard',
  'Traffic Manager': 'Standard',
  'Azure Traffic Manager': 'Standard',
  // Integration
  'Event Grid': 'Standard',
  'Azure Event Grid': 'Standard',
  'SignalR': 'Standard',
  'SignalR Service': 'Standard',
  'Azure SignalR Service': 'Standard',
  'Notification Hubs': 'Standard',
  'Azure Notification Hubs': 'Standard',
  // Healthcare
  'Azure API for FHIR': 'Standard',
  'FHIR': 'Standard',
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
  'App Service Certificates': {
    basic: 0, // Consumption plan
    standard: 159.35, // Premium EP1
    premium: 318.70, // Premium EP2
    unit: 'per instance/month'
  },
  'Function Apps': {
    basic: 0, // Consumption plan
    standard: 159.35, // Premium EP1
    premium: 318.70, // Premium EP2
    unit: 'per instance/month'
  },
  'Azure Functions': {
    basic: 0, // Consumption plan
    standard: 159.35, // Premium EP1
    premium: 318.70, // Premium EP2
    unit: 'per instance/month'
  },
  'Functions': {
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
  'Sql Database': {
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
  'API Management Services': {
    basic: 0, // Consumption (pay per call)
    standard: 50.26, // Developer tier
    premium: 696.55, // Standard tier
    unit: 'per instance/month'
  },
  'Api Management Services': {
    basic: 0, // Consumption (pay per call)
    standard: 50.26, // Developer tier
    premium: 696.55, // Standard tier
    unit: 'per instance/month'
  },
  'Cache Redis': {
    basic: 16.06, // C1
    standard: 64.24, // C2
    premium: 256.96, // C4
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
  'ExpressRoute': {
    basic: 55.00, // Local circuit
    standard: 290.00, // Standard circuit
    premium: 580.00, // Premium circuit
    unit: 'per circuit/month'
  },
  'Azure Firewall': {
    basic: 438.00, // Basic tier
    standard: 912.50, // Standard tier
    premium: 1095.00, // Premium tier
    unit: 'per firewall/month'
  },
  'VPN Gateway': {
    basic: 26.28, // VpnGw1
    standard: 140.16, // VpnGw2
    premium: 361.35, // VpnGw3
    unit: 'per gateway/month'
  },
  'Virtual Network': {
    basic: 0, // Free
    standard: 3.65, // Peering
    premium: 7.30, // Global peering
    unit: 'per peering/month'
  },
  'Network Watcher': {
    basic: 0, // Free tier
    standard: 2.00, // Per flow log
    premium: 10.00, // Connection monitor
    unit: 'per resource/month'
  },
  'Microsoft Entra ID': {
    basic: 0, // Free tier
    standard: 6.00, // P1 per user
    premium: 9.00, // P2 per user
    unit: 'per user/month'
  },
  'Microsoft Defender for Cloud': {
    basic: 0, // Free tier
    standard: 15.00, // Per server
    premium: 15.00, // Per server
    unit: 'per server/month'
  },
  'Security Center': {
    basic: 0, // Free tier
    standard: 15.00, // Per server
    premium: 15.00, // Per server
    unit: 'per server/month'
  },
  'Backup': {
    basic: 5.00, // 10GB
    standard: 10.00, // 50GB
    premium: 25.00, // 500GB
    unit: 'per instance/month'
  },
  'Azure Backup': {
    basic: 5.00, // 10GB
    standard: 10.00, // 50GB
    premium: 25.00, // 500GB
    unit: 'per instance/month'
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
  'Azure Monitor': {
    basic: 0, // First 5GB free
    standard: 2.30, // per GB (Log Analytics ingestion)
    premium: 2.30, // per GB
    unit: 'per GB/month'
  },
  'Monitor': {
    basic: 0, // First 5GB free
    standard: 2.30, // per GB (Log Analytics ingestion)
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
  'Data Factory': {
    basic: 0, // Pay per activity
    standard: 5.00, // Estimated for typical usage
    premium: 50.00, // High volume
    unit: 'per pipeline/month'
  },
  'Azure Data Factory': {
    basic: 0, // Pay per activity
    standard: 5.00, // Estimated for typical usage
    premium: 50.00, // High volume
    unit: 'per pipeline/month'
  },
  'Stream Analytics': {
    basic: 80.30, // 1 SU (Standard)
    standard: 80.30, // 1 SU (Standard)
    premium: 481.80, // 6 SUs
    unit: 'per streaming unit/month'
  },
  'Azure Stream Analytics': {
    basic: 80.30, // 1 SU (Standard)
    standard: 80.30, // 1 SU (Standard)
    premium: 481.80, // 6 SUs
    unit: 'per streaming unit/month'
  },
  'Power BI Embedded': {
    basic: 735.00, // A1 (3 GB RAM)
    standard: 1471.00, // A2 (5 GB RAM)
    premium: 4706.00, // A4 (25 GB RAM)
    unit: 'per capacity/month'
  },
  'Event Hubs': {
    basic: 11.28, // Basic tier
    standard: 27.60, // Standard tier (1 TU)
    premium: 330.00, // Premium tier (1 PU)
    unit: 'per namespace/month'
  },
  'Azure Event Hubs': {
    basic: 11.28, // Basic tier
    standard: 27.60, // Standard tier (1 TU)
    premium: 330.00, // Premium tier (1 PU)
    unit: 'per namespace/month'
  },
  'Machine Learning': {
    basic: 0, // Compute based
    standard: 50.00, // Estimated workspace cost
    premium: 200.00, // With compute
    unit: 'per workspace/month'
  },
  'Azure Machine Learning': {
    basic: 0, // Compute based
    standard: 50.00, // Estimated workspace cost
    premium: 200.00, // With compute
    unit: 'per workspace/month'
  },
  // AML Sub-components (granular architecture)
  // Endpoints and deployments have $0 cost - they are routing/config constructs
  // Only compute resources have actual cost
  'AML Online Endpoint': {
    basic: 0,
    standard: 0,
    premium: 0,
    unit: 'no direct cost (routing only)'
  },
  'AML Batch Endpoint': {
    basic: 0,
    standard: 0,
    premium: 0,
    unit: 'no direct cost (routing only)'
  },
  'AML Deployment': {
    basic: 0,
    standard: 0,
    premium: 0,
    unit: 'no direct cost (config only)'
  },
  'AML Managed Compute': {
    basic: 50.00, // Small instance
    standard: 200.00, // Standard instance (DS3_v2 equivalent)
    premium: 800.00, // GPU instance
    unit: 'per instance/month'
  },
  'Batch Compute Pool': {
    basic: 0, // Scale-to-zero
    standard: 100.00, // Small pool
    premium: 500.00, // Large/GPU pool
    unit: 'per pool/month (usage-based)'
  },
  'Container Registry': {
    basic: 5.00, // Basic tier
    standard: 20.00, // Standard tier
    premium: 500.00, // Premium tier (with geo-replication)
    unit: 'per registry/month'
  },
  'Azure Container Registry': {
    basic: 5.00, // Basic tier
    standard: 20.00, // Standard tier
    premium: 500.00, // Premium tier (with geo-replication)
    unit: 'per registry/month'
  },
  'Data Lake': {
    basic: 0.02, // per GB
    standard: 0.02, // per GB
    premium: 0.15, // per GB (Premium)
    unit: 'per GB/month'
  },
  'Azure Data Lake Storage': {
    basic: 18.40, // ~1TB
    standard: 18.40, // ~1TB
    premium: 109.50, // ~1TB Premium
    unit: 'per account/month'
  },
  'Data Lake Storage Gen2': {
    basic: 18.40, // ~1TB
    standard: 18.40, // ~1TB
    premium: 109.50, // ~1TB Premium
    unit: 'per account/month'
  },
  'Azure Data Lake Storage Gen2': {
    basic: 18.40, // ~1TB
    standard: 18.40, // ~1TB
    premium: 109.50, // ~1TB Premium
    unit: 'per account/month'
  },
  'Cognitive Services': {
    basic: 0, // Free tier available
    standard: 100.00, // S0 tier estimated
    premium: 500.00, // High volume
    unit: 'per resource/month'
  },
  'Azure AI Document Intelligence': {
    basic: 0, // Free tier
    standard: 50.00, // S0 tier (1,000 pages)
    premium: 500.00, // High volume
    unit: 'per resource/month'
  },
  'Document Intelligence': {
    basic: 0, // Free tier
    standard: 50.00, // S0 tier
    premium: 500.00, // High volume
    unit: 'per resource/month'
  },
  'Form Recognizer': {
    basic: 0, // Free tier
    standard: 50.00, // S0 tier
    premium: 500.00, // High volume
    unit: 'per resource/month'
  },
  'Azure AI Language': {
    basic: 0, // Free tier
    standard: 25.00, // S tier (10K text records)
    premium: 250.00, // High volume
    unit: 'per resource/month'
  },
  'Language': {
    basic: 0, // Free tier
    standard: 25.00, // S tier
    premium: 250.00, // High volume
    unit: 'per resource/month'
  },
  'Text Analytics': {
    basic: 0, // Free tier
    standard: 25.00, // S tier
    premium: 250.00, // High volume
    unit: 'per resource/month'
  },
  'Azure AI Speech': {
    basic: 0, // Free tier
    standard: 100.00, // S0 tier (~100K transactions)
    premium: 1000.00, // High volume
    unit: 'per resource/month'
  },
  'Speech': {
    basic: 0, // Free tier
    standard: 100.00, // S0 tier
    premium: 1000.00, // High volume
    unit: 'per resource/month'
  },
  'Speech Services': {
    basic: 0, // Free tier
    standard: 100.00, // S0 tier
    premium: 1000.00, // High volume
    unit: 'per resource/month'
  },
  'Azure AI Vision': {
    basic: 0, // Free tier
    standard: 150.00, // S1 tier (~10K transactions)
    premium: 1500.00, // High volume
    unit: 'per resource/month'
  },
  'Vision': {
    basic: 0, // Free tier
    standard: 150.00, // S1 tier
    premium: 1500.00, // High volume
    unit: 'per resource/month'
  },
  'Computer Vision': {
    basic: 0, // Free tier
    standard: 150.00, // S1 tier
    premium: 1500.00, // High volume
    unit: 'per resource/month'
  },
  'Azure AI Translator': {
    basic: 0, // Free tier
    standard: 100.00, // S1 tier (~2M chars)
    premium: 1000.00, // High volume
    unit: 'per resource/month'
  },
  'Translator': {
    basic: 0, // Free tier
    standard: 100.00, // S1 tier
    premium: 1000.00, // High volume
    unit: 'per resource/month'
  },
  'Azure OpenAI': {
    basic: 0, // Usage-based
    standard: 200.00, // Estimated typical usage
    premium: 2000.00, // High volume
    unit: 'per resource/month'
  },
  'Azure Cognitive Search': {
    basic: 73.73, // Basic tier ($0.101/hr × 730hrs)
    standard: 245.28, // Standard S1 ($0.336/hr × 730hrs)
    premium: 1962.24, // Standard S3 ($2.688/hr × 730hrs)
    unit: 'per instance/month'
  },
  'Cognitive Search': {
    basic: 73.73,
    standard: 245.28,
    premium: 1962.24,
    unit: 'per instance/month'
  },
  'Azure AI Search': {
    basic: 73.73,
    standard: 245.28,
    premium: 1962.24,
    unit: 'per instance/month'
  },
  'AI Search': {
    basic: 73.73,
    standard: 245.28,
    premium: 1962.24,
    unit: 'per instance/month'
  },
  // IoT Services
  'IoT Hub': {
    basic: 10.00, // B1 tier
    standard: 25.00, // S1 tier
    premium: 250.00, // S3 tier
    unit: 'per unit/month'
  },
  'Azure IoT Hub': {
    basic: 10.00,
    standard: 25.00,
    premium: 250.00,
    unit: 'per unit/month'
  },
  'IoT Central': {
    basic: 0, // Free tier (2 devices)
    standard: 50.00, // ~20 devices
    premium: 250.00, // ~100 devices
    unit: 'per app/month'
  },
  'Azure IoT Central': {
    basic: 0,
    standard: 50.00,
    premium: 250.00,
    unit: 'per app/month'
  },
  'Digital Twins': {
    basic: 0, // Pay per operation
    standard: 50.00, // Estimated typical usage
    premium: 500.00, // High volume
    unit: 'per resource/month'
  },
  'Azure Digital Twins': {
    basic: 0,
    standard: 50.00,
    premium: 500.00,
    unit: 'per resource/month'
  },
  // Container Services (additional)
  'Container Apps': {
    basic: 0, // Consumption (scale to zero)
    standard: 50.00, // Typical workload
    premium: 200.00, // High volume
    unit: 'per app/month'
  },
  'Azure Container Apps': {
    basic: 0,
    standard: 50.00,
    premium: 200.00,
    unit: 'per app/month'
  },
  // Networking (additional)
  'Load Balancer': {
    basic: 0, // Basic tier is free
    standard: 18.25, // Standard tier
    premium: 36.50, // Additional rules
    unit: 'per LB/month'
  },
  'Azure Load Balancer': {
    basic: 0,
    standard: 18.25,
    premium: 36.50,
    unit: 'per LB/month'
  },
  'Traffic Manager': {
    basic: 0.54, // Per 1M DNS queries
    standard: 5.00, // Estimated typical usage
    premium: 20.00, // High traffic
    unit: 'per profile/month'
  },
  'Azure Traffic Manager': {
    basic: 0.54,
    standard: 5.00,
    premium: 20.00,
    unit: 'per profile/month'
  },
  // Integration (additional)
  'Event Grid': {
    basic: 0, // First 100K ops free
    standard: 0.60, // Per 1M operations
    premium: 6.00, // 10M operations
    unit: 'per million operations'
  },
  'Azure Event Grid': {
    basic: 0,
    standard: 0.60,
    premium: 6.00,
    unit: 'per million operations'
  },
  'SignalR': {
    basic: 0, // Free tier (20 connections)
    standard: 49.00, // Standard 1 unit (1K connections)
    premium: 490.00, // 10 units
    unit: 'per unit/month'
  },
  'SignalR Service': {
    basic: 0,
    standard: 49.00,
    premium: 490.00,
    unit: 'per unit/month'
  },
  'Azure SignalR Service': {
    basic: 0,
    standard: 49.00,
    premium: 490.00,
    unit: 'per unit/month'
  },
  'Notification Hubs': {
    basic: 0, // Free tier
    standard: 10.00, // Basic tier
    premium: 200.00, // Standard tier (10M pushes)
    unit: 'per namespace/month'
  },
  'Azure Notification Hubs': {
    basic: 0,
    standard: 10.00,
    premium: 200.00,
    unit: 'per namespace/month'
  },
  // Healthcare
  'Azure API for FHIR': {
    basic: 0, // Free tier limited
    standard: 125.00, // Standard tier
    premium: 500.00, // High volume
    unit: 'per service/month'
  },
  'FHIR': {
    basic: 0,
    standard: 125.00,
    premium: 500.00,
    unit: 'per service/month'
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
