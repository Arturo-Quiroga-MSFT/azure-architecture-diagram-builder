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
import { resolveServiceName } from './serviceCatalog.js';

export interface HardenService extends ServiceInput {
  description?: string;
  groupId?: string;
}
export interface HardenConnection extends ConnectionInput {
  type?: 'sync' | 'async' | 'optional';
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

const norm = (t: string): string => (resolveServiceName(t) ?? t).toLowerCase().trim();

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
const FRONTEND_TYPES = new Set([
  'static web apps', 'azure static web apps', 'cdn',
  'content delivery network', 'azure front door',
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
): HardenResult {
  const services: HardenService[] = inputServices.map(s => ({ ...s }));
  const connections: HardenConnection[] = inputConnections.map(c => ({ ...c }));
  const groups: HardenGroup[] = inputGroups.map(g => ({ ...g }));
  const changes: HardenChange[] = [];

  const before = snapshot(services, connections);

  // ── Helpers ──────────────────────────────────────────────────────────
  const hasName = (name: string) => services.some(s => norm(s.name) === norm(name));
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

  const patterns0 = new Set(before.patternsDetected);
  void patterns0;
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

  // ── no-waf + single-region → Azure Front Door (global edge + WAF) ─────
  // Front Door provides both a global load-balancer (clears single-region) and
  // an entry point for WAF (clears no-waf). We add a WAF Policy alongside it.
  const needFrontDoor = patterns.has('no-waf') || patterns.has('single-region');
  if (needFrontDoor && !firstOf(FRONTEND_TYPES)) {
    const entry = firstOf(GATEWAY_TYPES) ?? firstOf(COMPUTE_TYPES);
    const addedFd = addService(
      { name: 'Front Door', type: 'Azure Front Door', description: 'Global HTTP entry + failover' },
      HARDEN_EDGE_GROUP,
    );
    const conns: string[] = [];
    if (entry) { const s = addConnection({ from: 'Front Door', to: entry.name, label: 'Route global traffic to entry point', type: 'sync' }); if (s) conns.push(s); }
    const cleared = [patterns.has('single-region') ? 'single-region' : '', patterns.has('no-waf') ? 'no-waf' : ''].filter(Boolean).join(' + ') || 'no-waf';
    if (addedFd) changes.push({ pattern: cleared, action: 'Added Azure Front Door as global edge (enables WAF + multi-region failover)', addedServices: ['Front Door'], addedConnections: conns });
  }
  if (patterns.has('no-waf')) {
    const fd = services.find(s => norm(s.type) === 'azure front door');
    const addedWaf = addService(
      { name: 'WAF Policy', type: 'Web Application Firewall', description: 'OWASP Top 10 protection' },
      HARDEN_EDGE_GROUP,
    );
    const conns: string[] = [];
    if (fd) { const s = addConnection({ from: fd.name, to: 'WAF Policy', label: 'Inspect requests for web threats', type: 'sync' }); if (s) conns.push(s); }
    if (addedWaf) changes.push({ pattern: 'no-waf', action: 'Added Web Application Firewall policy on the edge', addedServices: ['WAF Policy'], addedConnections: conns });
  }

  // ── no-api-gateway + direct-db-access → API Management ────────────────
  const needApim = patterns.has('no-api-gateway') || patterns.has('direct-db-access');
  if (needApim && !firstOf(GATEWAY_TYPES)) {
    const backend = firstOf(COMPUTE_TYPES);
    const addedApim = addService(
      { name: 'API Management', type: 'API Management', description: 'Unified API gateway' },
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
    const frontNames = new Set(services.filter(s => FRONTEND_TYPES.has(norm(s.type))).map(s => norm(s.name)));
    const rewired: string[] = [];
    if (apim) {
      for (const c of [...connections]) {
        if (frontNames.has(norm(c.from)) && dbNames.has(norm(c.to))) {
          // Drop the direct edge; route frontend → APIM → db instead.
          const idx = connections.indexOf(c);
          if (idx >= 0) connections.splice(idx, 1);
          const a = addConnection({ from: c.from, to: apim.name, label: 'Send API request through gateway', type: 'sync' });
          const b = addConnection({ from: apim.name, to: c.to, label: 'Forward request to backend service', type: 'sync' });
          if (a) rewired.push(a);
          if (b) rewired.push(b);
        }
      }
      changes.push({ pattern: 'direct-db-access', action: 'Rerouted direct frontend→database traffic through the API layer', addedServices: [], addedConnections: rewired });
    } else if (!unresolved.includes('direct-db-access')) {
      unresolved.push('direct-db-access');
    }
  }

  // ── single-database → geo-replica ────────────────────────────────────
  if (patterns.has('single-database')) {
    const primary = firstOf(DATABASE_TYPES);
    if (primary) {
      const replicaName = `${primary.name} Replica`;
      const added = addService(
        { name: replicaName, type: primary.type, description: 'Geo-replicated read replica', groupId: primary.groupId },
      );
      const conns: string[] = [];
      const s = addConnection({ from: primary.name, to: replicaName, label: 'Geo-replicate data for failover', type: 'async' });
      if (s) conns.push(s);
      if (added) changes.push({ pattern: 'single-database', action: `Added a geo-replicated replica of ${primary.name}`, addedServices: [replicaName], addedConnections: conns });
    }
  }

  // ── no-cache → Redis Cache ───────────────────────────────────────────
  if (patterns.has('no-cache')) {
    const compute = firstOf(COMPUTE_TYPES);
    const added = addService(
      { name: 'Redis Cache', type: 'Redis Cache', description: 'Low-latency cache tier' },
      compute?.groupId ? undefined : undefined,
    );
    const conns: string[] = [];
    if (compute) { const s = addConnection({ from: compute.name, to: 'Redis Cache', label: 'Cache hot data for low latency', type: 'sync' }); if (s) conns.push(s); }
    if (added) changes.push({ pattern: 'no-cache', action: 'Added Azure Cache for Redis between compute and data tiers', addedServices: ['Redis Cache'], addedConnections: conns });
  }

  // ── no-key-vault → Key Vault ─────────────────────────────────────────
  if (patterns.has('no-key-vault')) {
    const compute = firstOf(GATEWAY_TYPES) ?? firstOf(COMPUTE_TYPES);
    const added = addService(
      { name: 'Key Vault', type: 'Key Vault', description: 'Secrets, keys & certificates' },
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
      { name: 'Azure Backup', type: 'Backup', description: 'Point-in-time restore / DR' },
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
      { name: 'App Insights', type: 'Application Insights', description: 'App telemetry' },
      HARDEN_SECOPS_GROUP,
    );
    const addedMon = addService(
      { name: 'Azure Monitor', type: 'Azure Monitor', description: 'Metrics, logs & alerts' },
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

  // Iterate: adding services can newly trigger count-based patterns (e.g.
  // no-key-vault fires only once the graph reaches 4+ services), so re-detect
  // and re-remediate until the pattern set stops shrinking.
  for (let pass = 0; pass < 4; pass++) {
    const patterns = new Set(snapshot(services, connections).patternsDetected);
    if (patterns.size === 0) break;
    const sizeBefore = patterns.size;
    applyPass(patterns);
    const sizeAfter = snapshot(services, connections).patternsDetected.length;
    if (sizeAfter >= sizeBefore) break; // no progress — avoid an infinite loop
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
