// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * az prototype Integration Service
 *
 * Provides bidirectional data exchange between the Azure Architecture Diagram Builder
 * and the `az prototype` Azure CLI extension. Enables:
 *   - Export: Diagram Builder → az prototype (design-phase architecture manifest)
 *   - Import: az prototype → Diagram Builder (render architecture as interactive diagram)
 *
 * Interchange format mirrors the architecture JSON that az prototype's design phase produces
 * and that its build phase consumes.
 */

import { Node, Edge } from 'reactflow';
import { getServiceIconMapping } from '../data/serviceIconMapping';
import { calculateCostBreakdown } from './costEstimationService';
import type { NodePricingConfig } from '../types/pricing';

// ---------------------------------------------------------------------------
// Interchange schema types
// ---------------------------------------------------------------------------

/** A single Azure service in the az prototype interchange format. */
export interface AzPrototypeService {
  id: string;
  name: string;
  type: string;
  category: string;
  description: string;
  groupId: string | null;
}

/** A connection between two services. */
export interface AzPrototypeConnection {
  from: string;
  to: string;
  label: string;
  type: 'sync' | 'async' | 'optional';
}

/** A logical service group (e.g. "Frontend", "Data Tier"). */
export interface AzPrototypeGroup {
  id: string;
  label: string;
}

/** A workflow step describing data flow. */
export interface AzPrototypeWorkflowStep {
  step: number;
  description: string;
  services: string[];
}

/** Cost estimate attached to a service. */
export interface AzPrototypeCostEstimate {
  serviceId: string;
  serviceName: string;
  monthlyEstimate: number;
  tier: string;
  sku: string;
  region: string;
}

/** Project-level configuration hints for az prototype init. */
export interface AzPrototypeProjectConfig {
  name: string;
  location: string;
  iacTool: 'bicep' | 'terraform';
}

