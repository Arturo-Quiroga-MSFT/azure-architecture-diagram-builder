/**
 * IPAM engine — deterministic IP address management and validation.
 *
 * This module contains ZERO model/LLM involvement. Given a validated
 * PhysicalManifest, it computes address-plan facts and hard failures:
 *   - CIDR shape and prefix-bound checks
 *   - subnet-within-vnet containment
 *   - overlap detection (subnet↔subnet, vnet↔vnet, vnet↔on-prem)
 *   - Azure-reserved address accounting (5 reserved per subnet)
 *   - special-subnet naming + minimum prefix rules
 *   - deterministic private-endpoint IP allocation
 *
 * These determinations are what make the studio trustworthy: overlaps are math,
 * not prose.
 */
import { parseCidr } from "cidr-tools";
import type { PhysicalManifest, Subnet } from "../manifest/schema.js";

export interface IpamFinding {
  severity: "error" | "warning";
  code: string;
  message: string;
  /** Dot-path context, e.g. "landingZones[1].vnets[0].subnets[2]". */
  context?: string;
}

export interface SubnetPlan {
  vnet: string;
  region: string;
  subnet: string;
  role: Subnet["role"];
  addressPrefix: string;
  /** Total addresses in the block (2^hostBits). */
  totalAddresses: number;
  /** Azure reserves 5 addresses per subnet (network, 3 platform, broadcast). */
  reservedAddresses: number;
  usableAddresses: number;
}

export interface AllocatedPrivateEndpoint {
  name: string;
  service: string;
  subnet: string;
  privateDnsZone: string;
  allocatedIp: string;
}

export interface IpamReport {
  ok: boolean;
  findings: IpamFinding[];
  subnetPlan: SubnetPlan[];
  privateEndpoints: AllocatedPrivateEndpoint[];
}

/** Azure reserves the first 4 and the last address in every subnet. */
const AZURE_RESERVED_PER_SUBNET = 5;

/** Minimum (largest) prefix length Azure allows for special subnets. */
const SPECIAL_SUBNET_MIN_PREFIX: Partial<Record<Subnet["role"], number>> = {
  AzureFirewallSubnet: 26,
  AzureFirewallManagementSubnet: 26,
  GatewaySubnet: 27,
  AzureBastionSubnet: 26,
};

/** Exact subnet names Azure requires for special roles. */
const SPECIAL_SUBNET_REQUIRED_NAME: Partial<Record<Subnet["role"], string>> = {
  AzureFirewallSubnet: "AzureFirewallSubnet",
  AzureFirewallManagementSubnet: "AzureFirewallManagementSubnet",
  GatewaySubnet: "GatewaySubnet",
  AzureBastionSubnet: "AzureBastionSubnet",
};

interface Range {
  start: bigint;
  end: bigint;
  prefix: number;
  cidr: string;
}

function toRange(cidr: string): Range {
  const parsed = parseCidr(cidr);
  // cidr-tools returns start/end as bigint but prefix as a string.
  return {
    start: parsed.start,
    end: parsed.end,
    prefix: Number(parsed.prefix),
    cidr,
  };
}

function rangesOverlap(a: Range, b: Range): boolean {
  return a.start <= b.end && b.start <= a.end;
}

function contains(outer: Range, inner: Range): boolean {
  return outer.start <= inner.start && inner.end <= outer.end;
}

function addressCount(prefix: number): number {
  return 2 ** (32 - prefix);
}

/**
 * Run the full deterministic IPAM validation + allocation pass over a manifest.
 * Never throws for data problems — all issues are returned as findings so the
 * UI can surface them precisely.
 */
