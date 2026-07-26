/**
 * Service catalog for the AADB bridge.
 *
 * Maps AADB canonical service names (and aliases / icon-file stems) to the
 * studio's service kinds, and classifies each service so the promoter can place
 * it correctly in the physical topology:
 *
 *   - "privateEndpoint": data/AI/messaging/registry/secrets — private workload
 *     service that gets a private endpoint + private DNS zone.
 *   - "compute":         workload host (AKS, Container Apps, App Service, …) —
 *     placed in the workload subnet, optionally delegated.
 *   - "ingress":         edge/ingress (Application Gateway, APIM) — placed in a
 *     dedicated subnet.
 *   - "observability":   monitoring (App Insights, Log Analytics, Azure Monitor)
 *     — public workload service, no private endpoint.
 *
 * Platform/global constructs (Virtual Network, Private Link, Firewall, Entra ID,
 * Front Door, …) are recognized as INFRASTRUCTURE and handled by the landing
 * zone rather than emitted as workload services — so they are never reported as
 * "unmapped".
 */
import type { z } from "zod";
import type { serviceKindSchema, subnetDelegationSchema } from "../manifest/schema.js";

type ServiceKind = z.infer<typeof serviceKindSchema>;
type Delegation = z.infer<typeof subnetDelegationSchema>;

export type ServiceClass =
  | "privateEndpoint"
  | "compute"
  | "ingress"
  | "observability";

export interface ServiceMapEntry {
  kind: ServiceKind;
  cls: ServiceClass;
  /** Canonical AADB service name to emit when exporting back to AADB. */
  aadbType: string;
  /** AADB icon category. */
  aadbCategory: string;
  /** Private DNS zone for the private endpoint, if privateEndpoint class. */
  privateDnsZone?: string;
  /** Subnet delegation required when placed as compute, if any. */
  delegation?: Delegation;
  /** Icon-file stems (lowercased) that identify this service in a scene node. */
  iconStems: string[];
  /** Lowercased names/aliases used to match an AADB service to this kind. */
  aliases: string[];
}

