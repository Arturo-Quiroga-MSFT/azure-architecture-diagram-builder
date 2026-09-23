// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ARM template → canonical MCP architecture adapter.
 *
 * Parsing is delegated entirely to the web app's canonical deterministic
 * extractor (copied in as armExtractor.generated.ts), so resource-type mapping,
 * child folding, name resolution, and dependsOn/resourceId edge derivation stay
 * identical between the web app and this server.
 *
 * This module only translates that output into the canonical
 * { services, connections, groups } shape the other MCP tools consume:
 *   • `name` becomes the real Azure resource name (unique per architecture)
 *   • `type` becomes a canonical AADB catalog type when one genuinely matches
 *   • `region` comes from a resolvable ARM location
 * Resource types with no honest canonical equivalent keep the extractor's label
 * and are reported as warnings instead of being mapped to a different service.
 */

import { extractArchitectureFromArm, type ArmCoverage } from './armExtractor.generated.js';
import { normalizeAzureRegion } from './pricing.js';
import { resolveServiceName } from './serviceCatalog.js';

export interface ArmImportedService {
  name: string;
  type: string;
  region?: string;
  description?: string;
  groupId?: string;
}

export interface ArmImportedConnection {
  from: string;
  to: string;
  label?: string;
  type?: string;
}

export interface ArmImportResult {
  services: ArmImportedService[];
  connections: ArmImportedConnection[];
  groups: { id: string; label: string }[];
  warnings: string[];
  coverage: ArmCoverage & { canonicalServiceCount: number; uncanonicalizedTypes: string[] };
}

/** True when the object looks like an ARM deployment template. */
export function isArmTemplate(input: unknown): boolean {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const template = input as Record<string, unknown>;
  const schema = typeof template.$schema === 'string' ? template.$schema.toLowerCase() : '';
  if (schema.includes('deploymenttemplate.json')) return true;
  return Array.isArray(template.resources) && typeof template.contentVersion === 'string';
}

/**
 * Resolve an extractor display name to a canonical catalog type. A trailing
 * parenthetical qualifier (e.g. "Kubernetes Service (AKS)") is a label variant
 * of the same service, so it is retried without the qualifier.
 */
function resolveCanonicalType(displayName: string): string | null {
  const direct = resolveServiceName(displayName);
  if (direct) return direct;
  const withoutQualifier = displayName.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return withoutQualifier && withoutQualifier !== displayName ? resolveServiceName(withoutQualifier) : null;
}

export function importArmTemplate(template: unknown): ArmImportResult {
  const { architecture, coverage } = extractArchitectureFromArm(template);

  const warnings: string[] = [];
  const nameByServiceId = new Map<string, string>();
  const usedNames = new Set<string>();
  const uncanonicalized = new Map<string, string[]>();
  const services: ArmImportedService[] = [];

  for (const service of architecture.services) {
    const baseName = (service.resourceName ?? service.name ?? 'resource').trim() || 'resource';
    let name = baseName;
    let suffix = 2;
    while (usedNames.has(name)) name = `${baseName} (${suffix++})`;
    usedNames.add(name);
    nameByServiceId.set(service.id, name);

    const canonicalType = resolveCanonicalType(service.name);
    if (!canonicalType) {
      if (!uncanonicalized.has(service.name)) uncanonicalized.set(service.name, []);
      uncanonicalized.get(service.name)!.push(name);
    }

    const region = service.location ? normalizeAzureRegion(service.location) : undefined;
    services.push({
      name,
      type: canonicalType ?? service.name,
      ...(region ? { region } : {}),
      description: service.type,
      ...(service.groupId ? { groupId: service.groupId } : {}),
    });
  }

  const connections: ArmImportedConnection[] = [];
  for (const connection of architecture.connections) {
    const from = nameByServiceId.get(connection.from);
    const to = nameByServiceId.get(connection.to);
    if (!from || !to || from === to) continue;
    connections.push({ from, to, label: connection.label, type: connection.type });
  }

  const usedGroupIds = new Set(services.map(service => service.groupId).filter(Boolean));
  const groups = architecture.groups.filter(group => usedGroupIds.has(group.id));

  if (services.length === 0) {
    warnings.push('No mappable Azure resources were found in this ARM template.');
  }
  if (coverage.skippedTypes.length > 0) {
    warnings.push(
      `${coverage.skippedTypes.length} ARM resource type(s) are not in the extractor's mapping and were skipped: ${coverage.skippedTypes.join(', ')}.`,
    );
  }
  if (uncanonicalized.size > 0) {
    const detail = [...uncanonicalized.entries()]
      .map(([label, names]) => `${label} (${names.join(', ')})`)
      .join('; ');
    warnings.push(
      `${uncanonicalized.size} resource label(s) have no canonical AADB catalog equivalent and keep their ARM label, so pricing and WAF rules will not apply to them: ${detail}.`,
    );
  }

  return {
    services,
    connections,
    groups,
    warnings,
    coverage: {
      ...coverage,
      canonicalServiceCount: services.length - [...uncanonicalized.values()].reduce((total, names) => total + names.length, 0),
      uncanonicalizedTypes: [...uncanonicalized.keys()].sort(),
    },
  };
}
