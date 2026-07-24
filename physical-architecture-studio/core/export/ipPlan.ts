/**
 * IP plan CSV emitter — a flat, auditable address plan for the export package.
 * Deterministic column order and row ordering (as produced by the IPAM engine).
 */
import type { PhysicalManifest } from "../manifest/schema.js";
import { analyzeIpam } from "../ipam/engine.js";

function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function generateIpPlanCsv(manifest: PhysicalManifest): string {
  const ipam = analyzeIpam(manifest);
  const rows: string[] = [];

  rows.push(
    [
      "type",
      "vnet",
      "region",
      "name",
      "role",
      "addressPrefix",
      "totalAddresses",
      "usableAddresses",
      "allocatedIp",
      "privateDnsZone",
    ].join(","),
  );

  for (const s of ipam.subnetPlan) {
    rows.push(
      [
        "subnet",
        s.vnet,
        s.region,
        s.subnet,
        s.role,
        s.addressPrefix,
        s.totalAddresses,
        s.usableAddresses,
        "",
        "",
      ]
        .map(csvField)
        .join(","),
    );
  }

  for (const pe of ipam.privateEndpoints) {
    rows.push(
      [
        "privateEndpoint",
        "",
        "",
        pe.name,
        "privateEndpoint",
        "",
        "",
        "",
        pe.allocatedIp,
        pe.privateDnsZone,
      ]
        .map(csvField)
        .join(","),
    );
  }

  return rows.join("\n");
}
