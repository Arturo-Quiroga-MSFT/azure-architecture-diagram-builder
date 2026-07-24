/**
 * Bidirectional mapping between AADB canonical service names and the Physical
 * Architecture Studio's service kinds, including the private-link facts needed
 * to promote a concept service into a private endpoint.
 *
 * AADB identifies services by canonical name (with aliases). We match on a
 * lowercased alias set so promotion is tolerant of naming variations.
 */
import type { z } from "zod";
import type { serviceKindSchema } from "../manifest/schema.js";

type ServiceKind = z.infer<typeof serviceKindSchema>;

export interface ServiceMapEntry {
  kind: ServiceKind;
  /** Canonical AADB service name to emit when exporting back to AADB. */
  aadbType: string;
  /** AADB icon category. */
  aadbCategory: string;
  /** Whether this service supports (and should get) a private endpoint. */
  privateEndpoint: boolean;
  /** Private DNS zone for the private endpoint, if any. */
  privateDnsZone?: string;
  /** Lowercased names/aliases used to match an AADB service to this kind. */
  aliases: string[];
}

export const SERVICE_MAP: ServiceMapEntry[] = [
  {
    kind: "azureOpenAI",
    aadbType: "Azure OpenAI",
    aadbCategory: "ai + machine learning",
    privateEndpoint: true,
    privateDnsZone: "privatelink.openai.azure.com",
    aliases: ["azure openai", "openai", "azure openai service", "aoai", "gpt"],
  },
  {
    kind: "aiFoundry",
    aadbType: "Cognitive Services",
    aadbCategory: "ai + machine learning",
    privateEndpoint: true,
    privateDnsZone: "privatelink.cognitiveservices.azure.com",
    aliases: ["ai foundry", "azure ai foundry", "cognitive services", "azure ai studio"],
  },
  {
    kind: "aiSearch",
    aadbType: "Azure Search",
    aadbCategory: "ai + machine learning",
    privateEndpoint: true,
    privateDnsZone: "privatelink.search.windows.net",
    aliases: ["azure search", "azure ai search", "azure cognitive search", "ai search", "search"],
  },
  {
    kind: "storageAccount",
    aadbType: "Storage Account",
    aadbCategory: "storage",
    privateEndpoint: true,
    privateDnsZone: "privatelink.blob.core.windows.net",
    aliases: ["storage account", "azure storage", "blob storage", "storage"],
  },
  {
    kind: "cosmosDb",
    aadbType: "Azure Cosmos DB",
    aadbCategory: "databases",
    privateEndpoint: true,
    privateDnsZone: "privatelink.documents.azure.com",
    aliases: ["azure cosmos db", "cosmos db", "cosmos", "cosmosdb"],
  },
  {
    kind: "keyVault",
    aadbType: "Key Vault",
    aadbCategory: "security",
    privateEndpoint: true,
    privateDnsZone: "privatelink.vaultcore.azure.net",
    aliases: ["key vault", "azure key vault", "keyvault"],
  },
  {
    kind: "containerAppsEnvironment",
    aadbType: "Azure Container Apps",
    aadbCategory: "containers",
    privateEndpoint: false,
    aliases: ["azure container apps", "container apps", "aca"],
  },
  {
    kind: "appService",
    aadbType: "App Service",
    aadbCategory: "app services",
    privateEndpoint: false,
    aliases: ["app service", "web app", "azure app service"],
  },
  {
    kind: "applicationInsights",
    aadbType: "Application Insights",
    aadbCategory: "devops",
    privateEndpoint: false,
    aliases: ["application insights", "app insights", "appinsights"],
  },
  {
    kind: "logAnalytics",
    aadbType: "Log Analytics Workspace",
    aadbCategory: "management + governance",
    privateEndpoint: false,
    aliases: ["log analytics workspace", "log analytics", "azure monitor logs"],
  },
];

const BY_ALIAS = new Map<string, ServiceMapEntry>();
for (const entry of SERVICE_MAP) {
  BY_ALIAS.set(entry.aadbType.toLowerCase(), entry);
  for (const a of entry.aliases) BY_ALIAS.set(a, entry);
}

const BY_KIND = new Map<ServiceKind, ServiceMapEntry>(
  SERVICE_MAP.map((e) => [e.kind, e]),
);

/** Resolve an AADB service (by canonical name or alias) to a studio entry. */
export function mapAadbService(nameOrType: string): ServiceMapEntry | undefined {
  return BY_ALIAS.get(nameOrType.trim().toLowerCase());
}

/** Look up the studio<->AADB entry for a given service kind. */
export function mapKind(kind: ServiceKind): ServiceMapEntry | undefined {
  return BY_KIND.get(kind);
}

/** Canonical AADB names for the physical network constructs we export. */
export const NETWORK_AADB_TYPES = {
  virtualNetwork: { type: "Virtual Network", category: "networking" },
  firewall: { type: "Azure Firewall", category: "networking" },
  vpnGateway: { type: "VPN Gateway", category: "networking" },
  expressRoute: { type: "ExpressRoute", category: "networking" },
  privateEndpoint: { type: "Private Endpoint", category: "networking" },
  privateDnsZone: { type: "Azure DNS", category: "networking" },
  onPremises: { type: "On-premises", category: "other" },
} as const;
