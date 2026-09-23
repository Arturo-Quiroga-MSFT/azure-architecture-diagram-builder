// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Deterministic Architecture Hardener
 *
 * Takes an architecture (services + connections) and applies structural
 * remediations that clear the *pattern-level* WAF anti-patterns detected by
 * wafDetector — the same anti-patterns an agent would otherwise fix by hand
 * through repeated add-service / re-validate cycles. Pure rule-based, no LLM.
 *
 * Scope: only DIAGRAM-ADDRESSABLE (topology) anti-patterns are fixed here.
 * Config-level findings (HTTPS-only, TDE, Key Vault soft-delete, …) are
 * resolved by generate_bicep, not by this module.
 */

import { detectWafPatterns, type ServiceInput, type ConnectionInput } from './wafDetector.js';

export interface HardenService extends ServiceInput {
  id?: string;
  description?: string;
  groupId?: string;
}
export interface HardenConnection extends ConnectionInput {
  id?: string;
  type?: 'sync' | 'async' | 'optional' | 'association' | 'containment';
}
export interface HardenGroup {
  id: string;
  label: string;
}

export interface HardenChange {
  /** Anti-pattern id cleared by this change. */
  pattern: string;
  /** Human-readable description of what was added/rewired. */
  action: string;
  addedServices: string[];
  addedConnections: string[];
}

export interface HardenSnapshot {
  score: number;
  patternsDetected: string[];
  totalFindings: number;
}

export interface HardenResult {
  services: HardenService[];
  connections: HardenConnection[];
  groups: HardenGroup[];
  changes: HardenChange[];
  before: HardenSnapshot;
  after: HardenSnapshot;
  /** Pattern ids still present after hardening (e.g. intentionally skipped). */
  unresolved: string[];
  note: string;
}

const norm = (t: string): string => t.toLowerCase().trim();
const normRegion = (region?: string): string | null =>
  region?.trim() ? region.trim().toLowerCase().replace(/[\s_-]+/g, '') : null;

// Minimal type sets mirroring wafDetector's classification, used only to pick
// anchor nodes (which compute to wire Key Vault to, which DB to replicate, …).
const DATABASE_TYPES = new Set([
  'sql database', 'azure cosmos db', 'postgresql', 'mysql',
  'azure database for postgresql', 'azure database for mysql',
  'cosmos db', 'cosmosdb',
]);
const COMPUTE_TYPES = new Set([
  'app service', 'functions', 'azure functions', 'virtual machines',
  'kubernetes service', 'azure kubernetes service', 'container apps',
  'azure container apps', 'container instances',
]);
const REGIONAL_SERVING_TYPES = new Set([
  ...COMPUTE_TYPES,
  'static web apps',
  'azure static web apps',
]);
const FRONTEND_TYPES = new Set([
  'static web apps', 'azure static web apps', 'cdn',
  'content delivery network', 'azure front door',
]);
const DIRECT_DB_SOURCE_TYPES = new Set([
  ...FRONTEND_TYPES,
  'api management',
  'apim',
  'azure api management',
]);
const GATEWAY_TYPES = new Set([
  'api management', 'apim', 'azure api management', 'application gateway',
]);

const HARDEN_EDGE_GROUP: HardenGroup = { id: 'hardened-edge', label: 'Global Edge & Security' };
const HARDEN_SECOPS_GROUP: HardenGroup = { id: 'hardened-secops', label: 'Security & Ops' };
const HARDEN_GATEWAY_GROUP: HardenGroup = { id: 'hardened-gateway', label: 'API Gateway' };

/**
 * Apply deterministic topology remediations to clear pattern-level WAF
 * anti-patterns. Idempotent: re-hardening an already-hardened architecture is
 * a no-op for patterns that are already cleared.
 */
