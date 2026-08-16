// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Architecture Importer
 *
 * Reverses the two export formats this server produces back into the canonical
 * { services, connections, groups } shape that every other tool consumes:
 *
 *   - `generate_manifest`  → az prototype interchange manifest (clean, lossless)
 *   - `export_reactflow_scene` → React Flow scene (nodes/edges); service type is
 *     reversed from data.azureServiceType when present, else from the icon path.
 *   - ARM deployment templates → parsed by the canonical deterministic extractor
 *     and adapted in armImporter.ts (resource names, regions, dependsOn edges).
 *
 * Tolerant by design: it accepts web-app-native scenes and manifests too, and
 * collects warnings rather than throwing on partially-recognized input.
 */

import { importArmTemplate, isArmTemplate, type ArmImportResult } from './armImporter.js';

export interface ImportedService {
  id?: string;
  name: string;
  type: string;
  region?: string;
  description?: string;
  groupId?: string;
}
export interface ImportedConnection {
  id?: string;
  from: string;
  to: string;
  label?: string;
  type?: string;
}
export interface ImportedGroup {
  id: string;
  label: string;
}
export interface ImportedWorkflowStep {
  step: number;
  description: string;
  services: string[];
}
export interface ImportResult {
  format: 'manifest' | 'reactflow' | 'arm';
  projectName?: string;
  location?: string;
  iacTool?: string;
  author?: string;
  architecturePrompt?: string;
  services: ImportedService[];
  connections: ImportedConnection[];
  groups: ImportedGroup[];
  workflow: ImportedWorkflowStep[];
  warnings: string[];
  coverage?: ArmImportResult['coverage'];
}

export type ImportFormat = 'auto' | 'manifest' | 'reactflow' | 'arm';

export interface ImportOptions {
  iconFileToType?: Record<string, string>;
  format?: ImportFormat;
}

type AnyObj = Record<string, unknown>;

function asObject(input: unknown): AnyObj {
  if (typeof input === 'string') {
    try {
      return JSON.parse(input) as AnyObj;
    } catch (e) {
      throw new Error(`Input is not valid JSON: ${(e as Error).message}`);
    }
  }
  if (input && typeof input === 'object') return input as AnyObj;
  throw new Error('Input must be a JSON string or object.');
}

interface ResolvedNodeType {
  type: string | null;
  source: 'explicit' | 'icon' | 'label' | 'none';
}

/** Reverse a React Flow node's Azure service type and retain its provenance. */
function typeFromNode(node: AnyObj, iconFileToType?: Record<string, string>): ResolvedNodeType {
  const d = (node.data ?? {}) as AnyObj;
  const explicit =
    (d.azureServiceType as string) ??
    (d.serviceType as string) ??
    (d.azureType as string) ??
    (d.type as string) ??
    (node.azureServiceType as string);
  if (typeof explicit === 'string' && explicit.trim()) return { type: explicit.trim(), source: 'explicit' };

  const ip = (d.iconPath as string) ?? (d.icon as string);
  if (typeof ip === 'string' && iconFileToType) {
    const m = ip.match(/\/([^/]+)\.svg$/i);
    if (m && iconFileToType[m[1]]) return { type: iconFileToType[m[1]], source: 'icon' };
  }
  const label = d.label as string;
  if (typeof label === 'string' && label.trim()) return { type: label.trim(), source: 'label' };
  return { type: null, source: 'none' };
}

function isGroupNode(node: AnyObj): boolean {
  const d = (node.data ?? {}) as AnyObj;
  return node.type === 'groupNode' || node.type === 'group' || d.isGroup === true;
}

/**
 * Import an architecture from a manifest or React Flow scene into the canonical
 * shape. Pass `iconFileToType` (reverse of the icon map) to recover service
 * types from icon paths when a scene lacks an explicit type field.
 */
