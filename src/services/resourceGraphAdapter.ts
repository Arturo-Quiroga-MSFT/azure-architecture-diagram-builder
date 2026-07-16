// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Azure Resource Graph adapter.
 *
 * Builds a faithful architecture from an Azure Resource Graph query of a
 * resource group. Unlike ARM `exportTemplate` (which needs a write-scoped
 * action and returns hundreds of noise child resources), Resource Graph is
 * Reader-sufficient and returns only top-level resources — a cleaner source
 * for a "scan my estate" experience.
 *
 * Nodes are mapped via the same type table as the ARM extractor
 * (lookupServiceMeta), so both paths stay consistent. Resource Graph has no
 * `dependsOn`, so edges are INFERRED from real resource IDs embedded in each
 * resource's properties (e.g. serverFarmId, privateLinkServiceId, subnet IDs).
 */

import { lookupServiceMeta, zoneForCategory, type ArmExtractResult } from './armExtractor';

/** A row returned by the /api/azure/resource-graph endpoint. */
export interface ArgResource {
  id: string;
  name: string;
  type: string;
  kind?: string;
  location?: string;
  properties?: unknown;
}

function makeId(type: string, name: string, seen: Set<string>): string {
  const leaf = type.split('/').pop() || 'svc';
  const base = `${leaf}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'svc';
  let id = base; let n = 2;
  while (seen.has(id)) { id = `${base}-${n++}`; }
  seen.add(id);
  return id;
}

/**
 * Map Resource Graph rows to the architecture shape consumed by the renderer,
 * with a coverage report mirroring the ARM extractor's.
 */
export function buildArchitectureFromResources(resources: ArgResource[]): ArmExtractResult {
  const services: ArmExtractResult['architecture']['services'] = [];
  const idSeen = new Set<string>();
  const usedZones = new Map<string, string>(); // zone label → group id
  const skippedTypes = new Set<string>();

  // Map each Azure resource id (lowercased) → the service node it belongs to,
  // so property references can be resolved to edges.
  const azIdToNode = new Map<string, ArmExtractResult['architecture']['services'][number]>();
  const nodeProps = new Map<string, string>(); // node id → stringified properties

  for (const r of resources || []) {
    if (!r || !r.type || !r.id) continue;
    const meta = lookupServiceMeta(r.type, r.kind || '');
    if (!meta) { skippedTypes.add(r.type); continue; }
    const zone = zoneForCategory(meta.category);
    if (!usedZones.has(zone)) usedZones.set(zone, `zone-${zone.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
    const svc = {
      id: makeId(r.type, r.name, idSeen),
      name: meta.name,
      type: r.type,
      category: meta.category,
      description: r.name && r.name !== meta.name ? `${meta.name}: ${r.name}` : meta.name,
      groupId: usedZones.get(zone)!,
    };
    services.push(svc);
    azIdToNode.set(r.id.toLowerCase(), svc);
    let propsText = '';
    try { propsText = JSON.stringify(r.properties ?? {}); } catch { propsText = ''; }
    nodeProps.set(svc.id, propsText);
  }

  // ── Edges inferred from resource IDs embedded in properties ────────────────
  const connections: ArmExtractResult['architecture']['connections'] = [];
  const edgeSeen = new Set<string>();
  const azKeys = [...azIdToNode.keys()]; // lowercased resource ids
  const REF_RE = /\/subscriptions\/[0-9a-fA-F-]+\/resourcegroups\/[^/"'\\\s]+\/providers\/[a-z0-9./-]+/gi;

  const addEdge = (from: string, to: string) => {
    if (from === to) return;
    const key = `${from}->${to}`;
    if (edgeSeen.has(key) || edgeSeen.has(`${to}->${from}`)) return;
    edgeSeen.add(key);
    connections.push({ from, to, label: 'references', type: 'sync' });
  };

  for (const svc of services) {
    const props = nodeProps.get(svc.id) || '';
    if (!props) continue;
    const refs = props.match(REF_RE) || [];
    for (const raw of refs) {
      const ref = raw.toLowerCase();
      // A property may reference a child resource (e.g. a subnet under a VNet);
      // match the longest node id that is a prefix of the reference.
      let bestKey = '';
      for (const key of azKeys) {
        if ((ref === key || ref.startsWith(key + '/')) && key.length > bestKey.length) bestKey = key;
      }
      if (bestKey) {
        const target = azIdToNode.get(bestKey)!;
        if (target.id !== svc.id) addEdge(svc.id, target.id);
      }
    }
  }

  const usedGroupIds = new Set(services.map(s => s.groupId));
  const groups = [...usedZones.entries()]
    .filter(([, id]) => usedGroupIds.has(id))
    .map(([label, id]) => ({ id, label }));

  return {
    architecture: { groups, services, connections },
    coverage: {
      totalResources: (resources || []).length,
      mapped: services.length,
      folded: 0,
      skipped: skippedTypes.size,
      skippedTypes: [...skippedTypes].sort(),
      edgeCount: connections.length,
    },
  };
}

/** Query a resource group via the server's Resource Graph endpoint. */
export async function queryResourceGroupResources(subscriptionId: string, resourceGroup: string): Promise<ArgResource[]> {
  const res = await fetch('/api/azure/resource-graph', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscriptionId, resourceGroup }),
  });
  if (!res.ok) {
    let msg = `Resource Graph query failed (${res.status})`;
    try { msg = (await res.json()).error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  const data = await res.json();
  return (data.resources || []) as ArgResource[];
}
