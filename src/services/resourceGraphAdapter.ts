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
 * `dependsOn`, so edges are INFERRED from evidence in each resource's
 * properties and identity block:
 *   • real resource IDs (serverFarmId, environmentId, privateLinkServiceId,
 *     subnet IDs, userAssignedIdentities, env vars holding resource IDs)
 *   • endpoint hostnames owned by another resource in the group (an env var
 *     pointing at https://<cosmos>.documents.azure.com, a registry server
 *     <acr>.azurecr.io, ...)
 *   • Log Analytics workspace customer IDs (Container Apps environments log
 *     by workspace GUID, not resource ID)
 * Child resources that don't map to a node (DNS zone VNet links, ...) lend
 * their references to their mapped parent. Each edge is labelled by what the
 * reference means (classifyRelationship), e.g. "runs in", "pulls images from".
 */

import {
  classifyRelationship, EdgeCollector, lookupServiceMeta, walkStrings, zoneForCategory,
  type ArmExtractResult,
} from './armExtractor';

/** A row returned by the /api/azure/resource-graph endpoint. */
export interface ArgResource {
  id: string;
  name: string;
  type: string;
  kind?: string;
  location?: string;
  properties?: unknown;
  identity?: unknown;
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

  type Service = ArmExtractResult['architecture']['services'][number];
  // Map each Azure resource id (lowercased) → its service node and source row.
  const azIdToNode = new Map<string, Service>();
  const nodeSource = new Map<string, ArgResource>();
  const unmapped: ArgResource[] = [];

  for (const r of resources || []) {
    if (!r || !r.type || !r.id) continue;
    const meta = lookupServiceMeta(r.type, r.kind || '');
    if (!meta) { skippedTypes.add(r.type); unmapped.push(r); continue; }
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
    nodeSource.set(svc.id, r);
  }

  const azKeys = [...azIdToNode.keys()];
  // Longest node id that is the reference or its ancestor (a subnet id resolves
  // to its VNet, a child resource to its parent).
  const nodeForId = (ref: string): Service | undefined => {
    let best = '';
    for (const key of azKeys) {
      if ((ref === key || ref.startsWith(key + '/')) && key.length > best.length) best = key;
    }
    return best ? azIdToNode.get(best) : undefined;
  };

  // Hostnames a resource owns: endpoints whose first DNS label is its own
  // name, e.g. cosmos-x.documents.azure.com, acrx.azurecr.io.
  const HOST_RE = /\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+){2,}\b/gi;
  const hostOwner = new Map<string, Service>();
  const ambiguousHosts = new Set<string>();
  // Log Analytics customer (workspace) id → workspace node.
  const workspaceByCustomerId = new Map<string, Service>();
  for (const svc of services) {
    const r = nodeSource.get(svc.id)!;
    const name = String(r.name || '').toLowerCase().split('/').pop() || '';
    walkStrings(r.properties, (_path, text) => {
      for (const host of text.toLowerCase().match(HOST_RE) || []) {
        if (host.split('.')[0] !== name) continue;
        const owner = hostOwner.get(host);
        if (owner && owner.id !== svc.id) ambiguousHosts.add(host);
        else hostOwner.set(host, svc);
      }
    });
    const customerId = (r.properties as { customerId?: unknown } | undefined)?.customerId;
    if (r.type.toLowerCase() === 'microsoft.operationalinsights/workspaces' && typeof customerId === 'string') {
      workspaceByCustomerId.set(customerId.toLowerCase(), svc);
    }
  }
  for (const host of ambiguousHosts) hostOwner.delete(host);

  // ── Edges inferred from references in properties and identity ────────────
  const edges = new EdgeCollector();
  const REF_RE = /\/subscriptions\/[0-9a-fA-F-]+\/resourcegroups\/[^/"'\\\s]+\/providers\/[a-z0-9./-]+/gi;
  const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const link = (source: Service, target: Service | undefined, path: string) => {
    if (!target || target.id === source.id) return;
    const s = nodeSource.get(source.id)!;
    const t = nodeSource.get(target.id)!;
    edges.add(source.id, target.id, classifyRelationship(s.type, t.type, t.kind || '', path, 'references'));
  };
  const scanFrom = (source: Service, r: ArgResource) => {
    const isNetworkType = nodeSource.get(source.id)!.type.toLowerCase().startsWith('microsoft.network/');
    const visit = (path: string, text: string) => {
      for (const raw of text.match(REF_RE) || []) link(source, nodeForId(raw.toLowerCase()), path);
      // Hostnames are application configuration (env vars, registry servers);
      // network plumbing such as a private endpoint NIC only records DNS names.
      if (!isNetworkType) {
        for (const host of text.toLowerCase().match(HOST_RE) || []) link(source, hostOwner.get(host), path);
      }
      if (GUID_RE.test(text) && /(customerid|workspaceid)$/i.test(path)) {
        link(source, workspaceByCustomerId.get(text.toLowerCase()), path);
      }
    };
    walkStrings(r.properties, visit);
    walkStrings(r.identity, visit, 'identity');
  };

  for (const svc of services) scanFrom(svc, nodeSource.get(svc.id)!);
  // Unmapped child resources (e.g. privateDnsZones/virtualNetworkLinks)
  // contribute their references to the mapped parent they belong to.
  for (const r of unmapped) {
    const parent = r.type.split('/').length > 2 ? nodeForId(r.id.toLowerCase()) : undefined;
    if (parent) scanFrom(parent, r);
  }
  const connections = edges.list();

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