export function importArchitecture(
  input: unknown,
  opts: ImportOptions = {},
): ImportResult {
  const obj = asObject(input);
  const warnings: string[] = [];
  const format = opts.format ?? 'auto';

  // ── ARM deployment template ───────────────────────────────────────────
  if (format === 'arm' || (format === 'auto' && isArmTemplate(obj))) {
    if (!Array.isArray(obj.resources)) {
      throw new Error('Input does not match the requested arm format (expected a "resources" array).');
    }
    const armResult = importArmTemplate(obj);
    return {
      format: 'arm',
      services: armResult.services,
      connections: armResult.connections,
      groups: armResult.groups,
      workflow: [],
      warnings: armResult.warnings,
      coverage: armResult.coverage,
    };
  }

  // ── Manifest format ───────────────────────────────────────────────────
  if (format !== 'reactflow' && obj.architecture && typeof obj.architecture === 'object') {
    const arch = obj.architecture as AnyObj;
    const project = (obj.project ?? {}) as AnyObj;
    const rawServices = Array.isArray(arch.services) ? (arch.services as AnyObj[]) : [];
    const rawConns = Array.isArray(arch.connections) ? (arch.connections as AnyObj[]) : [];
    const rawGroups = Array.isArray(arch.groups) ? (arch.groups as AnyObj[]) : [];
    const rawWorkflow = Array.isArray(arch.workflow) ? (arch.workflow as AnyObj[]) : [];
    const metadata = (obj.metadata ?? {}) as AnyObj;

    const services: ImportedService[] = rawServices.map(s => ({
      id: s.id ? String(s.id) : undefined,
      name: String(s.name ?? s.id ?? 'Unnamed'),
      type: String(s.type ?? 'Unknown'),
      region: s.region ? String(s.region).trim().toLowerCase().replace(/[\s_-]+/g, '') : undefined,
      description: s.description ? String(s.description) : undefined,
      groupId: s.groupId ? String(s.groupId) : undefined,
    }));
    const connections: ImportedConnection[] = rawConns.map(c => ({
      id: c.id ? String(c.id) : undefined,
      from: String(c.from),
      to: String(c.to),
      label: c.label ? String(c.label) : undefined,
      type: c.type ? String(c.type) : undefined,
    }));
    const groups: ImportedGroup[] = rawGroups.map(g => ({
      id: String(g.id),
      label: String(g.label ?? g.id),
    }));
    const workflow: ImportedWorkflowStep[] = rawWorkflow.map(item => ({
      step: Number(item.step),
      description: String(item.description ?? ''),
      services: Array.isArray(item.services) ? item.services.map(String) : [],
    }));

    if (services.length === 0) warnings.push('Manifest contained no services.');
    return {
      format: 'manifest',
      projectName: project.name ? String(project.name) : undefined,
      location: project.location
        ? String(project.location).trim().toLowerCase().replace(/[\s_-]+/g, '')
        : undefined,
      iacTool: project.iacTool ? String(project.iacTool) : undefined,
      author: metadata.author ? String(metadata.author) : undefined,
      architecturePrompt: metadata.architecturePrompt ? String(metadata.architecturePrompt) : undefined,
      services,
      connections,
      groups,
      workflow,
      warnings,
    };
  }

  if (format === 'manifest') {
    throw new Error('Input does not match the requested manifest format (expected an "architecture" object).');
  }

  // ── React Flow scene format ───────────────────────────────────────────
  if (Array.isArray(obj.nodes)) {
    const nodes = obj.nodes as AnyObj[];
    const edges = Array.isArray(obj.edges) ? (obj.edges as AnyObj[]) : [];

    const groups: ImportedGroup[] = [];
    const services: ImportedService[] = [];
    const nameByNodeId = new Map<string, string>();
    const groupIdByNodeId = new Map<string, string>();

    for (const node of nodes) {
      const id = String(node.id ?? '');
      if (!id) continue;
      if (isGroupNode(node)) {
        const d = (node.data ?? {}) as AnyObj;
        const canonicalGroupId = String(d.architectureGroupId ?? d.groupId ?? id);
        groupIdByNodeId.set(id, canonicalGroupId);
        groups.push({ id: canonicalGroupId, label: String(d.label ?? canonicalGroupId) });
      }
    }

    for (const node of nodes) {
      const id = String(node.id ?? '');
      if (!id || isGroupNode(node)) continue;
      const d = (node.data ?? {}) as AnyObj;
      const pricing = (d.pricing ?? {}) as AnyObj;
      const name = String(d.label ?? node.id ?? 'Unnamed');
      const resolvedType = typeFromNode(node, opts.iconFileToType);
      if (resolvedType.source === 'label') {
        warnings.push(`Node "${name}" had no explicit or recognized icon type; using its label as the service type.`);
      } else if (resolvedType.source === 'none') {
        warnings.push(`Node "${name}" had no resolvable service type; using its generated name.`);
      }
      const parent = (node.parentNode ?? node.parentId) as string | undefined;
      services.push({
        id: d.architectureId || d.serviceId ? String(d.architectureId ?? d.serviceId) : undefined,
        name,
        type: resolvedType.type ?? name,
        region: d.region || pricing.region
          ? String(d.region ?? pricing.region).trim().toLowerCase().replace(/[\s_-]+/g, '')
          : undefined,
        description: d.description ? String(d.description) : undefined,
        groupId: d.groupId
          ? String(d.groupId)
          : (parent ? groupIdByNodeId.get(String(parent)) ?? String(parent) : undefined),
      });
      nameByNodeId.set(id, name);
    }

    const connections: ImportedConnection[] = [];
    for (const e of edges) {
      const from = nameByNodeId.get(String(e.source));
      const to = nameByNodeId.get(String(e.target));
      if (!from || !to) continue; // skip edges touching group nodes / unknowns
      const d = (e.data ?? {}) as AnyObj;
      connections.push({
        id: d.architectureId || d.connectionId ? String(d.architectureId ?? d.connectionId) : undefined,
        from,
        to,
        label: e.label ? String(e.label) : undefined,
        type: d.connectionType ? String(d.connectionType) : undefined,
      });
    }

    const meta = (obj.metadata ?? {}) as AnyObj;
    const rawWorkflow = Array.isArray(obj.workflow) ? (obj.workflow as AnyObj[]) : [];
    const workflow: ImportedWorkflowStep[] = rawWorkflow.map(item => ({
      step: Number(item.step),
      description: String(item.description ?? ''),
      services: Array.isArray(item.services) ? item.services.map(String) : [],
    }));
    if (services.length === 0) warnings.push('Scene contained no service nodes.');
    return {
      format: 'reactflow',
      projectName: meta.architectureName ? String(meta.architectureName) : undefined,
      location: meta.location ? String(meta.location) : undefined,
      author: meta.author ? String(meta.author) : undefined,
      architecturePrompt: obj.architecturePrompt ? String(obj.architecturePrompt) : undefined,
      services,
      connections,
      groups,
      workflow,
      warnings,
    };
  }

  if (format === 'reactflow') {
    throw new Error('Input does not match the requested reactflow format (expected a "nodes" array).');
  }

  throw new Error(
    'Unrecognized architecture format. Expected an az prototype manifest (has "architecture"), a React Flow scene (has "nodes"), or an ARM deployment template (has "resources").',
  );
}
