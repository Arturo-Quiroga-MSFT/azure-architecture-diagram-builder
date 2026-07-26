/**
 * ALZ conformance checks — deterministic validation that a physical manifest
 * follows the Cloud Adoption Framework "Azure landing zone" (enterprise-scale)
 * reference architecture.
 *
 * Reference: https://learn.microsoft.com/azure/cloud-adoption-framework/ready/landing-zone/
 *
 * Key facts these rules encode:
 *   - An Azure landing zone = ONE platform landing zone + ONE OR MORE
 *     application landing zones.
 *   - The platform landing zone is made of four recommended subscriptions:
 *     management, identity, connectivity, security. Connectivity hosts the hub
 *     network, firewall and gateways.
 *   - Two supported network topologies: hub & spoke, or Virtual WAN. In Virtual
 *     WAN the hub is Microsoft-managed, so you do NOT declare
 *     AzureFirewallSubnet / GatewaySubnet yourself.
 *   - Application landing zones are nested under Corp / Online management
 *     groups to inherit the matching Azure Policy set.
 *   - AI workloads are NOT a separate landing zone type; they are ordinary
 *     workloads inside an application landing zone.
 *
 * These are advisory (warning/info) rather than hard errors: the studio should
 * educate toward ALZ alignment without blocking exploration.
 */
import type { PhysicalManifest } from "../manifest/schema.js";

export interface AlzFinding {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
}

export interface AlzReport {
  ok: boolean;
  topology: PhysicalManifest["networkTopology"];
  findings: AlzFinding[];
  /** Count of checks that passed, for a simple conformance badge. */
  passed: number;
  total: number;
}

export function checkAlzConformance(manifest: PhysicalManifest): AlzReport {
  const findings: AlzFinding[] = [];
  let passed = 0;
  let total = 0;

  const check = (ok: boolean, finding: AlzFinding) => {
    total += 1;
    if (ok) passed += 1;
    else findings.push(finding);
  };

  const platformZones = manifest.landingZones.filter((z) => z.kind === "platform");
  const appZones = manifest.landingZones.filter((z) => z.kind === "application");

  // --- Composition ---------------------------------------------------------
  check(platformZones.length >= 1, {
    severity: "error",
    code: "ALZ_NO_PLATFORM_LZ",
    message:
      "An Azure landing zone requires a platform landing zone providing shared connectivity, identity, management and security services.",
  });

  check(appZones.length >= 1, {
    severity: "error",
    code: "ALZ_NO_APPLICATION_LZ",
    message:
      "An Azure landing zone requires at least one application landing zone to host a workload.",
  });

  // --- Connectivity subscription ------------------------------------------
  const connectivity =
    platformZones.find((z) => z.platformSubscription === "connectivity") ??
    platformZones.find((z) => z.firewall || z.gateway);

  check(Boolean(connectivity), {
    severity: "warning",
    code: "ALZ_NO_CONNECTIVITY_SUB",
    message:
      "No connectivity platform subscription found. ALZ places the hub network, firewall and gateways in a dedicated connectivity subscription.",
  });

  // --- Topology-specific hub rules ----------------------------------------
  const topology = manifest.networkTopology;
  if (connectivity) {
    const hubSubnets = connectivity.vnets.flatMap((v) => v.subnets);
    const hasFirewallSubnet = hubSubnets.some((s) => s.role === "AzureFirewallSubnet");
    const hasGatewaySubnet = hubSubnets.some((s) => s.role === "GatewaySubnet");

    if (topology === "hubSpoke") {
      check(hasFirewallSubnet, {
        severity: "warning",
        code: "ALZ_HUB_NO_FIREWALL_SUBNET",
        message:
          "Hub & spoke topology: the connectivity hub should contain an AzureFirewallSubnet for centralized egress inspection.",
      });
      check(hasGatewaySubnet, {
        severity: "warning",
        code: "ALZ_HUB_NO_GATEWAY_SUBNET",
        message:
          "Hub & spoke topology: the connectivity hub should contain a GatewaySubnet for hybrid connectivity (VPN/ExpressRoute).",
      });
    } else {
      // Virtual WAN hubs are Microsoft-managed.
      check(!hasFirewallSubnet && !hasGatewaySubnet, {
        severity: "warning",
        code: "ALZ_VWAN_MANAGED_HUB",
        message:
          "Virtual WAN topology: the virtual hub is Microsoft-managed. Do not declare AzureFirewallSubnet or GatewaySubnet — use Azure Firewall Manager (secured virtual hub) and hub gateways instead.",
      });
    }
  }

  // --- Application landing zone governance --------------------------------
  for (const zone of appZones) {
    check(Boolean(zone.archetype), {
      severity: "info",
      code: "ALZ_NO_ARCHETYPE",
      message: `Application landing zone "${zone.name}" has no archetype. ALZ nests application landing zones under Corp (internal) or Online (internet-facing) management groups to inherit Azure Policy.`,
    });
  }

  // --- Private endpoints belong to the workload spoke ----------------------
  const pesInPlatform = platformZones.flatMap((z) => z.privateEndpoints);
  check(pesInPlatform.length === 0, {
    severity: "warning",
    code: "ALZ_PE_IN_PLATFORM",
    message:
      "Private endpoints for workload services should live in the application landing zone spoke, not in the platform landing zone.",
  });

  // --- Governance hierarchy ------------------------------------------------
  check(Boolean(manifest.managementGroups), {
    severity: "info",
    code: "ALZ_NO_MGMT_GROUPS",
    message:
      "No management group hierarchy declared. ALZ governs subscriptions through a management group hierarchy (Platform, Landing zones, Sandbox, Decommissioned) for policy inheritance.",
  });

  return {
    ok: findings.every((f) => f.severity !== "error"),
    topology,
    findings,
    passed,
    total,
  };
}
