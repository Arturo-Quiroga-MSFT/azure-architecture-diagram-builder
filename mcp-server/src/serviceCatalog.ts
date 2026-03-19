// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Azure Service Catalog for MCP Server
 *
 * Standalone extraction of the service icon mapping from the Diagram Builder.
 * Provides the full catalog of 68+ Azure services with categories, aliases,
 * and pricing availability so MCP clients can browse, filter, and select
 * services without needing the browser-based Diagram Builder running.
 */

export interface ServiceInfo {
  displayName: string;
  aliases: string[];
  category: string;
  hasPricingData: boolean;
  pricingServiceName?: string;
  isUsageBased?: boolean;
  costRange?: string;
}

export const SERVICE_CATALOG: Record<string, ServiceInfo> = {
  // AI & Machine Learning
  'Azure OpenAI':           { displayName: 'Azure OpenAI',           aliases: ['OpenAI', 'Azure OpenAI Service', 'GPT', 'ChatGPT'],             category: 'ai + machine learning', hasPricingData: true, pricingServiceName: 'Azure OpenAI', isUsageBased: true, costRange: '$1-200/mo' },
  'Cognitive Services':     { displayName: 'Cognitive Services',     aliases: ['Azure Cognitive Services', 'Cognitive Service'],                 category: 'ai + machine learning', hasPricingData: true, pricingServiceName: 'Cognitive Services', isUsageBased: true, costRange: '$0-500/mo' },
  'Computer Vision':        { displayName: 'Computer Vision',        aliases: ['Vision', 'Azure Vision', 'Azure AI Vision', 'Image Analysis'],  category: 'ai + machine learning', hasPricingData: true, pricingServiceName: 'Vision', isUsageBased: true, costRange: '$150-1500/mo' },
  'Custom Vision':          { displayName: 'Custom Vision',          aliases: ['Azure Custom Vision', 'Custom Vision Service'],                 category: 'ai + machine learning', hasPricingData: true, pricingServiceName: 'Custom Vision', isUsageBased: true, costRange: '$0-300/mo' },
  'Speech Services':        { displayName: 'Speech Services',        aliases: ['Speech', 'Azure Speech', 'Azure AI Speech', 'Speech-to-Text', 'Text-to-Speech'], category: 'ai + machine learning', hasPricingData: true, pricingServiceName: 'Speech', isUsageBased: true, costRange: '$100-1000/mo' },
  'Translator':             { displayName: 'Translator',             aliases: ['Translator Text', 'Azure Translator', 'Azure AI Translator', 'Translation'], category: 'ai + machine learning', hasPricingData: true, pricingServiceName: 'Translator', isUsageBased: true, costRange: '$100-1000/mo' },
  'Language':               { displayName: 'Language',               aliases: ['Azure Language', 'Azure AI Language', 'Text Analytics', 'NLP'], category: 'ai + machine learning', hasPricingData: true, pricingServiceName: 'Language', isUsageBased: true, costRange: '$25-250/mo' },
  'Document Intelligence':  { displayName: 'Document Intelligence',  aliases: ['Form Recognizer', 'Azure Document Intelligence', 'Azure AI Document Intelligence', 'Form Processing'], category: 'ai + machine learning', hasPricingData: true, pricingServiceName: 'Document Intelligence', isUsageBased: true, costRange: '$0-500/mo' },
  'Azure Machine Learning': { displayName: 'Azure Machine Learning', aliases: ['Machine Learning', 'ML', 'AML', 'Azure ML', 'AML Workspace', 'Azure Machine Learning Workspace'], category: 'ai + machine learning', hasPricingData: true, pricingServiceName: 'Azure Machine Learning', isUsageBased: true, costRange: '$0-5000/mo' },
  'Azure Cognitive Search': { displayName: 'Azure Cognitive Search', aliases: ['Cognitive Search', 'Azure Search', 'AI Search'],               category: 'ai + machine learning', hasPricingData: false, costRange: '$75-2500/mo' },

  // Compute
  'Virtual Machines':       { displayName: 'Virtual Machines',       aliases: ['VM', 'VMs', 'Virtual Machine', 'Azure VM'],                    category: 'compute', hasPricingData: true, pricingServiceName: 'Virtual Machines', costRange: '$13-17340/mo' },
  'App Service':            { displayName: 'App Service',            aliases: ['Azure App Service', 'Web App', 'App Services'],                 category: 'app services', hasPricingData: true, pricingServiceName: 'Azure App Service', costRange: '$13-730/mo' },
  'Functions':              { displayName: 'Azure Functions',        aliases: ['Function App', 'Functions', 'Serverless Functions'],             category: 'compute', hasPricingData: true, pricingServiceName: 'Functions', isUsageBased: true, costRange: '$0-160/mo' },
  'Container Instances':    { displayName: 'Container Instances',    aliases: ['ACI', 'Azure Container Instances', 'Container Instance'],       category: 'containers', hasPricingData: true, pricingServiceName: 'Container Instances', isUsageBased: true, costRange: '$0-500/mo' },
  'Kubernetes Service':     { displayName: 'Azure Kubernetes Service', aliases: ['AKS', 'Kubernetes', 'K8s'],                                  category: 'containers', hasPricingData: true, pricingServiceName: 'Azure Kubernetes Service', costRange: '$73/mo + node costs' },
  'Container Registry':     { displayName: 'Container Registry',     aliases: ['ACR', 'Azure Container Registry'],                             category: 'containers', hasPricingData: true, pricingServiceName: 'Container Registry', costRange: '$5-1000/mo' },
  'Container Apps':         { displayName: 'Azure Container Apps',   aliases: ['Azure Container Apps', 'Container App', 'ACA'],                category: 'containers', hasPricingData: true, pricingServiceName: 'Azure Container Apps', isUsageBased: true, costRange: '$0-500/mo' },

  // Databases
  'Azure Cosmos DB':        { displayName: 'Azure Cosmos DB',        aliases: ['Cosmos DB', 'CosmosDB', 'Cosmos'],                             category: 'databases', hasPricingData: true, pricingServiceName: 'Azure Cosmos DB', isUsageBased: true, costRange: '$24-29185/mo' },
  'SQL Database':           { displayName: 'SQL Database',           aliases: ['Azure SQL', 'Azure SQL Database', 'SQL DB'],                   category: 'databases', hasPricingData: true, pricingServiceName: 'SQL Database', costRange: '$5-43800/mo' },
  'PostgreSQL':             { displayName: 'Azure Database for PostgreSQL', aliases: ['PostgreSQL', 'Postgres', 'Azure PostgreSQL', 'Azure Database for PostgreSQL'], category: 'databases', hasPricingData: true, pricingServiceName: 'Azure Database for PostgreSQL', costRange: '$5-11240/mo' },
  'MySQL':                  { displayName: 'Azure Database for MySQL', aliases: ['MySQL', 'Azure MySQL', 'Azure Database for MySQL'],          category: 'databases', hasPricingData: true, pricingServiceName: 'Azure Database for MySQL', costRange: '$5-9800/mo' },
  'Redis Cache':            { displayName: 'Azure Cache for Redis',  aliases: ['Redis', 'Redis Cache', 'Cache'],                               category: 'databases', hasPricingData: true, pricingServiceName: 'Redis Cache', costRange: '$16-13600/mo' },

  // Storage
  'Storage Account':        { displayName: 'Storage Account',        aliases: ['Storage', 'Blob Storage', 'Azure Storage', 'Storage Accounts'], category: 'storage', hasPricingData: true, pricingServiceName: 'Storage', isUsageBased: true, costRange: '$0.02-184/mo per GB' },
  'Data Lake Storage':      { displayName: 'Azure Data Lake Storage', aliases: ['Data Lake', 'Azure Data Lake', 'Data Lake Storage Gen2', 'ADLS'], category: 'storage', hasPricingData: false, isUsageBased: true, costRange: '$0.02-0.15 per GB/mo' },

  // Networking
  'Application Gateway':    { displayName: 'Application Gateway',    aliases: ['App Gateway', 'Azure Application Gateway'],                    category: 'networking', hasPricingData: true, pricingServiceName: 'Application Gateway', costRange: '$125-1200/mo' },
  'Azure Front Door':       { displayName: 'Azure Front Door',       aliases: ['Front Door', 'AFD'],                                           category: 'networking', hasPricingData: true, pricingServiceName: 'Azure Front Door Service', isUsageBased: true, costRange: '$35-412/mo + traffic' },
  'CDN':                    { displayName: 'Content Delivery Network', aliases: ['Azure CDN', 'CDN', 'Content Delivery'],                      category: 'networking', hasPricingData: true, pricingServiceName: 'Content Delivery Network', isUsageBased: true, costRange: '$0.081-0.20 per GB' },
  'Virtual Network':        { displayName: 'Virtual Network',        aliases: ['VNet', 'Azure Virtual Network', 'VNET'],                       category: 'networking', hasPricingData: true, pricingServiceName: 'Virtual Network', costRange: '$0-7.30/mo' },
  'Load Balancer':          { displayName: 'Azure Load Balancer',    aliases: ['Azure Load Balancer', 'LB'],                                   category: 'networking', hasPricingData: true, pricingServiceName: 'Load Balancer', costRange: '$18-730/mo' },
  'Azure Firewall':         { displayName: 'Azure Firewall',         aliases: ['Firewall'],                                                    category: 'networking', hasPricingData: true, pricingServiceName: 'Azure Firewall', costRange: '$438-1095/mo' },
  'VPN Gateway':            { displayName: 'VPN Gateway',            aliases: ['Azure VPN Gateway', 'VPN', 'Virtual Network Gateway'],          category: 'networking', hasPricingData: true, pricingServiceName: 'VPN Gateway', costRange: '$26-361/mo' },
  'ExpressRoute':           { displayName: 'ExpressRoute',           aliases: ['Azure ExpressRoute', 'Express Route'],                         category: 'networking', hasPricingData: true, pricingServiceName: 'ExpressRoute', costRange: '$55-580/mo' },
  'Traffic Manager':        { displayName: 'Azure Traffic Manager',  aliases: ['Azure Traffic Manager'],                                       category: 'networking', hasPricingData: true, pricingServiceName: 'Traffic Manager', isUsageBased: true, costRange: '$0.54 per million queries' },
  'Azure Bastion':          { displayName: 'Azure Bastion',          aliases: ['Bastion', 'Bastion Host'],                                     category: 'networking', hasPricingData: false, costRange: '$138-876/mo' },
  'Azure DDoS Protection':  { displayName: 'Azure DDoS Protection',  aliases: ['DDoS Protection', 'DDoS', 'DDoS Protection Plan'],             category: 'networking', hasPricingData: false, costRange: '$2944/mo' },
  'Private Link':           { displayName: 'Azure Private Link',     aliases: ['Azure Private Link', 'Private Endpoint', 'Private Endpoints'], category: 'networking', hasPricingData: false, costRange: '$7.30/mo per endpoint' },
  'Azure DNS':              { displayName: 'Azure DNS',              aliases: ['DNS', 'DNS Zone', 'DNS Zones', 'Private DNS'],                 category: 'networking', hasPricingData: false, isUsageBased: true, costRange: '$0.50/mo per zone' },
  'Network Watcher':        { displayName: 'Network Watcher',        aliases: ['Azure Network Watcher'],                                       category: 'networking', hasPricingData: true, pricingServiceName: 'Network Watcher', isUsageBased: true, costRange: '$0-10/mo' },
  'Web Application Firewall': { displayName: 'Web Application Firewall', aliases: ['WAF', 'Azure WAF', 'Web Application Firewall Policy'],    category: 'networking', hasPricingData: false, costRange: '$100-500/mo' },

  // Analytics & Data
  'Data Factory':           { displayName: 'Azure Data Factory',     aliases: ['Data Factory', 'ADF'],                                         category: 'analytics', hasPricingData: true, pricingServiceName: 'Azure Data Factory', isUsageBased: true, costRange: '$0.50-2.50 per 1000 activities' },
  'Azure Synapse Analytics': { displayName: 'Azure Synapse Analytics', aliases: ['Synapse', 'Synapse Analytics', 'Azure Synapse'],             category: 'analytics', hasPricingData: true, pricingServiceName: 'Azure Synapse Analytics', isUsageBased: true, costRange: '$5-8000/mo' },
  'Stream Analytics':       { displayName: 'Azure Stream Analytics', aliases: ['Stream Analytics', 'ASA', 'Azure Stream Analytics'],            category: 'analytics', hasPricingData: true, pricingServiceName: 'Stream Analytics', isUsageBased: true, costRange: '$0.11 per SU/hour' },
  'Event Hubs':             { displayName: 'Event Hubs',             aliases: ['Azure Event Hubs', 'Event Hub'],                               category: 'analytics', hasPricingData: true, pricingServiceName: 'Event Hubs', isUsageBased: true, costRange: '$11-6849/mo' },
  'Power BI Embedded':      { displayName: 'Power BI Embedded',      aliases: ['Power BI', 'PowerBI', 'Power BI Dashboard', 'PBI'],            category: 'analytics', hasPricingData: true, pricingServiceName: 'Power BI Embedded', costRange: '$735-4700/mo' },
  'Azure Workbooks':        { displayName: 'Azure Workbooks',        aliases: ['Workbooks', 'Monitor Workbooks'],                              category: 'analytics', hasPricingData: false, costRange: 'Free (data costs apply)' },

  // Integration
  'Service Bus':            { displayName: 'Service Bus',            aliases: ['Azure Service Bus', 'Message Queue'],                          category: 'integration', hasPricingData: true, pricingServiceName: 'Service Bus', isUsageBased: true, costRange: '$0-10/mo + messages' },
  'Logic Apps':             { displayName: 'Logic Apps',             aliases: ['Azure Logic Apps', 'Logic App'],                               category: 'integration', hasPricingData: true, pricingServiceName: 'Logic Apps', isUsageBased: true, costRange: '$0-1000/mo' },
  'API Management':         { displayName: 'API Management',         aliases: ['APIM', 'Azure API Management', 'API Gateway'],                 category: 'integration', hasPricingData: true, pricingServiceName: 'API Management', costRange: '$50-2800/mo' },
  'Event Grid':             { displayName: 'Azure Event Grid',       aliases: ['Azure Event Grid'],                                            category: 'integration', hasPricingData: true, pricingServiceName: 'Azure Event Grid', isUsageBased: true, costRange: '$0.30 per million ops' },
  'SignalR Service':        { displayName: 'Azure SignalR Service',  aliases: ['SignalR', 'Azure SignalR', 'Azure SignalR Service'],            category: 'web', hasPricingData: true, pricingServiceName: 'SignalR', isUsageBased: true, costRange: '$0-49/mo per unit' },
  'Azure API for FHIR':     { displayName: 'Azure API for FHIR',     aliases: ['FHIR', 'Azure Health Data Services', 'Health Data Services'],  category: 'integration', hasPricingData: false, isUsageBased: true, costRange: '$0-3000/mo' },

  // Web
  'Static Web Apps':        { displayName: 'Azure Static Web Apps',  aliases: ['Static Web App', 'Azure Static Web Apps', 'SWA'],              category: 'web', hasPricingData: false, costRange: '$0-9/mo' },

  // Monitoring
  'Azure Monitor':          { displayName: 'Azure Monitor',          aliases: ['Monitor'],                                                     category: 'monitor', hasPricingData: true, pricingServiceName: 'Azure Monitor', isUsageBased: true, costRange: '$2.30 per GB ingested' },
  'Application Insights':   { displayName: 'Application Insights',   aliases: ['App Insights', 'Azure Application Insights', 'Monitoring'],    category: 'monitor', hasPricingData: true, pricingServiceName: 'Application Insights', isUsageBased: true, costRange: '$2.30 per GB ingested' },
  'Log Analytics':          { displayName: 'Log Analytics',          aliases: ['Azure Log Analytics', 'LA', 'Log Analytics Workspace'],         category: 'monitor', hasPricingData: true, pricingServiceName: 'Log Analytics', isUsageBased: true, costRange: '$2.76 per GB ingested' },
  'Azure Managed Grafana':  { displayName: 'Azure Managed Grafana',  aliases: ['Managed Grafana', 'Grafana', 'Azure Grafana'],                 category: 'other', hasPricingData: true, pricingServiceName: 'Azure Managed Grafana', costRange: '$10-300/mo' },
  'Azure Dashboard':        { displayName: 'Azure Dashboard',        aliases: ['Azure Portal Dashboard', 'Dashboard'],                         category: 'other', hasPricingData: false, costRange: 'Free' },

  // Security
  'Key Vault':              { displayName: 'Key Vault',              aliases: ['Azure Key Vault', 'Secrets Management'],                       category: 'security', hasPricingData: true, pricingServiceName: 'Key Vault', isUsageBased: true, costRange: '$0.03 per 10K operations' },
  'Microsoft Defender for Cloud': { displayName: 'Microsoft Defender for Cloud', aliases: ['Defender for Cloud', 'Azure Defender', 'Security Center'], category: 'security', hasPricingData: true, pricingServiceName: 'Microsoft Defender for Cloud', costRange: '$0-15/mo per server' },
  'Microsoft Sentinel':     { displayName: 'Microsoft Sentinel',     aliases: ['Sentinel', 'Azure Sentinel', 'SIEM', 'Azure SIEM'],            category: 'security', hasPricingData: false, isUsageBased: true, costRange: '$2.46 per GB ingested' },

  // Identity
  'Microsoft Entra ID':     { displayName: 'Microsoft Entra ID',     aliases: ['Entra ID', 'Azure AD', 'Azure Active Directory', 'Active Directory'], category: 'identity', hasPricingData: false, costRange: '$0-9/mo per user' },

  // Management
  'Backup':                 { displayName: 'Azure Backup',           aliases: ['Azure Backup', 'Recovery Services', 'Recovery Services Vault'], category: 'management + governance', hasPricingData: true, pricingServiceName: 'Backup', isUsageBased: true, costRange: '$5-25/mo per instance' },
  'Azure Policy':           { displayName: 'Azure Policy',           aliases: ['Policy', 'Azure Policies', 'Governance Policy'],               category: 'management + governance', hasPricingData: false, costRange: '$0 (included)' },
  'Microsoft Purview':      { displayName: 'Microsoft Purview',      aliases: ['Purview', 'Azure Purview', 'Data Governance', 'Data Catalog'], category: 'management + governance', hasPricingData: true, pricingServiceName: 'Microsoft Purview', costRange: '$0.50-240/mo' },

  // IoT
  'IoT Hub':                { displayName: 'Azure IoT Hub',           aliases: ['Azure IoT Hub', 'IoT', 'IoT Hub'],                            category: 'iot', hasPricingData: true, pricingServiceName: 'IoT Hub', isUsageBased: true, costRange: '$0-5000/mo' },
  'IoT Central':            { displayName: 'Azure IoT Central',       aliases: ['Azure IoT Central', 'IoT Central'],                           category: 'iot', hasPricingData: false, isUsageBased: true, costRange: '$0-250/mo' },
  'Digital Twins':          { displayName: 'Azure Digital Twins',     aliases: ['Azure Digital Twins', 'Digital Twin'],                         category: 'iot', hasPricingData: false, isUsageBased: true, costRange: '$0-1000/mo' },
  'Notification Hubs':      { displayName: 'Azure Notification Hubs', aliases: ['Notification Hub', 'Azure Notification Hubs', 'Push Notifications'], category: 'iot', hasPricingData: true, pricingServiceName: 'Notification Hubs', isUsageBased: true, costRange: '$0-200/mo' },
};

/**
 * Resolve a service name to its canonical key (case-insensitive, alias-aware).
 */
export function resolveServiceName(name: string): string | null {
  const trimmed = name.trim();

  // Direct match
  if (SERVICE_CATALOG[trimmed]) return trimmed;

  // Alias search
  const lower = trimmed.toLowerCase();
  for (const [key, info] of Object.entries(SERVICE_CATALOG)) {
    if (info.aliases.some(a => a.toLowerCase() === lower)) return key;
  }

  return null;
}

/**
 * Get all unique categories in the catalog.
 */
export function getCategories(): string[] {
  return [...new Set(Object.values(SERVICE_CATALOG).map(s => s.category))].sort();
}

/**
 * Filter services by category.
 */
export function getServicesByCategory(category: string): Record<string, ServiceInfo> {
  const result: Record<string, ServiceInfo> = {};
  for (const [key, info] of Object.entries(SERVICE_CATALOG)) {
    if (info.category === category) result[key] = info;
  }
  return result;
}
