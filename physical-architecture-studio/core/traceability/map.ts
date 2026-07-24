/**
 * Traceability map — links each physical diagram element to its Bicep and
 * Terraform representation. Powers the demo's "traceability panel" and proves
 * the diagram, IaC, and IP plan all derive from one manifest.
 */
import type { PhysicalManifest } from "../manifest/schema.js";

export interface TraceRow {
  element: string;
  kind: string;
  bicep: string;
  terraform: string;
}

function bicepSymbol(prefix: string, name: string): string {
  return `${prefix}_${name.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

function tfIdent(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, "_");
}

export function buildTraceability(manifest: PhysicalManifest): TraceRow[] {
  const rows: TraceRow[] = [];

  for (const lz of manifest.landingZones) {
    for (const vnet of lz.vnets) {
      rows.push({
        element: vnet.name,
        kind: lz.kind === "platform" ? "Hub VNet" : "Spoke VNet",
        bicep: `module ${bicepSymbol("vnet", vnet.name)}`,
        terraform: `module.vnet_${tfIdent(vnet.name)}`,
      });
      for (const subnet of vnet.subnets) {
        rows.push({
          element: `${vnet.name} / ${subnet.name}`,
          kind: "Subnet",
          bicep: `${bicepSymbol("vnet", vnet.name)} → subnets[${subnet.name}]`,
          terraform: `module.vnet_${tfIdent(vnet.name)}.subnets["${tfIdent(subnet.name)}"]`,
        });
      }
    }
    for (const pe of lz.privateEndpoints) {
      rows.push({
        element: pe.name,
        kind: "Private Endpoint",
        bicep: `module ${bicepSymbol("pe", pe.name)}`,
        terraform: `module.pe_${tfIdent(pe.name)}`,
      });
    }
  }

  for (const zone of manifest.privateDnsZones) {
    rows.push({
      element: zone.zone,
      kind: "Private DNS Zone",
      bicep: `module ${bicepSymbol("pdns", zone.zone)}`,
      terraform: `module.pdns_${tfIdent(zone.zone)}`,
    });
  }

  return rows;
}
