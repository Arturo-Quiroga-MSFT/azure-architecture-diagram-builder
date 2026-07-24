/**
 * Return: Physical Manifest -> AADB concept manifest.
 *
 * This is the "Return physical diagram to AADB" bridge. AADB has no native
 * network topology, so we project the physical fabric onto AADB's logical
 * service/group/connection model:
 *
 *   - each VNet becomes an AADB group (landing zone container)
 *   - VNets, firewall, gateway, private endpoints and DNS zones become nodes
 *     (canonical Azure types) with CIDR / allocated-IP detail in descriptions
 *   - workload services keep their canonical AADB types
 *   - connections capture hub<->spoke peering, service->PE private links, and
 *     gateway->on-prem hybrid links
 *
 * The complete physical detail is also preserved verbatim under metadata.physical
 * so a subsequent round-trip loses nothing.
 */
import type { PhysicalManifest } from "../manifest/schema.js";
import type { AadbManifest, AadbService, AadbConnection } from "./aadbManifest.js";
import { analyzeIpam } from "../ipam/engine.js";
import { mapKind, NETWORK_AADB_TYPES } from "./serviceMap.js";

export function physicalToAadb(manifest: PhysicalManifest): AadbManifest {
  const ipam = analyzeIpam(manifest);
  const services: AadbService[] = [];
  const connections: AadbConnection[] = [];
  const groups: { id: string; label: string }[] = [];

  // On-premises boundary node.
  if (manifest.onPremises.addressSpaces.length > 0) {
    services.push({
      id: "onprem",
      name: "On-premises",
      type: NETWORK_AADB_TYPES.onPremises.type,
      category: NETWORK_AADB_TYPES.onPremises.category,
      description: `On-premises ranges: ${manifest.onPremises.addressSpaces.join(", ")}`,
      groupId: null,
    });
  }

  const peByService = new Map(ipam.privateEndpoints.map((p) => [p.service, p]));

  for (const lz of manifest.landingZones) {
    for (const vnet of lz.vnets) {
      const groupId = `grp-${vnet.name}`;
      groups.push({
        id: groupId,
        label: `${vnet.name} (${lz.kind === "platform" ? "hub" : "spoke"}) ${vnet.addressSpace.join(", ")}`,
      });

      // VNet node.
      services.push({
        id: `vnet-${vnet.name}`,
        name: vnet.name,
        type: NETWORK_AADB_TYPES.virtualNetwork.type,
        category: NETWORK_AADB_TYPES.virtualNetwork.category,
        description: `Address space ${vnet.addressSpace.join(", ")}; subnets: ${vnet.subnets
          .map((s) => `${s.name} ${s.addressPrefix}`)
          .join("; ")}`,
        groupId,
      });

      // Firewall / gateway nodes.
      if (lz.firewall) {
        services.push({
          id: `fw-${lz.firewall.name}`,
          name: lz.firewall.name,
          type: NETWORK_AADB_TYPES.firewall.type,
          category: NETWORK_AADB_TYPES.firewall.category,
          description: `Azure Firewall (${lz.firewall.skuTier})`,
          groupId,
        });
      }
      if (lz.gateway) {
        const t =
          lz.gateway.kind === "vpn"
            ? NETWORK_AADB_TYPES.vpnGateway
            : NETWORK_AADB_TYPES.expressRoute;
        services.push({
          id: `gw-${lz.gateway.name}`,
          name: lz.gateway.name,
          type: t.type,
          category: t.category,
          description: `${lz.gateway.kind} gateway`,
          groupId,
        });
        connections.push({
          from: lz.gateway.name,
          to: "On-premises",
          label: lz.gateway.kind,
          type: "sync",
        });
      }

      // Workload services.
      for (const svc of lz.services) {
        const entry = mapKind(svc.kind);
        services.push({
          id: `svc-${svc.name}`,
          name: svc.name,
          type: entry?.aadbType ?? svc.kind,
          category: entry?.aadbCategory ?? "other",
          description: svc.privateOnly ? "Private access only" : "Public access",
          groupId,
        });

        // Private endpoint node + private-link connection.
        const pe = peByService.get(svc.name);
        if (pe) {
          services.push({
            id: `pe-${pe.name}`,
            name: pe.name,
            type: NETWORK_AADB_TYPES.privateEndpoint.type,
            category: NETWORK_AADB_TYPES.privateEndpoint.category,
            description: `Private endpoint ${pe.allocatedIp} in ${pe.subnet}; DNS ${pe.privateDnsZone}`,
            groupId,
          });
          connections.push({
            from: svc.name,
            to: pe.name,
            label: `private endpoint ${pe.allocatedIp}`,
            type: "sync",
          });
        }
      }
    }
  }

  // Hub <-> spoke peering connections.
  const hub = manifest.landingZones.find((z) => z.kind === "platform");
  const hubVnet = hub?.vnets[0];
  if (hubVnet) {
    for (const lz of manifest.landingZones) {
      if (lz.kind !== "application") continue;
      for (const vnet of lz.vnets) {
        connections.push({
          from: hubVnet.name,
          to: vnet.name,
          label: "peering",
          type: "sync",
        });
      }
    }
  }

  // Private DNS zone nodes.
  for (const zone of manifest.privateDnsZones) {
    services.push({
      id: `dns-${zone.zone}`,
      name: zone.zone,
      type: NETWORK_AADB_TYPES.privateDnsZone.type,
      category: NETWORK_AADB_TYPES.privateDnsZone.category,
      description: `Private DNS zone linked to: ${zone.linkedVnets.join(", ")}`,
      groupId: null,
    });
  }

  return {
    schemaVersion: "1.0",
    source: "physical-architecture-studio",
    createdAt: new Date().toISOString(),
    project: {
      name: manifest.metadata.name,
      location: manifest.regions.primary,
      iacTool: "bicep",
    },
    architecture: { services, connections, groups, workflow: [] },
    metadata: {
      producedBy: "AADB Physical Architecture Studio (Technical Preview)",
      sovereignProfile: manifest.metadata.sovereignProfile,
      // Full fidelity so a round-trip back into the studio loses nothing.
      physical: manifest,
      ipPlan: {
        subnets: ipam.subnetPlan,
        privateEndpoints: ipam.privateEndpoints,
      },
    },
  };
}
