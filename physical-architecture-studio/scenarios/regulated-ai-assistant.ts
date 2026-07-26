/**
 * Golden scenario: "Regulated AI Knowledge Assistant".
 *
 * Per CAF guidance there is NO separate "AI landing zone" — AI workloads are
 * deployed into an ordinary APPLICATION landing zone, governed by the same ALZ
 * design areas as any other workload. This scenario therefore models:
 *   - a PLATFORM landing zone / connectivity subscription (hub, Azure Firewall,
 *     ExpressRoute gateway, DNS)
 *   - an APPLICATION landing zone (Corp archetype) hosting the AI workload,
 *     its subnets and private endpoints
 *   - private-only AI services (Azure OpenAI, AI Search, Storage, Cosmos, KV)
 *   - private DNS zones for privatelink resolution
 *   - an on-premises range for hybrid overlap validation
 *
 * Address plan (deliberately non-overlapping, ALZ-style):
 *   Hub VNet         10.20.0.0/16
 *   Spoke VNet       10.21.0.0/16
 *   On-premises      10.0.0.0/16
 */
import type { PhysicalManifest } from "../core/manifest/schema.js";

export const regulatedAiAssistant: PhysicalManifest = {
  apiVersion: "aadb.physical/v1alpha1",
  metadata: {
    name: "regulated-ai-knowledge-assistant",
    description:
      "Regulated AI knowledge assistant connecting on-premises data to private Azure AI services. The AI workload runs in an application landing zone; connectivity is provided by the platform landing zone hub.",
    sovereignProfile: "azure-public-regulated",
  },
  regions: {
    primary: "eastus2",
    disasterRecovery: "centralus",
  },
  onPremises: {
    addressSpaces: ["10.0.0.0/16"],
  },
  networkTopology: "hubSpoke",
  managementGroups: {
    intermediateRoot: "alz",
    platform: ["management", "identity", "connectivity", "security"],
    landingZones: ["corp", "online"],
    sandbox: true,
    decommissioned: true,
  },
  privateDnsZones: [
    { zone: "privatelink.openai.azure.com", linkedVnets: ["spoke-ai-vnet"] },
    { zone: "privatelink.search.windows.net", linkedVnets: ["spoke-ai-vnet"] },
    { zone: "privatelink.blob.core.windows.net", linkedVnets: ["spoke-ai-vnet"] },
    { zone: "privatelink.documents.azure.com", linkedVnets: ["spoke-ai-vnet"] },
    { zone: "privatelink.vaultcore.azure.net", linkedVnets: ["spoke-ai-vnet"] },
  ],
  landingZones: [
    {
      name: "connectivity-hub",
      kind: "platform",
      platformSubscription: "connectivity",
      managementGroup: "connectivity",
      vnets: [
        {
          name: "hub-vnet",
          region: "eastus2",
          addressSpace: ["10.20.0.0/16"],
          subnets: [
            {
              name: "AzureFirewallSubnet",
              role: "AzureFirewallSubnet",
              addressPrefix: "10.20.0.0/26",
              delegation: "none",
              privateEndpointSubnet: false,
            },
            {
              name: "GatewaySubnet",
              role: "GatewaySubnet",
              addressPrefix: "10.20.0.64/27",
              delegation: "none",
              privateEndpointSubnet: false,
            },
            {
              name: "management",
              role: "management",
              addressPrefix: "10.20.1.0/24",
              delegation: "none",
              privateEndpointSubnet: false,
            },
          ],
        },
      ],
      firewall: {
        name: "hub-firewall",
        vnet: "hub-vnet",
        skuTier: "Premium",
      },
      gateway: {
        name: "hub-er-gateway",
        vnet: "hub-vnet",
        kind: "expressRoute",
      },
      services: [],
      privateEndpoints: [],
    },
    {
      name: "ai-workload-spoke",
      kind: "application",
      archetype: "corp",
      managementGroup: "corp",
      vnets: [
        {
          name: "spoke-ai-vnet",
          region: "eastus2",
          addressSpace: ["10.21.0.0/16"],
          subnets: [
            {
              name: "container-apps",
              role: "workload",
              addressPrefix: "10.21.0.0/23",
              delegation: "Microsoft.App/environments",
              privateEndpointSubnet: false,
            },
            {
              name: "private-endpoints",
              role: "privateEndpoints",
              addressPrefix: "10.21.2.0/24",
              delegation: "none",
              privateEndpointSubnet: true,
            },
          ],
        },
      ],
      services: [
        { name: "aoai", kind: "azureOpenAI", privateOnly: true },
        { name: "search", kind: "aiSearch", privateOnly: true },
        { name: "docs-storage", kind: "storageAccount", privateOnly: true },
        { name: "state-cosmos", kind: "cosmosDb", privateOnly: true },
        { name: "app-kv", kind: "keyVault", privateOnly: true },
        { name: "aca-env", kind: "containerAppsEnvironment", privateOnly: true },
        { name: "app-insights", kind: "applicationInsights", privateOnly: false },
        { name: "law", kind: "logAnalytics", privateOnly: false },
      ],
      privateEndpoints: [
        {
          name: "pe-aoai",
          service: "aoai",
          subnet: "private-endpoints",
          privateDnsZone: "privatelink.openai.azure.com",
        },
        {
          name: "pe-search",
          service: "search",
          subnet: "private-endpoints",
          privateDnsZone: "privatelink.search.windows.net",
        },
        {
          name: "pe-storage",
          service: "docs-storage",
          subnet: "private-endpoints",
          privateDnsZone: "privatelink.blob.core.windows.net",
        },
        {
          name: "pe-cosmos",
          service: "state-cosmos",
          subnet: "private-endpoints",
          privateDnsZone: "privatelink.documents.azure.com",
        },
        {
          name: "pe-keyvault",
          service: "app-kv",
          subnet: "private-endpoints",
          privateDnsZone: "privatelink.vaultcore.azure.net",
        },
      ],
    },
  ],
};
