// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * WAF Pattern Detector for MCP Server
 *
 * Standalone, Node.js-compatible extraction of the Diagram Builder's
 * deterministic WAF validation engine. Detects architectural patterns
 * and anti-patterns against Azure Well-Architected Framework rules
 * without any LLM calls — pure rule-based analysis.
 */

// ── Types ──────────────────────────────────────────────────────────────

export type WafPillar =
  | 'Reliability'
  | 'Security'
  | 'Cost Optimization'
  | 'Operational Excellence'
  | 'Performance Efficiency';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface WafRule {
  id: string;
  pillar: WafPillar;
  severity: Severity;
  category: string;
  issue: string;
  recommendation: string;
  appliesTo: string[];
  pattern?: string;
}

export interface ValidationFinding {
  severity: Severity;
  category: string;
  issue: string;
  recommendation: string;
  resources?: string[];
}

export interface ServiceInput {
  name: string;
  type: string;
}

export interface ConnectionInput {
  from: string;
  to: string;
  label?: string;
}

export interface PatternDetectionResult {
  findings: ValidationFinding[];
  patternFindings: ValidationFinding[];
  serviceFindings: ValidationFinding[];
  patternsDetected: string[];
  score: number;
  serviceRulesApplied: number;
  patternRulesApplied: number;
}

// ── Architecture-wide pattern rules ────────────────────────────────────

const ARCHITECTURE_PATTERN_RULES: WafRule[] = [
  { id: 'arch-no-redundancy',        pillar: 'Reliability',            severity: 'high',     category: 'High Availability',    issue: 'Single-region deployment with no failover capability', recommendation: 'Deploy across multiple Azure regions or availability zones. Use Azure Traffic Manager or Azure Front Door for global load balancing and automatic failover.', appliesTo: ['*'], pattern: 'single-region' },
  { id: 'arch-single-database',      pillar: 'Reliability',            severity: 'high',     category: 'Data Resilience',      issue: 'Single database instance without replication or geo-redundancy', recommendation: 'Enable geo-replication, read replicas, or active-active configuration for your database to ensure data availability during outages.', appliesTo: ['*'], pattern: 'single-database' },
  { id: 'arch-no-caching',           pillar: 'Performance Efficiency', severity: 'medium',   category: 'Caching',              issue: 'No caching layer detected between compute and data tiers', recommendation: 'Add Azure Cache for Redis or Azure CDN to reduce database load and improve response times for frequently accessed data.', appliesTo: ['*'], pattern: 'no-cache' },
  { id: 'arch-no-monitoring',        pillar: 'Operational Excellence', severity: 'high',     category: 'Observability',        issue: 'No monitoring or observability services detected in the architecture', recommendation: 'Add Azure Monitor, Application Insights, and Log Analytics to track application health, performance, and diagnose issues proactively.', appliesTo: ['*'], pattern: 'no-monitoring' },
  { id: 'arch-no-identity',          pillar: 'Security',               severity: 'critical', category: 'Identity & Access',    issue: 'No identity provider or authentication service detected', recommendation: 'Add Microsoft Entra ID for centralized authentication and authorization. Use managed identities for service-to-service communication.', appliesTo: ['*'], pattern: 'no-identity' },
  { id: 'arch-no-waf',               pillar: 'Security',               severity: 'high',     category: 'Network Security',     issue: 'Public-facing application without Web Application Firewall (WAF)', recommendation: 'Deploy Azure Front Door with WAF or Application Gateway with WAF to protect against OWASP Top 10 threats, DDoS, and bot attacks.', appliesTo: ['*'], pattern: 'no-waf' },
  { id: 'arch-direct-db-access',     pillar: 'Security',               severity: 'critical', category: 'Network Security',     issue: 'Frontend service connects directly to a database without an API layer', recommendation: 'Place an API layer (App Service, Functions, or API Management) between frontend and database to enforce access control, input validation, and rate limiting.', appliesTo: ['*'], pattern: 'direct-db-access' },
  { id: 'arch-no-secrets-management', pillar: 'Security',              severity: 'high',     category: 'Secrets Management',   issue: 'No secrets management service (Key Vault) detected in the architecture', recommendation: 'Add Azure Key Vault to centrally manage secrets, certificates, and encryption keys.', appliesTo: ['*'], pattern: 'no-key-vault' },
  { id: 'arch-no-backup',            pillar: 'Reliability',            severity: 'medium',   category: 'Disaster Recovery',    issue: 'No backup or disaster recovery service detected', recommendation: 'Add Azure Backup or configure point-in-time restore for databases. Define and test your RPO/RTO targets.', appliesTo: ['*'], pattern: 'no-backup' },
  { id: 'arch-no-api-gateway',       pillar: 'Security',               severity: 'medium',   category: 'API Security',         issue: 'Multiple backend services exposed without a centralized API gateway', recommendation: 'Add Azure API Management to centralize API exposure, enforce authentication, rate limiting, and provide a unified API surface.', appliesTo: ['*'], pattern: 'no-api-gateway' },
];