/** Top-level interchange envelope. */
export interface AzPrototypeManifest {
  /** Schema version for forward-compatibility. */
  schemaVersion: '1.0';
  /** Source tool that produced the file. */
  source: 'azure-diagram-builder' | 'az-prototype';
  /** ISO-8601 timestamp of when the file was created. */
  createdAt: string;
  /** Optional project configuration hints. */
  project: AzPrototypeProjectConfig;
  /** Architecture specification. */
  architecture: {
    services: AzPrototypeService[];
    connections: AzPrototypeConnection[];
    groups: AzPrototypeGroup[];
    workflow: AzPrototypeWorkflowStep[];
  };
  /** Optional cost estimates per service. */
  costEstimates?: AzPrototypeCostEstimate[];
  /** Free-form metadata (title, author, WAF score, etc.). */
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Export: Diagram Builder → az prototype
// ---------------------------------------------------------------------------

export interface ExportOptions {
  projectName: string;
  location: string;
  iacTool: 'bicep' | 'terraform';
  includeCosts: boolean;
  includeWorkflow: boolean;
}

/**
 * Convert the current React Flow diagram state into an az prototype manifest.
 */
export function exportToAzPrototype(
  nodes: Node[],
  edges: Edge[],
  workflow: AzPrototypeWorkflowStep[],
  options: ExportOptions,
  metadata?: Record<string, unknown>,
): AzPrototypeManifest {
  // -- Services --
  const services: AzPrototypeService[] = nodes
    .filter((n) => n.type === 'azureNode')
    .map((n) => {
      const mapping = getServiceIconMapping(n.data.label);
      return {
        id: n.id,
        name: n.data.label || 'Unknown Service',
        type: mapping?.displayName || n.data.label || 'Unknown',
        category: mapping?.category || n.data.category || 'other',
        description: n.data.description || '',
        groupId: n.parentNode || null,
      };
    });

  // -- Groups --
  const groups: AzPrototypeGroup[] = nodes
    .filter((n) => n.type === 'groupNode')
    .map((n) => ({
      id: n.id,
      label: n.data.label || 'Unnamed Group',
    }));

  // -- Connections --
  const connections: AzPrototypeConnection[] = edges.map((e) => ({
    from: e.source,
    to: e.target,
    label: (typeof e.label === 'string' ? e.label : '') || '',
    type: (e.data?.connectionType as 'sync' | 'async' | 'optional') || 'sync',
  }));

  // -- Cost estimates --
  let costEstimates: AzPrototypeCostEstimate[] | undefined;
  if (options.includeCosts) {
    const breakdown = calculateCostBreakdown(nodes);
    if (breakdown.totalMonthlyCost > 0) {
      costEstimates = breakdown.byService.map((svc) => {
        const node = nodes.find((n) => n.id === svc.nodeId);
        const pricing = node?.data?.pricing as NodePricingConfig | undefined;
        return {
          serviceId: svc.nodeId,
          serviceName: svc.serviceName,
          monthlyEstimate: svc.cost,
          tier: pricing?.tier || 'default',
          sku: pricing?.skuName || '',
          region: pricing?.region || 'eastus',
        };
      });
    }
  }

  return {
    schemaVersion: '1.0',
    source: 'azure-diagram-builder',
    createdAt: new Date().toISOString(),
    project: {
      name: options.projectName,
      location: options.location,
      iacTool: options.iacTool,
    },
    architecture: {
      services,
      connections,
      groups,
      workflow: options.includeWorkflow ? workflow : [],
    },
    costEstimates,
    metadata,
  };
}

/**
 * Serialize a manifest to a downloadable JSON string.
 */
export function serializeManifest(manifest: AzPrototypeManifest): string {
  return JSON.stringify(manifest, null, 2);
}

// ---------------------------------------------------------------------------
// Import: az prototype → Diagram Builder
// ---------------------------------------------------------------------------

/** Result of parsing an az prototype manifest for the Diagram Builder. */
export interface ImportResult {
  /** Architecture payload ready for handleAIGenerate. */
  architecture: {
    services: Array<{
      id: string;
      name: string;
      type: string;
      category: string;
      description: string;
      groupId: string | null;
    }>;
    connections: Array<{
      from: string;
      to: string;
      label: string;
      type: string;
    }>;
    groups: Array<{
      id: string;
      label: string;
    }>;
    workflow: AzPrototypeWorkflowStep[];
  };
  /** Project meta surfaced to the user. */
  projectInfo: {
    name: string;
    location: string;
    iacTool: string;
  };
  /** Whether cost data was present. */
  hasCostData: boolean;
  /** Number of services, connections, groups for display. */
  stats: {
    services: number;
    connections: number;
    groups: number;
    workflowSteps: number;
  };
}

/**
 * Parse a raw JSON string (or object) into a validated ImportResult.
 * Accepts both full az-prototype manifests (schema v1.0) and the lightweight
 * architecture-only JSON that `az prototype design` may emit.
 */
export function importFromAzPrototype(input: string | Record<string, unknown>): ImportResult {
  const raw: Record<string, unknown> = typeof input === 'string' ? JSON.parse(input) : input;

  // Detect format: full manifest vs. raw architecture JSON
  let arch: Record<string, unknown>;
  let projectInfo = { name: 'imported-project', location: 'eastus', iacTool: 'bicep' };
  let hasCostData = false;

  if (raw.schemaVersion && raw.architecture) {
    // Full manifest
    arch = raw.architecture as Record<string, unknown>;
    const proj = raw.project as Record<string, string> | undefined;
    if (proj) {
      projectInfo = {
        name: proj.name || projectInfo.name,
        location: proj.location || projectInfo.location,
        iacTool: proj.iacTool || projectInfo.iacTool,
      };
    }
    hasCostData = Array.isArray((raw as any).costEstimates) && (raw as any).costEstimates.length > 0;
  } else if (raw.services && Array.isArray(raw.services)) {
    // Raw architecture JSON (design output)
    arch = raw;
  } else {
    throw new Error('Unrecognized format: expected an az prototype manifest or architecture JSON with a "services" array.');
  }

  const services = ((arch.services as any[]) || []).map((s: any) => {
    const mapping = getServiceIconMapping(s.name) || getServiceIconMapping(s.type);
    return {
      id: s.id || `svc-${Math.random().toString(36).slice(2, 8)}`,
      name: mapping?.displayName || s.name || s.type || 'Unknown',
      type: mapping?.displayName || s.type || s.name || 'Unknown',
      category: mapping?.category || s.category || 'other',
      description: s.description || '',
      groupId: s.groupId || null,
    };
  });

  const connections = ((arch.connections as any[]) || []).map((c: any) => ({
    from: c.from || c.source,
    to: c.to || c.target,
    label: c.label || '',
    type: c.type || 'sync',
  }));

  const groups = ((arch.groups as any[]) || []).map((g: any) =>
    typeof g === 'string'
      ? { id: g, label: g.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') }
      : { id: g.id, label: g.label || g.id },
  );

  const workflow = ((arch.workflow as any[]) || []).map((w: any, i: number) => ({
    step: w.step ?? i + 1,
    description: w.description || '',
    services: Array.isArray(w.services) ? w.services : [],
  }));

  return {
    architecture: { services, connections, groups, workflow },
    projectInfo,
    hasCostData,
    stats: {
      services: services.length,
      connections: connections.length,
      groups: groups.length,
      workflowSteps: workflow.length,
    },
  };
}
