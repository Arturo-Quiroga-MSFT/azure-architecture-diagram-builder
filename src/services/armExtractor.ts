// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Deterministic ARM template → architecture extractor.
 *
 * Unlike the LLM-based importer (which returns the model's *impression* of a
 * template), this parses the ARM JSON directly so the resulting diagram is a
 * faithful mirror of the template:
 *   • every mapped resource appears exactly once
 *   • edges are derived from real `dependsOn` entries and `resourceId(...)`
 *     references, not inferred
 *   • unmapped resource types are reported (coverage) instead of silently dropped
 *
 * The output matches the shape consumed by handleAIGenerate / the renderer:
 *   { groups: [{id,label}], services: [{id,name,type,category,description,groupId}],
 *     connections: [{from,to,label,type}] }
 * plus a `coverage` report used to build a post-import fidelity summary.
 */

// ─── ARM resource type → { name, category } mapping ───────────────────────────
// `category` values MUST match the icon categories the renderer understands.
export interface ServiceMeta { name: string; category: string; }

const ARM_TYPE_MAP: Record<string, ServiceMeta> = {
  // App / web
  'microsoft.web/sites': { name: 'App Service', category: 'app services' },
  'microsoft.web/serverfarms': { name: 'App Service Plan', category: 'app services' },
  'microsoft.web/staticsites': { name: 'Static Web Apps', category: 'web' },
  'microsoft.logic/workflows': { name: 'Logic Apps', category: 'app services' },
  'microsoft.apimanagement/service': { name: 'API Management', category: 'app services' },
  'microsoft.cdn/profiles': { name: 'Front Door', category: 'web' },
  // Compute / containers
  'microsoft.compute/virtualmachines': { name: 'Virtual Machines', category: 'compute' },
  'microsoft.compute/virtualmachinescalesets': { name: 'VM Scale Sets', category: 'compute' },
  'microsoft.compute/disks': { name: 'Managed Disks', category: 'compute' },
  'microsoft.batch/batchaccounts': { name: 'Batch', category: 'compute' },
  'microsoft.containerregistry/registries': { name: 'Container Registry', category: 'containers' },
  'microsoft.containerinstance/containergroups': { name: 'Container Instances', category: 'containers' },
  'microsoft.containerservice/managedclusters': { name: 'Kubernetes Service (AKS)', category: 'containers' },
  'microsoft.app/containerapps': { name: 'Container Apps', category: 'containers' },
  'microsoft.app/managedenvironments': { name: 'Container Apps Environment', category: 'containers' },
  // Databases
  'microsoft.sql/servers': { name: 'SQL Server', category: 'databases' },
  'microsoft.sql/servers/databases': { name: 'SQL Database', category: 'databases' },
  'microsoft.documentdb/databaseaccounts': { name: 'Cosmos DB', category: 'databases' },
  'microsoft.dbformysql/servers': { name: 'MySQL', category: 'databases' },
  'microsoft.dbformysql/flexibleservers': { name: 'MySQL', category: 'databases' },
  'microsoft.dbforpostgresql/servers': { name: 'PostgreSQL', category: 'databases' },
  'microsoft.dbforpostgresql/flexibleservers': { name: 'PostgreSQL', category: 'databases' },
  'microsoft.cache/redis': { name: 'Azure Cache for Redis', category: 'databases' },
  // Storage
  'microsoft.storage/storageaccounts': { name: 'Storage Account', category: 'storage' },
  // Networking
  'microsoft.network/virtualnetworks': { name: 'Virtual Network', category: 'networking' },
  'microsoft.network/applicationgateways': { name: 'Application Gateway', category: 'networking' },
  'microsoft.network/loadbalancers': { name: 'Load Balancer', category: 'networking' },
  'microsoft.network/publicipaddresses': { name: 'Public IP', category: 'networking' },
  'microsoft.network/networkinterfaces': { name: 'Network Interface', category: 'networking' },
  'microsoft.network/networksecuritygroups': { name: 'Network Security Group', category: 'networking' },
  'microsoft.network/azurefirewalls': { name: 'Azure Firewall', category: 'networking' },
  'microsoft.network/virtualnetworkgateways': { name: 'VPN Gateway', category: 'networking' },
  'microsoft.network/privateendpoints': { name: 'Private Endpoint', category: 'networking' },
  'microsoft.network/privatednszones': { name: 'Private DNS Zone', category: 'networking' },
  'microsoft.network/dnszones': { name: 'DNS Zone', category: 'networking' },
  'microsoft.network/frontdoors': { name: 'Front Door', category: 'web' },
  'microsoft.network/trafficmanagerprofiles': { name: 'Traffic Manager', category: 'networking' },
  'microsoft.network/bastionhosts': { name: 'Azure Bastion', category: 'networking' },
  // Identity / security
  'microsoft.keyvault/vaults': { name: 'Key Vault', category: 'identity' },
  'microsoft.managedidentity/userassignedidentities': { name: 'Managed Identity', category: 'identity' },
  'microsoft.security/pricings': { name: 'Microsoft Defender for Cloud', category: 'security' },
  // Monitor
  'microsoft.insights/components': { name: 'Application Insights', category: 'monitor' },
  'microsoft.operationalinsights/workspaces': { name: 'Log Analytics', category: 'monitor' },
  'microsoft.insights/actiongroups': { name: 'Monitor', category: 'monitor' },
  // Integration / analytics / iot
  'microsoft.servicebus/namespaces': { name: 'Service Bus', category: 'integration' },
  'microsoft.eventgrid/topics': { name: 'Event Grid', category: 'integration' },
  'microsoft.eventgrid/systemtopics': { name: 'Event Grid', category: 'integration' },
  'microsoft.eventhub/namespaces': { name: 'Event Hubs', category: 'analytics' },
  'microsoft.streamanalytics/streamingjobs': { name: 'Stream Analytics', category: 'analytics' },
  'microsoft.datafactory/factories': { name: 'Data Factory', category: 'analytics' },
  'microsoft.synapse/workspaces': { name: 'Synapse Analytics', category: 'analytics' },
  'microsoft.devices/iothubs': { name: 'IoT Hub', category: 'iot' },
  // AI + ML
  'microsoft.cognitiveservices/accounts': { name: 'Cognitive Services', category: 'ai + machine learning' },
  'microsoft.machinelearningservices/workspaces': { name: 'Machine Learning', category: 'ai + machine learning' },
  'microsoft.search/searchservices': { name: 'Azure AI Search', category: 'ai + machine learning' },
};