// ── Per-service rules ──────────────────────────────────────────────────

const SERVICE_SPECIFIC_RULES: WafRule[] = [
  // App Service
  { id: 'appsvc-managed-identity', pillar: 'Security',               severity: 'high',   category: 'Identity & Access',     issue: 'App Service should use managed identity instead of connection strings', recommendation: 'Enable system-assigned or user-assigned managed identity on App Service for authenticating to Azure SQL, Key Vault, Storage, and other Azure services.', appliesTo: ['App Service'] },
  { id: 'appsvc-https-only',      pillar: 'Security',               severity: 'critical', category: 'Transport Security',   issue: 'App Service should enforce HTTPS-only traffic', recommendation: 'Enable "HTTPS Only" in App Service configuration. Configure minimum TLS version to 1.2.', appliesTo: ['App Service'] },
  { id: 'appsvc-autoscale',       pillar: 'Performance Efficiency', severity: 'medium',   category: 'Scaling',              issue: 'App Service should have autoscale rules configured', recommendation: 'Configure autoscale rules based on CPU, memory, or HTTP queue length.', appliesTo: ['App Service'] },
  { id: 'appsvc-deploy-slots',    pillar: 'Operational Excellence', severity: 'medium',   category: 'Deployment Strategy',  issue: 'App Service should use deployment slots for zero-downtime deployments', recommendation: 'Use staging deployment slots with swap operations for zero-downtime deployments.', appliesTo: ['App Service'] },
  { id: 'appsvc-health-check',    pillar: 'Reliability',            severity: 'medium',   category: 'Health Monitoring',    issue: 'App Service should have a health check endpoint configured', recommendation: 'Configure the Health Check feature in App Service to automatically remove unhealthy instances.', appliesTo: ['App Service'] },

  // Azure Functions
  { id: 'func-consumption-plan',   pillar: 'Cost Optimization',     severity: 'medium',   category: 'Compute Pricing',      issue: 'Azure Functions on Consumption plan may have cold start latency', recommendation: 'For latency-sensitive workloads, consider Premium plan with pre-warmed instances.', appliesTo: ['Functions'] },
  { id: 'func-managed-identity',   pillar: 'Security',              severity: 'high',     category: 'Identity & Access',    issue: 'Azure Functions should use managed identity for Azure service access', recommendation: 'Enable managed identity on Function Apps instead of storing connection strings or API keys.', appliesTo: ['Functions'] },

  // AKS
  { id: 'aks-rbac',               pillar: 'Security',               severity: 'high',     category: 'Access Control',       issue: 'AKS cluster should have Azure RBAC and Entra ID integration enabled', recommendation: 'Enable Azure RBAC for Kubernetes and integrate with Microsoft Entra ID for centralized authentication.', appliesTo: ['Kubernetes Service'] },
  { id: 'aks-network-policy',     pillar: 'Security',               severity: 'high',     category: 'Network Security',     issue: 'AKS should have network policies enabled for pod-to-pod traffic control', recommendation: 'Enable Azure CNI with network policies (Calico or Azure) to restrict pod-to-pod communication.', appliesTo: ['Kubernetes Service'] },

  // Cosmos DB
  { id: 'cosmos-consistency',     pillar: 'Reliability',            severity: 'medium',   category: 'Data Consistency',     issue: 'Azure Cosmos DB consistency level should be reviewed for the workload', recommendation: 'Choose the appropriate consistency level (Strong, Bounded Staleness, Session, Consistent Prefix, or Eventual) based on your availability vs consistency requirements.', appliesTo: ['Azure Cosmos DB'] },

  // SQL Database
  { id: 'sql-tde',                pillar: 'Security',               severity: 'high',     category: 'Data Encryption',      issue: 'SQL Database should have Transparent Data Encryption (TDE) enabled', recommendation: 'Ensure TDE is enabled (it is by default). Consider customer-managed keys (CMK) for regulated workloads.', appliesTo: ['SQL Database'] },
  { id: 'sql-audit',              pillar: 'Security',               severity: 'high',     category: 'Auditing',             issue: 'SQL Database should have auditing enabled', recommendation: 'Enable Azure SQL auditing to Log Analytics or Storage Account for compliance and threat detection.', appliesTo: ['SQL Database'] },

  // Storage
  { id: 'storage-https',          pillar: 'Security',               severity: 'critical', category: 'Transport Security',   issue: 'Storage Account should enforce HTTPS-only access', recommendation: 'Enable "Secure transfer required" on the storage account.', appliesTo: ['Storage Account'] },
  { id: 'storage-private',        pillar: 'Security',               severity: 'high',     category: 'Network Security',     issue: 'Storage Account should use private endpoints', recommendation: 'Disable public blob access and use Private Endpoints or service endpoints.', appliesTo: ['Storage Account'] },

  // Key Vault
  { id: 'kv-soft-delete',         pillar: 'Reliability',            severity: 'high',     category: 'Data Protection',      issue: 'Key Vault should have soft-delete and purge protection enabled', recommendation: 'Enable soft-delete (90-day retention) and purge protection to prevent accidental deletion of secrets, keys, and certificates.', appliesTo: ['Key Vault'] },

  // Virtual Machines
  { id: 'vm-managed-disks',       pillar: 'Reliability',            severity: 'high',     category: 'Storage Reliability',  issue: 'Virtual Machines should use managed disks', recommendation: 'Use Azure Managed Disks for 99.9%+ SLA and the ability to replicate across fault/update domains.', appliesTo: ['Virtual Machines'] },
  { id: 'vm-availability',        pillar: 'Reliability',            severity: 'high',     category: 'High Availability',    issue: 'VMs should use Availability Zones or Scale Sets for HA', recommendation: 'Deploy VMs in Availability Zones (99.99% SLA) or Virtual Machine Scale Sets for automatic scaling and HA.', appliesTo: ['Virtual Machines'] },
];

