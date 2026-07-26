/**
 * Physical Manifest — the single canonical source of truth for the Physical
 * Architecture Studio. Everything (diagram, IPAM validation, Bicep, Terraform,
 * IP plan) is derived deterministically from a manifest that conforms to this
 * schema.
 *
 * The manifest models the Azure Landing Zone hub/spoke topology explicitly:
 *   - a PLATFORM landing zone (connectivity hub: firewall, gateway, DNS)
 *   - one or more APPLICATION landing zones (workload spokes: subnets,
 *     private endpoints, workload services)
 *
 * The LLM only ever DRAFTS a manifest from natural-language intent. All address
 * allocation, overlap detection, and IaC emission happen in deterministic code
 * against a validated manifest — never in the model.
 */
import { z } from "zod";

/** An RFC-compliant IPv4 CIDR block, e.g. "10.20.0.0/16". Shape only; semantic
 * validation (reserved ranges, prefix bounds) happens in the IPAM engine. */
export const cidrSchema = z
  .string()
  .regex(
    /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/,
    "Must be an IPv4 CIDR block like 10.20.0.0/16",
  );

export const azureRegionSchema = z.string().min(2).describe("Azure region short name, e.g. eastus2");

/** Landing zone classification, aligned to CAF Enterprise-Scale. */
export const landingZoneKindSchema = z.enum(["platform", "application"]);

/** Subnet delegations we support in the MVP scenario. */
export const subnetDelegationSchema = z.enum([
  "Microsoft.App/environments",
  "Microsoft.Web/serverFarms",
  "Microsoft.Network/dnsResolvers",
  "none",
]);

/**
 * Special Azure subnets require an exact, reserved name. Modeling them
 * explicitly lets the validator enforce naming + minimum prefix rules.
 */
export const specialSubnetRoleSchema = z.enum([
  "AzureFirewallSubnet",
  "AzureFirewallManagementSubnet",
  "GatewaySubnet",
  "AzureBastionSubnet",
  "workload",
  "privateEndpoints",
  "management",
]);

export const subnetSchema = z.object({
  name: z.string().min(1),
  role: specialSubnetRoleSchema.default("workload"),
  addressPrefix: cidrSchema,
  delegation: subnetDelegationSchema.default("none"),
  /** If true, the IPAM engine may auto-place private endpoints into this subnet. */
  privateEndpointSubnet: z.boolean().default(false),
});
export type Subnet = z.infer<typeof subnetSchema>;

export const virtualNetworkSchema = z.object({
  name: z.string().min(1),
  region: azureRegionSchema,
  addressSpace: z.array(cidrSchema).min(1),
  subnets: z.array(subnetSchema).default([]),
});
export type VirtualNetwork = z.infer<typeof virtualNetworkSchema>;

/** Private DNS zones required to resolve private endpoints privately. */
export const privateDnsZoneSchema = z.object({
  /** Canonical zone name, e.g. privatelink.openai.azure.com */
  zone: z.string().min(1),
  /** VNet names this zone is linked to for resolution. */
  linkedVnets: z.array(z.string()).default([]),
});
export type PrivateDnsZone = z.infer<typeof privateDnsZoneSchema>;

/** Workload service kinds the studio can model as deployable resources. */
export const serviceKindSchema = z.enum([
  // AI + data (private-endpoint capable)
  "aiFoundry",
  "azureOpenAI",
  "aiSearch",
  "storageAccount",
  "cosmosDb",
  "sqlDatabase",
  "postgresql",
  "mysql",
  "redis",
  "keyVault",
  "containerRegistry",
  "eventHubs",
  "serviceBus",
  "eventGrid",
  "documentIntelligence",
  "azureMachineLearning",
  "logicApps",
  // Compute / workload hosts
  "containerAppsEnvironment",
  "aks",
  "appService",
  "functions",
  "containerInstances",
  "virtualMachine",
  // Ingress / edge
  "applicationGateway",
  "apiManagement",
  // Observability
  "applicationInsights",
  "logAnalytics",
  "azureMonitor",
]);

export const workloadServiceSchema = z.object({
  name: z.string().min(1),
  kind: serviceKindSchema,
  /** Whether public network access is disabled (private-only). */
  privateOnly: z.boolean().default(true),
});
export type WorkloadService = z.infer<typeof workloadServiceSchema>;

/**
 * A private endpoint binds a workload service to a subnet and a private DNS
 * zone. IP allocation into the subnet is performed by the IPAM engine — the
 * `allocatedIp` field is an OUTPUT, never authored by hand.
 */
export const privateEndpointSchema = z.object({
  name: z.string().min(1),
  /** Name of the workload service this PE fronts. */
  service: z.string().min(1),
  /** Subnet name (must be a privateEndpoints subnet) to place the PE NIC in. */
  subnet: z.string().min(1),
  /** Private DNS zone name used for name resolution. */
  privateDnsZone: z.string().min(1),
  /** Deterministically assigned by the IPAM engine; optional on input. */
  allocatedIp: z.string().optional(),
});
export type PrivateEndpoint = z.infer<typeof privateEndpointSchema>;

/** Azure Firewall in the connectivity hub. */
export const firewallSchema = z.object({
  name: z.string().min(1),
  /** VNet name (a platform hub) hosting AzureFirewallSubnet. */
  vnet: z.string().min(1),
  skuTier: z.enum(["Standard", "Premium"]).default("Premium"),
});

/** VPN or ExpressRoute gateway in the connectivity hub. */
export const gatewaySchema = z.object({
  name: z.string().min(1),
  vnet: z.string().min(1),
  kind: z.enum(["vpn", "expressRoute"]).default("expressRoute"),
});

export const landingZoneSchema = z.object({
  name: z.string().min(1),
  kind: landingZoneKindSchema,
  vnets: z.array(virtualNetworkSchema).min(1),
  firewall: firewallSchema.optional(),
  gateway: gatewaySchema.optional(),
  services: z.array(workloadServiceSchema).default([]),
  privateEndpoints: z.array(privateEndpointSchema).default([]),
});
export type LandingZone = z.infer<typeof landingZoneSchema>;

export const physicalManifestSchema = z.object({
  apiVersion: z.literal("aadb.physical/v1alpha1"),
  metadata: z.object({
    name: z.string().min(1),
    description: z.string().default(""),
    /** Sovereign / policy profile applied for validation, preview only. */
    sovereignProfile: z
      .enum(["azure-public-regulated", "azure-government-preview", "custom"])
      .default("azure-public-regulated"),
  }),
  regions: z.object({
    primary: azureRegionSchema,
    disasterRecovery: azureRegionSchema.optional(),
  }),
  /** On-premises CIDR ranges the workload connects to (for overlap checks). */
  onPremises: z.object({
    addressSpaces: z.array(cidrSchema).default([]),
  }),
  privateDnsZones: z.array(privateDnsZoneSchema).default([]),
  landingZones: z.array(landingZoneSchema).min(1),
});

export type PhysicalManifest = z.infer<typeof physicalManifestSchema>;

/** Parse and structurally validate an unknown value as a PhysicalManifest. */
export function parseManifest(input: unknown): PhysicalManifest {
  return physicalManifestSchema.parse(input);
}

/** Safe variant that returns Zod's result union instead of throwing. */
export function safeParseManifest(input: unknown) {
  return physicalManifestSchema.safeParse(input);
}