// Child/config sub-resources that we intentionally fold into their parent
// (they add noise, not architecture). Matched by type suffix.
const FOLDED_CHILD_TYPES = new Set([
  'microsoft.storage/storageaccounts/blobservices',
  'microsoft.storage/storageaccounts/fileservices',
  'microsoft.storage/storageaccounts/queueservices',
  'microsoft.storage/storageaccounts/tableservices',
  'microsoft.network/virtualnetworks/subnets',
  'microsoft.web/sites/config',
  'microsoft.sql/servers/firewallrules',
  'microsoft.sql/servers/databases/transparentdataencryption',
]);

// ─── Category → zone (group) label ────────────────────────────────────────────
const CATEGORY_ZONE: Record<string, string> = {
  'web': 'Edge / Web',
  'app services': 'Application',
  'compute': 'Compute',
  'containers': 'Containers',
  'databases': 'Data',
  'storage': 'Data',
  'networking': 'Networking',
  'identity': 'Identity & Security',
  'security': 'Identity & Security',
  'monitor': 'Monitoring',
  'integration': 'Integration',
  'analytics': 'Analytics',
  'iot': 'IoT',
  'ai + machine learning': 'AI + ML',
};

export interface ArmCoverage {
  totalResources: number;
  mapped: number;
  folded: number;
  skipped: number;
  skippedTypes: string[];
  edgeCount: number;
}

export interface ArmExtractResult {
  architecture: {
    groups: { id: string; label: string }[];
    services: { id: string; name: string; type: string; category: string; description: string; groupId: string | null }[];
    connections: { from: string; to: string; label: string; type: string }[];
  };
  coverage: ArmCoverage;
}

interface FlatResource {
  armType: string;      // lower-cased full type, e.g. microsoft.web/sites
  rawType: string;      // original-cased type
  name: string;         // cleaned display name (resolved from parameters)
  rawName: string;      // original name expression
  kind: string;         // resource `kind` (lower-cased), used to refine some types
  dependsOn: string[];
  propsText: string;    // stringified properties (for reference() scanning)
}

/** Map of ARM parameter name → its string defaultValue (real resource name). */
type ParamMap = Record<string, string>;

function buildParamMap(template: any): ParamMap {
  const out: ParamMap = {};
  const params = template?.parameters ?? {};
  if (params && typeof params === 'object') {
    for (const [k, v] of Object.entries(params)) {
      const dv = (v as any)?.defaultValue;
      if (typeof dv === 'string' && dv) out[k] = dv;
    }
  }
  return out;
}

/**
 * Resolve an ARM name expression to a readable resource name.
 *
 * `az group export` emits names like `[parameters('accounts_AQ_DOC_INTEL_name')]`
 * or `[concat(parameters('acct_name'), '/child')]`. We resolve the first
 * `parameters('x')` reference to its `defaultValue` (the real Azure resource
 * name), falling back to a humanized token when no default is present.
 */