export function hardenArchitecture(
  inputServices: HardenService[],
  inputConnections: HardenConnection[] = [],
  inputGroups: HardenGroup[] = [],
  options: { secondaryRegion?: string } = {},
): HardenResult {
  const services: HardenService[] = inputServices.map(s => ({ ...s }));
  const connections: HardenConnection[] = inputConnections.map(c => ({ ...c }));
  const groups: HardenGroup[] = inputGroups.map(g => ({ ...g }));
  const changes: HardenChange[] = [];
  const secondaryRegion = normRegion(options.secondaryRegion);

  const before = snapshot(services, connections);

  // ── Helpers ──────────────────────────────────────────────────────────
  const hasName = (name: string) => services.some(s => norm(s.name) === norm(name));
  const uniqueName = (base: string): string => {
    if (!hasName(base)) return base;
    let suffix = 2;
    while (hasName(`${base} ${suffix}`)) suffix++;
    return `${base} ${suffix}`;
  };
  const firstOf = (set: Set<string>): HardenService | undefined =>
    services.find(s => set.has(norm(s.type)));
  const ensureGroup = (g: HardenGroup) => {
    if (!groups.some(x => x.id === g.id)) groups.push(g);
  };
  const addService = (svc: HardenService, group?: HardenGroup): boolean => {
    if (hasName(svc.name)) return false;
    if (group) { ensureGroup(group); svc.groupId = svc.groupId ?? group.id; }
    services.push(svc);
    return true;
  };
  const addConnection = (c: HardenConnection): string | null => {
    const exists = connections.some(
      x => norm(x.from) === norm(c.from) && norm(x.to) === norm(c.to),
    );
    if (exists) return null;
    connections.push(c);
    return `${c.from} → ${c.to}`;
  };

  const unresolved: string[] = [];

  const applyPass = (patterns: Set<string>): void => {
  // ── no-identity → Microsoft Entra ID ─────────────────────────────────
  if (patterns.has('no-identity')) {
    const anchor = firstOf(GATEWAY_TYPES) ?? firstOf(COMPUTE_TYPES);
    const added = addService(
      { name: 'Entra ID', type: 'Microsoft Entra ID', description: 'Centralized identity & access' },
      HARDEN_SECOPS_GROUP,
    );
    const conns: string[] = [];
    if (anchor) { const s = addConnection({ from: 'Entra ID', to: anchor.name, label: 'Authenticate and authorize access', type: 'sync' }); if (s) conns.push(s); }
    if (added) changes.push({ pattern: 'no-identity', action: 'Added Microsoft Entra ID for centralized authentication', addedServices: ['Entra ID'], addedConnections: conns });
  }

  // ── no-waf → Azure Front Door (global edge + WAF entry point) ─────────
  const hasWafAttachmentPoint = () => services.some(service =>
    norm(service.type) === 'azure front door' || norm(service.type) === 'application gateway',
  );
  if (patterns.has('no-waf') && !hasWafAttachmentPoint()) {
    const entry = firstOf(GATEWAY_TYPES) ?? firstOf(REGIONAL_SERVING_TYPES);
    const addedFd = addService(
      { name: 'Front Door', type: 'Azure Front Door', description: 'Global HTTP entry and WAF attachment point' },
      HARDEN_EDGE_GROUP,
    );
    const conns: string[] = [];
    if (entry) { const s = addConnection({ from: 'Front Door', to: entry.name, label: 'Route global traffic to entry point', type: 'sync' }); if (s) conns.push(s); }
    if (addedFd) changes.push({ pattern: 'no-waf', action: 'Added Azure Front Door as the global WAF entry point', addedServices: ['Front Door'], addedConnections: conns });
  }

  // ── single-region → explicit secondary serving instance ──────────────
  if (patterns.has('single-region') && secondaryRegion) {
    const primary = services.find(service => {
      const region = normRegion(service.region);
      return REGIONAL_SERVING_TYPES.has(norm(service.type)) && region && region !== secondaryRegion;
    });
    if (primary) {
      const secondaryName = uniqueName(`${primary.name} Secondary`);
      const secondaryGroup: HardenGroup = {
        id: `hardened-region-${secondaryRegion}`,
        label: `Secondary Region - ${secondaryRegion}`,
      };
      const addedSecondary = addService({
        ...primary,
        id: undefined,
        name: secondaryName,
        region: secondaryRegion,
        description: `Secondary ${primary.type} serving instance in ${secondaryRegion}`,
        groupId: secondaryGroup.id,
      }, secondaryGroup);

      let frontDoor = services.find(service => norm(service.type) === 'azure front door');
      let addedFrontDoor = false;
      if (!frontDoor) {
        addedFrontDoor = addService(
          { name: 'Front Door', type: 'Azure Front Door', description: 'Global routing across explicit serving regions' },
          HARDEN_EDGE_GROUP,
        );
        frontDoor = services.find(service => norm(service.type) === 'azure front door');
      }

      const conns: string[] = [];
      if (frontDoor) {
        const primaryEdge = addConnection({ from: frontDoor.name, to: primary.name, label: 'Route traffic to primary region', type: 'sync' });
        const secondaryEdge = addConnection({ from: frontDoor.name, to: secondaryName, label: 'Fail over traffic to secondary region', type: 'sync' });
        if (primaryEdge) conns.push(primaryEdge);
        if (secondaryEdge) conns.push(secondaryEdge);
      }
      const addedServices = [addedSecondary ? secondaryName : '', addedFrontDoor ? 'Front Door' : ''].filter(Boolean);
      if (addedServices.length || conns.length) {
        changes.push({
          pattern: 'single-region',
          action: `Added an explicit ${primary.type} serving instance in ${secondaryRegion} and global routing to both regions`,
          addedServices,
          addedConnections: conns,
        });
      }
    }
  }
  if (patterns.has('no-waf')) {
    const enforcementPoint = services.find(service =>
      norm(service.type) === 'azure front door' || norm(service.type) === 'application gateway',
    );
    let waf = services.find(service => norm(service.type) === 'web application firewall' || norm(service.type) === 'waf' || norm(service.type) === 'azure waf');
    let addedWaf = false;
    if (!waf) {
      addedWaf = addService(
        { name: 'WAF Policy', type: 'Web Application Firewall', description: 'OWASP Top 10 protection' },
        HARDEN_EDGE_GROUP,
      );
      waf = services.find(service => norm(service.type) === 'web application firewall');
    }
    const conns: string[] = [];
    if (enforcementPoint && waf) { const s = addConnection({ from: enforcementPoint.name, to: waf.name, label: 'Inspect requests for web threats', type: 'sync' }); if (s) conns.push(s); }
    if (addedWaf || conns.length) changes.push({
      pattern: 'no-waf',
      action: addedWaf ? 'Added and associated a Web Application Firewall policy' : 'Associated the existing Web Application Firewall policy with the edge',
      addedServices: addedWaf && waf ? [waf.name] : [],
      addedConnections: conns,
    });
  }

  // ── no-api-gateway + direct-db-access → API Management ────────────────
  const needApim = patterns.has('no-api-gateway') || patterns.has('direct-db-access');
  if (needApim && !firstOf(GATEWAY_TYPES)) {
    const backend = firstOf(COMPUTE_TYPES);
    const addedApim = addService(
      { name: 'API Management', type: 'API Management', region: backend?.region, description: 'Unified API gateway' },
      HARDEN_GATEWAY_GROUP,
    );
    const conns: string[] = [];
    if (backend) { const s = addConnection({ from: 'API Management', to: backend.name, label: 'Proxy and secure backend API', type: 'sync' }); if (s) conns.push(s); }
    if (addedApim && patterns.has('no-api-gateway')) changes.push({ pattern: 'no-api-gateway', action: 'Added API Management as the unified API gateway', addedServices: ['API Management'], addedConnections: conns });
  }

  // ── direct-db-access → insert the API layer between frontend and DB ───
  if (patterns.has('direct-db-access')) {
    const apim = firstOf(GATEWAY_TYPES) ?? services.find(s => norm(s.name) === 'api management');
    const dbNames = new Set(services.filter(s => DATABASE_TYPES.has(norm(s.type))).map(s => norm(s.name)));
    const frontNames = new Set(services.filter(s => DIRECT_DB_SOURCE_TYPES.has(norm(s.type))).map(s => norm(s.name)));
    const rewired: string[] = [];
    let gatewayBackend: HardenService | undefined;
    if (apim) {
      for (const c of [...connections]) {
        if (frontNames.has(norm(c.from)) && dbNames.has(norm(c.to))) {
          // Drop the direct edge. A gateway needs a compute backend; other
          // frontends route through the existing gateway.
          const idx = connections.indexOf(c);
          if (idx >= 0) connections.splice(idx, 1);
          let sourceForDatabase = apim.name;
          let a: string | null = null;
          if (norm(c.from) === norm(apim.name)) {
            if (!gatewayBackend) {
              const backendName = uniqueName(`${apim.name} Backend`);
              addService({
                name: backendName,
                type: 'App Service',
                region: apim.region,
                description: 'Application backend between API Management and the data tier',
                groupId: apim.groupId,
              });
              gatewayBackend = services.find(service => service.name === backendName);
            }
            if (gatewayBackend) {
              a = addConnection({ from: apim.name, to: gatewayBackend.name, label: 'Forward requests to application backend', type: 'sync' });
              sourceForDatabase = gatewayBackend.name;
            }
          } else {
            a = addConnection({ from: c.from, to: apim.name, label: 'Send API request through gateway', type: 'sync' });
          }
          const b = addConnection({ from: sourceForDatabase, to: c.to, label: 'Query data through application backend', type: 'sync' });
          if (a) rewired.push(a);
          if (b) rewired.push(b);
        }
      }
      changes.push({ pattern: 'direct-db-access', action: 'Rerouted direct frontend→database traffic through the API layer', addedServices: [], addedConnections: rewired });
    } else if (!unresolved.includes('direct-db-access')) {
      unresolved.push('direct-db-access');
    }
  }

  // ── single-database → replicas in an explicit secondary region ───────
  if (patterns.has('single-database') && secondaryRegion) {
    const databaseTypes = [...new Set(services.filter(service => DATABASE_TYPES.has(norm(service.type))).map(service => norm(service.type)))];
    for (const databaseType of databaseTypes) {
      const instances = services.filter(service => norm(service.type) === databaseType);
      const explicitRegions = new Set(instances.map(service => normRegion(service.region)).filter((region): region is string => Boolean(region)));
      if (explicitRegions.size >= 2) continue;
      const primary = instances.find(service => {
        const region = normRegion(service.region);
        return region && region !== secondaryRegion;
      });
      if (!primary) continue;
      const replicaName = uniqueName(`${primary.name} Replica`);
      const secondaryGroup: HardenGroup = {
        id: `hardened-region-${secondaryRegion}`,
        label: `Secondary Region - ${secondaryRegion}`,
      };
      const added = addService({
        ...primary,
        id: undefined,
        name: replicaName,
        region: secondaryRegion,
        description: `Geo-replicated ${primary.type} instance in ${secondaryRegion}`,
        groupId: secondaryGroup.id,
      }, secondaryGroup);
      const conns: string[] = [];
      const edge = addConnection({ from: primary.name, to: replicaName, label: `Replicate data to ${secondaryRegion}`, type: 'async' });
      if (edge) conns.push(edge);
      if (added) changes.push({
        pattern: 'single-database',
        action: `Added an explicit ${primary.type} replica in ${secondaryRegion}`,
        addedServices: [replicaName],
        addedConnections: conns,
      });
    }
  }

  // ── no-cache → Redis Cache ───────────────────────────────────────────
  if (patterns.has('no-cache')) {
    const compute = firstOf(COMPUTE_TYPES);
    const added = addService(
      { name: 'Redis Cache', type: 'Redis Cache', region: compute?.region, description: 'Low-latency cache tier', groupId: compute?.groupId },
    );
    const conns: string[] = [];
    if (compute) { const s = addConnection({ from: compute.name, to: 'Redis Cache', label: 'Cache hot data for low latency', type: 'sync' }); if (s) conns.push(s); }
    if (added) changes.push({ pattern: 'no-cache', action: 'Added Azure Cache for Redis between compute and data tiers', addedServices: ['Redis Cache'], addedConnections: conns });
  }

  // ── no-key-vault → Key Vault ─────────────────────────────────────────
  if (patterns.has('no-key-vault')) {
    const compute = firstOf(GATEWAY_TYPES) ?? firstOf(COMPUTE_TYPES);
    const added = addService(
      { name: 'Key Vault', type: 'Key Vault', region: compute?.region, description: 'Secrets, keys & certificates' },
      HARDEN_SECOPS_GROUP,
    );
    const conns: string[] = [];
    if (compute) { const s = addConnection({ from: compute.name, to: 'Key Vault', label: 'Retrieve secrets and certificates', type: 'sync' }); if (s) conns.push(s); }
    if (added) changes.push({ pattern: 'no-key-vault', action: 'Added Azure Key Vault for secrets management', addedServices: ['Key Vault'], addedConnections: conns });
  }

  // ── no-backup → Azure Backup ─────────────────────────────────────────
  if (patterns.has('no-backup')) {
    const db = firstOf(DATABASE_TYPES);
    const added = addService(
      { name: 'Azure Backup', type: 'Backup', region: db?.region, description: 'Point-in-time restore / DR' },
      HARDEN_SECOPS_GROUP,
    );
    const conns: string[] = [];
    if (db) { const s = addConnection({ from: db.name, to: 'Azure Backup', label: 'Back up for point-in-time restore', type: 'async' }); if (s) conns.push(s); }
    if (added) changes.push({ pattern: 'no-backup', action: 'Added Azure Backup for disaster recovery', addedServices: ['Azure Backup'], addedConnections: conns });
  }

  // ── no-monitoring → Azure Monitor + Application Insights ─────────────
  if (patterns.has('no-monitoring')) {
    const compute = firstOf(COMPUTE_TYPES) ?? firstOf(GATEWAY_TYPES);
    const addedAi = addService(
      { name: 'App Insights', type: 'Application Insights', region: compute?.region, description: 'App telemetry' },
      HARDEN_SECOPS_GROUP,
    );
    const addedMon = addService(
      { name: 'Azure Monitor', type: 'Azure Monitor', region: compute?.region, description: 'Metrics, logs & alerts' },
      HARDEN_SECOPS_GROUP,
    );
    const conns: string[] = [];
    if (compute) { const s = addConnection({ from: compute.name, to: 'App Insights', label: 'Emit application telemetry', type: 'async' }); if (s) conns.push(s); }
    const s2 = addConnection({ from: 'App Insights', to: 'Azure Monitor', label: 'Forward metrics and alerts', type: 'async' });
    if (s2) conns.push(s2);
    const added = [addedAi ? 'App Insights' : '', addedMon ? 'Azure Monitor' : ''].filter(Boolean);
    if (added.length) changes.push({ pattern: 'no-monitoring', action: 'Added Application Insights + Azure Monitor for observability', addedServices: added, addedConnections: conns });
  }
  };

  // Iterate until both pattern and topology state stabilize. A remediation can
  // clear one finding while graph growth exposes another, so count-only checks
  // are insufficient.
  const seenStates = new Set<string>();
  for (let pass = 0; pass < 8; pass++) {
    const patterns = new Set(snapshot(services, connections).patternsDetected);
    if (patterns.size === 0) break;
    const stateBefore = JSON.stringify({
      patterns: [...patterns].sort(),
      services: services.map(service => [norm(service.name), norm(service.type), normRegion(service.region)]).sort(),
      connections: connections.map(connection => [norm(connection.from), norm(connection.to)]).sort(),
    });
    if (seenStates.has(stateBefore)) break;
    seenStates.add(stateBefore);
    applyPass(patterns);
    const patternsAfter = snapshot(services, connections).patternsDetected;
    const stateAfter = JSON.stringify({
      patterns: [...patternsAfter].sort(),
      services: services.map(service => [norm(service.name), norm(service.type), normRegion(service.region)]).sort(),
      connections: connections.map(connection => [norm(connection.from), norm(connection.to)]).sort(),
    });
    if (stateAfter === stateBefore) break;
  }

  const after = snapshot(services, connections);
  for (const p of after.patternsDetected) {
    if (!unresolved.includes(p)) unresolved.push(p);
  }

  const note = after.patternsDetected.length === 0
    ? 'All pattern-level anti-patterns cleared. Remaining WAF findings are config-level — resolve them with generate_bicep.'
    : `Cleared ${before.patternsDetected.length - after.patternsDetected.length} of ${before.patternsDetected.length} pattern anti-patterns. Remaining: ${after.patternsDetected.join(', ')}. Config-level findings are resolved by generate_bicep.`;

  return { services, connections, groups, changes, before, after, unresolved, note };
}

function snapshot(services: ServiceInput[], connections: ConnectionInput[]): HardenSnapshot {
  const r = detectWafPatterns(services, connections);
  return { score: r.score, patternsDetected: r.patternsDetected, totalFindings: r.findings.length };
}
