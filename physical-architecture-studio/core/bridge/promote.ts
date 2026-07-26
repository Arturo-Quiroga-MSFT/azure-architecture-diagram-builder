/**
 * Promote: AADB concept manifest -> Physical Manifest.
 *
 * This is the "Promote to Physical Studio" bridge. It deterministically
 * scaffolds an Azure Landing Zone hub/spoke topology around the logical
 * services described in an AADB diagram:
 *
 *   - a PLATFORM connectivity hub (Azure Firewall + ExpressRoute + DNS)
 *   - an APPLICATION spoke hosting the workload + private endpoints
 *   - a private endpoint + private DNS zone for every private-link-capable
 *     service the concept contained
 *
 * All address allocation is fixed and deterministic (not model-driven); the
 * resulting manifest then flows through the existing IPAM/validation/IaC core.
 * Unmapped AADB services are preserved as a diagnostic so nothing is silently
 * dropped.
 */
import type {
  PhysicalManifest,
  WorkloadService,
  PrivateEndpoint,
  Subnet,
  PrivateDnsZone,
} from "../manifest/schema.js";
import type { AadbManifest } from "./aadbManifest.js";
import { mapAadbService, isInfrastructure } from "./serviceMap.js";

export interface PromotionResult {
  manifest: PhysicalManifest;
  /** AADB services that could not be mapped to a known Azure service kind. */
  unmapped: string[];
  /** Human-readable notes about the deterministic choices made. */
  notes: string[];
}

/** Fixed, ALZ-style address plan used for every promotion. */
const PLAN = {
  hubVnet: "10.20.0.0/16",
  firewallSubnet: "10.20.0.0/26",
  gatewaySubnet: "10.20.0.64/27",
  managementSubnet: "10.20.1.0/24",
  spokeVnet: "10.21.0.0/16",
  workloadSubnet: "10.21.0.0/23",
  privateEndpointSubnet: "10.21.2.0/24",
  appGatewaySubnet: "10.21.3.0/24",
  onPrem: "10.0.0.0/16",
} as const;

