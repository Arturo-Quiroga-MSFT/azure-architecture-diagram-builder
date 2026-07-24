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
import { mapAadbService } from "./serviceMap.js";

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
  onPrem: "10.0.0.0/16",
} as const;

export function promoteFromAadb(aadb: AadbManifest): PromotionResult {
  const region = aadb.project.location || "eastus2";
  const notes: string[] = [];
  const unmapped: string[] = [];

  const services: WorkloadService[] = [];
  const privateEndpoints: PrivateEndpoint[] = [];
  const dnsZones = new Map<string, PrivateDnsZone>();
  let hasCompute = false;

  for (const svc of aadb.architecture.services) {
    const entry = mapAadbService(svc.type) ?? mapAadbService(svc.name);
    if (!entry) {
      unmapped.push(`${svc.name} (${svc.type})`);
      continue;
    }
    // Stable, filesystem-safe service name derived from the AADB id/name.
    const name = slug(svc.name || svc.id);
    services.push({
      name,
      kind: entry.kind,
      privateOnly: entry.privateEndpoint,
    });

    if (entry.kind === "containerAppsEnvironment" || entry.kind === "appService") {
      hasCompute = true;
    }

    if (entry.privateEndpoint && entry.privateDnsZone) {
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

  if (unmapped.length > 0) {
    notes.push(
      `${unmapped.length} service(s) had no Azure mapping and were skipped: ${unmapped.join(", ")}.`,
    );
  }
  notes.push(
    `Applied ALZ hub/spoke plan: hub ${PLAN.hubVnet}, spoke ${PLAN.spokeVnet}, on-prem ${PLAN.onPrem}.`,
  );
  notes.push(
    `${privateEndpoints.length} private endpoint(s) and ${dnsZones.size} private DNS zone(s) generated deterministically.`,
  );

  const spokeSubnets: Subnet[] = [
    {
      name: "container-apps",
      role: "workload",
      addressPrefix: PLAN.workloadSubnet,
      delegation: hasCompute ? "Microsoft.App/environments" : "none",
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

  const manifest: PhysicalManifest = {
    apiVersion: "aadb.physical/v1alpha1",
    metadata: {
      name: slug(aadb.project.name || "promoted-architecture"),
      description: `Promoted from AADB concept "${aadb.project.name}" via Physical Architecture Studio.`,
      sovereignProfile: "azure-public-regulated",
    },
    regions: { primary: region },
    onPremises: { addressSpaces: [PLAN.onPrem] },
    privateDnsZones: Array.from(dnsZones.values()),
    landingZones: [
      {
        name: "connectivity-hub",
        kind: "platform",
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
        name: "ai-workload-spoke",
        kind: "application",
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