// ── Service type sets ──────────────────────────────────────────────────

const DATABASE_TYPES = new Set([
  'sql database', 'azure cosmos db', 'postgresql', 'mysql',
  'azure database for postgresql', 'azure database for mysql',
  'cosmos db', 'cosmosdb', 'redis cache', 'azure cache for redis',
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

const CACHE_TYPES = new Set([
  'redis cache', 'azure cache for redis', 'cdn', 'content delivery network',
]);

const MONITORING_TYPES = new Set([
  'azure monitor', 'application insights', 'log analytics', 'app insights',
]);

const IDENTITY_TYPES = new Set([
  'microsoft entra id', 'entra id', 'azure ad', 'azure active directory',
]);

const WAF_TYPES = new Set(['web application firewall', 'waf', 'azure waf']);

const KEY_VAULT_TYPES = new Set(['key vault', 'azure key vault']);

const BACKUP_TYPES = new Set(['azure backup', 'backup', 'recovery services']);

const API_GATEWAY_TYPES = new Set([
  'api management', 'apim', 'azure api management',
  'application gateway', 'azure front door',
]);

// ── Helpers ────────────────────────────────────────────────────────────

function norm(t: string): string {
  return t.toLowerCase().trim();
}

function hasType(services: ServiceInput[], typeSet: Set<string>): boolean {
  return services.some(s => typeSet.has(norm(s.type)));
}

function ofType(services: ServiceInput[], typeSet: Set<string>): ServiceInput[] {
  return services.filter(s => typeSet.has(norm(s.type)));
}

// ── Pattern detection ──────────────────────────────────────────────────

function detectPatterns(services: ServiceInput[], connections: ConnectionInput[]): string[] {
  const patterns: string[] = [];

  const hasGlobalLB = services.some(s => {
    const t = norm(s.type);
    return t === 'azure traffic manager' || t === 'azure front door' || t === 'traffic manager';
  });
  if (!hasGlobalLB && services.length >= 3) patterns.push('single-region');

  const databases = ofType(services, DATABASE_TYPES);
  if (databases.length === 1) patterns.push('single-database');

  if (!hasType(services, CACHE_TYPES) && hasType(services, COMPUTE_TYPES) && databases.length > 0) {
    patterns.push('no-cache');
  }

  if (!hasType(services, MONITORING_TYPES)) patterns.push('no-monitoring');
  if (!hasType(services, IDENTITY_TYPES)) patterns.push('no-identity');

  const hasFrontend = hasType(services, FRONTEND_TYPES);
  const hasWebApp = services.some(s => ['app service', 'static web apps', 'azure static web apps'].includes(norm(s.type)));
  if ((hasFrontend || hasWebApp) && !hasType(services, WAF_TYPES)) {
    const hasAppGw = services.some(s => norm(s.type) === 'application gateway');
    const hasFD = services.some(s => norm(s.type) === 'azure front door');
    if (!hasAppGw && !hasFD) patterns.push('no-waf');
  }

  // Direct frontend → database
  const frontendNames = new Set(
    services.filter(s => FRONTEND_TYPES.has(norm(s.type))).map(s => s.name.toLowerCase()),
  );
  const dbNames = new Set(databases.map(s => s.name.toLowerCase()));
  for (const c of connections) {
    if (frontendNames.has(c.from.toLowerCase()) && dbNames.has(c.to.toLowerCase())) {
      patterns.push('direct-db-access');
      break;
    }
  }

  if (!hasType(services, KEY_VAULT_TYPES) && services.length >= 4) patterns.push('no-key-vault');
  if (!hasType(services, BACKUP_TYPES) && databases.length > 0) patterns.push('no-backup');

  const computeServices = ofType(services, COMPUTE_TYPES);
  if (computeServices.length >= 2 && !hasType(services, API_GATEWAY_TYPES)) {
    patterns.push('no-api-gateway');
  }

  return patterns;
}

// ── Affected resources helper ──────────────────────────────────────────

function getAffectedResources(rule: WafRule, services: ServiceInput[]): string[] {
  switch (rule.pattern) {
    case 'single-database':   return ofType(services, DATABASE_TYPES).map(s => s.name);
    case 'no-cache':          return [...ofType(services, COMPUTE_TYPES), ...ofType(services, DATABASE_TYPES)].map(s => s.name);
    case 'no-monitoring':     return services.map(s => s.name);
    case 'no-identity':       return ofType(services, COMPUTE_TYPES).map(s => s.name);
    case 'no-waf':            return services.filter(s => FRONTEND_TYPES.has(norm(s.type)) || norm(s.type) === 'app service').map(s => s.name);
    case 'direct-db-access':  return [...services.filter(s => FRONTEND_TYPES.has(norm(s.type))), ...ofType(services, DATABASE_TYPES)].map(s => s.name);
    case 'no-key-vault':      return ofType(services, COMPUTE_TYPES).map(s => s.name);
    case 'no-backup':         return ofType(services, DATABASE_TYPES).map(s => s.name);
    case 'no-api-gateway':    return ofType(services, COMPUTE_TYPES).map(s => s.name);
    default:                  return services.map(s => s.name);
  }
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Run deterministic WAF pattern detection on an architecture.
 * Returns instantly (no LLM calls).
 */
export function detectWafPatterns(
  services: ServiceInput[],
  connections: ConnectionInput[],
): PatternDetectionResult {
  const patternFindings: ValidationFinding[] = [];
  const serviceFindings: ValidationFinding[] = [];
  let serviceRulesApplied = 0;
  let patternRulesApplied = 0;

  // Architecture-wide patterns
  const patterns = detectPatterns(services, connections);
  for (const rule of ARCHITECTURE_PATTERN_RULES) {
    if (rule.pattern && patterns.includes(rule.pattern)) {
      patternRulesApplied++;
      patternFindings.push({
        severity: rule.severity,
        category: rule.category,
        issue: rule.issue,
        recommendation: rule.recommendation,
        resources: rule.appliesTo[0] === '*' ? getAffectedResources(rule, services) : rule.appliesTo,
      });
    }
  }

  // Per-service rules
  for (const service of services) {
    const serviceType = norm(service.type);
    const applicable = SERVICE_SPECIFIC_RULES.filter(r =>
      r.appliesTo.some(t => norm(t) === serviceType),
    );
    for (const rule of applicable) {
      serviceRulesApplied++;
      serviceFindings.push({
        severity: rule.severity,
        category: rule.category,
        issue: rule.issue,
        recommendation: rule.recommendation,
        resources: [service.name],
      });
    }
  }

  const findings = [...patternFindings, ...serviceFindings];

  // Score: start at 100, deduct by severity
  const deductions: Record<Severity, number> = { critical: 12, high: 7, medium: 3, low: 1 };
  let score = 100;
  for (const f of findings) score -= deductions[f.severity] ?? 2;
  score = Math.max(10, score);

  return {
    findings,
    patternFindings,
    serviceFindings,
    patternsDetected: patterns,
    score,
    serviceRulesApplied,
    patternRulesApplied,
  };
}

/**
 * Get all WAF rules (architecture-wide + per-service), optionally filtered by pillar.
 */
export function getWafRules(pillar?: WafPillar): WafRule[] {
  const all = [...ARCHITECTURE_PATTERN_RULES, ...SERVICE_SPECIFIC_RULES];
  if (!pillar) return all;
  return all.filter(r => r.pillar === pillar);
}

/**
 * Group findings by WAF pillar.
 */
export function groupFindingsByPillar(
  findings: ValidationFinding[],
): Record<WafPillar, ValidationFinding[]> {
  const categoryToPillar = new Map<string, WafPillar>();
  for (const r of [...ARCHITECTURE_PATTERN_RULES, ...SERVICE_SPECIFIC_RULES]) {
    categoryToPillar.set(r.category, r.pillar);
  }

  const grouped: Record<WafPillar, ValidationFinding[]> = {
    'Reliability': [],
    'Security': [],
    'Cost Optimization': [],
    'Operational Excellence': [],
    'Performance Efficiency': [],
  };

  for (const f of findings) {
    const pillar = categoryToPillar.get(f.category) || 'Operational Excellence';
    grouped[pillar].push(f);
  }

  return grouped;
}