export function promoteFromAadb(aadb: AadbManifest): PromotionResult {
  const region = aadb.project.location || "eastus2";
  const notes: string[] = [];
  const unmapped: string[] = [];

  const services: WorkloadService[] = [];
  /**
   * Observability services belong to the MANAGEMENT platform subscription in
   * ALZ (Log Analytics, Azure Monitor are shared platform services), not to the
   * application landing zone.
   */
  const managementServices: WorkloadService[] = [];
  const privateEndpoints: PrivateEndpoint[] = [];
  const dnsZones = new Map<string, PrivateDnsZone>();
  const infrastructure: string[] = [];
  // The workload subnet can carry a single delegation; pick by priority:
  // Container Apps > App Service/Functions > none.
  let workloadDelegation: Subnet["delegation"] = "none";
  let hasIngress = false;

  for (const svc of aadb.architecture.services) {
    const entry = mapAadbService(svc.type) ?? mapAadbService(svc.name);
    if (!entry) {
      // Recognized platform/global construct vs. genuinely unknown service.
      if (isInfrastructure(svc.type) || isInfrastructure(svc.name)) {
        infrastructure.push(svc.name);
      } else {
        unmapped.push(`${svc.name} (${svc.type})`);
      }
      continue;
    }
    // Stable, filesystem-safe service name derived from the AADB id/name.
    const name = slug(svc.name || svc.id);
    const isPrivate = entry.cls === "privateEndpoint";
    if (entry.cls === "observability") {
      managementServices.push({ name, kind: entry.kind, privateOnly: false });
      continue;
    }
    services.push({ name, kind: entry.kind, privateOnly: isPrivate });

    if (entry.cls === "compute" && entry.delegation && entry.delegation !== "none") {
      if (entry.delegation === "Microsoft.App/environments") {
        workloadDelegation = "Microsoft.App/environments";
      } else if (workloadDelegation === "none") {
        workloadDelegation = entry.delegation;
      }
    }
    if (entry.cls === "ingress") hasIngress = true;

    if (isPrivate && entry.privateDnsZone) {
      privateEndpoints.push({
        name: `pe-${name}`,
        service: name,
        subnet: "private-endpoints",
        privateDnsZone: entry.privateDnsZone,
      });
      if (!dnsZones.has(entry.privateDnsZone)) {
        dnsZones.set(entry.privateDnsZone, {
          zone: entry.privateDnsZone,
          linkedVnets: ["spoke-ai-vnet"],
        });
      }
    }
  }

  if (infrastructure.length > 0) {
    notes.push(
      `${infrastructure.length} platform/global construct(s) recognized and handled by the landing zone: ${infrastructure.join(", ")}.`,
    );
  }
  if (unmapped.length > 0) {
    notes.push(
      `${unmapped.length} service(s) had no Azure mapping and were skipped: ${unmapped.join(", ")}.`,
    );
  }
  notes.push(
    `Applied ALZ hub/spoke plan: hub ${PLAN.hubVnet}, spoke ${PLAN.spokeVnet}, on-prem ${PLAN.onPrem}.`,
  );
  notes.push(
    `${services.length} workload service(s), ${privateEndpoints.length} private endpoint(s), ${dnsZones.size} private DNS zone(s).`,
  );
  if (managementServices.length > 0) {
    notes.push(
      `${managementServices.length} observability service(s) placed in the management platform subscription per ALZ.`,
    );
  }

  const spokeSubnets: Subnet[] = [
    {
      name: "workload",
      role: "workload",
      addressPrefix: PLAN.workloadSubnet,
      delegation: workloadDelegation,
      privateEndpointSubnet: false,
    },
    {
      name: "private-endpoints",
      role: "privateEndpoints",
      addressPrefix: PLAN.privateEndpointSubnet,
      delegation: "none",
      privateEndpointSubnet: true,
    },
  ];
  if (hasIngress) {
    notes.push("Added an application-gateway subnet for ingress.");
    spokeSubnets.push({
      name: "app-gateway",
      role: "workload",
      addressPrefix: PLAN.appGatewaySubnet,
      delegation: "none",
      privateEndpointSubnet: false,
    });
  }

  const manifest: PhysicalManifest = {
    apiVersion: "aadb.physical/v1alpha1",
    metadata: {
      name: slug(aadb.project.name || "promoted-architecture"),
      description: `Promoted from AADB concept "${aadb.project.name}" via Physical Architecture Studio.`,
      sovereignProfile: "azure-public-regulated",
    },
    regions: { primary: region },
    onPremises: { addressSpaces: [PLAN.onPrem] },
    networkTopology: "hubSpoke",
    managementGroups: {
      intermediateRoot: "alz",
      platform: ["management", "identity", "connectivity", "security"],
      landingZones: ["corp", "online"],
      sandbox: true,
      decommissioned: true,
    },
    privateDnsZones: Array.from(dnsZones.values()),
    landingZones: [
      {
        name: "connectivity-hub",
        kind: "platform",
        platformSubscription: "connectivity",
        managementGroup: "connectivity",
        vnets: [
          {
            name: "hub-vnet",
            region,
            addressSpace: [PLAN.hubVnet],
            subnets: [
              {
                name: "AzureFirewallSubnet",
                role: "AzureFirewallSubnet",
                addressPrefix: PLAN.firewallSubnet,
                delegation: "none",
                privateEndpointSubnet: false,
              },
              {
                name: "GatewaySubnet",
                role: "GatewaySubnet",
                addressPrefix: PLAN.gatewaySubnet,
                delegation: "none",
                privateEndpointSubnet: false,
              },
              {
                name: "management",
                role: "management",
                addressPrefix: PLAN.managementSubnet,
                delegation: "none",
                privateEndpointSubnet: false,
              },
            ],
          },
        ],
        firewall: { name: "hub-firewall", vnet: "hub-vnet", skuTier: "Premium" },
        gateway: { name: "hub-er-gateway", vnet: "hub-vnet", kind: "expressRoute" },
        services: [],
        privateEndpoints: [],
      },
      {
        // ALZ management platform subscription: shared observability services.
        name: "management",
        kind: "platform",
        platformSubscription: "management",
        managementGroup: "management",
        vnets: [],
        services: managementServices,
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
            region,
            addressSpace: [PLAN.spokeVnet],
            subnets: spokeSubnets,
          },
        ],
        services,
        privateEndpoints,
      },
    ],
  };

  return { manifest, unmapped, notes };
}

/** Lowercase, hyphenated, filesystem/DNS-safe identifier. */
function slug(input: string): string {
  return (
    input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item"
  );
}
