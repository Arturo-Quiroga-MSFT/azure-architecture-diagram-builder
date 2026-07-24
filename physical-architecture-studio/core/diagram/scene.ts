/**
 * Diagram scene builder — deterministically derives a renderable scene graph
 * (nodes + edges) from a PhysicalManifest, in two views:
 *
 *   - "concept":  logical services only (the initial architecture)
 *   - "physical": full hub/spoke fabric (regions, VNets, subnets, firewall,
 *                 gateway, private endpoints, private DNS, on-prem boundary)
 *
 * The React canvas consumes this JSON. Keeping scene construction in the core
 * (not the UI) makes the Concept→Physical transition deterministic and testable.
 */
import type { PhysicalManifest } from "../manifest/schema.js";
import { analyzeIpam } from "../ipam/engine.js";

export type SceneView = "concept" | "physical";

export interface SceneNode {
  id: string;
  kind: string;
  label: string;
  /** Parent container id for nesting (region → vnet → subnet). */
  parent?: string;
  /** Extra deterministic detail shown in the inspector. */
  detail?: Record<string, string>;
}

export interface SceneEdge {
  id: string;
  from: string;
  to: string;
  kind: "contains" | "privateLink" | "dns" | "hybrid" | "peering";
  label?: string;
}

export interface Scene {
  view: SceneView;
  nodes: SceneNode[];
  edges: SceneEdge[];
}

/** Concept view: just the logical workload services, no network fabric. */
export function buildConceptScene(manifest: PhysicalManifest): Scene {
  const nodes: SceneNode[] = [];
  const edges: SceneEdge[] = [];

  nodes.push({ id: "user", kind: "user", label: "User / Channel" });
  nodes.push({ id: "app", kind: "application", label: "AI Application" });
  edges.push({ id: "e-user-app", from: "user", to: "app", kind: "privateLink" });

  for (const lz of manifest.landingZones) {
    for (const svc of lz.services) {
      nodes.push({
        id: `svc-${svc.name}`,
        kind: svc.kind,
        label: svc.name,
        detail: { kind: svc.kind, privateOnly: String(svc.privateOnly) },
      });
      edges.push({
        id: `e-app-${svc.name}`,
        from: "app",
        to: `svc-${svc.name}`,
        kind: "privateLink",
      });
    }
  }
  return { view: "concept", nodes, edges };
}

/** Physical view: the full deterministic hub/spoke fabric. */
export function buildPhysicalScene(manifest: PhysicalManifest): Scene {
  const ipam = analyzeIpam(manifest);
  const nodes: SceneNode[] = [];
  const edges: SceneEdge[] = [];

  // On-premises boundary.
  if (manifest.onPremises.addressSpaces.length > 0) {
    nodes.push({
      id: "onprem",
      kind: "onPremises",
      label: "On-premises",
      detail: { addressSpaces: manifest.onPremises.addressSpaces.join(", ") },
    });
  }

  // Region containers.
  const regions = new Set<string>();
  for (const lz of manifest.landingZones) {
    for (const vnet of lz.vnets) regions.add(vnet.region);
  }
  for (const region of regions) {
    nodes.push({ id: `region-${region}`, kind: "region", label: region });
  }

  const peBySubnet = new Map<string, typeof ipam.privateEndpoints>();
  for (const pe of ipam.privateEndpoints) {
    const list = peBySubnet.get(pe.subnet) ?? [];
    list.push(pe);
    peBySubnet.set(pe.subnet, list);
  }

  for (const lz of manifest.landingZones) {
    for (const vnet of lz.vnets) {
      const vnetId = `vnet-${vnet.name}`;
      nodes.push({
        id: vnetId,
        kind: lz.kind === "platform" ? "hubVnet" : "spokeVnet",
        label: vnet.name,
        parent: `region-${vnet.region}`,
        detail: { addressSpace: vnet.addressSpace.join(", "), landingZone: lz.kind },
      });

      // Hub → spoke peering (platform hub connects to every application spoke).
      if (lz.kind === "application") {
        const hub = manifest.landingZones.find((z) => z.kind === "platform");
        const hubVnet = hub?.vnets[0];
        if (hubVnet) {
          edges.push({
            id: `peer-${hubVnet.name}-${vnet.name}`,
            from: `vnet-${hubVnet.name}`,
            to: vnetId,
            kind: "peering",
            label: "peering",
          });
        }
      }

      for (const subnet of vnet.subnets) {
        const subnetId = `subnet-${vnet.name}-${subnet.name}`;
        nodes.push({
          id: subnetId,
          kind: "subnet",
          label: subnet.name,
          parent: vnetId,
          detail: {
            addressPrefix: subnet.addressPrefix,
            role: subnet.role,
            delegation: subnet.delegation,
          },
        });

        for (const pe of peBySubnet.get(subnet.name) ?? []) {
          const peId = `pe-${pe.name}`;
          nodes.push({
            id: peId,
            kind: "privateEndpoint",
            label: pe.name,
            parent: subnetId,
            detail: {
              service: pe.service,
              allocatedIp: pe.allocatedIp,
              privateDnsZone: pe.privateDnsZone,
            },
          });
          edges.push({
            id: `dns-${pe.name}`,
            from: peId,
            to: `dns-${pe.privateDnsZone}`,
            kind: "dns",
            label: "resolves",
          });
        }
      }

      // Firewall / gateway markers in the hub.
      if (lz.firewall) {
        nodes.push({
          id: `fw-${lz.firewall.name}`,
          kind: "firewall",
          label: lz.firewall.name,
          parent: vnetId,
          detail: { skuTier: lz.firewall.skuTier },
        });
      }
      if (lz.gateway) {
        nodes.push({
          id: `gw-${lz.gateway.name}`,
          kind: "gateway",
          label: lz.gateway.name,
          parent: vnetId,
          detail: { kind: lz.gateway.kind },
        });
        edges.push({
          id: `hybrid-${lz.gateway.name}`,
          from: `gw-${lz.gateway.name}`,
          to: "onprem",
          kind: "hybrid",
          label: lz.gateway.kind,
        });
      }
    }
  }

  // Private DNS zone nodes.
  for (const zone of manifest.privateDnsZones) {
    nodes.push({
      id: `dns-${zone.zone}`,
      kind: "privateDnsZone",
      label: zone.zone,
      detail: { linkedVnets: zone.linkedVnets.join(", ") },
    });
  }

  return { view: "physical", nodes, edges };
}

export function buildScene(manifest: PhysicalManifest, view: SceneView): Scene {
  return view === "concept"
    ? buildConceptScene(manifest)
    : buildPhysicalScene(manifest);
}
