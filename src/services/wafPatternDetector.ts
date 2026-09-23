// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * WAF Pattern Detector
 * 
 * Performs deterministic, rule-based analysis of an Azure architecture
 * (services, connections, groups) to detect common architectural patterns
 * and anti-patterns. Returns instant findings without any LLM calls.
 * 
 * This runs in milliseconds and provides a baseline set of findings that
 * can be combined with LLM-generated contextual analysis.
 */

import {
  WafRule,
  ARCHITECTURE_PATTERN_RULES,
  SERVICE_SPECIFIC_RULES,
  type WafPillar,
  type Severity,
} from '../data/wafRules';
import type { ValidationFinding } from './architectureValidator';

interface ServiceInput {
  name: string;
  type: string;
  category?: string;
  description?: string;
}

interface ConnectionInput {
  from: string;
  to: string;
  label?: string;
}

interface GroupInput {
  name: string;
  services?: string[];
}

interface PatternDetectionResult {
  findings: ValidationFinding[];           // All findings combined
  patternFindings: ValidationFinding[];    // Architecture-level pattern findings only
  serviceFindings: ValidationFinding[];    // Per-service best-practice findings
  patternsDetected: string[];
  serviceRulesApplied: number;
  patternRulesApplied: number;
  elapsedMs: number;
}

// ---------------------------------------------------------------------------
// Service category helpers
// ---------------------------------------------------------------------------

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
  'azure monitor', 'application insights', 'log analytics',
  'app insights',
]);

const IDENTITY_TYPES = new Set([
  'microsoft entra id', 'entra id', 'azure ad',
  'azure active directory',
]);

const WAF_TYPES = new Set([
  'web application firewall', 'waf', 'azure waf',
]);

const KEY_VAULT_TYPES = new Set([
  'key vault', 'azure key vault',
]);

const BACKUP_TYPES = new Set([
  'azure backup', 'backup', 'recovery services',
]);

const API_GATEWAY_TYPES = new Set([
  'api management', 'apim', 'azure api management',
  'application gateway', 'azure front door',
]);

function normalizeType(type: string): string {
  return type.toLowerCase().trim();
}

function hasServiceOfType(services: ServiceInput[], typeSet: Set<string>): boolean {
  return services.some(s => typeSet.has(normalizeType(s.type)));
}

function getServicesOfType(services: ServiceInput[], typeSet: Set<string>): ServiceInput[] {
  return services.filter(s => typeSet.has(normalizeType(s.type)));
}

// ---------------------------------------------------------------------------
// Pattern detection functions
// ---------------------------------------------------------------------------

function detectPatterns(
  services: ServiceInput[],
  connections: ConnectionInput[],
): string[] {
  const patterns: string[] = [];

  // Single region — we can't truly detect multi-region from the diagram,
  // but if there's no Traffic Manager / Front Door with multiple backends,
  // it's likely single-region
  const hasGlobalLB = services.some(s => {
    const t = normalizeType(s.type);
    return t === 'azure traffic manager' || t === 'azure front door' || t === 'traffic manager';
  });
  if (!hasGlobalLB && services.length >= 3) {
    patterns.push('single-region');
  }

  // Single database — only one DB service with no replication hint
  const databases = getServicesOfType(services, DATABASE_TYPES);
  if (databases.length === 1) {
    patterns.push('single-database');
  }

  // No caching layer
  if (!hasServiceOfType(services, CACHE_TYPES)) {
    const hasCompute = hasServiceOfType(services, COMPUTE_TYPES);
    const hasDB = databases.length > 0;
    if (hasCompute && hasDB) {
      patterns.push('no-cache');
    }
  }

  // No monitoring
  if (!hasServiceOfType(services, MONITORING_TYPES)) {
    patterns.push('no-monitoring');
  }

  // No identity provider
  if (!hasServiceOfType(services, IDENTITY_TYPES)) {
    patterns.push('no-identity');
  }

  // No WAF — only applies if there are public-facing services
  const hasFrontend = hasServiceOfType(services, FRONTEND_TYPES);
  const hasWebApp = services.some(s => {
    const t = normalizeType(s.type);
    return t === 'app service' || t === 'static web apps' || t === 'azure static web apps';
  });
  if ((hasFrontend || hasWebApp) && !hasServiceOfType(services, WAF_TYPES)) {
    // Check if Front Door or App Gateway already has WAF capability
    const hasAppGw = services.some(s => normalizeType(s.type) === 'application gateway');
    const hasFrontDoor = services.some(s => normalizeType(s.type) === 'azure front door');
    // They might have WAF, but we flag it as a recommendation to verify
    if (!hasAppGw && !hasFrontDoor) {
      patterns.push('no-waf');
    }
  }

  // Direct frontend-to-database access
  const frontendNames = new Set(
    services
      .filter(s => FRONTEND_TYPES.has(normalizeType(s.type)))
      .map(s => s.name.toLowerCase())
  );
  const dbNames = new Set(
    databases.map(s => s.name.toLowerCase())
  );
  for (const conn of connections) {
    if (frontendNames.has(conn.from.toLowerCase()) && dbNames.has(conn.to.toLowerCase())) {
      patterns.push('direct-db-access');
      break;
    }
  }

  // No Key Vault
  if (!hasServiceOfType(services, KEY_VAULT_TYPES) && services.length >= 4) {
    patterns.push('no-key-vault');
  }

  // No backup
  if (!hasServiceOfType(services, BACKUP_TYPES) && databases.length > 0) {
    patterns.push('no-backup');
  }

  // No API gateway — only when there are multiple backend services
  const computeServices = getServicesOfType(services, COMPUTE_TYPES);
  if (computeServices.length >= 2 && !hasServiceOfType(services, API_GATEWAY_TYPES)) {
    patterns.push('no-api-gateway');
  }

  return patterns;
}