export const SERVICE_MAP: ServiceMapEntry[] = [
  // --- AI + data (private endpoint) --------------------------------------
  {
    kind: "azureOpenAI",
    cls: "privateEndpoint",
    aadbType: "Azure OpenAI",
    aadbCategory: "ai + machine learning",
    privateDnsZone: "privatelink.openai.azure.com",
    iconStems: ["azure-openai"],
    aliases: ["azure openai", "openai", "azure openai service", "aoai", "gpt", "chatgpt"],
  },
  {
    kind: "aiFoundry",
    cls: "privateEndpoint",
    aadbType: "Cognitive Services",
    aadbCategory: "ai + machine learning",
    privateDnsZone: "privatelink.cognitiveservices.azure.com",
    iconStems: ["cognitive-services"],
    aliases: ["ai foundry", "azure ai foundry", "cognitive services", "azure ai studio", "azure cognitive services"],
  },
  {
    kind: "aiSearch",
    cls: "privateEndpoint",
    aadbType: "Azure Search",
    aadbCategory: "ai + machine learning",
    privateDnsZone: "privatelink.search.windows.net",
    iconStems: ["azure-cognitive-search"],
    aliases: ["azure search", "azure ai search", "azure cognitive search", "ai search", "cognitive search", "search"],
  },
  {
    kind: "storageAccount",
    cls: "privateEndpoint",
    aadbType: "Storage Account",
    aadbCategory: "storage",
    privateDnsZone: "privatelink.blob.core.windows.net",
    iconStems: ["storage-account"],
    aliases: ["storage account", "azure storage", "blob storage", "storage", "data lake", "adls"],
  },
  {
    kind: "cosmosDb",
    cls: "privateEndpoint",
    aadbType: "Azure Cosmos DB",
    aadbCategory: "databases",
    privateDnsZone: "privatelink.documents.azure.com",
    iconStems: ["azure-cosmos-db"],
    aliases: ["azure cosmos db", "cosmos db", "cosmos", "cosmosdb"],
  },
  {
    kind: "sqlDatabase",
    cls: "privateEndpoint",
    aadbType: "SQL Database",
    aadbCategory: "databases",
    privateDnsZone: "privatelink.database.windows.net",
    iconStems: ["sql-database"],
    aliases: ["sql database", "azure sql", "azure sql database", "sql server", "sql"],
  },
  {
    kind: "postgresql",
    cls: "privateEndpoint",
    aadbType: "Azure Database for PostgreSQL",
    aadbCategory: "databases",
    privateDnsZone: "privatelink.postgres.database.azure.com",
    iconStems: ["02827-icon-service-azure-database-postgresql-server-group"],
    aliases: ["azure database for postgresql", "postgresql", "postgres", "azure postgres"],
  },
  {
    kind: "mysql",
    cls: "privateEndpoint",
    aadbType: "Azure Database for MySQL",
    aadbCategory: "databases",
    privateDnsZone: "privatelink.mysql.database.azure.com",
    iconStems: ["azure-database-mysql"],
    aliases: ["azure database for mysql", "mysql", "azure mysql"],
  },
  {
    kind: "redis",
    cls: "privateEndpoint",
    aadbType: "Azure Cache for Redis",
    aadbCategory: "databases",
    privateDnsZone: "privatelink.redis.cache.windows.net",
    iconStems: ["redis-cache"],
    aliases: ["azure cache for redis", "redis", "redis cache", "azure redis"],
  },
  {
    kind: "keyVault",
    cls: "privateEndpoint",
    aadbType: "Key Vault",
    aadbCategory: "security",
    privateDnsZone: "privatelink.vaultcore.azure.net",
    iconStems: ["key-vault"],
    aliases: ["key vault", "azure key vault", "keyvault"],
  },
  {
    kind: "containerRegistry",
    cls: "privateEndpoint",
    aadbType: "Container Registry",
    aadbCategory: "containers",
    privateDnsZone: "privatelink.azurecr.io",
    iconStems: ["container-registry"],
    aliases: ["container registry", "azure container registry", "acr"],
  },
  {
    kind: "eventHubs",
    cls: "privateEndpoint",
    aadbType: "Event Hubs",
    aadbCategory: "integration",
    privateDnsZone: "privatelink.servicebus.windows.net",
    iconStems: ["event-hubs"],
    aliases: ["event hubs", "event hub", "azure event hubs", "eventhub"],
  },
  {
    kind: "serviceBus",
    cls: "privateEndpoint",
    aadbType: "Service Bus",
    aadbCategory: "integration",
    privateDnsZone: "privatelink.servicebus.windows.net",
    iconStems: ["service-bus"],
    aliases: ["service bus", "azure service bus", "servicebus"],
  },
  {
    kind: "eventGrid",
    cls: "privateEndpoint",
    aadbType: "Event Grid",
    aadbCategory: "integration",
    privateDnsZone: "privatelink.eventgrid.azure.net",
    iconStems: ["10206-icon-service-event-grid-topics"],
    aliases: ["event grid", "azure event grid", "eventgrid", "event grid topic"],
  },
  {
    kind: "documentIntelligence",
    cls: "privateEndpoint",
    aadbType: "Document Intelligence",
    aadbCategory: "ai + machine learning",
    privateDnsZone: "privatelink.cognitiveservices.azure.com",
    iconStems: ["document-intelligence"],
    aliases: ["document intelligence", "azure document intelligence", "form recognizer", "doc intelligence"],
  },

  // --- Compute / workload hosts ------------------------------------------
  {
    kind: "containerAppsEnvironment",
    cls: "compute",
    aadbType: "Azure Container Apps",
    aadbCategory: "containers",
    delegation: "Microsoft.App/environments",
    iconStems: ["02989-icon-service-container-apps-environments"],
    aliases: ["azure container apps", "container apps", "container app", "aca"],
  },
  {
    kind: "aks",
    cls: "compute",
    aadbType: "Azure Kubernetes Service",
    aadbCategory: "containers",
    iconStems: ["azure-kubernetes-service"],
    aliases: ["azure kubernetes service", "kubernetes", "aks", "k8s"],
  },
  {
    kind: "appService",
    cls: "compute",
    aadbType: "App Service",
    aadbCategory: "app services",
    delegation: "Microsoft.Web/serverFarms",
    iconStems: ["app-service"],
    aliases: ["app service", "web app", "azure app service", "webapp"],
  },
  {
    kind: "functions",
    cls: "compute",
    aadbType: "Functions",
    aadbCategory: "compute",
    delegation: "Microsoft.Web/serverFarms",
    iconStems: ["azure-functions"],
    aliases: ["functions", "azure functions", "function app", "serverless functions"],
  },
  {
    kind: "containerInstances",
    cls: "compute",
    aadbType: "Container Instances",
    aadbCategory: "containers",
    iconStems: ["container-instances"],
    aliases: ["container instances", "azure container instances", "aci"],
  },
  {
    kind: "virtualMachine",
    cls: "compute",
    aadbType: "Virtual Machine",
    aadbCategory: "compute",
    iconStems: ["virtual-machines"],
    aliases: ["virtual machine", "virtual machines", "vm", "azure vm"],
  },

  // --- Ingress / edge -----------------------------------------------------
  {
    kind: "applicationGateway",
    cls: "ingress",
    aadbType: "Application Gateway",
    aadbCategory: "networking",
    iconStems: ["application-gateway"],
    aliases: ["application gateway", "app gateway", "azure application gateway", "waf"],
  },
  {
    kind: "apiManagement",
    cls: "ingress",
    aadbType: "API Management",
    aadbCategory: "integration",
    iconStems: ["api-management"],
    aliases: ["api management", "apim", "azure api management"],
  },

  // --- Observability ------------------------------------------------------
  {
    kind: "applicationInsights",
    cls: "observability",
    aadbType: "Application Insights",
    aadbCategory: "devops",
    iconStems: ["application-insights"],
    aliases: ["application insights", "app insights", "appinsights"],
  },
  {
    kind: "logAnalytics",
    cls: "observability",
    aadbType: "Log Analytics Workspace",
    aadbCategory: "management + governance",
    iconStems: ["log-analytics"],
    aliases: ["log analytics workspace", "log analytics", "azure monitor logs"],
  },
  {
    kind: "azureMonitor",
    cls: "observability",
    aadbType: "Azure Monitor",
    aadbCategory: "monitor",
    iconStems: ["00001-icon-service-monitor"],
    aliases: ["azure monitor", "monitor"],
  },
];