function cleanName(raw: string, paramMap: ParamMap = {}): string {
  if (!raw) return 'resource';
  let s = String(raw);
  if (/^\[/.test(s)) {
    const paramRefs = [...s.matchAll(/parameters\(\s*'([^']+)'\s*\)/gi)].map(m => m[1]);
    const chosen = paramRefs.find(p => /_name$/i.test(p)) || paramRefs[0];
    if (chosen && paramMap[chosen]) {
      s = paramMap[chosen]; // real name, e.g. "AQ-DOC-INTEL" — keep as-is
    } else if (chosen) {
      s = chosen.replace(/_name$/i, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
    } else {
      const quoted = [...s.matchAll(/'([^']+)'/g)].map(m => m[1]).filter(Boolean);
      const cand = quoted.reverse().find(q => !/^microsoft\./i.test(q) && !q.includes('/')) || quoted[0] || 'resource';
      s = cand.replace(/[-_]+/g, ' ').trim();
    }
  }
  // Drop a trailing "/child" segment (parent name is what matters for display)
  s = s.split('/')[0].trim();
  if (!s) return 'resource';
  return s.length <= 48 ? s : s.slice(0, 47) + '…';
}

/** Recursively flatten ARM resources (including nested child resources). */
function flattenResources(resources: any[], paramMap: ParamMap, parentName = ''): FlatResource[] {
  const out: FlatResource[] = [];
  if (!Array.isArray(resources)) return out;
  for (const r of resources) {
    if (!r || typeof r !== 'object' || !r.type) continue;
    const rawType = String(r.type);
    const armType = rawType.toLowerCase();
    const rawName = String(r.name ?? '');
    const kind = String(r.kind ?? '').toLowerCase();
    const dependsOn = Array.isArray(r.dependsOn) ? r.dependsOn.map(String) : [];
    let propsText = '';
    try { propsText = JSON.stringify(r.properties ?? {}); } catch { propsText = ''; }
    out.push({ armType, rawType, name: cleanName(rawName, paramMap) || parentName || 'resource', rawName, kind, dependsOn, propsText });
    if (Array.isArray(r.resources)) {
      out.push(...flattenResources(r.resources, paramMap, cleanName(rawName, paramMap)));
    }
  }
  return out;
}

/**
 * Refine a mapped service by the resource `kind` (currently Cognitive Services,
 * whose `kind` distinguishes OpenAI / Document Intelligence / AI Services).
 */
function refineByKind(armType: string, kind: string, meta: ServiceMeta): ServiceMeta {
  if (armType === 'microsoft.cognitiveservices/accounts') {
    if (kind === 'openai') return { name: 'Azure OpenAI', category: 'ai + machine learning' };
    if (kind === 'formrecognizer') return { name: 'Document Intelligence', category: 'ai + machine learning' };
  }
  return meta;
}

/**
 * Public helper — resolve an Azure resource type (+ optional `kind`) to a
 * mapped service, or null when the type isn't recognized. Shared by the ARM
 * extractor and the Resource Graph adapter so both use one source of truth.
 */
export function lookupServiceMeta(armType: string, kind = ''): ServiceMeta | null {
  const t = armType.toLowerCase();
  const base = ARM_TYPE_MAP[t];
  if (!base) return null;
  return refineByKind(t, kind.toLowerCase(), base);
}

/** Public helper — the diagram zone (group) label for a service category. */
export function zoneForCategory(category: string): string {
  return CATEGORY_ZONE[category] || 'Other';
}

/** Build a stable service id from type + name. */
function makeId(armType: string, name: string, seen: Set<string>): string {
  const base = `${armType.split('/').pop()}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'svc';
  let id = base; let n = 2;
  while (seen.has(id)) { id = `${base}-${n++}`; }
  seen.add(id);
  return id;
}

/**
 * Extract a faithful architecture from a parsed ARM template object.
 */
export function extractArchitectureFromArm(template: any): ArmExtractResult {
  const resources: any[] = Array.isArray(template?.resources) ? template.resources : [];
  const paramMap = buildParamMap(template);
  const flat = flattenResources(resources, paramMap);

  const services: ArmExtractResult['architecture']['services'] = [];
  const idSeen = new Set<string>();
  const skippedTypes = new Set<string>();
  let folded = 0;

  // Index each flat resource → assigned service id (or null when skipped/folded).
  // Keyed by index so dependsOn resolution can map back.
  const flatToService: (typeof services[number] | null)[] = [];
  const svcFlat = new Map<string, FlatResource>(); // service id → its source resource
  const usedZones = new Map<string, string>(); // zone label → group id

  for (const fr of flat) {
    if (FOLDED_CHILD_TYPES.has(fr.armType)) { flatToService.push(null); folded++; continue; }
    const baseMeta = ARM_TYPE_MAP[fr.armType];
    if (!baseMeta) {
      // Try a parent-type fallback for unmapped children (Provider/parent/child)
      const parentType = fr.armType.split('/').slice(0, 2).join('/');
      const parentMeta = ARM_TYPE_MAP[parentType];
      if (parentMeta && fr.armType.split('/').length > 2) { flatToService.push(null); folded++; continue; }
      skippedTypes.add(fr.rawType);
      flatToService.push(null);
      continue;
    }
    const meta = refineByKind(fr.armType, fr.kind, baseMeta);
    const zone = CATEGORY_ZONE[meta.category] || 'Other';
    if (!usedZones.has(zone)) usedZones.set(zone, `zone-${zone.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
    const svc = {
      id: makeId(fr.armType, fr.name, idSeen),
      name: meta.name,
      type: fr.rawType,
      category: meta.category,
      description: fr.name && fr.name !== meta.name ? `${meta.name}: ${fr.name}` : meta.name,
      groupId: usedZones.get(zone)!,
    };
    services.push(svc);
    svcFlat.set(svc.id, fr);
    flatToService.push(svc);
  }

  // ── Edges from dependsOn + resourceId()/reference() references ──────────────
  const connections: ArmExtractResult['architecture']['connections'] = [];
  const edgeSeen = new Set<string>();

  const addEdge = (from: string, to: string) => {
    if (from === to) return;
    const key = `${from}->${to}`;
    if (edgeSeen.has(key) || edgeSeen.has(`${to}->${from}`)) return;
    edgeSeen.add(key);
    connections.push({ from, to, label: 'depends on', type: 'sync' });
  };

  // Resolve a resourceId('<type>', ...) expression to a target service.
  const resolveRef = (expr: string): (typeof services[number]) | null => {
    const typeMatch = expr.match(/resourceId\(\s*'([^']+)'/i) || expr.match(/'(microsoft\.[^']+)'/i);
    const refType = typeMatch ? typeMatch[1].toLowerCase() : '';
    const nameTokens = [...expr.matchAll(/'([^']+)'/g)].map(m => m[1]).filter(t => !/^microsoft\./i.test(t) && !t.includes('/'));
    // Candidate services of the referenced type
    let candidates = services.filter((s) => {
      const fr = svcFlat.get(s.id);
      return !!fr && (refType ? fr.armType === refType || fr.armType.startsWith(refType) : true);
    });
    if (candidates.length === 0 && refType) {
      // fall back to matching by the leaf of the type
      const leaf = refType.split('/').pop();
      candidates = services.filter(s => s.type.toLowerCase().split('/').pop() === leaf);
    }
    if (candidates.length === 1) return candidates[0];
    if (candidates.length > 1 && nameTokens.length) {
      const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, '');
      const found = candidates.find(c => {
        const fr = svcFlat.get(c.id);
        return !!fr && nameTokens.some(tok => norm(fr.rawName).includes(norm(tok)) || norm(fr.name).includes(norm(tok)));
      });
      if (found) return found;
    }
    return candidates[0] || null;
  };

  flat.forEach((fr, i) => {
    const svc = flatToService[i];
    if (!svc) return;
    // dependsOn edges
    for (const dep of fr.dependsOn) {
      const target = resolveRef(dep);
      if (target) addEdge(svc.id, target.id);
    }
    // resourceId()/reference() references inside properties
    const refExprs = [
      ...fr.propsText.matchAll(/resourceId\([^)]*\)/gi),
      ...fr.propsText.matchAll(/reference\([^)]*\)/gi),
    ].map(m => m[0]);
    for (const expr of refExprs) {
      const target = resolveRef(expr);
      if (target && target.id !== svc.id) addEdge(svc.id, target.id);
    }
  });

  // ── Groups (only zones that ended up with services) ────────────────────────
  const usedGroupIds = new Set(services.map(s => s.groupId));
  const groups = [...usedZones.entries()]
    .filter(([, id]) => usedGroupIds.has(id))
    .map(([label, id]) => ({ id, label }));

  const mapped = services.length;
  const skipped = skippedTypes.size;

  return {
    architecture: { groups, services, connections },
    coverage: {
      totalResources: flat.length,
      mapped,
      folded,
      skipped,
      skippedTypes: [...skippedTypes].sort(),
      edgeCount: connections.length,
    },
  };
}

/** Human-readable one-line coverage summary for a toast / banner. */
export function summarizeCoverage(c: ArmCoverage): string {
  const parts = [`Mapped ${c.mapped} resource${c.mapped === 1 ? '' : 's'}`, `${c.edgeCount} link${c.edgeCount === 1 ? '' : 's'}`];
  if (c.folded) parts.push(`${c.folded} child resource${c.folded === 1 ? '' : 's'} folded`);
  if (c.skipped) parts.push(`${c.skipped} unmapped type${c.skipped === 1 ? '' : 's'} skipped`);
  return parts.join(' · ');
}