// ---------------------------------------------------------------------------
// Main detection entry point
// ---------------------------------------------------------------------------

/**
 * Run rule-based WAF validation against an architecture.
 * Returns deterministic findings in milliseconds (no LLM calls).
 */
export function detectWafPatterns(
  services: ServiceInput[],
  connections: ConnectionInput[],
  _groups?: GroupInput[],
): PatternDetectionResult {
  const startTime = performance.now();
  const patternFindings: ValidationFinding[] = [];
  const serviceFindings: ValidationFinding[] = [];
  const patternsDetected: string[] = [];
  let serviceRulesApplied = 0;
  let patternRulesApplied = 0;

  // 1. Detect architecture-wide patterns
  const patterns = detectPatterns(services, connections);
  patternsDetected.push(...patterns);

  // Map detected patterns to findings
  for (const rule of ARCHITECTURE_PATTERN_RULES) {
    if (rule.pattern && patterns.includes(rule.pattern)) {
      patternRulesApplied++;
      patternFindings.push({
        severity: rule.severity,
        category: rule.category,
        issue: rule.issue,
        recommendation: rule.recommendation,
        resources: rule.appliesTo[0] === '*'
          ? getAffectedResources(rule, services, patterns)
          : rule.appliesTo,
      });
    }
  }

  // 2. Apply per-service rules
  for (const service of services) {
    const serviceType = normalizeType(service.type);
    const applicableRules = SERVICE_SPECIFIC_RULES.filter(rule =>
      rule.appliesTo.some(t => normalizeType(t) === serviceType)
    );

    for (const rule of applicableRules) {
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
  const elapsedMs = Math.round(performance.now() - startTime);

  console.log(`⚡ WAF pattern detection: ${findings.length} findings in ${elapsedMs}ms`);
  console.log(`  📋 Patterns: ${patternsDetected.join(', ') || 'none'}`);
  console.log(`  🔧 Rules applied: ${patternRulesApplied} pattern + ${serviceRulesApplied} service-specific`);

  return {
    findings,
    patternFindings,
    serviceFindings,
    patternsDetected,
    serviceRulesApplied,
    patternRulesApplied,
    elapsedMs,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determine which services are affected by an architecture-wide pattern.
 */
function getAffectedResources(
  rule: WafRule,
  services: ServiceInput[],
  _patterns: string[],
): string[] {
  switch (rule.pattern) {
    case 'single-database':
      return getServicesOfType(services, DATABASE_TYPES).map(s => s.name);

    case 'no-cache':
      return [
        ...getServicesOfType(services, COMPUTE_TYPES).map(s => s.name),
        ...getServicesOfType(services, DATABASE_TYPES).map(s => s.name),
      ];

    case 'no-monitoring':
      return services.map(s => s.name); // Affects everything

    case 'no-identity':
      return getServicesOfType(services, COMPUTE_TYPES).map(s => s.name);

    case 'no-waf':
      return services
        .filter(s => FRONTEND_TYPES.has(normalizeType(s.type)) ||
          normalizeType(s.type) === 'app service')
        .map(s => s.name);

    case 'direct-db-access':
      return [
        ...services.filter(s => FRONTEND_TYPES.has(normalizeType(s.type))).map(s => s.name),
        ...getServicesOfType(services, DATABASE_TYPES).map(s => s.name),
      ];

    case 'no-key-vault':
      return getServicesOfType(services, COMPUTE_TYPES).map(s => s.name);

    case 'no-backup':
      return getServicesOfType(services, DATABASE_TYPES).map(s => s.name);

    case 'no-api-gateway':
      return getServicesOfType(services, COMPUTE_TYPES).map(s => s.name);

    default:
      return services.map(s => s.name);
  }
}

/**
 * Calculate a preliminary score based on rule-based findings alone.
 * This gives an instant approximation before the LLM refines it.
 */
export function calculatePreliminaryScore(findings: ValidationFinding[]): number {
  if (findings.length === 0) return 95;

  // Point deductions by severity
  const deductions: Record<Severity, number> = {
    critical: 12,
    high: 7,
    medium: 3,
    low: 1,
  };

  let totalDeduction = 0;
  for (const finding of findings) {
    totalDeduction += deductions[finding.severity] || 2;
  }

  // Cap at a minimum score of 10
  return Math.max(10, 100 - totalDeduction);
}

/**
 * Group findings by WAF pillar for display.
 */
export function groupFindingsByPillar(
  findings: ValidationFinding[],
): Record<WafPillar, ValidationFinding[]> {
  // Map finding categories back to pillars using the rules
  const categoryToPillar = new Map<string, WafPillar>();
  for (const rule of [...ARCHITECTURE_PATTERN_RULES, ...SERVICE_SPECIFIC_RULES]) {
    categoryToPillar.set(rule.category, rule.pillar);
  }

  const grouped: Record<WafPillar, ValidationFinding[]> = {
    'Reliability': [],
    'Security': [],
    'Cost Optimization': [],
    'Operational Excellence': [],
    'Performance Efficiency': [],
  };

  for (const finding of findings) {
    const pillar = categoryToPillar.get(finding.category) || 'Operational Excellence';
    grouped[pillar].push(finding);
  }

  return grouped;
}