export function analyzeIpam(manifest: PhysicalManifest): IpamReport {
  const findings: IpamFinding[] = [];
  const subnetPlan: SubnetPlan[] = [];
  const privateEndpoints: AllocatedPrivateEndpoint[] = [];

  const vnetRanges: { name: string; range: Range }[] = [];
  const onPremRanges = manifest.onPremises.addressSpaces.map(toRange);

  // --- Per-VNet + per-subnet structural checks -----------------------------
  for (const [lzIdx, lz] of manifest.landingZones.entries()) {
    for (const [vnetIdx, vnet] of lz.vnets.entries()) {
      const vnetCtx = `landingZones[${lzIdx}].vnets[${vnetIdx}]`;
      const vnetAddrRanges = vnet.addressSpace.map(toRange);
      vnetAddrRanges.forEach((r) => vnetRanges.push({ name: vnet.name, range: r }));

      // Subnet containment + intra-vnet overlap.
      const subnetRanges: { subnet: Subnet; range: Range }[] = [];
      for (const [subIdx, subnet] of vnet.subnets.entries()) {
        const subCtx = `${vnetCtx}.subnets[${subIdx}]`;
        const subRange = toRange(subnet.addressPrefix);

        // Containment within at least one vnet address space.
        if (!vnetAddrRanges.some((v) => contains(v, subRange))) {
          findings.push({
            severity: "error",
            code: "SUBNET_OUT_OF_VNET",
            message: `Subnet ${subnet.name} (${subnet.addressPrefix}) is not contained in VNet ${vnet.name} address space.`,
            context: subCtx,
          });
        }

        // Special-subnet naming + minimum prefix rules.
        const requiredName = SPECIAL_SUBNET_REQUIRED_NAME[subnet.role];
        if (requiredName && subnet.name !== requiredName) {
          findings.push({
            severity: "error",
            code: "SPECIAL_SUBNET_NAME",
            message: `Subnet with role ${subnet.role} must be named exactly "${requiredName}".`,
            context: subCtx,
          });
        }
        const minPrefix = SPECIAL_SUBNET_MIN_PREFIX[subnet.role];
        if (minPrefix !== undefined && subRange.prefix > minPrefix) {
          findings.push({
            severity: "error",
            code: "SPECIAL_SUBNET_PREFIX",
            message: `Subnet ${subnet.name} must be at least /${minPrefix} (got /${subRange.prefix}).`,
            context: subCtx,
          });
        }

        // Intra-vnet subnet overlap.
        for (const existing of subnetRanges) {
          if (rangesOverlap(existing.range, subRange)) {
            findings.push({
              severity: "error",
              code: "SUBNET_OVERLAP",
              message: `Subnet ${subnet.name} (${subnet.addressPrefix}) overlaps subnet ${existing.subnet.name} (${existing.subnet.addressPrefix}) in VNet ${vnet.name}.`,
              context: subCtx,
            });
          }
        }
        subnetRanges.push({ subnet, range: subRange });

        const total = addressCount(subRange.prefix);
        subnetPlan.push({
          vnet: vnet.name,
          region: vnet.region,
          subnet: subnet.name,
          role: subnet.role,
          addressPrefix: subnet.addressPrefix,
          totalAddresses: total,
          reservedAddresses: AZURE_RESERVED_PER_SUBNET,
          usableAddresses: Math.max(0, total - AZURE_RESERVED_PER_SUBNET),
        });
      }
    }
  }

  // --- Cross-VNet overlap ---------------------------------------------------
  for (let i = 0; i < vnetRanges.length; i++) {
    for (let j = i + 1; j < vnetRanges.length; j++) {
      const a = vnetRanges[i];
      const b = vnetRanges[j];
      if (a.name === b.name) continue;
      if (rangesOverlap(a.range, b.range)) {
        findings.push({
          severity: "error",
          code: "VNET_OVERLAP",
          message: `VNet ${a.name} (${a.range.cidr}) overlaps VNet ${b.name} (${b.range.cidr}). Peered/hub-spoke VNets cannot share address space.`,
        });
      }
    }
  }

  // --- VNet ↔ on-premises overlap ------------------------------------------
  for (const v of vnetRanges) {
    for (const onPrem of onPremRanges) {
      if (rangesOverlap(v.range, onPrem)) {
        findings.push({
          severity: "error",
          code: "ONPREM_OVERLAP",
          message: `VNet ${v.name} (${v.range.cidr}) overlaps on-premises range ${onPrem.cidr}. Hybrid connectivity requires non-overlapping address space.`,
        });
      }
    }
  }

  // --- Deterministic private-endpoint IP allocation -------------------------
  allocatePrivateEndpoints(manifest, findings, privateEndpoints);

  return {
    ok: findings.every((f) => f.severity !== "error"),
    findings,
    subnetPlan,
    privateEndpoints,
  };
}

/**
 * Allocate a stable IP to each private endpoint. Allocation is deterministic:
 * PEs are sorted by name and assigned the next free host address in their
 * target subnet, skipping Azure-reserved addresses. Identical manifests always
 * produce identical plans.
 */
function allocatePrivateEndpoints(
  manifest: PhysicalManifest,
  findings: IpamFinding[],
  out: AllocatedPrivateEndpoint[],
): void {
  // Index every subnet by name for lookup.
  const subnetIndex = new Map<string, { range: Range; role: Subnet["role"] }>();
  for (const lz of manifest.landingZones) {
    for (const vnet of lz.vnets) {
      for (const subnet of vnet.subnets) {
        subnetIndex.set(subnet.name, {
          range: toRange(subnet.addressPrefix),
          role: subnet.role,
        });
      }
    }
  }

  // Track the next free offset per subnet across all PEs.
  const nextOffset = new Map<string, bigint>();

  const allPes = manifest.landingZones
    .flatMap((lz) => lz.privateEndpoints)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const pe of allPes) {
    const target = subnetIndex.get(pe.subnet);
    if (!target) {
      findings.push({
        severity: "error",
        code: "PE_SUBNET_MISSING",
        message: `Private endpoint ${pe.name} references unknown subnet ${pe.subnet}.`,
      });
      continue;
    }
    if (target.role !== "privateEndpoints") {
      findings.push({
        severity: "warning",
        code: "PE_SUBNET_ROLE",
        message: `Private endpoint ${pe.name} is placed in subnet ${pe.subnet} whose role is "${target.role}", not "privateEndpoints".`,
      });
    }

    // First usable host = network address + 4 (Azure reserves .0-.3).
    const base = nextOffset.get(pe.subnet) ?? 4n;
    const candidate = target.range.start + base;
    // Leave the last address (broadcast-equivalent) reserved.
    if (candidate >= target.range.end) {
      findings.push({
        severity: "error",
        code: "PE_SUBNET_EXHAUSTED",
        message: `Subnet ${pe.subnet} has no free address for private endpoint ${pe.name}.`,
      });
      continue;
    }
    nextOffset.set(pe.subnet, base + 1n);
    out.push({
      name: pe.name,
      service: pe.service,
      subnet: pe.subnet,
      privateDnsZone: pe.privateDnsZone,
      allocatedIp: bigintToIpv4(candidate),
    });
  }
}

function bigintToIpv4(value: bigint): string {
  const b0 = (value >> 24n) & 0xffn;
  const b1 = (value >> 16n) & 0xffn;
  const b2 = (value >> 8n) & 0xffn;
  const b3 = value & 0xffn;
  return `${b0}.${b1}.${b2}.${b3}`;
}