const BY_ALIAS = new Map<string, ServiceMapEntry>();
const BY_STEM = new Map<string, ServiceMapEntry>();
for (const entry of SERVICE_MAP) {
  BY_ALIAS.set(entry.aadbType.toLowerCase(), entry);
  for (const a of entry.aliases) BY_ALIAS.set(a, entry);
  for (const s of entry.iconStems) BY_STEM.set(s, entry);
}

const BY_KIND = new Map<ServiceKind, ServiceMapEntry>(
  SERVICE_MAP.map((e) => [e.kind, e]),
);

/** Resolve an AADB service (by canonical name or alias) to a studio entry. */
export function mapAadbService(nameOrType: string): ServiceMapEntry | undefined {
  return BY_ALIAS.get(nameOrType.trim().toLowerCase());
}

/** Resolve by exact icon-file stem. */
export function mapIconStem(stem: string): ServiceMapEntry | undefined {
  return BY_STEM.get(stem.toLowerCase());
}

/** Look up the studio<->AADB entry for a given service kind. */
export function mapKind(kind: ServiceKind): ServiceMapEntry | undefined {
  return BY_KIND.get(kind);
}

/**
 * Platform / global constructs the landing zone owns (or that are global and
 * have no spoke network footprint). These are recognized so the promoter can
 * account for them WITHOUT reporting them as unmapped workload services.
 */
export const INFRASTRUCTURE = {
  aliases: new Set<string>([
    "virtual network", "vnet", "azure vnet",
    "private link", "azure private link", "private endpoint",
    "load balancer", "azure load balancer",
    "azure firewall", "firewall",
    "vpn gateway", "virtual network gateway",
    "expressroute", "expressroute circuit",
    "azure front door", "front door",
    "traffic manager",
    "azure bastion", "bastion",
    "network watcher",
    "ddos protection", "ddos protection plan",
    "azure dns", "dns", "private dns zone",
    "microsoft entra id", "entra id", "azure active directory", "azure ad", "aad",
    "microsoft defender for cloud", "defender for cloud",
    "recovery services vault",
    "nat gateway",
    "content delivery network", "cdn", "azure cdn",
  ]),
  iconStems: new Set<string>([
    "10061-icon-service-virtual-networks",
    "10062-icon-service-load-balancers",
    "10084-icon-service-firewalls",
    "10063-icon-service-virtual-network-gateways",
    "10079-icon-service-expressroute-circuits",
    "azure-front-door",
    "10065-icon-service-traffic-manager-profiles",
    "02422-icon-service-bastions",
    "10067-icon-service-network-watcher",
    "10072-icon-service-ddos-protection-plans",
    "10340-icon-service-entra-identity-roles-and-administrators",
    "10241-icon-service-microsoft-defender-for-cloud",
    "00017-icon-service-recovery-services-vaults",
    "00056-icon-service-cdn-profiles",
  ]),
};

/** True if a name/alias or icon stem denotes recognized platform/global infra. */
export function isInfrastructure(nameOrType?: string, iconStem?: string): boolean {
  if (iconStem && INFRASTRUCTURE.iconStems.has(iconStem.toLowerCase())) return true;
  if (nameOrType && INFRASTRUCTURE.aliases.has(nameOrType.trim().toLowerCase())) return true;
  return false;
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
